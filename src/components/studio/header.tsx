import { useEffect, useState } from "react";
import { Menu, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { checkHealth } from "@/lib/generate";
import { MODE_BY_ID } from "@/lib/modes";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";

function HealthChip() {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkHealth().then(
      (health) => {
        if (cancelled) return;
        setState("ok");
        setLatency(health.latencyMs);
      },
      () => {
        if (cancelled) return;
        setState("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground sm:inline-flex"
      title={state === "ok" ? `9Router tersambung (${latency}ms)` : "9Router"}
    >
      <span
        className={cn(
          "inline-block size-1.5 rounded-full",
          state === "ok" && "bg-emerald-500",
          state === "error" && "bg-red-500",
          state === "loading" && "animate-pulse bg-muted-foreground",
        )}
        aria-hidden
      />
      9Router{state === "ok" && latency !== null ? ` · ${latency}ms` : ""}
    </span>
  );
}

export function Header({ models }: { models: string[] }) {
  const modeId = useStudio((s) => s.modeId);
  const settings = useStudio((s) => s.settings);
  const setSettings = useStudio((s) => s.setSettings);
  const setSidebarOpen = useStudio((s) => s.setSidebarOpen);
  const setSettingsOpen = useStudio((s) => s.setSettingsOpen);
  const mode = MODE_BY_ID[modeId];
  const options = models;
  const modelValue = options.includes(settings.model) ? settings.model : undefined;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open menu"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{mode.label}</div>
        <div className="truncate text-[11px] text-muted-foreground">{mode.hint}</div>
      </div>
      <HealthChip />
      {options.length > 0 ? (
        <Select value={modelValue} onValueChange={(model) => setSettings({ model })}>
          <SelectTrigger className="h-9 w-[9.5rem] bg-transparent sm:w-44" aria-label="Model">
            <SelectValue placeholder="Pilih model" />
          </SelectTrigger>
          <SelectContent>
            {options.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span
          className="hidden max-w-36 truncate px-1 text-xs text-muted-foreground sm:block"
          title={settings.model || "Buka Settings lalu Test connection untuk memuat daftar model"}
        >
          {settings.model || "Belum ada model"}
        </span>
      )}
      <Button
        variant="outline"
        size="icon"
        aria-label="Open settings"
        onClick={() => setSettingsOpen(true)}
      >
        <Settings2 className="size-4" />
      </Button>
    </header>
  );
}
