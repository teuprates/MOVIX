"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL, isSupabaseConfigured } from "@/lib/env";
import { translateError } from "@/lib/errors";
import { safeNext } from "@/lib/safe-redirect";
import { fail, parseForm, success, type FormState } from "@/lib/form-state";
import { newPasswordSchema, resetRequestSchema, signInSchema, signUpSchema } from "@/lib/validation/schemas";

const notConfigured = () => fail("Supabase não configurado neste ambiente. Veja /configuracao.");


async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : SITE_URL;
}

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const { data, state } = parseForm(signInSchema, formData);
  if (!data) return state;
  if (!isSupabaseConfigured()) return notConfigured();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
  if (error) return fail(translateError(error));
  redirect(safeNext(data.next));
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const { data, state } = parseForm(signUpSchema, formData);
  if (!data) return state;
  if (!isSupabaseConfigured()) return notConfigured();
  const role = formData.get("intended_role") === "renter" ? "renter" : "owner";
  const next = safeNext(formData.get("next"), role === "owner" ? "/onboarding" : "/inicio");
  const supabase = await createClient();
  const { data: res, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: { full_name: data.full_name, intended_role: role },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return fail(translateError(error));
  // Projeto sem confirmação de e-mail: sessão já existe.
  if (res.session) redirect(next);
  // Supabase não revela se o e-mail já existe (identities vazio) — mensagem neutra.
  return success(undefined, { redirectTo: `/verificar-email?email=${encodeURIComponent(data.email)}` });
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/entrar");
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const { data, state } = parseForm(resetRequestSchema, formData);
  if (!data) return state;
  if (!isSupabaseConfigured()) return notConfigured();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(data.email, {
    redirectTo: `${await origin()}/auth/callback?next=/redefinir-senha`,
  });
  return success("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
}

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  const { data, state } = parseForm(newPasswordSchema, formData);
  if (!data) return state;
  if (!isSupabaseConfigured()) return notConfigured();
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: data.password });
  if (error) return fail(translateError(error));
  return success("Senha atualizada.", { redirectTo: "/inicio" });
}
