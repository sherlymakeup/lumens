import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Novita, type Sandbox } from "novita-sandbox";
import { chatCompletionsUrl } from "@/lib/safe-url";
import { runImageGeneration, runWebRead, runWebSearch } from "@/lib/agent-tools";
import { deleteMemory, memoryEnv, saveMemory, searchMemories } from "@/lib/agent-memory";
import { fetchSandboxFile } from "@/lib/agent-files";
import { normalizePlanSteps } from "@/lib/agent-plan";
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
const MAX_ITERATIONS = 10;

const AGENT_SYSTEM = `You are an AI agent with direct access to a Linux sandbox (Debian 12, 2 CPU, ~512MB RAM).
You have three tools:
- sandbox_exec: run shell commands in the sandbox (compute, files, code, installs).
- web_search: search the live web when the user asks about current events, recent facts, or anything beyond your knowledge.
- generate_image: create an image from a text prompt. It automatically uses the Gemini image model — the user's chat model stays untouched, so you don't need to switch anything.

Rules:
- When the user asks you to compute, inspect, create, run, or verify something with the computer, USE sandbox_exec — don't just describe what to do.
- When the user asks you to draw/create/make an image or picture, USE generate_image with a detailed English prompt.
- When the user asks about news, prices, schedules, or recent events, USE web_search first.
- web_search returns short snippets with URLs. When a snippet isn't enough,
  use web_read on the 1-3 most relevant URLs to read the full page. Don't
  read every result — pick the ones most likely to answer.
- Keep commands focused and check their output before the next step.
- The sandbox persists for this conversation (files you create stay available), with a 5-minute idle timeout.
- Never exfiltrate secrets: there are none in the sandbox; don't go looking for any.
- If a command fails, read the error and try a corrected approach (max 3 attempts per task) before summarizing.
- Always give a final summary in the user's language after using tools.

Memory (long-term, across conversations):
- You have memory_search, memory_save, memory_delete. Use them — a smart
  assistant remembers its user.
- SEARCH memory when the user refers to past work ("seperti biasa", "yang
  kemarin"), states a preference, or asks something that past context could
  answer. Don't search for one-off factual questions.
- SAVE only durable facts: the user's name, preferences, decisions, ongoing
  projects, corrections ("jangan ingat X" → delete it). Never save trivial
  chit-chat, one-time requests, or secrets.
- Before saving, consider a quick memory_search to avoid duplicates.
- If the user corrects a remembered fact, memory_delete the old one and save
  the new one.

Files for the user:
- When the user asks for a document, report, script, or any downloadable
  file: create it in the sandbox with sandbox_exec, then call read_file with
  its path. The file is delivered to the user as a download card — don't
  paste the whole file content into chat.
- Prefer read_file over dumping long file contents as text.

Planning (for tasks with more than 2 steps):
- Call set_plan FIRST with your step list before doing anything else.
- Call set_plan again to update statuses as steps complete (in_progress → done).
- Verify the final result before declaring done. If a step fails, revise the
  plan instead of silently skipping it.
`;

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
      name: "web_read",
      description:
        "Read the full text content of a web page (https URL, usually from web_search results). Use when a search snippet isn't enough.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The https URL of the page to read",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "memory_search",
      description:
        "Search the agent's long-term memory for facts about the user, past preferences, decisions, and projects. Use when past context could help answer.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to look for, e.g. \"kopi\" or \"project\" " },
          limit: { type: "number", description: "Max results (default 5)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "memory_save",
      description:
        "Save a durable fact to long-term memory: user preferences, decisions, names, ongoing projects, corrections. Never save trivial chit-chat or secrets.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "One clear fact, e.g. \"User lebih suka jawaban singkat dalam Bahasa Indonesia.\"",
          },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "memory_delete",
      description:
        "Delete a memory by its id (from memory_search results), e.g. when the user corrects or retracts a fact.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The memory id to delete" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_plan",
      description:
        "Write or update your own step-by-step plan. Call first for multi-step tasks, then again to update step statuses as work progresses.",
      parameters: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            description: "Ordered steps, each with text and status",
            items: {
              type: "object",
              properties: {
                text: { type: "string", description: "Short step description" },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "done"],
                },
              },
              required: ["text"],
            },
          },
        },
        required: ["steps"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Fetch a file from the sandbox and deliver it to the user as a download. Create the file first with sandbox_exec, then call this with its relative path.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path of the file in the sandbox, e.g. \"laporan.md\"",
          },
        },
        required: ["path"],
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
                  } else if (tc.name === "web_read") {
                    const url = String(args.url ?? "").slice(0, 2000);
                    send({ type: "tool_call", kind: "search", command: url });
                    const outcome = await runWebRead(
                      url,
                      process.env.TAVILY_API_KEY?.trim() || undefined,
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
                  } else if (tc.name === "memory_search") {
                    const query = String(args.query ?? "").slice(0, 300);
                    const limit = args.limit
                      ? clamp(Math.round(Number(args.limit)), 1, 10)
                      : 5;
                    send({ type: "tool_call", kind: "memory", command: query });
                    const outcome = await searchMemories(query, memoryEnv(), limit);
                    const output = clip(outcome.text);
                    send({ type: "tool_result", output, exitCode: outcome.ok ? 0 : 1 });
                    convo.push({ role: "tool", tool_call_id: tc.id, content: output });
                  } else if (tc.name === "memory_save") {
                    const content = String(args.content ?? "").slice(0, 2000);
                    send({
                      type: "tool_call",
                      kind: "memory",
                      command: content.slice(0, 120),
                    });
                    const outcome = await saveMemory(content, memoryEnv());
                    const output = clip(outcome.text);
                    send({ type: "tool_result", output, exitCode: outcome.ok ? 0 : 1 });
                    convo.push({ role: "tool", tool_call_id: tc.id, content: output });
                  } else if (tc.name === "memory_delete") {
                    const id = String(args.id ?? "").slice(0, 60);
                    send({ type: "tool_call", kind: "memory", command: `hapus ${id}` });
                    const outcome = await deleteMemory(id, memoryEnv());
                    const output = clip(outcome.text);
                    send({ type: "tool_result", output, exitCode: outcome.ok ? 0 : 1 });
                    convo.push({ role: "tool", tool_call_id: tc.id, content: output });
                  } else if (tc.name === "set_plan") {
                    const steps = normalizePlanSteps(args.steps);
                    send({ type: "plan", steps });
                    const output = `Plan updated (${steps.length} steps).`;
                    send({ type: "tool_result", output, exitCode: 0 });
                    convo.push({ role: "tool", tool_call_id: tc.id, content: output });
                  } else if (tc.name === "read_file") {
                    const path = String(args.path ?? "").slice(0, 500);
                    send({ type: "tool_call", kind: "file", command: path });
                    const sb = await ensureSandbox();
                    const execFn = async (cmd: string) => {
                      const r = await sb.commands.run(cmd, { timeoutMs: 30_000 });
                      return {
                        stdout: r.stdout ?? "",
                        stderr: r.stderr ?? "",
                        exitCode: r.exitCode ?? 0,
                      };
                    };
                    const outcome = await fetchSandboxFile(execFn, path);
                    const output = clip(outcome.text);
                    send({
                      type: "tool_result",
                      output,
                      exitCode: outcome.ok ? 0 : 1,
                      files: outcome.file ? [outcome.file] : undefined,
                    });
                    convo.push({
                      role: "tool",
                      tool_call_id: tc.id,
                      content: outcome.ok
                        ? `${output} (file sudah dikirim ke user sebagai download)`
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
