import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useStrings } from "@/lib/i18n";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const t = useStrings();
  const navigate = useNavigate();
  const { signIn, signUp, configured, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/", replace: true });
    }
  }, [user, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fn = mode === "in" ? signIn : signUp;
    const { error: err } = await fn(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err);
    } else {
      navigate({ to: "/", replace: true });
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-display text-2xl tracking-tight">
            XDIRGA <span className="text-primary">TOOLS</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t["auth.subtitle"]}</p>
        </div>
        {!configured ? (
          <p className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {t["auth.notConfigured"]}
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary"
                placeholder="nama@email.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary"
                placeholder="••••••••"
                autoComplete={mode === "in" ? "current-password" : "new-password"}
              />
            </div>
            {error ? (
              <p className="rounded-xl border border-destructive/50 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "…" : mode === "in" ? t["auth.signIn"] : t["auth.signUp"]}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "in" ? "up" : "in");
                setError(null);
              }}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              {mode === "in" ? t["auth.needAccount"] : t["auth.haveAccount"]}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
