import { useEffect, useState } from "react";
import { Download, ImagePlus, Loader2, RotateCcw } from "lucide-react";
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

const RATIOS = [
  { id: "1:1", size: "1024x1024", aspect: "aspect-square" },
  { id: "16:9", size: "1792x1024", aspect: "aspect-video" },
  { id: "9:16", size: "1024x1792", aspect: "aspect-[9/16]" },
] as const;

type RatioId = (typeof RATIOS)[number]["id"];

const STYLES = [
  { id: "none", suffix: "" },
  { id: "photo", suffix: ", photorealistic, ultra detailed, natural lighting" },
  { id: "cinematic", suffix: ", cinematic lighting, film still, dramatic atmosphere" },
  { id: "anime", suffix: ", anime style, vibrant colors, detailed illustration" },
  { id: "digital", suffix: ", digital art, highly detailed, sharp focus" },
  { id: "render3d", suffix: ", 3d render, octane render, soft studio lighting" },
  { id: "minimal", suffix: ", minimalist, clean composition, soft colors" },
] as const;

type StyleId = (typeof STYLES)[number]["id"];

type GalleryItem = GeneratedImage & { prompt: string; aspect: string };

export function DesignEngine() {
  const engineModel = useStudio((s) => s.engineModels.design);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState(engineModel);
  const t = useStrings();
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<RatioId>("1:1");
  const [style, setStyle] = useState<StyleId>("none");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  useEffect(() => {
    fetchModels("image").then(
      (list) => {
        setModels(list);
        if (list.length === 1) setModel((current) => current || list[0]);
      },
      () => toast.error(t["eng.noModel"]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setModel(engineModel);
  }, [engineModel]);

  const activeRatio = RATIOS.find((r) => r.id === ratio) ?? RATIOS[0];
  const activeStyle = STYLES.find((s) => s.id === style) ?? STYLES[0];

  async function run() {
    if (!prompt.trim() || busy) return;
    const chosen = model || engineModel;
    if (!chosen) {
      const msg = t["eng.noModel"];
      setError(msg);
      toast.error(msg);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const images = await generateImage({
        model: chosen,
        prompt: prompt.trim() + activeStyle.suffix,
        size: activeRatio.size,
        n: count,
      });
      setGallery((prev) => [
        ...images.map((image) => ({
          ...image,
          prompt: prompt.trim(),
          aspect: activeRatio.aspect,
        })),
        ...prev,
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t["eng.imageFailed"];
      setError(msg);
      toast.error(msg);
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
            <SelectTrigger className="w-56 font-mono text-xs" aria-label={t["eng.imageModel"]}>
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
          <Select value={ratio} onValueChange={(v) => setRatio(v as RatioId)}>
            <SelectTrigger className="w-36" aria-label={t["eng.ratio"]}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RATIOS.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {t[`eng.ratio.${r.id}`]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={style} onValueChange={(v) => setStyle(v as StyleId)}>
            <SelectTrigger className="w-36" aria-label={t["eng.style"]}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STYLES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {t[`eng.style.${s.id}`]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
            <SelectTrigger className="w-24" aria-label={t["eng.count"]}>
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
        {busy ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {t["eng.generating"]}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 gap-1.5"
            onClick={() => void run()}
            disabled={busy || !prompt.trim()}
          >
            <RotateCcw className="size-3.5" />
            {t["eng.retry"]}
          </Button>
        </div>
      ) : null}

      {busy && gallery.length === 0 && !error && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Skeleton className={`${activeRatio.aspect} w-full rounded-xl`} />
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
              <img
                src={item.dataUrl}
                alt={item.prompt}
                className={`${item.aspect} w-full object-cover`}
              />
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
