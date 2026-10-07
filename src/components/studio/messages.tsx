import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/lib/markdown";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MessageSkeleton } from "./skeleton";

export function MessageList({
  messages,
  streamingId,
  thinking,
  showMarkdown,
  onRegenerate,
}: {
  messages: ChatMessage[];
  streamingId: string | null;
  thinking: boolean;
  showMarkdown: boolean;
  onRegenerate: () => void;
}) {
  const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-8">
      {messages.map((message, index) => {
        const streaming = streamingId === message.id;
        const empty = streaming && !message.content && !message.error;
        return (
          <article
            key={message.id}
            className="enter-up"
            style={{ animationDelay: `${Math.min(index, 4) * 40}ms` }}
          >
            <div
              className={cn(
                "mb-2 text-[11px] font-medium tracking-wider uppercase",
                message.role === "user" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {message.role === "user" ? "You" : "Lumen"}
            </div>
            {empty ? (
              thinking ? (
                <p className="shimmer-text text-sm">Thinking</p>
              ) : (
                <MessageSkeleton />
              )
            ) : message.role === "assistant" && showMarkdown && !message.error ? (
              <Markdown content={message.content} />
            ) : (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
            )}
            {streaming && message.content ? <span className="stream-caret" /> : null}
            {message.error ? (
              <p className="mt-2 text-sm text-destructive">{message.error}</p>
            ) : null}
            {message.role === "assistant" && !streaming && message.content ? (
              <div className="mt-3 flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground"
                  onClick={async () => {
                    await navigator.clipboard.writeText(message.content);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="size-3.5" />
                  Copy
                </Button>
                {lastAssistant?.id === message.id ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-muted-foreground"
                    onClick={onRegenerate}
                  >
                    <RefreshCw className="size-3.5" />
                    Regen
                  </Button>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
