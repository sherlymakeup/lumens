import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth-server.ts";
import {
  assertPublicConnectorUrl,
  type ConnectorToolDef,
} from "@/lib/agent-connectors.ts";
import { validateConnectionPayload } from "@/lib/connection-validation.ts";
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
      GET: async ({ request }) => {
        // C1: wajib auth — konektor menyimpan secret terenkripsi.
        const userId = await verifyAuth(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const env = connectionEnv();
        const r = await listConnections(env, userId);
        if (!r.ok) return Response.json({ error: r.text }, { status: 503 });
        return Response.json({ connections: r.items });
      },
      POST: async ({ request }) => {
        // C1: wajib auth.
        const userId = await verifyAuth(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
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
        // Validasi gabungan (slug unik, URL publik, auth_name, tool unik)
        // C2: validasi hanya terhadap koneksi milik user ini.
        const existing = await listConnections(env, userId);
        const v = validateConnectionPayload(
          {
            name: parsed.name.trim(),
            base_url: parsed.base_url.trim(),
            auth_type: parsed.auth_type,
            auth_name: parsed.auth_name?.trim(),
            tools: (parsed.tools ?? []).map((t) => ({ name: t.name })),
          },
          existing.ok ? existing.items : [],
        );
        if (!v.ok) {
          return Response.json({ error: v.error }, { status: 400 });
        }
        if (parsed.auth_type === "none" && parsed.auth_secret) {
          return Response.json(
            { error: "auth_secret tidak dipakai saat tipe auth 'none'." },
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
        const r = await createConnection(env, userId, {
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
