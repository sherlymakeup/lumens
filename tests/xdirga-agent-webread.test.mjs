// XDIRGA TOOLS — TDD: web_read via Tavily Extract.
// Run: node --test tests/xdirga-agent-webread.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { runWebRead } from "../src/lib/agent-tools.ts";

function mockFetch(handler) {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = real;
  };
}

const KEY = "tvly-key";

test("runWebRead returns extracted page text", async () => {
  let seenBody = null;
  const restore = mockFetch(async (url, init) => {
    assert.equal(url, "https://api.tavily.com/extract");
    seenBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        results: [{ url: "https://example.com/a", content: "# Judul\n\nIsi halaman." }],
        failed_results: [],
      }),
    );
  });
  try {
    const r = await runWebRead("https://example.com/a", KEY);
    assert.equal(r.ok, true);
    assert.deepEqual(seenBody.urls, ["https://example.com/a"]);
    assert.match(r.text, /Judul/);
    assert.match(r.text, /Isi halaman/);
  } finally {
    restore();
  }
});

test("runWebRead without key returns not-configured without fetching", async () => {
  let called = false;
  const restore = mockFetch(async () => {
    called = true;
    return new Response("{}");
  });
  try {
    const r = await runWebRead("https://example.com/a", undefined);
    assert.equal(r.ok, false);
    assert.match(r.text, /belum dikonfigurasi/i);
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test("runWebRead refuses private/localhost URLs without fetching", async () => {
  let called = false;
  const restore = mockFetch(async () => {
    called = true;
    return new Response("{}");
  });
  try {
    for (const bad of ["http://localhost:3000/x", "http://127.0.0.1/y", "http://192.168.1.1/z"]) {
      const r = await runWebRead(bad, KEY);
      assert.equal(r.ok, false, bad);
      assert.match(r.text, /tidak diizinkan|not allowed/i, bad);
    }
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test("runWebRead refuses non-https and garbage URLs", async () => {
  let called = false;
  const restore = mockFetch(async () => {
    called = true;
    return new Response("{}");
  });
  try {
    const r1 = await runWebRead("http://example.com/a", KEY);
    assert.equal(r1.ok, false);
    const r2 = await runWebRead("bukan-url", KEY);
    assert.equal(r2.ok, false);
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test("runWebRead surfaces API errors", async () => {
  const restore = mockFetch(async () => new Response("bad", { status: 401 }));
  try {
    const r = await runWebRead("https://example.com/a", "wrong-key");
    assert.equal(r.ok, false);
    assert.match(r.text, /401/);
  } finally {
    restore();
  }
});

test("runWebRead reports empty extraction honestly", async () => {
  const restore = mockFetch(
    async () => new Response(JSON.stringify({ results: [], failed_results: [{ url: "https://example.com/a" }] })),
  );
  try {
    const r = await runWebRead("https://example.com/a", KEY);
    assert.equal(r.ok, false);
    assert.match(r.text, /gagal|tidak ada/i);
  } finally {
    restore();
  }
});

test("runWebRead clips very long pages", async () => {
  const long = "x".repeat(50_000);
  const restore = mockFetch(
    async () => new Response(JSON.stringify({ results: [{ url: "https://example.com/a", content: long }] })),
  );
  try {
    const r = await runWebRead("https://example.com/a", KEY, 1000);
    assert.equal(r.ok, true);
    assert.ok(r.text.length < 50_000);
    assert.match(r.text, /dipotong/i);
  } finally {
    restore();
  }
});
