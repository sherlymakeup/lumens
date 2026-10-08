import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fetchModels } from "@/lib/generate";
import { LANGS, useStrings, type StringKey } from "@/lib/i18n";
import { useStudio } from "@/lib/store";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "connection", labelKey: "settings.connection" },
  { id: "generation", labelKey: "settings.generation" },
  { id: "appearance", labelKey: "settings.appearance" },
  { id: "editor", labelKey: "settings.editor" },
  { id: "language", labelKey: "settings.language" },
  { id: "system", labelKey: "settings.system" },
  { id: "data", labelKey: "settings.data" },
] as const;

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label>{label}</Label>
        {hint ? <span className="font-mono text-xs tabular-nums text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function SettingsPanel({
  models,
  onModels,
}: {
  models: string[];
  onModels: (models: string[]) => void;
}) {
  const open = useStudio((s) => s.settingsOpen);
  const setOpen = useStudio((s) => s.setSettingsOpen);
  const section = useStudio((s) => s.settingsSection);
  const setSection = useStudio((s) => s.setSettingsSection);
  const settings = useStudio((s) => s.settings);
  const setSettings = useStudio((s) => s.setSettings);
  const resetSettings = useStudio((s) => s.resetSettings);
  const clearAll = useStudio((s) => s.clearAll);
  const conversations = useStudio((s) => s.conversations);
  const [testing, setTesting] = useState(false);
  const t = useStrings();

  async function testConnection() {
    setTesting(true);
    try {
      const list = await fetchModels();
      onModels(list);
      if (list[0] && !list.includes(settings.model)) {
        setSettings({ model: list[0] });
      }
      toast.success(`Connected · ${list.length} models`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setTesting(false);
    }
  }

  function exportJson() {
    const blob = new Blob(
      [JSON.stringify({ settings, conversations }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "chat-studio.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  const options = models;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent title="Settings" className="p-0">
        <SheetHeader>
          <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            {t["settings.kicker"]}
          </p>
          <h2 className="font-display text-2xl tracking-tight">{t["settings.title"]}</h2>
        </SheetHeader>
        <div className="flex min-h-0 flex-1">
          <nav className="hidden w-36 shrink-0 flex-col gap-0.5 border-r border-border p-3 sm:flex">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  "rounded-md px-2.5 py-2 text-left text-[13px] transition-colors",
                  section === item.id
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                )}
              >
                {t[item.labelKey as StringKey]}
              </button>
            ))}
          </nav>
          <ScrollArea className="min-w-0 flex-1">
            <div className="flex gap-2 overflow-x-auto px-5 pt-4 sm:hidden">
              {SECTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs",
                    section === item.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {t[item.labelKey as StringKey]}
                </button>
              ))}
            </div>
            <div className="space-y-6 px-5 py-5 pb-10">
              {section === "connection" ? (
                <>
                  <div>
                    <h3 className="text-sm font-medium">OpenAI-compatible API</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The endpoint and API key are configured on the server via
                      the <span className="font-mono">OPENAI_BASE_URL</span> and{" "}
                      <span className="font-mono">OPENAI_API_KEY</span> env vars.
                      Requests are proxied through this app&apos;s server, so the
                      key never reaches the browser.
                    </p>
                  </div>
                  <Field label="Model">
                    <div className="space-y-2">
                      <Select
                        value={options.includes(settings.model) ? settings.model : "custom-model"}
                        onValueChange={(value) => {
                          if (value !== "custom-model") setSettings({ model: value });
                          else setSettings({ model: "" });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom-model">Custom name…</SelectItem>
                        </SelectContent>
                      </Select>
                      {!options.includes(settings.model) ? (
                        <Input
                          value={settings.model}
                          onChange={(event) => setSettings({ model: event.target.value })}
                          placeholder="model-id"
                        />
                      ) : null}
                    </div>
                  </Field>
                  <Button variant="outline" onClick={testConnection} disabled={testing}>
                    {testing ? t["settings.testing"] : t["settings.testConnection"]}
                  </Button>
                </>
              ) : null}

              {section === "generation" ? (
                <>
                  <Field label="Temperature" hint={settings.temperature.toFixed(2)}>
                    <Slider
                      min={0}
                      max={2}
                      step={0.05}
                      value={[settings.temperature]}
                      onValueChange={([temperature]) => setSettings({ temperature: temperature ?? 0.7 })}
                    />
                  </Field>
                  <Field label="Max tokens" hint={String(settings.maxTokens)}>
                    <Slider
                      min={256}
                      max={4096}
                      step={64}
                      value={[settings.maxTokens]}
                      onValueChange={([maxTokens]) => setSettings({ maxTokens: maxTokens ?? 1024 })}
                    />
                  </Field>
                  <Field label="Top P" hint={settings.topP.toFixed(2)}>
                    <Slider
                      min={0}
                      max={1}
                      step={0.05}
                      value={[settings.topP]}
                      onValueChange={([topP]) => setSettings({ topP: topP ?? 1 })}
                    />
                  </Field>
                  <Field label="Frequency penalty" hint={settings.frequencyPenalty.toFixed(2)}>
                    <Slider
                      min={0}
                      max={2}
                      step={0.05}
                      value={[settings.frequencyPenalty]}
                      onValueChange={([frequencyPenalty]) =>
                        setSettings({ frequencyPenalty: frequencyPenalty ?? 0 })
                      }
                    />
                  </Field>
                  <Field label="Presence penalty" hint={settings.presencePenalty.toFixed(2)}>
                    <Slider
                      min={0}
                      max={2}
                      step={0.05}
                      value={[settings.presencePenalty]}
                      onValueChange={([presencePenalty]) =>
                        setSettings({ presencePenalty: presencePenalty ?? 0 })
                      }
                    />
                  </Field>
                  <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-3">
                    <div>
                      <div className="text-sm font-medium">Streaming</div>
                      <div className="text-xs text-muted-foreground">Tokens appear as they generate</div>
                    </div>
                    <Switch
                      checked={settings.stream}
                      onCheckedChange={(stream) => setSettings({ stream })}
                    />
                  </div>
                </>
              ) : null}

              {section === "appearance" ? (
                <>
                  <Field label="Theme">
                    <Select
                      value={settings.theme}
                      onValueChange={(theme) =>
                        setSettings({ theme: theme as typeof settings.theme })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Type size">
                    <Select
                      value={settings.fontSize}
                      onValueChange={(fontSize) =>
                        setSettings({ fontSize: fontSize as typeof settings.fontSize })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sm">Small</SelectItem>
                        <SelectItem value="md">Medium</SelectItem>
                        <SelectItem value="lg">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Density">
                    <Select
                      value={settings.density}
                      onValueChange={(density) =>
                        setSettings({ density: density as typeof settings.density })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comfortable">Comfortable</SelectItem>
                        <SelectItem value="compact">Compact</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              ) : null}

              {section === "editor" ? (
                <>
                  <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-3">
                    <div>
                      <div className="text-sm font-medium">Enter to send</div>
                      <div className="text-xs text-muted-foreground">Shift + Enter always inserts a line</div>
                    </div>
                    <Switch
                      checked={settings.sendWithEnter}
                      onCheckedChange={(sendWithEnter) => setSettings({ sendWithEnter })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-3">
                    <div>
                      <div className="text-sm font-medium">Render markdown</div>
                      <div className="text-xs text-muted-foreground">Format assistant replies</div>
                    </div>
                    <Switch
                      checked={settings.showMarkdown}
                      onCheckedChange={(showMarkdown) => setSettings({ showMarkdown })}
                    />
                  </div>
                </>
              ) : null}

              {section === "language" ? (
                <>
                  <div>
                    <h3 className="text-sm font-medium">{t["settings.language"]}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t["settings.languageHint"]}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {LANGS.map((lang) => (
                      <Button
                        key={lang.id}
                        variant={settings.lang === lang.id ? "default" : "outline"}
                        onClick={() => setSettings({ lang: lang.id })}
                        className="flex-1"
                      >
                        {lang.label}
                      </Button>
                    ))}
                  </div>
                </>
              ) : null}

              {section === "system" ? (
                <Field label="Global system prompt">
                  <Textarea
                    value={settings.systemPromptOverride}
                    onChange={(event) => setSettings({ systemPromptOverride: event.target.value })}
                    placeholder="Optional instructions added to every menu…"
                    className="min-h-36"
                  />
                </Field>
              ) : null}

              {section === "data" ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Drafts live in this browser. The API key lives only on the
                    server and is never exposed to the browser.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" onClick={exportJson}>
                      Export drafts
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        clearAll();
                        toast.success("Drafts cleared");
                      }}
                    >
                      Clear drafts
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        resetSettings();
                        toast.success("Settings reset");
                      }}
                    >
                      Reset settings
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Defaults match {DEFAULT_SETTINGS.model}, temperature {DEFAULT_SETTINGS.temperature}.
                  </p>
                </>
              ) : null}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
