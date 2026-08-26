-- docs/05 §5 — presence events and the crowd level derived from them (D-008).

create table public.attendance_events (
  id               uuid primary key default gen_random_uuid(),
  gym_id           uuid not null references public.gyms(id) on delete cascade,
  user_id          uuid references public.profiles(id) on delete set null,  -- null for aggregate-only sources
  source_type      text not null
                     check (source_type in ('MANUAL','QR','DEVICE_ACTIVITY','FINGERPRINT')),
  event_type       text not null
                     check (event_type in ('CHECK_IN','CHECK_OUT','PRESENCE_START','PRESENCE_END')),
  occurred_at      timestamptz not null default now(),
  source_reference text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index attendance_gym_time_idx  on public.attendance_events (gym_id, occurred_at desc);
create index attendance_user_time_idx on public.attendance_events (user_id, occurred_at desc);

-- One open presence per user per gym at a time.
create unique index attendance_one_open_presence_idx
  on public.attendance_events (gym_id, user_id)
  where event_type = 'PRESENCE_START' and (metadata->>'closed') is null;

create table public.crowd_snapshots (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  captured_at timestamptz not null default now(),
  level       text check (level in ('NOT_CROWDED','MODERATE','CROWDED','VERY_CROWDED')),
  confidence  text not null default 'OK'
                check (confidence in ('OK','LOW','INSUFFICIENT_DATA')),
  source_type text not null
                check (source_type in ('DEVICE_ACTIVITY','FINGERPRINT','MANUAL','HYBRID','QR')),
  metadata    jsonb not null default '{}'::jsonb
);

create index crowd_snapshots_gym_time_idx on public.crowd_snapshots (gym_id, captured_at desc);

-- ------------------------------------------------------ occupancy & bucketing

create or replace function public.current_occupancy(p_gym_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct e.user_id)::int
  from public.attendance_events e
  join public.gyms g on g.id = e.gym_id
  where e.gym_id = p_gym_id
    and e.event_type in ('PRESENCE_START','CHECK_IN')
    and e.occurred_at > now() - make_interval(mins => g.presence_ttl_minutes)
    and not exists (
      select 1 from public.attendance_events x
      where x.gym_id = e.gym_id and x.user_id = e.user_id
        and x.event_type in ('PRESENCE_END','CHECK_OUT')
        and x.occurred_at > e.occurred_at
    );
$$;

create or replace function public.crowd_level(p_gym_id uuid)
returns table (level text, confidence text, sample_size int)
language plpgsql stable security definer set search_path = public as $$
declare v int; t jsonb;
begin
  select public.current_occupancy(p_gym_id) into v;
  select crowd_thresholds into t from public.gyms where id = p_gym_id;
  if v < 3 then
    return query select null::text, 'INSUFFICIENT_DATA'::text, v;          -- D-008
  elsif v < (t->>'moderate')::int     then return query select 'NOT_CROWDED'::text, 'OK'::text, v;
  elsif v < (t->>'crowded')::int      then return query select 'MODERATE'::text,    'OK'::text, v;
  elsif v < (t->>'very_crowded')::int then return query select 'CROWDED'::text,     'OK'::text, v;
  else                                     return query select 'VERY_CROWDED'::text,'OK'::text, v;
  end if;
end $$;

-- Both of the above return an exact headcount, which docs/05 §5 says must never
-- reach a member. They are security definer, so a grant to `authenticated` would
-- hand every member the live headcount of any gym id they can guess. Members get
-- the bucketed wrapper below instead; staff analytics use the service key.
revoke execute on function public.current_occupancy(uuid) from public, anon, authenticated;
revoke execute on function public.crowd_level(uuid)       from public, anon, authenticated;

create or replace function public.member_crowd_level(p_gym_id uuid)
returns table (level text, confidence text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_gym_member(p_gym_id) and not public.is_gym_staff(p_gym_id) then
    raise exception 'FORBIDDEN';
  end if;
  return query select c.level, c.confidence from public.crowd_level(p_gym_id) c;
end $$;

revoke execute on function public.member_crowd_level(uuid) from public, anon;
grant  execute on function public.member_crowd_level(uuid) to authenticated;

-- ---------------------------------------------------------------- RLS

alter table public.attendance_events enable row level security;
alter table public.crowd_snapshots   enable row level security;

create policy attendance_select on public.attendance_events
for select to authenticated
using ((select auth.uid()) = user_id or public.is_gym_staff(gym_id));

-- A member may only record their own presence, only at a gym they belong to,
-- and only as a presence event — CHECK_IN/CHECK_OUT are service-key only.
create policy attendance_insert_self on public.attendance_events
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and public.is_gym_member(gym_id)
  and event_type in ('PRESENCE_START','PRESENCE_END')
  and source_type = 'MANUAL'
);

-- crowd_snapshots.metadata carries sample_size, an exact headcount for admin
-- analytics only. RLS filters rows, not columns, so what keeps it away from a
-- member is a column grant — see 20260826090900_grant_table_privileges.sql.
create policy crowd_snapshots_select on public.crowd_snapshots
for select to authenticated
using (public.is_gym_member(gym_id) or public.is_gym_staff(gym_id));
