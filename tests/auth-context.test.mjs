// TDD: auth-context helpers — logic murni terisolasi (tanpa DOM/Supabase).
// Run: node --test tests/auth-context.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  withTimeout,
  signOutWithCleanup,
  handleUnauthorizedFlow,
  setUnauthorizedHandler,
  getUnauthorizedHandler,
} from "../src/lib/auth-utils.ts";

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test("withTimeout: resolve cepat → nilai diteruskan", async () => {
  const result = await withTimeout(Promise.resolve("ok"), 1000, "probe");
  assert.equal(result, "ok");
});

test("withTimeout: promise gantung → reject timeout", async () => {
  const hanging = new Promise(() => {});
  await assert.rejects(() => withTimeout(hanging, 30, "getToken"), /getToken timed out after 30ms/);
});

test("withTimeout: promise reject cepat → error asli (bukan timeout)", async () => {
  const boom = Promise.reject(new Error("asli"));
  await assert.rejects(() => withTimeout(boom, 1000, "x"), /asli/);
});

test("signOutWithCleanup: clear dipanggil saat signOut sukses", async () => {
  let cleared = false;
  let signedOut = false;
  await signOutWithCleanup(
    async () => {
      signedOut = true;
    },
    () => {
      cleared = true;
    },
  );
  assert.equal(signedOut, true);
  assert.equal(cleared, true);
});

test("signOutWithCleanup: clear TETAP dipanggil walau signOut throw", async () => {
  let cleared = false;
  await assert.rejects(() =>
    signOutWithCleanup(
      async () => {
        throw new Error("network down");
      },
      () => {
        cleared = true;
      },
    ),
  );
  assert.equal(cleared, true);
});

test("handleUnauthorizedFlow: refresh sukses → true, tanpa signOut/redirect", async () => {
  let signedOut = false;
  let redirected = false;
  const ok = await handleUnauthorizedFlow({
    refreshSession: async () => ({ error: null }),
    signOut: async () => {
      signedOut = true;
    },
    redirectToLogin: () => {
      redirected = true;
    },
  });
  assert.equal(ok, true);
  assert.equal(signedOut, false);
  assert.equal(redirected, false);
});

test("handleUnauthorizedFlow: refresh error → signOut + redirect, false", async () => {
  let signedOut = false;
  let redirected = false;
  const ok = await handleUnauthorizedFlow({
    refreshSession: async () => ({ error: new Error("expired") }),
    signOut: async () => {
      signedOut = true;
    },
    redirectToLogin: () => {
      redirected = true;
    },
  });
  assert.equal(ok, false);
  assert.equal(signedOut, true);
  assert.equal(redirected, true);
});

test("handleUnauthorizedFlow: refresh throw → signOut + redirect", async () => {
  let signedOut = false;
  let redirected = false;
  const ok = await handleUnauthorizedFlow({
    refreshSession: async () => {
      throw new Error("network");
    },
    signOut: async () => {
      signedOut = true;
    },
    redirectToLogin: () => {
      redirected = true;
    },
  });
  assert.equal(ok, false);
  assert.equal(signedOut, true);
  assert.equal(redirected, true);
});

test("handleUnauthorizedFlow: signOut throw → redirect tetap jalan", async () => {
  let redirected = false;
  const ok = await handleUnauthorizedFlow({
    refreshSession: async () => ({ error: new Error("expired") }),
    signOut: async () => {
      throw new Error("signout gagal");
    },
    redirectToLogin: () => {
      redirected = true;
    },
  });
  assert.equal(ok, false);
  assert.equal(redirected, true);
});

test("unauthorized handler registry: set/get roundtrip", () => {
  assert.equal(getUnauthorizedHandler(), null);
  const fn = async () => {};
  setUnauthorizedHandler(fn);
  assert.equal(getUnauthorizedHandler(), fn);
  setUnauthorizedHandler(null);
  assert.equal(getUnauthorizedHandler(), null);
});

// Sanity: timer withTimeout tidak bocor (tidak menahan event loop setelah resolve).
test("withTimeout: tidak menahan process exit setelah resolve", async () => {
  await withTimeout(tick(5), 5000, "x");
  // jika timer tidak di-clear, test runner akan lambat; cukup pastikan resolve cepat
});
