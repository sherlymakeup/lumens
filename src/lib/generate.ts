import type { AgentFile, GenerateRequest } from "./types";
import type { PlanStep } from "./agent-plan";
import { getSupabase } from "./supabase-client";
import { getUnauthorizedHandler } from "./auth-utils";

/** Panggil handler 401 global (terdaftar oleh AuthProvider). */
async function notifyUnauthorized(): Promise<void> {
  const handler = getUnauthorizedHandler();
  if (handler) {
    await handler().catch(() => {});
  }
}

/** Ambil JWT untuk Authorization header (null jika auth tidak dikonfigurasi). */
async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const sb = getSupabase();
    if (!sb) return {};
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export type StreamStrings = {
  cancelled: string;
  interrupted: string;
  incomplete: string;
};

const FALLBACK_STREAM_STRINGS: StreamStrings = {
  cancelled: "Dibatalkan.",
  interrupted: "Stream terputus.",
  incomplete: "Respons tidak lengkap — koneksi terputus.",
};

export type StreamHandlers = {
  onDelta: (text: string) => void;
  onThinking?: () => void;
  onDone: () => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
  /** String lokal untuk pesan error (dari i18n di caller). Default: Indonesia. */
  strings?: StreamStrings;
};

function parseSseBuffer(buffer: string, onEvent: (payload: string) => void) {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    const line = part
      .split("\n")
      .filter((row) => row.startsWith("data:"))
      .map((row) => row.slice(5).trim())
      .join("");
    if (line) onEvent(line);
  }
  return rest;
}

export async function generateStream(request: GenerateRequest, handlers: StreamHandlers) {
  let response: Response;
  try {
    response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: handlers.signal,
    });
  } catch (error) {
    if (handlers.signal?.aborted) {
      handlers.onDone();
      return;
    }
    handlers.onError(error instanceof Error ? error.message : "Network error");
    return;
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) message = text.slice(0, 280);
    }
    // H3: 401 → coba refresh token; gagal → redirect /login.
    if (response.status === 401) {
      await notifyUnauthorized();
    }
    handlers.onError(message);
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!request.stream || !contentType.includes("text/event-stream")) {
    const body = (await response.json()) as { text?: string; error?: string };
    if (body.error) {
      handlers.onError(body.error);
      return;
    }
    if (body.text) handlers.onDelta(body.text);
    handlers.onDone();
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError("No response stream.");
    return;
  }

  const strs = handlers.strings ?? FALLBACK_STREAM_STRINGS;
  const decoder = new TextDecoder();
  let buffer = "";
  let failed = false;
  let doneReceived = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = parseSseBuffer(buffer, (payload) => {
        if (payload === "[DONE]") {
          doneReceived = true;
          return;
        }
        if (failed) return;
        try {
          const json = JSON.parse(payload) as {
            text?: string;
            done?: boolean;
            thinking?: boolean;
            error?: string;
          };
          if (json.error) {
            failed = true;
            handlers.onError(json.error);
            return;
          }
          if (json.done) doneReceived = true;
          if (json.thinking) handlers.onThinking?.();
          if (json.text) handlers.onDelta(json.text);
        } catch {
          /* ignore malformed chunks */
        }
      });
    }
  } catch {
    // Koneksi putus paksa (tab di-background, network drop) — jangan biarkan stuck.
    if (!failed) {
      handlers.onError(handlers.signal?.aborted ? strs.cancelled : strs.interrupted);
    }
    return;
  } finally {
    // Bebaskan koneksi HTTP meski loop berhenti lebih awal.
    reader.cancel().catch(() => {});
  }

  if (failed) return;
  // Stream berakhir tanpa event done/error = respons kepotong diam-diam.
  if (doneReceived) handlers.onDone();
  else handlers.onError(strs.incomplete);
}

export type AgentHandlers = {
  onText: (delta: string) => void;
  onToolCall: (command: string, kind?: string) => void;
  onToolResult: (
    output: string,
    exitCode: number,
    images?: string[],
    files?: AgentFile[],
    toolCallId?: string,
  ) => void;
  onPlan?: (steps: PlanStep[]) => void;
  onDone: (sandboxId?: string) => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
  /** String lokal untuk pesan error (dari i18n di caller). Default: Indonesia. */
  strings?: StreamStrings;
};

export function extractSystemAndFilterMessages(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
): {
  instructions: string | undefined;
  messages: { role: "user" | "assistant"; content: string }[];
} {
  const systemTexts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const filtered = messages.filter(
    (m): m is { role: "user" | "assistant"; content: string } => m.role !== "system",
  );
  const instructions = systemTexts.length > 0 ? systemTexts.join("\n\n") : undefined;
  return { instructions, messages: filtered };
}

