import { z } from "zod";
import { isValidCnh, isValidCnpj, isValidCpf, isValidPlate, normalizePlate, onlyDigits, UFS } from "./br";

const trimmed = (max = 200) => z.string().trim().max(max, `Máximo de ${max} caracteres.`);
const optionalText = (max = 200) => trimmed(max).optional().transform((v) => (v ? v : null));
const digits = z.string().transform(onlyDigits);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");
const optionalDate = z.union([isoDate, z.literal("")]).optional().transform((v) => (v ? v : null));
const money = z.coerce.number({ error: "Informe um valor." }).min(0, "Valor não pode ser negativo.").max(10_000_000, "Valor muito alto.");
const intField = (min: number, max: number, label: string) =>
  z.coerce.number({ error: `Informe ${label}.` }).int(`Informe ${label} inteiro.`).min(min, `Mínimo ${min}.`).max(max, `Máximo ${max}.`);

export const phoneSchema = digits.refine((v) => v.length === 10 || v.length === 11, "Telefone com DDD (10 ou 11 dígitos).");
const optionalCep = digits.refine((v) => v === "" || v.length === 8, "CEP com 8 dígitos.").transform((v) => v || null);
const optionalUf = z.union([z.enum(UFS), z.literal("")]).optional().transform((v) => v || null);

export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(72, "Senha muito longa.")
  .regex(/[A-Za-z]/, "Inclua ao menos uma letra.")
  .regex(/\d/, "Inclua ao menos um número.");

export const signInSchema = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  password: z.string().min(1, "Informe sua senha."),
  next: z.string().optional(),
});

export const signUpSchema = z
  .object({
    full_name: trimmed(120).min(3, "Informe seu nome completo."),
    email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
    password: passwordSchema,
    confirm: z.string(),
    terms: z.literal("on", { error: "Aceite os termos e a política de privacidade." }),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "As senhas não conferem." });

export const resetRequestSchema = z.object({ email: z.email("Informe um e-mail válido.").trim().toLowerCase() });
export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "As senhas não conferem." });

const addressFields = {
  address_zip: optionalCep,
  address_street: optionalText(160),
  address_number: optionalText(20),
  address_complement: optionalText(80),
  address_district: optionalText(80),
  address_city: optionalText(80),
  address_state: optionalUf,
};

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida.");

export const organizationSchema = z
  .object({
    name: trimmed(120).min(2, "Informe o nome da locadora."),
    document: digits,
    phone: phoneSchema,
    email: z.union([z.email("E-mail inválido."), z.literal("")]).optional().transform((v) => v || null),
    primary_color: hexColor.default("#1E6BFF"),
    secondary_color: hexColor.default("#00D1FF"),
    ...addressFields,
  })
  .superRefine((d, ctx) => {
    const ok = d.document.length === 11 ? isValidCpf(d.document) : d.document.length === 14 ? isValidCnpj(d.document) : false;
    if (!ok) ctx.addIssue({ code: "custom", path: ["document"], message: "CPF ou CNPJ inválido." });
  })
  .transform((d) => ({ ...d, document_type: (d.document.length === 11 ? "cpf" : "cnpj") as "cpf" | "cnpj" }));

export const renterProfileSchema = z.object({
  full_name: trimmed(120).min(3, "Informe seu nome completo."),
  cpf: digits.refine(isValidCpf, "CPF inválido."),
  birth_date: isoDate.refine((v) => {
    const age = (Date.now() - Date.parse(v)) / (365.25 * 86_400_000);
    return age >= 18 && age < 110;
  }, "É preciso ter pelo menos 18 anos."),
  phone: phoneSchema,
  address_zip: digits.refine((v) => v.length === 8, "CEP com 8 dígitos."),
  address_street: trimmed(160).min(2, "Informe o logradouro."),
  address_number: trimmed(20).min(1, "Informe o número."),
  address_complement: optionalText(80),
  address_district: trimmed(80).min(2, "Informe o bairro."),
  address_city: trimmed(80).min(2, "Informe a cidade."),
  address_state: z.enum(UFS, { error: "Selecione a UF." }),
  cnh_number: digits.refine(isValidCnh, "CNH deve ter 11 dígitos."),
  cnh_category: z.enum(["A", "B", "AB", "C", "D", "E", "AC", "AD", "AE"], { error: "Selecione a categoria." }),
  cnh_expires_at: isoDate.refine((v) => v >= new Date().toISOString().slice(0, 10), "CNH vencida."),
  emergency_contact_name: trimmed(120).min(3, "Informe o contato de emergência."),
  emergency_contact_phone: phoneSchema,
  lgpd: z.literal("on", { error: "É necessário consentir com o tratamento dos dados." }),
});

