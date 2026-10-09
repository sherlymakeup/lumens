// Upload file ke sandbox agent + vision (image_url).
// Pure helpers — aman di-test tanpa Novita.

export const UPLOAD_DIR = "uploads";
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const MAX_VISION_BYTES = 4 * 1024 * 1024; // 4 MB cap gambar untuk vision

export type UploadAttachment = {
  name: string;
  path: string; // relative path di sandbox, mis. "uploads/foto.png"
  mime: string;
  size: number;
};

export type VisionImage = { mime: string; base64: string };

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** Bersihkan nama file: buang path traversal & karakter aneh, batasi 100 char. */
export function sanitizeUploadName(name: string): string {
  const base = String(name ?? "")
    .split(/[\\/]/)
    .pop()!
    .trim();
  let clean = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[.-]+|[.-]+$/g, "");
  if (!clean || clean === "-" || clean === "." || clean === "..") clean = "file";
  if (clean.length > 100) {
    const dot = clean.lastIndexOf(".");
    const ext = dot > 0 && clean.length - dot <= 12 ? clean.slice(dot) : "";
    clean = clean.slice(0, 100 - ext.length) + ext;
  }
  return clean;
}

export function isImageMime(mime: string): boolean {
  return String(mime ?? "").trim().toLowerCase().startsWith("image/");
}

/** Path relatif aman di dalam UPLOAD_DIR. */
export function uploadPath(name: string): string {
  return `${UPLOAD_DIR}/${sanitizeUploadName(name)}`;
}

/**
 * Sandbox yang dipakai request agent.
 * Prioritas: sandbox percakapan > sandbox dari hasil upload terakhir.
 * (Upload bisa membuat sandbox baru ketika percakapan belum punya —
 *  sandboxId itu wajib dipropagasi, kalau tidak file "hilang".)
 */
export function resolveAgentSandboxId(
  conversationSandboxId: string | null | undefined,
  uploadSandboxId: string | null | undefined,
): string | undefined {
  return conversationSandboxId || uploadSandboxId || undefined;
}

/**
 * Shell command untuk menulis base64 ke file sandbox.
 * Base64 alphabet aman di-embed langsung; path di-quote.
 */
export function buildWriteCommand(relPath: string, base64: string): string {
  const safe = sanitizeUploadName(relPath.split("/").pop() ?? relPath);
  const dir = UPLOAD_DIR.replace(/[^a-zA-Z0-9_-]/g, "");
  // Catatan: `--` tidak valid untuk target redirect `>` (dianggap nama file),
  // tapi path sudah disanitasi (tak bisa diawali `-`), jadi quote saja cukup.
  return `mkdir -p -- ${shellQuote(dir)} && printf '%s' ${shellQuote(base64)} | base64 -d > ${shellQuote(`${dir}/${safe}`)}`;
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Baris deskripsi file untuk prompt agent. */
export function attachmentNote(a: UploadAttachment): string {
  const kb = a.size >= 1024 ? `${(a.size / 1024).toFixed(1)} KB` : `${a.size} B`;
  const kind = isImageMime(a.mime) ? "gambar" : "file";
  return `- ${kind} "${a.name}" (${a.mime || "unknown"}, ${kb}) ada di path sandbox: ${a.path}`;
}

/**
 * Bangun content pesan user: string biasa kalau tanpa gambar,
 * array multimodal kalau ada gambar (vision, terverifikasi di xdirgalabs).
 */
export function buildVisionParts(text: string, images: VisionImage[]): string | ContentPart[] {
  if (images.length === 0) return text;
  const parts: ContentPart[] = [{ type: "text", text }];
  for (const img of images) {
    parts.push({
      type: "image_url",
      image_url: { url: `data:${img.mime};base64,${img.base64}` },
    });
  }
  return parts;
}

type ExecFn = (cmd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

/**
 * Baca file gambar dari sandbox sebagai base64 untuk vision.
 * Tolak kalau melebihi MAX_VISION_BYTES agar konteks tidak jebol.
 */
export async function readImageBase64(
  exec: ExecFn,
  relPath: string,
): Promise<{ ok: true; base64: string } | { ok: false; reason: string }> {
  const q = shellQuote(relPath);
  const stat = await exec(`stat -c %s -- ${q}`).catch(() => null);
  const size = stat && stat.exitCode === 0 ? Number(stat.stdout.trim()) : NaN;
  if (!Number.isFinite(size)) return { ok: false, reason: "stat gagal" };
  if (size > MAX_VISION_BYTES) return { ok: false, reason: "terlalu besar untuk vision" };
  const out = await exec(`base64 -w0 -- ${q}`).catch(() => null);
  if (!out || out.exitCode !== 0 || !out.stdout.trim()) {
    return { ok: false, reason: "baca gagal" };
  }
  return { ok: true, base64: out.stdout.trim() };
}
