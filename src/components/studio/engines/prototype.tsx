import { useRef, useState } from "react";
import { Code2, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateStream } from "@/lib/generate";
import { useStudio } from "@/lib/store";
import { useStrings } from "@/lib/i18n";
import { EngineShell } from "../engine-shell";

const SYSTEM =
  "You are XDIRGA Prototype. The user describes an app or page. Return ONLY a single self-contained HTML document (with inline <style> and <script>), no markdown fences, no explanation. Make it look polished: modern layout, decent typography, a little interactivity.";

function extractHtml(text: string): string {
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const candidate = (fence?.[1] ?? text).trim();
  return candidate.includes("<html") ? candidate : "";
}

export function PrototypeEngine() {
  const engineModel = useStudio((s) => s.engineModels.prototype);
  const settings = useStudio((s) => s.settings);
  const [brief, setBrief] = useState("");
  const t = useStrings();
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
    setHtml("");
    const controller = new AbortController();
    abortRef.current = controller;
    let assembled = "";
    await generateStream(
      {
        messages: [
          { role: "system", content: SYSTEM },
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
        },
        onDone: () => {
          const doc = extractHtml(assembled);
          if (!doc) setError(t["eng.invalidHtml"]);
          else setHtml(doc);
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
      title={t["eng.prototypeTitle"]}
      subtitle={t["eng.prototypeSubtitle"]}
    >
      <div className="rounded-xl border border-border bg-card p-4">
        <Textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={t["eng.briefPrototype"]}
          rows={3}
          aria-label={t["eng.briefPrototype"]}
        />
        <div className="mt-3 flex items-center gap-2">
          {busy ? (
            <Button variant="outline" onClick={stop} className="gap-1.5">
              <Square className="size-4" /> {t["eng.stop"]}
            </Button>
          ) : (
            <Button onClick={() => void run()} disabled={!brief.trim()} className="gap-1.5">
              <Code2 className="size-4" /> {t["eng.buildPrototype"]}
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

      {busy && !html && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {t["eng.building"]}
        </p>
      )}

      {html && (
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {t["eng.preview"]}
            </span>
            <a
              href={`data:text/html;charset=utf-8,${encodeURIComponent(html)}`}
              download="prototipe.html"
              className="text-xs text-primary hover:underline"
            >
              {t["eng.downloadHtml"]}
            </a>
          </div>
          <iframe
            title="Pratinjau prototipe"
            srcDoc={html}
            sandbox="allow-scripts"
            className="h-[480px] w-full bg-white"
          />
        </div>
      )}
    </EngineShell>
  );
}
