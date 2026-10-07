import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { modelsUrl, imageModelsUrl } from "@/lib/safe-url";

const Body = z.object({ model: z.string().min(1).max(120) });

async function fetchModelIds(url: string, key: string): Promise<Set<string>> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
      "User-Agent": "lumens-proxy/1.0",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Model list failed (${response.status})`);
  const body = (await response.json()) as { data?: { id?: string }[] };
  return new Set(
    (body.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)),
  );
}

export const Route = createFileRoute("/api/models-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Endpoint credentials live on the server (Vercel env) — never in the UI.
        const key = process.env.OPENAI_API_KEY?.trim() ?? "";
        const base = process.env.OPENAI_BASE_URL?.trim() ?? "";
        if (!key || !base) {
          return Response.json(
            { error: "Server misconfigured: set OPENAI_API_KEY and OPENAI_BASE_URL env vars." },
            { status: 503 },
          );
        }

        let parsed: z.infer<typeof Body>;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return Response.json({ error: "Body harus berupa { model: string }." }, { status: 400 });
        }
        const id = parsed.model.trim();
        if (!id) {
          return Response.json({ error: "ID model tidak boleh kosong." }, { status: 400 });
        }

        let chatIds: Set<string>;
        let imageIds: Set<string>;
        try {
          [chatIds, imageIds] = await Promise.all([
            fetchModelIds(modelsUrl(base), key),
            fetchModelIds(imageModelsUrl(base), key),
          ]);
        } catch {
          return Response.json({ error: "Could not reach that endpoint." }, { status: 502 });
        }

        if (chatIds.has(id)) return Response.json({ ok: true, id, type: "chat" as const });
        if (imageIds.has(id)) return Response.json({ ok: true, id, type: "image" as const });
        return Response.json(
          { error: `Model "${id}" tidak ditemukan di 9Router.` },
          { status: 404 },
        );
      },
    },
  },
});
