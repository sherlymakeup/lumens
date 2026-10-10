import { createFileRoute } from "@tanstack/react-router";
import { getServiceClient } from "@/lib/auth-server.ts";
import type { Trigger } from "@/lib/agent-triggers.ts";

/** Samarkan webhook secret untuk ditampilkan (M-2: jangan kembalikan mentah). */
export function maskWebhookSecret(secret: string | null | undefined): string | null {
  if (!secret || typeof secret !== "string") return null;
  if (secret.length <= 8) return "••••••••";
  return `${secret.slice(0, 4)}••••••••${secret.slice(-4)}`;
}

/** Webhook trigger: POST /api/webhook/$id dengan header x-webhook-secret. */
export const Route = createFileRoute("/api/webhook/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const sb = getServiceClient();
        if (!sb) return Response.json({ error: "Database belum dikonfigurasi." }, { status: 503 });

        const id = (params as { id: string }).id;
        const { data: trigger, error } = await sb
          .from("triggers")
          .select("*")
          .eq("id", id)
          .eq("type", "webhook")
          .single();

        if (error || !trigger) {
          return Response.json({ error: "Trigger tidak ditemukan." }, { status: 404 });
        }
        const t = trigger as Trigger;
        if (!t.enabled) {
          return Response.json({ error: "Trigger nonaktif." }, { status: 403 });
        }
        const secret = request.headers.get("x-webhook-secret");
        if (!t.webhook_secret || secret !== t.webhook_secret) {
          return Response.json({ error: "Secret salah." }, { status: 401 });
        }

        // Baca payload webhook (opsional, diteruskan sebagai context).
        let payloadText = "";
        try {
          const body = await request.text();
          if (body) payloadText = `\n\nWebhook payload:\n${body.slice(0, 2000)}`;
        } catch {
          /* abaikan */
        }

        // Buat conversation dari trigger.
        const convId = `wh_${t.id}_${Date.now().toString(36)}`;
        await sb.from("conversations").insert({
          id: convId,
          user_id: t.user_id,
          title: `🔗 ${t.name}`,
          messages: [
            {
              id: `msg_${Date.now()}`,
              role: "user",
              content: t.prompt + payloadText,
              createdAt: Date.now(),
            },
          ],
        });
        await sb
          .from("triggers")
          .update({ last_run: new Date().toISOString() })
          .eq("id", t.id)
          // M-11: filter user_id juga (defense in depth).
          .eq("user_id", t.user_id);

        return Response.json({ ok: true, conversationId: convId });
      },
    },
  },
});
