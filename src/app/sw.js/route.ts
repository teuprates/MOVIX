/**
 * Service worker do MOVIX, servido com a versão do build (um SW novo a cada deploy → aviso "Nova versão").
 * Caching responsável:
 * - /_next/static, ícones e fontes: cache-first (imutáveis, com limite de entradas).
 * - Navegação: network-first com tempo limite; sem rede → página /offline pré-cacheada COM seus CSS/JS.
 * - Nunca guarda páginas autenticadas, respostas de API, Server Actions ou qualquer coisa do Supabase.
 */
export const dynamic = "force-static";

const VERSION = process.env.MOVIX_BUILD ?? "dev";

const script = String.raw`
const VERSION = "movix-${VERSION}";
const STATIC = VERSION + "-static";
const SHELL = VERSION + "-shell";
const OFFLINE_URL = "/offline";
const MAX_STATIC = 160;
const NAV_TIMEOUT = 9000;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    const res = await fetch(OFFLINE_URL, { cache: "no-store" });
    const html = await res.clone().text();
    await cache.put(OFFLINE_URL, res);
    // CSS/JS/fontes da página offline, para ela abrir estilizada sem rede
    const assets = [...new Set([...html.matchAll(/\/_next\/static\/[^"'\s)]+/g)].map((m) => m[0]))];
    await Promise.all([...assets, "/icon.svg", "/icons/192"].map((u) => cache.add(u).catch(() => {})));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

async function trim(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_STATIC; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, tiles do mapa etc.: nunca interceptados
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/icon.svg") {
    event.respondWith((async () => {
      const hit = (await caches.match(request)) ;
      if (hit) return hit;
      const res = await fetch(request);
      if (res.ok) {
        const copy = res.clone();
        caches.open(STATIC).then((c) => c.put(request, copy)).then(() => trim(STATIC));
      }
      return res;
    })());
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) return preload;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), NAV_TIMEOUT);
        const res = await fetch(request, { signal: ctrl.signal });
        clearTimeout(timer);
        return res;
      } catch {
        return (await caches.match(OFFLINE_URL)) || new Response("Sem conexão", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
  }
});
`;

export function GET() {
  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
