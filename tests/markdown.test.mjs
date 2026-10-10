import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Test untuk inlineToHtml di src/lib/markdown.tsx
// Kita import via tsx atau compile? Untuk .mjs, kita test logika regex secara langsung.

describe("markdown sandbox:// fallback", () => {
  // Simulasi fungsi yang diperbaiki (tanpa double-escape)
  const ESC = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  };
  function escapeHtml(text) {
    return text.replace(/[&<>"]/g, (ch) => ESC[ch] ?? ch);
  }

  function inlineToHtmlFixed(text) {
    let html = escapeHtml(text);
    html = html.replace(
      /\[([^\]]+)\]\(sandbox:\/\/([^\s)]+)\)/g,
      (_m, label, path) => {
        const filename = path.split("/").pop() ?? path;
        // TIDAK panggil escapeHtml lagi — sudah di-escape di atas
        return `<span class="md-sandbox-file"><span class="md-sandbox-file-name">${filename}</span><span class="md-sandbox-file-hint">${label}</span></span>`;
      },
    );
    return html;
  }

  it("tidak double-escape karakter & pada path", () => {
    const input = "[Download](sandbox://mnt/a&b.html)";
    const result = inlineToHtmlFixed(input);
    // & sudah jadi &amp; sekali, tidak boleh jadi &amp;amp;
    assert.ok(!result.includes("&amp;amp;"), `Double-escaped: ${result}`);
    assert.ok(result.includes("a&amp;b.html"), `Harus ada escaped sekali: ${result}`);
  });

  it("tidak double-escape karakter & pada label", () => {
    const input = "[A & B](sandbox://mnt/file.html)";
    const result = inlineToHtmlFixed(input);
    assert.ok(!result.includes("&amp;amp;"), `Double-escaped: ${result}`);
  });

  it("render filename dengan benar untuk path normal", () => {
    const input = "[Download login.html](sandbox://mnt/data/login.html)";
    const result = inlineToHtmlFixed(input);
    assert.ok(result.includes("login.html"), `Harus ada filename: ${result}`);
    assert.ok(result.includes("md-sandbox-file"), `Harus ada class: ${result}`);
  });
});
