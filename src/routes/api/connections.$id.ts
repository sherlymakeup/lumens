import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertPublicConnectorUrl } from "@/lib/agent-connectors.ts";
import {
  connectionEnv,
  deleteConnection,
  updateConnection,
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

const PatchBody = z.object({
  name: z.string().min(1).max(80).optional(),
  kind: z.enum(["http", "mcp"]).optional(),
  base_url: z.string().min(1).max(500).optional(),
  auth_type: z.enum(["none", "bearer", "header", "query"]).optional(),
  auth_name: z.string().max(120).optional(),
  auth_secret: z.string().max(2000).optional(),
  clear_secret: z.boolean().optional(),
  tools: z.array(ToolDef).max(50).optional(),
  enabled: z.boolean().optional(),
});

export const Route = createFileRoute("/api/connections/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const env = connectionEnv();
        if (!env) {
          return Response.json(
            { error: "Konektor belum dikonfigurasi di environment server." },
            { status: 503 },
          );
        }
        let parsed: z.infer<typeof PatchBody>;
        try {
          parsed = PatchBody.parse(await request.json().catch(() => null));
        } catch {
          return Response.json({ error: "Body tidak valid." }, { status: 400 });
        }
        if (parsed.base_url) {
          try {
            assertPublicConnectorUrl(parsed.base_url);
          } catch (error) {
            return Response.json(
              { error: error instanceof Error ? error.message : "URL tidak valid." },
              { status: 400 },
            );
          }
        }
        const r = await updateConnection(env, params.id, {
          ...parsed,
          name: parsed.name?.trim(),
          base_url: parsed.base_url?.trim(),
          auth_name: parsed.auth_name?.trim(),
          auth_secret: parsed.auth_secret || undefined,
          tools: parsed.tools?.map((t) => ({
            name: t.name,
            description: t.description,
            method: t.method,
            path: t.path,
            params: t.params,
          })),
        });
        if (!r.ok) return Response.json({ error: r.text }, { status: 500 });
        return Response.json({ connection: r.item });
      },
      DELETE: async ({ params }) => {
        const env = connectionEnv();
        if (!env) {
          return Response.json(
            { error: "Konektor belum dikonfigurasi di environment server." },
            { status: 503 },
          );
        }
        const r = await deleteConnection(env, params.id);
        if (!r.ok) return Response.json({ error: r.text }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
