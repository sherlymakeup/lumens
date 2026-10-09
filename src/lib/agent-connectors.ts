// Konektor v1: definisi tool + eksekusi server-side (HTTP generik & MCP).
// Pure helpers — aman di-test tanpa Supabase/network.
import { normalizeBaseUrl } from "./safe-url.ts";

export type ConnectorKind = "http" | "mcp";
export type AuthType = "none" | "bearer" | "header" | "query";

export type ConnectorParamDef = {
  type: "string" | "number" | "boolean";
  description?: string;
  required?: boolean;
};

export type ConnectorToolDef = {
  name: string;
  description: string;
  /** Untuk kind=http: method HTTP. Untuk kind=mcp: "MCP" (discovery). */
  method: string;
  path: string;
  params?: Record<string, ConnectorParamDef>;
};

export type ConnectorRecord = {
  id: string;
  name: string;
  kind: ConnectorKind;
  base_url: string;
  auth_type: AuthType;
  auth_name?: string | null;
  /** Secret terdekripsi — hanya ada di server, jangan pernah ke client/model. */
  auth_secret?: string | null;
  tools: ConnectorToolDef[];
  enabled: boolean;
};

export type FunctionTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description?: string }>;
      required: string[];
    };
  };
};

const TOOL_NAME_RE = /^[a-z0-9_-]{1,64}$/;

/** Slug aman untuk nama konektor/tool: huruf kecil, angka, dash. */
export function connectorSlug(name: string): string {
  const slug = String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return TOOL_NAME_RE.test(slug) && slug ? slug : "koneksi";
}

function toolSlug(name: string): string {
  const slug = String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return TOOL_NAME_RE.test(slug) ? slug : "";
}

/** Nama function tool: konektor_<slug-koneksi>__<slug-tool> */
export function toolFunctionName(
  conn: Pick<ConnectorRecord, "name">,
  toolName: string,
): string {
  return `konektor_${connectorSlug(conn.name)}__${toolSlug(toolName)}`;
}

export function parseToolFunctionName(name: string): {
  connSlug: string;
  tool: string;
} | null {
  const m = /^konektor_([a-z0-9-]{1,40})__([a-z0-9-]{1,40})$/.exec(String(name ?? ""));
  if (!m) return null;
  return { connSlug: m[1], tool: m[2] };
}

/** Bangun definisi function tools OpenAI dari koneksi yang aktif. */
export function buildConnectorFunctionTools(conns: ConnectorRecord[]): FunctionTool[] {
  const out: FunctionTool[] = [];
  for (const conn of conns) {
    if (!conn.enabled) continue;
    for (const tool of conn.tools ?? []) {
      const slug = toolSlug(tool.name);
      if (!slug) continue;
      const properties: Record<string, { type: string; description?: string }> = {};
      const required: string[] = [];
      for (const [pName, pDef] of Object.entries(tool.params ?? {})) {
        properties[pName] = { type: pDef.type, description: pDef.description };
        if (pDef.required) required.push(pName);
      }
      out.push({
        type: "function",
        function: {
          name: toolFunctionName(conn, tool.name),
          description: `[Konektor: ${conn.name}] ${tool.description}`.slice(0, 500),
          parameters: { type: "object", properties, required },
        },
      });
    }
  }
  return out;
}

export type HttpCall = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
};

/**
 * Bangun HTTP request dari definisi tool + argumen model.
 * - {param} di path disubstitusi dari args (wajib ada).
 * - Sisa args yang terdaftar di schema: query string (GET/DELETE) atau JSON body.
 * - Argumen di luar schema DITOLAK (anti parameter injection).
 */
