"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession, ORG_COOKIE, ownerActionContext } from "@/lib/auth/context";
import { translateError } from "@/lib/errors";
import { fail, parseForm, success, type FormState } from "@/lib/form-state";
import { asFile, uploadFile, validateFile } from "@/lib/storage";
import { organizationSchema } from "@/lib/validation/schemas";

export async function createOrganization(_: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return fail("Sua sessão expirou. Entre novamente.");
  const { data, state } = parseForm(organizationSchema, formData);
  if (!data) return state;
  const { data: orgId, error } = await session.supabase.rpc("create_organization", {
    p_name: data.name,
    p_document: data.document,
    p_document_type: data.document_type,
    p_phone: data.phone,
    p_email: data.email,
    p_address_zip: data.address_zip,
    p_address_street: data.address_street,
    p_address_number: data.address_number,
    p_address_complement: data.address_complement,
    p_address_district: data.address_district,
    p_address_city: data.address_city,
    p_address_state: data.address_state,
    p_primary_color: data.primary_color,
    p_secondary_color: data.secondary_color,
  });
  if (error) return fail(translateError(error));
  const logo = asFile(formData.get("logo"));
  if (logo && !validateFile(logo, ["image/jpeg", "image/png", "image/webp", "image/svg+xml"], 1024 * 1024)) {
    try {
      const path = await uploadFile(session.supabase, "branding", orgId as string, logo, `logo-${Date.now()}`);
      await session.supabase.from("organizations").update({ logo_path: path }).eq("id", orgId);
    } catch {
      // Logo é opcional; pode ser enviado depois em Configurações.
    }
  }
  (await cookies()).set(ORG_COOKIE, orgId as string, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
  return success("Locadora criada! Bem-vindo ao MOVIX.", { redirectTo: "/painel" });
}

export async function updateOrganization(_: FormState, formData: FormData): Promise<FormState> {
  const { data, state } = parseForm(organizationSchema, formData);
  if (!data) return state;
  try {
    const ctx = await ownerActionContext();
    const update: Record<string, unknown> = { ...data };
    const logo = asFile(formData.get("logo"));
    if (logo) {
      const err = validateFile(logo, ["image/jpeg", "image/png", "image/webp", "image/svg+xml"], 1024 * 1024);
      if (err) return fail(err, { logo: [err] });
      update.logo_path = await uploadFile(ctx.supabase, "branding", ctx.orgId, logo, `logo-${Date.now()}`);
    }
    if (formData.get("remove_logo") === "on") update.logo_path = null;
    const { error } = await ctx.supabase.from("organizations").update(update).eq("id", ctx.orgId);
    if (error) return fail(translateError(error));
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath("/painel", "layout");
  return success("Dados da locadora atualizados.");
}
