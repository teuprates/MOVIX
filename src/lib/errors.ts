/** Tradução de erros do banco (MOVIX_*) e do Supabase para mensagens em pt-BR. */
const MESSAGES: Record<string, string> = {
  MOVIX_NOT_AUTHORIZED: "Você não tem permissão para esta ação.",
  MOVIX_ORG_LIMIT: "Limite de 3 locadoras por conta atingido.",
  MOVIX_INVITE_INVALID: "Convite inválido, expirado ou esgotado.",
  MOVIX_INVITE_OWN_ORG: "Você é o proprietário desta locadora.",
  MOVIX_INVALID_INPUT: "Dados inválidos. Revise os campos.",
  MOVIX_INVALID_STATE: "Esta ação não é permitida no estado atual.",
  MOVIX_HAS_OPEN_RENTALS: "O locatário possui locações em aberto nesta locadora.",
  MOVIX_VEHICLE_UNAVAILABLE: "Veículo inativo ou arquivado.",
  MOVIX_RENTER_NOT_APPROVED: "O locatário precisa estar aprovado nesta locadora.",
  MOVIX_PERIOD_OVERLAP: "O veículo já está reservado ou indisponível neste período.",
  MOVIX_CONTRACT_IMMUTABLE: "Contrato aceito não pode ser alterado. Emita um aditivo.",
  MOVIX_IMMUTABLE_RECORD: "Registro imutável.",
  MOVIX_NOTES_REQUIRED: "Descreva o que precisa ser corrigido.",
  MOVIX_CANNOT_SUSPEND_SELF: "Você não pode suspender a própria conta.",
  MOVIX_SCOPE_MISMATCH: "Os dados informados pertencem a outra locadora.",
  MOVIX_VEHICLE_NOT_FOUND: "Veículo não encontrado.",
  MOVIX_VEHICLE_PHOTO_LIMIT: "Limite de 12 fotos por veículo atingido. Remova alguma para adicionar outra.",
  MOVIX_RENTAL_NOT_FOUND: "Locação não encontrada.",
};

export function translateError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "Erro inesperado.";
  const msg = error.message ?? "";
  const key = Object.keys(MESSAGES).find((k) => msg.includes(k));
  if (key) return MESSAGES[key];
  if (error.code === "23505" || msg.includes("duplicate key")) {
    if (msg.includes("plate")) return "Já existe um veículo com esta placa.";
    return "Registro duplicado.";
  }
  if (error.code === "23P01" || msg.includes("exclusion constraint")) return MESSAGES.MOVIX_PERIOD_OVERLAP;
  if (error.code === "42501" || msg.includes("row-level security") || msg.includes("permission denied")) {
    return MESSAGES.MOVIX_NOT_AUTHORIZED;
  }
  if (error.code === "23514") return "Algum valor está fora do formato permitido.";
  if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (msg.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (msg.includes("User already registered")) return "Este e-mail já possui cadastro. Faça login.";
  if (msg.toLowerCase().includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos.";
  if (msg.includes("Password should be")) return "A senha não atende aos requisitos mínimos.";
  return "Não foi possível concluir a operação. Tente novamente.";
}
