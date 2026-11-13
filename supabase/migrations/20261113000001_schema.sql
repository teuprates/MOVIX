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
