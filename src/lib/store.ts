import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MODE_BY_ID, defaultExtras } from "./modes";
import { applyDensity, applyFontSize, applyTheme } from "./theme";
import type { ChatMessage, Conversation, ModeId, StudioSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
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
  setHydrated: () => void;
  setSettings: (partial: Partial<StudioSettings>) => void;
  resetSettings: () => void;
  setMode: (modeId: ModeId) => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSettingsSection: (section: string) => void;
  newConversation: (modeId?: ModeId) => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  setExtras: (conversationId: string, extras: Record<string, string>) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  patchMessage: (conversationId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  setStreamingId: (id: string | null) => void;
  clearAll: () => void;
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
      clearAll: () => set({ conversations: [], activeId: null, streamingId: null }),
    }),
    {
      name: "chat-studio-v1",
      partialize: (state) => ({
        settings: state.settings,
        conversations: state.conversations,
        activeId: state.activeId,
        modeId: state.modeId,
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
