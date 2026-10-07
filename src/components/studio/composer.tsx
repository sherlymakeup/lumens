import { useEffect, useRef, type KeyboardEvent } from "react";
import { CornerDownLeft, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODE_BY_ID } from "@/lib/modes";
import type { ModeId } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Composer({
  modeId,
  extras,
  onExtras,
  value,
  onChange,
  onSubmit,
  onStop,
  streaming,
  disabled,
}: {
  modeId: ModeId;
  extras: Record<string, string>;
  onExtras: (extras: Record<string, string>) => void;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
}) {
  const mode = MODE_BY_ID[modeId];
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
  }, [value]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const sendOnEnter = document.documentElement.dataset.sendEnter === "1";
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      sendOnEnter
    ) {
      event.preventDefault();
      if (!streaming && value.trim()) onSubmit();
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (!streaming && value.trim()) onSubmit();
    }
  }

  const sendOnEnter = typeof document !== "undefined" && document.documentElement.dataset.sendEnter === "1";

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4">
      <div className="rounded-2xl bg-card p-2 shadow-[var(--shadow-border)]">
        {mode.extras.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-2 pt-1.5 pb-2">
            {mode.extras.map((field) => (
              <label key={field.key} className="flex items-center gap-2">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {field.label}
                </span>
                <Select
                  value={extras[field.key] ?? field.defaultValue}
                  onValueChange={(next) => onExtras({ ...extras, [field.key]: next })}
                >
                  <SelectTrigger className="h-8 w-auto min-w-28 gap-2 bg-transparent px-2.5 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ))}
          </div>
        ) : null}

        <textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={mode.placeholder}
          disabled={disabled}
          rows={3}
          className={cn(
            "max-h-70 min-h-24 w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50",
          )}
        />

        <div className="flex items-center justify-between gap-3 px-2 pt-1 pb-1">
          <p className="text-xs text-muted-foreground">
            {streaming
              ? "Generating…"
              : sendOnEnter
                ? "Enter untuk kirim · Shift + Enter baris baru"
                : "Ctrl/⌘ + Enter untuk kirim"}
          </p>
          {streaming ? (
            <Button variant="outline" onClick={onStop} className="h-10 min-w-22">
              <Square className="size-3.5 fill-current" />
              Stop
            </Button>
          ) : (
            <Button onClick={onSubmit} disabled={disabled || !value.trim()} className="h-10 min-w-22">
              Send
              <CornerDownLeft className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
