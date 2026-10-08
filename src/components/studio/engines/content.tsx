import { useRef, useState } from "react";
import { Copy, Loader2, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateStream } from "@/lib/generate";
import { Markdown } from "@/lib/markdown";
import { useStudio } from "@/lib/store";
import { useStrings } from "@/lib/i18n";
import { EngineShell } from "../engine-shell";

const PRESETS = [
  {
    id: "artikel",
    label: "Artikel",
    system:
      "You are XDIRGA Content. Write a complete, well-structured article in markdown. Lead with the piece itself, no preamble. Prefer concrete language.",
  },
  {
    id: "copy",
    label: "Copy landing",
    system:
      "You are XDIRGA Content. Write punchy landing-page copy: headline, subheadline, 3 benefit bullets, and one CTA. No fluff.",
  },
  {
    id: "email",
    label: "Email",
    system:
      "You are XDIRGA Content. Draft a ready-to-send email with a subject line. Human and specific, no padded greetings.",
  },
  {
    id: "translate",
    label: "Terjemahan",
    system:
      "You are XDIRGA Content. Translate faithfully to the requested language. Preserve tone and proper nouns. Return the translation first.",
  },
] as const;

export function ContentEngine() {
  const engineModel = useStudio((s) => s.engineModels.content);
  const settings = useStudio((s) => s.settings);
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [brief, setBrief] = useState("");
  const t = useStrings();
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  const presetLabels: Record<string, string> = {
    artikel: t["eng.preset.article"],
    copy: t["eng.preset.copy"],
    email: t["eng.preset.email"],
    translate: t["eng.preset.translate"],
  };

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }

  async function run() {
    const text = brief.trim();
    if (!text || busy) return;
    const model = engineModel || settings.model;
    if (!model) {
      toast.error(t["eng.noModel"]);
      return;
    }
    setBusy(true);
    setError(null);
    setOutput("");
    const controller = new AbortController();
    abortRef.current = controller;
    let assembled = "";
    await generateStream(
      {
        messages: [
          { role: "system", content: preset.system },
          { role: "user", content: text },
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
          setOutput(assembled);
        },
        onDone: () => {
          setBusy(false);
          abortRef.current = null;
        },
        onError: (message) => {
          setError(message);
          setBusy(false);
          abortRef.current = null;
        },
      },
    );
  }

  return (
    <EngineShell
      kicker={t["eng.kicker"]}
      title={t["eng.contentTitle"]}
      subtitle={t["eng.contentSubtitle"]}
    >
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            variant={p.id === presetId ? "default" : "outline"}
            size="sm"
            onClick={() => setPresetId(p.id)}
          >
            {presetLabels[p.id] ?? p.label}
          </Button>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-border bg-card p-4">
        <Textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={t["eng.briefContent"]}
          rows={4}
          aria-label={t["eng.briefContent"]}
        />
        <div className="mt-3 flex items-center gap-2">
          {busy ? (
            <Button variant="outline" onClick={stop} className="gap-1.5">
              <Square className="size-4" /> {t["eng.stop"]}
            </Button>
          ) : (
            <Button onClick={() => void run()} disabled={!brief.trim()} className="gap-1.5">
              <Sparkles className="size-4" /> {t["eng.generate"]}
            </Button>
          )}
          <span className="truncate font-mono text-xs text-muted-foreground">
            {engineModel || settings.model || t["eng.noModelShort"]}
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
          {error}
        </div>
      )}

      {(output || busy) && (
        <div className="mt-3 rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {t["eng.result"]}
            </span>
            {output && !busy && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5"
                onClick={() => {
                  void navigator.clipboard.writeText(output);
                  toast.success(t["eng.copied"]);
                }}
              >
                <Copy className="size-3.5" /> {t["eng.copy"]}
              </Button>
            )}
          </div>
          {output ? (
            <Markdown content={output} />
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {t["eng.writing"]}
            </p>
          )}
        </div>
      )}
    </EngineShell>
  );
}
