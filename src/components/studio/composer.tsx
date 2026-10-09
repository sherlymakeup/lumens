import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Bot, Loader2, Paperclip, Square, X } from "lucide-react";
import { toast } from "sonner";
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
import type { ChatAttachment, ModeId } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_CLIENT_BYTES = 10 * 1024 * 1024;

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
  attachments,
  onAttachments,
  sandboxId,
  threadId,
  onUploadSandboxId,
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
  attachments: ChatAttachment[];
  onAttachments: (next: ChatAttachment[]) => void;
  sandboxId?: string;
  threadId?: string;
  onUploadSandboxId?: (sandboxId: string) => void;
}) {
  const mode = MODE_BY_ID[modeId];
  const model = useStudio((s) => s.settings.model);
  const agentMode = useStudio((s) => s.settings.agentMode);
  const setSettings = useStudio((s) => s.setSettings);
  const t = useStrings();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focus, setFocus] = useState(false);

  // Native auto-size where supported (Chrome 123+, Safari 18.4+): the
  // textarea hugs its content — exactly 1 line when empty. JS fallback
  // keeps old browsers growing instead of staying a fixed single line.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof CSS !== "undefined" && CSS.supports("field-sizing", "content")) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  function readAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result ?? "");
        const i = url.indexOf(",");
        resolve(i >= 0 ? url.slice(i + 1) : url);
      };
      reader.onerror = () => reject(new Error("gagal baca file"));
      reader.readAsDataURL(file);
    });
  }

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0 || uploading || disabled) return;
    const files = [...list].slice(0, 5 - attachments.length);
    if (files.length === 0) {
      toast.error(t["cmp.maxAttachments"]);
      return;
    }
    setUploading(true);
    try {
      const next = [...attachments];
      for (const file of files) {
        // Per-file try/catch: satu file gagal tidak membuang file lain yang sukses
        try {
          if (file.size > MAX_CLIENT_BYTES) {
            toast.error(`"${file.name}" ${t["cmp.fileTooBig"]}`);
            continue;
          }
          const base64 = await readAsBase64(file);
          const res = await fetch("/api/agent/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sandboxId,
              threadId,
              name: file.name,
              mime: file.type || "application/octet-stream",
              base64,
            }),
          });
          const body = (await res.json().catch(() => null)) as {
            ok?: boolean;
            sandboxId?: string;
            attachment?: ChatAttachment;
            error?: string;
          } | null;
          if (!res.ok || !body?.ok || !body.attachment) {
            toast.error(body?.error ?? `Gagal upload "${file.name}".`);
            continue;
          }
          next.push(body.attachment);
          // Upload bisa membuat sandbox baru — propagasi ID-nya agar request
          // agent nanti memakai sandbox yang sama (file tidak "hilang").
          if (body.sandboxId) onUploadSandboxId?.(body.sandboxId);
        } catch {
          toast.error(`${t["cmp.uploadFailed"]} "${file.name}".`);
        }
      }
      onAttachments(next);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const canSend = value.trim() || attachments.length > 0;
    const sendOnEnter = document.documentElement.dataset.sendEnter === "1";
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      sendOnEnter
    ) {
      event.preventDefault();
      if (!streaming && canSend) onSubmit();
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (!streaming && canSend) onSubmit();
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
                  {t[field.label]}
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
                        {t[option.label]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ))}
          </div>
        ) : null}

        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
            {attachments.map((a) => (
              <span
                key={a.path}
                className="inline-flex max-w-45 items-center gap-1.5 rounded-full border border-border bg-muted/60 py-1 pr-1.5 pl-2.5 text-xs"
              >
                <Paperclip className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{a.name}</span>
                <button
                  type="button"
                  onClick={() => onAttachments(attachments.filter((x) => x.path !== a.path))}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Hapus ${a.name}`}
                >
                  <X className="size-3" />
                </button>
              </span>
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
          placeholder={t[mode.placeholder]}
          disabled={disabled}
          rows={1}
          className="max-h-55 w-full resize-none overflow-y-auto bg-transparent px-4 py-2 text-[15px] leading-relaxed text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground disabled:opacity-50"
        />

        <div className="flex flex-wrap items-center gap-2 px-2 pt-1.5 pb-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || uploading || streaming || attachments.length >= 5 || !agentMode}
            title={agentMode ? t["cmp.attachFile"] : t["cmp.attachAgentOnly"]}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Paperclip className="size-3.5" />
            )}
          </button>
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
              disabled={disabled || (!value.trim() && attachments.length === 0)}
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
