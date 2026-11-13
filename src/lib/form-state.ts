import type { z } from "zod";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
  redirectTo?: string;
  data?: Record<string, unknown>;
};

export const fail = (message: string, errors?: FormState["errors"]): FormState => ({ ok: false, message, errors });
export const success = (message?: string, extra?: Partial<FormState>): FormState => ({ ok: true, message, ...extra });

/** Converte FormData em objeto simples (campos repetidos viram arrays). */
export function formToObject(formData: FormData) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (key in out) {
      const prev = out[key];
      out[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function parseForm<T extends z.ZodType>(schema: T, formData: FormData) {
  const result = schema.safeParse(formToObject(formData));
  if (result.success) return { data: result.data as z.infer<T>, state: null };
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_form";
    (errors[key] ??= []).push(issue.message);
  }
  return { data: null, state: fail("Revise os campos destacados.", errors) };
}
