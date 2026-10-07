// Headless refinement tests — run: node --experimental-strip-types tests/refined.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeBaseUrl, chatCompletionsUrl, modelsUrl } from "../src/lib/safe-url.ts";
import { generateStream, fetchModels } from "../src/lib/generate.ts";

// ---------- safe-url ----------
test("normalizeBaseUrl strips trailing slashes (user case: base with /v1/)", () => {
  assert.equal(normalizeBaseUrl("https://ai.xdirga.xyz/v1/"), "https://ai.xdirga.xyz/v1");
  assert.equal(normalizeBaseUrl("https://api.openai.com/v1///"), "https://api.openai.com/v1");
});

test("chatCompletionsUrl never produces double slash", () => {
  assert.equal(
    chatCompletionsUrl("https://ai.xdirga.xyz/v1/"),
    "https://ai.xdirga.xyz/v1/chat/completions",
  );
  assert.equal(modelsUrl("https://ai.xdirga.xyz/v1/"), "https://ai.xdirga.xyz/v1/models");
});

test("normalizeBaseUrl rejects invalid / private hosts", () => {
  assert.throws(() => normalizeBaseUrl("notaurl"), /not valid/);
  assert.throws(() => normalizeBaseUrl(""), /required/);
  assert.throws(() => normalizeBaseUrl("http://localhost:8080/v1"), /not allowed/);
  assert.throws(() => normalizeBaseUrl("http://127.0.0.1/v1"), /not allowed/);
  assert.throws(() => normalizeBaseUrl("ftp://example.com/v1"), /http or https/);
});

test("normalizeBaseUrl allows public http/https", () => {
  assert.equal(normalizeBaseUrl("http://example.com/v1"), "http://example.com/v1");
  assert.equal(normalizeBaseUrl("https://example.com"), "https://example.com");
  assert.throws(() => normalizeBaseUrl("http://10.0.0.5/x"), /not allowed/);
});

// ---------- generateStream (mocked fetch) ----------
function sseStream(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

const baseReq = {
  messages: [{ role: "user", content: "hi" }],
  stream: true,
  connection: { provider: "custom", model: "m" },
  params: { temperature: 0.7, maxTokens: 100, topP: 1, frequencyPenalty: 0, presencePenalty: 0 },
};

test("generateStream assembles SSE deltas then done", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      sseStream(['data: {"text":"Hello"}\n\n', 'data: {"text":" world"}\n\n', 'data: {"done":true}\n\n']),
      { headers: { "content-type": "text/event-stream" } },
    );
  try {
    let got = "";
    let done = false;
    await generateStream(baseReq, {
      onDelta: (t) => (got += t),
      onDone: () => (done = true),
      onError: (m) => assert.fail(`unexpected error: ${m}`),
    });
    assert.equal(got, "Hello world");
    assert.equal(done, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("generateStream surfaces server error JSON", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "bad key" }), { status: 502 });
  try {
    let err = "";
    await generateStream(baseReq, {
      onDelta: () => {},
      onDone: () => assert.fail("should not complete"),
      onError: (m) => (err = m),
    });
    assert.equal(err, "bad key");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("generateStream handles non-stream JSON body", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ text: "plain answer" }), {
      headers: { "content-type": "application/json" },
    });
  try {
    let got = "";
    let done = false;
    await generateStream({ ...baseReq, stream: false }, {
      onDelta: (t) => (got += t),
      onDone: () => (done = true),
      onError: (m) => assert.fail(`unexpected error: ${m}`),
    });
    assert.equal(got, "plain answer");
    assert.equal(done, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("generateStream treats aborted request as done (not error)", async () => {
  const realFetch = globalThis.fetch;
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = async (_url, init) => {
    init?.signal?.throwIfAborted();
    return new Response("x");
  };
  try {
    let done = false;
    let err = "";
    await generateStream(baseReq, {
      signal: controller.signal,
      onDelta: () => {},
      onDone: () => (done = true),
      onError: (m) => (err = m),
    });
    assert.equal(done, true);
    assert.equal(err, "");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("fetchModels uses GET with no body (server env holds credentials)", async () => {
  const realFetch = globalThis.fetch;
  let seenMethod = null;
  let seenBody;
  globalThis.fetch = async (url, init) => {
    seenMethod = init?.method;
    seenBody = init?.body;
    assert.equal(url, "/api/models");
    return new Response(JSON.stringify({ models: ["a", "b"] }));
  };
  try {
    const models = await fetchModels();
    assert.deepEqual(models, ["a", "b"]);
    assert.equal(seenMethod, "GET");
    assert.equal(seenBody, undefined);
  } finally {
    globalThis.fetch = realFetch;
  }
});
