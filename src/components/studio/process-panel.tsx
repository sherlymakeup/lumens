import {
  Brain,
  FileDown,
  Image as ImageIcon,
  Search,
  Terminal,
  X,
} from "lucide-react";
import { useStudio } from "@/lib/store";
import { useStrings } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

/** Panel kanan: proses sandbox/tool agent. Auto-muncul saat tool call pertama.
 *  Isi = pindahan render toolCalls yang dulu inline di messages.tsx. */
export function ProcessPanel() {
  const t = useStrings();
  const setProcessPanelOpen = useStudio((s) => s.setProcessPanelOpen);
  const conversations = useStudio((s) => s.conversations);
  const activeId = useStudio((s) => s.activeId);
  const streamingId = useStudio((s) => s.streamingId);

  const conversation = conversations.find((c) => c.id === activeId) ?? null;
  const messages = conversation?.messages ?? [];
  // Saat streaming: tampilkan pesan yang sedang jalan. Sesudahnya: pesan
  // assistant terakhir yang punya tool calls (riwayat run tetap bisa dilihat).
  const target: ChatMessage | undefined = streamingId
    ? messages.find((m) => m.id === streamingId)
    : [...messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0);

  const toolCalls = target?.toolCalls ?? [];
  const running = Boolean(streamingId && target?.id === streamingId);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-3">
        <Terminal className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {t["proc.title"]}
        </span>
        {running ? (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            {t["proc.running"]}
          </span>
        ) : null}
        <button
          type="button"
          aria-label={t["proc.close"]}
          onClick={() => setProcessPanelOpen(false)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {toolCalls.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            {t["proc.empty"]}
          </p>
        ) : (
          <div className="space-y-2">
            {toolCalls.map((tc, tcIndex) => {
              const KindIcon =
                tc.kind === "search"
                  ? Search
                  : tc.kind === "image"
                    ? ImageIcon
                    : tc.kind === "memory"
                      ? Brain
                      : tc.kind === "file"
                        ? FileDown
                        : Terminal;
              return (
                <details
                  key={tcIndex}
                  className="group rounded-xl border border-border bg-card/60 text-[13px]"
                  open={tcIndex === toolCalls.length - 1}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
                    <KindIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {tc.command}
                    </span>
                    <span
                      className={cn(
                        "ml-auto shrink-0 font-mono text-[11px]",
                        tc.exitCode === 0 ? "text-emerald-500" : "text-destructive",
                      )}
                    >
                      exit {tc.exitCode}
                    </span>
                  </summary>
                  {tc.images && tc.images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 border-t border-border p-2">
                      {tc.images.map((src, imgIndex) => (
                        <img
                          key={imgIndex}
                          src={src}
                          alt=""
                          className="w-full rounded-lg border border-border object-contain"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  ) : null}
                  {tc.files && tc.files.length > 0 ? (
                    <div className="space-y-2 border-t border-border p-2">
                      {tc.files.map((file, fileIndex) => (
                        <a
                          key={fileIndex}
                          href={`data:${file.mime};base64,${file.base64}`}
                          download={file.name}
                          className="flex items-center gap-3 rounded-lg border border-border bg-background/60 px-3 py-2.5 transition-colors hover:border-primary/50"
                        >
                          <FileDown className="size-5 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {file.name}
                            </span>
                            <span className="block font-mono text-[11px] text-muted-foreground">
                              {file.size >= 1048576
                                ? `${(file.size / 1048576).toFixed(1)} MB`
                                : `${(file.size / 1024).toFixed(1)} KB`}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-primary">
                            {t["msg.download"] ?? "Unduh"}
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <pre className="max-h-64 overflow-auto border-t border-border px-3 py-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                    {tc.output || t["msg.noOutput"]}
                  </pre>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
