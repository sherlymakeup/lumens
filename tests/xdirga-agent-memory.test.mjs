// XDIRGA TOOLS — TDD: agent memory client (Supabase PostgREST).
// Run: node --test tests/xdirga-agent-memory.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deleteMemory,
  saveMemory,
  searchMemories,
} from "../src/lib/agent-memory.ts";

function mockFetch(handler) {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = real;
  };
}

const ENV = { url: "https://xyz.supabase.co", key: "srv-key" };

// ---------- searchMemories ----------
test("searchMemories queries PostgREST with ilike + recency order", async () => {
  let seenUrl = "";
  let seenHeaders = null;
  const restore = mockFetch(async (url, init) => {
    seenUrl = String(url);
    seenHeaders = init.headers;
    return new Response(
      JSON.stringify([
        { id: "id-1", content: "user suka kopi", updated_at: "2026-10-08T00:00:00Z" },
      ]),
    );
  });
  try {
    const result = await searchMemories("kopi", ENV, 5);
    assert.equal(result.ok, true);
    assert.match(seenUrl, /^https:\/\/xyz\.supabase\.co\/rest\/v1\/memories\?/);
    assert.match(seenUrl, /content=ilike\./);
    assert.match(seenUrl, /order=updated_at\.desc/);
    assert.match(seenUrl, /limit=5/);
    assert.equal(seenHeaders.apikey, "srv-key");
    assert.equal(seenHeaders.Authorization, "Bearer srv-key");
    assert.equal(result.memories.length, 1);
    assert.equal(result.memories[0].id, "id-1");
    assert.match(result.text, /user suka kopi/);
  } finally {
    restore();
  }
});

test("searchMemories without env returns not-configured without fetching", async () => {
  let called = false;
  const restore = mockFetch(async () => {
    called = true;
    return new Response("[]");
  });
  try {
    const result = await searchMemories("x", undefined);
    assert.equal(result.ok, false);
    assert.match(result.text, /belum dikonfigurasi/i);
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test("searchMemories reports empty results honestly", async () => {
  const restore = mockFetch(async () => new Response(JSON.stringify([])));
  try {
    const result = await searchMemories("tidak ada", ENV);
    assert.equal(result.ok, true);
    assert.equal(result.memories.length, 0);
    assert.match(result.text, /tidak ada/i);
  } finally {
    restore();
  }
});

// ---------- saveMemory ----------
test("saveMemory POSTs content and returns the new id", async () => {
  let seenUrl = "";
  let seenBody = null;
  let seenMethod = "";
  const restore = mockFetch(async (url, init) => {
    seenUrl = String(url);
    seenMethod = init.method;
    seenBody = JSON.parse(init.body);
    return new Response(JSON.stringify([{ id: "new-id", content: "fakta baru" }]));
  });
  try {
    const result = await saveMemory("fakta baru", ENV);
    assert.equal(result.ok, true);
    assert.equal(seenMethod, "POST");
    assert.equal(seenUrl, "https://xyz.supabase.co/rest/v1/memories");
    assert.equal(seenBody.content, "fakta baru");
    assert.equal(result.id, "new-id");
  } finally {
    restore();
  }
});

test("saveMemory rejects empty content without fetching", async () => {
  let called = false;
  const restore = mockFetch(async () => {
    called = true;
    return new Response("{}");
  });
  try {
    const result = await saveMemory("   ", ENV);
    assert.equal(result.ok, false);
    assert.equal(called, false);
  } finally {
    restore();
  }
});

// ---------- deleteMemory ----------
test("deleteMemory DELETEs by id", async () => {
  let seenUrl = "";
  let seenMethod = "";
  const restore = mockFetch(async (url, init) => {
    seenUrl = String(url);
    seenMethod = init.method;
    return new Response(null, { status: 204 });
  });
  try {
    const result = await deleteMemory("id-9", ENV);
    assert.equal(result.ok, true);
    assert.equal(seenMethod, "DELETE");
    assert.match(seenUrl, /id=eq\.id-9/);
  } finally {
    restore();
  }
});

test("deleteMemory surfaces upstream errors", async () => {
  const restore = mockFetch(async () => new Response("nope", { status: 404 }));
  try {
    const result = await deleteMemory("missing", ENV);
    assert.equal(result.ok, false);
    assert.match(result.text, /404/);
  } finally {
    restore();
  }
});
