import { createFileRoute } from "@tanstack/react-router";
import { modelsUrl, imageModelsUrl } from "@/lib/safe-url";

type ModelInfo = { id: string; owned_by: string };

export const Route = createFileRoute("/api/models")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Endpoint credentials live on the server (Vercel env) — never in the UI.
        const key = process.env.OPENAI_API_KEY?.trim() ?? "";
        const base = process.env.OPENAI_BASE_URL?.trim() ?? "";
        if (!key || !base) {
          return Response.json(
            { error: "Server misconfigured: set OPENAI_API_KEY and OPENAI_BASE_URL env vars." },
            { status: 503 },
          );
        }

        const type = new URL(request.url).searchParams.get("type") ?? "chat";
        if (type !== "chat" && type !== "image") {
          return Response.json(
            { error: 'Invalid type. Use "chat" or "image".' },
            { status: 400 },
          );
        }

        let url: string;
        try {
          url = type === "image" ? imageModelsUrl(base) : modelsUrl(base);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Invalid base URL." },
            { status: 500 },
          );
        }

        try {
          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${key}`,
              "User-Agent": "lumens-proxy/1.0",
            },
            signal: AbortSignal.timeout(12_000),
          });
          if (!response.ok) {
            // Surface the upstream reason (e.g. "invalid key" vs a block page)
            // so a 403 is debuggable from the UI toast.
            let detail = `Model list failed (${response.status})`;
            const text = await response.text().catch(() => "");
            if (text) {
              try {
                const errBody = JSON.parse(text) as {
                  error?: { message?: string } | string;
                };
                if (typeof errBody.error === "string") detail += `: ${errBody.error}`;
                else if (errBody.error?.message) detail += `: ${errBody.error.message}`;
                else detail += `: ${text.slice(0, 200)}`;
              } catch {
                detail += `: ${text.slice(0, 200)}`;
              }
            }
            return Response.json({ error: detail }, { status: 502 });
          }
          const body = (await response.json()) as {
            data?: { id?: string; owned_by?: string }[];
          };
          const models: ModelInfo[] = (body.data ?? [])
            .map((item) => ({ id: item.id ?? "", owned_by: item.owned_by ?? "" }))
            .filter((model) => Boolean(model.id))
            .slice(0, 80);
          return Response.json({ models });
        } catch {
          return Response.json({ error: "Could not reach that endpoint." }, { status: 502 });
        }
      },
    },
  },
});
