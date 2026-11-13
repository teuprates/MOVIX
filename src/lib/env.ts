/** Variáveis públicas (seguras para o browser). Segredos ficam em `src/lib/supabase/admin.ts` (server-only). */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY);
