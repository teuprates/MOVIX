"use server";
import { revalidatePath } from "next/cache";
import { getIsPlatformAdmin, getSession } from "@/lib/auth/context";
import { translateError } from "@/lib/errors";
import { fail, success, type FormState } from "@/lib/form-state";

async function adminCtx() {
  const session = await getSession();
  if (!session || !(await getIsPlatformAdmin())) throw new Error("MOVIX_NOT_AUTHORIZED");
  return session;
}

export async function setAccountSuspension(userId: string, suspend: boolean, reason?: string): Promise<FormState> {
  try {
    const s = await adminCtx();
    const { error } = await s.supabase.rpc("admin_set_account_suspension", { p_user: userId, p_suspend: suspend, p_reason: reason ?? null });
    if (error) return fail(translateError(error));
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath("/admin");
  return success(suspend ? "Conta suspensa." : "Conta reativada.");
}

export async function setOrganizationSuspension(orgId: string, suspend: boolean, reason?: string): Promise<FormState> {
  try {
    const s = await adminCtx();
    const { error } = await s.supabase.rpc("admin_set_organization_suspension", { p_org: orgId, p_suspend: suspend, p_reason: reason ?? null });
    if (error) return fail(translateError(error));
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath("/admin");
  return success(suspend ? "Locadora suspensa." : "Locadora reativada.");
}
