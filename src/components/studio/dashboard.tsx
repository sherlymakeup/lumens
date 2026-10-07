import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Image as ImageIcon,
  MessagesSquare,
  Plug,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { checkHealth, fetchModels, type HealthStatus } from "@/lib/generate";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";

const ENGINES = [
  {
    id: "content",
    to: "/engines/content",
    name: "Generasi Konten",
    description: "Artikel, copy landing, dan terjemahan yang tetap on-brand.",
    glyph: "C",
  },
  {
    id: "design",
    to: "/engines/design",
    name: "Desain",
    description: "Dari prompt ke visual — frame hero dan konsep UI di kanvas.",
    glyph: "D",
  },
  {
    id: "prototype",
    to: "/engines/prototype",
    name: "Prototipe",
    description: "Jelaskan aplikasinya, dapatkan pratinjau yang bisa diklik.",
    glyph: "P",
  },
  {
    id: "code",
    to: "/engines/code",
    name: "Coding",
    description: "Chat paham repo, diff inline, dan pratinjau sandbox.",
    glyph: "{ }",
  },
] as const;

function StatusDot({ state }: { state: "loading" | "ok" | "error" }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        state === "ok" && "bg-emerald-500",
        state === "error" && "bg-red-500",
        state === "loading" && "animate-pulse bg-muted-foreground",
      )}
      aria-hidden
    />
  );
}

export function Dashboard() {
  const sidebarOpen = useStudio((s) => s.sidebarOpen);
  const setSidebarOpen = useStudio((s) => s.setSidebarOpen);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [chatModels, setChatModels] = useState<string[]>([]);
  const [imageModels, setImageModels] = useState<string[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      setHealth(await checkHealth());
    } catch (error) {
      setHealth(null);
      setHealthError(error instanceof Error ? error.message : "Gagal memeriksa koneksi.");
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const [chat, image] = await Promise.all([fetchModels("chat"), fetchModels("image")]);
      setChatModels(chat);
      setImageModels(image);
    } catch (error) {
      setModelsError(error instanceof Error ? error.message : "Gagal memuat model.");
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
    void loadModels();
  }, [loadHealth, loadModels]);

  const healthState = healthLoading ? "loading" : health ? "ok" : "error";

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <aside className="hidden h-dvh w-64 shrink-0 border-r border-sidebar-border md:block">
        <Sidebar />
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" title="Menus" className="p-0 max-w-72">
          <Sidebar />
        </SheetContent>
      </Sheet>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Ruang Kerja
          </p>
          <h1 className="font-display mt-2 text-3xl tracking-tight">Dasbor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Satu pintu ke semua mesin AI — lewat satu gateway: 9Router.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                <Plug className="size-3.5" /> Koneksi
              </div>
              <div className="mt-3 flex items-center gap-2">
                <StatusDot state={healthState} />
                {healthLoading ? (
                  <Skeleton className="h-5 w-24" />
                ) : health ? (
                  <span className="text-sm font-medium">
                    9Router · {health.latencyMs}ms
                  </span>
                ) : (
                  <span className="text-sm font-medium text-red-500">Terputus</span>
                )}
              </div>
              {healthError ? (
                <p className="mt-1 truncate text-xs text-muted-foreground" title={healthError}>
                  {healthError}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">ai.xdirga.xyz</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 h-8 gap-1.5 px-2"
                onClick={() => void loadHealth()}
                disabled={healthLoading}
              >
                <RefreshCw className={cn("size-3.5", healthLoading && "animate-spin")} />
                Uji koneksi
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                <MessagesSquare className="size-3.5" /> Model Chat
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight">
                {modelsLoading ? <Skeleton className="h-8 w-12" /> : chatModels.length}
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground" title={chatModels[0] ?? ""}>
                {modelsError ?? (chatModels[0] ?? "—")}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                <ImageIcon className="size-3.5" /> Model Gambar
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight">
                {modelsLoading ? <Skeleton className="h-8 w-12" /> : imageModels.length}
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground" title={imageModels[0] ?? ""}>
                {modelsError ?? (imageModels[0] ?? "—")}
              </p>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <h2 className="font-display text-xl tracking-tight">Mesin</h2>
            <span className="text-xs text-muted-foreground">via 9Router</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ENGINES.map((engine) => (
              <Link
                key={engine.id}
                to={engine.to}
                className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 font-mono text-sm font-semibold text-primary">
                    {engine.glyph}
                  </span>
                  <span className="flex-1 text-sm font-medium">{engine.name}</span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {engine.description}
                </p>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Butuh NOVITA_API_KEY di environment server untuk panel sandbox engine Coding.
          </p>
        </div>
      </main>
    </div>
  );
}
