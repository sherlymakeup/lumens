import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Baca env dengan aman — import.meta.env tidak ada di luar bundling Vite (Node/SSR). */
function readEnv(key: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> } | undefined)?.env;
    const v = env?.[key];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

const url = readEnv("VITE_SUPABASE_URL");
const anonKey = readEnv("VITE_SUPABASE_ANON_KEY");

let client: SupabaseClient | null = null;

/** Supabase client untuk auth (browser). Null jika env belum diset. */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey);
  }
  return client;
}

/** True jika Supabase Auth dikonfigurasi. */
export function authConfigured(): boolean {
  return Boolean(url && anonKey);
}
