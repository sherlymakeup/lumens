// Agent self-planning: the model writes and updates its own step list.
// Steps are small plain text — safe to persist (unlike base64 payloads).

export const MAX_PLAN_STEPS = 12;
const MAX_STEP_TEXT = 200;

export type PlanStatus = "pending" | "in_progress" | "done";
export type PlanStep = { text: string; status: PlanStatus };

const VALID_STATUSES = new Set<PlanStatus>(["pending", "in_progress", "done"]);

export function normalizePlanSteps(raw: unknown): PlanStep[] {
  if (!Array.isArray(raw)) return [];
  const steps: PlanStep[] = [];
  for (const item of raw) {
    if (steps.length >= MAX_PLAN_STEPS) break;
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const text = String(rec.text ?? "").trim().slice(0, MAX_STEP_TEXT);
    if (!text) continue;
    const status = VALID_STATUSES.has(rec.status as PlanStatus)
      ? (rec.status as PlanStatus)
      : "pending";
    steps.push({ text, status });
  }
  return steps;
}
