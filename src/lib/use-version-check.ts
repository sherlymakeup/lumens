import { useEffect, useRef, useState } from "react";

const POLL_MS = 60_000;

/** Deteksi deployment baru: bandingkan buildId server dengan yang dimuat awal.
 *  Jika berbeda, kembalikan true agar UI tampilkan banner refresh —
 *  mencegah client basi (stale bundle) yang bikin hang/error misterius. */
export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const initialRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/version", {
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok || cancelled) return;
        const body = (await res.json().catch(() => null)) as {
          buildId?: string;
        } | null;
        const buildId = body?.buildId;
        if (!buildId || cancelled) return;
        if (initialRef.current === null) {
          initialRef.current = buildId;
        } else if (initialRef.current !== buildId) {
          setUpdateAvailable(true);
        }
      } catch {
        /* offline — abaikan */
      }
    }

    void check();
    const timer = setInterval(check, POLL_MS);
    // Cek juga saat tab kembali visible (kasus: deploy saat tab di-background).
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return updateAvailable;
}
