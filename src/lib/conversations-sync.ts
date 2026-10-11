import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useStudio } from "@/lib/store";
import type { Conversation } from "@/lib/types";
import {
  applyServerLoad,
  fetchWithRetry,
  type SyncConversation,
} from "@/lib/conversation-sync-logic";

const CACHE_KEY = "xdirga-conv-cache-v1";
const SAVE_DEBOUNCE_MS = 2000;
const FETCH_TIMEOUT_MS = 15000;

/** Sinkronisasi conversations antara zustand store dan Supabase (per-user).
 *  Supabase = source of truth. localStorage = cache fallback agar history
 *  tidak hilang saat network gagal / deploy / refresh mendadak. */
export function useConversationsSync() {
  const { user, getToken, configured } = useAuth();
  const loadedRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyIds = useRef<Set<string>>(new Set());
  const prevConvsRef = useRef<Conversation[]>([]);

  // Load cache lokal duluan (instan), lalu Supabase (source of truth).
  useEffect(() => {
    if (!configured || !user) {
      loadedRef.current = null;
      // Mode lokal single-user (tanpa Supabase): tidak ada sync server,
      // tandai selesai langsung agar deep-link /thread/:id tidak terpental.
      useStudio.getState().setSyncLoaded();
      return;
    }
    // 1. Cache lokal — tampilkan langsung biar tidak kosong.
    try {
      const cached = localStorage.getItem(`${CACHE_KEY}:${user.id}`);
      if (cached) {
        const parsed = JSON.parse(cached) as Conversation[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          useStudio.setState((s) => ({
            conversations: parsed,
            activeId: s.activeId ?? parsed[0]?.id ?? null,
          }));
          prevConvsRef.current = parsed;
        }
      }
    } catch {
      /* cache corrupt — abaikan */
    }

    if (loadedRef.current === user.id) {
      // Sudah pernah load di sesi ini — tandai selesai langsung.
      useStudio.getState().setSyncLoaded();
      return;
    }
    // H1: loadedRef HANYA dikunci SETELAH fetch berhasil — kegagalan transient
    // tidak mengunci state; retry 3x dengan backoff di dalam.

    // 2. Supabase — source of truth.
    (async () => {
      try {
        const result = await loadFromServer(getToken);
        if (!result.ok) return; // H2: fetch gagal → pertahankan cache lokal.
        // C1: merge — jangan overwrite buta; unsaved work lokal dipertahankan.
        // M6: activeId divalidasi terhadap hasil merge.
        const state = useStudio.getState();
        const applied = applyServerLoad(
          result,
          state.conversations as SyncConversation[],
          dirtyIds.current,
          state.activeId,
        );
        if (!applied) return;
        useStudio.setState({
          conversations: applied.conversations as Conversation[],
          activeId: applied.activeId,
        });
        prevConvsRef.current = applied.conversations as Conversation[];
        loadedRef.current = user.id; // H1: kunci setelah sukses.
        // Update cache.
        try {
          localStorage.setItem(
            `${CACHE_KEY}:${user.id}`,
            JSON.stringify(applied.conversations),
          );
        } catch {
          /* quota penuh — abaikan */
        }
      } finally {
        // Tandai sync selesai (sukses maupun gagal) agar route tidak
        // redirect prematur sebelum data sempat dimuat.
        useStudio.getState().setSyncLoaded();
      }
    })();
  }, [user, configured, getToken]);

  // M4: Cross-tab — jika cache berubah dari tab lain, reload dari server.
  // Guard signature + throttle mencegah ping-pong antar tab.
  useEffect(() => {
    if (!configured || !user) return;
    const key = `${CACHE_KEY}:${user.id}`;
    const sig = (convs: Conversation[]) =>
      convs.map((c) => `${c.id}:${c.updatedAt}`).join("|");
    let busy = false;
    let lastReload = 0;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || busy) return;
      if (Date.now() - lastReload < 3000) return;
      let incoming: Conversation[];
      try {
        incoming = JSON.parse(e.newValue ?? "[]") as Conversation[];
        if (!Array.isArray(incoming)) return;
      } catch {
        return;
      }
      // Sudah sinkron → abaikan.
      if (sig(incoming) === sig(useStudio.getState().conversations)) return;
      busy = true;
      lastReload = Date.now();
      (async () => {
        try {
          const result = await loadFromServer(getToken);
          if (result.ok) {
            const state = useStudio.getState();
            const applied = applyServerLoad(
              result,
              state.conversations as SyncConversation[],
              dirtyIds.current,
              state.activeId,
            );
            if (applied) {
              useStudio.setState({
                conversations: applied.conversations as Conversation[],
                activeId: applied.activeId,
              });
              prevConvsRef.current = applied.conversations as Conversation[];
            }
          }
        } finally {
          busy = false;
        }
      })();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [user, configured, getToken]);

  // Track conversation mana yang berubah (untuk save selektif).
  // Cache lokal diupdate di dalam save debounced, BUKAN tiap render —
  // JSON.stringify tiap token saat streaming bikin UI hang.
  const conversations = useStudio((s) => s.conversations);
  const cacheTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const prev = prevConvsRef.current;
    const prevMap = new Map(prev.map((c) => [c.id, c.updatedAt]));
    for (const c of conversations) {
      if (prevMap.get(c.id) !== c.updatedAt) {
        dirtyIds.current.add(c.id);
      }
    }
    prevConvsRef.current = conversations;

    // Cache lokal: debounced 5 detik agar tidak berat saat streaming.
    if (user && configured) {
      if (cacheTimer.current) clearTimeout(cacheTimer.current);
      cacheTimer.current = setTimeout(() => {
        try {
          const light = useStudio.getState().conversations.slice(0, 50).map((c) => ({
            ...c,
            messages: c.messages.map((m) => ({
              ...m,
              toolCalls: m.toolCalls?.map(({ images, files, ...rest }) => rest),
            })),
          }));
          localStorage.setItem(`${CACHE_KEY}:${user.id}`, JSON.stringify(light));
        } catch {
          /* abaikan */
        }
      }, 5000);
    }
    return () => {
      if (cacheTimer.current) clearTimeout(cacheTimer.current);
    };
  }, [conversations, user, configured]);

  // Save debounced — hanya yang berubah.
  useEffect(() => {
    if (!configured || !user || loadedRef.current !== user.id) return;
    if (dirtyIds.current.size === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveDirty(getToken, dirtyIds.current);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [conversations, user, configured, getToken]);

  // Save segera saat page mau ditutup/refresh/hide — cegah data hilang.
  // beforeunload tidak reliable di mobile; visibilitychange + pagehide menutup celahnya.
  useEffect(() => {
    if (!configured || !user) return;
    const saveCacheSync = () => {
      // localStorage write sinkron — selesai sebelum page di-discard.
      try {
        const light = useStudio.getState().conversations.slice(0, 50).map((c) => ({
          ...c,
          messages: c.messages.map((m) => ({
            ...m,
            toolCalls: m.toolCalls?.map(({ images, files, ...rest }) => rest),
          })),
        }));
        localStorage.setItem(`${CACHE_KEY}:${user.id}`, JSON.stringify(light));
      } catch {
        /* abaikan */
      }
    };
    const saveServerBeacon = () => {
      if (dirtyIds.current.size === 0) return;
      const token = getToken();
      void token.then((t) => {
        if (!t || dirtyIds.current.size === 0) return;
        const state = useStudio.getState();
        const ids = new Set(dirtyIds.current);
        dirtyIds.current.clear();
        for (const conv of state.conversations) {
          if (!ids.has(conv.id)) continue;
          const body = JSON.stringify(serializeConv(conv));
          void fetch("/api/conversations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${t}`,
            },
            body,
            keepalive: true,
          }).catch(() => {});
        }
      });
    };
    const onHide = () => {
      saveCacheSync();
      saveServerBeacon();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    window.addEventListener("beforeunload", onHide);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user, configured, getToken]);
}

