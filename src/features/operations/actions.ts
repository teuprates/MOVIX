"use server";
import { revalidatePath } from "next/cache";
import { getSession, ownerActionContext } from "@/lib/auth/context";
import { translateError } from "@/lib/errors";
import { fail, parseForm, success, type FormState } from "@/lib/form-state";
import { asFiles, DOC_TYPES, uploadFile, validateFile } from "@/lib/storage";
import { expenseSchema, fineSchema, incidentSchema, maintenanceSchema } from "@/lib/validation/schemas";

type Ctx = Awaited<ReturnType<typeof ownerActionContext>>;
async function owner<T>(fn: (ctx: Ctx) => Promise<T>) {
  try {
    return await fn(await ownerActionContext());
  } catch (e) {
    return fail(translateError(e as Error)) as T;
  }
}

/* ------------------------------------------------------------ Manutenção */
export async function createMaintenance(_: FormState, formData: FormData): Promise<FormState> {
  const { data, state } = parseForm(maintenanceSchema, formData);
  if (!data) return state;
  return owner(async (ctx) => {
    const { data: row, error } = await ctx.supabase.from("maintenance_records").insert({ ...data, organization_id: ctx.orgId }).select("id, vehicle_id").single();
    if (error) return fail(translateError(error));
    if (data.status === "completed" && data.cost) {
      await ctx.supabase.from("expenses").insert({
        organization_id: ctx.orgId, vehicle_id: row.vehicle_id, category: "maintenance", amount: data.cost,
        spent_at: data.performed_at, description: data.description, maintenance_id: row.id,
      });
    }
    if (data.status === "completed" && data.mileage) {
      const { data: v } = await ctx.supabase.from("vehicles").select("mileage").eq("id", data.vehicle_id).single();
      if (v && data.mileage > v.mileage) await ctx.supabase.from("vehicles").update({ mileage: data.mileage }).eq("id", data.vehicle_id);
    }
    revalidatePath("/painel/manutencao");
    return success("Manutenção registrada.");
  });
}

export async function completeMaintenance(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const performed = String(formData.get("performed_at") ?? "");
  const cost = Number(formData.get("cost") || 0);
  const mileage = formData.get("mileage") ? Number(formData.get("mileage")) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(performed)) return fail("Informe a data.", { performed_at: ["Informe a data."] });
  if (Number.isNaN(cost) || cost < 0) return fail("Custo inválido.", { cost: ["Custo inválido."] });
  return owner(async (ctx) => {
    const { data: m, error } = await ctx.supabase
      .from("maintenance_records")
      .update({ status: "completed", performed_at: performed, cost: cost || null, mileage })
      .eq("id", id).eq("organization_id", ctx.orgId).select("vehicle_id, description").single();
    if (error) return fail(translateError(error));
    if (cost > 0) {
      await ctx.supabase.from("expenses").upsert(
        { organization_id: ctx.orgId, vehicle_id: m.vehicle_id, category: "maintenance", amount: cost, spent_at: performed, description: m.description, maintenance_id: id },
        { onConflict: "maintenance_id" },
      );
    }
    if (mileage) {
      const { data: v } = await ctx.supabase.from("vehicles").select("mileage").eq("id", m.vehicle_id).single();
      if (v && mileage > v.mileage) await ctx.supabase.from("vehicles").update({ mileage }).eq("id", m.vehicle_id);
    }
    revalidatePath("/painel/manutencao");
    return success("Manutenção concluída.");
  });
}

export async function deleteMaintenance(id: string): Promise<FormState> {
  return owner(async (ctx) => {
    const { error } = await ctx.supabase.from("maintenance_records").delete().eq("id", id).eq("organization_id", ctx.orgId);
    if (error) return fail(translateError(error));
    revalidatePath("/painel/manutencao");
    return success("Registro removido.");
  });
}

/* ------------------------------------------------------------ Ocorrências */
/** Proprietário ou locatário (com locação ativa) registram ocorrências com anexos. */
export async function createIncident(_: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return fail("Sua sessão expirou.");
  const { data, state } = parseForm(incidentSchema, formData);
  if (!data) return state;
  if (!data.vehicle_id && !data.rental_id) return fail("Selecione o veículo ou a locação.", { vehicle_id: ["Selecione o veículo."] });
  const files = asFiles(formData.getAll("attachments")).slice(0, 6);
  const bad = files.map((f) => validateFile(f, DOC_TYPES)).find(Boolean);
  if (bad) return fail(bad, { attachments: [bad] });

  let vehicleId = data.vehicle_id;
  let orgId: string | null = null;
  if (data.rental_id) {
    const { data: r } = await session.supabase.from("rentals").select("vehicle_id, organization_id").eq("id", data.rental_id).maybeSingle();
    if (!r) return fail("Locação não encontrada.");
    vehicleId = r.vehicle_id;
    orgId = r.organization_id;
  } else {
    const { data: v } = await session.supabase.from("vehicles").select("organization_id").eq("id", vehicleId!).maybeSingle();
    if (!v) return fail("Veículo não encontrado.");
    orgId = v.organization_id;
  }
  const { data: row, error } = await session.supabase
    .from("incidents")
    .insert({ ...data, vehicle_id: vehicleId, organization_id: orgId, occurred_at: new Date(data.occurred_at).toISOString(), reported_by: session.userId })
    .select("id, organization_id")
    .single();
  if (error) return fail(translateError(error));
  try {
    for (const f of files) {
      const path = await uploadFile(session.supabase, "incident-media", `${row.organization_id}/${row.id}`, f);
      await session.supabase.from("incident_media").insert({ incident_id: row.id, organization_id: row.organization_id, storage_path: path, uploaded_by: session.userId });
    }
  } catch (e) {
    return fail(`Ocorrência registrada, mas houve falha nos anexos: ${translateError(e as Error)}`);
  }
  revalidatePath("/painel/ocorrencias");
  revalidatePath("/app/ocorrencias");
  return success("Ocorrência registrada. A locadora foi notificada.");
}

