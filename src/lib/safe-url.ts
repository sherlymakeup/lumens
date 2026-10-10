const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

function isPrivateHostname(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return true;
  }
  const ipv4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  if (
    host.startsWith("fe80:") ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host === "::" ||
    host.startsWith("::ffff:")
  ) {
    return true;
  }
  return false;
}

export function normalizeBaseUrl(raw: string) {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Base URL is required.");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Base URL is not valid.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Base URL must use http or https.");
  }
  if (isPrivateHostname(parsed.hostname)) {
    throw new Error("That host is not allowed.");
  }
  return trimmed;
}

export function chatCompletionsUrl(baseUrl: string) {
  return `${normalizeBaseUrl(baseUrl)}/chat/completions`;
}

export function modelsUrl(baseUrl: string) {
  return `${normalizeBaseUrl(baseUrl)}/models`;
}

export function imageModelsUrl(baseUrl: string) {
  return `${normalizeBaseUrl(baseUrl)}/models/image`;
}

export function imagesGenerationsUrl(baseUrl: string) {
  return `${normalizeBaseUrl(baseUrl)}/images/generations`;
}

export function gatewayHealthUrl(baseUrl: string) {
  // Health lives at the gateway origin, not under /v1.
  const base = normalizeBaseUrl(baseUrl).replace(/\/v1$/, "");
  return `${base}/api/health`;
}
