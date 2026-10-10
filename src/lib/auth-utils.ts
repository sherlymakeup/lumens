/** Helper auth murni (tanpa React/DOM) — terisolasi agar bisa di-unit-test.
 *  Dipakai oleh auth-context.tsx dan generate.ts. */

/** Race promise melawan timeout. Reject dengan Error saat timeout.
 *  Timer selalu di-clear agar tidak bocor. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/** Jalankan signOutFn, tapi clear() SELALU dipanggil via try/finally —
 *  state lokal dibersihkan walau signOut ke server gagal (H2). */
export async function signOutWithCleanup(
  signOutFn: () => Promise<unknown>,
  clear: () => void,
): Promise<void> {
  try {
    await signOutFn();
  } finally {
    clear();
  }
}

export type UnauthorizedDeps = {
  /** Coba refresh session. Return { error: null } jika sukses. */
  refreshSession: () => Promise<{ error: unknown | null }>;
  signOut: () => Promise<void>;
  redirectToLogin: () => void;
};

/** Penanganan 401 terpusat (H3):
 *  1. Coba refreshSession sekali (dengan timeout internal 10 dtk).
 *  2. Jika sukses → return true (pemanggil boleh lanjut; token baru sudah tersimpan).
 *  3. Jika gagal → signOut + redirect ke /login, return false.
 *  signOut yang throw tidak menghalangi redirect. */
export async function handleUnauthorizedFlow(deps: UnauthorizedDeps): Promise<boolean> {
  try {
    const { error } = await withTimeout(deps.refreshSession(), 10_000, "refreshSession");
    if (!error) return true;
  } catch {
    // refresh gagal/timeout → lanjut ke logout paksa
  }
  try {
    await deps.signOut();
  } catch {
    // paksa lanjut redirect walau signOut gagal
  }
  deps.redirectToLogin();
  return false;
}

/** Registry handler 401 global — diisi AuthProvider saat mount,
 *  dibaca generate.ts (modul non-React) saat API return 401. */
type UnauthorizedHandler = () => Promise<void>;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
  unauthorizedHandler = fn;
}

export function getUnauthorizedHandler(): UnauthorizedHandler | null {
  return unauthorizedHandler;
}
