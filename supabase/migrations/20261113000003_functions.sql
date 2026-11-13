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
