import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase-client";
import { useStudio } from "@/lib/store";
import type { Conversation } from "@/lib/types";

/** Sinkronisasi conversations antara zustand store dan Supabase (per-user).
 *  Supabase adalah source of truth; localStorage tidak lagi dipakai untuk conversations. */
export function useConversationsSync() {
  const { user, getToken, configured } = useAuth();
  const loadedRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saat user login / berubah.
  useEffect(() => {
    if (!configured || !user) {
      loadedRef.current = null;
      return;
    }
    if (loadedRef.current === user.id) return;
    loadedRef.current = user.id;

    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch("/api/conversations", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const { conversations } = (await res.json()) as { conversations: any[] };
        // Map dari format DB ke format store.
        const mapped: Conversation[] = (conversations ?? []).map((c) => ({
          id: c.id,
          title: c.title ?? "Untitled",
          messages: Array.isArray(c.messages) ? c.messages : [],
          createdAt: new Date(c.created_at).getTime(),
          updatedAt: new Date(c.updated_at).getTime(),
          projectId: c.project_id ?? null,
          sandboxId: c.sandbox_id ?? undefined,
        }));
        useStudio.setState({ conversations: mapped, activeId: mapped[0]?.id ?? null });
      } catch {
        /* offline — biarkan store kosong */
      }
    })();
  }, [user, configured, getToken]);

  // Save (debounced) saat conversations berubah.
  const conversations = useStudio((s) => s.conversations);
  useEffect(() => {
    if (!configured || !user || loadedRef.current !== user.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      (async () => {
        const token = await getToken();
        if (!token) return;
        const state = useStudio.getState();
        // Simpan semua (upsert per conversation). Batasi 50 terbaru.
        for (const conv of state.conversations.slice(0, 50)) {
          try {
            await fetch("/api/conversations", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                id: conv.id,
                title: conv.title,
                messages: conv.messages.map((m) => ({
                  ...m,
                  // Drop base64 files dari persist (hemat bandwidth/quota).
                  toolCalls: m.toolCalls?.map(({ images, files, ...rest }) => rest),
                })),
                createdAt: conv.createdAt,
                updatedAt: conv.updatedAt,
                projectId: conv.projectId ?? null,
                sandboxId: conv.sandboxId ?? undefined,
              }),
            });
          } catch {
            /* abaikan — coba lagi di perubahan berikutnya */
          }
        }
      })();
    }, 2000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [conversations, user, configured, getToken]);
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
    });
  } catch {
    /* abaikan */
  }
}
