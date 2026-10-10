import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchModels, testModelConnection } from "@/lib/generate";
import { useStrings } from "@/lib/i18n";
import { useStudio } from "@/lib/store";
import type { EngineId } from "@/lib/types";
import { ENGINE_IDS, ENGINE_LABELS } from "@/lib/types";
import { PageBar } from "./header";
import { Sidebar } from "./sidebar";
import { MobileSidebar } from "./mobile-sidebar";

type TestState = "idle" | "testing" | "ok" | "error";

export function Connection() {
  const sidebarOpen = useStudio((s) => s.sidebarOpen);
  const setSidebarOpen = useStudio((s) => s.setSidebarOpen);
  const customModels = useStudio((s) => s.customModels);
  const addCustomModel = useStudio((s) => s.addCustomModel);
  const removeCustomModel = useStudio((s) => s.removeCustomModel);
  const engineModels = useStudio((s) => s.engineModels);
  const setEngineModel = useStudio((s) => s.setEngineModel);

  const [chatModels, setChatModels] = useState<string[]>([]);
  const [imageModels, setImageModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newId, setNewId] = useState("");
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const t = useStrings();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [chat, image] = await Promise.all([fetchModels("chat"), fetchModels("image")]);
      setChatModels(chat);
      setImageModels(image);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t["conn.loadFailed"]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd() {
    const id = newId.trim();
    if (!id || testState === "testing") return;
    setTestState("testing");
    setTestMessage(null);
    try {
      const result = await testModelConnection(id);
      addCustomModel({ id: result.id, type: result.type, addedAt: Date.now() });
      setTestState("ok");
      setTestMessage(
        `"${result.id}" ${t["conn.addedOk"]} ${t[result.type === "image" ? "conn.typeImage" : "conn.typeChat"]}.`,
      );
      setNewId("");
    } catch (error) {
      setTestState("error");
      setTestMessage(error instanceof Error ? error.message : t["conn.testFailed"]);
    }
  }

  const customChat = customModels.filter((m) => m.type === "chat").map((m) => m.id);
  const customImage = customModels.filter((m) => m.type === "image").map((m) => m.id);
  const allChat = [...chatModels, ...customChat.filter((id) => !chatModels.includes(id))];
  const allImage = [...imageModels, ...customImage.filter((id) => !imageModels.includes(id))];

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <aside className="hidden h-dvh w-64 shrink-0 border-r border-sidebar-border md:block">
        <Sidebar />
      </aside>
      <MobileSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <PageBar title={t["conn.title"]} />
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {t["conn.kicker"]}
          </p>
          <h1 className="font-display mt-2 text-3xl tracking-tight">{t["conn.title"]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t["conn.subtitle"]}</p>

          {loadError && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
              {loadError}{" "}
              <Button variant="link" className="h-auto p-0 text-sm" onClick={() => void load()}>
                {t["conn.retry"]}
              </Button>
            </div>
          )}

          <section className="mt-6">
            <h2 className="font-display text-lg tracking-tight">
              {t["conn.addModel"]}{" "}
              <span className="text-xs font-normal text-muted-foreground">{t["conn.addModelHint"]}</span>
            </h2>
            <div className="mt-3 flex gap-2">
              <Input
                value={newId}
                onChange={(e) => {
                  setNewId(e.target.value);
                  setTestState("idle");
                  setTestMessage(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAdd();
                }}
                placeholder={t["conn.placeholder"]}
                className="font-mono"
                aria-label="ID model baru"
              />
              <Button onClick={() => void handleAdd()} disabled={!newId.trim() || testState === "testing"}>
                {testState === "testing" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {t["conn.testAdd"]}
              </Button>
            </div>
            {testMessage && (
              <p
                className={`mt-2 flex items-center gap-1.5 text-xs ${
                  testState === "ok" ? "text-emerald-500" : "text-red-500"
                }`}
              >
                {testState === "ok" && <Check className="size-3.5" />}
                {testMessage}
              </p>
            )}
          </section>

          <section className="mt-8">
            <h2 className="font-display text-lg tracking-tight">{t["conn.mapping"]}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t["conn.mappingHint"]}</p>
            <div className="mt-3 space-y-2">
              {ENGINE_IDS.map((engine: EngineId) => {
                const isImage = engine === "design";
                const options = isImage ? allImage : allChat;
                const value = options.includes(engineModels[engine]) ? engineModels[engine] : undefined;
                return (
                  <div
                    key={engine}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <span className="w-32 shrink-0 text-sm font-medium">
                      {ENGINE_LABELS[engine]}
                    </span>
                    <Select
                      value={value}
                      onValueChange={(model) => setEngineModel(engine, model)}
                    >
                      <SelectTrigger className="font-mono text-xs" aria-label={`Model ${ENGINE_LABELS[engine]}`}>
                        <SelectValue placeholder={t["conn.chooseModel"]} />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((model) => (
                          <SelectItem key={model} value={model} className="font-mono text-xs">
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-lg tracking-tight">
              {t["conn.modelChat"]}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {loading ? "…" : `${allChat.length} ${t["conn.modelsUnit"]}`}
              </span>
            </h2>
            <ModelList
              loading={loading}
              models={allChat}
              customIds={new Set(customChat)}
              onRemove={removeCustomModel}
            />
          </section>

          <section className="mt-8 pb-8">
            <h2 className="font-display text-lg tracking-tight">
              {t["conn.modelImage"]}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {loading ? "…" : `${allImage.length} ${t["conn.modelsUnit"]}`}
              </span>
            </h2>
            <ModelList
              loading={loading}
              models={allImage}
              customIds={new Set(customImage)}
              onRemove={removeCustomModel}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

function ModelList({
  loading,
  models,
  customIds,
  onRemove,
}: {
  loading: boolean;
  models: string[];
  customIds: Set<string>;
  onRemove: (id: string) => void;
}) {
  const t = useStrings();
  if (loading) {
    return (
      <div className="mt-3 space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (models.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">{t["conn.noModels"]}</p>;
  }
  return (
    <ul className="mt-3 space-y-1.5">
      {models.map((model) => {
        const custom = customIds.has(model);
        return (
          <li
            key={model}
            className="group flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{model}</span>
            {custom && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {t["conn.custom"]}
              </span>
            )}
            {custom && (
              <button
                type="button"
                aria-label={t["conn.removeModel"]}
                onClick={() => onRemove(model)}
                className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
