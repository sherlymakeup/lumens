// XDIRGA TOOLS — TDD: conversation sync logic (C1/H1/H2/M1/M6).
// Run: node --test tests/conversations-sync.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  mergeServerConversations,
  fetchWithRetry,
  applyServerLoad,
  resolveActiveId,
} from "../src/lib/conversation-sync-logic.ts";

const conv = (id, updatedAt, extra = {}) => ({
  id,
  title: `T-${id}`,
  messages: [],
  createdAt: 1,
  updatedAt,
  projectId: null,
  ...extra,
});

// ---------- C1: merge tidak menimpa perubahan lokal yang belum tersimpan ----------

test("C1: merge mempertahankan versi lokal untuk conversation yang dirty", () => {
  const server = [conv("a", 100), conv("b", 100)];
  const local = [conv("a", 200), conv("b", 100)]; // "a" diedit saat load
  const merged = mergeServerConversations(server, local, new Set(["a"]));
  assert.equal(merged.find((c) => c.id === "a").updatedAt, 200);
  assert.equal(merged.find((c) => c.id === "b").updatedAt, 100);
});

test("C1: merge mempertahankan conversation baru (dirty) yang belum ada di server", () => {
  const server = [conv("a", 100)];
  const local = [conv("a", 100), conv("baru", 300)];
  const merged = mergeServerConversations(server, local, new Set(["baru"]));
  assert.ok(merged.some((c) => c.id === "baru"));
  assert.equal(merged[0].id, "baru"); // paling baru diurutkan teratas
});

test("C1: merge memakai versi server untuk id yang tidak dirty", () => {
  const server = [conv("a", 100)];
  const local = [conv("a", 50)]; // lokal basi, tidak dirty
  const merged = mergeServerConversations(server, local, new Set());
  assert.equal(merged.find((c) => c.id === "a").updatedAt, 100);
});

test("C1: merge membuang conversation lokal non-dirty yang tidak ada di server", () => {
  // Skenario: dihapus di device lain, server 200 authoritative.
  const server = [conv("a", 100)];
  const local = [conv("a", 100), conv("zombie", 90)];
  const merged = mergeServerConversations(server, local, new Set());
  assert.ok(!merged.some((c) => c.id === "zombie"));
});

// ---------- H1: retry dengan backoff ----------

test("H1: fetchWithRetry sukses setelah 2x gagal transient", async () => {
  let calls = 0;
  const r = await fetchWithRetry(
    async () => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return "ok";
    },
    3,
    5,
  );
  assert.equal(r, "ok");
  assert.equal(calls, 3);
});

test("H1: fetchWithRetry throw setelah max attempts tercapai", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      fetchWithRetry(
        async () => {
          calls++;
          throw new Error("down");
        },
        3,
        5,
      ),
    /down/,
  );
  assert.equal(calls, 3);
});

test("H1: fetchWithRetry tidak retry jika isRetryable false", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      fetchWithRetry(
        async () => {
          calls++;
          const e = new Error("auth");
          e.retryable = false;
          throw e;
        },
        3,
        5,
        (e) => e.retryable !== false,
      ),
    /auth/,
  );
  assert.equal(calls, 1);
});

// ---------- H2: guard kosong hanya saat fetch gagal ----------

test("H2: applyServerLoad return null saat fetch gagal (cache dipertahankan)", () => {
  const local = [conv("a", 100)];
  assert.equal(applyServerLoad({ ok: false }, local, new Set(), "a"), null);
});

test("H2: applyServerLoad mengosongkan saat server 200 dengan array kosong", () => {
  const local = [conv("a", 100)];
  const r = applyServerLoad({ ok: true, conversations: [] }, local, new Set(), "a");
  assert.deepEqual(r.conversations, []);
  assert.equal(r.activeId, null);
});

test("H2: conversation dirty tetap dipertahankan walau server 200 kosong", () => {
  const local = [conv("baru", 300)];
  const r = applyServerLoad(
    { ok: true, conversations: [] },
    local,
    new Set(["baru"]),
    null,
  );
  assert.equal(r.conversations.length, 1);
  assert.equal(r.conversations[0].id, "baru");
});

test("H2: applyServerLoad mempertahankan activeId yang valid", () => {
  const server = [conv("a", 100), conv("b", 90)];
  const r = applyServerLoad({ ok: true, conversations: server }, [], new Set(), "b");
  assert.equal(r.activeId, "b");
});

// ---------- M6: validasi activeId ----------

test("M6: resolveActiveId fallback ke pertama jika id dangling", () => {
  const convs = [conv("a", 100), conv("b", 90)];
  assert.equal(resolveActiveId("hilang", convs), "a");
  assert.equal(resolveActiveId("b", convs), "b");
  assert.equal(resolveActiveId("x", []), null);
  assert.equal(resolveActiveId(null, convs), "a");
});

// ---------- M1: setSandboxId bump updatedAt (source-level) ----------

test("M1: setSandboxId di store.ts me-bump updatedAt", () => {
  const src = readFileSync(new URL("../src/lib/store.ts", import.meta.url), "utf8");
  // Implementasi ada setelah deklarasi tipe — ambil kemunculan terakhir.
  const idx = src.lastIndexOf("setSandboxId");
  assert.ok(idx >= 0, "setSandboxId tidak ditemukan di store.ts");
  const block = src.slice(idx, idx + 400);
  assert.match(block, /updatedAt:\s*Date\.now\(\)/);
});
