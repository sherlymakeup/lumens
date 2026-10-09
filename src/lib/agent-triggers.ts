// P3: Trigger/Cron System — adopsi dari Tasklet Trigger System.
// Mendukung: cron terjadwal (hourly/daily/interval) dan webhook.

export type TriggerType = "cron" | "webhook";
export type CronSchedule = "hourly" | "daily" | "interval";

export type Trigger = {
  id: string;
  user_id: string;
  name: string;
  type: TriggerType;
  schedule?: CronSchedule;
  /** Untuk daily: "HH:MM" (UTC). Untuk interval: menit. */
  time?: string;
  intervalMinutes?: number;
  prompt: string;
  enabled: boolean;
  last_run?: string | null;
  next_run?: string | null;
  webhook_secret?: string | null;
  created_at: string;
};

export type TriggerInput = {
  name: string;
  type: TriggerType;
  schedule?: string;
  time?: string;
  intervalMinutes?: number;
  prompt: string;
};

const VALID_SCHEDULES: CronSchedule[] = ["hourly", "daily", "interval"];

/** Validasi input trigger. Return {ok, error?}. */
export function validateTrigger(input: TriggerInput): { ok: boolean; error?: string } {
  if (!input.name.trim()) return { ok: false, error: "Nama trigger diperlukan." };
  if (!input.prompt.trim()) return { ok: false, error: "Prompt trigger diperlukan." };
  if (input.type === "cron") {
    if (!input.schedule || !VALID_SCHEDULES.includes(input.schedule as CronSchedule)) {
      return { ok: false, error: "Schedule tidak valid (hourly/daily/interval)." };
    }
    if (input.schedule === "daily") {
      if (!input.time || !/^\d{2}:\d{2}$/.test(input.time)) {
        return { ok: false, error: "Untuk daily, time harus format HH:MM." };
      }
    }
    if (input.schedule === "interval") {
      const n = Number(input.intervalMinutes);
      if (!Number.isInteger(n) || n < 5 || n > 1440) {
        return { ok: false, error: "Interval harus 5–1440 menit." };
      }
    }
  }
  return { ok: true };
}

/** Hitung next_run berdasarkan schedule. */
export function computeNextRun(trigger: Pick<Trigger, "schedule" | "time" | "intervalMinutes">, now: Date = new Date()): Date {
  const schedule = trigger.schedule;
  if (schedule === "hourly") {
    return new Date(now.getTime() + 60 * 60 * 1000);
  }
  if (schedule === "interval") {
    const mins = Math.max(5, Math.min(1440, trigger.intervalMinutes ?? 60));
    return new Date(now.getTime() + mins * 60 * 1000);
  }
  // daily: jam tertentu (UTC).
  const [h, m] = (trigger.time ?? "09:00").split(":").map(Number);
  const next = new Date(now);
  next.setUTCHours(h, m, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

/** Apakah trigger sudah waktunya dijalankan? */
export function isTriggerDue(trigger: Pick<Trigger, "enabled" | "next_run">, now: Date = new Date()): boolean {
  if (!trigger.enabled) return false;
  if (!trigger.next_run) return false;
  return new Date(trigger.next_run).getTime() <= now.getTime();
}

/** Generate webhook secret acak. */
export function generateWebhookSecret(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  for (const b of arr) s += chars[b % chars.length];
  return s;
}
