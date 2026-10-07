import { createFileRoute } from "@tanstack/react-router";
import { modelsUrl } from "@/lib/safe-url";

export const Route = createFileRoute("/api/models")({
  server: {
    handlers: {
      GET: async () => {
        // Endpoint credentials live on the server (Vercel env) — never in the UI.
        const key = process.env.OPENAI_API_KEY?.trim() ?? "";
        const base = process.env.OPENAI_BASE_URL?.trim() ?? "";
        if (!key || !base) {
          return Response.json(
            { error: "Server misconfigured: set OPENAI_API_KEY and OPENAI_BASE_URL env vars." },
            { status: 503 },
          );
        }

        let url: string;
        try {
          url = modelsUrl(base);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Invalid base URL." },
            { status: 500 },
          );
        }

        try {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${key}` },
            signal: AbortSignal.timeout(12_000),
          });
          if (!response.ok) {
            return Response.json(
              { error: `Model list failed (${response.status}).` },
              { status: 502 },
            );
          }
          const body = (await response.json()) as { data?: { id?: string }[] };
          const models = (body.data ?? [])
            .map((item) => item.id)
            .filter((id): id is string => Boolean(id))
            .slice(0, 80);
          return Response.json({ models });
        } catch {
          return Response.json({ error: "Could not reach that endpoint." }, { status: 502 });
        }
      },
    },
  },
});
