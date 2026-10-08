import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MODE_BY_ID, defaultExtras } from "./modes";
import { applyDensity, applyFontSize, applyTheme } from "./theme";
import type {
  ChatMessage,
  Conversation,
  CustomModel,
  EngineId,
  ModeId,
  Project,
  StudioSettings,
} from "./types";
import { DEFAULT_ENGINE_MODELS, DEFAULT_SETTINGS } from "./types";
import { truncate, uid } from "./utils";

type StudioState = {
  hydrated: boolean;
  settings: StudioSettings;
  conversations: Conversation[];
  activeId: string | null;
  modeId: ModeId;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  settingsSection: string;
  streamingId: string | null;
  engineModels: Record<EngineId, string>;
  customModels: CustomModel[];
  projects: Project[];
  setHydrated: () => void;
  setSettings: (partial: Partial<StudioSettings>) => void;
  resetSettings: () => void;
  setMode: (modeId: ModeId) => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSettingsSection: (section: string) => void;
  newConversation: (modeId?: ModeId) => string;
  forkConversation: (conversationId: string, messageId: string) => string | null;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  setExtras: (conversationId: string, extras: Record<string, string>) => void;
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
      modeId: "write",
      sidebarOpen: false,
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
      setMode: (modeId) => {
        const existing = get()
          .conversations.filter((item) => item.modeId === modeId)
          .sort((a, b) => b.updatedAt - a.updatedAt)[0];
        set({
          modeId,
          activeId: existing?.id ?? null,
          sidebarOpen: false,
        });
      },
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setSettingsSection: (settingsSection) => set({ settingsSection }),
      newConversation: (modeId) => {
        const mode = modeId ?? get().modeId;
        const now = Date.now();
        const conversation: Conversation = {
          id: uid(),
          modeId: mode,
          title: "Untitled",
          extras: defaultExtras(mode),
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          modeId: mode,
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
          id: uid(),
          title: `${source.title}${suffix}`,
          messages: source.messages.slice(0, index + 1),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          conversations: [forked, ...state.conversations],
          activeId: forked.id,
          modeId: forked.modeId,
          sidebarOpen: false,
        }));
        return forked.id;
      },
      selectConversation: (id) => {
        const found = get().conversations.find((item) => item.id === id);
        if (!found) return;
        set({ activeId: id, modeId: found.modeId, sidebarOpen: false });
      },
      deleteConversation: (id) => {
        const { conversations, activeId, modeId } = get();
        const next = conversations.filter((item) => item.id !== id);
        const fallback =
          activeId === id
            ? (next.find((item) => item.modeId === modeId) ?? next[0] ?? null)
            : conversations.find((item) => item.id === activeId) ?? null;
        set({
          conversations: next,
          activeId: fallback?.id ?? null,
          modeId: fallback?.modeId ?? modeId,
        });
      },
      setExtras: (conversationId, extras) => {
        set((state) => ({
          conversations: state.conversations.map((item) =>
            item.id === conversationId ? { ...item, extras, updatedAt: Date.now() } : item,
          ),
        }));
      },
      addMessage: (conversationId, message) => {
        set((state) => ({
          conversations: state.conversations.map((item) => {
            if (item.id !== conversationId) return item;
            const title =
              item.title === "Untitled" && message.role === "user"
                ? truncate(message.content || MODE_BY_ID[item.modeId].label, 42)
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
            item.id === conversationId ? { ...item, sandboxId } : item,
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
        // Tool-call images are base64 data URLs (MBs) — drop them on persist
        // to avoid blowing the localStorage quota; text summaries stay.
        conversations: state.conversations.map((conv) => ({
          ...conv,
          messages: conv.messages.map((message) => ({
            ...message,
            toolCalls: message.toolCalls?.map(({ images: _dropped, ...rest }) => rest),
          })),
        })),
        activeId: state.activeId,
        modeId: state.modeId,
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

export function activeConversation() {
  const { conversations, activeId } = useStudio.getState();
  return conversations.find((item) => item.id === activeId) ?? null;
}
