"use server";
import { revalidatePath } from "next/cache";
import { getSession, ownerActionContext } from "@/lib/auth/context";
import { translateError } from "@/lib/errors";
import { fail, parseForm, success, type FormState } from "@/lib/form-state";
import { INSPECTION_CHECKLIST } from "@/lib/labels";
import { EVIDENCE_PHOTO } from "@/lib/image";
import { asFile, asFiles, uploadFile, validateImage } from "@/lib/storage";
import { inspectionSchema } from "@/lib/validation/schemas";

const REQUIRED_ANGLES = ["front", "back", "left", "right", "interior"] as const;

export async function submitInspection(_: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return fail("Sua sessão expirou. Entre novamente.");
  const { data, state } = parseForm(inspectionSchema, formData);
  if (!data) return state;

  const errors: Record<string, string[]> = {};
  const photos: { angle: string; file: File }[] = [];
  for (const angle of REQUIRED_ANGLES) {
    const file = asFile(formData.get(`photo_${angle}`));
    // Limite do bucket (5 MB) vale para o arquivo já normalizado no cliente; antes era 8 MB e o storage recusava.
    const err = await validateImage(file, EVIDENCE_PHOTO);
    if (err) errors[`photo_${angle}`] = [err === "Selecione um arquivo." ? "Foto obrigatória." : err];
    else photos.push({ angle, file: file! });
  }
  for (const file of asFiles(formData.getAll("photo_extra")).slice(0, 6)) {
    const err = await validateImage(file, EVIDENCE_PHOTO);
    if (err) errors.photo_extra = [`"${file.name}": ${err}`];
    else photos.push({ angle: "extra", file });
  }
  if (Object.keys(errors).length) return fail("Envie todas as fotos obrigatórias.", errors);

  const checklist = Object.fromEntries(Object.keys(INSPECTION_CHECKLIST).map((k) => [k, formData.get(`check_${k}`) === "on"]));
  const { supabase, userId } = session;
  const { data: row, error } = await supabase
    .from("inspections")
    .insert({ ...data, checklist, submitted_by: userId })
    .select("id, organization_id")
    .single();
  // organization_id e vehicle_id são derivados pela trigger a partir da locação.
  if (error) return fail(translateError(error));

  try {
    for (const p of photos) {
      const path = await uploadFile(supabase, "inspection-media", `${row.organization_id}/${row.id}`, p.file, `${p.angle}-${crypto.randomUUID().slice(0, 8)}`);
      const { error: mErr } = await supabase.from("inspection_media").insert({ inspection_id: row.id, organization_id: row.organization_id, angle: p.angle, storage_path: path });
      if (mErr) throw mErr;
    }
  } catch (e) {
    return fail(`Vistoria registrada, mas houve falha no envio de fotos: ${translateError(e as Error)}`);
  }
  revalidatePath("/app");
  return success("Vistoria enviada para análise da locadora.", { redirectTo: `/app/vistorias/${row.id}` });
}

export async function reviewInspection(id: string, decision: "approved" | "correction_requested", notes?: string): Promise<FormState> {
  try {
    const ctx = await ownerActionContext();
    const { error } = await ctx.supabase.rpc("review_inspection", { p_inspection: id, p_decision: decision, p_notes: notes ?? null });
    if (error) return fail(translateError(error));
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath(`/painel/vistorias/${id}`);
  return success(decision === "approved" ? "Vistoria aprovada." : "Correção solicitada ao locatário.");
}
