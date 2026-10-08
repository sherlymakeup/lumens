// XDIRGA TOOLS — TDD: agent client (generateAgent) SSE event routing.
// Run: node --test tests/xdirga-agent.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { generateAgent } from "../src/lib/generate.ts";

function mockFetch(handler) {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = real;
  };
}

function sseStream(events) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

const BASE_REQ = {
  messages: [{ role: "user", content: "hitung 2**10" }],
  model: "xdirgalabs",
  sandboxId: "sbx-123",
  params: { temperature: 0.7, maxTokens: 1000, topP: 1, frequencyPenalty: 0, presencePenalty: 0 },
};

function collector() {
  const seen = { texts: [], calls: [], results: [], sandboxId: undefined, error: null, done: 0 };
  return {
    seen,
    handlers: {
      onText: (delta) => seen.texts.push(delta),
      onToolCall: (command) => seen.calls.push(command),
      onToolResult: (output, exitCode) => seen.results.push([output, exitCode]),
      onDone: (sandboxId) => {
        seen.done += 1;
        seen.sandboxId = sandboxId;
      },
      onError: (message) => {
        seen.error = message;
      },
    },
  };
}

// ---------- generateAgent ----------
test("generateAgent POSTs to /api/agent and routes tool/text/done events", async () => {
  const restore = mockFetch(async (url, init) => {
    assert.equal(url, "/api/agent");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(init.body);
    assert.equal(body.connection.model, "xdirgalabs");
    assert.equal(body.sandboxId, "sbx-123");
    assert.equal(body.messages[0].content, "hitung 2**10");
    return sseStream([
      { type: "tool_call", command: "python3 -c 'print(2**10)'" },
      { type: "tool_result", output: "1024", exitCode: 0 },
      { type: "text", delta: "Hel" },
      { type: "text", delta: "lo" },
      { type: "done", sandboxId: "sbx-123" },
    ]);
  });
  const { seen, handlers } = collector();
  try {
    await generateAgent(BASE_REQ, handlers);
    assert.deepEqual(seen.calls, ["python3 -c 'print(2**10)'"]);
    assert.deepEqual(seen.results, [["1024", 0]]);
    assert.deepEqual(seen.texts, ["Hel", "lo"]);
    assert.equal(seen.sandboxId, "sbx-123");
    assert.equal(seen.done, 1);
    assert.equal(seen.error, null);
  } finally {
    restore();
  }
});

test("generateAgent surfaces error events via onError", async () => {
  const restore = mockFetch(async () =>
    sseStream([{ type: "error", error: "Model error 400: tools not supported" }]),
  );
  const { seen, handlers } = collector();
  try {
    await generateAgent({ ...BASE_REQ, sandboxId: undefined }, handlers);
    assert.equal(seen.error, "Model error 400: tools not supported");
    assert.equal(seen.done, 0);
  } finally {
    restore();
  }
});

test("generateAgent throws the server error message on non-OK", async () => {
  const restore = mockFetch(
    async () =>
      new Response(JSON.stringify({ error: "Sandbox belum dikonfigurasi" }), { status: 503 }),
  );
  const { seen, handlers } = collector();
  try {
    await generateAgent(BASE_REQ, handlers);
    assert.equal(seen.error, "Sandbox belum dikonfigurasi");
  } finally {
    restore();
  }
});

test("generateAgent routes tool kinds and image payloads", async () => {
  const restore = mockFetch(async () =>
    sseStream([
      { type: "tool_call", kind: "image", command: "a cat astronaut" },
      {
        type: "tool_result",
        output: "Gambar berhasil dibuat (1 gambar, model Gemini).",
        exitCode: 0,
        images: ["data:image/png;base64,iVBORw0="],
      },
      { type: "tool_call", kind: "search", command: "berita hari ini" },
      { type: "tool_result", output: "Hasil pencarian web:\n1. Judul", exitCode: 0 },
      { type: "done", sandboxId: "sbx-1" },
    ]),
  );
  const seen = { calls: [], results: [] };
  try {
    await generateAgent(BASE_REQ, {
      ...collector().handlers,
      onToolCall: (command, kind) => seen.calls.push([command, kind]),
      onToolResult: (output, exitCode, images) => seen.results.push([output, exitCode, images]),
    });
    assert.deepEqual(seen.calls, [
      ["a cat astronaut", "image"],
      ["berita hari ini", "search"],
    ]);
    assert.equal(seen.results[0][2][0], "data:image/png;base64,iVBORw0=");
    assert.equal(seen.results[1][2], undefined);
  } finally {
    restore();
  }
});

