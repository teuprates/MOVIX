-- MOVIX · setup completo (concatenação de supabase/migrations em ordem). Execute UMA vez no SQL Editor do Supabase.

-- ===== supabase/migrations/20261113000001_schema.sql
-- MOVIX · 0001 · Schema base
-- Tabelas, constraints, índices e triggers genéricas. RLS/policies em 0002, RPCs em 0003, storage em 0004.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Identidade
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text,
  phone text check (phone is null or phone ~ '^[0-9]{10,11}$'),
  cpf text check (cpf is null or cpf ~ '^[0-9]{11}$'),
  birth_date date,
  address_zip text check (address_zip is null or address_zip ~ '^[0-9]{8}$'),
  address_street text,
  address_number text,
  address_complement text,
  address_district text,
  address_city text,
  address_state text check (address_state is null or address_state ~ '^[A-Z]{2}$'),
  cnh_number text check (cnh_number is null or cnh_number ~ '^[0-9]{11}$'),
  cnh_category text check (cnh_category is null or cnh_category in ('A','B','AB','C','D','E','AC','AD','AE')),
  cnh_expires_at date,
  emergency_contact_name text,
  emergency_contact_phone text check (emergency_contact_phone is null or emergency_contact_phone ~ '^[0-9]{10,11}$'),
  cnh_document_path text,
  address_proof_path text,
  intended_role text not null default 'owner' check (intended_role in ('owner','renter')),
  lgpd_consent_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Locadoras e vínculos
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id),
  name text not null check (char_length(name) between 2 and 120),
  document text not null check (document ~ '^([0-9]{11}|[0-9]{14})$'),
  document_type text not null check (document_type in ('cpf','cnpj')),
  phone text check (phone is null or phone ~ '^[0-9]{10,11}$'),
  email text,
  address_zip text check (address_zip is null or address_zip ~ '^[0-9]{8}$'),
  address_street text,
  address_number text,
  address_complement text,
  address_district text,
  address_city text,
  address_state text check (address_state is null or address_state ~ '^[A-Z]{2}$'),
  logo_path text,
  primary_color text not null default '#1E6BFF' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#00D1FF' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  is_demo boolean not null default false,
  suspended_at timestamptz,
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((document_type = 'cpf' and char_length(document) = 11) or (document_type = 'cnpj' and char_length(document) = 14))
);
create index organizations_owner_idx on public.organizations (owner_id);
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  label text check (label is null or char_length(label) <= 80),
  created_by uuid not null default auth.uid() references public.profiles (id),
  expires_at timestamptz not null default now() + interval '14 days',
  max_uses int check (max_uses is null or max_uses between 1 and 500),
  use_count int not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitations_org_idx on public.invitations (organization_id);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner','renter')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','revoked')),
  invitation_id uuid references public.invitations (id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id),
  decision_notes text,
  unique (organization_id, user_id)
);
create index memberships_user_idx on public.organization_memberships (user_id);
create index memberships_org_status_idx on public.organization_memberships (organization_id, status);

-- ---------------------------------------------------------------------------
-- Frota
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  brand text not null check (char_length(brand) between 1 and 60),
  model text not null check (char_length(model) between 1 and 60),
  version text check (version is null or char_length(version) <= 80),
  year int not null check (year between 1950 and 2100),
  plate text not null check (plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  color text,
  fuel text not null default 'flex' check (fuel in ('flex','gasoline','ethanol','diesel','electric','hybrid','gnv')),
  transmission text not null default 'manual' check (transmission in ('manual','automatic','cvt')),
  mileage int not null default 0 check (mileage >= 0),
  seats int not null default 5 check (seats between 1 and 60),
  daily_price numeric(12,2) not null check (daily_price >= 0),
  weekly_price numeric(12,2) not null check (weekly_price >= 0),
  monthly_price numeric(12,2) not null check (monthly_price >= 0),
  status text not null default 'available' check (status in ('available','reserved','rented','maintenance','inactive')),
  notes text check (notes is null or char_length(notes) <= 2000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, plate)
);
create index vehicles_org_idx on public.vehicles (organization_id) where archived_at is null;
create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();

-- Deriva organization_id a partir do veículo: nunca confia no valor enviado pelo cliente.
create or replace function public.set_org_from_vehicle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.vehicles where id = new.vehicle_id;
  if v_org is null then
    raise exception 'MOVIX_VEHICLE_NOT_FOUND' using errcode = 'P0002';
  end if;
  new.organization_id := v_org;
  return new;
end $$;

create table public.vehicle_private_data (
  vehicle_id uuid primary key references public.vehicles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  chassis text check (chassis is null or chassis ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  renavam text check (renavam is null or renavam ~ '^[0-9]{9,11}$'),
  licensing_due_at date,
  insurance_due_at date,
  ipva_due_at date,
  updated_at timestamptz not null default now()
);
create trigger vpd_org before insert or update on public.vehicle_private_data
  for each row execute function public.set_org_from_vehicle();
create trigger vpd_updated_at before update on public.vehicle_private_data
  for each row execute function public.set_updated_at();

create table public.vehicle_media (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  storage_path text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index vehicle_media_vehicle_idx on public.vehicle_media (vehicle_id, position);
create trigger vehicle_media_org before insert or update on public.vehicle_media
  for each row execute function public.set_org_from_vehicle();

-- ---------------------------------------------------------------------------
-- Locações e contratos
-- ---------------------------------------------------------------------------
create table public.rentals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('MVX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id),
  renter_id uuid not null references public.profiles (id),
  start_date date not null,
  end_date date not null,
  modality text not null check (modality in ('daily','weekly','monthly')),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  units int not null check (units >= 1),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  installments_count int not null check (installments_count between 1 and 24),
  status text not null default 'pending_acceptance'
    check (status in ('pending_acceptance','active','completed','cancelled')),
  current_version_id uuid,
  created_by uuid references public.profiles (id),
  activated_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_date - start_date <= 730)
);
create index rentals_org_idx on public.rentals (organization_id, status);
create index rentals_renter_idx on public.rentals (renter_id, status);
create index rentals_vehicle_idx on public.rentals (vehicle_id, status);
create trigger rentals_updated_at before update on public.rentals
  for each row execute function public.set_updated_at();

create table public.vehicle_availability_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  kind text not null check (kind in ('rental','maintenance','unavailable')),
  period daterange not null check (not isempty(period)),
  rental_id uuid unique references public.rentals (id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 200),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check ((kind = 'rental') = (rental_id is not null)),
  -- Proteção transacional contra reservas sobrepostas (inclui concorrência).
  constraint vehicle_blocks_no_overlap exclude using gist (vehicle_id with =, period with &&)
);
create index blocks_org_idx on public.vehicle_availability_blocks (organization_id);
create trigger blocks_org before insert or update on public.vehicle_availability_blocks
  for each row execute function public.set_org_from_vehicle();

-- Deriva organization_id e vehicle_id a partir da locação.
create or replace function public.set_scope_from_rental()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.rental_id is null then
    return new;
  end if;
  select organization_id, vehicle_id into r from public.rentals where id = new.rental_id;
  if r.organization_id is null then
    raise exception 'MOVIX_RENTAL_NOT_FOUND' using errcode = 'P0002';
  end if;
  new.organization_id := r.organization_id;
  if TG_TABLE_NAME in ('inspections','incidents','fines') then
    new.vehicle_id := r.vehicle_id;
  end if;
  return new;
end $$;

create table public.contract_versions (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version int not null check (version >= 1),
  clauses text not null check (char_length(clauses) between 20 and 20000),
  terms jsonb not null,
  content_hash text not null,
  status text not null default 'pending' check (status in ('pending','accepted','discarded')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (rental_id, version)
);
alter table public.rentals
  add constraint rentals_current_version_fk foreign key (current_version_id)
  references public.contract_versions (id) on delete set null deferrable initially deferred;
create trigger contract_versions_scope before insert on public.contract_versions
  for each row execute function public.set_scope_from_rental();

-- Versões são imutáveis: só a transição de status pending → accepted|discarded é permitida.
create or replace function public.guard_contract_version()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    if old.status = 'accepted' then
      raise exception 'MOVIX_CONTRACT_IMMUTABLE' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status <> 'pending'
     or new.clauses is distinct from old.clauses
     or new.terms is distinct from old.terms
     or new.content_hash is distinct from old.content_hash
     or new.version is distinct from old.version
     or new.rental_id is distinct from old.rental_id
     or new.status not in ('accepted','discarded') then
    raise exception 'MOVIX_CONTRACT_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger contract_versions_guard before update or delete on public.contract_versions
  for each row execute function public.guard_contract_version();

create table public.contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null unique references public.contract_versions (id),
  rental_id uuid not null references public.rentals (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  renter_id uuid not null references public.profiles (id),
  accepted_at timestamptz not null default now(),
  content_hash text not null,
  acceptance_statement text not null,
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  ip_address text check (ip_address is null or char_length(ip_address) <= 64)
);
create trigger contract_acceptances_scope before insert on public.contract_acceptances
  for each row execute function public.set_scope_from_rental();

create or replace function public.guard_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'MOVIX_IMMUTABLE_RECORD' using errcode = '42501';
end $$;
create trigger contract_acceptances_guard before update or delete on public.contract_acceptances
  for each row execute function public.guard_immutable();

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  number int not null check (number >= 1),
  due_date date not null,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  paid_at timestamptz,
  payment_method text check (payment_method is null or payment_method in ('pix','card')),
  unique (rental_id, number)
);
create index installments_org_status_idx on public.installments (organization_id, status, due_date);
create trigger installments_scope before insert on public.installments
  for each row execute function public.set_scope_from_rental();

create table public.simulated_payments (
  id uuid primary key default gen_random_uuid(),
  installment_id uuid not null references public.installments (id) on delete cascade,
  rental_id uuid not null references public.rentals (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  method text not null check (method in ('pix','card')),
  amount numeric(12,2) not null,
  reference text not null,
  -- Nenhum dado de cartão é armazenado: apenas método, valor e referência fictícia.
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index simulated_payments_org_idx on public.simulated_payments (organization_id, created_at);
create trigger simulated_payments_scope before insert on public.simulated_payments
  for each row execute function public.set_scope_from_rental();

-- ---------------------------------------------------------------------------
-- Operação
-- ---------------------------------------------------------------------------
create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rental_id uuid not null references public.rentals (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id),
  kind text not null check (kind in ('pickup','return')),
  status text not null default 'submitted' check (status in ('submitted','approved','correction_requested')),
  fuel_level int not null check (fuel_level between 0 and 100),
  mileage int not null check (mileage >= 0),
  checklist jsonb not null default '{}'::jsonb,
  damages text check (damages is null or char_length(damages) <= 2000),
  notes text check (notes is null or char_length(notes) <= 2000),
  supersedes_id uuid references public.inspections (id),
  submitted_by uuid not null default auth.uid() references public.profiles (id),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_notes text check (review_notes is null or char_length(review_notes) <= 2000)
);
create index inspections_rental_idx on public.inspections (rental_id, kind, submitted_at);
create index inspections_org_status_idx on public.inspections (organization_id, status);
create trigger inspections_scope before insert on public.inspections
  for each row execute function public.set_scope_from_rental();

create table public.inspection_media (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  angle text not null check (angle in ('front','back','left','right','interior','extra')),
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index inspection_media_idx on public.inspection_media (inspection_id);
create or replace function public.set_org_from_inspection()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select organization_id into new.organization_id from public.inspections where id = new.inspection_id;
  if new.organization_id is null then
    raise exception 'MOVIX_INSPECTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  return new;
end $$;
create trigger inspection_media_org before insert on public.inspection_media
  for each row execute function public.set_org_from_inspection();

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  kind text not null check (kind in ('preventive','corrective','revision','oil','tires','brakes','other')),
  description text not null check (char_length(description) between 2 and 1000),
  status text not null default 'scheduled' check (status in ('scheduled','completed')),
  scheduled_for date,
  scheduled_km int check (scheduled_km is null or scheduled_km >= 0),
  performed_at date,
  mileage int check (mileage is null or mileage >= 0),
  cost numeric(12,2) check (cost is null or cost >= 0),
  provider text check (provider is null or char_length(provider) <= 120),
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'scheduled' or scheduled_for is not null or scheduled_km is not null),
  check (status <> 'completed' or performed_at is not null)
);
create index maintenance_vehicle_idx on public.maintenance_records (vehicle_id, status);
create trigger maintenance_org before insert or update on public.maintenance_records
  for each row execute function public.set_org_from_vehicle();
