// P2: Automatic Learning Loop — adopsi dari Tasklet Memory Manager.
// Setelah agent menyelesaikan task, ekstrak learnings (preference/pattern/fact)
// dan simpan ke long-term memory. Berjalan async, tidak block respons.
import { saveMemory, type MemoryEnv } from "./agent-memory.ts";

export type LearningType = "preference" | "pattern" | "fact";
export type LearningConfidence = "high" | "medium" | "low";

export type Learning = {
  type: LearningType;
  content: string;
  confidence: LearningConfidence;
};

export type LearningMessage = {
  role: string;
  content: string;
  toolCalls?: { name: string }[];
};

const VALID_TYPES: LearningType[] = ["preference", "pattern", "fact"];
const VALID_CONFIDENCE: LearningConfidence[] = ["high", "medium", "low"];

/** Tentukan apakah learning loop perlu jalan: hanya untuk task dengan tool usage. */
export function shouldRunLearning(messages: LearningMessage[]): boolean {
  if (messages.length === 0) return false;
  return messages.some(
    (m) => Array.isArray(m.toolCalls) && m.toolCalls.length > 0,
  );
}

const EXTRACTOR_PROMPT = `You are a learning extractor. Analyze the conversation below and identify durable learnings about the user.

Categories:
- preference: user likes/dislikes, communication style, language, output format preferences
- pattern: recurring behaviors, typical request types, workflow habits
- fact: durable factual information (project stack, names, constraints)

Conversation:
---
{{CONVERSATION}}
---

Return ONLY valid JSON (no markdown, no preamble):
{
  "learnings": [
    {"type": "preference|pattern|fact", "content": "...", "confidence": "high|medium|low"}
  ]
}

Rules:
- Only include learnings with real evidence in the conversation. No guessing.
- Keep each content under 200 chars, specific and actionable.
- Max 5 learnings. Empty array if nothing durable was learned.
- Confidence high = explicitly stated by user; medium = strongly implied; low = weak signal (skip low).`;

function buildPrompt(messages: LearningMessage[]): string {
  const convo = messages
    .map((m) => `${m.role}: ${m.content.slice(0, 2000)}`)
    .join("\n\n")
    .slice(0, 8000);
  return EXTRACTOR_PROMPT.replace("{{CONVERSATION}}", convo);
}

/** Ekstrak learnings dari percakapan menggunakan LLM. */
export async function extractLearnings(
  messages: LearningMessage[],
  modelFn: (prompt: string) => Promise<string>,
): Promise<Learning[]> {
  if (messages.length === 0) return [];
  let raw: string;
  try {
    raw = await modelFn(buildPrompt(messages));
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    // Bersihkan markdown code fence jika ada.
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  const learnings = (parsed as { learnings?: unknown }).learnings;
  if (!Array.isArray(learnings)) return [];
  const out: Learning[] = [];
  for (const item of learnings) {
    if (typeof item !== "object" || item === null) continue;
    const { type, content, confidence } = item as Record<string, unknown>;
    if (!VALID_TYPES.includes(type as LearningType)) continue;
    if (typeof content !== "string" || !content.trim()) continue;
    if (!VALID_CONFIDENCE.includes(confidence as LearningConfidence)) continue;
    out.push({
      type: type as LearningType,
      content: content.trim().slice(0, 500),
      confidence: confidence as LearningConfidence,
    });
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * Simpan learnings ke long-term memory.
 * Format: "[learned:preference] content" agar mudah difilter.
 */
export async function saveLearnings(
  learnings: Learning[],
  env: MemoryEnv,
): Promise<number> {
  if (learnings.length === 0 || !env) return 0;
  let saved = 0;
  for (const l of learnings) {
    const content = `[learned:${l.type}] ${l.content}`;
    const r = await saveMemory(content, env);
    if (r.ok) saved++;
  }
  return saved;
}

/**
 * Jalankan learning loop penuh: cek apakah perlu, ekstrak, simpan.
 * Fire-and-forget — panggil tanpa await dari agent completion.
 */
export async function runLearningLoop(
  messages: LearningMessage[],
  modelFn: (prompt: string) => Promise<string>,
  env: MemoryEnv,
): Promise<number> {
  if (!shouldRunLearning(messages)) return 0;
  const learnings = await extractLearnings(messages, modelFn);
  if (learnings.length === 0) return 0;
  return saveLearnings(learnings, env);
}
