-- Phase 9. Opening hours are a split schedule, and crowd is a timetable.
--
-- `gyms.weekly_hours` was one { open, close } pair per day, which cannot say
-- what this gym actually does: open 5:30–11:30 in the morning, shut through
-- the afternoon, open again 16:00–22:00. Encoding that as a single range
-- would tell a member the gym is open at 2pm.
--
-- Crowd was one column the owner set by hand and then had to remember to
-- change. It is really a weekly pattern — the same hours are busy every
-- Tuesday — so it becomes a schedule, with the manual value demoted to an
-- override that beats it, exactly as `is_open_override` beats the hours.

/* ------------------------------------------------------------ hour blocks */

create table public.gym_hour_blocks (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  -- ISO weekday: Monday = 1 … Sunday = 7, matching gymIsoWeekday() in
  -- lib/gym.ts. Postgres's own extract(dow) is Sunday = 0; this is not that.
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now(),

  -- A block that ends before it starts would silently never match.
  constraint gym_hour_blocks_ordered check (end_time > start_time)
);

create index gym_hour_blocks_lookup_idx
  on public.gym_hour_blocks (gym_id, day_of_week, start_time);

alter table public.gym_hour_blocks enable row level security;

-- Opening hours are public: the landing page shows them before anyone signs in.
create policy "hour blocks are readable by everyone"
  on public.gym_hour_blocks for select
  to anon, authenticated
  using (true);

create policy "staff manage hour blocks"
  on public.gym_hour_blocks for all
  to authenticated
  using (public.is_staff(gym_id))
  with check (public.is_staff(gym_id));


/* --------------------------------------------------------- crowd schedule */

create table public.crowd_schedule (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time  time not null,
  end_time    time not null,
  level       public.crowd_level not null,
  created_at  timestamptz not null default now(),

  constraint crowd_schedule_ordered check (end_time > start_time)
);

create index crowd_schedule_lookup_idx
  on public.crowd_schedule (gym_id, day_of_week, start_time);

alter table public.crowd_schedule enable row level security;

create policy "crowd schedule is readable by everyone"
  on public.crowd_schedule for select
  to anon, authenticated
  using (true);

create policy "staff manage crowd schedule"
  on public.crowd_schedule for all
  to authenticated
  using (public.is_staff(gym_id))
  with check (public.is_staff(gym_id));


/* ------------------------------------------------- crowd becomes an override

   Renamed rather than replaced, so the column keeps its lineage and ends up
   with the same shape as `is_open_override`: null means follow the schedule,
   a value beats it. The existing contents are dropped to null because they
   were never anything but the seed default — until this phase's sibling
   migration, no write to `gyms` could land at all (see D59), so there is no
   owner intent stored here to preserve.                                     */

alter table public.gyms rename column crowd_level to crowd_override;
alter table public.gyms alter column crowd_override drop not null;
alter table public.gyms alter column crowd_override drop default;
update public.gyms set crowd_override = null;


/* ---------------------------------------------------------------- the seed */

-- The gym's real hours. Every day is the same split; the owner can edit any
-- of it from Gym settings, and Saturday and Sunday are seeded identically
-- only because no different weekend hours were specified.
insert into public.gym_hour_blocks (gym_id, day_of_week, start_time, end_time)
select g.id, d.day, b.start_time, b.end_time
from public.gyms g
cross join generate_series(1, 7) as d(day)
cross join (values
  ('05:30'::time, '11:30'::time),
  ('16:00'::time, '22:00'::time)
) as b(start_time, end_time)
where g.slug = 'bodyholics';

-- Crowd, weekday: the pre-work rush and the after-work rush are the two
-- times it is genuinely hard to get a rack.
insert into public.crowd_schedule (gym_id, day_of_week, start_time, end_time, level)
select g.id, d.day, s.start_time, s.end_time, s.level::public.crowd_level
from public.gyms g
cross join generate_series(1, 5) as d(day)
cross join (values
  ('05:30'::time, '07:00'::time, 'not_crowded'),
  ('07:00'::time, '08:00'::time, 'crowded'),
  ('08:00'::time, '11:30'::time, 'moderate'),
  ('16:00'::time, '18:00'::time, 'moderate'),
  ('18:00'::time, '19:30'::time, 'crowded'),
  ('19:30'::time, '22:00'::time, 'moderate')
) as s(start_time, end_time, level)
where g.slug = 'bodyholics';

-- Weekends spread out: a busy morning, a quiet evening.
insert into public.crowd_schedule (gym_id, day_of_week, start_time, end_time, level)
select g.id, d.day, s.start_time, s.end_time, s.level::public.crowd_level
from public.gyms g
cross join generate_series(6, 7) as d(day)
cross join (values
  ('05:30'::time, '08:00'::time, 'not_crowded'),
  ('08:00'::time, '11:30'::time, 'moderate'),
  ('16:00'::time, '22:00'::time, 'not_crowded')
) as s(start_time, end_time, level)
where g.slug = 'bodyholics';


-- Both tables drive a screen that must update without a refresh, same as
-- `gyms` in D61.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'gym_hour_blocks'
  ) then
    alter publication supabase_realtime add table public.gym_hour_blocks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'crowd_schedule'
  ) then
    alter publication supabase_realtime add table public.crowd_schedule;
  end if;
end
$$;


-- weekly_hours is now dead: one range per day cannot express a split
-- schedule, which is the whole point of this migration.
--
-- Its entire contents at the moment of the drop, recorded here because a
-- dropped column is not recoverable and this is the only copy:
--
--   mon..fri  { "open": "06:00", "close": "22:00" }
--   sat, sun  { "open": "07:00", "close": "20:00" }
--
-- That was the single-range approximation of the real hours, and it is
-- superseded by the blocks seeded above rather than converted into them.
alter table public.gyms drop column weekly_hours;