create trigger maintenance_updated_at before update on public.maintenance_records
  for each row execute function public.set_updated_at();

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id),
  rental_id uuid references public.rentals (id) on delete set null,
  reported_by uuid not null default auth.uid() references public.profiles (id),
  kind text not null check (kind in ('accident','breakdown','damage','theft','other')),
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 5 and 4000),
  occurred_at timestamptz not null default now(),
  location text check (location is null or char_length(location) <= 200),
  status text not null default 'open' check (status in ('open','in_review','resolved','cancelled')),
  resolution_notes text check (resolution_notes is null or char_length(resolution_notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index incidents_org_status_idx on public.incidents (organization_id, status);
create trigger incidents_vehicle_org before insert on public.incidents
  for each row execute function public.set_org_from_vehicle();
create trigger incidents_scope before insert on public.incidents
  for each row execute function public.set_scope_from_rental();
create trigger incidents_updated_at before update on public.incidents
  for each row execute function public.set_updated_at();

create table public.incident_media (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create or replace function public.set_org_from_incident()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select organization_id into new.organization_id from public.incidents where id = new.incident_id;
  if new.organization_id is null then
    raise exception 'MOVIX_INCIDENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  return new;
end $$;
create trigger incident_media_org before insert on public.incident_media
  for each row execute function public.set_org_from_incident();

create table public.fines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id),
  rental_id uuid references public.rentals (id) on delete set null,
  description text not null check (char_length(description) between 3 and 500),
  infraction_at date not null,
  amount numeric(12,2) not null check (amount >= 0),
  due_date date,
  status text not null default 'pending' check (status in ('pending','paid','contested','transferred')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fines_org_idx on public.fines (organization_id, status);
create trigger fines_vehicle_org before insert or update on public.fines
  for each row execute function public.set_org_from_vehicle();
create trigger fines_scope before insert or update on public.fines
  for each row execute function public.set_scope_from_rental();
create trigger fines_updated_at before update on public.fines
  for each row execute function public.set_updated_at();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  category text not null
    check (category in ('maintenance','insurance','ipva','licensing','fuel','cleaning','fines','other')),
  amount numeric(12,2) not null check (amount > 0),
  spent_at date not null,
  description text check (description is null or char_length(description) <= 500),
  maintenance_id uuid unique references public.maintenance_records (id) on delete cascade,
  fine_id uuid unique references public.fines (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index expenses_org_date_idx on public.expenses (organization_id, spent_at);
-- Quando há veículo, a locadora é derivada dele; caso contrário vem do contexto validado no servidor + RLS.
create or replace function public.expenses_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  if new.vehicle_id is not null then
    select organization_id into v_org from public.vehicles where id = new.vehicle_id;
    if v_org is null or v_org <> new.organization_id then
      raise exception 'MOVIX_SCOPE_MISMATCH' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger expenses_scope before insert or update on public.expenses
  for each row execute function public.expenses_scope();

-- ---------------------------------------------------------------------------
-- Comunicação, simulações e auditoria
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('membership','contract','payment','inspection','maintenance','incident','fine','system')),
  title text not null,
  body text,
  link text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);
create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

create table public.tracking_simulations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null unique references public.vehicles (id) on delete cascade,
  route_key text not null check (route_key ~ '^[a-z0-9-]{2,40}$'),
  status text not null default 'stopped' check (status in ('running','paused','stopped')),
  accumulated_seconds int not null default 0 check (accumulated_seconds >= 0),
  resumed_at timestamptz,
  geofence_radius_m int not null default 3000 check (geofence_radius_m between 200 and 50000),
  updated_at timestamptz not null default now()
);
create trigger tracking_org before insert or update on public.tracking_simulations
  for each row execute function public.set_org_from_vehicle();
create trigger tracking_updated_at before update on public.tracking_simulations
  for each row execute function public.set_updated_at();

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_org_idx on public.audit_events (organization_id, created_at desc);
create index audit_entity_idx on public.audit_events (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Novo usuário → perfil
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, intended_role)
  values (
    new.id,
    new.email,
    coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''),
    case when new.raw_user_meta_data ->> 'intended_role' = 'renter' then 'renter' else 'owner' end
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== supabase/migrations/20261113000002_security.sql
-- MOVIX · 0002 · Segurança: funções auxiliares, grants e políticas RLS
-- Princípios: RLS em todas as tabelas; políticas separadas por comando; isolamento por organization_id;
-- usuário/locadora suspensos perdem acesso; sem confiança em metadados editáveis.

-- ---------------------------------------------------------------------------
-- Funções auxiliares (security definer para evitar recursão de RLS; search_path vazio)
-- ---------------------------------------------------------------------------
create or replace function public.try_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

create or replace function public.current_user_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.suspended_at is null);
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.platform_admins a join public.profiles p on p.id = a.user_id
    where a.user_id = auth.uid() and p.suspended_at is null
  );
$$;

-- Vínculo aprovado e ativo (usuário e locadora não suspensos), opcionalmente filtrando papel.
create or replace function public.has_org_role(p_org uuid, p_role text default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    join public.profiles p on p.id = m.user_id
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'approved'
      and (p_role is null or m.role = p_role)
      and o.suspended_at is null
      and p.suspended_at is null
  );
$$;

create or replace function public.is_org_owner(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_org_role(p_org, 'owner');
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_org_role(p_org, null);
$$;

-- Locatário da locação (vínculo aprovado na locadora da locação).
create or replace function public.is_rental_renter(p_rental uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.rentals r
    where r.id = p_rental and r.renter_id = auth.uid() and public.has_org_role(r.organization_id, 'renter')
  );
$$;

-- Locação ativa e vigente (acesso a dados restritos do veículo). Revogado ao término/cancelamento/expiração.
create or replace function public.has_active_rental(p_vehicle uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.rentals r
    where r.vehicle_id = p_vehicle
      and r.renter_id = auth.uid()
      and r.status = 'active'
      and current_date <= r.end_date
      and public.has_org_role(r.organization_id, 'renter')
  );
$$;

-- Proprietário pode ver o perfil de quem tem (ou pediu) vínculo com sua locadora.
create or replace function public.can_view_profile(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  -- Minimização (LGPD): vínculo pendente/aprovado, ou histórico de locação na locadora do proprietário.
  select p_user = auth.uid() or exists (
    select 1 from public.organization_memberships m
    where m.user_id = p_user and m.role = 'renter' and public.is_org_owner(m.organization_id)
      and (m.status in ('pending','approved')
           or exists (select 1 from public.rentals r where r.organization_id = m.organization_id and r.renter_id = p_user))
  );
$$;

create or replace function public.can_access_incident(p_incident uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.incidents i
    where i.id = p_incident and (
      public.is_org_owner(i.organization_id)
      or (i.reported_by = auth.uid() and public.is_org_member(i.organization_id))
      or (i.rental_id is not null and public.is_rental_renter(i.rental_id))
    )
  );
$$;

create or replace function public.can_access_inspection(p_inspection uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.inspections i
    where i.id = p_inspection and (public.is_org_owner(i.organization_id) or public.is_rental_renter(i.rental_id))
  );
$$;

revoke all on function public.try_uuid(text) from public;
grant execute on function public.try_uuid(text) to authenticated, anon;
do $$
declare f text;
begin
  foreach f in array array[
    'current_user_active()', 'is_platform_admin()', 'has_org_role(uuid, text)', 'is_org_owner(uuid)',
    'is_org_member(uuid)', 'is_rental_renter(uuid)', 'has_active_rental(uuid)', 'can_view_profile(uuid)',
    'can_access_incident(uuid)', 'can_access_inspection(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Funções de trigger não devem ser chamáveis diretamente.
revoke all on function public.set_org_from_vehicle() from public, anon, authenticated;
revoke all on function public.set_scope_from_rental() from public, anon, authenticated;
revoke all on function public.set_org_from_inspection() from public, anon, authenticated;
revoke all on function public.set_org_from_incident() from public, anon, authenticated;
revoke all on function public.expenses_scope() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Grants: anon não acessa tabelas; authenticated recebe apenas o necessário.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Leitura (filtrada por RLS)
grant select on
  public.profiles, public.platform_admins, public.organizations, public.invitations, public.organization_memberships,
  public.vehicles, public.vehicle_private_data, public.vehicle_media, public.vehicle_availability_blocks,
  public.rentals, public.contract_versions, public.contract_acceptances, public.installments, public.simulated_payments,
  public.inspections, public.inspection_media, public.maintenance_records, public.incidents, public.incident_media,
  public.fines, public.expenses, public.notifications, public.tracking_simulations, public.audit_events
to authenticated;

-- Perfil: somente colunas não privilegiadas são graváveis pelo próprio usuário.
grant update (
  full_name, phone, cpf, birth_date, address_zip, address_street, address_number, address_complement,
  address_district, address_city, address_state, cnh_number, cnh_category, cnh_expires_at,
  emergency_contact_name, emergency_contact_phone, cnh_document_path, address_proof_path, lgpd_consent_at
) on public.profiles to authenticated;

-- Locadora: proprietário edita dados cadastrais e marca (nunca owner_id, is_demo, suspensão).
grant update (
  name, document, document_type, phone, email, address_zip, address_street, address_number, address_complement,
  address_district, address_city, address_state, logo_path, primary_color, secondary_color
) on public.organizations to authenticated;

grant insert (organization_id, label, expires_at, max_uses) on public.invitations to authenticated;
grant update (revoked_at) on public.invitations to authenticated;

-- CRUD direto do proprietário (RLS restringe)
grant insert, delete on public.vehicles to authenticated;
grant update (
  brand, model, version, year, plate, color, fuel, transmission, mileage, seats, daily_price, weekly_price,
  monthly_price, status, notes, archived_at
) on public.vehicles to authenticated;
grant insert, update, delete on public.vehicle_private_data, public.vehicle_media,
  public.maintenance_records, public.fines, public.expenses, public.tracking_simulations to authenticated;
grant insert, delete on public.vehicle_availability_blocks to authenticated;
grant insert on public.inspections, public.inspection_media, public.incidents, public.incident_media to authenticated;
grant update (status, resolution_notes) on public.incidents to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.organizations enable row level security;
alter table public.invitations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_private_data enable row level security;
alter table public.vehicle_media enable row level security;
alter table public.vehicle_availability_blocks enable row level security;
alter table public.rentals enable row level security;
alter table public.contract_versions enable row level security;
alter table public.contract_acceptances enable row level security;
alter table public.installments enable row level security;
alter table public.simulated_payments enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_media enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_media enable row level security;
alter table public.fines enable row level security;
alter table public.expenses enable row level security;
alter table public.notifications enable row level security;
alter table public.tracking_simulations enable row level security;
alter table public.audit_events enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (public.can_view_profile(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() and suspended_at is null)
  with check (id = auth.uid());

-- platform_admins: cada um só enxerga a própria linha (para a UI saber se é admin).
create policy platform_admins_select on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

-- organizations: membros (inclusive pendentes) enxergam dados básicos da locadora.
create policy organizations_select on public.organizations for select to authenticated
  using (
    public.is_org_member(id)
    or exists (select 1 from public.organization_memberships m where m.organization_id = id and m.user_id = auth.uid())
  );
create policy organizations_update on public.organizations for update to authenticated
  using (public.is_org_owner(id)) with check (public.is_org_owner(id));

-- invitations
create policy invitations_select on public.invitations for select to authenticated
  using (public.is_org_owner(organization_id));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (public.is_org_owner(organization_id) and created_by = auth.uid());
create policy invitations_update on public.invitations for update to authenticated
  using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));

-- memberships: o próprio usuário e o proprietário da locadora. Mudanças apenas via RPC.
create policy memberships_select on public.organization_memberships for select to authenticated
  using (user_id = auth.uid() or public.is_org_owner(organization_id));

-- vehicles: membros aprovados leem; proprietário escreve.
create policy vehicles_select on public.vehicles for select to authenticated
  using (public.is_org_member(organization_id));
create policy vehicles_insert on public.vehicles for insert to authenticated
  with check (public.is_org_owner(organization_id));
create policy vehicles_update on public.vehicles for update to authenticated
  using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));
