/**
 * Aceita apenas caminhos internos para evitar open redirect.
 * Rejeita `//host` e `/\host` (navegadores e o parser de URL tratam `\` como `/`) e caracteres de controle.
 */
export function safeNext(next: unknown, fallback = "/inicio"): string {
  if (typeof next !== "string" || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}
