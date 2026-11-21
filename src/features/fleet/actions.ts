"use server";
import { revalidatePath } from "next/cache";
import { ownerActionContext } from "@/lib/auth/context";
import { translateError } from "@/lib/errors";
import { fail, parseForm, success, type FormState } from "@/lib/form-state";
import { photoObjectName, VEHICLE_PHOTO, VEHICLE_PHOTO_LIMITS } from "@/lib/image";
import { asFiles, uploadFile, validateImages } from "@/lib/storage";
import { blockSchema, vehicleSchema } from "@/lib/validation/schemas";

function split(data: ReturnType<typeof vehicleSchema.parse>) {
  const { chassis, renavam, licensing_due_at, insurance_due_at, ipva_due_at, ...vehicle } = data;
  return { vehicle, priv: { chassis, renavam, licensing_due_at, insurance_due_at, ipva_due_at } };
}

type OwnerCtx = Awaited<ReturnType<typeof ownerActionContext>>;

/**
 * Envia as fotos uma a uma: objeto no storage → linha em vehicle_media. Se a linha falhar, remove o objeto recém-enviado
 * (sem órfãos). Caminho: {org}/{veículo}/{timestamp}-{nome-original}.{ext} — o 1º segmento é exigido pelas policies.
 * Posições continuam após a maior existente (exclusões deixam lacunas; contar linhas geraria posições repetidas).
 */
async function uploadPhotos(ctx: OwnerCtx, vehicleId: string, files: File[]) {
  const { data: last } = await ctx.supabase
    .from("vehicle_media").select("position").eq("vehicle_id", vehicleId).order("position", { ascending: false }).limit(1).maybeSingle();
  let position = (last?.position ?? -1) + 1;
  const base = Date.now();
  for (const [i, file] of files.entries()) {
    const path = await uploadFile(ctx.supabase, "vehicle-media", `${ctx.orgId}/${vehicleId}`, file, photoObjectName(file.name, base + i));
    const { error } = await ctx.supabase.from("vehicle_media").insert({ vehicle_id: vehicleId, organization_id: ctx.orgId, storage_path: path, position });
    if (error) {
      await ctx.supabase.storage.from("vehicle-media").remove([path]);
      throw error;
    }
    position += 1;
  }
}

export async function createVehicle(_: FormState, formData: FormData): Promise<FormState> {
  const { data, state } = parseForm(vehicleSchema, formData);
  if (!data) return state;
  const photos = asFiles(formData.getAll("photos"));
  if (photos.length > VEHICLE_PHOTO_LIMITS.onCreate) {
    const msg = `Envie no máximo ${VEHICLE_PHOTO_LIMITS.onCreate} fotos no cadastro; as demais podem ser adicionadas depois.`;
    return fail(msg, { photos: [msg] });
  }
  const bad = await validateImages(photos, VEHICLE_PHOTO);
  if (bad) return fail(bad, { photos: [bad] });
  try {
    const ctx = await ownerActionContext();
    const { vehicle, priv } = split(data);
    const { data: row, error } = await ctx.supabase.from("vehicles").insert({ ...vehicle, organization_id: ctx.orgId }).select("id").single();
    if (error) return fail(translateError(error));
    const { error: privErr } = await ctx.supabase.from("vehicle_private_data").insert({ vehicle_id: row.id, organization_id: ctx.orgId, ...priv });
    if (privErr) return fail(translateError(privErr));
    revalidatePath("/painel/frota");
    try {
      await uploadPhotos(ctx, row.id, photos);
    } catch (e) {
      // O veículo já existe: não devolver erro (o reenvio duplicaria o cadastro). Fotos podem ser reenviadas na página dele.
      return success(`Veículo cadastrado, mas houve falha no envio das fotos (${translateError(e as Error)}). Adicione-as na página do veículo.`, {
        redirectTo: `/painel/frota/${row.id}`,
      });
    }
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
  const bad = await validateImages(photos, VEHICLE_PHOTO);
  if (bad) return fail(bad, { photos: [bad] });
  try {
    const ctx = await ownerActionContext();
    const { count } = await ctx.supabase.from("vehicle_media").select("id", { count: "exact", head: true }).eq("vehicle_id", id);
    const remaining = VEHICLE_PHOTO_LIMITS.perVehicle - (count ?? 0);
    if (photos.length > remaining) {
      const msg = remaining > 0
        ? `Limite de ${VEHICLE_PHOTO_LIMITS.perVehicle} fotos por veículo: você ainda pode enviar ${remaining}.`
        : `Limite de ${VEHICLE_PHOTO_LIMITS.perVehicle} fotos por veículo atingido. Remova alguma para adicionar outra.`;
      return fail(msg, { photos: [msg] });
    }
    // A trigger vehicle_media_limit garante o limite também sob envios concorrentes.
    await uploadPhotos(ctx, id, photos);
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath(`/painel/frota/${id}`);
  return success(photos.length === 1 ? "Foto adicionada." : `${photos.length} fotos adicionadas.`);
}

export async function deleteVehiclePhoto(mediaId: string): Promise<FormState> {
  try {
    const ctx = await ownerActionContext();
    const { data: media } = await ctx.supabase.from("vehicle_media").select("storage_path, vehicle_id").eq("id", mediaId).eq("organization_id", ctx.orgId).single();
    if (!media) return fail("Foto não encontrada.");
    // Primeiro a linha (RLS decide), depois o objeto: uma falha no storage deixa no máximo um arquivo órfão,
    // nunca uma linha apontando para imagem inexistente.
    const { data: deleted, error } = await ctx.supabase.from("vehicle_media").delete().eq("id", mediaId).select("id");
    if (error) return fail(translateError(error));
    if (!deleted?.length) return fail("Você não tem permissão para esta ação.");
    const { error: storageError } = await ctx.supabase.storage.from("vehicle-media").remove([media.storage_path]);
    if (storageError) console.error("vehicle-media: falha ao remover objeto", media.storage_path, storageError.message);
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