test("generateAgent routes memory tool kinds", async () => {
  const restore = mockFetch(async () =>
    sseStream([
      { type: "tool_call", kind: "memory", command: "kopi" },
      { type: "tool_result", output: "Ingatan yang relevan:\n- [id-1] user suka kopi", exitCode: 0 },
      { type: "done", sandboxId: "sbx-1" },
    ]),
  );
  const seen = { calls: [] };
  try {
    await generateAgent(BASE_REQ, {
      ...collector().handlers,
      onToolCall: (command, kind) => seen.calls.push([command, kind]),
    });
    assert.deepEqual(seen.calls, [["kopi", "memory"]]);
  } finally {
    restore();
  }
});

test("generateAgent routes plan events to onPlan", async () => {
  const steps = [
    { text: "Cari data", status: "done" },
    { text: "Tulis laporan", status: "in_progress" },
  ];
  const restore = mockFetch(async () =>
    sseStream([
      { type: "plan", steps },
      { type: "done", sandboxId: "sbx-1" },
    ]),
  );
  const seen = { plans: [] };
  try {
    await generateAgent(BASE_REQ, {
      ...collector().handlers,
      onPlan: (s) => seen.plans.push(s),
    });
    assert.deepEqual(seen.plans, [steps]);
  } finally {
    restore();
  }
});

test("generateAgent routes web_read as search kind", async () => {
  const restore = mockFetch(async () =>
    sseStream([
      { type: "tool_call", kind: "search", command: "https://example.com/a" },
      { type: "tool_result", output: "Isi https://example.com/a:\nHalo", exitCode: 0 },
      { type: "done", sandboxId: "sbx-1" },
    ]),
  );
  const seen = { calls: [] };
  try {
    await generateAgent(BASE_REQ, {
      ...collector().handlers,
      onToolCall: (command, kind) => seen.calls.push([command, kind]),
    });
    assert.deepEqual(seen.calls, [["https://example.com/a", "search"]]);
  } finally {
    restore();
  }
});

test("generateAgent routes file tool kinds and passes files through", async () => {
  const file = { name: "laporan.md", mime: "text/markdown", base64: "IyBIYWxv", size: 6 };
  const restore = mockFetch(async () =>
    sseStream([
      { type: "tool_call", kind: "file", command: "laporan.md" },
      { type: "tool_result", output: "File siap diunduh.", exitCode: 0, files: [file] },
      { type: "done", sandboxId: "sbx-1" },
    ]),
  );
  const seen = { calls: [], results: [] };
  try {
    await generateAgent(BASE_REQ, {
      ...collector().handlers,
      onToolCall: (command, kind) => seen.calls.push([command, kind]),
      onToolResult: (output, exitCode, images, files) => seen.results.push(files),
    });
    assert.deepEqual(seen.calls, [["laporan.md", "file"]]);
    assert.deepEqual(seen.results, [[file]]);
  } finally {
    restore();
  }
});

test("generateAgent sends no sandboxId when starting fresh", async () => {
  const restore = mockFetch(async (url, init) => {
    const body = JSON.parse(init.body);
    assert.ok(!("sandboxId" in body) || body.sandboxId === undefined);
    return sseStream([
      { type: "text", delta: "ok" },
      { type: "done", sandboxId: "sbx-new" },
    ]);
  });
  const { seen, handlers } = collector();
  try {
    await generateAgent({ ...BASE_REQ, sandboxId: undefined }, handlers);
    assert.equal(seen.sandboxId, "sbx-new");
    assert.deepEqual(seen.texts, ["ok"]);
  } finally {
    restore();
  }
});
