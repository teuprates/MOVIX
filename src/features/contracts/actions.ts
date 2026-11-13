"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession, ownerActionContext } from "@/lib/auth/context";
import { translateError } from "@/lib/errors";
import { fail, parseForm, success, type FormState } from "@/lib/form-state";
import { amendSchema, rentalSchema } from "@/lib/validation/schemas";

export async function createRental(_: FormState, formData: FormData): Promise<FormState> {
  const { data, state } = parseForm(rentalSchema, formData);
  if (!data) return state;
  try {
    const ctx = await ownerActionContext();
    const { data: id, error } = await ctx.supabase.rpc("create_rental", {
      p_vehicle: data.vehicle_id,
      p_renter: data.renter_id,
      p_start: data.start_date,
      p_end: data.end_date,
      p_modality: data.modality,
      p_unit_price: data.unit_price,
      p_installments: data.installments,
      p_clauses: data.clauses,
    });
    if (error) {
      const msg = translateError(error);
      return fail(msg, error.message.includes("OVERLAP") ? { start_date: [msg] } : undefined);
    }
    revalidatePath("/painel/contratos");
    return success("Contrato emitido e enviado para aceite do locatário.", { redirectTo: `/painel/contratos/${id}` });
  } catch (e) {
    return fail(translateError(e as Error));
  }
}

export async function amendContract(rentalId: string, _: FormState, formData: FormData): Promise<FormState> {
  const { data, state } = parseForm(amendSchema, formData);
  if (!data) return state;
  try {
    const ctx = await ownerActionContext();
    const { error } = await ctx.supabase.rpc("amend_contract", { p_rental: rentalId, p_clauses: data.clauses });
    if (error) return fail(translateError(error));
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath(`/painel/contratos/${rentalId}`);
  return success("Aditivo emitido. O locatário precisa aceitar a nova versão.");
}

export async function cancelRental(rentalId: string, reason?: string): Promise<FormState> {
  try {
    const ctx = await ownerActionContext();
    const { error } = await ctx.supabase.rpc("cancel_rental", { p_rental: rentalId, p_reason: reason ?? null });
    if (error) return fail(translateError(error));
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath(`/painel/contratos/${rentalId}`);
  return success("Locação cancelada e período liberado no calendário.");
}

export async function completeRental(rentalId: string): Promise<FormState> {
  try {
    const ctx = await ownerActionContext();
    const { error } = await ctx.supabase.rpc("complete_rental", { p_rental: rentalId });
    if (error) return fail(translateError(error));
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath(`/painel/contratos/${rentalId}`);
  return success("Locação encerrada. Acesso do locatário aos dados restritos revogado.");
}

/** Aceite eletrônico pelo locatário: registra identidade (sessão), data/hora, versão, hash, user-agent e IP. */
export async function acceptContract(versionId: string, rentalId: string): Promise<FormState> {
  const session = await getSession();
  if (!session) return fail("Sua sessão expirou. Entre novamente.");
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
  const { error } = await session.supabase.rpc("accept_contract", {
    p_version: versionId,
    p_user_agent: h.get("user-agent")?.slice(0, 400) ?? null,
    p_ip: ip,
  });
  if (error) return fail(translateError(error));
  revalidatePath(`/app/locacoes/${rentalId}`);
  return success("Contrato aceito eletronicamente. Boa viagem!");
}

/** Pagamento SIMULADO — nenhuma transação bancária e nenhum dado de cartão é coletado. */
export async function simulatePayment(installmentId: string, method: "pix" | "card", path: string): Promise<FormState> {
  const session = await getSession();
  if (!session) return fail("Sua sessão expirou. Entre novamente.");
  if (method !== "pix" && method !== "card") return fail("Método inválido.");
  const { data, error } = await session.supabase.rpc("simulate_payment", { p_installment: installmentId, p_method: method });
  if (error) return fail(translateError(error));
  revalidatePath(path);
  return success(`Pagamento simulado confirmado (${data}).`);
}