create policy vehicles_delete on public.vehicles for delete to authenticated
  using (public.is_org_owner(organization_id));

-- vehicle_private_data: proprietário ou locatário com locação ativa e vigente daquele veículo.
create policy vpd_select on public.vehicle_private_data for select to authenticated
  using (public.is_org_owner(organization_id) or public.has_active_rental(vehicle_id));
create policy vpd_insert on public.vehicle_private_data for insert to authenticated
  with check (public.is_org_owner(organization_id));
create policy vpd_update on public.vehicle_private_data for update to authenticated
  using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));
create policy vpd_delete on public.vehicle_private_data for delete to authenticated
  using (public.is_org_owner(organization_id));

-- vehicle_media
create policy vehicle_media_select on public.vehicle_media for select to authenticated
  using (public.is_org_member(organization_id));
create policy vehicle_media_insert on public.vehicle_media for insert to authenticated
  with check (public.is_org_owner(organization_id));
create policy vehicle_media_update on public.vehicle_media for update to authenticated
  using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));
create policy vehicle_media_delete on public.vehicle_media for delete to authenticated
  using (public.is_org_owner(organization_id));

-- availability blocks: proprietário; bloqueios de locação só via RPC.
create policy blocks_select on public.vehicle_availability_blocks for select to authenticated
  using (public.is_org_owner(organization_id));
create policy blocks_insert on public.vehicle_availability_blocks for insert to authenticated
  with check (public.is_org_owner(organization_id) and kind <> 'rental' and rental_id is null);
create policy blocks_delete on public.vehicle_availability_blocks for delete to authenticated
  using (public.is_org_owner(organization_id) and kind <> 'rental');

-- rentals e derivados: proprietário da locadora ou o locatário da locação.
create policy rentals_select on public.rentals for select to authenticated
  using (public.is_org_owner(organization_id) or (renter_id = auth.uid() and public.has_org_role(organization_id, 'renter')));
create policy contract_versions_select on public.contract_versions for select to authenticated
  using (public.is_org_owner(organization_id) or public.is_rental_renter(rental_id));
create policy contract_acceptances_select on public.contract_acceptances for select to authenticated
  using (public.is_org_owner(organization_id) or public.is_rental_renter(rental_id));
create policy installments_select on public.installments for select to authenticated
  using (public.is_org_owner(organization_id) or public.is_rental_renter(rental_id));
create policy simulated_payments_select on public.simulated_payments for select to authenticated
  using (public.is_org_owner(organization_id) or public.is_rental_renter(rental_id));

-- inspections: locatário da locação ativa envia; revisão só via RPC.
create policy inspections_select on public.inspections for select to authenticated
  using (public.is_org_owner(organization_id) or public.is_rental_renter(rental_id));
create policy inspections_insert on public.inspections for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and status = 'submitted' and reviewed_by is null and reviewed_at is null and review_notes is null
    and (
      public.is_org_owner(organization_id)
      or (public.is_rental_renter(rental_id)
          and exists (select 1 from public.rentals r where r.id = rental_id and r.status = 'active'))
    )
  );
create policy inspection_media_select on public.inspection_media for select to authenticated
  using (public.can_access_inspection(inspection_id));
create policy inspection_media_insert on public.inspection_media for insert to authenticated
  with check (exists (
    select 1 from public.inspections i
    where i.id = inspection_id and i.submitted_by = auth.uid() and i.status = 'submitted'
      and public.can_access_inspection(i.id)
  ));

-- maintenance: proprietário.
create policy maintenance_select on public.maintenance_records for select to authenticated
  using (public.is_org_owner(organization_id));
create policy maintenance_insert on public.maintenance_records for insert to authenticated
  with check (public.is_org_owner(organization_id));
create policy maintenance_update on public.maintenance_records for update to authenticated
  using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));
create policy maintenance_delete on public.maintenance_records for delete to authenticated
  using (public.is_org_owner(organization_id));

-- incidents
create policy incidents_select on public.incidents for select to authenticated
  using (public.can_access_incident(id));
create policy incidents_insert on public.incidents for insert to authenticated
  with check (
    reported_by = auth.uid() and status = 'open' and resolution_notes is null
    and (
      public.is_org_owner(organization_id)
      or (rental_id is not null and public.is_rental_renter(rental_id)
          and exists (select 1 from public.rentals r where r.id = rental_id and r.status = 'active'))
    )
  );
create policy incidents_update on public.incidents for update to authenticated
  using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));
create policy incident_media_select on public.incident_media for select to authenticated
  using (public.can_access_incident(incident_id));
create policy incident_media_insert on public.incident_media for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_access_incident(incident_id));

-- fines: proprietário; locatário vê as multas associadas às suas locações.
create policy fines_select on public.fines for select to authenticated
  using (public.is_org_owner(organization_id) or (rental_id is not null and public.is_rental_renter(rental_id)));
create policy fines_insert on public.fines for insert to authenticated
  with check (public.is_org_owner(organization_id));
create policy fines_update on public.fines for update to authenticated
  using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));
create policy fines_delete on public.fines for delete to authenticated
  using (public.is_org_owner(organization_id));

-- expenses: proprietário.
create policy expenses_select on public.expenses for select to authenticated
  using (public.is_org_owner(organization_id));
create policy expenses_insert on public.expenses for insert to authenticated
  with check (public.is_org_owner(organization_id));
create policy expenses_update on public.expenses for update to authenticated
  using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));
create policy expenses_delete on public.expenses for delete to authenticated
  using (public.is_org_owner(organization_id));

-- notifications: somente o destinatário.
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- tracking: proprietário.
create policy tracking_select on public.tracking_simulations for select to authenticated
  using (public.is_org_owner(organization_id));
create policy tracking_insert on public.tracking_simulations for insert to authenticated
  with check (public.is_org_owner(organization_id));
create policy tracking_update on public.tracking_simulations for update to authenticated
  using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));
create policy tracking_delete on public.tracking_simulations for delete to authenticated
  using (public.is_org_owner(organization_id));

-- audit: proprietário lê a trilha da própria locadora.
create policy audit_select on public.audit_events for select to authenticated
  using (organization_id is not null and public.is_org_owner(organization_id));

-- ===== supabase/migrations/20261113000003_functions.sql
-- MOVIX · 0003 · Regras de negócio no banco: RPCs, notificações e auditoria
-- Todas as RPCs são SECURITY DEFINER com search_path vazio e checagens explícitas de autorização.
-- Erros de negócio usam mensagens 'MOVIX_*' traduzidas na aplicação (src/lib/errors.ts).

-- ---------------------------------------------------------------------------
-- Notificação e auditoria (internas)
-- ---------------------------------------------------------------------------
create or replace function public.notify_user(
  p_user uuid, p_org uuid, p_kind text, p_title text, p_body text, p_link text, p_dedupe text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, organization_id, kind, title, body, link, dedupe_key)
  values (p_user, p_org, p_kind, p_title, p_body, p_link, p_dedupe)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
end $$;

