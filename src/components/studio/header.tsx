import { Menu, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODE_BY_ID } from "@/lib/modes";
import { useStudio } from "@/lib/store";

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
