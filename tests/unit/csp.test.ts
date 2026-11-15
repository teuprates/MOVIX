import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/csp";
import { proxy } from "@/proxy";

const auth = vi.hoisted(() => ({ signedIn: false }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: {
    cookies: { setAll: (cookies: { name: string; value: string; options: { httpOnly: boolean; path: string } }[]) => void };
  }) => ({
    auth: {
      getClaims: async () => {
        options.cookies.setAll([{ name: "session", value: "renewed", options: { httpOnly: true, path: "/" } }]);
        return { data: { claims: auth.signedIn ? { sub: "user" } : null } };
      },
    },
  }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  auth.signedIn = false;
});

describe("política CSP", () => {
  it("restringe origens e permite storage, realtime e tiles usados pelo mapa", () => {
    const csp = buildContentSecurityPolicy("nonce-teste", "https://project.supabase.co/storage/v1", "production");
    expect(csp.split("; ")).toEqual([
      "default-src 'self'",
      "script-src 'self' 'nonce-nonce-teste' 'strict-dynamic'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https://project.supabase.co https://a.basemaps.cartocdn.com https://b.basemaps.cartocdn.com https://c.basemaps.cartocdn.com",
      "font-src 'self' data:",
      "connect-src 'self' https://project.supabase.co wss://project.supabase.co",
      "worker-src 'self'",
      "manifest-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ]);
  });

  it.each(["development", "test", undefined])("ajusta diretivas fora de produção (%s)", (environment) => {
    const csp = buildContentSecurityPolicy("abc", undefined, environment);
    expect(csp.includes("'unsafe-eval'")).toBe(environment === "development");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("supabase");
  });

  it("não força HTTPS quando a requisição chegou por http (next start local)", () => {
    expect(buildContentSecurityPolicy("abc", undefined, "production", false)).not.toContain("upgrade-insecure-requests");
  });

  it("não libera origem externa quando a URL é inválida", () => {
    expect(buildContentSecurityPolicy("abc", "invalid", "production")).toContain("connect-src 'self';");
  });
});

describe("CSP no proxy", () => {
  it.each(["/", "/painel"])("envia CSP sem Supabase em %s", async (path) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const response = await proxy(new NextRequest(`https://movix.test${path}`));
    const csp = response.headers.get("content-security-policy");
    expect(csp).toContain("'nonce-");
    expect(csp).toContain("frame-ancestors 'none'");
    if (path === "/painel") {
      expect(response.headers.get("location")).toBe("https://movix.test/configuracao");
    } else {
      const nonce = response.headers.get("x-middleware-request-x-nonce");
      expect(nonce).toBeTruthy();
      expect(csp).toContain(`'nonce-${nonce}'`);
      expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
    }
  });

  it.each([
    { path: "/", signedIn: false, destination: null },
    { path: "/painel?tab=frota", signedIn: false, destination: "/entrar?next=%2Fpainel%3Ftab%3Dfrota" },
    { path: "/entrar", signedIn: true, destination: "/inicio" },
    { path: "/cadastro", signedIn: true, destination: "/inicio" },
  ])("preserva sessão e CSP em $path (autenticado: $signedIn)", async ({ path, signedIn, destination }) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
    auth.signedIn = signedIn;
    const request = new NextRequest(`https://movix.test${path}`, { headers: { "x-nonce": "forjado" } });
    const response = await proxy(request);
    const csp = response.headers.get("content-security-policy");
    expect(csp).toContain("'nonce-");
    expect(csp).not.toContain("forjado");
    expect(response.cookies.get("session")?.value).toBe("renewed");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    if (destination) {
      expect(response.headers.get("location")).toBe(`https://movix.test${destination}`);
    } else {
      expect(response.headers.get("x-middleware-request-cookie")).toContain("session=renewed");
      expect(csp).toContain(`'nonce-${response.headers.get("x-middleware-request-x-nonce")}'`);
      expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
    }
  });

  it("gera um nonce novo a cada requisição", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const first = await proxy(new NextRequest("https://movix.test/"));
    const second = await proxy(new NextRequest("https://movix.test/"));
    expect(first.headers.get("content-security-policy")).not.toBe(second.headers.get("content-security-policy"));
  });
});
