import { createFileRoute } from "@tanstack/react-router";
import { discoverMcpTools, fetchPublicUrl } from "@/lib/agent-connectors.ts";
import {
  connectionEnv,
  getConnectionFull,
  updateConnection,
} from "@/lib/agent-connections-db.ts";

/**
 * POST /api/connections/:id/test
 * - kind=http: cek reachability base_url (HEAD/GET ringan).
 * - kind=mcp: discovery tools/list, simpan hasilnya ke koneksi.
 */
export const Route = createFileRoute("/api/connections/$id/test")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const env = connectionEnv();
        if (!env) {
          return Response.json(
            { error: "Konektor belum dikonfigurasi di environment server." },
            { status: 503 },
          );
        }
        const full = await getConnectionFull(env, params.id);
        if (!full.ok || !full.row) {
          return Response.json({ error: full.text }, { status: 404 });
        }
        const row = full.row;

        if (row.kind === "mcp") {
          const discovered = await discoverMcpTools(
            row.base_url,
            full.secret,
            row.auth_type,
            row.auth_name,
          );
          if (!discovered.ok) {
            return Response.json({ ok: false, error: discovered.text }, { status: 502 });
          }
          // Simpan hasil discovery agar agent tidak perlu discovery tiap request
          const saved = await updateConnection(env, row.id, { tools: discovered.tools });
          if (!saved.ok) {
            return Response.json({ ok: false, error: `Discovery OK, tapi gagal simpan: ${saved.text}` }, { status: 502 });
          }
          return Response.json({ ok: true, kind: "mcp", tools: discovered.tools });
        }

        // kind=http: cek reachability (redirect-safe)
        try {
          const res = await fetchPublicUrl(
            row.base_url,
            {
              method: "HEAD",
              headers: { "User-Agent": "lumens-connector/1.0" },
              signal: AbortSignal.timeout(15_000),
            },
          );
          return Response.json({ ok: true, kind: "http", status: res.status });
        } catch (error) {
          return Response.json(
            {
              ok: false,
              error: `Tidak terjangkau: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300),
            },
            { status: 502 },
          );
        }
      },
    },
  },
});
