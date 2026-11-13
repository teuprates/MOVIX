"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getMemberships, getSession, ORG_COOKIE, ownerActionContext } from "@/lib/auth/context";
import { translateError } from "@/lib/errors";
import { fail, parseForm, success, type FormState } from "@/lib/form-state";
import { asFile, DOC_TYPES, uploadFile, validateFile } from "@/lib/storage";
import { inviteSchema, renterProfileSchema } from "@/lib/validation/schemas";

/** Troca a locadora ativa — só aceita organizações em que o usuário tem vínculo aprovado. */
export async function switchOrganization(orgId: string, area: "owner" | "renter"): Promise<FormState> {
  const memberships = await getMemberships();
  const ok = memberships.some(
    (m) => m.organization_id === orgId && m.status === "approved" && m.role === (area === "owner" ? "owner" : "renter"),
  );
  if (!ok) return fail("Locadora não disponível para você.");
  (await cookies()).set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180 });
  return success(undefined, { redirectTo: area === "owner" ? "/painel" : "/app" });
}

export async function completeRenterProfileAndJoin(code: string, _: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return fail("Sua sessão expirou. Entre novamente.");
  const { data, state } = parseForm(renterProfileSchema, formData);
  if (!data) return state;

  const { supabase, userId } = session;
  const { data: current } = await supabase.from("profiles").select("cnh_document_path, address_proof_path").eq("id", userId).single();

  const cnh = asFile(formData.get("cnh_document"));
  const proof = asFile(formData.get("address_proof"));
  const errors: Record<string, string[]> = {};
  if (cnh || !current?.cnh_document_path) {
    const e = validateFile(cnh, DOC_TYPES);
    if (e) errors.cnh_document = [e];
  }
  if (proof || !current?.address_proof_path) {
    const e = validateFile(proof, DOC_TYPES);
    if (e) errors.address_proof = [e];
  }
  if (Object.keys(errors).length) return fail("Revise os documentos enviados.", errors);

  try {
    const cnhPath = cnh ? await uploadFile(supabase, "documents", userId, cnh, `cnh-${Date.now()}`) : current?.cnh_document_path;
    const proofPath = proof ? await uploadFile(supabase, "documents", userId, proof, `comprovante-${Date.now()}`) : current?.address_proof_path;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `lgpd` vira timestamp
    const { lgpd, ...profile } = data;
    const { error } = await supabase
      .from("profiles")
      .update({ ...profile, cnh_document_path: cnhPath, address_proof_path: proofPath, lgpd_consent_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) return fail(translateError(error));
    const join = await supabase.rpc("join_with_invitation", { p_code: code });
    if (join.error) return fail(translateError(join.error));
    (await cookies()).set(ORG_COOKIE, join.data as string, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
  } catch (error) {
    return fail(translateError(error as Error));
  }
  return success("Cadastro enviado! Aguarde a aprovação da locadora.", { redirectTo: "/app" });
}

export async function joinWithExistingProfile(code: string): Promise<FormState> {
  const session = await getSession();
  if (!session) return fail("Sua sessão expirou. Entre novamente.");
  const { data, error } = await session.supabase.rpc("join_with_invitation", { p_code: code });
  if (error) return fail(translateError(error));
  (await cookies()).set(ORG_COOKIE, data as string, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
  return success("Solicitação enviada à locadora.", { redirectTo: "/app" });
}

export async function createInvite(_: FormState, formData: FormData): Promise<FormState> {
  const { data, state } = parseForm(inviteSchema, formData);
  if (!data) return state;
  try {
    const ctx = await ownerActionContext();
    const { error } = await ctx.supabase.from("invitations").insert({
      organization_id: ctx.orgId,
      label: data.label,
      max_uses: data.max_uses,
      expires_at: new Date(Date.now() + data.days * 86_400_000).toISOString(),
    });
    if (error) return fail(translateError(error));
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath("/painel/locatarios");
  return success("Convite criado. Compartilhe o link com o locatário.");
}

export async function revokeInvite(id: string): Promise<FormState> {
  try {
    const ctx = await ownerActionContext();
    const { error } = await ctx.supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", ctx.orgId);
    if (error) return fail(translateError(error));
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath("/painel/locatarios");
  return success("Convite revogado.");
}

export async function reviewMembership(id: string, decision: "approved" | "rejected" | "revoked", notes?: string): Promise<FormState> {
  try {
    const ctx = await ownerActionContext();
    const { error } = await ctx.supabase.rpc("review_membership", { p_membership: id, p_decision: decision, p_notes: notes ?? null });
    if (error) return fail(translateError(error));
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath("/painel/locatarios");
  return success(decision === "approved" ? "Locatário aprovado." : decision === "rejected" ? "Solicitação recusada." : "Vínculo encerrado.");
}

/** Atualização do perfil pelo próprio locatário (mesmas validações do cadastro; documentos opcionais se já enviados). */
export async function updateRenterProfile(_: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return fail("Sua sessão expirou. Entre novamente.");
  const { data, state } = parseForm(renterProfileSchema, formData);
  if (!data) return state;
  const { supabase, userId } = session;
  const update: Record<string, unknown> = {};
  for (const [field, prefix] of [["cnh_document", "cnh"], ["address_proof", "comprovante"]] as const) {
    const file = asFile(formData.get(field));
    if (file) {
      const e = validateFile(file, DOC_TYPES);
      if (e) return fail(e, { [field]: [e] });
      update[`${field}_path`] = await uploadFile(supabase, "documents", userId, file, `${prefix}-${Date.now()}`);
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `lgpd` vira timestamp
  const { lgpd, ...profile } = data;
  const { error } = await supabase.from("profiles").update({ ...profile, ...update, lgpd_consent_at: new Date().toISOString() }).eq("id", userId);
  if (error) return fail(translateError(error));
  revalidatePath("/app/perfil");
  return success("Perfil atualizado.");
}
