import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyAuth, getServiceClient } from "@/lib/auth-server.ts";

const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  createdAt: z.number(),
  attachments: z.array(z.any()).optional(),
  toolCalls: z.array(z.any()).optional(),
  plan: z.array(z.any()).optional(),
  error: z.string().optional(),
  feedback: z.enum(["up", "down"]).optional(),
  elapsedMs: z.number().optional(),
  sandboxId: z.string().optional(),
});

const ConversationSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().max(200),
  messages: z.array(MessageSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
  projectId: z.string().nullable().optional(),
  sandboxId: z.string().optional(),
});

export const Route = createFileRoute("/api/conversations")({
  server: {
    handlers: {
      // GET: list conversations milik user.
      GET: async ({ request }) => {
        const userId = await verifyAuth(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const sb = getServiceClient();
        if (!sb) return Response.json({ error: "Database belum dikonfigurasi." }, { status: 503 });

        const { data, error } = await sb
          .from("conversations")
          .select("id, title, messages, created_at, updated_at, project_id, sandbox_id")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(100);

        if (error) return Response.json({ error: "Gagal memuat conversations." }, { status: 500 });
        return Response.json({ conversations: data ?? [] });
      },
      // POST: upsert satu conversation.
      POST: async ({ request }) => {
        const userId = await verifyAuth(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const sb = getServiceClient();
        if (!sb) return Response.json({ error: "Database belum dikonfigurasi." }, { status: 503 });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Body tidak valid." }, { status: 400 });
        }
        const parsed = ConversationSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Data conversation tidak valid." }, { status: 400 });
        }
        const c = parsed.data;

        // Pastikan profile ada (auto-create saat login pertama).
        await sb.from("profiles").upsert({ id: userId }, { onConflict: "id" });

        const { error } = await sb.from("conversations").upsert(
          {
            id: c.id,
            user_id: userId,
            title: c.title,
            messages: c.messages,
            project_id: c.projectId ?? null,
            sandbox_id: c.sandboxId ?? null,
            updated_at: new Date(c.updatedAt).toISOString(),
          },
          { onConflict: "id" },
        );
        if (error) return Response.json({ error: "Gagal menyimpan." }, { status: 500 });
        return Response.json({ ok: true });
      },
      // DELETE: hapus conversation milik user (?id=xxx).
      DELETE: async ({ request }) => {
        const userId = await verifyAuth(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const sb = getServiceClient();
        if (!sb) return Response.json({ error: "Database belum dikonfigurasi." }, { status: 503 });

        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return Response.json({ error: "ID diperlukan." }, { status: 400 });

        const { error } = await sb
          .from("conversations")
          .delete()
          .eq("id", id)
          .eq("user_id", userId);
        if (error) return Response.json({ error: "Gagal menghapus." }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
