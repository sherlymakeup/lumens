import { useRef, useState } from "react";
import { Loader2, Play, Square, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateStream, runSandboxCommand, type SandboxResult } from "@/lib/generate";
import { Markdown } from "@/lib/markdown";
import { useStudio } from "@/lib/store";
import { useStrings } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EngineShell } from "../engine-shell";

const SYSTEM =
  "You are XDIRGA Code, a senior engineer. Write correct, minimal code with fenced blocks and a language tag. Explain only what is necessary. Call out edge cases. When the user wants to run something, give the exact shell command they can paste into the sandbox panel.";

type ChatEntry = { role: "user" | "assistant"; content: string };

export function CodeEngine() {
  const engineModel = useStudio((s) => s.engineModels.code);
  const settings = useStudio((s) => s.settings);

  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const t = useStrings();
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const [command, setCommand] = useState("");
  const [sandboxBusy, setSandboxBusy] = useState(false);
  const [sandboxLog, setSandboxLog] = useState<(SandboxResult & { command: string })[]>([]);

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setStreaming("");
  }

  async function ask() {
    const text = draft.trim();
    if (!text || busy) return;
    const model = engineModel || settings.model;
    if (!model) {
      toast.error(t["eng.noModel"]);
      return;
    }
    setBusy(true);
    setDraft("");
    setEntries((prev) => [...prev, { role: "user", content: text }]);
    const controller = new AbortController();
    abortRef.current = controller;
    let assembled = "";
    await generateStream(
      {
        messages: [
          { role: "system", content: SYSTEM },
          ...entries.map((e) => ({ role: e.role, content: e.content })),
          { role: "user" as const, content: text },
        ],
        stream: true,
        connection: { provider: settings.provider, model },
        params: {
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          topP: settings.topP,
          frequencyPenalty: settings.frequencyPenalty,
          presencePenalty: settings.presencePenalty,
        },
      },
      {
        signal: controller.signal,
        onDelta: (chunk) => {
          assembled += chunk;
          setStreaming(assembled);
        },
        onDone: () => {
          setEntries((prev) => [...prev, { role: "assistant", content: assembled }]);
          setStreaming("");
          setBusy(false);
          abortRef.current = null;
        },
        onError: (message) => {
          toast.error(message);
          setStreaming("");
          setBusy(false);
          abortRef.current = null;
        },
      },
    );
  }

  async function runCommand() {
    const cmd = command.trim();
    if (!cmd || sandboxBusy) return;
    setSandboxBusy(true);
    try {
      const result = await runSandboxCommand(cmd);
      setSandboxLog((prev) => [{ ...result, command: cmd }, ...prev].slice(0, 20));
      setCommand("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sandbox gagal.");
    } finally {
      setSandboxBusy(false);
    }
  }

  return (
    <EngineShell
      kicker={t["eng.kicker"]}
      title={t["eng.codeTitle"]}
      subtitle={t["eng.codeSubtitle"]}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex min-h-[420px] flex-col rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-2.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Chat · <span className="font-mono normal-case">{engineModel || t["eng.noModelShort"]}</span>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {entries.length === 0 && !streaming && (
              <p className="text-sm text-muted-foreground">
                {t["eng.askCode"]}
              </p>
            )}
            {entries.map((entry, i) => (
              <div key={i} className={cn(entry.role === "user" ? "text-right" : "text-left")}>
                <div
                  className={cn(
                    "inline-block max-w-full rounded-xl px-3 py-2 text-left text-sm",
                    entry.role === "user" ? "bg-primary/15" : "bg-muted/50",
                  )}
                >
                  {entry.role === "user" ? (
                    <span className="whitespace-pre-wrap">{entry.content}</span>
                  ) : (
                    <Markdown content={entry.content} />
                  )}
                </div>
              </div>
            ))}
            {streaming && (
              <div className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
                <Markdown content={streaming} />
              </div>
            )}
          </div>
          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask();
                  }
                }}
                placeholder={t["eng.codePlaceholder"]}
                rows={2}
                className="resize-none"
                aria-label={t["eng.codePlaceholder"]}
              />
              {busy ? (
                <Button variant="outline" size="icon" onClick={stop} aria-label="Berhenti">
                  <Square className="size-4" />
                </Button>
              ) : (
                <Button onClick={() => void ask()} disabled={!draft.trim()}>
                  {t["eng.send"]}
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="flex min-h-[420px] flex-col rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            <Terminal className="size-3.5" /> Novita Sandbox
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-black/40 p-4 font-mono text-xs">
            {sandboxLog.length === 0 && (
              <p className="text-muted-foreground">
                {t["eng.sandboxHint"]}{" "}
                <span className="text-foreground">node -v</span>
              </p>
            )}
            {sandboxLog.map((item, i) => (
              <div key={`${item.command}-${i}`} className="space-y-1">
                <p className="text-emerald-400">$ {item.command}</p>
                {item.stdout && (
                  <pre className="whitespace-pre-wrap text-foreground/90">{item.stdout}</pre>
                )}
                {item.stderr && (
                  <pre className="whitespace-pre-wrap text-red-400">{item.stderr}</pre>
                )}
                <p className="text-muted-foreground">exit: {item.exitCode}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <Input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runCommand();
                }}
                placeholder="node -v"
                className="font-mono"
                aria-label="Perintah sandbox"
              />
              <Button
                onClick={() => void runCommand()}
                disabled={!command.trim() || sandboxBusy}
                className="gap-1.5"
              >
                {sandboxBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                Run
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t["eng.sandboxNeedKey"]}
            </p>
          </div>
        </section>
      </div>
    </EngineShell>
  );
}
