// XDIRGA TOOLS — TDD: pure markdown table parser for the custom renderer.
// Run: node --test tests/xdirga-table.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { isTableDelimiter, splitRow, tryParseTable } from "../src/lib/table-parse.ts";

// ---------- isTableDelimiter ----------
test("isTableDelimiter accepts pipe delimiter rows", () => {
  assert.equal(isTableDelimiter("|---|---|"), true);
  assert.equal(isTableDelimiter("| --- | :---: | ---: |"), true);
  assert.equal(isTableDelimiter("  |---|---|  "), true);
});

test("isTableDelimiter rejects non-delimiters", () => {
  assert.equal(isTableDelimiter("| a | b |"), false);
  assert.equal(isTableDelimiter("---"), false);
  assert.equal(isTableDelimiter(""), false);
  assert.equal(isTableDelimiter("| a | --- |"), false);
});

// ---------- splitRow ----------
test("splitRow trims outer pipes and cells", () => {
  assert.deepEqual(splitRow("| a | b |"), ["a", "b"]);
  assert.deepEqual(splitRow("|a|b|"), ["a", "b"]);
  assert.deepEqual(splitRow("  |  a  |  "), ["a"]);
});

// ---------- tryParseTable ----------
test("tryParseTable parses header + rows", () => {
  const lines = ["| Komponen | Detail |", "|---|---|", "| CPU | 2 core |", "| RAM | 512 MB |", "", "after"];
  const result = tryParseTable(lines, 0);
  assert.ok(result);
  assert.deepEqual(result.block.headers, ["Komponen", "Detail"]);
  assert.deepEqual(result.block.rows, [
    ["CPU", "2 core"],
    ["RAM", "512 MB"],
  ]);
  assert.equal(result.next, 4);
});

test("tryParseTable returns null without a delimiter row", () => {
  const lines = ["| a | b |", "| c | d |"];
  assert.equal(tryParseTable(lines, 0), null);
});

test("tryParseTable returns null when not starting on a pipe row", () => {
  assert.equal(tryParseTable(["hello"], 0), null);
});

test("tryParseTable normalizes ragged rows to header width", () => {
  const lines = ["| a | b | c |", "|---|---|---|", "| x | y |", "| p | q | r | s |"];
  const result = tryParseTable(lines, 0);
  assert.ok(result);
  assert.deepEqual(result.block.rows[0], ["x", "y", ""]);
  assert.deepEqual(result.block.rows[1], ["p", "q", "r"]);
});

test("tryParseTable stops at blank line and non-pipe rows", () => {
  const lines = ["| a |", "|---|", "| x |", "plain text", "| y |"];
  const result = tryParseTable(lines, 0);
  assert.ok(result);
  assert.deepEqual(result.block.rows, [["x"]]);
  assert.equal(result.next, 3);
});

test("tryParseTable handles a table at the end of input", () => {
  const lines = ["intro", "| a |", "|---|", "| x |"];
  const result = tryParseTable(lines, 1);
  assert.ok(result);
  assert.equal(result.next, 4);
});
