-- Phase 8. Two separate bugs, both of which made the admin's gym controls
-- look like they worked and then silently revert.
--
-- 1. `gyms` had a select policy and nothing else. Every staff write —
--    is_open_override, crowd_level, weekly_hours — matched zero rows. Postgres
--    reports an RLS-filtered UPDATE as a successful update of no rows, so
--    supabase-js returned `error: null` and the server action returned ok.
--    The optimistic UI flipped, the row never changed, and the next read put
--    it back. Confirmed on the live database: crowd_updated_at was still the
--    seed timestamp after the owner had used the toggles.
--
-- 2. The member screen had no way to hear about a change even once the write
--    landed. Realtime only streams tables that are in the publication.

create policy "staff update their own gym"
  on public.gyms for update
  to authenticated
  using (public.is_staff(id))
  with check (public.is_staff(id));

-- Idempotent: `alter publication ... add table` errors if the table is
-- already a member, and this migration must survive being replayed.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gyms'
  ) then
    alter publication supabase_realtime add table public.gyms;
  end if;
end
$$;
