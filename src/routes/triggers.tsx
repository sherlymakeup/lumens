import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useStrings } from "@/lib/i18n";
import { EngineShell } from "@/components/studio/engine-shell";

export const Route = createFileRoute("/triggers")({ component: TriggersPage });

type Trigger = {
  id: string;
  name: string;
  type: "cron" | "webhook";
  schedule?: string;
  time?: string;
  interval_minutes?: number;
  prompt: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
  webhook_secret?: string;
};

function TriggersPage() {
  const t = useStrings();
  const { getToken } = useAuth();
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "cron" as "cron" | "webhook",
    schedule: "daily",
    time: "09:00",
    intervalMinutes: 60,
    prompt: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/triggers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { triggers: list } = await res.json();
        setTriggers(list ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!form.name.trim() || !form.prompt.trim()) return;
    const token = await getToken();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch("/api/triggers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          schedule: form.type === "cron" ? form.schedule : undefined,
          time: form.schedule === "daily" ? form.time : undefined,
          intervalMinutes: form.schedule === "interval" ? form.intervalMinutes : undefined,
          prompt: form.prompt,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ name: "", type: "cron", schedule: "daily", time: "09:00", intervalMinutes: 60, prompt: "" });
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: string, enabled: boolean) {
    const token = await getToken();
    if (!token) return;
    await fetch("/api/triggers", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, enabled }),
    });
    load();
  }

  async function remove(id: string) {
    if (!window.confirm("Hapus trigger ini?")) return;
    const token = await getToken();
    if (!token) return;
    await fetch(`/api/triggers?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  return (
    <EngineShell kicker="Otomatisasi" title="Triggers" subtitle="Jadwal cron & webhook untuk menjalankan agent.">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl tracking-tight">Triggers</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Otomatisasi: jadwal cron & webhook untuk menjalankan agent.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            + Trigger baru
          </button>
        </div>

        {showForm && (
          <div className="mb-6 rounded-2xl border border-border bg-card p-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nama</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                placeholder="Laporan harian"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Tipe</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as "cron" | "webhook" })}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="cron">Cron (terjadwal)</option>
                  <option value="webhook">Webhook</option>
                </select>
              </div>
              {form.type === "cron" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Jadwal</label>
                  <select
                    value={form.schedule}
                    onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    <option value="hourly">Setiap jam</option>
                    <option value="daily">Harian</option>
                    <option value="interval">Interval</option>
                  </select>
                </div>
              )}
            </div>
            {form.type === "cron" && form.schedule === "daily" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Jam (UTC)</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
            )}
            {form.type === "cron" && form.schedule === "interval" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Interval (menit, 5–1440)</label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={form.intervalMinutes}
                  onChange={(e) => setForm({ ...form, intervalMinutes: Number(e.target.value) })}
                  className="w-32 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Prompt (yang dikerjakan agent)</label>
              <textarea
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                placeholder="Contoh: Cari berita teknologi terbaru dan ringkas dalam 5 poin"
              />
            </div>
            <button
              onClick={create}
              disabled={saving || !form.name.trim() || !form.prompt.trim()}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Menyimpan…" : "Simpan trigger"}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : triggers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Belum ada trigger. Buat yang pertama untuk otomatisasi agent.
          </p>
        ) : (
          <div className="space-y-3">
            {triggers.map((tr) => (
              <div key={tr.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{tr.type === "cron" ? "⏰" : "🔗"}</span>
                      <h3 className="truncate font-medium">{tr.name}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          tr.enabled
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {tr.enabled ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{tr.prompt}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {tr.type === "cron" && (
                        <>
                          <span>Jadwal: {tr.schedule}{tr.schedule === "daily" && tr.time ? ` ${tr.time} UTC` : ""}{tr.schedule === "interval" ? ` /${tr.interval_minutes}m` : ""}</span>
                          {tr.next_run && (
                            <span>Berikutnya: {new Date(tr.next_run).toLocaleString()}</span>
                          )}
                        </>
                      )}
                      {tr.type === "webhook" && tr.webhook_secret && (
                        <span className="break-all">
                          URL: /api/webhook/{tr.id} · Secret: {tr.webhook_secret.slice(0, 8)}…
                        </span>
                      )}
                      {tr.last_run && (
                        <span>Terakhir: {new Date(tr.last_run).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => toggle(tr.id, !tr.enabled)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent"
                    >
                      {tr.enabled ? "Matikan" : "Nyalakan"}
                    </button>
                    <button
                      onClick={() => remove(tr.id)}
                      className="rounded-lg border border-destructive/50 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </EngineShell>
  );
}
