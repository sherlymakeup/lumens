export type Provider = "custom";
export type ThemeMode = "dark" | "light" | "system";
export type FontSize = "sm" | "md" | "lg";
export type Density = "comfortable" | "compact";
export type Role = "system" | "user" | "assistant";

export type ModeId =
  | "chat"
  | "write"
  | "rewrite"
  | "summarize"
  | "translate"
  | "code"
  | "email"
  | "social"
  | "ideas"
  | "explain";

export type ExtraField = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
};

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
  sendWithEnter: boolean;
  showMarkdown: boolean;
  systemPromptOverride: string;
};

export type ChatMessage = {
  id: string;
  role: Exclude<Role, "system">;
  content: string;
  createdAt: number;
  error?: string;
};

export type Conversation = {
  id: string;
  modeId: ModeId;
  title: string;
  extras: Record<string, string>;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
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
  sendWithEnter: true,
  showMarkdown: true,
  systemPromptOverride: "",
};
