import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Consome um hit com a sessão do usuário; indisponibilidade do RPC não bloqueia o assistente. */
export async function consumeRateLimit(
  supabase: SupabaseClient,
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_bucket: bucket,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.warn("Falha ao consumir o rate limit do assistente:", error);
      return true;
    }
    return data === true;
  } catch (error) {
    console.warn("Falha ao consumir o rate limit do assistente:", error);
    return true;
  }
}
