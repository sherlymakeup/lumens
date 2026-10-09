import { createFileRoute } from "@tanstack/react-router";
import { getServiceClient } from "@/lib/auth-server.ts";
import { isTriggerDue, computeNextRun, type Trigger } from "@/lib/agent-triggers.ts";

/**
 * Scheduler endpoint untuk P3 triggers.
 * Dipanggil oleh Vercel Cron setiap menit (atau manual).
 * Keamanan: cek CRON_SECRET jika diset, jika tidak hanya izinkan di production Vercel Cron.
 */
export const Route = createFileRoute("/api/cron")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Verifikasi: Vercel Cron mengirim header khusus, atau CRON_SECRET cocok.
        const cronSecret = process.env.CRON_SECRET?.trim();
        const authHeader = request.headers.get("authorization");
        const vercelCron = request.headers.get("x-vercel-cron");
        if (cronSecret) {
          if (authHeader !== `Bearer ${cronSecret}`) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
        } else if (!vercelCron && process.env.VERCEL === "1") {
          // Di Vercel tanpa CRON_SECRET, hanya terima dari Vercel Cron.
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const sb = getServiceClient();
        if (!sb) return Response.json({ error: "Database belum dikonfigurasi." }, { status: 503 });

        const now = new Date();
        const { data: triggers, error } = await sb
          .from("triggers")
          .select("*")
          .eq("type", "cron")
          .eq("enabled", true)
          .lte("next_run", now.toISOString())
          .limit(10);

        if (error) return Response.json({ error: "Gagal query triggers." }, { status: 500 });

        const executed: string[] = [];
        for (const t of (triggers ?? []) as Trigger[]) {
          if (!isTriggerDue(t, now)) continue;
          try {
            // Buat conversation dari trigger prompt agar user bisa lihat/jalankan.
            // Eksekusi otomatis penuh adalah enhancement berikutnya.
            const convId = `trg_${t.id}_${Date.now().toString(36)}`;
            await sb.from("conversations").insert({
              id: convId,
              user_id: t.user_id,
              title: `⏰ ${t.name}`,
              messages: [
                {
                  id: `msg_${Date.now()}`,
                  role: "user",
                  content: t.prompt,
                  createdAt: Date.now(),
                },
              ],
            });
            // Update last_run dan hitung next_run.
            const nextRun = computeNextRun(
              { schedule: t.schedule, time: t.time, intervalMinutes: t.intervalMinutes },
              now,
            );
            await sb
              .from("triggers")
              .update({
                last_run: now.toISOString(),
                next_run: nextRun.toISOString(),
              })
              .eq("id", t.id);
            executed.push(t.id);
          } catch {
            /* lanjut ke trigger berikutnya */
          }
        }

        return Response.json({ ok: true, executed, count: executed.length });
      },
    },
  },
});
