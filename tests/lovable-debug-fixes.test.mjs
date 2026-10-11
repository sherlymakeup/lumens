// XDIRGA TOOLS — TDD: fix dari debug Lovable (regresi H-4, upload E2BIG, dll).
// Run: node --experimental-strip-types --import ./tests/helpers/node-shim.mjs --test tests/lovable-debug-fixes.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { extractSystemAndFilterMessages } from "../src/lib/generate.ts";
import {
  UPLOAD_DIR,
  buildChunkedWriteCommands,
  buildWriteCommand,
} from "../src/lib/agent-upload.ts";

test("extractSystemAndFilterMessages: system dipisah ke instructions", () => {
  const input = [
    { role: "system", content: "Gaya: santai" },
    { role: "user", content: "halo" },
    { role: "assistant", content: "hai bos" },
  ];
  const { instructions, messages } = extractSystemAndFilterMessages(input);
  assert.equal(instructions, "Gaya: santai");
  assert.deepEqual(messages, [
    { role: "user", content: "halo" },
    { role: "assistant", content: "hai bos" },
  ]);
});

test("extractSystemAndFilterMessages: tanpa system → instructions undefined", () => {
  const input = [{ role: "user", content: "halo" }];
  const { instructions, messages } = extractSystemAndFilterMessages(input);
  assert.equal(instructions, undefined);
  assert.deepEqual(messages, [{ role: "user", content: "halo" }]);
});

test("extractSystemAndFilterMessages: beberapa system digabung", () => {
  const input = [
    { role: "system", content: "A" },
    { role: "system", content: "B" },
    { role: "user", content: "x" },
  ];
  const { instructions, messages } = extractSystemAndFilterMessages(input);
  assert.equal(instructions, "A\n\nB");
  assert.equal(messages.length, 1);
});

test("buildChunkedWriteCommands: base64 kecil → satu perintah (sama dgn buildWriteCommand)", () => {
  const b64 = Buffer.from("hello").toString("base64");
  const cmds = buildChunkedWriteCommands("tes.png", b64);
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0], buildWriteCommand("tes.png", b64));
});

test("buildChunkedWriteCommands: base64 besar → multi chunk, tiap argumen kecil", () => {
  // 200 KB data acak → ~267 KB base64 → harus dipecah.
  const data = randomBytes(200 * 1024);
  const b64 = data.toString("base64");
  const cmds = buildChunkedWriteCommands("besar.bin", b64);
  assert.ok(cmds.length > 3, `harus multi-chunk, dapat ${cmds.length}`);
  // Tidak ada satu perintah pun yang membawa argumen > 100 KB (jauh di bawah ARG_MAX).
  for (const c of cmds) {
    assert.ok(c.length < 100 * 1024, `perintah kepanjangan: ${c.length}`);
  }
  // Perintah terakhir decode + cleanup file .b64 sementara.
  const last = cmds[cmds.length - 1];
  assert.ok(last.includes("base64 -d"), "harus ada base64 -d");
  assert.ok(last.includes("rm -f"), "harus cleanup file sementara");
});

test("buildChunkedWriteCommands: chunked benar-benar menulis file utuh di shell", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const run = promisify(execFile);
  const dir = await mkdtemp(join(tmpdir(), "chunk-"));
  const data = randomBytes(300 * 1024); // 300 KB → ~400 KB base64
  const b64 = data.toString("base64");
  const cmds = buildChunkedWriteCommands("besar.bin", b64);
  for (const cmd of cmds) {
    await run("bash", ["-c", cmd], { cwd: dir, maxBuffer: 64 * 1024 * 1024 });
  }
  const content = await readFile(join(dir, UPLOAD_DIR, "besar.bin"));
  assert.deepEqual(content, data);
  await rm(dir, { recursive: true, force: true });
});
