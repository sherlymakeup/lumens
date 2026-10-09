// Registry thread agent (Supabase PostgREST, server-side only, service_role).
// Graceful: kalau Supabase belum dikonfigurasi, panggil /api/agent tetap jalan
// dalam mode stateless (sandboxId dari client seperti sebelumnya).
import { isValidThreadRef } from "./thread.ts";

export type ThreadEnv = { url: string; key: string } | undefined;

export function threadEnv(): ThreadEnv {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return url && key ? { url, key } : undefined;
}

function headers(env: { url: string; key: string }) {
  return {
    apikey: env.key,
    Authorization: `Bearer ${env.key}`,
    "Content-Type": "application/json",
  };
}

export type ThreadRow = {
  id: string;
  parent_id: string | null;
  sandbox_id: string | null;
  workdir: string;
  created_at: string;
  last_active: string;
};

function normalizeRow(raw: Record<string, unknown>): ThreadRow | null {
  const id = String(raw.id ?? "");
  if (!isValidThreadRef(id)) return null;
  return {
    id,
    parent_id: raw.parent_id ? String(raw.parent_id) : null,
    sandbox_id: raw.sandbox_id ? String(raw.sandbox_id) : null,
    workdir: String(raw.workdir ?? ""),
    created_at: String(raw.created_at ?? ""),
    last_active: String(raw.last_active ?? ""),
  };
}

/** Ambil thread dari registry. null env → { ok: false, skipped: true }. */
export async function getThread(
  env: ThreadEnv,
  id: string,
): Promise<{ ok: true; thread: ThreadRow | null } | { ok: false; skipped?: boolean }> {
  if (!env) return { ok: false, skipped: true };
  if (!isValidThreadRef(id)) return { ok: true, thread: null };
  try {
    const res = await fetch(
      `${env.url}/rest/v1/threads?id=eq.${encodeURIComponent(id)}&select=*`,
      { headers: headers(env), signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return { ok: false };
    const rows = (await res.json().catch(() => [])) as Record<string, unknown>[];
    const row = rows.length > 0 ? normalizeRow(rows[0]) : null;
    return { ok: true, thread: row };
  } catch {
    return { ok: false };
  }
}

/** Simpan/update thread (upsert via on-conflict). */
export async function upsertThread(
  env: ThreadEnv,
  input: { id: string; parent_id?: string | null; sandbox_id?: string | null; workdir: string },
): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!env) return { ok: false, skipped: true };
  if (!isValidThreadRef(input.id)) return { ok: false };
  try {
    const res = await fetch(`${env.url}/rest/v1/threads`, {
      method: "POST",
      headers: {
        ...headers(env),
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        id: input.id,
        parent_id: input.parent_id ?? null,
        sandbox_id: input.sandbox_id ?? null,
        workdir: input.workdir,
        last_active: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

/** Refresh last_active. Dipakai tiap request agent. */
export async function touchThread(
  env: ThreadEnv,
  id: string,
): Promise<void> {
  if (!env || !isValidThreadRef(id)) return;
  try {
    await fetch(`${env.url}/rest/v1/threads?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: headers(env),
      body: JSON.stringify({ last_active: new Date().toISOString() }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    /* best-effort */
  }
}
