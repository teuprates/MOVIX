import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { buildContentSecurityPolicy } from "@/lib/csp";

const PROTECTED = ["/painel", "/app", "/admin", "/demo", "/onboarding", "/inicio", "/conta"];

/**
 * Proxy (antigo middleware): renova a sessão Supabase e faz checagem OTIMISTA de rotas protegidas.
 * A autorização real acontece no servidor (requireOwner/requireRenter) e na RLS do banco.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy(nonce, url, process.env.NODE_ENV, request.nextUrl.protocol === "https:");
  const withCsp = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };
  const nextResponse = () => {
    // Recriar após setAll para encaminhar também os cookies renovados ao servidor.
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return withCsp(NextResponse.next({ request: { headers } }));
  };
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

  if (!url || !key) {
    if (isProtected) return withCsp(NextResponse.redirect(new URL("/configuracao", request.url)));
    return nextResponse();
  }

  let response = nextResponse();
  const redirect = (destination: URL) => {
    const redirected = withCsp(NextResponse.redirect(destination));
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    return redirected;
  };
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = nextResponse();
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (isProtected && !signedIn) {
    const login = new URL("/entrar", request.url);
    login.searchParams.set("next", path + request.nextUrl.search);
    return redirect(login);
  }
  if (signedIn && (path === "/entrar" || path === "/cadastro")) {
    return redirect(new URL("/inicio", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