export function buildHttpCall(
  conn: Pick<ConnectorRecord, "base_url" | "auth_type" | "auth_name">,
  tool: ConnectorToolDef,
  args: Record<string, unknown>,
  secret: string | null | undefined,
): HttpCall {
  const schema = tool.params ?? {};
  const unknownKeys = Object.keys(args ?? {}).filter((k) => !(k in schema));
  if (unknownKeys.length > 0) {
    throw new Error(`Parameter tidak dikenal: ${unknownKeys.join(", ")}`);
  }
  for (const [pName, pDef] of Object.entries(schema)) {
    if (pDef.required && (args?.[pName] === undefined || args?.[pName] === null || args?.[pName] === "")) {
      throw new Error(`Parameter wajib hilang: ${pName}`);
    }
  }

  const base = assertPublicConnectorUrl(conn.base_url);
  let path = tool.path || "/";
  const used = new Set<string>();
  path = path.replace(/\{([a-zA-Z0-9_-]+)\}/g, (_, pName: string) => {
    if (!(pName in schema)) throw new Error(`Path param tidak terdaftar: ${pName}`);
    const v = args?.[pName];
    if (v === undefined || v === null || v === "") {
      throw new Error(`Path param wajib: ${pName}`);
    }
    used.add(pName);
    return encodeURIComponent(String(v));
  });

  const method = (tool.method || "GET").toUpperCase();
  const headers: Record<string, string> = { "User-Agent": "lumens-connector/1.0" };
  applyAuth(conn, secret, headers);

  let url = base.replace(/\/$/, "") + (path.startsWith("/") ? path : `/${path}`);
  let body: string | undefined;
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args ?? {})) {
    if (!used.has(k) && v !== undefined) rest[k] = v;
  }

  if (method === "GET" || method === "DELETE") {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(rest)) qs.set(k, String(v));
    // Query auth param (di luar schema user)
    if (conn.auth_type === "query" && secret && conn.auth_name) {
      qs.set(conn.auth_name, secret);
    }
    const finalQ = qs.toString();
    if (finalQ) url += (url.includes("?") ? "&" : "?") + finalQ;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(rest);
    if (conn.auth_type === "query" && secret && conn.auth_name) {
      const sep = url.includes("?") ? "&" : "?";
      url += `${sep}${encodeURIComponent(conn.auth_name)}=${encodeURIComponent(secret)}`;
    }
  }
  return { method, url, headers, body };
}

/** Header auth untuk konektor (tanpa query — query ditangani per-call). */
export function connectorAuthHeaders(
  conn: Pick<ConnectorRecord, "auth_type" | "auth_name">,
  secret: string | null | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {};
  applyAuth(conn, secret, headers);
  return headers;
}

function applyAuth(
  conn: Pick<ConnectorRecord, "auth_type" | "auth_name">,
  secret: string | null | undefined,
  headers: Record<string, string>,
): void {
  if (!secret || conn.auth_type === "none") return;
  if (conn.auth_type === "bearer") {
    headers["Authorization"] = `Bearer ${secret}`;
  } else if (conn.auth_type === "header" && conn.auth_name) {
    headers[conn.auth_name] = secret;
  }
  // "query" ditangani di buildHttpCall (butuh akses URL)
}

/** URL konektor wajib https publik (blokir localhost/IP privat via safe-url). */
export function assertPublicConnectorUrl(raw: string): string {
  const normalized = normalizeBaseUrl(raw);
  const parsed = new URL(normalized);
  if (parsed.protocol !== "https:") {
    throw new Error("URL konektor harus memakai https.");
  }
  return normalized.replace(/\/$/, "");
}

// ---------- MCP (streamable HTTP, JSON-RPC) ----------
export function mcpListToolsPayload(id: number | string = 1) {
  return { jsonrpc: "2.0", id, method: "tools/list", params: {} };
}

export function mcpCallToolPayload(name: string, args: Record<string, unknown>, id: number | string = 2) {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args ?? {} } };
}

export type McpRawTool = {
  name?: unknown;
  description?: unknown;
  inputSchema?: { properties?: Record<string, { type?: unknown; description?: unknown }>; required?: unknown } | null;
};

/** Rapikan hasil discovery MCP menjadi ConnectorToolDef[]. */
export function normalizeMcpTools(raw: McpRawTool[]): ConnectorToolDef[] {
  const out: ConnectorToolDef[] = [];
  for (const t of raw ?? []) {
    const slug = toolSlug(String(t?.name ?? ""));
    if (!slug) continue;
    const props = t?.inputSchema?.properties ?? {};
    const required = Array.isArray(t?.inputSchema?.required) ? (t.inputSchema.required as unknown[]) : [];
    const params: Record<string, ConnectorParamDef> = {};
    for (const [pName, pDef] of Object.entries(props)) {
      const pType = String((pDef as { type?: unknown })?.type ?? "string");
      params[pName] = {
        type: pType === "number" || pType === "boolean" ? (pType as "number" | "boolean") : "string",
        description: String((pDef as { description?: unknown })?.description ?? ""),
        required: required.includes(pName),
      };
    }
    out.push({
      name: slug,
      description: String(t?.description ?? slug).slice(0, 500),
      method: "MCP",
      path: "",
      params,
    });
  }
  return out;
}

/** Ringkas response konektor untuk konteks model (maks ~4000 char). */
export function clipConnectorOutput(text: string, max = 4000): string {  const t = String(text ?? "");
  return t.length > max ? t.slice(0, max) + "\n…[output dipotong]" : t;
}

export type ConnectorExecResult = { ok: boolean; text: string };

/**
 * Eksekusi tool konektor (server-side only).
 * - kind=http: panggil HTTP API sesuai definisi tool.
 * - kind=mcp: JSON-RPC tools/call ke MCP server.
 * Secret tidak pernah masuk ke output/log.
 */