create or replace function public.notify_org_owners(
  p_org uuid, p_kind text, p_title text, p_body text, p_link text, p_dedupe text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  for v_user in
    select user_id from public.organization_memberships
    where organization_id = p_org and role = 'owner' and status = 'approved'
  loop
    perform public.notify_user(v_user, p_org, p_kind, p_title, p_body, p_link, p_dedupe);
  end loop;
end $$;

create or replace function public.log_audit(p_org uuid, p_action text, p_entity text, p_id uuid, p_details jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events (organization_id, actor_id, action, entity_type, entity_id, details)
  values (p_org, auth.uid(), p_action, p_entity, p_id, coalesce(p_details, '{}'::jsonb));
end $$;

-- Auditoria genérica de transições (somente identificadores e status — sem dados pessoais).
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_new jsonb := case when TG_OP <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when TG_OP <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_org uuid;
begin
  v_org := case when TG_TABLE_NAME = 'organizations' then (v_row ->> 'id')::uuid
                else public.try_uuid(v_row ->> 'organization_id') end;
  if TG_OP = 'UPDATE' and (v_new -> 'status') is not distinct from (v_old -> 'status')
     and (v_new -> 'suspended_at') is not distinct from (v_old -> 'suspended_at') then
    return new;
  end if;
  perform public.log_audit(
    v_org, lower(TG_OP), TG_TABLE_NAME, public.try_uuid(v_row ->> 'id'),
    jsonb_strip_nulls(jsonb_build_object(
      'status_from', v_old ->> 'status', 'status_to', v_new ->> 'status',
      'suspended', case when v_new ? 'suspended_at' then (v_new ->> 'suspended_at') is not null end
    ))
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['organizations','organization_memberships','vehicles','rentals','contract_versions',
    'contract_acceptances','installments','inspections','maintenance_records','incidents','fines'] loop
    execute format('create trigger %I after insert or update or delete on public.%I
      for each row execute function public.audit_row()', t || '_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Triggers de notificação
-- ---------------------------------------------------------------------------
create or replace function public.on_membership_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text; v_org_name text;
begin
  if new.role <> 'renter' then return new; end if;
  select full_name into v_name from public.profiles where id = new.user_id;
  select name into v_org_name from public.organizations where id = new.organization_id;
  if new.status = 'pending' and (TG_OP = 'INSERT' or old.status <> 'pending') then
    perform public.notify_org_owners(new.organization_id, 'membership', 'Novo locatário aguardando aprovação',
      coalesce(nullif(v_name, ''), 'Um locatário') || ' solicitou vínculo pela página de convite.', '/painel/locatarios');
  elsif TG_OP = 'UPDATE' and new.status <> old.status then
    perform public.notify_user(new.user_id, new.organization_id, 'membership',
      case new.status when 'approved' then 'Vínculo aprovado'
                      when 'rejected' then 'Vínculo recusado'
                      else 'Vínculo encerrado' end,
      case new.status when 'approved' then 'Você já pode acessar ' || v_org_name || ' no MOVIX.'
                      else 'Seu vínculo com ' || v_org_name || ' foi atualizado.' end,
      '/app');
  end if;
  return new;
end $$;
create trigger memberships_notify after insert or update on public.organization_memberships
  for each row execute function public.on_membership_change();

create or replace function public.on_inspection_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    perform public.notify_org_owners(new.organization_id, 'inspection',
      'Nova vistoria de ' || case new.kind when 'pickup' then 'retirada' else 'devolução' end,
      'Uma vistoria aguarda sua análise.', '/painel/vistorias/' || new.id);
  elsif new.status <> old.status then
    perform public.notify_user(new.submitted_by, new.organization_id, 'inspection',
      case new.status when 'approved' then 'Vistoria aprovada' else 'Correção solicitada na vistoria' end,
      coalesce(new.review_notes, 'A locadora analisou sua vistoria.'), '/app/vistorias/' || new.id);
  end if;
  return new;
end $$;
create trigger inspections_notify after insert or update on public.inspections
  for each row execute function public.on_inspection_change();

create or replace function public.on_incident_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    perform public.notify_org_owners(new.organization_id, 'incident', 'Nova ocorrência: ' || new.title,
      'Registrada em ' || to_char(new.occurred_at, 'DD/MM/YYYY'), '/painel/ocorrencias');
  elsif new.status <> old.status and new.reported_by <> auth.uid() then
    perform public.notify_user(new.reported_by, new.organization_id, 'incident', 'Ocorrência atualizada',
      new.title || ' — status: ' || case new.status when 'in_review' then 'em análise' when 'resolved' then 'resolvida'
        when 'cancelled' then 'cancelada' else 'aberta' end, '/app/ocorrencias');
  end if;
  return new;
end $$;
create trigger incidents_notify after insert or update on public.incidents
  for each row execute function public.on_incident_change();

create or replace function public.on_fine_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_renter uuid;
begin
  if new.rental_id is not null then
    select renter_id into v_renter from public.rentals where id = new.rental_id;
    perform public.notify_user(v_renter, new.organization_id, 'fine', 'Multa associada à sua locação',
      new.description, '/app/locacoes/' || new.rental_id);
  end if;
  return new;
end $$;
create trigger fines_notify after insert on public.fines
  for each row execute function public.on_fine_insert();

-- ---------------------------------------------------------------------------
-- Domínio: preço e unidades (espelhado em src/lib/domain/pricing.ts)
-- ---------------------------------------------------------------------------
create or replace function public.rental_units(p_start date, p_end date, p_modality text)
returns int language sql immutable set search_path = '' as $$
  select case p_modality
    when 'daily' then (p_end - p_start) + 1
    when 'weekly' then ceil(((p_end - p_start) + 1) / 7.0)::int
    when 'monthly' then ceil(((p_end - p_start) + 1) / 30.0)::int
  end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: locadora, convites e vínculos
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(
  p_name text, p_document text, p_document_type text, p_phone text, p_email text,
  p_address_zip text, p_address_street text, p_address_number text, p_address_complement text,
  p_address_district text, p_address_city text, p_address_state text,
  p_primary_color text default '#1E6BFF', p_secondary_color text default '#00D1FF'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_count int;
begin
  if auth.uid() is null or not public.current_user_active() then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select count(*) into v_count from public.organizations where owner_id = auth.uid();
  if v_count >= 3 then
    raise exception 'MOVIX_ORG_LIMIT' using errcode = 'P0001';
  end if;
  insert into public.organizations (owner_id, name, document, document_type, phone, email, address_zip,
    address_street, address_number, address_complement, address_district, address_city, address_state,
    primary_color, secondary_color)
  values (auth.uid(), trim(p_name), p_document, p_document_type, nullif(p_phone, ''), nullif(p_email, ''),
    nullif(p_address_zip, ''), nullif(p_address_street, ''), nullif(p_address_number, ''),
    nullif(p_address_complement, ''), nullif(p_address_district, ''), nullif(p_address_city, ''),
    nullif(p_address_state, ''), coalesce(p_primary_color, '#1E6BFF'), coalesce(p_secondary_color, '#00D1FF'))
  returning id into v_org;
  insert into public.organization_memberships (organization_id, user_id, role, status, decided_at, decided_by)
  values (v_org, auth.uid(), 'owner', 'approved', now(), auth.uid());
  return v_org;
end $$;

-- Pré-visualização pública do convite (só dados de marca da locadora).
create or replace function public.get_invitation_preview(p_code text)
returns table (organization_id uuid, organization_name text, logo_path text, primary_color text, secondary_color text, valid boolean)
language sql stable security definer set search_path = '' as $$
  select o.id, o.name, o.logo_path, o.primary_color, o.secondary_color,
    (i.revoked_at is null and i.expires_at > now() and (i.max_uses is null or i.use_count < i.max_uses)
      and o.suspended_at is null) as valid
  from public.invitations i join public.organizations o on o.id = i.organization_id
  where i.code = upper(trim(p_code));
$$;

create or replace function public.join_with_invitation(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv record; v_existing record;
begin
  if auth.uid() is null or not public.current_user_active() then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select i.*, o.suspended_at as org_suspended into v_inv
  from public.invitations i join public.organizations o on o.id = i.organization_id
  where i.code = upper(trim(p_code)) for update of i;
  if v_inv.id is null or v_inv.revoked_at is not null or v_inv.expires_at <= now()
     or (v_inv.max_uses is not null and v_inv.use_count >= v_inv.max_uses) or v_inv.org_suspended is not null then
    raise exception 'MOVIX_INVITE_INVALID' using errcode = 'P0001';
  end if;
  select * into v_existing from public.organization_memberships
  where organization_id = v_inv.organization_id and user_id = auth.uid();
  if v_existing.id is not null then
    if v_existing.role = 'owner' then
      raise exception 'MOVIX_INVITE_OWN_ORG' using errcode = 'P0001';
    end if;
    if v_existing.status in ('rejected','revoked') then
      update public.organization_memberships
      set status = 'pending', requested_at = now(), decided_at = null, decided_by = null, invitation_id = v_inv.id
      where id = v_existing.id;
      update public.invitations set use_count = use_count + 1 where id = v_inv.id;
    end if;
    return v_inv.organization_id;
  end if;
  insert into public.organization_memberships (organization_id, user_id, role, status, invitation_id)
  values (v_inv.organization_id, auth.uid(), 'renter', 'pending', v_inv.id);
  update public.invitations set use_count = use_count + 1 where id = v_inv.id;
  update public.profiles set intended_role = 'renter' where id = auth.uid() and intended_role <> 'renter'
    and not exists (select 1 from public.organizations where owner_id = auth.uid());
  return v_inv.organization_id;
end $$;

create or replace function public.review_membership(p_membership uuid, p_decision text, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_m record;
begin
  if p_decision not in ('approved','rejected','revoked') then
    raise exception 'MOVIX_INVALID_INPUT' using errcode = '22023';
  end if;
  select * into v_m from public.organization_memberships where id = p_membership for update;
  if v_m.id is null or not public.is_org_owner(v_m.organization_id) then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if v_m.role <> 'renter' then
    raise exception 'MOVIX_INVALID_INPUT' using errcode = '22023';
  end if;
  if p_decision in ('approved','rejected') and v_m.status <> 'pending' then
    raise exception 'MOVIX_INVALID_STATE' using errcode = 'P0001';
  end if;
  if p_decision = 'revoked' and v_m.status <> 'approved' then
    raise exception 'MOVIX_INVALID_STATE' using errcode = 'P0001';
  end if;
  if p_decision = 'revoked' and exists (
    select 1 from public.rentals where organization_id = v_m.organization_id and renter_id = v_m.user_id
      and status in ('pending_acceptance','active')) then
    raise exception 'MOVIX_HAS_OPEN_RENTALS' using errcode = 'P0001';
  end if;
  update public.organization_memberships
  set status = p_decision, decided_at = now(), decided_by = auth.uid(), decision_notes = left(p_notes, 500)
  where id = p_membership;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: locações e contratos
-- ---------------------------------------------------------------------------
create or replace function public.build_contract_terms(p_rental uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'organization', jsonb_build_object('name', o.name, 'document', o.document, 'document_type', o.document_type,
      'phone', o.phone, 'city', o.address_city, 'state', o.address_state),
    'renter', jsonb_build_object('name', p.full_name, 'cpf', p.cpf, 'cnh_number', p.cnh_number,
      'cnh_category', p.cnh_category),
    'vehicle', jsonb_build_object('brand', v.brand, 'model', v.model, 'version', v.version, 'year', v.year,
      'plate', v.plate, 'color', v.color),
    'rental', jsonb_build_object('code', r.code, 'start_date', r.start_date, 'end_date', r.end_date,
      'modality', r.modality, 'unit_price', r.unit_price, 'units', r.units, 'total_amount', r.total_amount,
      'installments_count', r.installments_count),
    'installments', coalesce((select jsonb_agg(jsonb_build_object('number', i.number, 'due_date', i.due_date,
      'amount', i.amount) order by i.number) from public.installments i where i.rental_id = r.id), '[]'::jsonb)
  )
  from public.rentals r
  join public.organizations o on o.id = r.organization_id
  join public.profiles p on p.id = r.renter_id
  join public.vehicles v on v.id = r.vehicle_id
  where r.id = p_rental;
$$;

create or replace function public.create_rental(
  p_vehicle uuid, p_renter uuid, p_start date, p_end date, p_modality text,
  p_unit_price numeric, p_installments int, p_clauses text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_vehicle record; v_rental uuid; v_units int; v_total numeric(12,2); v_part numeric(12,2);
  v_terms jsonb; v_version uuid; i int;
begin
  select * into v_vehicle from public.vehicles where id = p_vehicle;
  if v_vehicle.id is null or not public.is_org_owner(v_vehicle.organization_id) then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if v_vehicle.archived_at is not null or v_vehicle.status = 'inactive' then
    raise exception 'MOVIX_VEHICLE_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if p_modality not in ('daily','weekly','monthly') or p_end < p_start or p_unit_price is null or p_unit_price < 0
     or p_installments not between 1 and 24 or p_end - p_start > 730 then
    raise exception 'MOVIX_INVALID_INPUT' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.organization_memberships m join public.profiles p on p.id = m.user_id
    where m.organization_id = v_vehicle.organization_id and m.user_id = p_renter and m.role = 'renter'
      and m.status = 'approved' and p.suspended_at is null) then
    raise exception 'MOVIX_RENTER_NOT_APPROVED' using errcode = 'P0001';
  end if;

  v_units := public.rental_units(p_start, p_end, p_modality);
  v_total := round(p_unit_price * v_units, 2);

  insert into public.rentals (organization_id, vehicle_id, renter_id, start_date, end_date, modality, unit_price,
    units, total_amount, installments_count, created_by)
  values (v_vehicle.organization_id, p_vehicle, p_renter, p_start, p_end, p_modality, p_unit_price, v_units,
    v_total, p_installments, auth.uid())
  returning id into v_rental;

  begin
    insert into public.vehicle_availability_blocks (organization_id, vehicle_id, kind, period, rental_id, created_by)
    values (v_vehicle.organization_id, p_vehicle, 'rental', daterange(p_start, p_end, '[]'), v_rental, auth.uid());
  exception when exclusion_violation then
    raise exception 'MOVIX_PERIOD_OVERLAP' using errcode = '23P01';
  end;

  v_part := trunc(v_total / p_installments, 2);
  for i in 1..p_installments loop
    insert into public.installments (rental_id, organization_id, number, due_date, amount)
    values (v_rental, v_vehicle.organization_id, i, (p_start + make_interval(months => i - 1))::date,
      case when i = p_installments then v_total - v_part * (p_installments - 1) else v_part end);
  end loop;

  v_terms := public.build_contract_terms(v_rental);
  insert into public.contract_versions (rental_id, organization_id, version, clauses, terms, content_hash, created_by)
  values (v_rental, v_vehicle.organization_id, 1, p_clauses, v_terms,
    encode(sha256(convert_to(p_clauses || v_terms::text, 'UTF8')), 'hex'), auth.uid())
  returning id into v_version;
  update public.rentals set current_version_id = v_version where id = v_rental;

  if v_vehicle.status = 'available' then
    update public.vehicles set status = 'reserved' where id = p_vehicle;
  end if;

  perform public.notify_user(p_renter, v_vehicle.organization_id, 'contract', 'Novo contrato para aceite',
    v_vehicle.brand || ' ' || v_vehicle.model || ' · ' || to_char(p_start, 'DD/MM') || ' a ' || to_char(p_end, 'DD/MM/YYYY'),
    '/app/locacoes/' || v_rental);
  return v_rental;
end $$;

create or replace function public.amend_contract(p_rental uuid, p_clauses text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_r record; v_next int; v_terms jsonb; v_version uuid;
begin
  select * into v_r from public.rentals where id = p_rental for update;
  if v_r.id is null or not public.is_org_owner(v_r.organization_id) then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if v_r.status not in ('pending_acceptance','active') then
    raise exception 'MOVIX_INVALID_STATE' using errcode = 'P0001';
  end if;
  update public.contract_versions set status = 'discarded' where rental_id = p_rental and status = 'pending';
  select coalesce(max(version), 0) + 1 into v_next from public.contract_versions where rental_id = p_rental;
  v_terms := public.build_contract_terms(p_rental);
  insert into public.contract_versions (rental_id, organization_id, version, clauses, terms, content_hash, created_by)
  values (p_rental, v_r.organization_id, v_next, p_clauses, v_terms,
    encode(sha256(convert_to(p_clauses || v_terms::text, 'UTF8')), 'hex'), auth.uid())
  returning id into v_version;
  update public.rentals set current_version_id = v_version where id = p_rental;
  perform public.notify_user(v_r.renter_id, v_r.organization_id, 'contract', 'Aditivo contratual para aceite',
    'Versão ' || v_next || ' do contrato ' || v_r.code || ' aguarda seu aceite.', '/app/locacoes/' || p_rental);
  return v_version;
end $$;

create or replace function public.accept_contract(p_version uuid, p_user_agent text default null, p_ip text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_v record; v_r record; v_acc uuid; v_name text;
begin
  select * into v_v from public.contract_versions where id = p_version for update;
  if v_v.id is null then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select * into v_r from public.rentals where id = v_v.rental_id for update;
  if v_r.renter_id <> auth.uid() or not public.has_org_role(v_r.organization_id, 'renter') then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if v_v.status <> 'pending' or v_r.current_version_id <> v_v.id
     or v_r.status not in ('pending_acceptance','active') then
    raise exception 'MOVIX_INVALID_STATE' using errcode = 'P0001';
  end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.contract_acceptances (contract_version_id, rental_id, organization_id, renter_id, content_hash,
    acceptance_statement, user_agent, ip_address)
  values (v_v.id, v_r.id, v_r.organization_id, auth.uid(), v_v.content_hash,
    'Eu, ' || coalesce(nullif(v_name, ''), 'locatário') || ', li e aceito eletronicamente a versão ' || v_v.version ||
    ' do contrato ' || v_r.code || '.', left(p_user_agent, 400), left(p_ip, 64))
  returning id into v_acc;
  update public.contract_versions set status = 'accepted' where id = v_v.id;
  if v_r.status = 'pending_acceptance' then
    update public.rentals set status = 'active', activated_at = now() where id = v_r.id;
    update public.vehicles set status = case when v_r.start_date <= current_date then 'rented' else 'reserved' end
    where id = v_r.vehicle_id and status in ('available','reserved');
  end if;
  perform public.notify_org_owners(v_r.organization_id, 'contract', 'Contrato aceito',
    'Versão ' || v_v.version || ' do contrato ' || v_r.code || ' foi aceita pelo locatário.', '/painel/contratos/' || v_r.id);
  return v_acc;
end $$;

create or replace function public.cancel_rental(p_rental uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_r record;
begin
  select * into v_r from public.rentals where id = p_rental for update;
  if v_r.id is null or not public.is_org_owner(v_r.organization_id) then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if v_r.status not in ('pending_acceptance','active') then
    raise exception 'MOVIX_INVALID_STATE' using errcode = 'P0001';
  end if;
  update public.rentals set status = 'cancelled', cancelled_at = now(), cancel_reason = left(p_reason, 500)
  where id = p_rental;
  update public.contract_versions set status = 'discarded' where rental_id = p_rental and status = 'pending';
  update public.installments set status = 'cancelled' where rental_id = p_rental and status = 'pending';
  delete from public.vehicle_availability_blocks where rental_id = p_rental;
  update public.vehicles set status = 'available' where id = v_r.vehicle_id and status in ('reserved','rented')
    and not exists (select 1 from public.rentals where vehicle_id = v_r.vehicle_id and status = 'active');
  perform public.notify_user(v_r.renter_id, v_r.organization_id, 'contract', 'Locação cancelada',
    'A locação ' || v_r.code || ' foi cancelada pela locadora.', '/app/locacoes/' || p_rental);
end $$;

create or replace function public.complete_rental(p_rental uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_r record;
begin
  select * into v_r from public.rentals where id = p_rental for update;
  if v_r.id is null or not public.is_org_owner(v_r.organization_id) then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if v_r.status <> 'active' then
    raise exception 'MOVIX_INVALID_STATE' using errcode = 'P0001';
  end if;
  update public.rentals set status = 'completed', completed_at = now(),
    end_date = least(end_date, greatest(start_date, current_date))
  where id = p_rental;
  update public.vehicle_availability_blocks
    set period = daterange(v_r.start_date, least(v_r.end_date, greatest(v_r.start_date, current_date)), '[]')
  where rental_id = p_rental;
  update public.contract_versions set status = 'discarded' where rental_id = p_rental and status = 'pending';
  update public.vehicles set status = 'available' where id = v_r.vehicle_id and status in ('reserved','rented');
  perform public.notify_user(v_r.renter_id, v_r.organization_id, 'contract', 'Locação encerrada',
    'A locação ' || v_r.code || ' foi encerrada. O acesso aos dados restritos do veículo foi revogado.',
    '/app/locacoes/' || p_rental);
end $$;

-- ---------------------------------------------------------------------------
-- RPC: pagamentos SIMULADOS (sem transação bancária, sem dados de cartão)
-- ---------------------------------------------------------------------------
create or replace function public.simulate_payment(p_installment uuid, p_method text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_i record; v_r record; v_ref text;
begin
  if p_method not in ('pix','card') then
    raise exception 'MOVIX_INVALID_INPUT' using errcode = '22023';
  end if;
  select * into v_i from public.installments where id = p_installment for update;
  if v_i.id is null then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select * into v_r from public.rentals where id = v_i.rental_id;
  if not (public.is_org_owner(v_r.organization_id) or public.is_rental_renter(v_r.id)) then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if v_i.status <> 'pending' or v_r.status not in ('active','completed') then
    raise exception 'MOVIX_INVALID_STATE' using errcode = 'P0001';
  end if;
  v_ref := 'SIMULADO-' || upper(p_method) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  update public.installments set status = 'paid', paid_at = now(), payment_method = p_method where id = v_i.id;
  insert into public.simulated_payments (installment_id, rental_id, organization_id, method, amount, reference, created_by)
  values (v_i.id, v_r.id, v_r.organization_id, p_method, v_i.amount, v_ref, auth.uid());
  perform public.notify_org_owners(v_r.organization_id, 'payment', 'Pagamento simulado confirmado',
    'Parcela ' || v_i.number || ' do contrato ' || v_r.code || ' · R$ ' || replace(to_char(v_i.amount, 'FM999999990.00'), '.', ','),
    '/painel/financeiro');
  perform public.notify_user(v_r.renter_id, v_r.organization_id, 'payment', 'Pagamento simulado registrado',
    'Parcela ' || v_i.number || ' marcada como paga (ambiente de demonstração).', '/app/parcelas');
  return v_ref;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: vistorias
-- ---------------------------------------------------------------------------
create or replace function public.review_inspection(p_inspection uuid, p_decision text, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_i record;
begin
  if p_decision not in ('approved','correction_requested') then
    raise exception 'MOVIX_INVALID_INPUT' using errcode = '22023';
  end if;
  if p_decision = 'correction_requested' and coalesce(trim(p_notes), '') = '' then
    raise exception 'MOVIX_NOTES_REQUIRED' using errcode = '22023';
  end if;
  select * into v_i from public.inspections where id = p_inspection for update;
  if v_i.id is null or not public.is_org_owner(v_i.organization_id) then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if v_i.status <> 'submitted' then
    raise exception 'MOVIX_INVALID_STATE' using errcode = 'P0001';
  end if;
  update public.inspections set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(),
    review_notes = left(nullif(trim(p_notes), ''), 2000)
  where id = p_inspection;
  if p_decision = 'approved' then
    update public.vehicles set mileage = greatest(mileage, v_i.mileage) where id = v_i.vehicle_id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: alertas (manutenção, contratos a vencer, parcelas vencidas, documentos)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_alerts(p_org uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare v_count int := 0; r record;
begin
  if not public.is_org_owner(p_org) then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  for r in
    select m.id, m.description, m.scheduled_for, v.brand, v.model, v.plate
    from public.maintenance_records m join public.vehicles v on v.id = m.vehicle_id
    where m.organization_id = p_org and m.status = 'scheduled'
      and ((m.scheduled_for is not null and m.scheduled_for <= current_date + 7)
        or (m.scheduled_km is not null and m.scheduled_km <= v.mileage + 500))
  loop
    perform public.notify_org_owners(p_org, 'maintenance', 'Manutenção próxima: ' || r.brand || ' ' || r.model,
      r.description || ' · ' || r.plate, '/painel/manutencao', 'maint-' || r.id);
    v_count := v_count + 1;
  end loop;
  for r in
    select x.id, x.code, x.end_date from public.rentals x
    where x.organization_id = p_org and x.status = 'active' and x.end_date between current_date and current_date + 3
  loop
    perform public.notify_org_owners(p_org, 'contract', 'Contrato a vencer: ' || r.code,
      'Término em ' || to_char(r.end_date, 'DD/MM/YYYY'), '/painel/contratos/' || r.id, 'ending-' || r.id || '-' || r.end_date);
    v_count := v_count + 1;
  end loop;
  for r in
    select i.id, i.number, i.due_date, x.code, x.renter_id, x.id as rental_id from public.installments i
    join public.rentals x on x.id = i.rental_id
    where i.organization_id = p_org and i.status = 'pending' and i.due_date < current_date
      and x.status in ('active','completed')
  loop
    perform public.notify_org_owners(p_org, 'payment', 'Parcela em atraso (simulado): ' || r.code,
      'Parcela ' || r.number || ' venceu em ' || to_char(r.due_date, 'DD/MM/YYYY'), '/painel/financeiro', 'overdue-' || r.id);
    perform public.notify_user(r.renter_id, p_org, 'payment', 'Parcela em atraso',
      'Parcela ' || r.number || ' do contrato ' || r.code || ' venceu em ' || to_char(r.due_date, 'DD/MM/YYYY'),
      '/app/parcelas', 'overdue-' || r.id);
    v_count := v_count + 1;
  end loop;
  for r in
    select d.vehicle_id, v.plate, d.licensing_due_at, d.insurance_due_at, d.ipva_due_at
    from public.vehicle_private_data d join public.vehicles v on v.id = d.vehicle_id
    where d.organization_id = p_org and v.archived_at is null and (
      d.licensing_due_at <= current_date + 15 or d.insurance_due_at <= current_date + 15 or d.ipva_due_at <= current_date + 15)
  loop
    perform public.notify_org_owners(p_org, 'maintenance', 'Documento do veículo a vencer: ' || r.plate,
      'Verifique licenciamento, seguro e IPVA.', '/painel/frota/' || r.vehicle_id,
      'docs-' || r.vehicle_id || '-' || coalesce(least(r.licensing_due_at, r.insurance_due_at, r.ipva_due_at)::text, ''));
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: administração da plataforma (apenas agregados)
-- ---------------------------------------------------------------------------
create or replace function public.admin_metrics()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'accounts', (select count(*) from public.profiles),
    'suspended_accounts', (select count(*) from public.profiles where suspended_at is not null),
    'organizations', (select count(*) from public.organizations),
    'suspended_organizations', (select count(*) from public.organizations where suspended_at is not null),
    'vehicles', (select count(*) from public.vehicles where archived_at is null),
    'active_rentals', (select count(*) from public.rentals where status = 'active'),
    'total_rentals', (select count(*) from public.rentals),
    'growth', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
        'accounts', (select count(*) from public.profiles p where date_trunc('month', p.created_at) = m),
        'organizations', (select count(*) from public.organizations o where date_trunc('month', o.created_at) = m))
        order by m), '[]'::jsonb)
      from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m
    )
  );
end $$;

create or replace function public.admin_list_organizations()
returns table (id uuid, name text, created_at timestamptz, suspended_at timestamptz, is_demo boolean,
  vehicles bigint, renters bigint, active_rentals bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  return query
    select o.id, o.name, o.created_at, o.suspended_at, o.is_demo,
      (select count(*) from public.vehicles v where v.organization_id = o.id and v.archived_at is null),
      (select count(*) from public.organization_memberships m where m.organization_id = o.id and m.role = 'renter' and m.status = 'approved'),
      (select count(*) from public.rentals r where r.organization_id = o.id and r.status = 'active')
    from public.organizations o order by o.created_at desc;
end $$;

create or replace function public.admin_list_accounts()
returns table (id uuid, display_name text, masked_email text, created_at timestamptz, suspended_at timestamptz,
  organizations_owned bigint, memberships bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  return query
    select p.id,
      split_part(coalesce(nullif(p.full_name, ''), 'Sem nome'), ' ', 1),
      case when p.email is null then null
           else left(split_part(p.email, '@', 1), 2) || '***@' || split_part(p.email, '@', 2) end,
      p.created_at, p.suspended_at,
      (select count(*) from public.organizations o where o.owner_id = p.id),
      (select count(*) from public.organization_memberships m where m.user_id = p.id and m.role = 'renter')
    from public.profiles p order by p.created_at desc;
end $$;

create or replace function public.admin_set_account_suspension(p_user uuid, p_suspend boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'MOVIX_CANNOT_SUSPEND_SELF' using errcode = 'P0001';
  end if;
  update public.profiles
  set suspended_at = case when p_suspend then coalesce(suspended_at, now()) end,
      suspension_reason = case when p_suspend then left(p_reason, 300) end
  where id = p_user;
  perform public.log_audit(null, case when p_suspend then 'suspend' else 'reactivate' end, 'profiles', p_user, '{}'::jsonb);
end $$;

create or replace function public.admin_set_organization_suspension(p_org uuid, p_suspend boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  update public.organizations
  set suspended_at = case when p_suspend then coalesce(suspended_at, now()) end,
      suspension_reason = case when p_suspend then left(p_reason, 300) end
  where id = p_org;
end $$;

-- ---------------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------------
revoke all on function public.notify_user(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.notify_org_owners(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.log_audit(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.audit_row() from public, anon, authenticated;
revoke all on function public.on_membership_change() from public, anon, authenticated;
revoke all on function public.on_inspection_change() from public, anon, authenticated;
revoke all on function public.on_incident_change() from public, anon, authenticated;
revoke all on function public.on_fine_insert() from public, anon, authenticated;
revoke all on function public.build_contract_terms(uuid) from public, anon, authenticated;

revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;
grant execute on function public.rental_units(date, date, text) to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'create_organization(text, text, text, text, text, text, text, text, text, text, text, text, text, text)',
    'join_with_invitation(text)', 'review_membership(uuid, text, text)',
    'create_rental(uuid, uuid, date, date, text, numeric, int, text)', 'amend_contract(uuid, text)',
    'accept_contract(uuid, text, text)', 'cancel_rental(uuid, text)', 'complete_rental(uuid)',
    'simulate_payment(uuid, text)', 'review_inspection(uuid, text, text)', 'refresh_alerts(uuid)',
    'admin_metrics()', 'admin_list_organizations()', 'admin_list_accounts()',
    'admin_set_account_suspension(uuid, boolean, text)', 'admin_set_organization_suspension(uuid, boolean, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ===== supabase/migrations/20261113000004_storage.sql
-- MOVIX · 0004 · Storage: buckets e políticas
-- Convenções de caminho (primeiro segmento sempre identifica o escopo):
--   documents/{user_id}/{arquivo}                        CNH e comprovante (privado)
--   vehicle-media/{org_id}/{vehicle_id}/{arquivo}        fotos de veículos (privado, membros aprovados)
--   inspection-media/{org_id}/{inspection_id}/{arquivo}  fotos de vistoria (privado)
--   incident-media/{org_id}/{incident_id}/{arquivo}      anexos de ocorrências (privado)
--   branding/{org_id}/{arquivo}                          logo da locadora (leitura pública)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('documents', 'documents', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('vehicle-media', 'vehicle-media', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('inspection-media', 'inspection-media', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('incident-media', 'incident-media', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('branding', 'branding', true, 1048576, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- documents
create policy "documents: dono lê" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.can_view_profile(public.try_uuid((storage.foldername(name))[1])));
create policy "documents: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_active());
create policy "documents: dono substitui" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents: dono remove" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- vehicle-media
create policy "vehicle-media: membros leem" on storage.objects for select to authenticated
  using (bucket_id = 'vehicle-media' and public.is_org_member(public.try_uuid((storage.foldername(name))[1])));
create policy "vehicle-media: proprietário envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'vehicle-media' and public.is_org_owner(public.try_uuid((storage.foldername(name))[1])));
create policy "vehicle-media: proprietário remove" on storage.objects for delete to authenticated
  using (bucket_id = 'vehicle-media' and public.is_org_owner(public.try_uuid((storage.foldername(name))[1])));

-- inspection-media (segundo segmento = inspeção)
create policy "inspection-media: envolvidos leem" on storage.objects for select to authenticated
  using (bucket_id = 'inspection-media' and public.can_access_inspection(public.try_uuid((storage.foldername(name))[2])));
create policy "inspection-media: autor envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-media' and exists (
    select 1 from public.inspections i
    where i.id = public.try_uuid((storage.foldername(name))[2])
      and i.organization_id = public.try_uuid((storage.foldername(name))[1])
      and i.submitted_by = auth.uid() and i.status = 'submitted'));

-- incident-media
create policy "incident-media: envolvidos leem" on storage.objects for select to authenticated
  using (bucket_id = 'incident-media' and public.can_access_incident(public.try_uuid((storage.foldername(name))[2])));
create policy "incident-media: envolvidos enviam" on storage.objects for insert to authenticated
  with check (bucket_id = 'incident-media' and public.can_access_incident(public.try_uuid((storage.foldername(name))[2])));

-- branding (leitura pública via URL pública do bucket; escrita apenas proprietário)
create policy "branding: proprietário envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.is_org_owner(public.try_uuid((storage.foldername(name))[1])));
create policy "branding: proprietário substitui" on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.is_org_owner(public.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'branding' and public.is_org_owner(public.try_uuid((storage.foldername(name))[1])));
create policy "branding: proprietário remove" on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.is_org_owner(public.try_uuid((storage.foldername(name))[1])));
create policy "branding: leitura" on storage.objects for select to authenticated
  using (bucket_id = 'branding');

-- ===== supabase/migrations/20261113000005_demo.sql
-- MOVIX · 0005 · Dados sintéticos idempotentes para locadoras de DEMONSTRAÇÃO (is_demo = true)
-- demo_populate(org) apaga os dados operacionais da locadora demo e recria um cenário fictício coerente,
-- relativo à data atual. Nunca atua sobre locadoras reais.

-- Guardas de imutabilidade: liberam exclusão apenas durante o reset de uma locadora demo.
create or replace function public.guard_immutable()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' and current_setting('movix.demo_reset', true) = 'on'
     and exists (select 1 from public.organizations o where o.id = old.organization_id and o.is_demo) then
    return old;
  end if;
  raise exception 'MOVIX_IMMUTABLE_RECORD' using errcode = '42501';
end $$;

create or replace function public.guard_contract_version()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    if old.status = 'accepted' and not (current_setting('movix.demo_reset', true) = 'on'
       and exists (select 1 from public.organizations o where o.id = old.organization_id and o.is_demo)) then
      raise exception 'MOVIX_CONTRACT_IMMUTABLE' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status <> 'pending'
     or new.clauses is distinct from old.clauses
     or new.terms is distinct from old.terms
     or new.content_hash is distinct from old.content_hash
     or new.version is distinct from old.version
     or new.rental_id is distinct from old.rental_id
     or new.status not in ('accepted','discarded') then
    raise exception 'MOVIX_CONTRACT_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.demo_populate(p_org uuid, p_variant int default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_org record;
  v_owner uuid;
  v_renters uuid[];
  v_vehicles uuid[] := '{}';
  v_vid uuid;
  v_rental uuid;
  v_version uuid;
  v_terms jsonb;
  v_clauses text := 'CLÁUSULA 1ª — Contrato de DEMONSTRAÇÃO com dados fictícios gerados automaticamente pelo MOVIX. ' ||
                    'CLÁUSULA 2ª — O locatário zela pelo veículo e realiza vistorias de retirada e devolução pelo aplicativo.';
  v_brand text[]; v_model text[]; v_version_name text[]; v_year int[]; v_plate text[]; v_color text[]; v_daily numeric[]; v_km int[];
  i int; m int; n int; s date; e date; v_total numeric; v_part numeric; k int;
  v_count int := 0;
begin
  select * into v_org from public.organizations where id = p_org;
  if v_org.id is null or not v_org.is_demo then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  -- Proprietário da locadora demo, ou chamada sem usuário no JWT (service role / SQL do operador).
  -- 'authenticated' sempre possui sub; 'anon' não tem permissão de execução.
  if not (public.is_org_owner(p_org) or auth.uid() is null) then
    raise exception 'MOVIX_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  v_owner := v_org.owner_id;
  select coalesce(array_agg(user_id order by requested_at), '{}') into v_renters
  from public.organization_memberships
  where organization_id = p_org and role = 'renter' and status = 'approved';
  n := coalesce(array_length(v_renters, 1), 0);

  -- 1) Limpeza (somente desta locadora demo)
  perform set_config('movix.demo_reset', 'on', true);
  delete from public.rentals where organization_id = p_org;
  delete from public.incidents where organization_id = p_org;
  delete from public.fines where organization_id = p_org;
  delete from public.expenses where organization_id = p_org;
  delete from public.maintenance_records where organization_id = p_org;
  delete from public.tracking_simulations where organization_id = p_org;
  delete from public.vehicles where organization_id = p_org;
  delete from public.notifications where organization_id = p_org;
  delete from public.audit_events where organization_id = p_org;
  perform set_config('movix.demo_reset', 'off', true);

  -- 2) Frota fictícia
  if p_variant = 2 then
    v_brand := array['Fiat','Toyota','Jeep','Nissan','Peugeot'];
    v_model := array['Mobi','Yaris','Renegade','Kicks','208'];
    v_version_name := array['Like 1.0','XL 1.5','Sport 1.3T','Advance','Active'];
    v_year := array[2023,2022,2021,2024,2023];
    v_plate := array['RSL1A11','RSL2B22','RSL3C33','RSL4D44','RSL5E55'];
    v_color := array['Branco','Prata','Preto','Cinza','Azul'];
    v_daily := array[95,149,189,169,139];
    v_km := array[18000,36000,82000,7000,24000];
  else
    v_brand := array['Fiat','Hyundai','Chevrolet','Renault','Volkswagen'];
    v_model := array['Argo','HB20','Onix','Kwid','Polo'];
    v_version_name := array['Drive 1.0','Comfort 1.0','LT 1.0','Zen 1.0','Track 1.0'];
    v_year := array[2023,2022,2020,2024,2023];
    v_plate := array['HZN1A23','HZN2B34','HZN3C45','HZN4D56','HZN5E67'];
    v_color := array['Vermelho','Branco','Prata','Laranja','Cinza'];
    v_daily := array[139,129,119,99,145];
    v_km := array[28400,41250,78900,9800,22300];
  end if;

  for i in 1..5 loop
    insert into public.vehicles (organization_id, brand, model, version, year, plate, color, fuel, transmission, mileage, seats,
      daily_price, weekly_price, monthly_price, status, notes)
    values (p_org, v_brand[i], v_model[i], v_version_name[i], v_year[i], v_plate[i], v_color[i], 'flex',
      case when i in (2,5) then 'automatic' else 'manual' end, v_km[i], 5, v_daily[i], v_daily[i] * 6, v_daily[i] * 22,
      'available', 'Veículo fictício para demonstração.')
    returning id into v_vid;
    v_vehicles := v_vehicles || v_vid;
    insert into public.vehicle_private_data (vehicle_id, organization_id, chassis, renavam, licensing_due_at, insurance_due_at, ipva_due_at)
    values (v_vid, p_org, '9BWZZZ37' || lpad((p_variant * 100 + i)::text, 9, '0'),
      lpad((900000000 + p_variant * 1000 + i)::text, 11, '0'),
      current_date + (40 * i), case when i = 3 then current_date - 5 else current_date + 120 end, current_date + 200);
  end loop;

  -- 3) Manutenções e despesas fixas
  insert into public.maintenance_records (organization_id, vehicle_id, kind, description, status, performed_at, mileage, cost, provider, created_by)
  values (p_org, v_vehicles[1], 'oil', 'Troca de óleo e filtros', 'completed', current_date - 40, v_km[1] - 1500, 280, 'Oficina Exemplo (fictícia)', v_owner),
         (p_org, v_vehicles[2], 'revision', 'Revisão 40.000 km', 'completed', current_date - 70, v_km[2] - 1200, 690, 'Concessionária Fictícia', v_owner),
         (p_org, v_vehicles[3], 'brakes', 'Pastilhas de freio', 'completed', current_date - 15, v_km[3] - 300, 420, 'Oficina Exemplo (fictícia)', v_owner);
  insert into public.maintenance_records (organization_id, vehicle_id, kind, description, status, scheduled_km, created_by)
  values (p_org, v_vehicles[3], 'revision', 'Revisão 75.000 km (vencida)', 'scheduled', v_km[3] - 3900, v_owner);
  insert into public.maintenance_records (organization_id, vehicle_id, kind, description, status, scheduled_for, created_by)
  values (p_org, v_vehicles[5], 'tires', 'Rodízio e alinhamento', 'scheduled', current_date + 4, v_owner);
  insert into public.expenses (organization_id, vehicle_id, category, amount, spent_at, description, maintenance_id, created_by)
  select p_org, m2.vehicle_id, 'maintenance', m2.cost, m2.performed_at, m2.description, m2.id, v_owner
  from public.maintenance_records m2 where m2.organization_id = p_org and m2.status = 'completed';
  for m in 0..5 loop
    insert into public.expenses (organization_id, vehicle_id, category, amount, spent_at, description, created_by) values
      (p_org, v_vehicles[1 + (m % 5)], 'fuel', 180 + m * 15, current_date - (m * 30) - 3, 'Abastecimento de entrega', v_owner),
      (p_org, v_vehicles[1 + ((m + 2) % 5)], 'cleaning', 90, current_date - (m * 30) - 8, 'Higienização completa', v_owner),
      (p_org, null, 'insurance', 620, current_date - (m * 30) - 12, 'Seguro da frota (parcela)', v_owner);
  end loop;
  insert into public.expenses (organization_id, vehicle_id, category, amount, spent_at, description, created_by) values
    (p_org, v_vehicles[4], 'ipva', 1180, current_date - 100, 'IPVA', v_owner),
    (p_org, v_vehicles[2], 'licensing', 160, current_date - 85, 'Licenciamento anual', v_owner);

  if n = 0 then
    return jsonb_build_object('vehicles', 5, 'rentals', 0);
  end if;

  -- 4) Locações históricas encerradas (receitas dos últimos meses)
  for m in 1..5 loop
    s := current_date - (30 * m) - 12;
    e := s + 9;
    i := 1 + (m % 5);
    v_total := v_daily[i] * 10;
    insert into public.rentals (organization_id, vehicle_id, renter_id, start_date, end_date, modality, unit_price, units, total_amount,
      installments_count, status, created_by, activated_at, completed_at, created_at)
    values (p_org, v_vehicles[i], v_renters[1 + (m % n)], s, e, 'daily', v_daily[i], 10, v_total, 2, 'completed', v_owner,
      s::timestamptz, e::timestamptz, (s - 2)::timestamptz)
    returning id into v_rental;
    insert into public.vehicle_availability_blocks (organization_id, vehicle_id, kind, period, rental_id, created_by)
    values (p_org, v_vehicles[i], 'rental', daterange(s, e, '[]'), v_rental, v_owner);
    v_part := trunc(v_total / 2, 2);
    for k in 1..2 loop
      insert into public.installments (rental_id, organization_id, number, due_date, amount, status, paid_at, payment_method)
      values (v_rental, p_org, k, s + (k - 1) * 5, case when k = 2 then v_total - v_part else v_part end, 'paid',
        (s + (k - 1) * 5)::timestamptz + interval '10 hours', case when k = 1 then 'pix' else 'card' end);
    end loop;
    insert into public.simulated_payments (installment_id, rental_id, organization_id, method, amount, reference, created_by, created_at)
    select id, v_rental, p_org, payment_method, amount, 'SIMULADO-DEMO-' || upper(substr(md5(id::text), 1, 8)), v_renters[1 + (m % n)], paid_at
    from public.installments where rental_id = v_rental;
    v_terms := public.build_contract_terms(v_rental);
    insert into public.contract_versions (rental_id, organization_id, version, clauses, terms, content_hash, status, created_by, created_at)
    values (v_rental, p_org, 1, v_clauses, v_terms, encode(sha256(convert_to(v_clauses || v_terms::text, 'UTF8')), 'hex'), 'accepted', v_owner, (s - 2)::timestamptz)
    returning id into v_version;
    update public.rentals set current_version_id = v_version where id = v_rental;
    insert into public.contract_acceptances (contract_version_id, rental_id, organization_id, renter_id, accepted_at, content_hash, acceptance_statement, user_agent, ip_address)
    select v_version, v_rental, p_org, v_renters[1 + (m % n)], (s - 1)::timestamptz, cv.content_hash,
      'Aceite eletrônico de demonstração (dados fictícios) da versão 1.', 'MOVIX demo seed', '127.0.0.1'
    from public.contract_versions cv where cv.id = v_version;
    v_count := v_count + 1;
  end loop;

  -- 5) Locações ativas (uma por locatário aprovado, até 2) nos veículos 1 e 2
  for i in 1..least(n, 2) loop
    s := current_date - 8;
    e := current_date + 6 + i * 4;
    v_total := v_daily[i] * ((e - s) + 1);
    insert into public.rentals (organization_id, vehicle_id, renter_id, start_date, end_date, modality, unit_price, units, total_amount,
      installments_count, status, created_by, activated_at, created_at)
    values (p_org, v_vehicles[i], v_renters[i], s, e, 'daily', v_daily[i], (e - s) + 1, v_total, 3, 'active', v_owner, s::timestamptz, (s - 1)::timestamptz)
    returning id into v_rental;
    insert into public.vehicle_availability_blocks (organization_id, vehicle_id, kind, period, rental_id, created_by)
    values (p_org, v_vehicles[i], 'rental', daterange(s, e, '[]'), v_rental, v_owner);
    v_part := trunc(v_total / 3, 2);
    for k in 1..3 loop
      insert into public.installments (rental_id, organization_id, number, due_date, amount, status, paid_at, payment_method)
      values (v_rental, p_org, k, s + (k - 1) * 7, case when k = 3 then v_total - v_part * 2 else v_part end,
        case when k = 1 then 'paid' else 'pending' end, case when k = 1 then s::timestamptz + interval '9 hours' end,
        case when k = 1 then 'pix' end);
    end loop;
    insert into public.simulated_payments (installment_id, rental_id, organization_id, method, amount, reference, created_by, created_at)
    select id, v_rental, p_org, 'pix', amount, 'SIMULADO-DEMO-' || upper(substr(md5(id::text), 1, 8)), v_renters[i], paid_at
    from public.installments where rental_id = v_rental and status = 'paid';
    v_terms := public.build_contract_terms(v_rental);
    insert into public.contract_versions (rental_id, organization_id, version, clauses, terms, content_hash, status, created_by, created_at)
    values (v_rental, p_org, 1, v_clauses, v_terms, encode(sha256(convert_to(v_clauses || v_terms::text, 'UTF8')), 'hex'), 'accepted', v_owner, (s - 1)::timestamptz)
    returning id into v_version;
    update public.rentals set current_version_id = v_version where id = v_rental;
    insert into public.contract_acceptances (contract_version_id, rental_id, organization_id, renter_id, accepted_at, content_hash, acceptance_statement, user_agent, ip_address)
    select v_version, v_rental, p_org, v_renters[i], (s - 1)::timestamptz + interval '2 hours', cv.content_hash,
      'Aceite eletrônico de demonstração (dados fictícios) da versão 1.', 'MOVIX demo seed', '127.0.0.1'
    from public.contract_versions cv where cv.id = v_version;
    insert into public.inspections (organization_id, rental_id, vehicle_id, kind, status, fuel_level, mileage, checklist, notes, submitted_by, submitted_at, reviewed_by, reviewed_at, review_notes)
    values (p_org, v_rental, v_vehicles[i], 'pickup', 'approved', 100, v_km[i] - 600,
      '{"pneus":true,"estepe":true,"farois":true,"limpeza":true,"documentos":true,"arCondicionado":true,"painel":true,"vidros":true}',
      'Vistoria fictícia de demonstração (sem fotos).', v_renters[i], s::timestamptz, v_owner, s::timestamptz + interval '1 hour', 'Tudo conforme.');
    update public.vehicles set status = 'rented' where id = v_vehicles[i];
    insert into public.tracking_simulations (organization_id, vehicle_id, route_key, status, accumulated_seconds, resumed_at, geofence_radius_m)
    values (p_org, v_vehicles[i], case i when 1 then 'paulista-ibirapuera' else 'centro-pinheiros' end, 'running', 60 * i, now(), 2500);
    if i = 1 then
      insert into public.incidents (organization_id, vehicle_id, rental_id, reported_by, kind, title, description, occurred_at, location, status)
      values (p_org, v_vehicles[i], v_rental, v_renters[i], 'damage', 'Risco no para-choque', 'Risco leve no para-choque traseiro ao estacionar (registro fictício).',
        now() - interval '2 days', 'São Paulo/SP', 'open');
    else
      insert into public.fines (organization_id, vehicle_id, rental_id, description, infraction_at, amount, due_date, status)
      values (p_org, v_vehicles[i], v_rental, 'Excesso de velocidade até 20% (fictícia)', current_date - 3, 130.16, current_date + 25, 'pending');
    end if;
    v_count := v_count + 1;
  end loop;

  -- 6) Contrato aguardando aceite do primeiro locatário (veículo 4)
  s := current_date + 5;
  e := current_date + 11;
  v_total := v_daily[4] * 7;
  insert into public.rentals (organization_id, vehicle_id, renter_id, start_date, end_date, modality, unit_price, units, total_amount, installments_count, status, created_by)
  values (p_org, v_vehicles[4], v_renters[1], s, e, 'weekly', v_daily[4] * 7, 1, v_total, 1, 'pending_acceptance', v_owner)
  returning id into v_rental;
  insert into public.vehicle_availability_blocks (organization_id, vehicle_id, kind, period, rental_id, created_by)
  values (p_org, v_vehicles[4], 'rental', daterange(s, e, '[]'), v_rental, v_owner);
  insert into public.installments (rental_id, organization_id, number, due_date, amount) values (v_rental, p_org, 1, s, v_total);
  v_terms := public.build_contract_terms(v_rental);
  insert into public.contract_versions (rental_id, organization_id, version, clauses, terms, content_hash, created_by)
  values (v_rental, p_org, 1, v_clauses, v_terms, encode(sha256(convert_to(v_clauses || v_terms::text, 'UTF8')), 'hex'), v_owner)
  returning id into v_version;
  update public.rentals set current_version_id = v_version where id = v_rental;
  update public.vehicles set status = 'reserved' where id = v_vehicles[4];
  update public.vehicles set status = 'maintenance' where id = v_vehicles[3];
  perform public.notify_user(v_renters[1], p_org, 'contract', 'Novo contrato para aceite', 'Contrato de demonstração aguardando seu aceite.', '/app/locacoes/' || v_rental);

  return jsonb_build_object('vehicles', 5, 'rentals', v_count + 1, 'renters', n);
end $$;

revoke all on function public.demo_populate(uuid, int) from public, anon;
grant execute on function public.demo_populate(uuid, int) to authenticated, service_role;

-- ===== supabase/migrations/20261113000006_fix_org_select.sql
-- MOVIX · 0006 · Correção da policy organizations_select
-- Na subconsulta original, `id` sem qualificação resolvia para organization_memberships.id (e não organizations.id),
-- então um locatário com vínculo pendente não enxergava o nome da locadora na tela "Cadastro em análise".
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to authenticated
  using (
    public.is_org_member(organizations.id)
    or exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organizations.id and m.user_id = auth.uid()
    )
  );

-- ===== supabase/migrations/20261113000007_hardening.sql
-- MOVIX · 0007 · Ajustes apontados pelos advisors do Supabase (segurança e desempenho). Sem mudança de regra de negócio.

-- 1) search_path fixo nas funções de trigger/utilitárias (lint 0011)
alter function public.set_updated_at() set search_path = '';
alter function public.try_uuid(text) set search_path = '';
alter function public.guard_immutable() set search_path = '';
alter function public.guard_contract_version() set search_path = '';

-- 2) auth.uid() avaliado uma vez por consulta, não por linha (lint 0003). Mesmas condições de antes.
alter policy incident_media_insert on public.incident_media
  with check (uploaded_by = (select auth.uid()) and public.can_access_incident(incident_id));

alter policy incidents_insert on public.incidents
  with check (
    reported_by = (select auth.uid()) and status = 'open' and resolution_notes is null
    and (public.is_org_owner(organization_id)
         or (rental_id is not null and public.is_rental_renter(rental_id)
             and exists (select 1 from public.rentals r where r.id = incidents.rental_id and r.status = 'active')))
  );

alter policy inspection_media_insert on public.inspection_media
  with check (exists (
    select 1 from public.inspections i
    where i.id = inspection_media.inspection_id and i.submitted_by = (select auth.uid())
      and i.status = 'submitted' and public.can_access_inspection(i.id)
  ));

alter policy inspections_insert on public.inspections
  with check (
    submitted_by = (select auth.uid()) and status = 'submitted'
    and reviewed_by is null and reviewed_at is null and review_notes is null
    and (public.is_org_owner(organization_id)
         or (public.is_rental_renter(rental_id)
             and exists (select 1 from public.rentals r where r.id = inspections.rental_id and r.status = 'active')))
  );

alter policy invitations_insert on public.invitations
  with check (public.is_org_owner(organization_id) and created_by = (select auth.uid()));

alter policy notifications_select on public.notifications using (user_id = (select auth.uid()));
alter policy notifications_update on public.notifications
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy memberships_select on public.organization_memberships
  using (user_id = (select auth.uid()) or public.is_org_owner(organization_id));

alter policy organizations_select on public.organizations
  using (
    public.is_org_member(organizations.id)
    or exists (select 1 from public.organization_memberships m
               where m.organization_id = organizations.id and m.user_id = (select auth.uid()))
  );

alter policy platform_admins_select on public.platform_admins using (user_id = (select auth.uid()));

alter policy profiles_update on public.profiles
  using (id = (select auth.uid()) and suspended_at is null) with check (id = (select auth.uid()));

alter policy rentals_select on public.rentals
  using (public.is_org_owner(organization_id)
         or (renter_id = (select auth.uid()) and public.has_org_role(organization_id, 'renter')));

-- 3) Índices para chaves estrangeiras (lint 0001)
create index if not exists contract_acceptances_org_idx on public.contract_acceptances (organization_id);
create index if not exists contract_acceptances_rental_idx on public.contract_acceptances (rental_id);
create index if not exists contract_acceptances_renter_idx on public.contract_acceptances (renter_id);
create index if not exists contract_versions_created_by_idx on public.contract_versions (created_by);
create index if not exists contract_versions_org_idx on public.contract_versions (organization_id);
create index if not exists expenses_created_by_idx on public.expenses (created_by);
create index if not exists expenses_vehicle_idx on public.expenses (vehicle_id);
create index if not exists fines_rental_idx on public.fines (rental_id);
create index if not exists fines_vehicle_idx on public.fines (vehicle_id);
create index if not exists incident_media_incident_idx on public.incident_media (incident_id);
create index if not exists incident_media_org_idx on public.incident_media (organization_id);
create index if not exists incident_media_uploaded_by_idx on public.incident_media (uploaded_by);
create index if not exists incidents_rental_idx on public.incidents (rental_id);
create index if not exists incidents_reported_by_idx on public.incidents (reported_by);
create index if not exists incidents_vehicle_idx on public.incidents (vehicle_id);
create index if not exists inspection_media_org_idx on public.inspection_media (organization_id);
create index if not exists inspections_reviewed_by_idx on public.inspections (reviewed_by);
create index if not exists inspections_submitted_by_idx on public.inspections (submitted_by);
create index if not exists inspections_supersedes_idx on public.inspections (supersedes_id);
create index if not exists inspections_vehicle_idx on public.inspections (vehicle_id);
create index if not exists invitations_created_by_idx on public.invitations (created_by);
create index if not exists maintenance_records_created_by_idx on public.maintenance_records (created_by);
create index if not exists maintenance_records_org_idx on public.maintenance_records (organization_id);
create index if not exists notifications_org_idx on public.notifications (organization_id);
create index if not exists memberships_decided_by_idx on public.organization_memberships (decided_by);
create index if not exists memberships_invitation_idx on public.organization_memberships (invitation_id);
create index if not exists rentals_created_by_idx on public.rentals (created_by);
create index if not exists rentals_current_version_idx on public.rentals (current_version_id);
create index if not exists simulated_payments_created_by_idx on public.simulated_payments (created_by);
create index if not exists simulated_payments_installment_idx on public.simulated_payments (installment_id);
create index if not exists simulated_payments_rental_idx on public.simulated_payments (rental_id);
create index if not exists tracking_simulations_org_idx on public.tracking_simulations (organization_id);
create index if not exists availability_blocks_created_by_idx on public.vehicle_availability_blocks (created_by);
create index if not exists vehicle_media_org_idx on public.vehicle_media (organization_id);
create index if not exists vehicle_private_data_org_idx on public.vehicle_private_data (organization_id);
