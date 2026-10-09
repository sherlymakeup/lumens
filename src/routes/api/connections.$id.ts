import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { validateConnectionPayload } from "@/lib/connection-validation.ts";
import {
  connectionEnv,
  deleteConnection,
  getConnectionFull,
  listConnections,
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
        // Validasi gabungan (paritas dengan POST): slug unik, URL publik,
        // auth_name wajib, tool unik — dengan excludeId agar nama sendiri lolos.
        const existing = await listConnections(env);
        const v = validateConnectionPayload(
          {
            name: parsed.name?.trim(),
            base_url: parsed.base_url?.trim(),
            auth_type: parsed.auth_type,
            auth_name: parsed.auth_name?.trim(),
            tools: parsed.tools?.map((t) => ({ name: t.name })),
          },
          existing.ok ? existing.items : [],
          params.id,
        );
        if (!v.ok) {
          return Response.json({ error: v.error }, { status: 400 });
        }
        // Tolak secret tanpa auth (finding audit #20)
        if (parsed.auth_type === "none" && parsed.auth_secret) {
          return Response.json(
            { error: "auth_secret tidak dipakai saat tipe auth 'none'." },
            { status: 400 },
          );
        }
        // H1 mitigation: mengganti base_url menghapus secret tersimpan.
        // Tanpa ini, pihak ketiga bisa mengarahkan secret ke server miliknya
        // lewat PATCH base_url (app tanpa auth).
        let secretCleared = false;
        if (parsed.base_url) {
          const current = await getConnectionFull(env, params.id);
          if (current.ok && current.row?.auth_secret && !parsed.auth_secret) {
            const norm = (u: string) => u.trim().replace(/\/$/, "");
            if (norm(current.row.base_url) !== norm(parsed.base_url)) {
              secretCleared = true;
            }
          }
        }
        // Menonaktifkan auth juga menghapus secret yang tidak terpakai.
        const clearSecret = secretCleared || parsed.clear_secret || parsed.auth_type === "none";
        const r = await updateConnection(env, params.id, {
          ...parsed,
          name: parsed.name?.trim(),
          base_url: parsed.base_url?.trim(),
          auth_name: parsed.auth_name?.trim(),
          auth_secret: parsed.auth_secret || undefined,
          clear_secret: clearSecret || undefined,
          tools: parsed.tools?.map((t) => ({
            name: t.name,
            description: t.description,
            method: t.method,
            path: t.path,
            params: t.params,
          })),
        });
        if (!r.ok) return Response.json({ error: r.text }, { status: 500 });
        return Response.json({
          connection: r.item,
          ...(secretCleared
            ? { note: "Base URL berubah — secret lama dihapus, masukkan secret baru." }
            : {}),
        });
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
