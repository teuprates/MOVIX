/** Política por requisição; a origem do Supabase nunca inclui caminhos ou credenciais. */
/** `secure` = a requisição chegou por HTTPS; sem isso `upgrade-insecure-requests` quebraria `next start` em http://localhost. */
export function buildContentSecurityPolicy(nonce: string, supabaseUrl: string | undefined, environment: string | undefined, secure = true) {
  let supabaseHttps = "";
  let supabaseWss = "";
  if (supabaseUrl) {
    try {
      const { host } = new URL(supabaseUrl);
      supabaseHttps = ` https://${host}`;
      supabaseWss = ` wss://${host}`;
    } catch {
      // Sem URL válida, não liberar nenhuma origem externa de banco/storage.
    }
  }

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${environment === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // TileLayer usa os subdomínios padrão a/b/c do Leaflet em live-map.tsx.
    `img-src 'self' blob: data:${supabaseHttps} https://a.basemaps.cartocdn.com https://b.basemaps.cartocdn.com https://c.basemaps.cartocdn.com`,
    "font-src 'self' data:",
    `connect-src 'self'${supabaseHttps}${supabaseWss}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(environment === "production" && secure ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
