// Fetch a file from the agent sandbox so the user can download it.
// Server-side only. The file is transferred as base64 through SSE and is
// never persisted to localStorage (same rule as generated images).

export const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

export type SandboxExecFn = (cmd: string) => Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}>;

export type FetchedFile = {
  name: string;
  mime: string;
  base64: string;
  size: number;
};

/** Quote shell agar path dengan spasi/karakter khusus aman. */
function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

const MIME_BY_EXT: Record<string, string> = {  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  jsonl: "application/jsonl",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  ts: "text/plain",
  py: "text/x-python",
  sh: "text/x-sh",
  yaml: "text/yaml",
  yml: "text/yaml",
  xml: "text/xml",
  pdf: "application/pdf",
  zip: "application/zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export function guessMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function cleanPath(raw: string): string | null {
  const p = raw.trim().replace(/^\/+/, "");
  if (!p) return null;
  const parts = p.split("/");
  if (parts.some((seg) => seg === ".." || seg === "" || seg === ".")) return null;
  return parts.join("/");
}

export async function fetchSandboxFile(
  exec: SandboxExecFn,
  rawPath: string,
): Promise<{ ok: boolean; text: string; file?: FetchedFile }> {
  const path = cleanPath(rawPath);
  if (!path) {
    return { ok: false, text: "Path file tidak valid (pakai path relatif, tanpa ..)." };
  }
  let stat: { stdout: string; stderr: string; exitCode: number };
  try {
    stat = await exec(`stat -c%s -- ${shellQuote(path)}`);
  } catch (error) {
    return {
      ok: false,
      text: `Gagal membaca info file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (stat.exitCode !== 0) {
    return { ok: false, text: `File "${path}" tidak ditemukan di sandbox.` };
  }
  const size = Number.parseInt(stat.stdout.trim(), 10);
  if (!Number.isFinite(size)) {
    return { ok: false, text: `Ukuran file "${path}" tidak terbaca.` };
  }
  if (size > MAX_FILE_BYTES) {
    return {
      ok: false,
      text: `File "${path}" terlalu besar (${(size / 1048576).toFixed(1)} MB, maks 8 MB).`,
    };
  }
  let out: { stdout: string; stderr: string; exitCode: number };
  try {
    out = await exec(`base64 -w0 -- ${shellQuote(path)}`);
  } catch (error) {
    return {
      ok: false,
      text: `Gagal membaca file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (out.exitCode !== 0) {
    return { ok: false, text: `Gagal membaca file "${path}": ${out.stderr.trim()}` };
  }
  const name = path.split("/").pop() ?? path;
  return {
    ok: true,
    text: `File "${name}" siap diunduh (${size} bytes).`,
    file: { name, mime: guessMime(name), base64: out.stdout.trim(), size },
  };
}
