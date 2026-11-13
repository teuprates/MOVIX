"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getMemberships, getSession, ORG_COOKIE } from "@/lib/auth/context";
import { translateError } from "@/lib/errors";
import { fail, success, type FormState } from "@/lib/form-state";

/** Restaura os dados fictícios da locadora DEMO ativa. O banco recusa qualquer locadora não-demo. */
export async function restoreDemo(orgId: string): Promise<FormState> {
  const session = await getSession();
  if (!session) return fail("Sua sessão expirou.");
  const m = (await getMemberships()).find((x) => x.organization_id === orgId && x.role === "owner" && x.status === "approved" && x.organization.is_demo);
  if (!m) return fail("Disponível apenas para locadoras de demonstração.");
  const { data, error } = await session.supabase.rpc("demo_populate", { p_org: orgId, p_variant: m.organization.name.includes("Rota Sul") ? 2 : 1 });
  if (error) return fail(translateError(error));
  await session.supabase.rpc("refresh_alerts", { p_org: orgId });
  revalidatePath("/", "layout");
  const d = data as { rentals?: number };
  return success(`Dados de demonstração restaurados (${d?.rentals ?? 0} locações fictícias).`);
}

export async function enterDemoOrg(orgId: string): Promise<FormState> {
  const m = (await getMemberships()).find((x) => x.organization_id === orgId && x.role === "owner" && x.status === "approved" && x.organization.is_demo);
  if (!m) return fail("Locadora demo não disponível.");
  (await cookies()).set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return success(undefined, { redirectTo: "/painel" });
}
