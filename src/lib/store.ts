import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyDensity, applyFontSize, applyTheme } from "./theme";
import type {
  ChatMessage,
  Conversation,
  CustomModel,
  EngineId,
  Project,
  StudioSettings,
} from "./types";
import { DEFAULT_ENGINE_MODELS, DEFAULT_SETTINGS } from "./types";
import { truncate, uid } from "./utils";
import { newThreadId } from "./thread";

type StudioState = {
  hydrated: boolean;
  settings: StudioSettings;
  conversations: Conversation[];
  activeId: string | null;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  processPanelOpen: boolean;
  settingsOpen: boolean;
  settingsSection: string;
  streamingId: string | null;
  engineModels: Record<EngineId, string>;
  customModels: CustomModel[];
  projects: Project[];
  setHydrated: () => void;
  setSettings: (partial: Partial<StudioSettings>) => void;
  resetSettings: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setProcessPanelOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSettingsSection: (section: string) => void;
  newConversation: () => string;
  forkConversation: (conversationId: string, messageId: string) => string | null;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  patchMessage: (conversationId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  setSandboxId: (conversationId: string, sandboxId: string) => void;
  setStreamingId: (id: string | null) => void;
  clearAll: () => void;
  setEngineModel: (engine: EngineId, model: string) => void;
  addCustomModel: (model: CustomModel) => void;
  removeCustomModel: (id: string) => void;
  createProject: (name: string) => string;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  assignProject: (conversationId: string, projectId: string | null) => void;
};

function applyChrome(settings: StudioSettings) {
  applyTheme(settings.theme);
  applyFontSize(settings.fontSize);
  applyDensity(settings.density);
}

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      settings: DEFAULT_SETTINGS,
      conversations: [],
      activeId: null,
      sidebarOpen: false,
      sidebarCollapsed: false,
      processPanelOpen: false,
      settingsOpen: false,
      settingsSection: "connection",
      streamingId: null,
      engineModels: { ...DEFAULT_ENGINE_MODELS },
      customModels: [],
      projects: [],
      setHydrated: () => {
        applyChrome(get().settings);
        set({ hydrated: true });
      },
      setSettings: (partial) => {
        const settings = { ...get().settings, ...partial };
        applyChrome(settings);
        set({ settings });
      },
      resetSettings: () => {
        applyChrome(DEFAULT_SETTINGS);
        set({ settings: DEFAULT_SETTINGS });
      },
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setProcessPanelOpen: (processPanelOpen) => set({ processPanelOpen }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setSettingsSection: (settingsSection) => set({ settingsSection }),
      newConversation: () => {
        const now = Date.now();
        const conversation: Conversation = {
          id: newThreadId(),
          title: "Untitled",
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          activeId: conversation.id,
          conversations: [conversation, ...state.conversations],
          sidebarOpen: false,
        }));
        return conversation.id;
      },
      forkConversation: (conversationId, messageId) => {
        const source = get().conversations.find((item) => item.id === conversationId);
        if (!source) return null;
        const index = source.messages.findIndex((message) => message.id === messageId);
        if (index < 0) return null;
        const now = Date.now();
        const suffix = get().settings.lang === "id" ? " (cabang)" : " (branch)";
        const forked: Conversation = {
          ...source,
          id: newThreadId(),
          title: `${source.title}${suffix}`,
          messages: source.messages.slice(0, index + 1),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          conversations: [forked, ...state.conversations],
          activeId: forked.id,
          sidebarOpen: false,
        }));
        return forked.id;
      },
      selectConversation: (id) => {
        const found = get().conversations.find((item) => item.id === id);
        if (!found) return;
        set({ activeId: id, sidebarOpen: false });
      },
      deleteConversation: (id) => {
        const { conversations, activeId } = get();
        const next = conversations.filter((item) => item.id !== id);
        const fallback =
          activeId === id
            ? (next[0] ?? null)
            : conversations.find((item) => item.id === activeId) ?? null;
        set({
          conversations: next,
          activeId: fallback?.id ?? null,
        });
      },
      renameConversation: (id, title) => {
        const clean = title.trim().slice(0, 80) || "Untitled";
        set((state) => ({
          conversations: state.conversations.map((item) =>
            item.id === id ? { ...item, title: clean, updatedAt: Date.now() } : item,
          ),
        }));
      },
      addMessage: (conversationId, message) => {
        set((state) => ({
          conversations: state.conversations.map((item) => {
            if (item.id !== conversationId) return item;
            const title =
              item.title === "Untitled" && message.role === "user"
                ? truncate(message.content || "Untitled", 42)
                : item.title;
            return {
              ...item,
              title,
              messages: [...item.messages, message],
              updatedAt: Date.now(),
            };
          }),
        }));
      },
      patchMessage: (conversationId, messageId, patch) => {
        set((state) => ({
          conversations: state.conversations.map((item) =>
            item.id === conversationId
              ? {
                  ...item,
                  updatedAt: Date.now(),
                  messages: item.messages.map((message) =>
                    message.id === messageId ? { ...message, ...patch } : message,
                  ),
                }
              : item,
          ),
        }));
      },
      setStreamingId: (streamingId) => set({ streamingId }),
      setSandboxId: (conversationId, sandboxId) =>
        set((state) => ({
          conversations: state.conversations.map((item) =>
            item.id === conversationId
              ? { ...item, sandboxId, updatedAt: Date.now() }
              : item,
          ),
        })),
      clearAll: () => set({ conversations: [], activeId: null, streamingId: null }),
      setEngineModel: (engine, model) =>
        set((state) => ({ engineModels: { ...state.engineModels, [engine]: model } })),
      addCustomModel: (model) =>
        set((state) =>
          state.customModels.some((item) => item.id === model.id)
            ? state
            : { customModels: [...state.customModels, model] },
        ),
      removeCustomModel: (id) =>
        set((state) => ({ customModels: state.customModels.filter((item) => item.id !== id) })),
      createProject: (name) => {
        const project: Project = { id: uid(), name: name.trim() || "Tanpa nama", createdAt: Date.now() };
        set((state) => ({ projects: [project, ...state.projects] }));
        return project.id;
      },
      renameProject: (id, name) =>
        set((state) => ({
          projects: state.projects.map((item) =>
            item.id === id ? { ...item, name: name.trim() || item.name } : item,
          ),
        })),
      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((item) => item.id !== id),
          conversations: state.conversations.map((item) =>
            item.projectId === id ? { ...item, projectId: null } : item,
          ),
        })),
      assignProject: (conversationId, projectId) =>
        set((state) => ({
          conversations: state.conversations.map((item) =>
            item.id === conversationId ? { ...item, projectId, updatedAt: Date.now() } : item,
          ),
        })),
    }),
    {
      name: "chat-studio-v1",
      partialize: (state) => ({
        settings: state.settings,
        // Conversations TIDAK lagi di localStorage — pindah ke Supabase per-user
        // (lihat useConversationsSync). Hanya settings & preferensi device yang lokal.
        activeId: state.activeId,
        engineModels: state.engineModels,
        customModels: state.customModels,
        projects: state.projects,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

