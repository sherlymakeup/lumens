// Agent long-term memory backed by Supabase PostgREST.
// Server-side only: uses the service_role key, never exposed to the client.
// All functions degrade gracefully when env is missing.

export type MemoryEnv = { url: string; key: string } | undefined;

export type MemoryItem = { id: string; content: string; updated_at: string };

export type MemorySearchOutcome = {
  ok: boolean;
  text: string;
  memories: MemoryItem[];
};

function headers(env: { url: string; key: string }) {
  return {
    apikey: env.key,
    Authorization: `Bearer ${env.key}`,
    "Content-Type": "application/json",
  };
}

const NOT_CONFIGURED =
  "Memory belum dikonfigurasi: tambahkan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di environment server.";

export async function searchMemories(
  query: string,
  env: MemoryEnv,
  limit = 5,
): Promise<MemorySearchOutcome> {
  const q = query.trim().slice(0, 300);
  if (!q) return { ok: false, text: "Query pencarian memory kosong.", memories: [] };
  if (!env) return { ok: false, text: NOT_CONFIGURED, memories: [] };
  const params = new URLSearchParams({
    select: "id,content,updated_at",
    content: `ilike.*${q}*`,
    order: "updated_at.desc",
    limit: String(Math.min(Math.max(limit, 1), 10)),
  });
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/memories?${params}`, {
      headers: headers(env),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    return {
      ok: false,
      text: `Memory search gagal dijangkau: ${error instanceof Error ? error.message : String(error)}`,
      memories: [],
    };
  }
  if (!res.ok) return { ok: false, text: `Memory search error ${res.status}.`, memories: [] };
  const items = (await res.json().catch(() => [])) as MemoryItem[];
  if (!items.length) {
    return { ok: true, text: "Tidak ada ingatan yang cocok.", memories: [] };
  }
  const lines = items.map((m) => `- [${m.id}] ${m.content}`);
  return { ok: true, text: `Ingatan yang relevan:\n${lines.join("\n")}`, memories: items };
}

export async function saveMemory(
  content: string,
  env: MemoryEnv,
): Promise<{ ok: boolean; text: string; id?: string }> {
  const c = content.trim().slice(0, 2000);
  if (!c) return { ok: false, text: "Isi ingatan kosong." };
  if (!env) return { ok: false, text: NOT_CONFIGURED };
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/memories`, {
      method: "POST",
      headers: { ...headers(env), Prefer: "return=representation" },
      body: JSON.stringify({ content: c }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    return {
      ok: false,
      text: `Memory save gagal dijangkau: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!res.ok) return { ok: false, text: `Memory save error ${res.status}.` };
  const items = (await res.json().catch(() => [])) as { id?: string }[];
  const id = items[0]?.id;
  return { ok: true, text: id ? `Ingatan tersimpan (id: ${id}).` : "Ingatan tersimpan.", id };
}

export async function deleteMemory(
  id: string,
  env: MemoryEnv,
): Promise<{ ok: boolean; text: string }> {
  const cleanId = id.trim().slice(0, 60);
  if (!cleanId) return { ok: false, text: "ID ingatan kosong." };
  if (!env) return { ok: false, text: NOT_CONFIGURED };
  const params = new URLSearchParams({ id: `eq.${cleanId}` });
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/memories?${params}`, {
      method: "DELETE",
      headers: headers(env),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    return {
      ok: false,
      text: `Memory delete gagal dijangkau: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!res.ok) return { ok: false, text: `Memory delete error ${res.status}.` };
  return { ok: true, text: `Ingatan ${cleanId} dihapus.` };
}

export function memoryEnv(): MemoryEnv {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return undefined;
  return { url: url.replace(/\/$/, ""), key };
}
