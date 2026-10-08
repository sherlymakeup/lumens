// XDIRGA TOOLS — TDD: agent tool executors (web_search via Tavily,
// generate_image via Gemini image model). Run: node --test tests/xdirga-agent-tools.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  IMAGE_MODEL_ID,
  imageSizeForRatio,
  runImageGeneration,
  runWebSearch,
} from "../src/lib/agent-tools.ts";

function mockFetch(handler) {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = real;
  };
}

// ---------- imageSizeForRatio ----------
test("imageSizeForRatio maps ratios to gateway sizes", () => {
  assert.equal(imageSizeForRatio("1:1"), "1024x1024");
  assert.equal(imageSizeForRatio("16:9"), "1792x1024");
  assert.equal(imageSizeForRatio("9:16"), "1024x1792");
  assert.equal(imageSizeForRatio("bogus"), "1024x1024");
  assert.equal(imageSizeForRatio(undefined), "1024x1024");
});

test("IMAGE_MODEL_ID is a Gemini image model", () => {
  assert.match(IMAGE_MODEL_ID, /gemini/i);
});

// ---------- runWebSearch ----------
test("runWebSearch without apiKey returns not-configured without fetching", async () => {
  let called = false;
  const restore = mockFetch(async () => {
    called = true;
    return new Response("{}");
  });
  try {
    const result = await runWebSearch("berita hari ini", undefined);
    assert.equal(result.ok, false);
    assert.match(result.text, /belum dikonfigurasi/i);
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test("runWebSearch posts to Tavily and compacts results", async () => {
  let seenUrl = "";
  let seenBody = null;
  const restore = mockFetch(async (url, init) => {
    seenUrl = String(url);
    seenBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        results: [
          { title: "Judul A", url: "https://a.example/x", content: "Isi berita A yang panjang ".repeat(20) },
          { title: "Judul B", url: "https://b.example/y", content: "Isi B" },
        ],
      }),
    );
  });
  try {
    const result = await runWebSearch("topik hangat", "tvly-key", 2);
    assert.equal(result.ok, true);
    assert.equal(seenUrl, "https://api.tavily.com/search");
    assert.equal(seenBody.query, "topik hangat");
    assert.equal(seenBody.api_key, "tvly-key");
    assert.ok(seenBody.max_results >= 2);
    assert.match(result.text, /Judul A/);
    assert.match(result.text, /https:\/\/a\.example\/x/);
    assert.match(result.text, /Judul B/);
  } finally {
    restore();
  }
});

test("runWebSearch surfaces upstream errors honestly", async () => {
  const restore = mockFetch(
    async () => new Response(JSON.stringify({ detail: "bad key" }), { status: 401 }),
  );
  try {
    const result = await runWebSearch("x", "bad-key");
    assert.equal(result.ok, false);
    assert.match(result.text, /401/);
  } finally {
    restore();
  }
});

// ---------- runImageGeneration ----------
test("runImageGeneration uses the Gemini model and ratio size", async () => {
  let seenUrl = "";
  let seenBody = null;
  const restore = mockFetch(async (url, init) => {
    seenUrl = String(url);
    seenBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({ data: [{ b64_json: "iVBORw0KGgoAAAANSUhEUg==" }] }),
    );
  });
  try {
    const result = await runImageGeneration({
      prompt: "kucing astronot",
      ratio: "16:9",
      gatewayBase: "https://gateway.example/v1",
      gatewayKey: "gw-key",
    });
    assert.equal(result.ok, true);
    assert.equal(seenUrl, "https://gateway.example/v1/images/generations");
    assert.equal(seenBody.model, IMAGE_MODEL_ID);
    assert.equal(seenBody.size, "1792x1024");
    assert.equal(seenBody.prompt, "kucing astronot");
    assert.equal(result.images.length, 1);
    assert.match(result.images[0], /^data:image\/png;base64,/);
    assert.match(result.text, /1/);
  } finally {
    restore();
  }
});

test("runImageGeneration reports empty gateway data", async () => {
  const restore = mockFetch(async () => new Response(JSON.stringify({ data: [] })));
  try {
    const result = await runImageGeneration({
      prompt: "x",
      gatewayBase: "https://gateway.example/v1",
      gatewayKey: "gw-key",
    });
    assert.equal(result.ok, false);
    assert.match(result.text, /tidak mengembalikan gambar/i);
  } finally {
    restore();
  }
});