export const vehicleSchema = z.object({
  brand: trimmed(60).min(1, "Informe a marca."),
  model: trimmed(60).min(1, "Informe o modelo."),
  version: optionalText(80),
  year: intField(1950, new Date().getFullYear() + 1, "o ano"),
  plate: z.string().transform(normalizePlate).refine(isValidPlate, "Placa inválida (ABC1234 ou ABC1D23)."),
  color: optionalText(40),
  fuel: z.enum(["flex", "gasoline", "ethanol", "diesel", "electric", "hybrid", "gnv"]),
  transmission: z.enum(["manual", "automatic", "cvt"]),
  mileage: intField(0, 2_000_000, "a quilometragem"),
  seats: intField(1, 60, "os lugares"),
  daily_price: money,
  weekly_price: money,
  monthly_price: money,
  status: z.enum(["available", "reserved", "rented", "maintenance", "inactive"]).default("available"),
  notes: optionalText(2000),
  chassis: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-HJ-NPR-Z0-9]{17}$/.test(v), "Chassi deve ter 17 caracteres (sem I, O, Q).")
    .transform((v) => v || null),
  renavam: digits.refine((v) => v === "" || /^\d{9,11}$/.test(v), "RENAVAM com 9 a 11 dígitos.").transform((v) => v || null),
  licensing_due_at: optionalDate,
  insurance_due_at: optionalDate,
  ipva_due_at: optionalDate,
});

export const blockSchema = z
  .object({
    vehicle_id: z.uuid("Selecione o veículo."),
    kind: z.enum(["maintenance", "unavailable"]),
    start: isoDate,
    end: isoDate,
    reason: optionalText(200),
  })
  .refine((d) => d.end >= d.start, { path: ["end"], message: "A data final deve ser após a inicial." });

export const rentalSchema = z
  .object({
    vehicle_id: z.uuid("Selecione o veículo."),
    renter_id: z.uuid("Selecione o locatário."),
    start_date: isoDate,
    end_date: isoDate,
    modality: z.enum(["daily", "weekly", "monthly"]),
    unit_price: money,
    installments: intField(1, 24, "as parcelas"),
    clauses: trimmed(20000).min(20, "As cláusulas devem ter pelo menos 20 caracteres."),
  })
  .refine((d) => d.end_date >= d.start_date, { path: ["end_date"], message: "Término deve ser após o início." });

export const amendSchema = z.object({ clauses: trimmed(20000).min(20, "As cláusulas devem ter pelo menos 20 caracteres.") });

export const inviteSchema = z.object({
  label: optionalText(80),
  days: intField(1, 90, "a validade"),
  max_uses: z.union([intField(1, 500, "o limite"), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
});

export const expenseSchema = z.object({
  category: z.enum(["maintenance", "insurance", "ipva", "licensing", "fuel", "cleaning", "fines", "other"]),
  amount: money.refine((v) => v > 0, "Informe um valor maior que zero."),
  spent_at: isoDate,
  vehicle_id: z.union([z.uuid(), z.literal("")]).optional().transform((v) => v || null),
  description: optionalText(500),
});

export const maintenanceSchema = z
  .object({
    vehicle_id: z.uuid("Selecione o veículo."),
    kind: z.enum(["preventive", "corrective", "revision", "oil", "tires", "brakes", "other"]),
    description: trimmed(1000).min(2, "Descreva a manutenção."),
    status: z.enum(["scheduled", "completed"]),
    scheduled_for: optionalDate,
    scheduled_km: z.union([intField(0, 2_000_000, "o km"), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
    performed_at: optionalDate,
    mileage: z.union([intField(0, 2_000_000, "o km"), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
    cost: z.union([money, z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
    provider: optionalText(120),
  })
  .superRefine((d, ctx) => {
    if (d.status === "scheduled" && !d.scheduled_for && d.scheduled_km === null) {
      ctx.addIssue({ code: "custom", path: ["scheduled_for"], message: "Informe data ou km previstos." });
    }
    if (d.status === "completed" && !d.performed_at) {
      ctx.addIssue({ code: "custom", path: ["performed_at"], message: "Informe a data de realização." });
    }
  });

export const incidentSchema = z.object({
  vehicle_id: z.union([z.uuid(), z.literal("")]).optional().transform((v) => v || null),
  rental_id: z.union([z.uuid(), z.literal("")]).optional().transform((v) => v || null),
  kind: z.enum(["accident", "breakdown", "damage", "theft", "other"]),
  title: trimmed(120).min(3, "Informe um título."),
  description: trimmed(4000).min(5, "Descreva o ocorrido."),
  occurred_at: z.string().min(1, "Informe quando ocorreu."),
  location: optionalText(200),
});

export const fineSchema = z.object({
  vehicle_id: z.uuid("Selecione o veículo."),
  rental_id: z.union([z.uuid(), z.literal("")]).optional().transform((v) => v || null),
  description: trimmed(500).min(3, "Descreva a infração."),
  infraction_at: isoDate,
  amount: money,
  due_date: optionalDate,
  status: z.enum(["pending", "paid", "contested", "transferred"]).default("pending"),
  notes: optionalText(1000),
});

export const inspectionSchema = z.object({
  rental_id: z.uuid(),
  kind: z.enum(["pickup", "return"]),
  fuel_level: intField(0, 100, "o combustível"),
  mileage: intField(0, 2_000_000, "a quilometragem"),
  damages: optionalText(2000),
  notes: optionalText(2000),
  supersedes_id: z.union([z.uuid(), z.literal("")]).optional().transform((v) => v || null),
});

export const brandingSchema = z.object({
  primary_color: hexColor,
  secondary_color: hexColor,
});

export type VehicleInput = z.infer<typeof vehicleSchema>;
