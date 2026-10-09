// Subagent paralel untuk agent utama.
// Tiap subagent = child thread (parent_id terisi) + SANDBOX FRESH + workdir
// sendiri. Depth maks 1: SUBAGENT_TOOLS tidak memuat spawn_subagent.
// Sandbox di-kill setelah selesai (hemat billing per-detik).
import { newThreadId, threadWorkdir } from "./thread.ts";
import { runWebRead, runWebSearch } from "./agent-tools.ts";
import { fetchSandboxFile } from "./agent-files.ts";

export const SUBAGENT_MAX_ITERATIONS = 5;
export const SUBAGENT_SUMMARY_CHARS = 2000;
const SUBAGENT_CLIP = 4000;

export type SubagentMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

export type SubagentToolCall = { id: string; name: string; args: string };

export type SubagentModelFn = (
  messages: SubagentMessage[],
  tools: unknown[],
) => Promise<{ content: string; toolCalls: SubagentToolCall[] }>;

export type SubagentSandbox = {
  sandboxId: string;
  run(
    cmd: string,
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  kill(): Promise<void>;
};

export type SubagentThreadInput = {
  id: string;
  parent_id: string;
  sandbox_id: string;
  workdir: string;
};

export const SUBAGENT_SYSTEM = `You are a focused subagent. You receive ONE task, do it with the tools below, and report back concisely.
Tools:
- sandbox_exec: run shell commands in YOUR OWN fresh Linux sandbox.
- web_search / web_read: live web research.
- read_file: read a file from your sandbox (for download delivery, same rule as the main agent).

Rules:
- Your working directory is set per task — all relative paths resolve there. /tmp is only for ephemeral files.
- You CANNOT spawn other subagents. If the task is too big, do the most valuable part and say what remains.
- Be concise: your whole output is summarized back to the main agent (max ~2000 chars kept).
- When done, write the result as plain text — no preamble about being a subagent.`;

function fnDef(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
) {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  };
}

/** Toolset subagent — SENGAJA tanpa spawn_subagent (depth 1). */
export const SUBAGENT_TOOLS = [
  fnDef(
    "sandbox_exec",
    "Run a shell command in your own fresh Linux sandbox. Output is clipped.",
    {
      command: { type: "string", description: "The shell command to run" },
      timeoutMs: { type: "number", description: "Max wait in ms (default 60000, max 120000)" },
    },
    ["command"],
  ),
  fnDef(
    "web_search",
    "Search the live web. Returns compact snippets with source URLs.",
    {
      query: { type: "string", description: "The search query" },
      maxResults: { type: "number", description: "How many results (default 5, max 8)" },
    },
    ["query"],
  ),
  fnDef(
    "web_read",
    "Read the full text of a public web page (max ~6000 chars).",
    { url: { type: "string", description: "https URL to read" } },
    ["url"],
  ),
  fnDef(
    "read_file",
    "Read a file from your sandbox so it can be delivered as a download.",
    { path: { type: "string", description: "Relative path in your working directory" } },
    ["path"],
  ),
];

function clip(text: string, max = SUBAGENT_CLIP): string {
  return text.length > max ? text.slice(0, max) + "\n…[output dipotong]" : text;
}

