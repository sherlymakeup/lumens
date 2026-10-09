// P1: Subagent Templates — adopsi dari Tasklet.
// Template terstruktur yang reusable untuk spawn_subagent:
// mission, instructions, tools yang diizinkan, format output, error handling.
import { SUBAGENT_TOOLS } from "./agent-subagent.ts";

export type SubagentTemplateId = "research" | "data-processor" | "file-worker" | "integration";

export type SubagentTemplate = {
  id: SubagentTemplateId;
  name: string;
  mission: string;
  instructions: string[];
  /** Subset dari nama tool di SUBAGENT_TOOLS. */
  tools: string[];
  outputFormat: string;
  errorHandling: string;
};

export const TEMPLATE_IDS: SubagentTemplateId[] = [
  "research",
  "data-processor",
  "file-worker",
  "integration",
];

export const SUBAGENT_TEMPLATES: SubagentTemplate[] = [
  {
    id: "research",
    name: "Research Agent",
    mission:
      "Conduct thorough web research on a given topic and produce structured, source-backed findings.",
    instructions: [
      "Receive the research topic and specific questions from the task.",
      "Search the web using multiple queries (minimum 3 different angles).",
      "Read the most relevant pages to extract key information.",
      "Cross-reference facts across multiple sources; note confidence level.",
      "Synthesize findings into the expected output format with source URLs.",
    ],
    tools: ["web_search", "web_read", "sandbox_exec"],
    outputFormat: `Return structured findings:
- Summary: 2-3 sentence executive summary
- Key findings: bullet list, each with confidence (high/medium/low) and source URL
- Data points: metric, value, source (if any)
- Gaps: what could not be found`,
    errorHandling:
      "If search fails, retry with an alternative query. If a page is blocked, use another source. If the topic is too broad, narrow it and report partial results.",
  },
  {
    id: "data-processor",
    name: "Data Processor",
    mission:
      "Transform, clean, analyze, or aggregate data using code execution. Input data, structured output.",
    instructions: [
      "Understand the input data format and the desired transformation.",
      "Write and run code (python3/node) in the sandbox to process the data.",
      "Validate the output: check row counts, types, and edge cases.",
      "If the data is large, process in a streaming/chunked way.",
      "Report the result in the expected output format.",
    ],
    tools: ["sandbox_exec"],
    outputFormat: `Return:
- Summary: what was processed (input rows/files -> output)
- Result: the transformed data or aggregated statistics
- Method: brief note on how it was processed
- Issues: any data quality problems found`,
    errorHandling:
      "If the input format is unexpected, inspect it first and adapt. If processing fails partway, report partial results and the error.",
  },
  {
    id: "file-worker",
    name: "File & Execution Worker",
    mission:
      "Create, modify, or execute files and code in the sandbox. Deliver downloadable files when requested.",
    instructions: [
      "Create or modify files under the working directory as specified.",
      "Run/verify the result (execute scripts, check outputs).",
      "For deliverables, use read_file so the main agent can offer a download.",
      "Keep the working directory tidy; /tmp only for ephemeral files.",
    ],
    tools: ["sandbox_exec", "read_file"],
    outputFormat: `Return:
- Files created/modified: list of paths
- Verification: how the result was checked (command + outcome)
- Download: mention which file(s) are ready via read_file`,
    errorHandling:
      "If a command fails, read the stderr, fix, and retry once. Report the error clearly if it persists.",
  },
  {
    id: "integration",
    name: "Integration Worker",
    mission:
      "Interact with external HTTP APIs or services: probe endpoints, fetch data, and normalize the result.",
    instructions: [
      "Identify the target API/service and required parameters from the task.",
      "Probe the endpoint with curl; respect timeouts.",
      "Parse the response (JSON preferred) and normalize into a clean structure.",
      "Never exfiltrate secrets; only return the data the task asked for.",
    ],
    tools: ["web_search", "web_read", "sandbox_exec"],
    outputFormat: `Return:
- Endpoint(s) called and HTTP status
- Normalized data (JSON-ish, concise)
- Notes: auth method, pagination, or quirks encountered`,
    errorHandling:
      "On HTTP errors, report status code and body excerpt. Retry once on timeouts/5xx. Do not hammer rate-limited APIs.",
  },
];

export function getTemplate(id: SubagentTemplateId): SubagentTemplate | null {
  return SUBAGENT_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Filter SUBAGENT_TOOLS ke subset yang diizinkan template. */
export function templateTools(template: SubagentTemplate): unknown[] {
  const allowed = new Set(template.tools);
  return SUBAGENT_TOOLS.filter((t) => {
    const name = (t as { function: { name: string } }).function.name;
    return allowed.has(name);
  });
}

export function buildTemplatePrompt(
  template: SubagentTemplate,
  task: string,
  context?: string,
): { system: string; user: string } {
  const system = `You are a focused subagent: ${template.name}.
Mission: ${template.mission}

Instructions:
${template.instructions.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Expected output:
${template.outputFormat}

Error handling:
${template.errorHandling}

Rules:
- You CANNOT spawn other subagents. If the task is too big, do the most valuable part and say what remains.
- Be concise: your whole output is summarized back to the main agent (max ~2000 chars kept).
- When done, write the result as plain text — no preamble about being a subagent.`;

  const user =
    `Task: ${task}` +
    (context ? `\n\nContext:\n${context}` : "") +
    `\n\nReport back concisely following the expected output format above.`;

  return { system, user };
}
