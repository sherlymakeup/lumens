import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Novita, type Sandbox } from "novita-sandbox";
import { chatCompletionsUrl } from "@/lib/safe-url";
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
You have a tool called sandbox_exec that runs shell commands in that sandbox.

Rules:
- When the user asks you to compute, inspect, create, run, or verify something with the computer, USE the tool — don't just describe what to do.
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
                sandbox = await novita.sandbox.create({ timeoutMs: SESSION_IDLE_MS });
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
                  if (tc.name !== "sandbox_exec") {
                    convo.push({
                      role: "tool",
                      tool_call_id: tc.id,
                      content: `Unknown tool: ${tc.name}`,
                    });
                    continue;
                  }
                  let command = "";
                  let timeoutMs = 30_000;
                  try {
                    const args = JSON.parse(tc.args) as {
                      command?: string;
                      timeoutMs?: number;
                    };
                    command = String(args.command ?? "").slice(0, 2000);
                    if (args.timeoutMs) timeoutMs = clamp(Math.round(args.timeoutMs), 1000, 120_000);
                  } catch {
                    /* keep defaults */
                  }
                  if (!command.trim()) {
                    convo.push({
                      role: "tool",
                      tool_call_id: tc.id,
                      content: "Empty command — nothing executed.",
                    });
                    continue;
                  }
                  send({ type: "tool_call", command });
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
                    output = clip(`$ ${command}\n[error] ${error instanceof Error ? error.message : String(error)}`);
                    exitCode = 1;
                  }
                  send({ type: "tool_result", output, exitCode });
                  convo.push({ role: "tool", tool_call_id: tc.id, content: output });
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
