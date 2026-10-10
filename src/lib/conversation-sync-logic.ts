/** Logika pure untuk sinkronisasi conversations (tanpa React/DOM).
 *  Dipisah agar bisa diuji dengan node --test (lihat tests/conversations-sync.test.mjs).
 *  Dipakai oleh src/lib/conversations-sync.ts. */

/** Bentuk minimal conversation yang dipakai logika sync (structural). */
export type SyncConversation = {
  id: string;
  title: string;
  messages: unknown[];
  createdAt: number;
  updatedAt: number;
  projectId: string | null;
  sandboxId?: string;
};

export type ServerLoadResult =
  | { ok: true; conversations: SyncConversation[] }
  | { ok: false };

/** C1: Gabungkan hasil server dengan state lokal TANPA menimpa unsaved work.
 *  - Conversation yang dirty (ada di dirtyIds) selalu menang versi lokalnya.
 *  - Conversation lokal yang tidak ada di server HANYA dipertahankan jika dirty
 *    (unsaved work). Yang non-dirty berarti server 200 authoritative
 *    (mis. dihapus di device lain) → dibuang.
 *  - Selain itu versi server menang.
 *  Hasil diurutkan updatedAt desc (konsisten dengan API). */
export function mergeServerConversations(
  server: SyncConversation[],
  local: SyncConversation[],
  dirtyIds: Set<string>,
): SyncConversation[] {
  const serverIds = new Set(server.map((c) => c.id));
  const localById = new Map(local.map((c) => [c.id, c]));
  const result: SyncConversation[] = [];
  for (const s of server) {
    const l = localById.get(s.id);
    result.push(l && dirtyIds.has(l.id) ? l : s);
  }
  for (const l of local) {
    if (!serverIds.has(l.id) && dirtyIds.has(l.id)) result.push(l);
  }
  return result.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** H1: Retry dengan backoff linear untuk kegagalan transient.
 *  isRetryable(err) mengembalikan false untuk error yang tidak perlu di-retry
 *  (mis. 401/403). */
export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500,
  isRetryable: (err: unknown) => boolean = () => true,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt >= maxAttempts) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
    }
  }
  throw lastError;
}

/** M6: Validasi activeId — fallback ke conversation pertama jika dangling. */
export function resolveActiveId(
  prevActiveId: string | null,
  conversations: SyncConversation[],
): string | null {
  if (prevActiveId && conversations.some((c) => c.id === prevActiveId)) {
    return prevActiveId;
  }
  return conversations[0]?.id ?? null;
}

/** C1+H2+M6: Terapkan hasil load server ke state lokal.
 *  - Fetch gagal (ok:false) → null = pertahankan cache lokal (H2).
 *  - Fetch sukses → merge (C1), validasi activeId (M6). Server 200 dengan
 *    array kosong adalah kebenaran → store dikosongkan (H2). */
export function applyServerLoad(
  result: ServerLoadResult,
  local: SyncConversation[],
  dirtyIds: Set<string>,
  prevActiveId: string | null,
): { conversations: SyncConversation[]; activeId: string | null } | null {
  if (!result.ok) return null;
  const merged = mergeServerConversations(result.conversations, local, dirtyIds);
  return { conversations: merged, activeId: resolveActiveId(prevActiveId, merged) };
}
