// XDIRGA TOOLS Fase 3 — TDD: test koneksi model by ID.
// Run: node --experimental-strip-types tests/xdirga-phase3.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { testModelConnection } from "../src/lib/generate.ts";

function mockFetch(handler) {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = real;
  };
}

test("testModelConnection POSTs {model} to /api/models/test and returns ok", async () => {
  const restore = mockFetch(async (url, init) => {
    assert.equal(url, "/api/models-test");
    assert.equal(init?.method, "POST");
    assert.equal(init?.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(init.body), { model: "xdirgalabs" });
    return new Response(JSON.stringify({ ok: true, id: "xdirgalabs", type: "chat" }));
  });
  try {
    const result = await testModelConnection("xdirgalabs");
    assert.deepEqual(result, { ok: true, id: "xdirgalabs", type: "chat" });
  } finally {
    restore();
  }
});

test("testModelConnection throws the server error for unknown model", async () => {
  const restore = mockFetch(
    async () =>
      new Response(JSON.stringify({ error: 'Model "nope-123" tidak ditemukan di 9Router.' }), {
        status: 404,
      }),
  );
  try {
    await assert.rejects(() => testModelConnection("nope-123"), /tidak ditemukan/);
  } finally {
    restore();
  }
});

test("testModelConnection rejects empty id without hitting network", async () => {
  let called = false;
  const restore = mockFetch(async () => {
    called = true;
    return new Response("{}");
  });
  try {
    await assert.rejects(() => testModelConnection("   "), /model/i);
    assert.equal(called, false);
  } finally {
    restore();
  }
});

// ---------- runSandboxCommand ----------
test("runSandboxCommand POSTs {command} to /api/sandbox/execute", async () => {
  const { runSandboxCommand } = await import("../src/lib/generate.ts");
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/sandbox/execute");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(init.body);
    assert.equal(body.command, "node -v");
    return new Response(
      JSON.stringify({ stdout: "v22.0.0\n", stderr: "", exitCode: 0 }),
    );
  };
  try {
    const result = await runSandboxCommand("node -v");
    assert.deepEqual(result, { stdout: "v22.0.0\n", stderr: "", exitCode: 0 });
  } finally {
    globalThis.fetch = real;
  }
});

test("runSandboxCommand throws the server error message", async () => {
  const { runSandboxCommand } = await import("../src/lib/generate.ts");
  const real = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Sandbox belum dikonfigurasi." }), { status: 503 });
  try {
    await assert.rejects(() => runSandboxCommand("ls"), /belum dikonfigurasi/);
  } finally {
    globalThis.fetch = real;
  }
});

test("runSandboxCommand rejects empty command without hitting network", async () => {
  const { runSandboxCommand } = await import("../src/lib/generate.ts");
  let called = false;
  const real = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}");
  };
  try {
    await assert.rejects(() => runSandboxCommand("   "), /command/i);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = real;
  }
});
