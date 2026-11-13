"use server";
import { revalidatePath } from "next/cache";
import { ownerActionContext } from "@/lib/auth/context";
import { translateError } from "@/lib/errors";
import { fail, parseForm, success, type FormState } from "@/lib/form-state";
import { asFiles, IMAGE_TYPES, uploadFile, validateFile } from "@/lib/storage";
import { blockSchema, vehicleSchema } from "@/lib/validation/schemas";

function split(data: ReturnType<typeof vehicleSchema.parse>) {
  const { chassis, renavam, licensing_due_at, insurance_due_at, ipva_due_at, ...vehicle } = data;
  return { vehicle, priv: { chassis, renavam, licensing_due_at, insurance_due_at, ipva_due_at } };
}

async function uploadPhotos(ctx: Awaited<ReturnType<typeof ownerActionContext>>, vehicleId: string, files: File[], startAt = 0) {
  for (const [i, file] of files.slice(0, 10).entries()) {
    const path = await uploadFile(ctx.supabase, "vehicle-media", `${ctx.orgId}/${vehicleId}`, file);
    const { error } = await ctx.supabase.from("vehicle_media").insert({ vehicle_id: vehicleId, organization_id: ctx.orgId, storage_path: path, position: startAt + i });
    if (error) throw error;
  }
}

export async function createVehicle(_: FormState, formData: FormData): Promise<FormState> {
  const { data, state } = parseForm(vehicleSchema, formData);
  if (!data) return state;
  const photos = asFiles(formData.getAll("photos"));
  const bad = photos.map((f) => validateFile(f, IMAGE_TYPES)).find(Boolean);
  if (bad) return fail(bad, { photos: [bad] });
  try {
    const ctx = await ownerActionContext();
    const { vehicle, priv } = split(data);
    const { data: row, error } = await ctx.supabase.from("vehicles").insert({ ...vehicle, organization_id: ctx.orgId }).select("id").single();
    if (error) return fail(translateError(error));
    const { error: privErr } = await ctx.supabase.from("vehicle_private_data").insert({ vehicle_id: row.id, organization_id: ctx.orgId, ...priv });
    if (privErr) return fail(translateError(privErr));
    await uploadPhotos(ctx, row.id, photos);
    revalidatePath("/painel/frota");
    return success("Veículo cadastrado.", { redirectTo: `/painel/frota/${row.id}` });
  } catch (e) {
    return fail(translateError(e as Error));
  }
}

export async function updateVehicle(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const { data, state } = parseForm(vehicleSchema, formData);
  if (!data) return state;
  try {
    const ctx = await ownerActionContext();
    const { vehicle, priv } = split(data);
    const { error } = await ctx.supabase.from("vehicles").update(vehicle).eq("id", id).eq("organization_id", ctx.orgId);
    if (error) return fail(translateError(error));
    const { error: privErr } = await ctx.supabase
      .from("vehicle_private_data")
      .upsert({ vehicle_id: id, organization_id: ctx.orgId, ...priv }, { onConflict: "vehicle_id" });
    if (privErr) return fail(translateError(privErr));
    revalidatePath(`/painel/frota/${id}`);
    return success("Veículo atualizado.", { redirectTo: `/painel/frota/${id}` });
  } catch (e) {
    return fail(translateError(e as Error));
  }
}

export async function archiveVehicle(id: string): Promise<FormState> {
  try {
    const ctx = await ownerActionContext();
    const { count } = await ctx.supabase
      .from("rentals")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", id)
      .in("status", ["pending_acceptance", "active"]);
    if (count) return fail("Encerre ou cancele as locações em aberto antes de arquivar.");
    const { error } = await ctx.supabase
      .from("vehicles")
      .update({ archived_at: new Date().toISOString(), status: "inactive" })
      .eq("id", id)
      .eq("organization_id", ctx.orgId);
    if (error) return fail(translateError(error));
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath("/painel/frota");
  return success("Veículo arquivado. O histórico foi preservado.", { redirectTo: "/painel/frota" });
}

export async function addVehiclePhotos(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const photos = asFiles(formData.getAll("photos"));
  if (photos.length === 0) return fail("Selecione ao menos uma foto.", { photos: ["Selecione ao menos uma foto."] });
  const bad = photos.map((f) => validateFile(f, IMAGE_TYPES)).find(Boolean);
  if (bad) return fail(bad, { photos: [bad] });
  try {
    const ctx = await ownerActionContext();
    const { count } = await ctx.supabase.from("vehicle_media").select("id", { count: "exact", head: true }).eq("vehicle_id", id);
    if ((count ?? 0) + photos.length > 12) return fail("Limite de 12 fotos por veículo.");
    await uploadPhotos(ctx, id, photos, count ?? 0);
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath(`/painel/frota/${id}`);
  return success("Fotos adicionadas.");
}

export async function deleteVehiclePhoto(mediaId: string): Promise<FormState> {
  try {
    const ctx = await ownerActionContext();
    const { data: media } = await ctx.supabase.from("vehicle_media").select("storage_path, vehicle_id").eq("id", mediaId).eq("organization_id", ctx.orgId).single();
    if (!media) return fail("Foto não encontrada.");
    await ctx.supabase.storage.from("vehicle-media").remove([media.storage_path]);
    const { error } = await ctx.supabase.from("vehicle_media").delete().eq("id", mediaId);
    if (error) return fail(translateError(error));
    revalidatePath(`/painel/frota/${media.vehicle_id}`);
  } catch (e) {
    return fail(translateError(e as Error));
  }
  return success("Foto removida.");
}

export async function createBlock(_: FormState, formData: FormData): Promise<FormState> {
  const { data, state } = parseForm(blockSchema, formData);
  if (!data) return state;
  try {
    const ctx = await ownerActionContext();
    const { error } = await ctx.supabase.from("vehicle_availability_blocks").insert({
      organization_id: ctx.orgId,
      vehicle_id: data.vehicle_id,
      kind: data.kind,
      period: `[${data.start},${data.end}]`,
      reason: data.reason,
      created_by: ctx.userId,
    });
    if (error) return fail(translateError(error));
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath("/painel/calendario");
  revalidatePath(`/painel/frota/${data.vehicle_id}`);
  return success("Período bloqueado.");
}

export async function deleteBlock(id: string): Promise<FormState> {
  try {
    const ctx = await ownerActionContext();
    const { error } = await ctx.supabase.from("vehicle_availability_blocks").delete().eq("id", id).eq("organization_id", ctx.orgId);
    if (error) return fail(translateError(error));
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath("/painel/calendario");
  return success("Bloqueio removido.");
}
