-- Limite de 12 fotos por veículo garantido no banco (a Server Action também verifica, mas dois envios
-- simultâneos poderiam ultrapassar). O lock por veículo serializa inserções concorrentes do mesmo veículo.
-- Não altera dados existentes nem caminhos já armazenados.

create or replace function public.guard_vehicle_media_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  perform pg_advisory_xact_lock(hashtextextended('vehicle_media:' || new.vehicle_id::text, 0));
  select count(*) into v_count from public.vehicle_media where vehicle_id = new.vehicle_id;
  if v_count >= 12 then
    raise exception 'MOVIX_VEHICLE_PHOTO_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end $$;

revoke execute on function public.guard_vehicle_media_limit() from public, anon, authenticated;

create trigger vehicle_media_limit before insert on public.vehicle_media
  for each row execute function public.guard_vehicle_media_limit();
