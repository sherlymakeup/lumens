import { imagesGenerationsUrl, normalizeBaseUrl } from "./safe-url.ts";

// Image generation inside the agent always goes through the Gemini image
// model — the user's chat model is never switched, so it "returns" to the
// user's choice automatically after the tool runs.
export const IMAGE_MODEL_ID = "ag/gemini-3.1-flash-image";

export type ImageSize = "1024x1024" | "1024x1792" | "1792x1024";

export function imageSizeForRatio(ratio?: string): ImageSize {
  if (ratio === "16:9") return "1792x1024";
  if (ratio === "9:16") return "1024x1792";
  return "1024x1024";
}

// ---------- web_search (Tavily) ----------
export type SearchOutcome = { ok: boolean; text: string };

const TAVILY_URL = "https://api.tavily.com/search";

export async function runWebSearch(
  query: string,
  apiKey: string | undefined,
  maxResults = 5,
): Promise<SearchOutcome> {
  const q = query.trim().slice(0, 500);
  if (!q) return { ok: false, text: "Query pencarian kosong." };
  if (!apiKey) {
    return {
      ok: false,
      text: "Web search belum dikonfigurasi: tambahkan TAVILY_API_KEY di environment server.",
    };
  }
  let res: Response;
  try {
    res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: q,
        max_results: Math.min(Math.max(maxResults, 1), 8),
        search_depth: "basic",
        include_answer: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    return {
      ok: false,
      text: `Web search gagal dijangkau: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!res.ok) {
    return { ok: false, text: `Web search error ${res.status}.` };
  }
  const body = (await res.json().catch(() => null)) as {
    results?: { title?: string; url?: string; content?: string }[];
  } | null;
  const results = (body?.results ?? []).slice(0, 8);
  if (!results.length) {
    return { ok: true, text: "Tidak ada hasil pencarian." };
  }
  const lines = results.map((r, i) => {
    const snippet = (r.content ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
    return `${i + 1}. ${r.title ?? "(tanpa judul)"}\n   ${r.url ?? ""}\n   ${snippet}`;
  });
  return { ok: true, text: `Hasil pencarian web:\n${lines.join("\n")}` };
}

// ---------- generate_image (Gemini) ----------
export type ImageOutcome = { ok: boolean; text: string; images: string[] };

function sniffMime(b64: string): string {
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("iVBOR")) return "image/png";
  return "image/png";
}

export async function runImageGeneration(args: {
  prompt: string;
  ratio?: string;
  gatewayBase: string;
  gatewayKey: string;
}): Promise<ImageOutcome> {
  const prompt = args.prompt.trim().slice(0, 2000);
  if (!prompt) return { ok: false, text: "Prompt gambar kosong.", images: [] };
  let url: string;
  try {
    url = imagesGenerationsUrl(args.gatewayBase);
  } catch (error) {
    return {
      ok: false,
      text: error instanceof Error ? error.message : "Invalid base URL.",
      images: [],
    };
  }
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.gatewayKey}`,
        "User-Agent": "lumens-proxy/1.0",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL_ID,
        prompt,
        size: imageSizeForRatio(args.ratio),
        n: 1,
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    return {
      ok: false,
      text: `Image generation gagal dijangkau: ${error instanceof Error ? error.message : String(error)}`,
      images: [],
    };
  }
  if (!upstream.ok) {
    return { ok: false, text: `Image generation error ${upstream.status}.`, images: [] };
  }
  const body = (await upstream.json().catch(() => null)) as {
    data?: { b64_json?: string; url?: string }[];
  } | null;
  const images: string[] = [];
  for (const item of body?.data ?? []) {
    if (item.b64_json) {
      images.push(`data:${sniffMime(item.b64_json)};base64,${item.b64_json}`);
    } else if (item.url) {
      try {
        const r = await fetch(item.url, { signal: AbortSignal.timeout(30_000) });
        if (!r.ok) continue;
        const mime = r.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length) images.push(`data:${mime};base64,${buf.toString("base64")}`);
      } catch {
        /* skip unreachable url */
      }
    }
    if (images.length >= 1) break;
  }
  if (!images.length) {
    return { ok: false, text: "Gateway tidak mengembalikan gambar.", images: [] };
  }
  return { ok: true, text: `Gambar berhasil dibuat (1 gambar, model Gemini).`, images };
}

// ---------- web_read (Tavily Extract) ----------
export type ReadOutcome = { ok: boolean; text: string };

const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";

function assertPublicHttps(raw: string): string {
  const normalized = normalizeBaseUrl(raw);
  const parsed = new URL(normalized);
  if (parsed.protocol !== "https:") {
    throw new Error("URL harus memakai https.");
  }
  return normalized;
}

export async function runWebRead(
  rawUrl: string,
  apiKey: string | undefined,
  maxChars = 6000,
): Promise<ReadOutcome> {
  const input = rawUrl.trim().slice(0, 2000);
  if (!input) return { ok: false, text: "URL kosong." };
  let url: string;
  try {
    url = assertPublicHttps(input);
  } catch {
    return { ok: false, text: `URL tidak diizinkan: ${input.slice(0, 120)}` };
  }
  if (!apiKey) {
    return {
      ok: false,
      text: "Web read belum dikonfigurasi: tambahkan TAVILY_API_KEY di environment server.",
    };
  }
  let res: Response;
  try {
    res = await fetch(TAVILY_EXTRACT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        urls: [url],
        extract_depth: "basic",
        format: "markdown",
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    return {
      ok: false,
      text: `Web read gagal dijangkau: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!res.ok) {
    return { ok: false, text: `Web read error ${res.status}.` };
  }
  const body = (await res.json().catch(() => null)) as {
    results?: { url?: string; content?: string; raw_content?: string }[];
  } | null;
  const first = (body?.results ?? [])[0];
  const raw = (first?.content || first?.raw_content || "").replace(/\s+/g, " ").trim();
  if (!raw) {
    return { ok: false, text: `Gagal mengekstrak isi halaman: ${url}` };
  }
  const limit = Math.min(Math.max(maxChars, 500), 12000);
  const clipped = raw.length > limit;
  const text = clipped ? raw.slice(0, limit) + "\n…[konten dipotong]" : raw;
  return { ok: true, text: `Isi ${url}:\n${text}` };
}
