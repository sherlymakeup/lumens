// XDIRGA TOOLS — TDD: fetch a file from the agent sandbox to the user.
// Run: node --test tests/xdirga-agent-files.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_FILE_BYTES,
  fetchSandboxFile,
  guessMime,
} from "../src/lib/agent-files.ts";

const okExec = (files) => async (cmd) => {
  if (cmd.startsWith("stat ")) {
    const p = cmd.split("-- ")[1];
    if (!(p in files)) return { stdout: "", stderr: "no such file", exitCode: 1 };
    return { stdout: String(Buffer.byteLength(files[p], "utf8")), stderr: "", exitCode: 0 };
  }
  if (cmd.startsWith("base64 ")) {
    const p = cmd.split("-- ")[1];
    return {
      stdout: Buffer.from(files[p], "utf8").toString("base64"),
      stderr: "",
      exitCode: 0,
    };
  }
  throw new Error(`unexpected cmd: ${cmd}`);
};

test("fetchSandboxFile returns base64 + mime + size", async () => {
  const exec = okExec({ "laporan.md": "# Halo" });
  const r = await fetchSandboxFile(exec, "laporan.md");
  assert.equal(r.ok, true);
  assert.equal(r.file.name, "laporan.md");
  assert.equal(r.file.mime, "text/markdown");
  assert.equal(
    r.file.base64,
    Buffer.from("# Halo", "utf8").toString("base64"),
  );
  assert.equal(r.file.size, Buffer.byteLength("# Halo", "utf8"));
});

test("fetchSandboxFile refuses missing file", async () => {
  const r = await fetchSandboxFile(okExec({}), "nggak-ada.txt");
  assert.equal(r.ok, false);
  assert.match(r.text, /tidak ditemukan/i);
});

test("fetchSandboxFile refuses oversized file without reading it", async () => {
  let readCalled = false;
  const exec = async (cmd) => {
    if (cmd.startsWith("stat ")) return { stdout: String(MAX_FILE_BYTES + 1), stderr: "", exitCode: 0 };
    readCalled = true;
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  const r = await fetchSandboxFile(exec, "gede.bin");
  assert.equal(r.ok, false);
  assert.match(r.text, /terlalu besar/i);
  assert.equal(readCalled, false);
});

test("fetchSandboxFile rejects path traversal", async () => {
  let called = false;
  const exec = async () => {
    called = true;
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  const r = await fetchSandboxFile(exec, "../../etc/passwd");
  assert.equal(r.ok, false);
  assert.equal(called, false);
});

test("fetchSandboxFile rejects empty path", async () => {
  const r = await fetchSandboxFile(okExec({}), "   ");
  assert.equal(r.ok, false);
});

test("guessMime covers common extensions", async () => {
  assert.equal(guessMime("a.pdf"), "application/pdf");
  assert.equal(guessMime("a.csv"), "text/csv");
  assert.equal(guessMime("a.JSON"), "application/json");
  assert.equal(guessMime("a.xyz-tak-dikenal"), "application/octet-stream");
});
