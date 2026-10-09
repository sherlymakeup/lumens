import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Novita } from "novita-sandbox";
import { chatCompletionsUrl } from "@/lib/safe-url";
import { runImageGeneration, runWebRead, runWebSearch } from "@/lib/agent-tools";
import { deleteMemory, memoryEnv, saveMemory, searchMemories } from "@/lib/agent-memory";
import { runLearningLoop } from "@/lib/agent-learning.ts";
import { fetchSandboxFile } from "@/lib/agent-files";
import {
  DEFAULT_COMMAND_TIMEOUT_MS,
  MAX_COMMAND_TIMEOUT_MS,
  SandboxSession,
  type SandboxLike,
} from "@/lib/agent-sandbox";
import { normalizePlanSteps } from "@/lib/agent-plan";
import { clamp } from "@/lib/utils";
import {
  attachmentNote,
  buildVisionParts,
  isImageMime,
  readImageBase64,
  type ContentPart,
  type UploadAttachment,
} from "@/lib/agent-upload";
import {
  buildConnectorFunctionTools,
  connectorSlug,
  executeConnectorTool,
  parseToolFunctionName,
  type ConnectorRecord,
} from "@/lib/agent-connectors.ts";
import {
  connectionEnv,
  listEnabledConnectionsFull,
} from "@/lib/agent-connections-db.ts";
import {
  getThread,
  threadEnv,
  touchThread,
  upsertThread,
} from "@/lib/agent-threads-db.ts";
import { isValidThreadRef, threadWorkdir, normalizeWorkdirPaths } from "@/lib/thread.ts";
import { verifyAuth, getServiceClient } from "@/lib/auth-server.ts";
import { runSubagent } from "@/lib/agent-subagent.ts";

const Message = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().max(12_000),
});

const Attachment = z.object({
  name: z.string().min(1).max(120),
  path: z.string().min(1).max(220),
  mime: z.string().max(120).default(""),
  size: z.number().int().min(0).max(100 * 1024 * 1024),
});

