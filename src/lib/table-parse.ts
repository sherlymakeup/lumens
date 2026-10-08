// Pure markdown table parsing for the custom renderer in ./markdown.
// A table is a pipe row immediately followed by a delimiter row:
//   | a | b |
//   |---|---|
export type TableBlock = { headers: string[]; rows: string[][] };

const DELIMITER_CELL = /^\s*:?-+:?\s*$/;

export function isTableDelimiter(line: string): boolean {
  // Require at least one pipe so a bare "---" still parses as <hr>.
  if (!line.includes("|")) return false;
  const cells = splitRow(line);
  return cells.length >= 1 && cells.every((cell) => DELIMITER_CELL.test(cell));
}

export function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isPipeRow(line: string): boolean {
  return /^\s*\|/.test(line);
}

export function tryParseTable(
  lines: string[],
  start: number,
): { block: TableBlock; next: number } | null {
  const headerLine = lines[start] ?? "";
  const delimiterLine = lines[start + 1] ?? "";
  if (!isPipeRow(headerLine) || !isTableDelimiter(delimiterLine)) return null;
  const headers = splitRow(headerLine);
  const rows: string[][] = [];
  let i = start + 2;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "" || !isPipeRow(line)) break;
    const cells = splitRow(line);
    while (cells.length < headers.length) cells.push("");
    rows.push(cells.slice(0, headers.length));
    i += 1;
  }
  return { block: { headers, rows }, next: i };
}
