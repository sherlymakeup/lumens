// Tests untuk P3: Trigger/Cron System (adopsi Tasklet Trigger System).
import { describe, it, expect } from "vitest";
import {
  computeNextRun,
  isTriggerDue,
  validateTrigger,
  type Trigger,
} from "../src/lib/agent-triggers.ts";

describe("validateTrigger", () => {
  it("menerima cron trigger yang valid", () => {
    const r = validateTrigger({
      name: "Laporan harian",
      type: "cron",
      schedule: "daily",
      time: "09:00",
      prompt: "Buatkan ringkasan",
    });
    expect(r.ok).toBe(true);
  });

  it("menolak jika nama kosong", () => {
    const r = validateTrigger({
      name: "",
      type: "cron",
      schedule: "daily",
      time: "09:00",
      prompt: "x",
    });
    expect(r.ok).toBe(false);
  });

  it("menolak jika prompt kosong", () => {
    const r = validateTrigger({
      name: "Test",
      type: "cron",
      schedule: "hourly",
      prompt: "",
    });
    expect(r.ok).toBe(false);
  });

  it("menolak schedule yang tidak dikenal", () => {
    const r = validateTrigger({
      name: "Test",
      type: "cron",
      schedule: "mingguan",
      prompt: "x",
    });
    expect(r.ok).toBe(false);
  });

  it("menerima webhook trigger", () => {
    const r = validateTrigger({
      name: "Webhook test",
      type: "webhook",
      prompt: "Proses data webhook",
    });
    expect(r.ok).toBe(true);
  });
});

describe("computeNextRun", () => {
  it("hourly: next run 1 jam dari sekarang", () => {
    const now = new Date("2026-10-10T10:30:00Z");
    const next = computeNextRun({ schedule: "hourly" } as Trigger, now);
    expect(next.getTime()).toBe(new Date("2026-10-10T11:30:00Z").getTime());
  });

  it("daily: next run besok jam yang ditentukan", () => {
    const now = new Date("2026-10-10T10:30:00Z");
    const next = computeNextRun({ schedule: "daily", time: "09:00" } as Trigger, now);
    // Sudah lewat jam 9 hari ini, jadi besok jam 9.
    expect(next.getTime()).toBe(new Date("2026-10-11T09:00:00Z").getTime());
  });

  it("daily: jika belum lewat, hari ini", () => {
    const now = new Date("2026-10-10T08:00:00Z");
    const next = computeNextRun({ schedule: "daily", time: "09:00" } as Trigger, now);
    expect(next.getTime()).toBe(new Date("2026-10-10T09:00:00Z").getTime());
  });

  it("every-N-minutes: interval kustom", () => {
    const now = new Date("2026-10-10T10:30:00Z");
    const next = computeNextRun(
      { schedule: "interval", intervalMinutes: 30 } as Trigger,
      now,
    );
    expect(next.getTime()).toBe(new Date("2026-10-10T11:00:00Z").getTime());
  });
});

describe("isTriggerDue", () => {
  it("true jika next_run sudah lewat dan enabled", () => {
    const trigger = {
      enabled: true,
      next_run: new Date(Date.now() - 60000).toISOString(),
    } as Trigger;
    expect(isTriggerDue(trigger, new Date())).toBe(true);
  });

  it("false jika disabled", () => {
    const trigger = {
      enabled: false,
      next_run: new Date(Date.now() - 60000).toISOString(),
    } as Trigger;
    expect(isTriggerDue(trigger, new Date())).toBe(false);
  });

  it("false jika next_run masih di masa depan", () => {
    const trigger = {
      enabled: true,
      next_run: new Date(Date.now() + 60000).toISOString(),
    } as Trigger;
    expect(isTriggerDue(trigger, new Date())).toBe(false);
  });

  it("false jika next_run null", () => {
    const trigger = { enabled: true, next_run: null } as Trigger;
    expect(isTriggerDue(trigger, new Date())).toBe(false);
  });
});