const Body = z.object({
  messages: z.array(Message).min(1).max(24),
  sandboxId: z.string().min(1).max(120).optional(),
  threadId: z.string().min(1).max(80).optional(),
  attachments: z.array(Attachment).max(5).optional(),
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

// Idle timeout per sandbox session: 5 minutes, refreshed on every use
// (see SANDBOX_IDLE_MS in @/lib/agent-sandbox).
const MAX_OUTPUT = 8_000;
const MAX_ITERATIONS = 15;
// Fase C: batas subagent paralel.
const MAX_PARALLEL_SUBAGENTS = 3;
const SUBAGENT_TIMEOUT_MS = 90_000;

const AGENT_SYSTEM = `You are an AI agent with direct access to a Linux sandbox (Debian 12, 2 CPU, ~512MB RAM).
You have three tools:
- sandbox_exec: run shell commands in the sandbox (compute, files, code, installs).
- web_search: search the live web when the user asks about current events, recent facts, or anything beyond your knowledge.
- generate_image: create an image from a text prompt. It automatically uses the Gemini image model — the user's chat model stays untouched, so you don't need to switch anything.

Intent classification (automatic — there are no modes to pick; YOU decide):
Read the user's message and adapt your behavior to the intent:
- Writing/prose → produce complete, well-structured prose in markdown. Lead with the piece itself — no preamble about what you will do. Prefer concrete language over hype.
- Email → write a ready-to-send email with a subject line. Human and specific, no padded greetings.
- Rewrite → return only the rewritten text. Preserve meaning, names, and facts; improve rhythm and clarity.
- Summarize → extract the load-bearing points: short headline, then bullets or a tight paragraph. Never invent facts.
- Translate → natural translation in the target language (default: the user's language). Preserve tone and proper nouns; translate idioms by meaning.
- Code → correct, minimal code in fenced blocks with a language tag. Explain only what's necessary; call out edge cases. EXCEPTION: if the user asks for the file to be sent/delivered (kirim, download, "dalam bentuk .xxx", "kirim filenya"), do NOT just paste code — create the file via sandbox_exec and deliver it via read_file (see "Files for the user" below).
- Explain/teach → one-sentence version first, then the mechanism, then a concrete example.
- Ideas/brainstorm → distinct options (not near-duplicates), grouped; mark 1–2 you'd actually ship and say why.
- Social copy → post-ready text matching the platform's rhythm; no hashtag spam or engagement bait.
- Task/execution → USE sandbox_exec, verify the result, then summarize.
When the intent is ambiguous, prefer the most useful interpretation and say what you assumed in one line.

Working directory policy (isolated per conversation thread):
- Your working directory is ~/workspace/<thread> — every sandbox_exec starts there, and all relative paths (including uploads/ and read_file paths) resolve inside it.
- Do ALL your file work inside the working directory. Never write outside it except /tmp.
- /tmp is only for ephemeral files (temporary code execution, scratch downloads). Anything the user should keep goes in the working directory.

Rules:
- When the user asks you to compute, inspect, create, run, or verify something with the computer, USE sandbox_exec — don't just describe what to do.
- NEVER write "I will continue", "please wait", "mohon tunggu", or any "next steps" narration INSTEAD of acting. If the task isn't done, keep calling tools — do not output a status update and stop. Only write your final summary when the task is 100% complete and all files are delivered via read_file.
- A task is NOT done until: files the user asked for are created AND delivered (read_file called, download card shown), commands are verified, and the summary is written. Partial work with "I'll continue later" is a failure.
- Long commands need a generous timeoutMs: installs/downloads/builds can take minutes — set 180000-300000 for those. If a command times out, retry with a bigger timeoutMs or split the work into smaller steps.
- The sandbox auto-refreshes before Novita's 1-hour limit; if you see a note that it was replaced, files from the old session are gone — recreate what you need and continue the plan.
- If the user asks to resend a file and it's missing (sandbox was replaced): DO NOT give up. Recreate the file from the conversation history — the commands you used to build it are in your previous tool calls. Rebuild it, verify it exists with ls, then deliver it via read_file.
- Paths: your working directory is ~/workspace/<thread> — every sandbox_exec starts there. Use RELATIVE paths (e.g. "netcheck/netcheck.zip") or the full ~/workspace/<thread>/... path. Never use ~/workspace/<something-else>.
- When the user asks you to draw/create/make an image or picture, USE generate_image with a detailed English prompt.
- When the user asks about news, prices, schedules, or recent events, USE web_search first.
- web_search returns short snippets with URLs. When a snippet isn't enough,
  use web_read on the 1-3 most relevant URLs to read the full page. Don't
  read every result — pick the ones most likely to answer.
- Keep commands focused and check their output before the next step.
- The sandbox persists for this conversation (files you create stay available), with a 5-minute idle timeout.
- Attached files: when the user attaches files, their sandbox paths are listed
  in the message. Read/edit/analyze them with sandbox_exec — they are already
  on disk. Attached images are ALSO visible to you directly (vision): describe
  or analyze what you see, and use sandbox_exec only if the user asks you to
  edit/transform the image.
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

Subagents (parallel delegation):
- Use spawn_subagent for independent subtasks that can run in parallel
  (research, parallel computations, exploring alternatives).
- You may spawn up to 3 per turn — issue them in ONE turn so they run in parallel.
- Pick a template when it fits: "research" for web research, "data-processor"
  for data transform/analysis, "file-worker" for creating/executing files,
  "integration" for calling external HTTP APIs. Omit for general tasks.
- Each subagent gets a FRESH sandbox and its own working directory; it cannot
  see your files or spawn further subagents. Pass everything it needs in the
  task/context fields.
- Subagent results come back as short summaries — keep delegated tasks
  self-contained with clear done criteria.
- Do NOT delegate when the task is trivial or strictly sequential.
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
            description:
              "Max time to wait for the command in ms (default 60000, max 600000). Set generously for installs, downloads, and builds (e.g. 300000).",
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
      name: "spawn_subagent",
      description:
        "Delegate a self-contained subtask to a parallel subagent. Each subagent gets its OWN fresh sandbox and working directory, runs independently (max 5 steps), and reports back a concise summary. Use for parallelizable work: independent research, parallel computations, or exploring alternatives. You can spawn up to 3 per turn — they run in PARALLEL. Optionally pick a specialized template: research (web research, structured findings), data-processor (transform/analyze data with code), file-worker (create/execute files), integration (call external HTTP APIs).",
      parameters: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description:
              "The task for the subagent — self-contained, specific, with clear done criteria. E.g. \"Research current EV prices in Jakarta from 3 sources and summarize in a table.\"",
          },
          context: {
            type: "string",
            description:
              "Optional background the subagent needs (it does NOT see this conversation). Keep it short.",
          },
          template: {
            type: "string",
            enum: ["research", "data-processor", "file-worker", "integration"],
            description:
              "Optional specialized template that shapes the subagent's instructions, allowed tools, and output format. Omit for a general-purpose subagent.",
          },
        },
        required: ["task"],
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

/** Ubah content multimodal jadi teks biasa (fallback kalau model menolak vision). */
function stripVisionParts(convo: ChatMsg[]): boolean {
  let stripped = false;
  for (const m of convo) {
    if (Array.isArray(m.content)) {
      const text = m.content
        .filter((p) => p.type === "text")
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("\n");
      m.content = `${text}\n\n[Catatan: model menolak input gambar — file gambar tetap tersedia di path sandbox pada pesan di atas, baca dengan sandbox_exec bila perlu.]`;
      stripped = true;
    }
  }
  return stripped;
}

type ChatMsg = {
  role: string;
  content: string | ContentPart[];
  tool_calls?: unknown;
  tool_call_id?: string;
};

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Invalid request." }, { status: 400 });
        }
        const { messages, connection, params, attachments } = parsed.data;
        let sandboxId: string | undefined = parsed.data.sandboxId;

        // Auth: verifikasi JWT, cek credits (admin unlimited).
        // Jika auth tidak dikonfigurasi (env kosong), izinkan tanpa batas (mode single-user).
        const userId = await verifyAuth(request);
        const sb = getServiceClient();
        const authConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
        if (authConfigured && !userId) {
          return Response.json({ error: "Unauthorized. Silakan login." }, { status: 401 });
        }
        if (userId && sb) {
          // Pastikan profile ada.
          await sb.from("profiles").upsert({ id: userId }, { onConflict: "id" });
          const { data: profile } = await sb
            .from("profiles")
            .select("credits, unlimited, role")
            .eq("id", userId)
            .single();
          // Admin otomatis unlimited.
          const isUnlimited =
            profile?.unlimited === true || profile?.role === "admin";
          if (!isUnlimited && (profile?.credits ?? 0) <= 0) {
            return Response.json(
              { error: "Kredit habis. Hubungi admin untuk top-up." },
              { status: 402 },
            );
          }
          // Simpan untuk deduct nanti.
          (request as any).__userId = userId;
          (request as any).__unlimited = isUnlimited;
          // Deduct 1 credit per panggilan (admin unlimited tidak dikurangi).
          if (!isUnlimited && profile) {
            await sb
              .from("profiles")
              .update({ credits: Math.max(0, (profile.credits ?? 1) - 1) })
              .eq("id", userId);
          }
        }

        // Thread registry (Fase A): resolve sandbox server-side dari threadId.
        // Prioritas: registry > sandboxId kiriman client (fallback stateless).
        const rawThreadId = parsed.data.threadId;
        const threadId = rawThreadId && isValidThreadRef(rawThreadId) ? rawThreadId : undefined;
        const tEnv = threadEnv();
        if (threadId && tEnv) {
          const got = await getThread(tEnv, threadId);
          if (got.ok && got.thread?.sandbox_id) {
            sandboxId = got.thread.sandbox_id;
          }
        }

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
            // Resilient sandbox session: auto-recreates before Novita's 1h
            // limit and retries once if the sandbox dies mid-command, so a
            // sandbox timeout never kills the agent stream.
            const novita = new Novita({ apiKey: novitaKey });
            const templateId = process.env.NOVITA_TEMPLATE_ID?.trim() || "base";
            const session = new SandboxSession(
              {
                sandbox: {
                  connect: (id) => novita.sandbox.connect(id) as Promise<SandboxLike>,
                  create: (opts) =>
                    novita.sandbox.create(opts) as Promise<SandboxLike>,
                },
              },
              templateId,
              Date.now,
              sandboxId,
              // Fase B: isolasi per-thread — semua command jalan di workdir thread.
              threadId ? threadWorkdir(threadId) : undefined,
            );

            // Konektor (Tasklet-style): load koneksi aktif + bangun function tools.
            // Secret hanya hidup di server — tidak pernah ke model/client.
            let connectorRows: (ConnectorRecord & { secret: string | null })[] = [];
            let connectorTools: ReturnType<typeof buildConnectorFunctionTools> = [];
            try {
              const loaded = await listEnabledConnectionsFull(connectionEnv());
              if (loaded.ok) {
                connectorRows = loaded.rows.map((r) => ({
                  id: r.id,
                  name: r.name,
                  kind: r.kind,
                  base_url: r.base_url,
                  auth_type: r.auth_type,
                  auth_name: r.auth_name,
                  tools: r.tools,
                  enabled: r.enabled,
                  secret: r.secret,
                }));
                connectorTools = buildConnectorFunctionTools(connectorRows);
              }
            } catch {
              /* konektor opsional — agent tetap jalan tanpanya */
            }
            const allTools = [...TOOLS, ...connectorTools];

            async function callModel(
              convo: ChatMsg[],
              withTools: boolean,
              toolsOverride?: unknown[],
            ): Promise<{
              content: string;
              toolCalls: { id: string; name: string; args: string }[];
            }> {
              const payload: Record<string, unknown> = {
                model: connection.model,
                messages: convo.map((m) => ({
                  role: m.role,
                  content: Array.isArray(m.content)
                    ? m.content.map((p) =>
                        p.type === "text" ? { ...p, text: p.text.slice(0, 8000) } : p,
                      )
                    : String(m.content ?? "").slice(0, 8000),
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
                payload.tools = toolsOverride ?? allTools;
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
                toolCalls: (msg?.tool_calls ?? [])
                  .map((tc, idx) => {
                    let id = tc.id;
                    if (!id) {
                      // Quirk: gateway/model kadang mengembalikan tool_call tanpa id.
                      // Upstream menolak tool message tanpa tool_call_id (400),
                      // jadi generate fallback agar id tetap konsisten & non-empty.
                      id = `call_fallback_${Date.now()}_${idx}`;
                      console.warn(`[agent] tool_call tanpa id dari model — pakai fallback ${id}`);
                    }
                    return {
                      id,
                      name: tc.function?.name ?? "",
                      args: tc.function?.arguments ?? "{}",
                    };
                  })
                  // Quirk: model kadang mengembalikan tool_call dengan function.name
                  // kosong. Tidak bisa dieksekusi & upstream menolaknya (400), jadi buang.
                  .filter((tc) => {
                    if (!tc.name.trim()) {
                      console.warn(`[agent] tool_call tanpa nama dari model — dibuang (${tc.id})`);
                      return false;
                    }
                    return true;
                  }),
              };
            }

            try {
              let systemPrompt = AGENT_SYSTEM;
              if (connectorRows.length > 0) {
                const lines = connectorRows.map((r) => {
                  const tools = (r.tools ?? []).map((t) => t.name).join(", ") || "—";
                  return `- ${r.name} (${r.kind}): ${tools}`;
                });
                systemPrompt += `\n\nKonektor aktif (panggil via tool konektor_<slug-nama>__<slug-tool>, huruf kecil tanpa spasi):
${lines.join("\n")}
Gunakan konektor ketika user meminta data/aksi dari layanan tersebut. Jangan pernah meminta atau menampilkan secret/API key — autentikasi sudah ditangani server.`;
              }
              const convo: ChatMsg[] = [
                { role: "system", content: systemPrompt },
                ...messages.map((m) => ({ role: m.role, content: m.content })),
              ];

              // Lampiran: tempel catatan path ke pesan user terakhir + vision untuk gambar.
              const atts = (attachments ?? []).filter(
                (a) => a.path.startsWith("uploads/") && !a.path.includes(".."),
              );
              if (atts.length > 0) {
                let uidx = convo.length - 1;
                while (uidx >= 0 && convo[uidx].role !== "user") uidx--;
                if (uidx >= 0) {
                  const notes = atts.map((a) => attachmentNote(a)).join("\n");
                  const base =
                    typeof convo[uidx].content === "string" ? convo[uidx].content : "";
                  const text = `${base}\n\nFile terlampir:\n${notes}`;
                  const images: { mime: string; base64: string }[] = [];
                  for (const a of atts) {
                    if (!isImageMime(a.mime)) continue;
                    const r = await readImageBase64(
                      (cmd) => session.run(cmd, 30_000),
                      a.path,
                    );
                    if (r.ok) images.push({ mime: a.mime, base64: r.base64 });
                  }
                  convo[uidx] = { ...convo[uidx], content: buildVisionParts(text, images) };
                }
              }

              let finalText = "";
              let toolsSupported = true;
              let visionFallback = false;
              // spawn_subagent dikumpulkan per-turn lalu dieksekusi paralel.
              const pendingSpawns: {
                id: string;
                task: string;
                context?: string;
                templateId?: "research" | "data-processor" | "file-worker" | "integration";
              }[] = [];

              for (let i = 0; i < MAX_ITERATIONS; i++) {
                let content = "";
                let toolCalls: { id: string; name: string; args: string }[] = [];
                try {
                  ({ content, toolCalls } = await callModel(convo, toolsSupported));
                } catch (error) {
                  const badRequest = /400/.test(String(error));
                  if (badRequest && toolsSupported) {
                    // Gateway may reject the tools param — retry once without tools.
                    toolsSupported = false;
                    ({ content, toolCalls } = await callModel(convo, false));
                  } else if (badRequest && !visionFallback && stripVisionParts(convo)) {
                    // Model menolak vision — coba lagi teks-only, file tetap di sandbox.
                    visionFallback = true;
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
                  // spawn_subagent: kumpulkan dulu, eksekusi paralel SETELAH loop tool lain.
                  if (tc.name === "spawn_subagent") {
                    const templateRaw = String(args.template ?? "").trim();
                    const templateId = (
                      ["research", "data-processor", "file-worker", "integration"] as const
                    ).includes(templateRaw as never)
                      ? (templateRaw as "research" | "data-processor" | "file-worker" | "integration")
                      : undefined;
                    pendingSpawns.push({
                      id: tc.id,
                      task: String(args.task ?? "").slice(0, 2000),
                      context: args.context ? String(args.context).slice(0, 2000) : undefined,
                      templateId,
                    });
                    continue;
                  }

                  if (tc.name === "sandbox_exec") {
                    let command = String(args.command ?? "").slice(0, 2000);
                    // Normalisasi path: cegah agent nyasar ke luar workdir thread.
                    command = normalizeWorkdirPaths(command, threadId);
                    let timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS;
                    if (args.timeoutMs) {
                      timeoutMs = clamp(
                        Math.round(Number(args.timeoutMs)),
                        1000,
                        MAX_COMMAND_TIMEOUT_MS,
                      );
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
                    let output: string;
                    let exitCode = 0;
                    try {
                      const result = await session.run(command, timeoutMs);
                      const notePrefix = result.note ? `[${result.note}]\n` : "";
                      output = clip(
                        `${notePrefix}$ ${command}\n${result.stdout ?? ""}${result.stderr ? `\n[stderr]\n${result.stderr}` : ""}`,
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
                    const rawPath = String(args.path ?? "").slice(0, 500);
                    // Normalisasi path yang sama agar konsisten dengan sandbox_exec.
                    const path = normalizeWorkdirPaths(rawPath, threadId);
                    send({ type: "tool_call", kind: "file", command: path });
                    const execFn = async (cmd: string) => {
                      const r = await session.run(cmd, DEFAULT_COMMAND_TIMEOUT_MS);
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
                  } else if (tc.name.startsWith("konektor_")) {
                    const parsed = parseToolFunctionName(tc.name);
                    const row = parsed
                      ? connectorRows.find((r) => connectorSlug(r.name) === parsed.connSlug)
                      : undefined;
                    send({
                      type: "tool_call",
                      kind: "sandbox",
                      command: `[konektor] ${row?.name ?? parsed?.connSlug ?? "?"} → ${parsed?.tool ?? tc.name}`,
                    });
                    if (!row) {
                      const output = `Konektor tidak ditemukan/aktif: ${tc.name}`;
                      send({ type: "tool_result", output, exitCode: 1 });
                      convo.push({ role: "tool", tool_call_id: tc.id, content: output });
                    } else {
                      const outcome = await executeConnectorTool(
                        row,
                        parsed!.tool,
                        args,
                        row.secret,
                      );
                      const output = clip(outcome.text);
                      send({ type: "tool_result", output, exitCode: outcome.ok ? 0 : 1 });
                      convo.push({ role: "tool", tool_call_id: tc.id, content: output });
                    }
                  } else {
                    convo.push({
                      role: "tool",
                      tool_call_id: tc.id,
                      content: `Unknown tool: ${tc.name}`,
                    });
                  }
                }
                // Fase C: eksekusi spawn_subagent yang terkumpul — paralel, maks 3.
                // Tiap subagent = child thread + SANDBOX FRESH (bukan warisan parent).
                if (pendingSpawns.length > 0) {
                  const batch = pendingSpawns.slice(0, MAX_PARALLEL_SUBAGENTS);
                  const skipped = pendingSpawns.length - batch.length;
                  const tavilyKey = process.env.TAVILY_API_KEY?.trim() || undefined;
                  const subResults = await Promise.all(
                    batch.map(async (sp) => {
                      if (!sp.task.trim()) {
                        return {
                          id: sp.id,
                          ok: false,
                          summary: "Task kosong — subagent tidak dijalankan.",
                          childThreadId: "",
                        };
                      }
                      send({
                        type: "tool_call",
                        kind: "subagent",
                        command: sp.task.slice(0, 120),
                      });
                      const subSignal = AbortSignal.any([
                        request.signal,
                        AbortSignal.timeout(SUBAGENT_TIMEOUT_MS),
                      ]);
                      const r = await runSubagent({
                        task: sp.task,
                        context: sp.context,
                        templateId: sp.templateId,
                        parentThreadId: threadId ?? "thr_unknown",
                        modelFn: async (messages, tools) => {
                          const out = await callModel(messages as ChatMsg[], true, tools);
                          return { content: out.content, toolCalls: out.toolCalls };
                        },
                        createSandbox: async (workdir) => {
                          const childSession = new SandboxSession(
                            {
                              sandbox: {
                                connect: (id) =>
                                  novita.sandbox.connect(id) as Promise<SandboxLike>,
                                create: (opts) =>
                                  novita.sandbox.create(opts) as Promise<SandboxLike>,
                              },
                            },
                            templateId,
                            Date.now,
                            undefined, // fresh — JANGAN warisi sandbox parent
                            workdir,
                          );
                          await childSession.ensure();
                          const sid = childSession.sandboxId;
                          if (!sid) throw new Error("Gagal membuat sandbox subagent.");
                          return {
                            sandboxId: sid,
                            run: async (cmd: string, timeoutMs: number) => {
                              const rr = await childSession.run(cmd, timeoutMs);
                              return {
                                stdout: rr.stdout ?? "",
                                stderr: rr.stderr ?? "",
                                exitCode: rr.exitCode ?? 0,
                              };
                            },
                            kill: async () => {
                              await novita.sandbox.kill(sid).catch(() => {});
                            },
                          };
                        },
                        registerThread: tEnv
                          ? async (input) => {
                              await upsertThread(tEnv, input).catch(() => {});
                            }
                          : undefined,
                        webSearch: async (query: string, maxResults?: number) =>
                          (await runWebSearch(query, tavilyKey, maxResults)).text,
                        webRead: async (url: string) =>
                          (await runWebRead(url, tavilyKey)).text,
                        signal: subSignal,
                      });
                      return { id: sp.id, ...r };
                    }),
                  );
                  for (const r of subResults) {
                    const output = r.ok
                      ? `[subagent ${r.childThreadId}] ${r.summary}`
                      : `[subagent gagal] ${r.summary}`;
                    send({ type: "tool_result", output: clip(output), exitCode: r.ok ? 0 : 1 });
                    convo.push({ role: "tool", tool_call_id: r.id, content: clip(output) });
                  }
                  if (skipped > 0) {
                    convo.push({
                      role: "user",
                      content: `Melewati ${skipped} spawn_subagent tambahan (maks ${MAX_PARALLEL_SUBAGENTS} paralel per turn).`,
                    });
                  }
                  pendingSpawns.length = 0;
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
              // Persist thread binding: sandboxId ↔ threadId di registry.
              // Best-effort — agent tetap jalan walau Supabase down.
              if (threadId && tEnv) {
                if (session.sandboxId) {
                  await upsertThread(tEnv, {
                    id: threadId,
                    sandbox_id: session.sandboxId,
                    workdir: threadWorkdir(threadId),
                  });
                } else {
                  await touchThread(tEnv, threadId);
                }
              }
              send({ type: "done", sandboxId: session.sandboxId });
              // P2: Learning loop — ekstrak learnings dari percakapan, simpan ke memory.
              // Fire-and-forget: tidak block respons ke user.
              try {
                const learningMessages = convo.map((m) => ({
                  role: m.role as string,
                  content: typeof m.content === "string" ? m.content : "",
                  toolCalls: ((m as { tool_calls?: { function: { name: string } }[] }).tool_calls ?? []).map((tc) => ({ name: tc.function.name })),
                }));
                void runLearningLoop(
                  learningMessages,
                  async (prompt: string) => {
                    const out = await callModel(
                      [{ role: "user", content: prompt }],
                      false,
                    );
                    return out.content;
                  },
                  memoryEnv(),
                ).catch(() => {});
              } catch {
                /* learning loop best-effort */
              }
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
