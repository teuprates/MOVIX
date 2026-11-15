-- MOVIX · 0008 · Rate limit persistente por usuário e bucket.
-- Acesso somente pela RPC com a sessão do usuário; nenhuma policy para clientes.
create table public.rate_limit_hits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null check (char_length(bucket) between 1 and 64),
  hit_at timestamptz not null default now()
);

create index rate_limit_hits_user_bucket_hit_at_idx
  on public.rate_limit_hits (user_id, bucket, hit_at);

alter table public.rate_limit_hits enable row level security;
revoke all on table public.rate_limit_hits from public, anon, authenticated;

create or replace function public.consume_rate_limit(p_bucket text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz;
  v_cutoff timestamptz;
  v_count bigint;
begin
  if v_user is null then return false; end if;
  if p_max is null or p_max not between 1 and 3600
     or p_window_seconds is null or p_window_seconds not between 1 and 3600
     or p_bucket is null or char_length(p_bucket) not between 1 and 64 then
    raise exception 'MOVIX_INVALID_RATE_LIMIT' using errcode = '22023';
  end if;

  -- Serializa também o primeiro hit, quando ainda não existe uma linha para travar.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || ':' || p_bucket, 0));
  v_now := pg_catalog.clock_timestamp();
  v_cutoff := v_now - pg_catalog.make_interval(secs => p_window_seconds);

  delete from public.rate_limit_hits
  where user_id = v_user and bucket = p_bucket and hit_at < v_cutoff;

  select count(*) into v_count from public.rate_limit_hits
  where user_id = v_user and bucket = p_bucket and hit_at >= v_cutoff;

  if v_count >= p_max then return false; end if;
  insert into public.rate_limit_hits (user_id, bucket, hit_at) values (v_user, p_bucket, v_now);
  return true;
end $$;

revoke execute on function public.consume_rate_limit(text, int, int) from public, anon;
grant execute on function public.consume_rate_limit(text, int, int) to authenticated;
