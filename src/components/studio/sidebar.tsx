import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MODES } from "@/lib/modes";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MODE_ICONS } from "./icons";
import { LumenMark } from "./mark";

export function Sidebar({ className }: { className?: string }) {
  const modeId = useStudio((s) => s.modeId);
  const conversations = useStudio((s) => s.conversations);
  const activeId = useStudio((s) => s.activeId);
  const setMode = useStudio((s) => s.setMode);
  const newConversation = useStudio((s) => s.newConversation);
  const selectConversation = useStudio((s) => s.selectConversation);
  const deleteConversation = useStudio((s) => s.deleteConversation);

  const recent = conversations
    .filter((item) => item.modeId === modeId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 18);

  return (
    <div className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", className)}>
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <LumenMark />
        <div>
          <div className="font-display text-xl leading-none tracking-tight">Lumen</div>
          <div className="mt-1 text-[11px] tracking-wide text-muted-foreground uppercase">
            Studio
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <Button className="w-full justify-center" onClick={() => newConversation()}>
          <Plus className="size-4" />
          New {MODES.find((mode) => mode.id === modeId)?.label}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        <p className="px-2 pt-1 pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          Menus
        </p>
        <nav className="space-y-0.5 pb-4">
          {MODES.map((mode) => {
            const Icon = MODE_ICONS[mode.id];
            const active = mode.id === modeId;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setMode(mode.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150",
                  active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.7} />
                <span className="min-w-0 flex-1 truncate">{mode.label}</span>
                <span className="hidden text-[11px] text-muted-foreground lg:inline">
                  {mode.hint}
                </span>
              </button>
            );
          })}
        </nav>

        <p className="px-2 pt-2 pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          This menu
        </p>
        <div className="space-y-0.5 pb-6">
          {recent.length === 0 ? (
            <p className="px-2.5 py-3 text-xs text-muted-foreground">No drafts yet.</p>
          ) : (
            recent.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "group flex items-center rounded-lg pr-1",
                  item.id === activeId ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/70",
                )}
              >
                <button
                  type="button"
                  onClick={() => selectConversation(item.id)}
                  className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm"
                >
                  {item.title}
                </button>
                <button
                  type="button"
                  aria-label="Delete draft"
                  onClick={() => deleteConversation(item.id)}
                  className="rounded-md p-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