export async function generateAgent(
  request: {
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    model: string;
    threadId?: string;
    sandboxId?: string;
    attachments?: { name: string; path: string; mime: string; size: number }[];
    params: {
      temperature: number;
      maxTokens: number;
      topP: number;
      frequencyPenalty: number;
      presencePenalty: number;
    };
  },
  handlers: AgentHandlers,
) {
  let response: Response;
  try {
    const authHeader = await getAuthHeader();
    const { instructions, messages } = extractSystemAndFilterMessages(request.messages);
    response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        messages,
        instructions,
        threadId: request.threadId,
        sandboxId: request.sandboxId,
        attachments: request.attachments,
        connection: { provider: "custom", model: request.model },
        params: request.params,
      }),
      signal: handlers.signal,
    });
  } catch (error) {
    if (handlers.signal?.aborted) {
      handlers.onDone(request.sandboxId);
      return;
    }
    handlers.onError(error instanceof Error ? error.message : "Network error");
    return;
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* keep default */
    }
    // H3: 401 → coba refresh token; gagal → redirect /login.
    if (response.status === 401) {
      await notifyUnauthorized();
    }
    handlers.onError(message);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError("No response stream.");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;
  const strs = handlers.strings ?? FALLBACK_STREAM_STRINGS;
  try {
    while (true) {
      const { done: readerDone, value } = await reader.read();
      if (readerDone) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = parseSseBuffer(buffer, (payload) => {
        if (payload === "[DONE]" || done) return;
        try {
          const json = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            kind?: string;
            command?: string;
            output?: string;
            exitCode?: number;
            images?: string[];
            files?: AgentFile[];
            steps?: PlanStep[];
            sandboxId?: string;
            toolCallId?: string;
            error?: string;
          };
          if (json.type === "text" && json.delta) handlers.onText(json.delta);
          else if (json.type === "tool_call") handlers.onToolCall(json.command ?? "", json.kind);
          else if (json.type === "tool_result")
            handlers.onToolResult(
              json.output ?? "",
              json.exitCode ?? 0,
              json.images,
              json.files,
              json.toolCallId,
            );
          else if (json.type === "plan" && Array.isArray(json.steps))
            handlers.onPlan?.(json.steps as PlanStep[]);
          else if (json.type === "done") {
            done = true;
            handlers.onDone(json.sandboxId);
          } else if (json.type === "error") {
            done = true;
            handlers.onError(json.error ?? "Agent failed.");
          }
        } catch {
          /* ignore malformed chunks */
        }
      });
      if (done) break;
    }
  } catch (error) {
    if (!done) {
      handlers.onError(
        handlers.signal?.aborted
          ? strs.cancelled
          : error instanceof Error
            ? error.message
            : strs.interrupted,
      );
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  if (!done) handlers.onDone(request.sandboxId);
}

export async function fetchModels(type: "chat" | "image" = "chat") {
  const response = await fetch(`/api/models?type=${type}`, { method: "GET" });
  const body = (await response.json()) as {
    models?: (string | { id?: string })[];
    error?: string;
  };
  if (!response.ok) throw new Error(body.error ?? "Could not list models");
  return (body.models ?? [])
    .map((model) => (typeof model === "string" ? model : model.id))
    .filter((id): id is string => Boolean(id));
}

export type HealthStatus = { ok: true; latencyMs: number };

export async function checkHealth(): Promise<HealthStatus> {
  const response = await fetch("/api/health", { method: "GET" });
  const body = (await response.json()) as { ok?: boolean; latencyMs?: number; error?: string };
  if (!response.ok || !body.ok) throw new Error(body.error ?? "Health check failed");
  return { ok: true, latencyMs: body.latencyMs ?? 0 };
}

export type GeneratedImage = { dataUrl: string; mime: string };

export async function generateImage(input: {
  model: string;
  prompt: string;
  size?: "1024x1024" | "1024x1792" | "1792x1024";
  n?: number;
}): Promise<GeneratedImage[]> {
  const model = input.model.trim();
  const prompt = input.prompt.trim();
  if (!model) throw new Error("Pilih model gambar dulu.");
  if (!prompt) throw new Error("Prompt gambar tidak boleh kosong.");
  let response: Response;
  try {
    response = await fetch("/api/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        size: input.size,
        n: input.n ?? 1,
      }),
      signal: AbortSignal.timeout(150_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("Waktu habis — gateway terlalu lama merespons. Coba lagi.");
    }
    throw new Error(error instanceof Error ? error.message : "Could not reach the server.");
  }
  const body = (await response.json()) as { images?: GeneratedImage[]; error?: string };
  if (!response.ok) throw new Error(body.error ?? "Image generation failed");
  return body.images ?? [];
}

export type ModelTestResult = { ok: true; id: string; type: "chat" | "image" };

export async function testModelConnection(model: string): Promise<ModelTestResult> {
  const id = model.trim();
  if (!id) throw new Error("ID model tidak boleh kosong.");
  const response = await fetch("/api/models-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: id }),
  });
  const body = (await response.json()) as {
    ok?: boolean;
    id?: string;
    type?: "chat" | "image";
    error?: string;
  };
  if (!response.ok || !body.ok) throw new Error(body.error ?? "Test koneksi model gagal.");
  return { ok: true, id: body.id ?? id, type: body.type ?? "chat" };
}

export type SandboxResult = { stdout: string; stderr: string; exitCode: number };

export async function runSandboxCommand(
  command: string,
  timeoutMs = 30_000,
): Promise<SandboxResult> {
  const cmd = command.trim();
  if (!cmd) throw new Error("Command sandbox tidak boleh kosong.");
  const response = await fetch("/api/sandbox/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command: cmd, timeoutMs }),
  });
  const body = (await response.json()) as {
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    error?: string;
  };
  if (!response.ok) throw new Error(body.error ?? "Sandbox execution failed.");
  return {
    stdout: body.stdout ?? "",
    stderr: body.stderr ?? "",
    exitCode: body.exitCode ?? 0,
  };
}
