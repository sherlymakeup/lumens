import { useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

/** Proteksi route: redirect ke /login jika belum auth.
 *  TIDAK memblokir render dengan spinner — app langsung tampil,
 *  redirect jalan di background setelah auth state jelas. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, configured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!configured) return; // fallback: mode tanpa auth
    if (!user && location.pathname !== "/login") {
      navigate({ to: "/login", replace: true });
    }
    if (user && location.pathname === "/login") {
      navigate({ to: "/", replace: true });
    }
  }, [user, loading, configured, location.pathname, navigate]);

  // Render langsung — jangan tunggu auth. Server-side pun langsung render app.
  return <>{children}</>;
}
