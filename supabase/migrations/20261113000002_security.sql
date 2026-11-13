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
