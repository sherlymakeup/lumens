import { useEffect, useState } from "react";
import { Download, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fetchModels, generateImage, type GeneratedImage } from "@/lib/generate";
import { useStudio } from "@/lib/store";
import { useStrings } from "@/lib/i18n";
import { EngineShell } from "../engine-shell";

const SIZES = ["1024x1024", "1024x1792", "1792x1024"] as const;

export function DesignEngine() {
  const engineModel = useStudio((s) => s.engineModels.design);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState(engineModel);
  const t = useStrings();
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<(typeof SIZES)[number]>("1024x1024");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState<(GeneratedImage & { prompt: string })[]>([]);

  useEffect(() => {
    fetchModels("image").then(setModels, () => toast.error(t["eng.noModel"]));
  }, []);
  useEffect(() => {
    setModel(engineModel);
  }, [engineModel]);

  async function run() {
    if (!prompt.trim() || busy) return;
    const chosen = model || engineModel;
    if (!chosen) {
      toast.error(t["eng.noModel"]);
      return;
    }
    setBusy(true);
    try {
      const images = await generateImage({ model: chosen, prompt: prompt.trim(), size, n: count });
      setGallery((prev) => [
        ...images.map((image) => ({ ...image, prompt: prompt.trim() })),
        ...prev,
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal generate gambar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <EngineShell
      kicker={t["eng.kicker"]}
      title={t["eng.designTitle"]}
      subtitle={t["eng.designSubtitle"]}
    >
      <div className="rounded-xl border border-border bg-card p-4">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t["eng.promptImage"]}
          rows={3}
          aria-label={t["eng.promptImage"]}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={models.includes(model) ? model : undefined} onValueChange={setModel}>
            <SelectTrigger className="w-56 font-mono text-xs" aria-label="Model gambar">
              <SelectValue placeholder={t["conn.chooseModel"]} />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m} className="font-mono text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={size} onValueChange={(v) => setSize(v as (typeof SIZES)[number])}>
            <SelectTrigger className="w-36" aria-label="Ukuran">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
            <SelectTrigger className="w-24" aria-label="Jumlah">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void run()} disabled={!prompt.trim() || busy} className="gap-1.5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {t["eng.generate"]}
          </Button>
        </div>
      </div>

      {busy && gallery.length === 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-xl" />
        </div>
      )}

      {gallery.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {gallery.map((item, i) => (
            <figure
              key={`${item.prompt}-${i}`}
              className="group overflow-hidden rounded-xl border border-border bg-card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.dataUrl} alt={item.prompt} className="aspect-square w-full object-cover" />
              <figcaption className="flex items-center gap-2 p-3">
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {item.prompt}
                </span>
                <a
                  href={item.dataUrl}
                  download={`xdirga-${Date.now()}.${item.mime.split("/")[1] ?? "png"}`}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label={t["eng.downloadImage"]}
                >
                  <Download className="size-4" />
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </EngineShell>
  );
}
