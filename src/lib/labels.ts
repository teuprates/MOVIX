/** Rótulos pt-BR para enums do banco. */
export const VEHICLE_STATUS = {
  available: "Disponível",
  reserved: "Reservado",
  rented: "Alugado",
  maintenance: "Manutenção",
  inactive: "Inativo",
} as const;

export const FUEL = {
  flex: "Flex",
  gasoline: "Gasolina",
  ethanol: "Etanol",
  diesel: "Diesel",
  electric: "Elétrico",
  hybrid: "Híbrido",
  gnv: "GNV",
} as const;

export const TRANSMISSION = { manual: "Manual", automatic: "Automático", cvt: "CVT" } as const;

export const RENTAL_STATUS = {
  pending_acceptance: "Aguardando aceite",
  active: "Ativa",
  completed: "Encerrada",
  cancelled: "Cancelada",
} as const;

export const INSTALLMENT_STATUS = { pending: "Pendente", paid: "Paga", cancelled: "Cancelada", overdue: "Vencida" } as const;

export const MEMBERSHIP_STATUS = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Recusado",
  revoked: "Encerrado",
} as const;

export const INSPECTION_KIND = { pickup: "Retirada", return: "Devolução" } as const;
export const INSPECTION_STATUS = {
  submitted: "Em análise",
  approved: "Aprovada",
  correction_requested: "Correção solicitada",
} as const;
export const INSPECTION_ANGLES = {
  front: "Frente",
  back: "Traseira",
  left: "Lateral esquerda",
  right: "Lateral direita",
  interior: "Interior",
  extra: "Extra",
} as const;
export const INSPECTION_CHECKLIST = {
  pneus: "Pneus em bom estado",
  estepe: "Estepe, macaco e chave de roda",
  farois: "Faróis e lanternas funcionando",
  limpeza: "Veículo limpo",
  documentos: "Documento (CRLV) no veículo",
  arCondicionado: "Ar-condicionado funcionando",
  painel: "Sem alertas no painel",
  vidros: "Vidros e retrovisores íntegros",
} as const;

export const MAINTENANCE_KIND = {
  preventive: "Preventiva",
  corrective: "Corretiva",
  revision: "Revisão",
  oil: "Troca de óleo",
  tires: "Pneus",
  brakes: "Freios",
  other: "Outra",
} as const;
export const MAINTENANCE_STATUS = { scheduled: "Agendada", completed: "Concluída" } as const;

export const INCIDENT_KIND = {
  accident: "Acidente",
  breakdown: "Pane",
  damage: "Avaria",
  theft: "Furto/Roubo",
  other: "Outro",
} as const;
export const INCIDENT_STATUS = {
  open: "Aberta",
  in_review: "Em análise",
  resolved: "Resolvida",
  cancelled: "Cancelada",
} as const;

export const FINE_STATUS = {
  pending: "Pendente",
  paid: "Paga pela locadora",
  contested: "Em recurso",
  transferred: "Transferida ao locatário",
} as const;

export const EXPENSE_CATEGORY = {
  maintenance: "Manutenção",
  insurance: "Seguro",
  ipva: "IPVA",
  licensing: "Licenciamento",
  fuel: "Combustível",
  cleaning: "Limpeza",
  fines: "Multas",
  other: "Outros",
} as const;

export const BLOCK_KIND = { rental: "Locação", maintenance: "Manutenção", unavailable: "Indisponível" } as const;

export const PAYMENT_METHOD = { pix: "Pix (simulado)", card: "Cartão (simulado)" } as const;
