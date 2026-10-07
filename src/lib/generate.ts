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

export async function fetchModels() {
  const response = await fetch("/api/models", { method: "GET" });
  const body = (await response.json()) as { models?: string[]; error?: string };
  if (!response.ok) throw new Error(body.error ?? "Could not list models");
  return body.models ?? [];
}
