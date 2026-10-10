export type Provider = "custom";
export type ThemeMode = "dark" | "light" | "system";
export type FontSize = "sm" | "md" | "lg";
export type Density = "comfortable" | "compact";
export type Lang = "id" | "en";
export type Role = "system" | "user" | "assistant";

export type StudioSettings = {
  provider: Provider;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stream: boolean;
  theme: ThemeMode;
  fontSize: FontSize;
  density: Density;
  lang: Lang;
  sendWithEnter: boolean;
  showMarkdown: boolean;
  agentMode: boolean;
  systemPromptOverride: string;
  tone: string;
  length: string;
};

export type ChatAttachment = {
  name: string;
  path: string;
  mime: string;
  size: number;
};

export type ChatMessage = {
  id: string;
  role: Exclude<Role, "system">;
  content: string;
  createdAt: number;
  error?: string;
  feedback?: "up" | "down";
  elapsedMs?: number;
  toolCalls?: ToolCall[];
  plan?: import("./agent-plan").PlanStep[];
  attachments?: ChatAttachment[];
};

export type AgentFile = {
  name: string;
  mime: string;
  base64: string;
  size: number;
};

export type ToolCall = {
  id?: string;
  kind?: "sandbox" | "search" | "image" | "memory" | "file";
  command: string;
  output: string;
  exitCode: number;
  images?: string[];
  files?: AgentFile[];
};

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  projectId?: string | null;
  sandboxId?: string;
};

export type EngineId = "content" | "design" | "prototype" | "code";

export type Project = {
  id: string;
  name: string;
  createdAt: number;
};

export type CustomModel = {
  id: string;
  type: "chat" | "image";
  addedAt: number;
};

export const ENGINE_IDS: EngineId[] = ["content", "design", "prototype", "code"];

export const ENGINE_LABELS: Record<EngineId, string> = {
  content: "Generasi Konten",
  design: "Desain",
  prototype: "Prototipe",
  code: "Coding",
};

export const DEFAULT_ENGINE_MODELS: Record<EngineId, string> = {
  content: "xdirgalabs",
  design: "ag/gemini-3.1-flash-image",
  prototype: "ag/claude-sonnet-4-6",
  code: "ag/gpt-oss-120b-medium",
};

export type GenerateConnection = {
  provider: Provider;
  model: string;
};

export type GenerateParams = {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
};

export type GenerateRequest = {
  messages: { role: Role; content: string }[];
  stream: boolean;
  connection: GenerateConnection;
  params: GenerateParams;
};

export const DEFAULT_SETTINGS: StudioSettings = {
  provider: "custom",
  model: "",
  temperature: 0.7,
  maxTokens: 1024,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stream: true,
  theme: "dark",
  fontSize: "md",
  density: "comfortable",
  lang: "id",
  sendWithEnter: true,
  showMarkdown: true,
  agentMode: false,
  systemPromptOverride: "",
  tone: "neutral",
  length: "standard",
};
