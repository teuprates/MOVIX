/**
 * Seed idempotente de DEMONSTRAÇÃO (dados 100% sintéticos).
 *   npm run seed          (lê .env.local)
 * Requer: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY) e SEED_USER_PASSWORD.
 * Pode ser executado várias vezes: reaproveita usuários/locadoras e recria os dados operacionais das locadoras demo.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_USER_PASSWORD;
if (!url || !key || !password) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SEED_USER_PASSWORD em .env.local");
  process.exit(1);
}
const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

/** CPF sintético válido (dígitos verificadores calculados) a partir de uma base fixa. */
function syntheticCpf(base9: string) {
  const d = base9.split("").map(Number);
  const dv = (len: number) => {
    const sum = d.slice(0, len).reduce((s, n, i) => s + n * (len + 1 - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  d.push(dv(9));
  d.push(dv(10));
  return d.join("");
}

export const SEED_USERS = {
  admin: { email: "admin@movix.demo", name: "Administração MOVIX", role: "owner" },
  ownerA: { email: "dono@movix.demo", name: "Paula Proprietária (demo)", role: "owner" },
  ownerB: { email: "dono.b@movix.demo", name: "Rafael Proprietário (demo)", role: "owner" },
  renter: { email: "locatario@movix.demo", name: "Lucas Locatário (demo)", role: "renter" },
  renter2: { email: "locataria@movix.demo", name: "Marina Locatária (demo)", role: "renter" },
  pending: { email: "pendente@movix.demo", name: "Pedro Pendente (demo)", role: "renter" },
  outsider: { email: "semvinculo@movix.demo", name: "Sofia Sem Vínculo (demo)", role: "renter" },
} as const;

async function ensureUser(email: string, fullName: string, role: string) {
  for (let page = 1; page < 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) {
      await db.auth.admin.updateUserById(found.id, { password, email_confirm: true });
      return found.id;
    }
    if (data.users.length < 200) break;
  }
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, intended_role: role } });
  if (error) throw error;
  return data.user.id;
}

async function ensureOrg(ownerId: string, name: string, document: string, color: string) {
  const { data: existing } = await db.from("organizations").select("id").eq("owner_id", ownerId).eq("name", name).maybeSingle();
  let id = existing?.id as string | undefined;
  if (!id) {
    const { data, error } = await db
      .from("organizations")
      .insert({ owner_id: ownerId, name, document, document_type: "cnpj", phone: "11900000000", email: null, address_city: "São Paulo", address_state: "SP", primary_color: color, secondary_color: "#00D1FF", is_demo: true })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id;
  } else {
    await db.from("organizations").update({ is_demo: true, suspended_at: null }).eq("id", id);
  }
  await db.from("organization_memberships").upsert({ organization_id: id, user_id: ownerId, role: "owner", status: "approved", decided_at: new Date().toISOString() }, { onConflict: "organization_id,user_id" });
  return id!;
}

async function ensureRenterProfile(userId: string, idx: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  await db.from("profiles").update({
    cpf: syntheticCpf(`90000000${idx}`),
    birth_date: `199${idx}-0${idx}-1${idx}`,
    phone: `119000000${pad(idx)}`,
    address_zip: "01000000", address_street: "Rua Fictícia", address_number: String(100 + idx), address_district: "Centro",
    address_city: "São Paulo", address_state: "SP",
    cnh_number: `9000000000${idx}`, cnh_category: "B", cnh_expires_at: "2030-12-31",
    emergency_contact_name: "Contato Fictício", emergency_contact_phone: "11900000099",
    lgpd_consent_at: new Date().toISOString(), suspended_at: null,
  }).eq("id", userId);
}

async function membership(orgId: string, userId: string, status: "approved" | "pending") {
  await db.from("organization_memberships").upsert(
    { organization_id: orgId, user_id: userId, role: "renter", status, decided_at: status === "approved" ? new Date().toISOString() : null },
    { onConflict: "organization_id,user_id" },
  );
}

async function main() {
  const ids: Record<keyof typeof SEED_USERS, string> = {} as never;
  for (const [k, u] of Object.entries(SEED_USERS)) ids[k as keyof typeof SEED_USERS] = await ensureUser(u.email, u.name, u.role);
  await db.from("profiles").update({ suspended_at: null }).in("id", Object.values(ids));
  await db.from("platform_admins").upsert({ user_id: ids.admin }, { onConflict: "user_id" });

  const orgA = await ensureOrg(ids.ownerA, "Horizonte Locações (demo)", "11222333000181", "#1E6BFF");
  const orgB = await ensureOrg(ids.ownerB, "Rota Sul Veículos (demo)", "44555666000172", "#7C3AED");

  let i = 1;
  for (const u of [ids.renter, ids.renter2, ids.pending, ids.outsider]) await ensureRenterProfile(u, i++);
  await membership(orgA, ids.renter, "approved");
  await membership(orgA, ids.renter2, "approved");
  await membership(orgB, ids.renter, "approved");
  await membership(orgA, ids.pending, "pending");

  const { data: inv } = await db.from("invitations").select("code").eq("organization_id", orgA).is("revoked_at", null).gt("expires_at", new Date().toISOString()).limit(1);
  let code = inv?.[0]?.code as string | undefined;
  if (!code) {
    const { data, error } = await db.from("invitations").insert({ organization_id: orgA, created_by: ids.ownerA, label: "Convite demo", expires_at: new Date(Date.now() + 90 * 86_400_000).toISOString() }).select("code").single();
    if (error) throw error;
    code = data.code;
  }

  for (const [org, variant] of [[orgA, 1], [orgB, 2]] as const) {
    const { data, error } = await db.rpc("demo_populate", { p_org: org, p_variant: variant });
    if (error) throw error;
    console.log(`Locadora demo ${variant}:`, data);
  }

  console.log("\nSeed concluído. Contas sintéticas (senha = SEED_USER_PASSWORD):");
  for (const u of Object.values(SEED_USERS)) console.log(`  - ${u.email}`);
  console.log(`Convite demo: /convite/${code}`);
}

main().catch((e) => {
  console.error("Falha no seed:", e.message ?? e);
  process.exit(1);
});
