// Enkripsi secret konektor (server-side only).
// AES-256-GCM dengan key dari env CONNECTOR_ENCRYPTION_KEY (base64 32 byte).
// Format: base64(iv):base64(ciphertext+tag). Secret tidak pernah ke client/model.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

export function getConnectorKey(): Buffer {
  const raw = process.env.CONNECTOR_ENCRYPTION_KEY?.trim() ?? "";
  if (!raw) {
    throw new Error(
      "CONNECTOR_ENCRYPTION_KEY belum diset di environment server.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    // Dukung juga string 32 char mentah (persis 32 byte utf8)
    const utf8 = Buffer.from(raw, "utf8");
    if (utf8.length === 32) return utf8;
    throw new Error("CONNECTOR_ENCRYPTION_KEY harus 32 byte (base64).");
  }
  return key;
}

export function encryptSecret(plain: string): string {
  if (!plain) throw new Error("Secret kosong tidak bisa dienkripsi.");
  const key = getConnectorKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${Buffer.concat([enc, tag]).toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const key = getConnectorKey();
  const [ivB64, dataB64] = String(payload ?? "").split(":");
  if (!ivB64 || !dataB64) throw new Error("Format secret terenkripsi tidak valid.");
  const iv = Buffer.from(ivB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  if (iv.length !== IV_LEN || data.length < 17) {
    throw new Error("Format secret terenkripsi tidak valid.");
  }
  const tag = data.subarray(data.length - 16);
  const enc = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
