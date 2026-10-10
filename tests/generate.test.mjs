// XDIRGA TOOLS — TDD: generateStream resilience (H1, M1, M4).
// Run: node --experimental-strip-types --import ./tests/helpers/node-shim.mjs --test tests/generate.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { generateStream } from "../src/lib/generate.ts";

function mockFetch(handler) {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = real;
  };
}

function sseResponse(chunks, { throwOnPull = null } = {}) {
  const encoder = new TextEncoder();
  let pullCount = 0;
  let idx = 0;
  return new Response(
    new ReadableStream({
      pull(controller) {
        pullCount += 1;
        // Simulasi koneksi putus di tengah baca.
        if (throwOnPull && pullCount >= throwOnPull) throw new Error("network down");
        if (idx < chunks.length) {
          controller.enqueue(encoder.encode(chunks[idx++]));
        } else {
          controller.close();
        }
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

function collector() {
  const seen = { deltas: [], done: 0, error: null };
  return {
    seen,
    handlers: {
      onDelta: (t) => seen.deltas.push(t),
      onDone: () => {
        seen.done += 1;
      },
      onError: (m) => {
        seen.error = m;
      },
    },
  };
}

const BASE_REQ = {
  messages: [{ role: "user", content: "halo" }],
  stream: true,
  connection: { provider: "custom", model: "xdirgalabs" },
  params: { temperature: 0.7, maxTokens: 100, topP: 1, frequencyPenalty: 0, presencePenalty: 0 },
};

// ---------- H1: try/catch stream error ----------
test("generateStream: stream error mid-read calls onError, not onDone", async () => {
  const restore = mockFetch(async () =>
    sseResponse(['data: {"text":"halo"}\n\n'], { throwOnPull: 2 }),
  );
  const { seen, handlers } = collector();
  try {
    await generateStream(BASE_REQ, handlers);
    assert.deepEqual(seen.deltas, ["halo"]);
    assert.ok(seen.error && seen.error.includes("terputus"), `error=${seen.error}`);
    assert.equal(seen.done, 0);
  } finally {
    restore();
  }
});

test("generateStream: aborted signal calls onError(Dibatalkan)", async () => {
  const controller = new AbortController();
  controller.abort();
  const restore = mockFetch(async (url, init) => {
    if (init?.signal?.aborted) {
      const err = new DOMException("aborted", "AbortError");
      throw err;
    }
    return sseResponse(['data: {"text":"x"}\n\n', "data: [DONE]\n\n"]);
  });
  const { seen, handlers } = collector();
  try {
    await generateStream(BASE_REQ, { ...handlers, signal: controller.signal });
    // fetch itself throws AbortError -> generateStream catches -> onError("Dibatalkan.")
    assert.ok(
      seen.error === "Dibatalkan." || seen.done === 1,
      `error=${seen.error} done=${seen.done}`,
    );
  } finally {
    restore();
  }
});

// ---------- M1: done event detection ----------
test("generateStream: stream ends without done event -> onError(incomplete)", async () => {
  const restore = mockFetch(async () => sseResponse(['data: {"text":"partial"}\n\n']));
  const { seen, handlers } = collector();
  try {
    await generateStream(BASE_REQ, handlers);
    assert.deepEqual(seen.deltas, ["partial"]);
    assert.ok(
      seen.error && seen.error.includes("tidak lengkap"),
      `expected incomplete error, got: ${seen.error}`,
    );
    assert.equal(seen.done, 0);
  } finally {
    restore();
  }
});

test("generateStream: [DONE] marker -> onDone, no error", async () => {
  const restore = mockFetch(async () =>
    sseResponse(['data: {"text":"ok"}\n\n', "data: [DONE]\n\n"]),
  );
  const { seen, handlers } = collector();
  try {
    await generateStream(BASE_REQ, handlers);
    assert.deepEqual(seen.deltas, ["ok"]);
    assert.equal(seen.done, 1);
    assert.equal(seen.error, null);
  } finally {
    restore();
  }
});

test("generateStream: done:true field -> onDone, no error", async () => {
  const restore = mockFetch(async () =>
    sseResponse(['data: {"text":"ok"}\n\n', 'data: {"done":true}\n\n']),
  );
  const { seen, handlers } = collector();
  try {
    await generateStream(BASE_REQ, handlers);
    assert.equal(seen.done, 1);
    assert.equal(seen.error, null);
  } finally {
    restore();
  }
});

test("generateStream: error event -> onError, done not called", async () => {
  const restore = mockFetch(async () =>
    sseResponse(['data: {"error":"Model sibuk"}\n\n', "data: [DONE]\n\n"]),
  );
  const { seen, handlers } = collector();
  try {
    await generateStream(BASE_REQ, handlers);
    assert.equal(seen.error, "Model sibuk");
    assert.equal(seen.done, 0);
  } finally {
    restore();
  }
});

// ---------- strings override (i18n) ----------
test("generateStream: uses provided strings for incomplete error", async () => {
  const restore = mockFetch(async () => sseResponse(['data: {"text":"x"}\n\n']));
  const { seen, handlers } = collector();
  try {
    await generateStream(BASE_REQ, {
      ...handlers,
      strings: { cancelled: "CANCEL", interrupted: "CUT", incomplete: "INCOMPLETE" },
    });
    assert.equal(seen.error, "INCOMPLETE");
  } finally {
    restore();
  }
});

test("generateStream: uses provided strings for interrupted error", async () => {
  const restore = mockFetch(async () =>
    sseResponse(['data: {"text":"x"}\n\n'], { throwOnPull: 2 }),
  );
  const { seen, handlers } = collector();
  try {
    await generateStream(BASE_REQ, {
      ...handlers,
      strings: { cancelled: "CANCEL", interrupted: "CUT", incomplete: "INCOMPLETE" },
    });
    assert.equal(seen.error, "CUT");
  } finally {
    restore();
  }
});

// ---------- M4: reader cancel ----------
test("generateStream: reader.cancel() is called after stream ends", async () => {
  let cancelCalled = false;
  const origGetReader = ReadableStream.prototype.getReader;
  ReadableStream.prototype.getReader = function (...args) {
    const reader = origGetReader.apply(this, args);
    const origCancel = reader.cancel.bind(reader);
    reader.cancel = (...a) => {
      cancelCalled = true;
      return origCancel(...a);
    };
    return reader;
  };
  const restore = mockFetch(async () =>
    sseResponse(['data: {"text":"ok"}\n\n', "data: [DONE]\n\n"]),
  );
  const { handlers } = collector();
  try {
    await generateStream(BASE_REQ, handlers);
    assert.equal(cancelCalled, true);
  } finally {
    ReadableStream.prototype.getReader = origGetReader;
    restore();
  }
});

test("generateStream: reader.cancel() is called even on stream error", async () => {
  let cancelCalled = false;
  const origGetReader = ReadableStream.prototype.getReader;
  ReadableStream.prototype.getReader = function (...args) {
    const reader = origGetReader.apply(this, args);
    const origCancel = reader.cancel.bind(reader);
    reader.cancel = (...a) => {
      cancelCalled = true;
      return origCancel(...a);
    };
    return reader;
  };
  const restore = mockFetch(async () =>
    sseResponse(['data: {"text":"x"}\n\n'], { throwOnPull: 2 }),
  );
  const { handlers } = collector();
  try {
    await generateStream(BASE_REQ, handlers);
    assert.equal(cancelCalled, true);
  } finally {
    ReadableStream.prototype.getReader = origGetReader;
    restore();
  }
});
