-- What a membership costs and how long it lasts, plus who currently holds one.
-- No payment is taken anywhere in this build. price_paise records the sticker
-- price the owner already charges in cash; nothing reads it to charge anyone.

create table public.plans (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  name          text not null,
  -- Indian rupees stored as integer paise. Never store money as float.
  price_paise   integer not null check (price_paise >= 0),
  duration_days integer not null check (duration_days > 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index plans_gym_id_idx on public.plans (gym_id);

alter table public.plans enable row level security;

-- Prices are shown on the public join page.
create policy "active plans are readable by everyone"
  on public.plans for select
  to anon, authenticated
  using (is_active or public.is_staff(gym_id));

create policy "staff manage plans"
  on public.plans for all
  to authenticated
  using (public.is_staff(gym_id))
  with check (public.is_staff(gym_id));


create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  plan_id     uuid references public.plans (id) on delete set null,
  start_date  date not null default current_date,
  end_date    date not null,
  status      public.membership_status not null default 'active',
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);

create index memberships_profile_id_idx on public.memberships (profile_id);
create index memberships_gym_id_idx on public.memberships (gym_id);
create index memberships_end_date_idx on public.memberships (end_date desc);

alter table public.memberships enable row level security;

create policy "members read their own memberships"
  on public.memberships for select
  to authenticated
  using (profile_id = auth.uid());

create policy "staff read memberships at their gym"
  on public.memberships for select
  to authenticated
  using (public.is_staff(gym_id));

create policy "staff manage memberships"
  on public.memberships for all
  to authenticated
  using (public.is_staff(gym_id))
  with check (public.is_staff(gym_id));

-- status is a stored column so staff can cancel explicitly, but an expired
-- date always wins over a stale 'active'. Read through this helper.
create or replace function public.membership_is_current(m public.memberships)
returns boolean
language sql
immutable
as $$
  select m.status = 'active' and m.end_date >= current_date;
$$;
