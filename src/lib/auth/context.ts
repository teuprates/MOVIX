import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const ORG_COOKIE = "movix_org";

export type Membership = {
  id: string;
  organization_id: string;
  role: "owner" | "renter";
  status: "pending" | "approved" | "rejected" | "revoked";
  requested_at: string;
  organization: {
    id: string;
    name: string;
    logo_path: string | null;
    primary_color: string;
    secondary_color: string;
    suspended_at: string | null;
    is_demo: boolean;
    phone: string | null;
  };
};

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  birth_date: string | null;
  intended_role: "owner" | "renter";
  suspended_at: string | null;
  cnh_number: string | null;
  cnh_category: string | null;
  cnh_expires_at: string | null;
  cnh_document_path: string | null;
  address_proof_path: string | null;
  lgpd_consent_at: string | null;
  [key: string]: unknown;
};

/** Sessão validada (JWT verificado pelo Supabase). Memoizada por requisição. */
export const getSession = cache(async () => {
  await connection(); // sempre dinâmico: depende da sessão da requisição
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { supabase, userId: data.claims.sub as string, email: (data.claims.email as string | undefined) ?? null };
});

export const getProfile = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const { data } = await session.supabase.from("profiles").select("*").eq("id", session.userId).maybeSingle();
  return (data as Profile | null) ?? null;
});

export const getMemberships = cache(async () => {
  const session = await getSession();
  if (!session) return [] as Membership[];
  const { data } = await session.supabase
    .from("organization_memberships")
    .select("id, organization_id, role, status, requested_at, organization:organizations(id, name, logo_path, primary_color, secondary_color, suspended_at, is_demo, phone)")
    .eq("user_id", session.userId)
    .order("requested_at");
  return ((data ?? []) as unknown as Membership[]).filter((m) => m.organization);
});

export const getIsPlatformAdmin = cache(async () => {
  const session = await getSession();
  if (!session) return false;
  const { data } = await session.supabase.from("platform_admins").select("user_id").eq("user_id", session.userId).maybeSingle();
  return Boolean(data);
});

export async function requireSession(next = "/inicio") {
  const session = await getSession();
  if (!session) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  const profile = await getProfile();
  if (profile?.suspended_at) redirect("/suspenso");
  return { ...session, profile };
}

/** Escolhe a locadora ativa a partir do cookie, sempre validando contra os vínculos aprovados do usuário. */
async function pickActive(memberships: Membership[]) {
  const store = await cookies();
  const wanted = store.get(ORG_COOKIE)?.value;
  return memberships.find((m) => m.organization_id === wanted) ?? memberships[0] ?? null;
}

export async function requireOwner(next = "/painel") {
  const session = await requireSession(next);
  const memberships = (await getMemberships()).filter((m) => m.role === "owner" && m.status === "approved");
  if (memberships.length === 0) redirect("/onboarding");
  const active = await pickActive(memberships);
  if (!active) redirect("/onboarding");
  if (active.organization.suspended_at) redirect("/suspenso?escopo=locadora");
  return { ...session, membership: active, org: active.organization, orgId: active.organization_id, memberships };
}

export async function requireRenter(next = "/app") {
  const session = await requireSession(next);
  const all = (await getMemberships()).filter((m) => m.role === "renter");
  const approved = all.filter((m) => m.status === "approved" && !m.organization.suspended_at);
  const active = await pickActive(approved);
  return { ...session, all, approved, membership: active, org: active?.organization ?? null, orgId: active?.organization_id ?? null };
}

export async function requireAdmin() {
  const session = await requireSession("/admin");
  if (!(await getIsPlatformAdmin())) redirect("/inicio");
  return session;
}

/** Para Server Actions: retorna contexto ou lança erro (sem redirect silencioso). */
export async function ownerActionContext() {
  const session = await getSession();
  if (!session) throw new Error("MOVIX_NOT_AUTHORIZED");
  const memberships = (await getMemberships()).filter((m) => m.role === "owner" && m.status === "approved" && !m.organization.suspended_at);
  const active = await pickActive(memberships);
  if (!active) throw new Error("MOVIX_NOT_AUTHORIZED");
  return { ...session, orgId: active.organization_id, org: active.organization };
}

export async function renterActionContext() {
  const session = await getSession();
  if (!session) throw new Error("MOVIX_NOT_AUTHORIZED");
  const approved = (await getMemberships()).filter((m) => m.role === "renter" && m.status === "approved" && !m.organization.suspended_at);
  const active = await pickActive(approved);
  return { ...session, orgId: active?.organization_id ?? null, approved };
}
