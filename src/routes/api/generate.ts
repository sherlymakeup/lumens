import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { chatCompletionsUrl } from "@/lib/safe-url";
import { clamp } from "@/lib/utils";

const Message = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().max(12_000),
});

const Body = z.object({
  messages: z.array(Message).min(1).max(24),
  stream: z.boolean().optional().default(true),
  connection: z.object({
    provider: z.enum(["custom"]),
    model: z.string().min(1).max(120),
  }),
  params: z.object({
    temperature: z.number(),
    maxTokens: z.number(),
    topP: z.number(),
    frequencyPenalty: z.number(),
    presencePenalty: z.number(),
  }),
});

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export const Route = createFileRoute("/api/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Invalid request." }, { status: 400 });
        }

        const { messages, stream, connection, params } = parsed.data;

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
          url = chatCompletionsUrl(base);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Invalid base URL." },
            { status: 500 },
          );
        }

        const payload = {
          model: connection.model,
          messages: messages.map((message) => ({
            role: message.role,
            content: message.content.slice(0, 8000),
          })),
          temperature: clamp(params.temperature, 0, 2),
          max_tokens: clamp(Math.round(params.maxTokens), 16, 4096),
          top_p: clamp(params.topP, 0, 1),
          frequency_penalty: clamp(params.frequencyPenalty, 0, 2),
          presence_penalty: clamp(params.presencePenalty, 0, 2),
          stream,
        };

        let upstream: Response;
        try {
          upstream = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "User-Agent": "lumens-proxy/1.0",
            },
            body: JSON.stringify(payload),
            // Timeout 60 dtk + tetap batal saat client disconnect
            signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
          });
        } catch (error) {
          if (request.signal.aborted) {
            return new Response(null, { status: 499 });
          }
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

        if (!stream) {
          const body = (await upstream.json().catch(() => null)) as {
            choices?: { message?: { content?: string } }[];
          } | null;
          const text = body?.choices?.[0]?.message?.content ?? "";
          if (!text) {
            return Response.json(
              { error: "Gateway returned an empty response." },
              { status: 502 },
            );
          }
          return Response.json({ text });
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const readable = new ReadableStream({
          async start(controller) {
            const reader = upstream.body?.getReader();
            if (!reader) {
              controller.enqueue(encoder.encode(sse({ error: "Empty stream." })));
              controller.close();
              return;
            }
            let buffer = "";
            let forwardedChars = 0;
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const raw of lines) {
                  const line = raw.trim();
                  if (!line.startsWith("data:")) continue;
                  const data = line.slice(5).trim();
                  if (!data) continue;
                  if (data === "[DONE]") {
                    controller.enqueue(encoder.encode(sse({ done: true })));
                    continue;
                  }
                  try {
                    const json = JSON.parse(data) as {
                      choices?: {
                        delta?: { content?: string; reasoning_content?: string };
                      }[];
                    };
                    const delta = json.choices?.[0]?.delta;
                    if (delta?.reasoning_content && !delta.content) {
                      controller.enqueue(encoder.encode(sse({ thinking: true })));
                    }
                    if (delta?.content) {
                      forwardedChars += delta.content.length;
                      controller.enqueue(encoder.encode(sse({ text: delta.content })));
                    }
                  } catch {
                    /* skip malformed chunk */
                  }
                }
              }
              if (forwardedChars === 0 && !request.signal.aborted) {
                controller.enqueue(
                  encoder.encode(sse({ error: "Gateway returned an empty response." })),
                );
              } else {
                controller.enqueue(encoder.encode(sse({ done: true })));
              }
              controller.close();
            } catch (error) {
              if (!request.signal.aborted) {
                const message = error instanceof Error ? error.message : "Stream interrupted.";
                controller.enqueue(encoder.encode(sse({ error: message })));
              }
              controller.close();
            }
          },
        });

        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