export async function executeConnectorTool(
  conn: Pick<
    ConnectorRecord,
    "name" | "kind" | "base_url" | "auth_type" | "auth_name" | "tools"
  >,
  toolSlugName: string,
  args: Record<string, unknown>,
  secret: string | null | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<ConnectorExecResult> {
  const tool = (conn.tools ?? []).find((t) => toolSlug(t.name) === toolSlugName);
  if (!tool) return { ok: false, text: `Tool tidak dikenal: ${toolSlugName}` };

  try {
    if (conn.kind === "mcp") {
      const url = assertPublicConnectorUrl(conn.base_url);
      const res = await fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "lumens-connector/1.0",
          ...connectorAuthHeaders(conn, secret),
        },
        body: JSON.stringify(mcpCallToolPayload(tool.name, args ?? {})),
        signal: AbortSignal.timeout(30_000),
      });
      const body = await res.text().catch(() => "");
      if (!res.ok) return { ok: false, text: `MCP error ${res.status}: ${clipConnectorOutput(body, 500)}` };
      const json = JSON.parse(body) as {
        result?: { content?: { type?: string; text?: string }[]; isError?: boolean };
        error?: { message?: string };
      };
      if (json.error) return { ok: false, text: `MCP error: ${json.error.message ?? "unknown"}` };
      const parts = (json.result?.content ?? [])
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text as string);
      const text = parts.length > 0 ? parts.join("\n") : JSON.stringify(json.result ?? {});
      return { ok: !json.result?.isError, text: clipConnectorOutput(text) };
    }

    // kind=http
    const call = buildHttpCall(conn, tool, args ?? {}, secret);
    const res = await fetchFn(call.url, {
      method: call.method,
      headers: call.headers,
      body: call.body,
      signal: AbortSignal.timeout(30_000),
    });
    const body = await res.text().catch(() => "");
    if (!res.ok) {
      return { ok: false, text: `HTTP ${res.status}: ${clipConnectorOutput(body, 500)}` };
    }
    return { ok: true, text: clipConnectorOutput(body) };
  } catch (error) {
    return {
      ok: false,
      text: `Konektor gagal: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500),
    };
  }
}

/** Ambil pesan JSON-RPC dari response MCP (JSON langsung atau SSE). */
export function parseMcpMessage(text: string): Record<string, unknown> | null {
  const t = String(text ?? "");
  // Coba JSON langsung dulu
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    if (j && typeof j === "object" && "jsonrpc" in j) return j;
  } catch { /* bukan JSON murni */ }
  // SSE: cari baris "data: {...}"
  for (const line of t.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const j = JSON.parse(payload) as Record<string, unknown>;
      if (j && typeof j === "object" && "jsonrpc" in j) return j;
    } catch { /* lanjut */ }
  }
  return null;
}

export type McpDiscoverResult =
  | { ok: true; tools: ConnectorToolDef[] }
  | { ok: false; text: string };

/**
 * Discovery MCP: initialize -> tools/list (server-side only).
 * Mengembalikan definisi tool yang sudah dinormalisasi.
 */
export async function discoverMcpTools(
  baseUrl: string,
  secret: string | null | undefined,
  authType: AuthType = "none",
  authName?: string | null,
  fetchFn: typeof fetch = fetch,
): Promise<McpDiscoverResult> {
  let url: string;
  try {
    url = assertPublicConnectorUrl(baseUrl);
  } catch (error) {
    return { ok: false, text: error instanceof Error ? error.message : "URL tidak valid." };
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "User-Agent": "lumens-connector/1.0",
    ...connectorAuthHeaders({ auth_type: authType, auth_name: authName }, secret),
  };
  const post = async (body: unknown) => {
    const res = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 200)}`);
    const msg = parseMcpMessage(text);
    if (!msg) throw new Error("Response MCP tidak dikenali (bukan JSON-RPC).");
    if (msg.error) {
      const e = msg.error as { message?: string; code?: number };
      throw new Error(`MCP error ${e.code ?? ""}: ${e.message ?? "unknown"}`.trim());
    }
    return msg;
  };

  try {
    // 1. initialize (abaikan session id — banyak server tidak mewajibkan)
    await post({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "lumens-connector", version: "1.0" },
      },
    });
    // 2. tools/list
    const msg = await post(mcpListToolsPayload(2));
    const result = msg.result as { tools?: McpRawTool[] } | undefined;
    const tools = normalizeMcpTools(result?.tools ?? []);
    return { ok: true, tools };
  } catch (error) {
    return {
      ok: false,
      text: `Discovery MCP gagal: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500),
    };
  }
}
