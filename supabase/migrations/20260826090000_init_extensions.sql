-- docs/05 §1 — extensions and the one shared trigger function.

create extension if not exists pgcrypto;   -- gen_random_uuid, digest

-- pg_cron is only creatable in the database named in cron.database_name, and it
-- requires shared_preload_libraries. Both hold on the local Supabase stack and on
-- a hosted project once the dashboard toggle is on; a plain Postgres has neither.
-- Failing the whole reset over a scheduler is worse than starting without one, so
-- this is advisory: `20260826093000_schedule_jobs.sql` no-ops when it is absent.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise warning 'pg_cron unavailable (%): scheduled jobs will not be installed', sqlerrm;
end $$;

-- updated_at is maintained here and never by application code (docs/05 §0).
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
