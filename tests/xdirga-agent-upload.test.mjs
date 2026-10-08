// XDIRGA TOOLS — TDD: upload file ke sandbox agent + vision.
// Run: node --test tests/xdirga-agent-upload.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_UPLOAD_BYTES,
  MAX_VISION_BYTES,
  UPLOAD_DIR,
  attachmentNote,
  buildVisionParts,
  buildWriteCommand,
  isImageMime,
  readImageBase64,
  sanitizeUploadName,
} from "../src/lib/agent-upload.ts";

test("sanitizeUploadName strips traversal and junk", () => {
  assert.equal(sanitizeUploadName("../../etc/passwd"), "passwd");
  assert.equal(sanitizeUploadName("a/b\\c.png"), "c.png");
  assert.equal(sanitizeUploadName("laporan (final) #2.md"), "laporan-final-2.md");
  assert.equal(sanitizeUploadName(""), "file");
  assert.equal(sanitizeUploadName("..."), "file");
});

test("sanitizeUploadName truncates long names", () => {
  const long = "a".repeat(200) + ".png";
  const out = sanitizeUploadName(long);
  assert.ok(out.length <= 100);
  assert.ok(out.endsWith(".png"));
});

test("isImageMime detects images only", () => {
  assert.equal(isImageMime("image/png"), true);
  assert.equal(isImageMime("image/jpeg"), true);
  assert.equal(isImageMime("IMAGE/PNG"), true);
  assert.equal(isImageMime("text/plain"), false);
  assert.equal(isImageMime("application/pdf"), false);
  assert.equal(isImageMime(""), false);
});

test("buildWriteCommand writes base64 safely under uploads/", () => {
  const cmd = buildWriteCommand("foto.png", "aGVsbG8=");
  assert.ok(cmd.includes(UPLOAD_DIR));
  assert.ok(cmd.includes("foto.png"));
  assert.ok(cmd.includes("aGVsbG8="));
  assert.ok(cmd.includes("base64 -d"));
  // traversal attempt stays inside uploads/
  const evil = buildWriteCommand("../../x", "eA==");
  assert.ok(!evil.includes(".."));
});

test("attachmentNote describes the file for the agent prompt", () => {
  const note = attachmentNote({ name: "data.csv", path: "uploads/data.csv", mime: "text/csv", size: 120 });
  assert.ok(note.includes("data.csv"));
  assert.ok(note.includes("uploads/data.csv"));
});

test("buildVisionParts returns plain text when no images", () => {
  const out = buildVisionParts("halo", []);
  assert.equal(out, "halo");
});

test("buildVisionParts builds multimodal parts for images", () => {
  const out = buildVisionParts("lihat ini", [{ mime: "image/png", base64: "aGVsbG8=" }]);
  assert.ok(Array.isArray(out));
  assert.deepEqual(out[0], { type: "text", text: "lihat ini" });
  assert.equal(out[1].type, "image_url");
  assert.ok(out[1].image_url.url.startsWith("data:image/png;base64,"));
});

test("readImageBase64 reads file as base64 within limit", async () => {
  const exec = async (cmd) => {
    if (cmd.startsWith("stat ")) return { stdout: "12", stderr: "", exitCode: 0 };
    if (cmd.startsWith("base64 ")) return { stdout: "aGVsbG8=", stderr: "", exitCode: 0 };
    throw new Error("unexpected: " + cmd);
  };
  const r = await readImageBase64(exec, "uploads/f.png");
  assert.equal(r.ok, true);
  assert.equal(r.base64, "aGVsbG8=");
});

test("readImageBase64 refuses oversize images for vision", async () => {
  const exec = async (cmd) => {
    if (cmd.startsWith("stat ")) return { stdout: String(MAX_VISION_BYTES + 1), stderr: "", exitCode: 0 };
    throw new Error("should not read: " + cmd);
  };
  const r = await readImageBase64(exec, "uploads/big.png");
  assert.equal(r.ok, false);
});

test("upload size cap is sane", () => {
  assert.equal(MAX_UPLOAD_BYTES, 10 * 1024 * 1024);
});
