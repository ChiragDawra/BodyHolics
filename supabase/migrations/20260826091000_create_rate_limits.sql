-- docs/04 §12 and docs/07 §10 require an application-level rate limit table.
-- docs/05 never defines one, so this is it.
--
-- The counter is a fixed window rather than a sliding one. A fixed window lets
-- twice the limit through across a boundary, which is a real weakness for a
-- throttle but an acceptable one here: these limits exist to stop abuse and
-- runaway retries, not to meter a paid API, and a sliding window costs a row per
-- request instead of a row per window.

create table public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        int not null default 0
);

-- Old windows are dead weight; a daily sweep keeps the table at roughly the
-- number of active keys rather than growing forever.
create index rate_limits_window_idx on public.rate_limits (window_start);

/**
 * Atomic check-and-increment. Returns true when the caller is over the limit.
 *
 * The upsert is what makes this safe under concurrency: two simultaneous calls
 * cannot both read `count` and both write `count + 1`, because the second one
 * blocks on the row lock the first one takes. A read-then-write in application
 * code would let a burst straight through.
 */
create or replace function public.check_rate_limit(
  p_key text,
  p_limit int,
  p_window interval
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count        = case
                         when public.rate_limits.window_start < now() - p_window then 1
                         else public.rate_limits.count + 1
                       end,
        window_start = case
                         when public.rate_limits.window_start < now() - p_window then now()
                         else public.rate_limits.window_start
                       end
  returning count into v_count;

  return v_count > p_limit;
end $$;

-- Only Edge Functions call this. A client that could call it directly could
-- exhaust its own budget, or worse, someone else's by guessing a key.
revoke execute on function public.check_rate_limit(text, int, interval)
  from public, anon, authenticated;
grant  execute on function public.check_rate_limit(text, int, interval) to service_role;

-- RLS on, no policy, no grant: this table is service-role only. A readable key
-- would leak which member has been attempting what, and how often.
alter table public.rate_limits enable row level security;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise warning 'pg_cron not installed: skipping rate_limits sweep';
    return;
  end if;

  perform cron.schedule('purge-stale-rate-limits', '30 3 * * *', $job$
    delete from public.rate_limits where window_start < now() - interval '2 days';
  $job$);
end $$;
