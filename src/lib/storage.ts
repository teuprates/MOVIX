import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DOC_TYPES = [...IMAGE_TYPES, "application/pdf"] as const;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf", "image/svg+xml": "svg" };

export type Bucket = "documents" | "vehicle-media" | "inspection-media" | "incident-media" | "branding";

/** Valida tipo/tamanho no servidor (o bucket também restringe). Retorna mensagem de erro ou null. */
export function validateFile(file: File | null | undefined, types: readonly string[], maxBytes = 5 * 1024 * 1024) {
  if (!file || file.size === 0) return "Selecione um arquivo.";
  if (!types.includes(file.type)) return "Formato não permitido.";
  if (file.size > maxBytes) return `Arquivo maior que ${Math.round(maxBytes / 1024 / 1024)} MB.`;
  return null;
}

export const asFile = (v: FormDataEntryValue | null) => (v instanceof File && v.size > 0 ? v : null);
export const asFiles = (vs: FormDataEntryValue[]) => vs.filter((v): v is File => v instanceof File && v.size > 0);

/** Upload com a sessão do usuário — as políticas de storage decidem se pode gravar no caminho. */
export async function uploadFile(supabase: SupabaseClient, bucket: Bucket, prefix: string, file: File, name?: string) {
  const path = `${prefix}/${name ?? crypto.randomUUID()}.${EXT[file.type] ?? "bin"}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

/** URLs assinadas curtas (5 min) para arquivos privados. Retorna mapa caminho → URL. */
export async function signedUrls(supabase: SupabaseClient, bucket: Bucket, paths: (string | null | undefined)[], expiresIn = 300) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length === 0) return {} as Record<string, string>;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(list, expiresIn);
  const out: Record<string, string> = {};
  for (const item of data ?? []) if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  return out;
}

export function publicUrl(supabase: SupabaseClient, path: string | null | undefined) {
  if (!path) return null;
  return supabase.storage.from("branding").getPublicUrl(path).data.publicUrl;
}
