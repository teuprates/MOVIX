import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(), microphone=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/**
 * Aceita também os nomes sem prefixo (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SITE_URL), como no painel da Vercel.
 * Somente valores PÚBLICOS são mapeados para NEXT_PUBLIC_* (embutidos no bundle). Nunca mapear a chave secreta.
 */
const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  NEXT_PUBLIC_SITE_URL:
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : ""),
};

/** Versão do build para o service worker (um SW novo por deploy). Não é segredo. */
const MOVIX_BUILD = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? Date.now().toString(36)).slice(0, 12);

const supabaseHost = (() => {
  try {
    return new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  // D-003: modelo dinâmico tradicional (rotas autenticadas leem cookies em toda requisição).
  cacheComponents: false,
  poweredByHeader: false,
  env: { ...Object.fromEntries(Object.entries(publicEnv).filter(([, v]) => v)), MOVIX_BUILD },
  serverExternalPackages: ["exceljs", "pdf-lib"],
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  images: {
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost }] : [],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default nextConfig;
