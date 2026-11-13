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
