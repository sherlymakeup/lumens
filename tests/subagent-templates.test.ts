// Tests untuk P1: Subagent Templates (adopsi Tasklet).
// TDD: tulis dulu, implementasi menyusul.
import { describe, it, expect } from "vitest";
import {
  SUBAGENT_TEMPLATES,
  getTemplate,
  buildTemplatePrompt,
  TEMPLATE_IDS,
  type SubagentTemplateId,
} from "../src/lib/agent-subagent-templates.ts";

describe("subagent template registry", () => {
  it("memiliki 4 template: research, data-processor, file-worker, integration", () => {
    expect(TEMPLATE_IDS).toEqual(["research", "data-processor", "file-worker", "integration"]);
    expect(SUBAGENT_TEMPLATES).toHaveLength(4);
  });

  it("setiap template punya id, name, mission, instructions, tools, outputFormat", () => {
    for (const t of SUBAGENT_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.mission).toBeTruthy();
      expect(t.instructions.length).toBeGreaterThan(0);
      expect(t.tools.length).toBeGreaterThan(0);
      expect(t.outputFormat).toBeTruthy();
    }
  });

  it("getTemplate mengembalikan template yang benar, unknown -> null", () => {
    expect(getTemplate("research")?.id).toBe("research");
    expect(getTemplate("data-processor")?.id).toBe("data-processor");
    expect(getTemplate("file-worker")?.id).toBe("file-worker");
    expect(getTemplate("integration")?.id).toBe("integration");
    expect(getTemplate("tidak-ada" as SubagentTemplateId)).toBeNull();
  });

  it("research template hanya boleh pakai web_search, web_read, sandbox_exec", () => {
    const t = getTemplate("research")!;
    expect(t.tools).toContain("web_search");
    expect(t.tools).toContain("web_read");
    expect(t.tools).not.toContain("read_file");
  });

  it("file-worker template boleh pakai sandbox_exec dan read_file", () => {
    const t = getTemplate("file-worker")!;
    expect(t.tools).toContain("sandbox_exec");
    expect(t.tools).toContain("read_file");
  });

  it("data-processor fokus ke sandbox_exec untuk transformasi data", () => {
    const t = getTemplate("data-processor")!;
    expect(t.tools).toContain("sandbox_exec");
    expect(t.mission.toLowerCase()).toMatch(/data/);
  });

  it("integration template mencakup web_search, web_read, sandbox_exec", () => {
    const t = getTemplate("integration")!;
    expect(t.tools).toContain("web_search");
    expect(t.tools).toContain("web_read");
    expect(t.tools).toContain("sandbox_exec");
  });
});

describe("buildTemplatePrompt", () => {
  it("menghasilkan system prompt dengan mission dan instructions", () => {
    const t = getTemplate("research")!;
    const { system, user } = buildTemplatePrompt(t, "Riset harga EV di Jakarta", "Konteks: user di Indonesia");
    expect(system).toContain(t.mission);
    for (const step of t.instructions.slice(0, 2)) {
      expect(system).toContain(step.slice(0, 30));
    }
    expect(system).toContain(t.outputFormat.slice(0, 30));
  });

  it("user message memuat task dan context", () => {
    const t = getTemplate("research")!;
    const { user } = buildTemplatePrompt(t, "Task saya", "Konteks saya");
    expect(user).toContain("Task saya");
    expect(user).toContain("Konteks saya");
  });

  it("user message tanpa context tetap valid", () => {
    const t = getTemplate("file-worker")!;
    const { user } = buildTemplatePrompt(t, "Buat file hello.py");
    expect(user).toContain("Buat file hello.py");
    expect(user).not.toContain("undefined");
  });

  it("system prompt menyebut batasan tidak bisa spawn subagent", () => {
    const t = getTemplate("research")!;
    const { system } = buildTemplatePrompt(t, "x");
    expect(system.toLowerCase()).toMatch(/cannot spawn|tidak bisa.*subagent|no.*spawn/);
  });
});
