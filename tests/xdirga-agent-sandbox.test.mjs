// XDIRGA TOOLS — TDD: resilient sandbox session (auto-recreate + retry).
// Run: node --test tests/xdirga-agent-sandbox.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { SandboxSession } from "../src/lib/agent-sandbox.ts";

function fakeSandbox(id, behavior = {}) {
  return {
    sandboxId: id,
    setTimeoutCalls: [],
    async setTimeout(ms) {
      this.setTimeoutCalls.push(ms);
    },
    commands: {
      async run(cmd, opts) {
        if (behavior.failWith) throw new Error(behavior.failWith);
        return { stdout: `out:${cmd}`, stderr: "", exitCode: 0, timeoutMs: opts.timeoutMs };
      },
    },
  };
}

function fakeClient(sandboxes, { connectFails = false } = {}) {
  let created = 0;
  const client = {
    created: 0,
    sandbox: {
      async connect(id) {
        if (connectFails) throw new Error("sandbox gone");
        const sb = sandboxes[id];
        if (!sb) throw new Error("not found");
        return sb;
      },
      async create() {
        created += 1;
        client.created = created;
        const sb = fakeSandbox(`new-${created}`);
        sandboxes[sb.sandboxId] = sb;
        return sb;
      },
    },
  };
  return client;
}

test("creates a new sandbox when no id is given", async () => {
  const boxes = {};
  const client = fakeClient(boxes);
  const s = new SandboxSession(client, "tmpl");
  const { sb, note } = await s.ensure();
  assert.equal(sb.sandboxId, "new-1");
  assert.match(note, /baru/i);
  assert.deepEqual(sb.setTimeoutCalls, [300_000]);
});

test("reconnects with the saved id", async () => {
  const boxes = { abc: fakeSandbox("abc") };
  const client = fakeClient(boxes);
  const s = new SandboxSession(client, "tmpl", Date.now, "abc");
  const { sb } = await s.ensure();
  assert.equal(sb.sandboxId, "abc");
  assert.equal(client.created, 0);
});

test("falls back to create when connect fails", async () => {
  const boxes = {};
  const client = fakeClient(boxes, { connectFails: true });
  const s = new SandboxSession(client, "tmpl", Date.now, "dead-id");
  const { sb, note } = await s.ensure();
  assert.equal(sb.sandboxId, "new-1");
  assert.match(note, /baru/i);
});

test("proactively recreates before the 1h Novita limit", async () => {
  const boxes = { abc: fakeSandbox("abc") };
  const client = fakeClient(boxes);
  let now = 1_000_000;
  const s = new SandboxSession(client, "tmpl", () => now, "abc");
  await s.ensure(); // age 0
  now += 51 * 60_000; // 51 minutes later
  const { sb, note } = await s.ensure();
  assert.equal(sb.sandboxId, "new-1");
  assert.match(note, /diperbarui otomatis/i);
});

test("run() retries once when the sandbox died mid-command", async () => {
  const dying = fakeSandbox("old", { failWith: "sandbox expired" });
  const boxes = { old: dying };
  const client = fakeClient(boxes);
  const s = new SandboxSession(client, "tmpl", Date.now, "old");
  const r = await s.run("echo hi", 60_000);
  assert.equal(r.stdout, "out:echo hi");
  assert.match(r.note, /diperbarui otomatis/i);
  // old handle dropped: a second run uses the fresh sandbox directly
  const r2 = await s.run("echo again", 60_000);
  assert.equal(r2.stdout, "out:echo again");
  assert.equal(r2.note, "");
});

test("run() gives up after the retry also fails", async () => {
  const boxes = {};
  const client = {
    sandbox: {
      async connect() {
        throw new Error("gone");
      },
      async create() {
        return fakeSandbox("x", { failWith: "sandbox expired" });
      },
    },
  };
  const s = new SandboxSession(client, "tmpl");
  await assert.rejects(() => s.run("echo hi", 60_000), /sandbox expired/);
});

test("run() does not retry ordinary command failures", async () => {
  const boxes = {};
  const client = fakeClient(boxes);
  // fake run that resolves with exitCode 1 (not a throw)
  const sb = fakeSandbox("ok");
  sb.commands.run = async () => ({ stdout: "", stderr: "bad", exitCode: 1 });
  boxes.ok = sb;
  const s = new SandboxSession(client, "tmpl", Date.now, "ok");
  const r = await s.run("false", 60_000);
  assert.equal(r.exitCode, 1);
  assert.equal(client.created, 0); // no recreate
});

test("workdir: run() wraps command dengan cd", async () => {
  const boxes = {};
  const client = fakeClient(boxes);
  const s = new SandboxSession(client, "tmpl", Date.now, undefined, "/workspace/thr_abc123");
  const r = await s.run("pwd", 5000);
  assert.match(r.stdout, /^out:cd '\/workspace\/thr_abc123' && pwd$/);
});

test("workdir: mkdir -p dijalankan sekali per sandbox", async () => {
  const seen = [];
  const sb = fakeSandbox("w1");
  const origRun = sb.commands.run;
  sb.commands.run = async (cmd, opts) => {
    seen.push(cmd);
    return origRun(cmd, opts);
  };
  const boxes = { w1: sb };
  const client = fakeClient(boxes);
  const s = new SandboxSession(client, "tmpl", Date.now, "w1", "/workspace/thr_abc123");
  await s.run("echo a", 5000);
  await s.run("echo b", 5000);
  const mkdirs = seen.filter((c) => c.startsWith("mkdir -p"));
  assert.equal(mkdirs.length, 1);
  assert.match(mkdirs[0], /\/workspace\/thr_abc123/);
});

test("tanpa workdir: command tidak di-wrap", async () => {
  const boxes = {};
  const client = fakeClient(boxes);
  const s = new SandboxSession(client, "tmpl");
  const r = await s.run("pwd", 5000);
  assert.equal(r.stdout, "out:pwd");
});
