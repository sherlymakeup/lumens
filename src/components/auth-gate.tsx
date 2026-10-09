import { useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

/** Proteksi route: redirect ke /login jika belum auth (kecuali auth belum dikonfigurasi). */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, configured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!configured) return; // fallback: mode tanpa auth (localStorage)
    if (!user && location.pathname !== "/login") {
      navigate({ to: "/login", replace: true });
    }
  }, [user, loading, configured, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Jika auth dikonfigurasi tapi belum login dan bukan di /login, jangan render.
  if (configured && !user && location.pathname !== "/login") {
    return null;
  }

  return <>{children}</>;
}
