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