type LoadError = Error & { retryable?: boolean };

/** H1: Ambil conversations dari server dengan retry max 3x + backoff.
 *  401/403 tidak di-retry (auth failure). Selain itu transient → retry. */
async function loadFromServer(
  getToken: () => Promise<string | null>,
): Promise<{ ok: true; conversations: SyncConversation[] } | { ok: false }> {
  try {
    return await fetchWithRetry(
      async () => {
        const token = await getToken();
        if (!token) throw Object.assign(new Error("no-token"), { retryable: true });
        let res: Response;
        try {
          res = await fetch("/api/conversations", {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });
        } catch {
          throw Object.assign(new Error("network"), { retryable: true });
        }
        if (res.status === 401 || res.status === 403) {
          throw Object.assign(new Error("auth"), { retryable: false });
        }
        if (!res.ok) {
          throw Object.assign(new Error(`http-${res.status}`), { retryable: true });
        }
        const body = (await res.json().catch(() => null)) as {
          conversations?: unknown;
        } | null;
        if (!body || !Array.isArray(body.conversations)) {
          throw Object.assign(new Error("bad-payload"), { retryable: true });
        }
        const mapped: SyncConversation[] = (body.conversations as any[]).map((c) => ({
          id: c.id,
          title: c.title ?? "Untitled",
          messages: Array.isArray(c.messages) ? c.messages : [],
          createdAt: new Date(c.created_at).getTime(),
          updatedAt: new Date(c.updated_at).getTime(),
          projectId: c.project_id ?? null,
          sandboxId: c.sandbox_id ?? undefined,
        }));
        return { ok: true as const, conversations: mapped };
      },
      3,
      500,
      (err: unknown) => (err as LoadError)?.retryable !== false,
    );
  } catch {
    return { ok: false as const };
  }
}

function serializeConv(conv: Conversation) {
  return {
    id: conv.id,
    title: conv.title,
    messages: conv.messages.map((m) => ({
      ...m,
      toolCalls: m.toolCalls?.map(({ images, files, ...rest }) => rest),
    })),
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    projectId: conv.projectId ?? null,
    sandboxId: conv.sandboxId ?? undefined,
  };
}

async function saveDirty(
  getToken: () => Promise<string | null>,
  dirtyIds: Set<string>,
): Promise<void> {
  const token = await getToken();
  if (!token || dirtyIds.size === 0) return;
  const state = useStudio.getState();
  const ids = new Set(dirtyIds);
  dirtyIds.clear();
  for (const conv of state.conversations) {
    if (!ids.has(conv.id)) continue;
    try {
      await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(serializeConv(conv)),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      // Gagal — tandai lagi agar dicoba berikutnya.
      dirtyIds.add(conv.id);
    }
  }
}

/** Hapus conversation di server (dipanggil setelah delete lokal). */
export async function deleteConversationRemote(
  getToken: () => Promise<string | null>,
  id: string,
): Promise<void> {
  const token = await getToken();
  if (!token) return;
  try {
    await fetch(`/api/conversations?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    /* abaikan */
  }
  // Hapus dari cache lokal juga.
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY)) {
        const cached = JSON.parse(localStorage.getItem(key) ?? "[]") as Conversation[];
        const filtered = cached.filter((c) => c.id !== id);
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    }
  } catch {
    /* abaikan */
  }
}
