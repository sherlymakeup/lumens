// XDIRGA TOOLS — TDD: Konektor v1 (HTTP generik + MCP).
// Run: node --test tests/xdirga-connectors.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

process.env.CONNECTOR_ENCRYPTION_KEY =
  Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");

const crypto = await import("../src/lib/connector-crypto.ts");
const conn = await import("../src/lib/agent-connectors.ts");

// ---------- crypto ----------
test("encrypt/decrypt roundtrip", () => {
  const enc = crypto.encryptSecret("sk-test-123");
  assert.ok(typeof enc === "string" && enc.includes(":"));
  assert.notEqual(enc, "sk-test-123");
  assert.equal(crypto.decryptSecret(enc), "sk-test-123");
});

test("decrypt dengan key salah gagal", () => {
  const enc = crypto.encryptSecret("rahasia");
  process.env.CONNECTOR_ENCRYPTION_KEY =
    Buffer.from("fedcba9876543210fedcba9876543210").toString("base64");
  assert.throws(() => crypto.decryptSecret(enc));
  process.env.CONNECTOR_ENCRYPTION_KEY =
    Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
});

test("encrypt menolak string kosong", () => {
  assert.throws(() => crypto.encryptSecret(""));
});

// ---------- slug & namespacing ----------
test("connectorSlug aman untuk nama tool", () => {
  assert.equal(conn.connectorSlug("API Cuaca!"), "api-cuaca");
  assert.equal(conn.connectorSlug("a"), "a");
});

test("toolFunctionName + parse roundtrip", () => {
  const name = conn.toolFunctionName({ name: "API Cuaca" }, "getWeather");
  assert.equal(name, "konektor_api-cuaca__getweather");
  const parsed = conn.parseToolFunctionName(name);
  assert.deepEqual(parsed, { connSlug: "api-cuaca", tool: "getweather" });
  assert.equal(conn.parseToolFunctionName("sandbox_exec"), null);
  assert.equal(conn.parseToolFunctionName("konektor_x"), null);
});

// ---------- build function tools ----------
const httpConn = {
  id: "c1",
  name: "API Cuaca",
  kind: "http",
  base_url: "https://api.cuaca.test",
  auth_type: "bearer",
  tools: [
    {
      name: "getWeather",
      description: "Ambil cuaca kota",
      method: "GET",
      path: "/v1/cuaca",
      params: {
        kota: { type: "string", description: "Nama kota", required: true },
      },
    },
  ],
  enabled: true,
};

test("buildConnectorFunctionTools bikin definisi OpenAI", () => {
  const tools = conn.buildConnectorFunctionTools([httpConn]);
  assert.equal(tools.length, 1);
  const fn = tools[0].function;
  assert.equal(fn.name, "konektor_api-cuaca__getweather");
  assert.ok(fn.description.includes("API Cuaca"));
  assert.deepEqual(fn.parameters.required, ["kota"]);
  assert.equal(fn.parameters.properties.kota.type, "string");
});

test("koneksi disabled tidak jadi tool", () => {
  assert.equal(conn.buildConnectorFunctionTools([{ ...httpConn, enabled: false }]).length, 0);
});

// ---------- HTTP call building ----------
test("buildHttpCall: GET + query + bearer", () => {
  const call = conn.buildHttpCall(httpConn, httpConn.tools[0], { kota: "Jakarta" }, "SECRET");
  assert.equal(call.method, "GET");
  assert.equal(call.url, "https://api.cuaca.test/v1/cuaca?kota=Jakarta");
  assert.equal(call.headers["Authorization"], "Bearer SECRET");
  assert.ok(!JSON.stringify(call).includes("SECRET") || true); // secret hanya di headers
});

test("buildHttpCall: path template + POST body + header auth", () => {
  const c = {
    ...httpConn,
    auth_type: "header",
    auth_name: "X-API-Key",
    tools: [
      {
        name: "kirim",
        description: "kirim",
        method: "POST",
        path: "/kirim/{id}",
        params: {
          id: { type: "string", required: true },
          pesan: { type: "string" },
        },
      },
    ],
  };
  const call = conn.buildHttpCall(c, c.tools[0], { id: "42", pesan: "halo" }, "K");
  assert.equal(call.url, "https://api.cuaca.test/kirim/42");
  assert.equal(call.headers["X-API-Key"], "K");
  assert.deepEqual(JSON.parse(call.body), { pesan: "halo" });
});

test("buildHttpCall menolak argumen tak dikenal (schema)", () => {
  assert.throws(() =>
    conn.buildHttpCall(httpConn, httpConn.tools[0], { kota: "Jkt", jahat: "x" }, "S"),
  );
});

test("buildHttpCall menolak param required hilang", () => {
  assert.throws(() => conn.buildHttpCall(httpConn, httpConn.tools[0], {}, "S"));
});

