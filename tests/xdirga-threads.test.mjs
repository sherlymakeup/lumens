// XDIRGA TOOLS — TDD: thread ID berbasis hash (ala ChatGPT conversation ID).
// Run: node --test tests/xdirga-threads.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isLegacyConversationId,
  isThreadId,
  isValidThreadRef,
  newThreadId,
  sha256Hex,
  threadWorkdir,
} from "../src/lib/thread.ts";

test("sha256Hex: vektor standar", () => {
  assert.equal(
    sha256Hex(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assert.equal(
    sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("newThreadId: format thr_<16 hex>", () => {
  const id = newThreadId();
  assert.match(id, /^thr_[0-9a-f]{16}$/);
});

test("newThreadId: unik", () => {
  const ids = new Set(Array.from({ length: 500 }, () => newThreadId()));
  assert.equal(ids.size, 500);
});

test("isThreadId: validasi format", () => {
  assert.equal(isThreadId("thr_0123456789abcdef"), true);
  assert.equal(isThreadId("thr_0123456789abcde"), false); // 15 hex
  assert.equal(isThreadId("thr_0123456789abcdef0"), false); // 17 hex
  assert.equal(isThreadId("thr_0123456789ABCDEF"), false); // huruf besar
  assert.equal(isThreadId("conv_0123456789abcdef"), false);
  assert.equal(isThreadId(""), false);
  assert.equal(isThreadId("thr_"), false);
});

test("isLegacyConversationId: UUID v4", () => {
  assert.equal(isLegacyConversationId("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isLegacyConversationId("thr_0123456789abcdef"), false);
  assert.equal(isLegacyConversationId("bukan-uuid"), false);
});

test("isValidThreadRef: terima baru atau legacy", () => {
  assert.equal(isValidThreadRef("thr_0123456789abcdef"), true);
  assert.equal(isValidThreadRef("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isValidThreadRef("sembarang"), false);
  assert.equal(isValidThreadRef(""), false);
});

test("threadWorkdir: /workspace/<id-pendek>", () => {
  assert.equal(threadWorkdir("thr_0123456789abcdef"), "$HOME/workspace/thr_0123456789abcdef");
  // legacy UUID di-hash agar aman sebagai nama direktori
  const w = threadWorkdir("550e8400-e29b-41d4-a716-446655440000");
  assert.match(w, /^\$HOME\/workspace\/thr_[0-9a-f]{16}$/);
  // deterministik untuk ID yang sama
  assert.equal(
    threadWorkdir("550e8400-e29b-41d4-a716-446655440000"),
    threadWorkdir("550e8400-e29b-41d4-a716-446655440000"),
  );
});

// ---------- agent-threads-db (mock fetch) ----------
const okFetch = (rows) => async () => ({
  ok: true,
  status: 200,
  json: async () => rows,
});

test("getThread: tanpa env → skipped", async () => {
  const { getThread } = await import("../src/lib/agent-threads-db.ts");
  const r = await getThread(undefined, "thr_0123456789abcdef");
  assert.equal(r.ok, false);
  assert.equal(r.skipped, true);
});

test("getThread: ID invalid → thread null", async () => {
  const { getThread } = await import("../src/lib/agent-threads-db.ts");
  const env = { url: "https://x.supabase.co", key: "k" };
  const orig = globalThis.fetch;
  globalThis.fetch = okFetch([]);
  try {
    const r = await getThread(env, "sembarang");
    assert.equal(r.ok, true);
    assert.equal(r.thread, null);
  } finally {
    globalThis.fetch = orig;
  }
});

test("getThread: row valid dinormalisasi", async () => {
  const { getThread } = await import("../src/lib/agent-threads-db.ts");
  const env = { url: "https://x.supabase.co", key: "k" };
  const orig = globalThis.fetch;
  globalThis.fetch = okFetch([
    {
      id: "thr_0123456789abcdef",
      parent_id: null,
      sandbox_id: "sb_123",
      workdir: "$HOME/workspace/thr_0123456789abcdef",
      created_at: "2026-10-09T00:00:00Z",
      last_active: "2026-10-09T00:00:00Z",
    },
  ]);
  try {
    const r = await getThread(env, "thr_0123456789abcdef");
    assert.equal(r.ok, true);
    assert.equal(r.thread?.sandbox_id, "sb_123");
    assert.equal(r.thread?.workdir, "$HOME/workspace/thr_0123456789abcdef");
  } finally {
    globalThis.fetch = orig;
  }
});

test("upsertThread: tanpa env → skipped, ID invalid → gagal", async () => {
  const { upsertThread } = await import("../src/lib/agent-threads-db.ts");
  const r1 = await upsertThread(undefined, {
    id: "thr_0123456789abcdef",
    workdir: "$HOME/workspace/thr_0123456789abcdef",
  });
  assert.equal(r1.skipped, true);
  const r2 = await upsertThread({ url: "https://x.supabase.co", key: "k" }, {
    id: "sembarang",
    workdir: "/workspace/x",
  });
  assert.equal(r2.ok, false);
});
