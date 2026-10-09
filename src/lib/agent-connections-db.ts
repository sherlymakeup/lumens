// Koneksi konektor (Supabase PostgREST, server-side only, service_role key).
// Secret tersimpan terenkripsi (AES-256-GCM); list publik tidak pernah
// menyertakan auth_secret.
import { decryptSecret, encryptSecret } from "./connector-crypto.ts";
import type {
  AuthType,
  ConnectorKind,
  ConnectorToolDef,
} from "./agent-connectors.ts";

export type ConnectionEnv = { url: string; key: string } | undefined;

export function connectionEnv(): ConnectionEnv {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return url && key ? { url, key } : undefined;
}

const NOT_CONFIGURED =
  "Konektor belum dikonfigurasi: tambahkan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di environment server.";

function headers(env: { url: string; key: string }) {
  return {
    apikey: env.key,
    Authorization: `Bearer ${env.key}`,
    "Content-Type": "application/json",
  };
}

export type ConnectionRow = {
  id: string;
  name: string;
  kind: ConnectorKind;
  base_url: string;
  auth_type: AuthType;
  auth_name: string | null;
  auth_secret: string | null;
  tools: ConnectorToolDef[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

/** Versi aman untuk client: tanpa auth_secret. */
export type ConnectionPublic = Omit<ConnectionRow, "auth_secret"> & {
  has_secret: boolean;
};

function toPublic(row: ConnectionRow): ConnectionPublic {
  const { auth_secret, ...rest } = row;
  return { ...rest, has_secret: !!auth_secret };
}

function normalizeRow(raw: Record<string, unknown>): ConnectionRow {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    kind: raw.kind === "mcp" ? "mcp" : "http",
    base_url: String(raw.base_url ?? ""),
    auth_type: (["none", "bearer", "header", "query"] as AuthType[]).includes(
      raw.auth_type as AuthType,
    )
      ? (raw.auth_type as AuthType)
      : "none",
    auth_name: raw.auth_name ? String(raw.auth_name) : null,
    auth_secret: raw.auth_secret ? String(raw.auth_secret) : null,
    tools: Array.isArray(raw.tools) ? (raw.tools as ConnectorToolDef[]) : [],
    enabled: raw.enabled !== false,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export async function listConnections(
  env: ConnectionEnv,
): Promise<{ ok: boolean; text: string; items: ConnectionPublic[] }> {
  if (!env) return { ok: false, text: NOT_CONFIGURED, items: [] };
  let res: Response;
  try {
    res = await fetch(
      `${env.url}/rest/v1/connections?select=*&order=created_at.asc`,
      { headers: headers(env), signal: AbortSignal.timeout(20_000) },
    );
  } catch (error) {
    return {
      ok: false,
      text: `Daftar koneksi gagal dijangkau: ${error instanceof Error ? error.message : String(error)}`,
      items: [],
    };
  }
  if (!res.ok) return { ok: false, text: `Daftar koneksi error ${res.status}.`, items: [] };
  const rows = (await res.json().catch(() => [])) as Record<string, unknown>[];
  return { ok: true, text: "ok", items: rows.map(normalizeRow).map(toPublic) };
}

/** Ambil satu koneksi lengkap + secret terdekripsi (server-side only). */
export async function getConnectionFull(
  env: ConnectionEnv,
  id: string,
): Promise<{ ok: boolean; text: string; row?: ConnectionRow; secret?: string | null }> {
  const cleanId = id.trim().slice(0, 60);
  if (!cleanId) return { ok: false, text: "ID koneksi kosong." };
  if (!env) return { ok: false, text: NOT_CONFIGURED };
  const params = new URLSearchParams({ id: `eq.${cleanId}`, select: "*" });
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/connections?${params}`, {
      headers: headers(env),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    return {
      ok: false,
      text: `Koneksi gagal dijangkau: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!res.ok) return { ok: false, text: `Koneksi error ${res.status}.` };
  const rows = (await res.json().catch(() => [])) as Record<string, unknown>[];
  if (rows.length === 0) return { ok: false, text: "Koneksi tidak ditemukan." };
  const row = normalizeRow(rows[0]);
  let secret: string | null = null;
  if (row.auth_secret) {
    try {
      secret = decryptSecret(row.auth_secret);
    } catch {
      return { ok: false, text: "Gagal mendekripsi secret koneksi (cek CONNECTOR_ENCRYPTION_KEY)." };
    }
  }
  return { ok: true, text: "ok", row, secret };
}

/** Ambil semua koneksi aktif + secret terdekripsi untuk agent (server-side only). */
export async function listEnabledConnectionsFull(
  env: ConnectionEnv,
): Promise<{ ok: boolean; rows: (ConnectionRow & { secret: string | null })[] }> {
  if (!env) return { ok: false, rows: [] };
  const params = new URLSearchParams({ enabled: "eq.true", select: "*", order: "created_at.asc" });
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/connections?${params}`, {
      headers: headers(env),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { ok: false, rows: [] };
  }
  if (!res.ok) return { ok: false, rows: [] };
  const raw = (await res.json().catch(() => [])) as Record<string, unknown>[];
  const rows: (ConnectionRow & { secret: string | null })[] = [];
  for (const r of raw) {
    const row = normalizeRow(r);
    let secret: string | null = null;
    if (row.auth_secret) {
      try {
        secret = decryptSecret(row.auth_secret);
      } catch {
        continue; // lewati koneksi yang secret-nya rusak
      }
    }
    rows.push({ ...row, secret });
  }
  return { ok: true, rows };
}

export type ConnectionInput = {
  name: string;
  kind: ConnectorKind;
  base_url: string;
  auth_type: AuthType;
  auth_name?: string;
  /** Secret mentah dari user — dienkripsi sebelum disimpan. Kosong = tidak diubah (update). */
  auth_secret?: string;
  clear_secret?: boolean;
  tools?: ConnectorToolDef[];
  enabled?: boolean;
};

export async function createConnection(
  env: ConnectionEnv,
  input: ConnectionInput,
): Promise<{ ok: boolean; text: string; item?: ConnectionPublic }> {
  if (!env) return { ok: false, text: NOT_CONFIGURED };
  let enc: string | null = null;
  if (input.auth_secret) {
    try {
      enc = encryptSecret(input.auth_secret);
    } catch (error) {
      return { ok: false, text: error instanceof Error ? error.message : "Enkripsi gagal." };
    }
  }
  const body = {
    name: input.name,
    kind: input.kind,
    base_url: input.base_url,
    auth_type: input.auth_type,
    auth_name: input.auth_name || null,
    auth_secret: enc,
    tools: input.tools ?? [],
    enabled: input.enabled !== false,
  };
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/connections`, {
      method: "POST",
      headers: { ...headers(env), Prefer: "return=representation" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    return {
      ok: false,
      text: `Simpan koneksi gagal dijangkau: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, text: `Simpan koneksi error ${res.status}: ${detail.slice(0, 200)}` };
  }
  const rows = (await res.json().catch(() => [])) as Record<string, unknown>[];
  if (!rows[0]) return { ok: false, text: "Simpan koneksi gagal (tanpa hasil)." };
  return { ok: true, text: "Koneksi tersimpan.", item: toPublic(normalizeRow(rows[0])) };
}

export async function updateConnection(
  env: ConnectionEnv,
  id: string,
  input: Partial<ConnectionInput>,
): Promise<{ ok: boolean; text: string; item?: ConnectionPublic }> {
  const cleanId = id.trim().slice(0, 60);
  if (!cleanId) return { ok: false, text: "ID koneksi kosong." };
  if (!env) return { ok: false, text: NOT_CONFIGURED };
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.base_url !== undefined) patch.base_url = input.base_url;
  if (input.auth_type !== undefined) patch.auth_type = input.auth_type;
  if (input.auth_name !== undefined) patch.auth_name = input.auth_name || null;
  if (input.clear_secret) patch.auth_secret = null;
  else if (input.auth_secret) {
    try {
      patch.auth_secret = encryptSecret(input.auth_secret);
    } catch (error) {
      return { ok: false, text: error instanceof Error ? error.message : "Enkripsi gagal." };
    }
  }
  if (input.tools !== undefined) patch.tools = input.tools;
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (Object.keys(patch).length === 0) return { ok: false, text: "Tidak ada perubahan." };

  const params = new URLSearchParams({ id: `eq.${cleanId}` });
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/connections?${params}`, {
      method: "PATCH",
      headers: { ...headers(env), Prefer: "return=representation" },
      body: JSON.stringify(patch),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    return {
      ok: false,
      text: `Ubah koneksi gagal dijangkau: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!res.ok) return { ok: false, text: `Ubah koneksi error ${res.status}.` };
  const rows = (await res.json().catch(() => [])) as Record<string, unknown>[];
  if (!rows[0]) return { ok: false, text: "Koneksi tidak ditemukan." };
  return { ok: true, text: "Koneksi diperbarui.", item: toPublic(normalizeRow(rows[0])) };
}

export async function deleteConnection(
  env: ConnectionEnv,
  id: string,
): Promise<{ ok: boolean; text: string }> {
  const cleanId = id.trim().slice(0, 60);
  if (!cleanId) return { ok: false, text: "ID koneksi kosong." };
  if (!env) return { ok: false, text: NOT_CONFIGURED };
  const params = new URLSearchParams({ id: `eq.${cleanId}` });
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/connections?${params}`, {
      method: "DELETE",
      headers: headers(env),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    return {
      ok: false,
      text: `Hapus koneksi gagal dijangkau: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!res.ok) return { ok: false, text: `Hapus koneksi error ${res.status}.` };
  return { ok: true, text: "Koneksi dihapus." };
}
