// Test integrasi: runSubagent memakai template (prompt + toolset).
import { describe, it, expect, vi } from "vitest";
import { runSubagent } from "../src/lib/agent-subagent.ts";
import { getTemplate } from "../src/lib/agent-subagent-templates.ts";

describe("runSubagent dengan template", () => {
  it("memakai system prompt template dan toolset yang difilter", async () => {
    let capturedMessages: any[] = [];
    let capturedTools: any[] = [];
    const modelFn = vi.fn(async (messages: any[], tools: any[]) => {
      capturedMessages = messages;
      capturedTools = tools;
      return { content: "hasil riset", toolCalls: [] };
    });
    const createSandbox = vi.fn(async () => ({
      sandboxId: "sbx_test",
      run: vi.fn(),
      kill: vi.fn(async () => {}),
    }));

    const r = await runSubagent({
      task: "Riset test",
      templateId: "research",
      parentThreadId: "thr_parent",
      modelFn,
      createSandbox,
    });

    expect(r.ok).toBe(true);
    // System prompt mengandung mission template.
    const template = getTemplate("research")!;
    expect(capturedMessages[0].content).toContain(template.mission);
    // Toolset difilter: research tidak punya read_file.
    const toolNames = capturedTools.map((t: any) => t.function.name);
    expect(toolNames).toContain("web_search");
    expect(toolNames).toContain("web_read");
    expect(toolNames).not.toContain("read_file");
  });

  it("tanpa template memakai prompt generik dan semua tools", async () => {
    let capturedTools: any[] = [];
    const modelFn = vi.fn(async (_m: any[], tools: any[]) => {
      capturedTools = tools;
      return { content: "ok", toolCalls: [] };
    });
    const createSandbox = vi.fn(async () => ({
      sandboxId: "sbx_test",
      run: vi.fn(),
      kill: vi.fn(async () => {}),
    }));

    await runSubagent({
      task: "Task generik",
      parentThreadId: "thr_parent",
      modelFn,
      createSandbox,
    });

    const toolNames = capturedTools.map((t: any) => t.function.name);
    expect(toolNames).toContain("read_file");
    expect(toolNames).toContain("sandbox_exec");
    expect(toolNames).toContain("web_search");
    expect(toolNames).toContain("web_read");
  });

  it("templateId invalid diperlakukan sebagai tanpa template", async () => {
    let capturedMessages: any[] = [];
    const modelFn = vi.fn(async (messages: any[], _t: any[]) => {
      capturedMessages = messages;
      return { content: "ok", toolCalls: [] };
    });
    const createSandbox = vi.fn(async () => ({
      sandboxId: "sbx_test",
      run: vi.fn(),
      kill: vi.fn(async () => {}),
    }));

    const r = await runSubagent({
      task: "x",
      templateId: "ngawur" as never,
      parentThreadId: "thr_parent",
      modelFn,
      createSandbox,
    });

    expect(r.ok).toBe(true);
    expect(capturedMessages[0].content).toContain("focused subagent");
  });
});