function parseArgs(args: string): Record<string, unknown> {
  try {
    return JSON.parse(args) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function dispatchSubagentTool(
  tc: SubagentToolCall,
  sandbox: SubagentSandbox,
  webSearch: (query: string, maxResults?: number) => Promise<string>,
  webRead: (url: string) => Promise<string>,
  onStep?: (text: string) => void,
): Promise<string> {
  const args = parseArgs(tc.args);
  switch (tc.name) {
    case "sandbox_exec": {
      const command = String(args.command ?? "").slice(0, 2000);
      if (!command.trim()) return "Empty command — nothing executed.";
      const timeoutMs = args.timeoutMs
        ? Math.min(120_000, Math.max(1000, Math.round(Number(args.timeoutMs))))
        : 60_000;
      onStep?.(`$ ${command.slice(0, 120)}`);
      const r = await sandbox.run(command, timeoutMs);
      return clip(`$ ${command}\n${r.stdout ?? ""}${r.stderr ? `\n[stderr]\n${r.stderr}` : ""}`);
    }
    case "web_search": {
      const query = String(args.query ?? "").slice(0, 500);
      const maxResults = args.maxResults
        ? Math.min(8, Math.max(1, Math.round(Number(args.maxResults))))
        : 5;
      onStep?.(`web: ${query.slice(0, 80)}`);
      return clip(await webSearch(query, maxResults));
    }
    case "web_read": {
      const url = String(args.url ?? "").slice(0, 2000);
      onStep?.(`read: ${url.slice(0, 80)}`);
      return clip(await webRead(url));
    }
    case "read_file": {
      const path = String(args.path ?? "").slice(0, 500);
      const execFn = async (cmd: string) => {
        const r = await sandbox.run(cmd, 30_000);
        return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", exitCode: r.exitCode ?? 0 };
      };
      const outcome = await fetchSandboxFile(execFn, path);
      return clip(outcome.text);
    }
    default:
      return `Unknown tool: ${tc.name}. Subagent tidak bisa spawn subagent lagi (depth maks 1).`;
  }
}

export type RunSubagentOpts = {
  task: string;
  context?: string;
  parentThreadId: string;
  modelFn: SubagentModelFn;
  createSandbox: (workdir: string) => Promise<SubagentSandbox>;
  registerThread?: (input: SubagentThreadInput) => Promise<void>;
  webSearch?: (query: string, maxResults?: number) => Promise<string>;
  webRead?: (url: string) => Promise<string>;
  maxIterations?: number;
  signal?: AbortSignal;
  onStep?: (text: string) => void;
};

export type SubagentResult = {
  ok: boolean;
  summary: string;
  childThreadId: string;
};

/**
 * Jalankan satu subagent: child thread + fresh sandbox + mini-loop.
 * Sandbox SELALU di-kill di finally (hemat billing).
 */
export async function runSubagent(opts: RunSubagentOpts): Promise<SubagentResult> {
  const childId = newThreadId();
  const workdir = threadWorkdir(childId);
  const webSearch =
    opts.webSearch ?? ((q, n) => runWebSearch(q, undefined, n).then((o) => o.text));
  const webRead = opts.webRead ?? ((u) => runWebRead(u, undefined).then((o) => o.text));

  let sandbox: SubagentSandbox;
  try {
    sandbox = await opts.createSandbox(workdir);
  } catch (error) {
    return {
      ok: false,
      summary: `Gagal membuat sandbox subagent: ${error instanceof Error ? error.message : String(error)}`,
      childThreadId: childId,
    };
  }

  try {
    try {
      await opts.registerThread?.({
        id: childId,
        parent_id: opts.parentThreadId,
        sandbox_id: sandbox.sandboxId,
        workdir,
      });
    } catch {
      /* registry best-effort */
    }

    const messages: SubagentMessage[] = [
      { role: "system", content: SUBAGENT_SYSTEM },
      {
        role: "user",
        content:
          `Task: ${opts.task}` +
          (opts.context ? `\n\nContext:\n${opts.context}` : "") +
          `\n\nWork in ${workdir}. Report back concisely.`,
      },
    ];
    const maxIter = opts.maxIterations ?? SUBAGENT_MAX_ITERATIONS;
    let lastContent = "";
    let hitLimit = false;

    for (let i = 0; i < maxIter; i++) {
      if (opts.signal?.aborted) {
        lastContent = "Subagent dibatalkan (timeout/signal).";
        break;
      }
      const { content, toolCalls } = await opts.modelFn(messages, SUBAGENT_TOOLS);
      lastContent = content;
      messages.push({
        role: "assistant",
        content,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.args },
        })),
      });
      if (toolCalls.length === 0) break;
      if (i === maxIter - 1) {
        hitLimit = true;
        break;
      }
      for (const tc of toolCalls) {
        if (opts.signal?.aborted) break;
        const output = await dispatchSubagentTool(tc, sandbox, webSearch, webRead, opts.onStep);
        messages.push({ role: "tool", tool_call_id: tc.id, content: output });
      }
    }

    let summary = lastContent.slice(0, SUBAGENT_SUMMARY_CHARS);
    if (hitLimit) summary = `[mencapai batas ${maxIter} iterasi] ${summary}`;
    if (!summary.trim()) summary = "(subagent tidak menghasilkan teks)";
    return { ok: true, summary, childThreadId: childId };
  } catch (error) {
    return {
      ok: false,
      summary: `Subagent error: ${error instanceof Error ? error.message : String(error)}`.slice(
        0,
        SUBAGENT_SUMMARY_CHARS,
      ),
      childThreadId: childId,
    };
  } finally {
    await sandbox.kill().catch(() => {});
  }
}
