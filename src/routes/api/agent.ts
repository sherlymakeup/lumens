import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Novita, type Sandbox } from "novita-sandbox";
import { chatCompletionsUrl } from "@/lib/safe-url";
import { runImageGeneration, runWebSearch } from "@/lib/agent-tools";
import { clamp } from "@/lib/utils";

const Message = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().max(12_000),
});

const Body = z.object({
  messages: z.array(Message).min(1).max(24),
  sandboxId: z.string().min(1).max(120).optional(),
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

// Idle timeout per sandbox session: 5 minutes, refreshed on every use.
const SESSION_IDLE_MS = 300_000;
const MAX_OUTPUT = 8_000;
const MAX_ITERATIONS = 6;

const AGENT_SYSTEM = `You are an AI agent with direct access to a Linux sandbox (Debian 12, 2 CPU, ~512MB RAM).
You have three tools:
- sandbox_exec: run shell commands in the sandbox (compute, files, code, installs).
- web_search: search the live web when the user asks about current events, recent facts, or anything beyond your knowledge.
- generate_image: create an image from a text prompt. It automatically uses the Gemini image model — the user's chat model stays untouched, so you don't need to switch anything.

Rules:
- When the user asks you to compute, inspect, create, run, or verify something with the computer, USE sandbox_exec — don't just describe what to do.
- When the user asks you to draw/create/make an image or picture, USE generate_image with a detailed English prompt.
- When the user asks about news, prices, schedules, or recent events, USE web_search first.
- Keep commands focused and check their output before the next step.
- The sandbox persists for this conversation (files you create stay available), with a 5-minute idle timeout.
- Never exfiltrate secrets: there are none in the sandbox; don't go looking for any.
- If a command fails, read the error and try a corrected approach (max 3 attempts per task) before summarizing.
- Always give a final summary in the user's language after using tools.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "sandbox_exec",
      description:
        "Run a shell command in the user's Linux sandbox (Debian 12). Use for computing, inspecting/creating files, running code (python3, node), installing packages, etc. Output is clipped.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to run, e.g. \"python3 -c 'print(2**10)'\"",
          },
          timeoutMs: {
            type: "number",
            description: "Max time to wait for the command (default 30000, max 120000)",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the live web for current events, recent facts, prices, schedules, or anything beyond the model's knowledge. Returns compact snippets with source URLs.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          maxResults: { type: "number", description: "How many results (default 5, max 8)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description:
        "Generate an image from a text prompt. Automatically uses the Gemini image model; the user's chat model is not changed. The image is shown to the user directly.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Detailed image description, preferably in English",
          },
          ratio: {
            type: "string",
            enum: ["1:1", "16:9", "9:16"],
            description: "Aspect ratio (default 1:1)",
          },
        },
        required: ["prompt"],
      },
    },
  },
];

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function clip(text: string): string {
  return text.length > MAX_OUTPUT ? text.slice(0, MAX_OUTPUT) + "\n…[output dipotong]" : text;
}

type ChatMsg = { role: string; content: string; tool_calls?: unknown; tool_call_id?: string };

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Invalid request." }, { status: 400 });
        }
        const { messages, connection, params } = parsed.data;
        let sandboxId: string | undefined = parsed.data.sandboxId;

        const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
        const base = process.env.OPENAI_BASE_URL?.trim() ?? "";
        const novitaKey = process.env.NOVITA_API_KEY?.trim() ?? "";
        if (!apiKey || !base) {
          return Response.json(
            { error: "Server misconfigured: set OPENAI_API_KEY and OPENAI_BASE_URL env vars." },
            { status: 503 },
          );
        }
        if (!novitaKey) {
          return Response.json(
            { error: "Sandbox belum dikonfigurasi: set NOVITA_API_KEY di environment server." },
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

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (data: unknown) =>
              controller.enqueue(encoder.encode(sse(data)));
            let sandbox: Sandbox | null = null;

            async function ensureSandbox(): Promise<Sandbox> {
              if (sandbox) return sandbox;
              const novita = new Novita({ apiKey: novitaKey });
              if (sandboxId) {
                try {
                  sandbox = await novita.sandbox.connect(sandboxId);
                } catch {
                  sandbox = null;
                  sandboxId = undefined;
                }
              }
              if (!sandbox) {
                // Template ID is configurable via NOVITA_TEMPLATE_ID so the
                // account owner can point at a bigger template (e.g. 2GB RAM).
                // The SDK binds CPU/RAM to the template — there is no
                // per-create memory option. Default "base" = 2 CPU / 512MB.
                const templateId = process.env.NOVITA_TEMPLATE_ID?.trim() || "base";
                sandbox = await novita.sandbox.create({
                  template: templateId,
                  timeoutMs: SESSION_IDLE_MS,
                });
                sandboxId = sandbox.sandboxId;
              }
              // Refresh the idle timeout on every use.
              await sandbox.setTimeout(SESSION_IDLE_MS).catch(() => {});
              return sandbox;
            }

            async function callModel(
              convo: ChatMsg[],
              withTools: boolean,
            ): Promise<{
              content: string;
              toolCalls: { id: string; name: string; args: string }[];
            }> {
              const payload: Record<string, unknown> = {
                model: connection.model,
                messages: convo.map((m) => ({
                  role: m.role,
                  content: String(m.content ?? "").slice(0, 8000),
                  ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
                  ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
                })),
                temperature: clamp(params.temperature, 0, 2),
                max_tokens: clamp(Math.round(params.maxTokens), 16, 4096),
                top_p: clamp(params.topP, 0, 1),
                frequency_penalty: clamp(params.frequencyPenalty, 0, 2),
                presence_penalty: clamp(params.presencePenalty, 0, 2),
                stream: false,
              };
              if (withTools) {
                payload.tools = TOOLS;
                payload.tool_choice = "auto";
              }
              const res = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                  "User-Agent": "lumens-proxy/1.0",
                },
                body: JSON.stringify(payload),
                signal: request.signal,
              });
              if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`Model error ${res.status}: ${text.slice(0, 200)}`);
              }
              const body = (await res.json()) as {
                choices?: {
                  message?: {
                    content?: string | null;
                    tool_calls?: {
                      id: string;
                      function?: { name?: string; arguments?: string };
                    }[];
                  };
                }[];
              };
              const msg = body.choices?.[0]?.message;
              return {
                content: msg?.content ?? "",
                toolCalls: (msg?.tool_calls ?? []).map((tc) => ({
                  id: tc.id,
                  name: tc.function?.name ?? "",
                  args: tc.function?.arguments ?? "{}",
                })),
              };
            }

            try {
              const convo: ChatMsg[] = [
                { role: "system", content: AGENT_SYSTEM },
                ...messages.map((m) => ({ role: m.role, content: m.content })),
              ];
              let finalText = "";
              let toolsSupported = true;

              for (let i = 0; i < MAX_ITERATIONS; i++) {
                let content = "";
                let toolCalls: { id: string; name: string; args: string }[] = [];
                try {
                  ({ content, toolCalls } = await callModel(convo, toolsSupported));
                } catch (error) {
                  // Gateway may reject the tools param — retry once without tools.
                  if (toolsSupported && /400/.test(String(error))) {
                    toolsSupported = false;
                    ({ content, toolCalls } = await callModel(convo, false));
                  } else {
                    throw error;
                  }
                }

                if (!toolCalls.length) {
                  finalText = content;
                  break;
                }
                convo.push({
                  role: "assistant",
                  content,
                  tool_calls: toolCalls.map((tc) => ({
                    id: tc.id,
                    type: "function",
                    function: { name: tc.name, arguments: tc.args },
                  })),
                });

                for (const tc of toolCalls) {
                  let args: Record<string, unknown> = {};
                  try {
                    args = JSON.parse(tc.args) as Record<string, unknown>;
                  } catch {
                    /* keep empty */
                  }

                  if (tc.name === "sandbox_exec") {
                    let command = String(args.command ?? "").slice(0, 2000);
                    let timeoutMs = 30_000;
                    if (args.timeoutMs) {
                      timeoutMs = clamp(Math.round(Number(args.timeoutMs)), 1000, 120_000);
                    }
                    if (!command.trim()) {
                      convo.push({
                        role: "tool",
                        tool_call_id: tc.id,
                        content: "Empty command — nothing executed.",
                      });
                      continue;
                    }
                    send({ type: "tool_call", kind: "sandbox", command });
                    const sb = await ensureSandbox();
                    let output: string;
                    let exitCode = 0;
                    try {
                      const result = await sb.commands.run(command, { timeoutMs });
                      output = clip(
                        `$ ${command}\n${result.stdout ?? ""}${result.stderr ? `\n[stderr]\n${result.stderr}` : ""}`,
                      );
                      exitCode = result.exitCode ?? 0;
                    } catch (error) {
                      output = clip(
                        `$ ${command}\n[error] ${error instanceof Error ? error.message : String(error)}`,
                      );
                      exitCode = 1;
                    }
                    send({ type: "tool_result", output, exitCode });
                    convo.push({ role: "tool", tool_call_id: tc.id, content: output });
                  } else if (tc.name === "web_search") {
                    const query = String(args.query ?? "").slice(0, 500);
                    const maxResults = args.maxResults
                      ? clamp(Math.round(Number(args.maxResults)), 1, 8)
                      : 5;
                    send({ type: "tool_call", kind: "search", command: query });
                    const outcome = await runWebSearch(
                      query,
                      process.env.TAVILY_API_KEY?.trim() || undefined,
                      maxResults,
                    );
                    const output = clip(outcome.text);
                    send({ type: "tool_result", output, exitCode: outcome.ok ? 0 : 1 });
                    convo.push({ role: "tool", tool_call_id: tc.id, content: output });
                  } else if (tc.name === "generate_image") {
                    const prompt = String(args.prompt ?? "").slice(0, 2000);
                    const ratio = ["1:1", "16:9", "9:16"].includes(String(args.ratio))
                      ? String(args.ratio)
                      : "1:1";
                    send({ type: "tool_call", kind: "image", command: prompt });
                    const outcome = await runImageGeneration({
                      prompt,
                      ratio,
                      gatewayBase: base,
                      gatewayKey: apiKey,
                    });
                    const output = clip(outcome.text);
                    send({
                      type: "tool_result",
                      output,
                      exitCode: outcome.ok ? 0 : 1,
                      images: outcome.images,
                    });
                    // The model can't see the pixels; tell it the image reached the user.
                    convo.push({
                      role: "tool",
                      tool_call_id: tc.id,
                      content: outcome.ok
                        ? `${output} (gambar sudah ditampilkan ke user)`
                        : output,
                    });
                  } else {
                    convo.push({
                      role: "tool",
                      tool_call_id: tc.id,
                      content: `Unknown tool: ${tc.name}`,
                    });
                  }
                }
                // If the model produced no text and only tool calls on the last
                // iteration, ask it to summarize.
                if (i === MAX_ITERATIONS - 1) {
                  convo.push({
                    role: "user",
                    content: "Ringkas hasil di atas untuk user.",
                  });
                  const last = await callModel(convo, false);
                  finalText = last.content;
                }
              }

              // Stream the final answer in chunks for a live feel.
              const CHUNK = 60;
              for (let p = 0; p < finalText.length; p += CHUNK) {
                if (request.signal.aborted) break;
                send({ type: "text", delta: finalText.slice(p, p + CHUNK) });
              }
              send({ type: "done", sandboxId });
            } catch (error) {
              if (!request.signal.aborted) {
                send({
                  type: "error",
                  error: error instanceof Error ? error.message : "Agent failed.",
                });
              }
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
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
