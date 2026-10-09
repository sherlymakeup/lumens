import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyAuth, getServiceClient } from "@/lib/auth-server.ts";
import {
  validateTrigger,
  computeNextRun,
  generateWebhookSecret,
  type TriggerType,
  type CronSchedule,
} from "@/lib/agent-triggers.ts";

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["cron", "webhook"]),
  schedule: z.string().optional(),
  time: z.string().optional(),
  intervalMinutes: z.number().optional(),
  prompt: z.string().min(1).max(2000),
});

function newTriggerId(): string {
  return `trg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const Route = createFileRoute("/api/triggers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await verifyAuth(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const sb = getServiceClient();
        if (!sb) return Response.json({ error: "Database belum dikonfigurasi." }, { status: 503 });

        const { data, error } = await sb
          .from("triggers")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (error) return Response.json({ error: "Gagal memuat triggers." }, { status: 500 });
        return Response.json({ triggers: data ?? [] });
      },
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
        const parsed = CreateSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Data trigger tidak valid." }, { status: 400 });
        }
        const input = parsed.data;
        const v = validateTrigger(input);
        if (!v.ok) return Response.json({ error: v.error }, { status: 400 });

        await sb.from("profiles").upsert({ id: userId }, { onConflict: "id" });

        const id = newTriggerId();
        const now = new Date();
        const nextRun =
          input.type === "cron"
            ? computeNextRun(
                {
                  schedule: input.schedule as CronSchedule,
                  time: input.time,
                  intervalMinutes: input.intervalMinutes,
                },
                now,
              ).toISOString()
            : null;

        const { error } = await sb.from("triggers").insert({
          id,
          user_id: userId,
          name: input.name.trim(),
          type: input.type as TriggerType,
          schedule: input.type === "cron" ? input.schedule : null,
          time: input.time ?? null,
          interval_minutes: input.intervalMinutes ?? null,
          prompt: input.prompt.trim(),
          enabled: true,
          next_run: nextRun,
          webhook_secret: input.type === "webhook" ? generateWebhookSecret() : null,
        });
        if (error) return Response.json({ error: "Gagal menyimpan trigger." }, { status: 500 });
        return Response.json({ ok: true, id });
      },
      PATCH: async ({ request }) => {
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
        const { id, enabled } = (body as { id?: string; enabled?: boolean }) ?? {};
        if (!id || typeof enabled !== "boolean") {
          return Response.json({ error: "ID dan enabled diperlukan." }, { status: 400 });
        }
        const { error } = await sb
          .from("triggers")
          .update({ enabled })
          .eq("id", id)
          .eq("user_id", userId);
        if (error) return Response.json({ error: "Gagal update." }, { status: 500 });
        return Response.json({ ok: true });
      },
      DELETE: async ({ request }) => {
        const userId = await verifyAuth(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const sb = getServiceClient();
        if (!sb) return Response.json({ error: "Database belum dikonfigurasi." }, { status: 503 });

        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return Response.json({ error: "ID diperlukan." }, { status: 400 });
        const { error } = await sb
          .from("triggers")
          .delete()
          .eq("id", id)
          .eq("user_id", userId);
        if (error) return Response.json({ error: "Gagal menghapus." }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
