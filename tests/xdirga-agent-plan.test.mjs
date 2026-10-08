// XDIRGA TOOLS — TDD: agent plan normalization.
// Run: node --test tests/xdirga-agent-plan.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_PLAN_STEPS, normalizePlanSteps } from "../src/lib/agent-plan.ts";

test("normalizePlanSteps keeps text + valid statuses", async () => {
  const steps = normalizePlanSteps([
    { text: "  Cari data  ", status: "in_progress" },
    { text: "Tulis laporan", status: "done" },
    { text: "Kirim file" },
  ]);
  assert.deepEqual(steps, [
    { text: "Cari data", status: "in_progress" },
    { text: "Tulis laporan", status: "done" },
    { text: "Kirim file", status: "pending" },
  ]);
});

test("normalizePlanSteps drops empty texts and fixes bad statuses", async () => {
  const steps = normalizePlanSteps([
    { text: "   ", status: "done" },
    { text: "Ok", status: "bogus" },
    null,
    "not-an-object",
  ]);
  assert.deepEqual(steps, [{ text: "Ok", status: "pending" }]);
});

test("normalizePlanSteps caps steps and text length", async () => {
  const many = Array.from({ length: MAX_PLAN_STEPS + 5 }, (_, i) => ({ text: `step ${i}` }));
  const steps = normalizePlanSteps(many);
  assert.equal(steps.length, MAX_PLAN_STEPS);
  const long = normalizePlanSteps([{ text: "x".repeat(500) }]);
  assert.ok(long[0].text.length <= 200);
});

test("normalizePlanSteps rejects non-arrays", async () => {
  assert.deepEqual(normalizePlanSteps(null), []);
  assert.deepEqual(normalizePlanSteps("plan"), []);
  assert.deepEqual(normalizePlanSteps({}), []);
});
