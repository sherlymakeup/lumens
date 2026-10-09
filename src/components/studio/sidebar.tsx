import { useState } from "react";
import {
  Blocks,
  Bot,
  Code2,
  FolderKanban,
  LayoutDashboard,
  LayoutTemplate,
  Palette,
  PanelLeftClose,
  PenLine,
  Pencil,
  Plug,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useStrings, type StringKey } from "@/lib/i18n";

/** Nav utama ala Grok: Agent (= Chat di Grok), lalu Dasbor. */
const MAIN_NAV = [
  { to: "/", labelKey: "nav.chat", Icon: Bot },
  { to: "/dashboard", labelKey: "nav.dashboard", Icon: LayoutDashboard },
] as const;

/** Engine — setara Imagine/Library/Automations di Grok. */
const ENGINE_NAV = [
  { to: "/engines/content", labelKey: "eng.contentTitle", Icon: PenLine },
  { to: "/engines/design", labelKey: "eng.designTitle", Icon: Palette },
  { to: "/engines/prototype", labelKey: "eng.prototypeTitle", Icon: LayoutTemplate },
  { to: "/engines/code", labelKey: "eng.codeTitle", Icon: Code2 },
] as const;

/** Kelola — setara Projects/Plugins di Grok. */
const MANAGE_NAV = [
  { to: "/projects", labelKey: "proj.title", Icon: FolderKanban },
  { to: "/connection", labelKey: "conn.title", Icon: Plug },
  { to: "/connectors", labelKey: "ctr.title", Icon: Blocks },
] as const;

function NavLinks({
  items,
  onNavigate,
}: {
  items: readonly { to: string; labelKey: StringKey; Icon: typeof LayoutDashboard }[];
  onNavigate: () => void;
}) {
  const t = useStrings();
  return (
    <nav className="space-y-0.5 pb-4">
      {items.map(({ to, labelKey, Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeProps={{
            className:
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm bg-sidebar-accent text-foreground",
          }}
          inactiveProps={{
            className:
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground transition-colors duration-150",
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm"
        >
          <Icon className="size-4 shrink-0" strokeWidth={1.7} />
          <span className="min-w-0 flex-1 truncate">{t[labelKey]}</span>
        </Link>
      ))}
    </nav>
  );
}

function NavHeading({ children }: { children: string }) {
  return (
    <p className="px-2 pt-1 pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/** Daftar riwayat chat ala Grok ("Chats") — pindah dari popover header ke sidebar. */
function ChatList({ onNavigate }: { onNavigate: () => void }) {
  const t = useStrings();
  const navigate = useNavigate();
  const conversations = useStudio((s) => s.conversations);
  const activeId = useStudio((s) => s.activeId);
  const selectConversation = useStudio((s) => s.selectConversation);
  const deleteConversation = useStudio((s) => s.deleteConversation);
  const renameConversation = useStudio((s) => s.renameConversation);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  function commitRename(id: string) {
    if (editingId !== id) return;
    renameConversation(id, editingTitle);
    setEditingId(null);
  }

  const q = query.trim().toLowerCase();
  const items = [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((c) => (q ? c.title.toLowerCase().includes(q) : true))
    .slice(0, 30);

  return (
    <div className="pb-4">
      <div className="flex items-center justify-between pr-1">
        <NavHeading>{t["nav.chats"]}</NavHeading>
        <button
          type="button"
          aria-label="Search chats"
          onClick={() => setSearching((v) => !v)}
          className="mb-1 rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <Search className="size-3.5" />
        </button>
      </div>
      {searching ? (
        <div className="px-1 pb-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t["nav.searchChats"]}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      ) : null}
      <div className="space-y-0.5">
        {items.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-muted-foreground">{t["nav.noDrafts"]}</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "group flex items-center rounded-lg pr-1",
                item.id === activeId ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/70",
              )}
            >
              {editingId === item.id ? (
                <input
                  autoFocus
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => commitRename(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(item.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="min-w-0 flex-1 truncate bg-transparent px-2.5 py-2 text-left text-sm outline-none"
                  aria-label="Rename conversation"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    selectConversation(item.id);
                    navigate({ to: "/thread/$threadId", params: { threadId: item.id } });
                    onNavigate();
                  }}
                  className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm"
                  title={item.title}
                >
                  {item.title}
                </button>
              )}
              <button
                type="button"
                aria-label="Rename"
                onClick={() => {
                  setEditingId(item.id);
                  setEditingTitle(item.title);
                }}
                className="rounded-md p-2 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={t["nav.deleteDraft"]}
                onClick={() => {
                  if (window.confirm(t["nav.deleteConfirm"])) deleteConversation(item.id);
                }}
                className="rounded-md p-2 text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function Sidebar({ className }: { className?: string }) {
  const newConversation = useStudio((s) => s.newConversation);
  const setSidebarOpen = useStudio((s) => s.setSidebarOpen);
  const setSidebarCollapsed = useStudio((s) => s.setSidebarCollapsed);
  const setSettingsOpen = useStudio((s) => s.setSettingsOpen);
  const navigate = useNavigate();
  const t = useStrings();
  const close = () => setSidebarOpen(false);

  function handleNewChat() {
    const id = newConversation();
    // Navigasi eksplisit: sidebar dipakai di semua halaman, bukan cuma chat.
    navigate({ to: "/thread/$threadId", params: { threadId: id } });
    close();
  }

  return (
    <div className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", className)}>
      {/* Bar atas ala Grok: collapse kiri, logo, search kanan */}
      <div className="flex items-center gap-2 px-3 pt-4 pb-3">
        <button
          type="button"
          aria-label={t["nav.collapseSidebar"]}
          onClick={() => setSidebarCollapsed(true)}
          className="hidden rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground md:block"
        >
          <PanelLeftClose className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-display truncate text-lg leading-none tracking-tight">
            XDIRGA <span className="text-primary">TOOLS</span>
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <Button className="w-full justify-center" onClick={handleNewChat}>
          <Plus className="size-4" />
          {t["nav.newChat"]}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        <NavLinks items={MAIN_NAV} onNavigate={close} />
        <NavHeading>{t["nav.engines"]}</NavHeading>
        <NavLinks items={ENGINE_NAV} onNavigate={close} />
        <NavHeading>{t["nav.projects"]}</NavHeading>
        <NavLinks items={MANAGE_NAV} onNavigate={close} />
        <ChatList onNavigate={close} />
      </ScrollArea>

      {/* Bawah ala Grok: settings + user */}
      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={() => {
            setSettingsOpen(true);
            close();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent/70 hover:text-foreground"
        >
          <Settings2 className="size-4 shrink-0" strokeWidth={1.7} />
          <span className="min-w-0 flex-1 truncate">{t["nav.settings"]}</span>
        </button>
      </div>
    </div>
  );
}
