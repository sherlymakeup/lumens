import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  assertPublicConnectorUrl,
  type ConnectorToolDef,
} from "@/lib/agent-connectors.ts";
import {
  connectionEnv,
  createConnection,
  listConnections,
} from "@/lib/agent-connections-db.ts";

const ParamDef = z.object({
  type: z.enum(["string", "number", "boolean"]),
  description: z.string().max(300).optional(),
  required: z.boolean().optional(),
});

const ToolDef = z.object({
  name: z.string().min(1).max(64),
  description: z.string().min(1).max(500),
  method: z.string().min(1).max(10),
  path: z.string().max(300),
  params: z.record(z.string(), ParamDef).optional(),
});

const CreateBody = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(["http", "mcp"]),
  base_url: z.string().min(1).max(500),
  auth_type: z.enum(["none", "bearer", "header", "query"]).default("none"),
  auth_name: z.string().max(120).optional(),
  auth_secret: z.string().max(2000).optional(),
  tools: z.array(ToolDef).max(50).optional(),
  enabled: z.boolean().optional(),
});

export const Route = createFileRoute("/api/connections")({
  server: {
    handlers: {
      GET: async () => {
        const env = connectionEnv();
        const r = await listConnections(env);
        if (!r.ok) return Response.json({ error: r.text }, { status: 503 });
        return Response.json({ connections: r.items });
      },
      POST: async ({ request }) => {
        const env = connectionEnv();
        if (!env) {
          return Response.json(
            { error: "Konektor belum dikonfigurasi di environment server." },
            { status: 503 },
          );
        }
        let parsed: z.infer<typeof CreateBody>;
        try {
          parsed = CreateBody.parse(await request.json().catch(() => null));
        } catch {
          return Response.json({ error: "Body tidak valid." }, { status: 400 });
        }
        // Fail fast: URL harus https publik
        try {
          assertPublicConnectorUrl(parsed.base_url);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "URL tidak valid." },
            { status: 400 },
          );
        }
        if (
          (parsed.auth_type === "header" || parsed.auth_type === "query") &&
          !parsed.auth_name?.trim()
        ) {
          return Response.json(
            { error: "auth_name wajib diisi untuk tipe auth header/query." },
            { status: 400 },
          );
        }
        const tools: ConnectorToolDef[] = (parsed.tools ?? []).map((t) => ({
          name: t.name,
          description: t.description,
          method: t.method,
          path: t.path,
          params: t.params,
        }));
        // Normalisasi nama tool agar aman dipakai sebagai function name
        const seen = new Set<string>();
        for (const t of tools) {
          const slug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          if (!slug || seen.has(slug)) {
            return Response.json(
              { error: `Nama tool tidak valid/duplikat: ${t.name}` },
              { status: 400 },
            );
          }
          seen.add(slug);
        }
        const r = await createConnection(env, {
          name: parsed.name.trim(),
          kind: parsed.kind,
          base_url: parsed.base_url.trim(),
          auth_type: parsed.auth_type,
          auth_name: parsed.auth_name?.trim(),
          auth_secret: parsed.auth_secret || undefined,
          tools,
          enabled: parsed.enabled,
        });
        if (!r.ok) return Response.json({ error: r.text }, { status: 500 });
        return Response.json({ connection: r.item }, { status: 201 });
      },
    },
  },
});