export async function updateIncidentStatus(id: string, status: "in_review" | "resolved" | "cancelled", notes?: string): Promise<FormState> {
  return owner(async (ctx) => {
    const { error } = await ctx.supabase.from("incidents").update({ status, resolution_notes: notes || null }).eq("id", id).eq("organization_id", ctx.orgId);
    if (error) return fail(translateError(error));
    revalidatePath("/painel/ocorrencias");
    return success("Ocorrência atualizada.");
  });
}

/* ------------------------------------------------------------ Multas */
export async function createFine(_: FormState, formData: FormData): Promise<FormState> {
  const { data, state } = parseForm(fineSchema, formData);
  if (!data) return state;
  return owner(async (ctx) => {
    const { data: row, error } = await ctx.supabase.from("fines").insert({ ...data, organization_id: ctx.orgId }).select("id").single();
    if (error) return fail(translateError(error));
    if (data.status === "paid" && data.amount > 0) {
      await ctx.supabase.from("expenses").insert({ organization_id: ctx.orgId, vehicle_id: data.vehicle_id, category: "fines", amount: data.amount, spent_at: data.infraction_at, description: data.description, fine_id: row.id });
    }
    revalidatePath("/painel/multas");
    return success("Multa registrada.");
  });
}

export async function updateFineStatus(id: string, status: "pending" | "paid" | "contested" | "transferred"): Promise<FormState> {
  return owner(async (ctx) => {
    const { data: f, error } = await ctx.supabase.from("fines").update({ status }).eq("id", id).eq("organization_id", ctx.orgId).select("vehicle_id, amount, description").single();
    if (error) return fail(translateError(error));
    if (status === "paid" && Number(f.amount) > 0) {
      await ctx.supabase.from("expenses").upsert(
        { organization_id: ctx.orgId, vehicle_id: f.vehicle_id, category: "fines", amount: f.amount, spent_at: new Date().toISOString().slice(0, 10), description: f.description, fine_id: id },
        { onConflict: "fine_id" },
      );
    } else {
      await ctx.supabase.from("expenses").delete().eq("fine_id", id);
    }
    revalidatePath("/painel/multas");
    return success("Multa atualizada.");
  });
}

/* ------------------------------------------------------------ Despesas */
export async function createExpense(_: FormState, formData: FormData): Promise<FormState> {
  const { data, state } = parseForm(expenseSchema, formData);
  if (!data) return state;
  return owner(async (ctx) => {
    const { error } = await ctx.supabase.from("expenses").insert({ ...data, organization_id: ctx.orgId });
    if (error) return fail(translateError(error));
    revalidatePath("/painel/financeiro");
    return success("Despesa registrada.");
  });
}

export async function deleteExpense(id: string): Promise<FormState> {
  return owner(async (ctx) => {
    const { error } = await ctx.supabase.from("expenses").delete().eq("id", id).eq("organization_id", ctx.orgId).is("maintenance_id", null).is("fine_id", null);
    if (error) return fail(translateError(error));
    revalidatePath("/painel/financeiro");
    return success("Despesa removida.");
  });
}

/* ------------------------------------------------------------ Notificações */
export async function markNotificationsRead(ids?: string[]): Promise<FormState> {
  const session = await getSession();
  if (!session) return fail("Sua sessão expirou.");
  let q = session.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", session.userId).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) return fail(translateError(error));
  revalidatePath("/", "layout");
  return success(ids?.length ? undefined : "Todas marcadas como lidas.");
}

export async function markNotificationUnread(id: string): Promise<FormState> {
  const session = await getSession();
  if (!session) return fail("Sua sessão expirou.");
  const { error } = await session.supabase.from("notifications").update({ read_at: null }).eq("id", id).eq("user_id", session.userId);
  if (error) return fail(translateError(error));
  revalidatePath("/", "layout");
  return success();
}

export async function refreshAlerts(): Promise<FormState> {
  return owner(async (ctx) => {
    const { data, error } = await ctx.supabase.rpc("refresh_alerts", { p_org: ctx.orgId });
    if (error) return fail(translateError(error));
    revalidatePath("/painel", "layout");
    return success(data ? `${data} alerta(s) verificados.` : "Nenhum alerta novo.");
  });
}
