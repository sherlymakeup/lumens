import {
  Copy,
  GitFork,
  RefreshCw,
  Share2,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/lib/markdown";
import { useStrings } from "@/lib/i18n";
import { useStudio } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MessageSkeleton } from "./skeleton";

function ActionButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function MessageList({
  messages,
  streamingId,
  showMarkdown,
  onRegenerate,
}: {
  messages: ChatMessage[];
  streamingId: string | null;
  showMarkdown: boolean;
  onRegenerate: () => void;
}) {
  const t = useStrings();
  const activeId = useStudio((s) => s.activeId);
  const patchMessage = useStudio((s) => s.patchMessage);
  const forkConversation = useStudio((s) => s.forkConversation);
  const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant");

  async function copyText(text: string, doneLabel: string) {
    await navigator.clipboard.writeText(text);
    toast.success(doneLabel);
  }

  function toggleFeedback(conversationId: string | null, message: ChatMessage, value: "up" | "down") {
    if (!conversationId) return;
    patchMessage(conversationId, message.id, {
      feedback: message.feedback === value ? undefined : value,
    });
    toast.success(value === "up" ? t["msg.thanks"] : t["msg.noted"]);
  }

  function branch(message: ChatMessage) {
    if (!activeId) return;
    const forked = forkConversation(activeId, message.id);
    if (forked) toast.success(t["msg.branched"]);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-8">
      {messages.map((message, index) => {
        const streaming = streamingId === message.id;
        const empty = streaming && !message.content && !message.error;

        if (message.role === "user") {
          return (
            <article key={message.id} className="enter-up flex justify-end"
              style={{ animationDelay: `${Math.min(index, 4) * 40}ms` }}>
              <div className="max-w-[78%] rounded-2xl rounded-br-md border border-border bg-card px-4 py-2.5">
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
              </div>
            </article>
          );
        }

        return (
          <article
            key={message.id}
            className="enter-up"
            style={{ animationDelay: `${Math.min(index, 4) * 40}ms` }}
          >
            <div className="mb-2 text-[11px] font-medium tracking-wider text-foreground uppercase">
              XDIRGA
            </div>
            {empty ? (
              <div className="space-y-3" aria-live="polite">
                <p className="shimmer-text text-sm font-medium">Thinking…</p>
                <MessageSkeleton />
              </div>
            ) : showMarkdown && !message.error ? (
              <Markdown content={message.content} copyLabel={t["msg.copy"]} />
            ) : (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
            )}
            {streaming && message.content ? <span className="stream-caret" /> : null}
            {message.error ? (
              <p className="mt-2 text-sm text-destructive">{message.error}</p>
            ) : null}
            {!streaming && message.content && !message.error ? (
              <div className="mt-2 flex items-center gap-0.5 transition-opacity md:opacity-40 md:hover:opacity-100 md:focus-within:opacity-100">
                <ActionButton
                  label={t["msg.copy"]}
                  onClick={() => void copyText(message.content, t["eng.copied"])}
                >
                  <Copy className="size-3.5" />
                </ActionButton>
                {lastAssistant?.id === message.id ? (
                  <ActionButton label={t["msg.regenerate"]} onClick={onRegenerate}>
                    <RefreshCw className="size-3.5" />
                  </ActionButton>
                ) : null}
                <ActionButton
                  label={t["msg.good"]}
                  active={message.feedback === "up"}
                  onClick={() => toggleFeedback(activeId, message, "up")}
                >
                  <ThumbsUp className="size-3.5" />
                </ActionButton>
                <ActionButton
                  label={t["msg.bad"]}
                  active={message.feedback === "down"}
                  onClick={() => toggleFeedback(activeId, message, "down")}
                >
                  <ThumbsDown className="size-3.5" />
                </ActionButton>
                <ActionButton label={t["msg.branch"]} onClick={() => branch(message)}>
                  <GitFork className="size-3.5" />
                </ActionButton>
                <ActionButton
                  label={t["msg.share"]}
                  onClick={() => void copyText(message.content, t["msg.shared"])}
                >
                  <Share2 className="size-3.5" />
                </ActionButton>
                {typeof message.elapsedMs === "number" ? (
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                    {(message.elapsedMs / 1000).toFixed(1)}s
                  </span>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
