import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, authConfigured } from "@/lib/supabase-client";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = authConfigured();

  useEffect(() => {
    let cancelled = false;
    // Safety timeout: jangan biarkan loading stuck lebih dari 3 detik.
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 3000);

    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      clearTimeout(timeout);
      return;
    }
    sb.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setLoading(false);
        clearTimeout(timeout);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        clearTimeout(timeout);
      });
    const { data: listener } = sb.auth.onAuthStateChange((_event, newSession) => {
      if (cancelled) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const sb = getSupabase();
    if (!sb) return { error: "Auth belum dikonfigurasi." };
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string) {
    const sb = getSupabase();
    if (!sb) return { error: "Auth belum dikonfigurasi.", needsConfirmation: false };
    // emailRedirectTo: override Site URL Supabase agar konfirmasi balik ke production, bukan localhost.
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/login?verified=1` : undefined;
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
    // needsConfirmation: true jika user dibuat tapi belum ada session (perlu klik link email).
    const needsConfirmation = !error && !data.session;
    return { error: error?.message ?? null, needsConfirmation };
  }

  async function signOut() {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setUser(null);
    setSession(null);
  }

  const getToken = useCallback(async (): Promise<string | null> => {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, configured, signIn, signUp, signOut, getToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
