import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Bot, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStrings } from "@/lib/i18n";
import { MODE_BY_ID } from "@/lib/modes";
import { useStudio } from "@/lib/store";
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
  const model = useStudio((s) => s.settings.model);
  const agentMode = useStudio((s) => s.settings.agentMode);
  const setSettings = useStudio((s) => s.setSettings);
  const t = useStrings();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
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

  return (
    <div className="mx-auto w-full max-w-3xl shrink-0 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4">
      <div
        data-focus={focus}
        className={cn(
          "rounded-2xl border border-border bg-card shadow-[var(--shadow-border)] transition-[border-color,box-shadow] duration-200",
          "data-[focus=true]:border-primary/60 data-[focus=true]:ring-4 data-[focus=true]:ring-primary/15",
        )}
      >
        {mode.extras.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-3 pt-2.5">
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
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={mode.placeholder}
          disabled={disabled}
          rows={1}
          className="max-h-55 min-h-10 w-full resize-none bg-transparent px-4 pt-2.5 pb-1 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />

        <div className="flex flex-wrap items-center gap-2 px-2 pt-1.5 pb-2">
          <span className="ml-1 hidden min-w-0 items-center gap-1.5 sm:inline-flex">
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
            <span className="truncate font-mono text-[11px] text-muted-foreground">
              {model || t["header.noModels"]}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setSettings({ agentMode: !agentMode })}
            data-on={agentMode}
            title={t["eng.agentHint"]}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
              agentMode
                ? "border-primary/60 bg-primary/15 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Bot className="size-3.5" />
            {t["eng.agent"]}
          </button>
          <div className="flex-1" />
          {streaming ? (
            <Button variant="outline" onClick={onStop} className="h-9 gap-1.5 px-3.5">
              <Square className="size-3.5 fill-current" />
              {t["eng.stop"]}
            </Button>
          ) : (
            <Button
              onClick={onSubmit}
              disabled={disabled || !value.trim()}
              className="h-9 gap-1.5 px-3.5"
            >
              {t["eng.send"]}
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 truncate text-center font-mono text-[11px] text-muted-foreground">
        XDIRGA TOOLS · {model || t["header.noModels"]}
      </p>
    </div>
  );
}
