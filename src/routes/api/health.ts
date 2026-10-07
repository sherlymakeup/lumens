import { createFileRoute } from "@tanstack/react-router";
import { gatewayHealthUrl } from "@/lib/safe-url";

export const Route = createFileRoute("/api/health")({
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
          url = gatewayHealthUrl(base);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Invalid base URL." },
            { status: 500 },
          );
        }

        const started = Date.now();
        try {
          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${key}`,
              "User-Agent": "lumens-proxy/1.0",
            },
            signal: AbortSignal.timeout(12_000),
          });
          const latencyMs = Date.now() - started;
          if (!response.ok) {
            return Response.json(
              { error: `Health check failed (${response.status})` },
              { status: 502 },
            );
          }
          const body = (await response.json().catch(() => null)) as {
            ok?: boolean;
          } | null;
          if (!body?.ok) {
            return Response.json({ error: "Gateway reported unhealthy." }, { status: 502 });
          }
          return Response.json({ ok: true, latencyMs });
        } catch {
          return Response.json({ error: "Could not reach that endpoint." }, { status: 502 });
        }
      },
    },
  },
});
