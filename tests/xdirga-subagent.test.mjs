// XDIRGA TOOLS — TDD: subagent paralel (fresh sandbox + child thread).
// Run: node --test tests/xdirga-subagent.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SUBAGENT_MAX_ITERATIONS,
  SUBAGENT_TOOLS,
  runSubagent,
} from "../src/lib/agent-subagent.ts";

function mockSandbox() {
  const runs = [];
  return {
    sandbox: {
      sandboxId: "sb_child_1",
      runs,
      async run(cmd, timeoutMs) {
        runs.push({ cmd, timeoutMs });
        return { stdout: `out:${cmd}`, stderr: "", exitCode: 0 };
      },
      killed: false,
      async kill() {
        this.killed = true;
      },
    },
    runs,
  };
}

const noTools = async () => ({ content: "Hasil akhir ringkas.", toolCalls: [] });

test("SUBAGENT_TOOLS tidak memuat spawn_subagent (depth 1)", () => {
  const names = SUBAGENT_TOOLS.map((t) => t.function.name);
  assert.ok(names.includes("sandbox_exec"));
  assert.ok(names.includes("web_search"));
  assert.ok(!names.includes("spawn_subagent"));
});

test("runSubagent: task sederhana → summary, sandbox di-kill, thread terdaftar", async () => {
  const { sandbox } = mockSandbox();
  const registered = [];
  const workdirs = [];
  const r = await runSubagent({
    task: "Hitung 2+2",
    parentThreadId: "thr_parent00000001",
    modelFn: noTools,
    createSandbox: async (workdir) => {
      workdirs.push(workdir);
      return sandbox;
    },
    registerThread: async (input) => {
      registered.push(input);
    },
  });
  assert.equal(r.ok, true);
  assert.match(r.summary, /Hasil akhir/);
  assert.match(r.childThreadId, /^thr_[0-9a-f]{16}$/);
  assert.equal(sandbox.killed, true);
  assert.equal(registered.length, 1);
  assert.equal(registered[0].parent_id, "thr_parent00000001");
  assert.equal(registered[0].id, r.childThreadId);
  assert.equal(registered[0].sandbox_id, "sb_child_1");
  // workdir sesuai child thread
  assert.equal(workdirs[0], `$HOME/workspace/${r.childThreadId}`);
});

test("runSubagent: eksekusi sandbox_exec lalu simpulkan", async () => {
  const { sandbox, runs } = mockSandbox();
  let calls = 0;
  const modelFn = async () => {
    calls++;
    if (calls === 1) {
      return {
        content: "",
        toolCalls: [{ id: "c1", name: "sandbox_exec", args: JSON.stringify({ command: "echo hi" }) }],
      };
    }
    return { content: "Selesai: hi", toolCalls: [] };
  };
  const r = await runSubagent({
    task: "Jalankan echo hi",
    parentThreadId: "thr_parent00000001",
    modelFn,
    createSandbox: async () => sandbox,
  });
  assert.equal(r.ok, true);
  assert.match(r.summary, /Selesai/);
  assert.equal(runs.length, 1);
  assert.match(runs[0].cmd, /echo hi/);
  assert.equal(sandbox.killed, true);
});

test("runSubagent: model coba spawn_subagent → ditolak (unknown tool)", async () => {
  const { sandbox } = mockSandbox();
  let calls = 0;
  const modelFn = async () => {
    calls++;
    if (calls === 1) {
      return {
        content: "",
        toolCalls: [{ id: "c1", name: "spawn_subagent", args: JSON.stringify({ task: "nakal" }) }],
      };
    }
    return { content: "OK tanpa spawn", toolCalls: [] };
  };
  const r = await runSubagent({
    task: "coba spawn",
    parentThreadId: "thr_parent00000001",
    modelFn,
    createSandbox: async () => sandbox,
  });
  assert.equal(r.ok, true);
  assert.match(r.summary, /OK tanpa spawn/);
  // tidak ada sandbox baru dibuat — hanya 1 sandbox dari factory
  assert.equal(sandbox.killed, true);
});

test("runSubagent: berhenti di maxIterations", async () => {
  const { sandbox } = mockSandbox();
  let calls = 0;
  const modelFn = async () => {
    calls++;
    return {
      content: `iterasi ${calls}`,
      toolCalls: [{ id: `c${calls}`, name: "sandbox_exec", args: JSON.stringify({ command: "true" }) }],
    };
  };
  const r = await runSubagent({
    task: "loop selamanya",
    parentThreadId: "thr_parent00000001",
    modelFn,
    createSandbox: async () => sandbox,
    maxIterations: 3,
  });
  assert.equal(calls, 3);
  assert.match(r.summary, /batas 3 iterasi/);
  assert.equal(sandbox.killed, true);
});

test("runSubagent: error model → ok:false, sandbox tetap di-kill", async () => {
  const { sandbox } = mockSandbox();
  const r = await runSubagent({
    task: "gagal",
    parentThreadId: "thr_parent00000001",
    modelFn: async () => {
      throw new Error("gateway down");
    },
    createSandbox: async () => sandbox,
  });
  assert.equal(r.ok, false);
  assert.match(r.summary, /gateway down/);
  assert.equal(sandbox.killed, true);
});

test("runSubagent: signal abort menghentikan loop", async () => {
  const { sandbox } = mockSandbox();
  const ctl = new AbortController();
  let calls = 0;
  const modelFn = async () => {
    calls++;
    if (calls === 2) ctl.abort();
    return {
      content: "",
      toolCalls: [{ id: `c${calls}`, name: "sandbox_exec", args: JSON.stringify({ command: "true" }) }],
    };
  };
  const r = await runSubagent({
    task: "abort",
    parentThreadId: "thr_parent00000001",
    modelFn,
    createSandbox: async () => sandbox,
    signal: ctl.signal,
  });
  assert.ok(calls <= 2);
  assert.equal(sandbox.killed, true);
  assert.equal(r.ok, true);
});