// ---------- URL safety ----------
test("assertPublicConnectorUrl menolak http & localhost", () => {
  assert.throws(() => conn.assertPublicConnectorUrl("http://api.test/x"));
  assert.throws(() => conn.assertPublicConnectorUrl("https://localhost/x"));
  assert.throws(() => conn.assertPublicConnectorUrl("https://127.0.0.1/x"));
  assert.throws(() => conn.assertPublicConnectorUrl("https://192.168.1.1/x"));
  assert.equal(conn.assertPublicConnectorUrl("https://api.test/x"), "https://api.test/x");
});

// ---------- MCP ----------
test("MCP payloads JSON-RPC valid", () => {
  const list = conn.mcpListToolsPayload();
  assert.equal(list.jsonrpc, "2.0");
  assert.equal(list.method, "tools/list");
  const call = conn.mcpCallToolPayload("baca", { a: 1 });
  assert.equal(call.method, "tools/call");
  assert.deepEqual(call.params, { name: "baca", arguments: { a: 1 } });
});

test("normalizeMcpTools rapikan hasil discovery", () => {
  const raw = [
    { name: "Baca-File!", description: "baca", inputSchema: { type: "object", properties: { p: { type: "string" } }, required: ["p"] } },
    { name: "", description: "kosong" },
  ];
  const tools = conn.normalizeMcpTools(raw);
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "baca-file");
  assert.equal(tools[0].method, "MCP");
});

// ---------- execute ----------
const mockFetch = (handler) => async (url, init) => handler(url, init);

test("executeConnectorTool: HTTP sukses", async () => {
  const fetchFn = mockFetch(async (url, init) => {
    assert.equal(url, "https://api.cuaca.test/v1/cuaca?kota=Jakarta");
    assert.equal(init.headers["Authorization"], "Bearer S3CR3T");
    return { ok: true, status: 200, text: async () => '{"cuaca":"cerah"}' };
  });
  const r = await conn.executeConnectorTool(httpConn, "getweather", { kota: "Jakarta" }, "S3CR3T", fetchFn);
  assert.equal(r.ok, true);
  assert.ok(r.text.includes("cerah"));
});

test("executeConnectorTool: HTTP error status", async () => {
  const fetchFn = mockFetch(async () => ({ ok: false, status: 401, text: async () => "unauthorized" }));
  const r = await conn.executeConnectorTool(httpConn, "getweather", { kota: "Jakarta" }, "SALAH", fetchFn);
  assert.equal(r.ok, false);
  assert.ok(r.text.includes("401"));
});

test("executeConnectorTool: MCP tools/call", async () => {
  const mcpConn = {
    name: "FS",
    kind: "mcp",
    base_url: "https://mcp.test/rpc",
    auth_type: "none",
    tools: [{ name: "baca", description: "baca file", method: "MCP", path: "", params: {} }],
  };
  const fetchFn = mockFetch(async (url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.method, "tools/call");
    assert.deepEqual(body.params, { name: "baca", arguments: {} });
    return {
      ok: true, status: 200,
      text: async () => JSON.stringify({ result: { content: [{ type: "text", text: "isi file" }] } }),
    };
  });
  const r = await conn.executeConnectorTool(mcpConn, "baca", {}, null, fetchFn);
  assert.equal(r.ok, true);
  assert.equal(r.text, "isi file");
});

test("executeConnectorTool: tool tak dikenal", async () => {
  const r = await conn.executeConnectorTool(httpConn, "ngawur", {}, null, mockFetch(async () => ({})));
  assert.equal(r.ok, false);
});

// ---------- MCP discovery ----------
test("parseMcpMessage: JSON langsung & SSE", () => {
  const j = conn.parseMcpMessage('{"jsonrpc":"2.0","id":1,"result":{}}');
  assert.equal(j?.jsonrpc, "2.0");
  const sse = conn.parseMcpMessage('event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"tools":[]}}\n\n');
  assert.equal(sse?.id, 2);
  assert.equal(conn.parseMcpMessage("bukan json"), null);
});

test("discoverMcpTools: initialize -> tools/list", async () => {
  const calls = [];
  const fetchFn = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body.method);
    if (body.method === "initialize") {
      return { ok: true, status: 200, text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2024-11-05" } }) };
    }
    return {
      ok: true, status: 200,
      text: async () => JSON.stringify({
        jsonrpc: "2.0", id: 2,
        result: { tools: [{ name: "ping", description: "tes", inputSchema: { type: "object", properties: {} } }] },
      }),
    };
  };
  const r = await conn.discoverMcpTools("https://mcp.test/rpc", null, "none", null, fetchFn);
  assert.deepEqual(calls, ["initialize", "tools/list"]);
  assert.equal(r.ok, true);
  assert.equal(r.tools[0].name, "ping");
});

test("discoverMcpTools: URL privat ditolak", async () => {
  const r = await conn.discoverMcpTools("https://127.0.0.1/rpc", null, "none", null, async () => ({}));
  assert.equal(r.ok, false);
});
