import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useStudio } from "@/lib/store";
import type { Conversation } from "@/lib/types";

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

    if (loadedRef.current === user.id) return;
    loadedRef.current = user.id;

    // 2. Supabase — source of truth.
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch("/api/conversations", {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return;
        const { conversations } = (await res.json()) as { conversations: any[] };
        if (!Array.isArray(conversations)) return;
        // JANGAN timpa dengan kosong jika cache punya data (hindari history hilang).
        if (conversations.length === 0) {
          const current = useStudio.getState().conversations;
          if (current.length > 0) return;
        }
        const mapped: Conversation[] = conversations.map((c) => ({
          id: c.id,
          title: c.title ?? "Untitled",
          messages: Array.isArray(c.messages) ? c.messages : [],
          createdAt: new Date(c.created_at).getTime(),
          updatedAt: new Date(c.updated_at).getTime(),
          projectId: c.project_id ?? null,
          sandboxId: c.sandbox_id ?? undefined,
        }));
        useStudio.setState((s) => ({
          conversations: mapped,
          activeId: s.activeId ?? mapped[0]?.id ?? null,
        }));
        prevConvsRef.current = mapped;
        // Update cache.
        try {
          localStorage.setItem(`${CACHE_KEY}:${user.id}`, JSON.stringify(mapped));
        } catch {
          /* quota penuh — abaikan */
        }
      } catch {
        /* offline — pakai cache yang sudah dimuat */
      }
    })();
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

  // Save segera saat page mau ditutup/refresh — cegah data hilang.
  useEffect(() => {
    if (!configured || !user) return;
    const handler = () => {
      if (dirtyIds.current.size === 0) return;
      const token = getToken();
      // beforeunload: pakai sendBeacon agar tidak dibatalkan browser.
      void token.then((t) => {
        if (!t || dirtyIds.current.size === 0) return;
        const state = useStudio.getState();
        const ids = new Set(dirtyIds.current);
        dirtyIds.current.clear();
        for (const conv of state.conversations) {
          if (!ids.has(conv.id)) continue;
          const body = JSON.stringify(serializeConv(conv));
          // sendBeacon untuk POST dengan auth header tidak bisa — pakai fetch keepalive.
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
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [user, configured, getToken]);
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
