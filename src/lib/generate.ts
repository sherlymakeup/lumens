import type { GenerateRequest } from "./types";

export type StreamHandlers = {
  onDelta: (text: string) => void;
  onThinking?: () => void;
  onDone: () => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
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

  const decoder = new TextDecoder();
  let buffer = "";
  let failed = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = parseSseBuffer(buffer, (payload) => {
      if (payload === "[DONE]" || failed) return;
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
        if (json.thinking) handlers.onThinking?.();
        if (json.text) handlers.onDelta(json.text);
      } catch {
        /* ignore malformed chunks */
      }
    });
  }

  if (!failed) handlers.onDone();
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
  const response = await fetch("/api/images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      size: input.size,
      n: input.n ?? 1,
    }),
  });
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
