import { useEffect, useMemo, useRef, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { toast } from "sonner";
import { generateAgent, generateStream } from "@/lib/generate";
import { resolveAgentSandboxId } from "@/lib/agent-upload";
import { styleInstruction } from "@/lib/style";
import { useStudio } from "@/lib/store";
import { useStrings, type StringKey } from "@/lib/i18n";
import { applyDensity, applyFontSize, applyTheme } from "@/lib/theme";
import type { ChatAttachment, ChatMessage } from "@/lib/types";
import { uid } from "@/lib/utils";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { Header } from "./header";
import { MessageList } from "./messages";
import { SettingsPanel } from "./settings";
import { Sidebar } from "./sidebar";
import { MobileSidebar } from "./mobile-sidebar";

/** System prompt generik untuk jalur non-agent (tanpa tools). */
const CHAT_SYSTEM =
  "You are XDIRGA, a precise, calm assistant. Answer directly. Use markdown when it helps. Do not add filler openings.";

/** Petakan tool kind dari SSE agent ke label status (key i18n "status.*"). */
function phaseForToolKind(kind?: string): string {
  switch (kind) {
    case "search":
      return "status.search";
    case "image":
      return "status.image";
    case "memory":
      return "status.memory";
    case "file":
      return "status.file";
    case "subagent":
      return "status.subagent";
    case "sandbox":
      return "status.sandbox";
    default:
      return "status.processing";
  }
}

export function Studio() {
  const t = useStrings();
  const setHydrated = useStudio((s) => s.setHydrated);
  const settings = useStudio((s) => s.settings);
  const conversations = useStudio((s) => s.conversations);
  const activeId = useStudio((s) => s.activeId);
  const streamingId = useStudio((s) => s.streamingId);
  const sidebarOpen = useStudio((s) => s.sidebarOpen);
  const setSidebarOpen = useStudio((s) => s.setSidebarOpen);
  const sidebarCollapsed = useStudio((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useStudio((s) => s.setSidebarCollapsed);
  const newConversation = useStudio((s) => s.newConversation);
  const addMessage = useStudio((s) => s.addMessage);
  const patchMessage = useStudio((s) => s.patchMessage);
  const setStreamingId = useStudio((s) => s.setStreamingId);
  const setSandboxId = useStudio((s) => s.setSandboxId);

  const [draft, setDraft] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  // Fase status dinamis: label aktivitas agent saat ini (key i18n "status.*").
  const [agentPhase, setAgentPhase] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploadSandboxId, setUploadSandboxId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Stick to bottom only while the user is already near the bottom —
  // otherwise streaming would yank the scroll away from what they're reading.
  const stickRef = useRef(true);
  const convIdRef = useRef(activeId);

  const conversation = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? null,
    [conversations, activeId],
  );
  const messages = conversation?.messages ?? [];

  useEffect(() => {
    const unsub = useStudio.persist.onFinishHydration(() => setHydrated());
    if (useStudio.persist.hasHydrated()) setHydrated();
    return unsub;
  }, [setHydrated]);

  useEffect(() => {
    applyTheme(settings.theme);
    applyFontSize(settings.fontSize);
    applyDensity(settings.density);
    document.documentElement.dataset.sendEnter = settings.sendWithEnter ? "1" : "0";
  }, [settings.theme, settings.fontSize, settings.density, settings.sendWithEnter]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (useStudio.getState().settings.theme === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        useStudio.getState().setSettingsOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n" && !event.shiftKey) {
        const target = event.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
        event.preventDefault();
        newConversation();
        setDraft("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newConversation]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (convIdRef.current !== activeId) {
      convIdRef.current = activeId;
      stickRef.current = true;
    }
    if (!stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, thinking, streamingId, activeId]);

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamingId(null);
    setThinking(false);
  }

  async function runAgent(
    conversationId: string,
    assistantId: string,
    userText: string,
    system: string,
    prior: ChatMessage[],
    atts: ChatAttachment[],
  ) {
    const state = useStudio.getState();
    const conv = state.conversations.find((item) => item.id === conversationId);
    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = Date.now();
    let assembled = "";

    const payloadMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      ...prior.map((message) => ({ role: message.role, content: message.content })),
      { role: "user" as const, content: userText },
    ];

    await generateAgent(
      {
        messages: payloadMessages,
        model: state.settings.model,
        threadId: conversationId,
        sandboxId: conv?.sandboxId,
        attachments: atts.length > 0 ? atts : undefined,
        params: {
          temperature: state.settings.temperature,
          maxTokens: state.settings.maxTokens,
          topP: state.settings.topP,
          frequencyPenalty: state.settings.frequencyPenalty,
          presencePenalty: state.settings.presencePenalty,
        },
      },
      {
        signal: controller.signal,
        onText: (delta) => {
          assembled += delta;
          setAgentPhase("status.writing");
          patchMessage(conversationId, assistantId, { content: assembled });
        },
        onToolCall: (command, kind) => {
          setAgentPhase(phaseForToolKind(kind));
          const current = useStudio
            .getState()
            .conversations.find((item) => item.id === conversationId)
            ?.messages.find((message) => message.id === assistantId);
          patchMessage(conversationId, assistantId, {
            toolCalls: [
              ...(current?.toolCalls ?? []),
              {
                kind:
                  kind === "search" || kind === "image" || kind === "memory" || kind === "file"
                    ? kind
                    : "sandbox",
                command,
                output: "",
                exitCode: 0,
              },
            ],
          });
        },
        onToolResult: (output, exitCode, images, files) => {
          const current = useStudio
            .getState()
            .conversations.find((item) => item.id === conversationId)
            ?.messages.find((message) => message.id === assistantId);
          const calls = [...(current?.toolCalls ?? [])];
          if (calls.length > 0) {
            calls[calls.length - 1] = { ...calls[calls.length - 1], output, exitCode, images, files };
          }
          patchMessage(conversationId, assistantId, { toolCalls: calls });
          setAgentPhase("status.processing");
        },
        onPlan: (steps) => {
          patchMessage(conversationId, assistantId, { plan: steps });
          setAgentPhase("status.plan");
        },
        onDone: (sandboxId) => {
          if (sandboxId) setSandboxId(conversationId, sandboxId);
          patchMessage(conversationId, assistantId, { elapsedMs: Date.now() - startedAt });
          setStreamingId(null);
          setAgentPhase(null);
          abortRef.current = null;
        },
        onError: (message) => {
          patchMessage(conversationId, assistantId, {
            error: message,
            content: assembled,
            elapsedMs: Date.now() - startedAt,
          });
          setStreamingId(null);
          setAgentPhase(null);
          abortRef.current = null;
        },
      },
    );
  }

  async function run(userText: string, prior?: ChatMessage[]) {
    const text = userText.trim();
    const atts = attachments;
    if ((!text && atts.length === 0) || useStudio.getState().streamingId) return;

    const current = useStudio.getState().settings;
    if (!current.model.trim()) {
      useStudio.getState().setSettingsOpen(true);
      toast.error(t["sh.chooseModelFirst"]);
      return;
    }

    let id = useStudio.getState().activeId;
    if (!id) id = newConversation();
    const conv = useStudio.getState().conversations.find((item) => item.id === id) ?? null;
    if (!conv) return;

    // Upload bisa membuat sandbox baru — pakai sandbox itu agar file lampiran
    // terbaca agent, dan simpan ke percakapan untuk pesan berikutnya.
    const agentSandboxId = resolveAgentSandboxId(conv.sandboxId, uploadSandboxId);
    if (agentSandboxId && agentSandboxId !== conv.sandboxId) {
      setSandboxId(id, agentSandboxId);
    }

    const history = prior ?? conv.messages;
    const user: ChatMessage = {
      id: uid(),
      role: "user",
      content: text,
      createdAt: Date.now(),
      attachments: atts.length > 0 ? atts : undefined,
    };
    const assistant: ChatMessage = {
      id: uid(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };
    addMessage(id, user);
    addMessage(id, assistant);
    setStreamingId(assistant.id);
    setThinking(false);
    setAgentPhase("status.thinking");
    setDraft("");
    setAttachments([]);
    setUploadSandboxId(null);

    const style = styleInstruction(settings.tone, settings.length, t);
    const override = settings.systemPromptOverride.trim();
    const system = [style, override].filter(Boolean).join("\n\n");
    const chatSystem = [CHAT_SYSTEM, style, override].filter(Boolean).join("\n\n");

    if (settings.agentMode) {
      await runAgent(id, assistant.id, text, system, history, atts);
      return;
    }

    const payloadMessages = [
      { role: "system" as const, content: chatSystem },
      ...history.map((message) => ({ role: message.role, content: message.content })),
      { role: "user" as const, content: text },
    ];

    const controller = new AbortController();
    abortRef.current = controller;
    let assembled = "";
    const startedAt = Date.now();

    await generateStream(
      {
        messages: payloadMessages,
        stream: settings.stream,
        connection: {
          provider: settings.provider,
          model: settings.model,
        },
        params: {
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          topP: settings.topP,
          frequencyPenalty: settings.frequencyPenalty,
          presencePenalty: settings.presencePenalty,
        },
      },
      {
        signal: controller.signal,
        onThinking: () => {
          setThinking(true);
          setAgentPhase("status.thinking");
        },
        onDelta: (chunk) => {
          assembled += chunk;
          setThinking(false);
          setAgentPhase("status.writing");
          patchMessage(id, assistant.id, { content: assembled });
        },
        onDone: () => {
          patchMessage(id, assistant.id, { elapsedMs: Date.now() - startedAt });
          setStreamingId(null);
          setThinking(false);
          setAgentPhase(null);
          abortRef.current = null;
        },
        onError: (message) => {
          patchMessage(id, assistant.id, {
            error: message,
            content: assembled,
            elapsedMs: Date.now() - startedAt,
          });
          setStreamingId(null);
          setThinking(false);
          setAgentPhase(null);
          abortRef.current = null;
        },
      },
    );
  }

  function regenerate() {
    if (!conversation) return;
    const lastUser = [...conversation.messages].reverse().find((item) => item.role === "user");
    if (!lastUser) return;
    const cut = conversation.messages.filter((item) => item.createdAt < lastUser.createdAt);
    useStudio.setState({
      conversations: useStudio.getState().conversations.map((item) =>
        item.id === conversation.id ? { ...item, messages: cut } : item,
      ),
    });
    void run(lastUser.content, cut);
  }

  const composerNode = (
    <Composer
      value={draft}
      onChange={setDraft}
      onSubmit={() => void run(draft)}
      onStop={stop}
      streaming={Boolean(streamingId)}
      attachments={attachments}
      onAttachments={setAttachments}
      sandboxId={conversation?.sandboxId}
      threadId={conversation?.id}
      onUploadSandboxId={setUploadSandboxId}
    />
  );

  return (
    <div
      className="flex h-dvh overflow-hidden bg-background text-foreground"
      data-density={settings.density}
    >
      {sidebarCollapsed ? null : (
        <aside className="hidden h-dvh w-64 shrink-0 border-r border-sidebar-border md:block">
          <Sidebar />
        </aside>
      )}
      <MobileSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      <div
        className="relative flex min-h-0 min-w-0 flex-1 flex-col"
        style={{ backgroundImage: "var(--canvas-wash)" }}
      >
        {sidebarCollapsed ? (
          <button
            type="button"
            aria-label={t["nav.expandSidebar"]}
            onClick={() => setSidebarCollapsed(false)}
            className="absolute top-3.5 left-3 z-10 hidden rounded-lg border border-border bg-card p-2 text-muted-foreground shadow-sm hover:text-foreground md:block"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        ) : null}
        <Header models={models} />
        {messages.length === 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <EmptyState onPick={(prompt) => void run(prompt)} composer={composerNode} />
          </div>
        ) : (
          <>
            <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <MessageList
                messages={messages}
                streamingId={streamingId}
                showMarkdown={settings.showMarkdown}
                onRegenerate={regenerate}
                phase={streamingId ? agentPhase : null}
              />
            </div>
            {composerNode}
          </>
        )}
      </div>
      <SettingsPanel models={models} onModels={setModels} />
    </div>
  );
}
