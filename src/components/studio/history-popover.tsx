import { useEffect, useState } from "react";
import { History, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/store";
import { useStrings } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Riwayat percakapan — popover di kanan atas header, samping tombol settings. */
export function HistoryPopover() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const conversations = useStudio((s) => s.conversations);
  const activeId = useStudio((s) => s.activeId);
  const newConversation = useStudio((s) => s.newConversation);
  const selectConversation = useStudio((s) => s.selectConversation);
  const deleteConversation = useStudio((s) => s.deleteConversation);
  const renameConversation = useStudio((s) => s.renameConversation);
  const t = useStrings();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  function commitRename(id: string) {
    if (editingId !== id) return;
    renameConversation(id, editingTitle);
    setEditingId(null);
  }

  const recent = [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 20);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label={t["nav.history"]}
        title={t["nav.history"]}
        onClick={() => setOpen((v) => !v)}
      >
        <History className="size-4" />
      </Button>
      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute top-[calc(100%+8px)] right-0 z-50 flex max-h-[60vh] w-80 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {t["nav.history"]}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={t["nav.newChat"]}
                title={t["nav.newChat"]}
                onClick={() => {
                  newConversation();
                  setOpen(false);
                }}
              >
                <Plus className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
              {recent.length === 0 ? (
                <p className="px-2.5 py-4 text-center text-xs text-muted-foreground">
                  {t["nav.noDrafts"]}
                </p>
              ) : (
                recent.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "group flex items-center rounded-lg pr-1",
                      item.id === activeId ? "bg-accent" : "hover:bg-accent/60",
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
                          setOpen(false);
                        }}
                        className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm"
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
                      className="rounded-md p-2 text-muted-foreground transition-opacity hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={t["nav.deleteDraft"]}
                      onClick={() => {
                        if (window.confirm("Hapus percakapan ini?")) deleteConversation(item.id);
                      }}
                      className="rounded-md p-2 text-muted-foreground transition-opacity hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
