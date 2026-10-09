// Validasi payload konektor yang dipakai bersama POST & PATCH
// (server-side). Mencegah drift validasi antar route.
import { assertPublicConnectorUrl, connectorSlug } from "./agent-connectors.ts";

export type ExistingConnection = { id: string; name: string };

export type ConnectionPayload = {
  name?: string;
  base_url?: string;
  auth_type?: string;
  auth_name?: string;
  tools?: { name: string }[];
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Validasi lintas-koneksi:
 * - slug nama koneksi unik antar koneksi (hindari tabrakan function name)
 * - base_url https publik
 * - auth_name wajib untuk header/query
 * - slug nama tool unik di dalam satu koneksi
 */
export function validateConnectionPayload(
  payload: ConnectionPayload,
  existing: ExistingConnection[],
  excludeId?: string,
): ValidationResult {
  if (payload.name !== undefined) {
    const slug = connectorSlug(payload.name);
    const clash = existing.find(
      (c) => c.id !== excludeId && connectorSlug(c.name) === slug,
    );
    if (clash) {
      return {
        ok: false,
        error: `Nama koneksi bentrok dengan "${clash.name}" (slug sama: ${slug}).`,
      };
    }
  }

  if (payload.base_url !== undefined) {
    try {
      assertPublicConnectorUrl(payload.base_url);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "URL tidak valid.",
      };
    }
  }

  if (
    (payload.auth_type === "header" || payload.auth_type === "query") &&
    !payload.auth_name?.trim()
  ) {
    return {
      ok: false,
      error: "auth_name wajib diisi untuk tipe auth header/query.",
    };
  }

  if (payload.tools !== undefined) {
    const seen = new Set<string>();
    for (const t of payload.tools) {
      const slug = String(t.name ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (!slug || seen.has(slug)) {
        return {
          ok: false,
          error: `Nama tool tidak valid/duplikat: ${t.name}`,
        };
      }
      seen.add(slug);
    }
  }

  return { ok: true };
}
