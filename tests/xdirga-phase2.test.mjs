// XDIRGA TOOLS Fase 2 — TDD: API client untuk health & image generation.
// Run: node --experimental-strip-types tests/xdirga-phase2.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkHealth, generateImage } from "../src/lib/generate.ts";

function mockFetch(handler) {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = real;
  };
}

// ---------- checkHealth ----------
test("checkHealth GETs /api/health and returns ok + latencyMs", async () => {
  const restore = mockFetch(async (url, init) => {
    assert.equal(url, "/api/health");
    assert.equal(init?.method, "GET");
    return new Response(JSON.stringify({ ok: true, latencyMs: 178 }));
  });
  try {
    const result = await checkHealth();
    assert.deepEqual(result, { ok: true, latencyMs: 178 });
  } finally {
    restore();
  }
});

test("checkHealth throws the server error message", async () => {
  const restore = mockFetch(
    async () => new Response(JSON.stringify({ error: "Could not reach that endpoint." }), { status: 502 }),
  );
  try {
    await assert.rejects(() => checkHealth(), /Could not reach that endpoint/);
  } finally {
    restore();
  }
});

// ---------- generateImage ----------
test("generateImage POSTs JSON to /api/images and returns images", async () => {
  const restore = mockFetch(async (url, init) => {
    assert.equal(url, "/api/images");
    assert.equal(init?.method, "POST");
    assert.equal(init?.headers["Content-Type"], "application/json");
    const body = JSON.parse(init.body);
    assert.equal(body.model, "ag/gemini-3.1-flash-image");
    assert.equal(body.prompt, "a red lighthouse");
    return new Response(
      JSON.stringify({ images: [{ dataUrl: "data:image/png;base64,AAA", mime: "image/png" }] }),
    );
  });
  try {
    const result = await generateImage({ model: "ag/gemini-3.1-flash-image", prompt: "a red lighthouse" });
    assert.deepEqual(result, [{ dataUrl: "data:image/png;base64,AAA", mime: "image/png" }]);
  } finally {
    restore();
  }
});

test("generateImage throws the server error message", async () => {
  const restore = mockFetch(
    async () => new Response(JSON.stringify({ error: "The gateway returned no image." }), { status: 502 }),
  );
  try {
    await assert.rejects(
      () => generateImage({ model: "m", prompt: "x" }),
      /The gateway returned no image/,
    );
  } finally {
    restore();
  }
});

test("generateImage rejects empty prompt without hitting network", async () => {
  let called = false;
  const restore = mockFetch(async () => {
    called = true;
    return new Response("{}");
  });
  try {
    await assert.rejects(() => generateImage({ model: "m", prompt: "   " }), /prompt/i);
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test("generateImage rejects empty model without hitting network", async () => {
  let called = false;
  const restore = mockFetch(async () => {
    called = true;
    return new Response("{}");
  });
  try {
    await assert.rejects(() => generateImage({ model: "", prompt: "x" }), /model/i);
    assert.equal(called, false);
  } finally {
    restore();
  }
});
