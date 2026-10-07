import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { imagesGenerationsUrl } from "@/lib/safe-url";

const Body = z.object({
  model: z.string().min(1).max(120),
  prompt: z.string().min(1).max(4000),
  size: z.enum(["1024x1024", "1024x1792", "1792x1024"]).optional(),
  n: z.number().int().min(1).max(4).optional().default(1),
});

// Image generation can take a while; Vercel may still cap execution time
// on some plans — the client should surface a timeout as a retryable error.
const UPSTREAM_TIMEOUT_MS = 120_000;

type GeneratedImage = { dataUrl: string; mime: string };

function sniffMime(b64: string): string {
  // PNG magic bytes -> "iVBOR", JPEG -> "/9j/"
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("iVBOR")) return "image/png";
  return "image/png";
}

async function toGeneratedImage(item: {
  b64_json?: string;
  url?: string;
}): Promise<GeneratedImage | null> {
  if (item.b64_json) {
    const mime = sniffMime(item.b64_json);
    return { dataUrl: `data:${mime};base64,${item.b64_json}`, mime };
  }
  if (item.url) {
    // Upstream URLs can expire or be unreachable from the browser,
    // so fetch server-side and embed as base64.
    const res = await fetch(item.url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    return { dataUrl: `data:${mime};base64,${buf.toString("base64")}`, mime };
  }
  return null;
}

export const Route = createFileRoute("/api/images")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Invalid request." }, { status: 400 });
        }
        const { model, prompt, size, n } = parsed.data;

        // Endpoint credentials live on the server (Vercel env) — never in the UI.
        const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
        const base = process.env.OPENAI_BASE_URL?.trim() ?? "";
        if (!apiKey || !base) {
          return Response.json(
            { error: "Server misconfigured: set OPENAI_API_KEY and OPENAI_BASE_URL env vars." },
            { status: 503 },
          );
        }

        let url: string;
        try {
          url = imagesGenerationsUrl(base);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Invalid base URL." },
            { status: 500 },
          );
        }

        let upstream: Response;
        try {
          upstream = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "User-Agent": "lumens-proxy/1.0",
            },
            body: JSON.stringify({
              model,
              prompt: prompt.slice(0, 4000),
              size,
              n,
              response_format: "b64_json",
            }),
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Could not reach the model." },
            { status: 502 },
          );
        }

        if (!upstream.ok) {
          let detail = `Provider error ${upstream.status}`;
          try {
            const errBody = (await upstream.json()) as {
              error?: { message?: string } | string;
            };
            if (typeof errBody.error === "string") detail = errBody.error;
            else if (errBody.error?.message) detail = errBody.error.message;
          } catch {
            const text = await upstream.text().catch(() => "");
            if (text) detail = text.slice(0, 280);
          }
          return Response.json({ error: detail }, { status: 502 });
        }

        const body = (await upstream.json().catch(() => null)) as {
          data?: { b64_json?: string; url?: string }[];
        } | null;
        const items = Array.isArray(body?.data) ? body.data.slice(0, n) : [];
        const images: GeneratedImage[] = [];
        for (const item of items) {
          const converted = await toGeneratedImage(item).catch(() => null);
          if (converted) images.push(converted);
        }
        if (!images.length) {
          return Response.json({ error: "The gateway returned no image." }, { status: 502 });
        }
        return Response.json({ images });
      },
    },
  },
});
