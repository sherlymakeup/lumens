// Tests untuk P2: Automatic Learning Loop (adopsi Tasklet Memory Manager).
// Setelah agent selesai, ekstrak learnings (preference/pattern/fact) dan simpan.
import { describe, it, expect, vi } from "vitest";
import {
  extractLearnings,
  shouldRunLearning,
  type Learning,
} from "../src/lib/agent-learning.ts";

describe("shouldRunLearning", () => {
  it("true jika ada tool calls (task eksekusi nyata)", () => {
    const messages = [
      { role: "user", content: "Buatkan file hello.py" },
      { role: "assistant", content: "Baik", toolCalls: [{ name: "sandbox_exec" }] },
    ];
    expect(shouldRunLearning(messages)).toBe(true);
  });

  it("false jika hanya chat biasa tanpa tools", () => {
    const messages = [
      { role: "user", content: "Halo" },
      { role: "assistant", content: "Halo juga!" },
    ];
    expect(shouldRunLearning(messages)).toBe(false);
  });

  it("false jika messages kosong", () => {
    expect(shouldRunLearning([])).toBe(false);
  });
});

describe("extractLearnings", () => {
  it("mengekstrak learnings dari respons LLM yang valid", async () => {
    const modelFn = vi.fn(async (_prompt: string) =>
      JSON.stringify({
        learnings: [
          { type: "preference", content: "User prefers Indonesian language", confidence: "high" },
          { type: "pattern", content: "User often asks for file downloads", confidence: "medium" },
        ],
      }),
    );
    const messages = [
      { role: "user", content: "Buatkan laporan dalam Bahasa Indonesia" },
      { role: "assistant", content: "Baik, saya buatkan." },
    ];
    const learnings = await extractLearnings(messages, modelFn);
    expect(learnings).toHaveLength(2);
    expect(learnings[0].type).toBe("preference");
    expect(learnings[0].content).toContain("Indonesian");
    expect(modelFn).toHaveBeenCalledOnce();
  });

  it("mengembalikan array kosong jika LLM return JSON invalid", async () => {
    const modelFn = vi.fn(async () => "bukan json");
    const learnings = await extractLearnings(
      [{ role: "user", content: "x" }],
      modelFn,
    );
    expect(learnings).toEqual([]);
  });

  it("mengembalikan array kosong jika tidak ada learnings", async () => {
    const modelFn = vi.fn(async () => JSON.stringify({ learnings: [] }));
    const learnings = await extractLearnings(
      [{ role: "user", content: "x" }],
      modelFn,
    );
    expect(learnings).toEqual([]);
  });

  it("memfilter type yang tidak valid", async () => {
    const modelFn = vi.fn(async () =>
      JSON.stringify({
        learnings: [
          { type: "preference", content: "Valid", confidence: "high" },
          { type: "ngawur", content: "Invalid", confidence: "high" },
        ],
      }),
    );
    const learnings = await extractLearnings(
      [{ role: "user", content: "x" }],
      modelFn,
    );
    expect(learnings).toHaveLength(1);
    expect(learnings[0].type).toBe("preference");
  });

  it("prompt menyertakan riwayat percakapan", async () => {
    const modelFn = vi.fn(async () => JSON.stringify({ learnings: [] }));
    const messages = [
      { role: "user", content: "PESAN_UNIK_123" },
      { role: "assistant", content: "RESPON_UNIK_456" },
    ];
    await extractLearnings(messages, modelFn);
    const prompt = modelFn.mock.calls[0][0] as string;
    expect(prompt).toContain("PESAN_UNIK_123");
    expect(prompt).toContain("RESPON_UNIK_456");
  });
});
