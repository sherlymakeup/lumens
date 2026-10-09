import { useCallback, useEffect, useState } from "react";
import { Plug, Plus, Trash2, FlaskConical, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EngineShell } from "./engine-shell";
import { useStrings } from "@/lib/i18n";

type ConnKind = "http" | "mcp";
type AuthType = "none" | "bearer" | "header" | "query";

type Connection = {
  id: string;
  name: string;
  kind: ConnKind;
  base_url: string;
  auth_type: AuthType;
  auth_name: string | null;
  has_secret: boolean;
  tools: { name: string; description: string; method: string; path: string }[];
  enabled: boolean;
};

const EMPTY_FORM = {
  name: "",
  kind: "http" as ConnKind,
  base_url: "",
  auth_type: "none" as AuthType,
  auth_name: "",
  auth_secret: "",
  toolsJson: "",
};

const TOOLS_EXAMPLE = `[
  {
    "name": "getWeather",
    "description": "Ambil cuaca terkini sebuah kota",
    "method": "GET",
    "path": "/v1/cuaca",
    "params": {
      "kota": { "type": "string", "description": "Nama kota", "required": true }
    }
  }
]`;

export function Connectors() {
  const t = useStrings();
  const [items, setItems] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Connection | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/connections");
      const body = (await res.json().catch(() => null)) as {
        connections?: Connection[];
        error?: string;
      } | null;
      if (!res.ok || !body) throw new Error(body?.error ?? "gagal");
      setItems(body.connections ?? []);
    } catch {
      toast.error(t["ctr.loadError"]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(c: Connection) {
    setEditing(c);
    setForm({
      name: c.name,
      kind: c.kind,
      base_url: c.base_url,
      auth_type: c.auth_type,
      auth_name: c.auth_name ?? "",
      auth_secret: "",
      toolsJson: JSON.stringify(
        c.tools.map((x) => ({ ...x, params: (x as { params?: unknown }).params ?? {} })),
        null,
        2,
      ),
    });
    setShowForm(true);
  }

  function parseTools(): { ok: boolean; tools?: unknown[]; error?: string } {
    const raw = form.toolsJson.trim();
    if (!raw) return { ok: true, tools: [] };
    try {
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr)) return { ok: false, error: "Tools harus array JSON." };
      return { ok: true, tools: arr };
    } catch {
      return { ok: false, error: "JSON tools tidak valid." };
    }
  }

  async function save() {
    if (!form.name.trim() || !form.base_url.trim()) {
      toast.error("Nama dan Base URL wajib diisi.");
      return;
    }
    const parsed = parseTools();
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        kind: form.kind,
        base_url: form.base_url.trim(),
        auth_type: form.auth_type,
        tools: parsed.tools,
        enabled: editing ? editing.enabled : true,
      };
      if (form.auth_name.trim()) body.auth_name = form.auth_name.trim();
      if (form.auth_secret) body.auth_secret = form.auth_secret;
      const url = editing ? `/api/connections/${editing.id}` : "/api/connections";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(out?.error ?? "gagal");
      toast.success(t["ctr.saved"]);
      setShowForm(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function testConn(id: string) {
    setTestingId(id);
    try {
      const res = await fetch(`/api/connections/${id}/test`, { method: "POST" });
      const out = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        tools?: { name: string }[];
        status?: number;
      } | null;
      if (!res.ok || !out?.ok) throw new Error(out?.error ?? "gagal");
      const extra =
        out.tools && out.tools.length > 0
          ? ` — ${out.tools.length} ${t["ctr.testToolsFound"]}: ${out.tools.map((x) => x.name).join(", ")}`
          : out.status
            ? ` (HTTP ${out.status})`
            : "";
      toast.success(`${t["ctr.testOk"]}${extra}`);
      await load(); // tools MCP hasil discovery tersimpan
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test gagal.");
    } finally {
      setTestingId(null);
    }
  }

  async function toggleEnabled(c: Connection) {
    try {
      const res = await fetch(`/api/connections/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !c.enabled }),
      });
      if (!res.ok) throw new Error("gagal");
      await load();
    } catch {
      toast.error("Gagal mengubah status.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t["ctr.confirmDelete"])) return;
    try {
      const res = await fetch(`/api/connections/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("gagal");
      toast.success(t["ctr.deleted"]);
      await load();
    } catch {
      toast.error("Gagal menghapus.");
    }
  }

  const set = (k: keyof typeof EMPTY_FORM) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <EngineShell kicker={t["ctr.kicker"]} title={t["ctr.title"]} subtitle={t["ctr.subtitle"]}>
      <div className="mb-4 flex justify-end">
        <Button onClick={openAdd} className="gap-1.5">
          <Plus className="size-4" /> {t["ctr.addTitle"]}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : items.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground">{t["ctr.noConnectors"]}</p>
      ) : null}

      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Plug className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {c.kind}
              </span>
              <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
                {c.has_secret ? t["ctr.hasSecret"] : t["ctr.noSecret"]}
              </span>
              <button
                type="button"
                onClick={() => void toggleEnabled(c)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  c.enabled
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {c.enabled ? t["ctr.enabled"] : t["ctr.disabled"]}
              </button>
            </div>
            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{c.base_url}</p>
            {c.tools.length > 0 && (
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {c.tools.length} tools: {c.tools.map((x) => x.name).join(", ")}
              </p>
            )}
            <div className="mt-2 flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void testConn(c.id)}
                disabled={testingId === c.id}
                className="gap-1"
              >
                <FlaskConical className="size-3.5" />
                {testingId === c.id ? t["ctr.testing"] : t["ctr.test"]}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openEdit(c)} className="gap-1">
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void remove(c.id)}
                className="gap-1 text-red-500 hover:text-red-600"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {showForm && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-medium">
            {editing ? `${t["ctr.addTitle"]} — ${editing.name}` : t["ctr.addTitle"]}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">{t["ctr.name"]}</span>
              <Input value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder={t["ctr.namePlaceholder"]} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">{t["ctr.kind"]}</span>
              <Select value={form.kind} onValueChange={(v) => set("kind")(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">{t["ctr.kindHttp"]}</SelectItem>
                  <SelectItem value="mcp">{t["ctr.kindMcp"]}</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-muted-foreground">{t["ctr.baseUrl"]}</span>
              <Input
                value={form.base_url}
                onChange={(e) => set("base_url")(e.target.value)}
                placeholder={t["ctr.baseUrlPlaceholder"]}
                className="font-mono"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">{t["ctr.authType"]}</span>
              <Select value={form.auth_type} onValueChange={(v) => set("auth_type")(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t["ctr.authNone"]}</SelectItem>
                  <SelectItem value="bearer">{t["ctr.authBearer"]}</SelectItem>
                  <SelectItem value="header">{t["ctr.authHeader"]}</SelectItem>
                  <SelectItem value="query">{t["ctr.authQuery"]}</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {(form.auth_type === "header" || form.auth_type === "query") && (
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">{t["ctr.authName"]}</span>
                <Input
                  value={form.auth_name}
                  onChange={(e) => set("auth_name")(e.target.value)}
                  placeholder={t["ctr.authNamePlaceholder"]}
                  className="font-mono"
                />
              </label>
            )}
            {form.auth_type !== "none" && (
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs text-muted-foreground">{t["ctr.authSecret"]}</span>
                <Input
                  type="password"
                  value={form.auth_secret}
                  onChange={(e) => set("auth_secret")(e.target.value)}
                  placeholder={t["ctr.authSecretPlaceholder"]}
                  autoComplete="off"
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">{t["ctr.authSecretHint"]}</span>
              </label>
            )}
            {form.kind === "http" && (
              <label className="block sm:col-span-2">
                <span className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  {t["ctr.tools"]}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setForm((f) => ({ ...f, toolsJson: f.toolsJson || TOOLS_EXAMPLE }))}
                  >
                    contoh
                  </button>
                </span>
                <textarea
                  value={form.toolsJson}
                  onChange={(e) => set("toolsJson")(e.target.value)}
                  rows={6}
                  spellCheck={false}
                  placeholder={t["ctr.toolsHint"]}
                  className="w-full rounded-lg border border-border bg-background p-2 font-mono text-xs outline-none focus:border-primary/60"
                />
              </label>
            )}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {t["ctr.cancel"]}
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {t["ctr.save"]}
            </Button>
          </div>
        </div>
      )}
    </EngineShell>
  );
}
