-- docs/05 §4 — the weekly schedule, manual overrides, and the one function that
-- resolves them into the status a client is allowed to render (D-007).

create table public.gym_hours (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),  -- 0 = Sunday, matches extract(dow)
  opens_at   time,
  closes_at  time,
  is_closed  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, weekday),
  constraint hours_present_when_open
    check (is_closed or (opens_at is not null and closes_at is not null and closes_at > opens_at))
);

create trigger set_updated_at before update on public.gym_hours
  for each row execute function public.tg_set_updated_at();

create table public.gym_status_overrides (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  forced_status text not null check (forced_status in ('OPEN','CLOSED')),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  reason        text,
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now(),
  constraint override_range_valid check (ends_at > starts_at)
);

create index gym_status_overrides_window_idx
  on public.gym_status_overrides (gym_id, starts_at, ends_at);

-- ------------------------------------------------------- status resolution

create or replace function public.current_gym_status(p_gym_id uuid)
returns table (status text, source text, override_reason text, changes_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz    text;
  v_local timestamp;
  v_dow   smallint;
  v_hours public.gym_hours;
  v_ovr   public.gym_status_overrides;
begin
  select timezone into v_tz from public.gyms where id = p_gym_id;
  if v_tz is null then raise exception 'GYM_NOT_FOUND'; end if;

  select * into v_ovr from public.gym_status_overrides
   where gym_id = p_gym_id and now() between starts_at and ends_at
   order by starts_at desc limit 1;

  if found then
    return query select v_ovr.forced_status, 'MANUAL_OVERRIDE'::text, v_ovr.reason, v_ovr.ends_at;
    return;
  end if;

  v_local := now() at time zone v_tz;
  v_dow   := extract(dow from v_local)::smallint;
  select * into v_hours from public.gym_hours where gym_id = p_gym_id and weekday = v_dow;

  if not found or v_hours.is_closed then
    return query select 'CLOSED'::text, 'SCHEDULE'::text, null::text, null::timestamptz;
  elsif v_local::time >= v_hours.opens_at and v_local::time < v_hours.closes_at then
    return query select 'OPEN'::text, 'SCHEDULE'::text, null::text,
                        ((v_local::date + v_hours.closes_at) at time zone v_tz);
  else
    return query select 'CLOSED'::text, 'SCHEDULE'::text, null::text,
                        ((v_local::date + v_hours.opens_at) at time zone v_tz);
  end if;
end $$;

grant execute on function public.current_gym_status(uuid) to authenticated, anon;

-- ---------------------------------------------------------------- RLS

alter table public.gym_hours            enable row level security;
alter table public.gym_status_overrides enable row level security;

-- Opening hours are public: a prospective member reads them before signing up.
create policy gym_hours_select_public on public.gym_hours
for select to anon, authenticated
using (exists (select 1 from public.gyms g where g.id = gym_hours.gym_id and g.is_active));

create policy gym_hours_insert_staff on public.gym_hours
for insert to authenticated with check (public.is_gym_staff(gym_id));

create policy gym_hours_update_staff on public.gym_hours
for update to authenticated
using (public.is_gym_staff(gym_id)) with check (public.is_gym_staff(gym_id));

create policy gym_hours_delete_staff on public.gym_hours
for delete to authenticated using (public.is_gym_staff(gym_id));

-- An override carries a staff-written reason, so it stays inside the tenant.
-- Anonymous callers still get the resolved status through current_gym_status().
create policy gym_status_overrides_select on public.gym_status_overrides
for select to authenticated
using (public.is_gym_member(gym_id) or public.is_gym_staff(gym_id));

create policy gym_status_overrides_insert_staff on public.gym_status_overrides
for insert to authenticated
with check (public.is_gym_staff(gym_id) and (select auth.uid()) = created_by);

create policy gym_status_overrides_update_staff on public.gym_status_overrides
for update to authenticated
using (public.is_gym_staff(gym_id)) with check (public.is_gym_staff(gym_id));
