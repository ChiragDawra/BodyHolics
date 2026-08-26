-- docs/05 §2 — gyms, profiles, the tenancy edge, staff, and the authorization
-- helpers that every later policy is written in terms of.

-- ---------------------------------------------------------------- gyms

create table public.gyms (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique
                          check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),          -- D-006
  name                  text not null check (length(trim(name)) between 2 and 120),
  timezone              text not null default 'Asia/Kolkata',
  phone                 text,
  address               text,
  logo_path             text,
  expiry_warning_days   int  not null default 7   check (expiry_warning_days between 1 and 60),   -- D-002
  presence_ttl_minutes  int  not null default 120 check (presence_ttl_minutes between 15 and 600), -- D-008
  crowd_thresholds      jsonb not null default '{"moderate":10,"crowded":25,"very_crowded":40}'::jsonb,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger set_updated_at before update on public.gyms
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null check (length(trim(full_name)) between 2 and 120),
  phone         text not null unique,            -- E.164, mirrored from auth.users at signup
  avatar_path   text,
  date_of_birth date check (date_of_birth < current_date),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint phone_e164 check (phone ~ '^\+[1-9][0-9]{7,14}$')
);

create trigger set_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------- gym_members

create table public.gym_members (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  member_code  text not null,
  status       text not null default 'ACTIVE' check (status in ('ACTIVE','BLOCKED')),
  joined_at    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (gym_id, user_id),
  unique (gym_id, member_code)
);

create index gym_members_gym_status_idx on public.gym_members (gym_id, status);

create trigger set_updated_at before update on public.gym_members
  for each row execute function public.tg_set_updated_at();

-- Race-prone under concurrency; acceptable at one-gym MVP scale (docs/11 Q6).
create or replace function public.next_member_code(p_gym_id uuid)
returns text language sql volatile set search_path = public as $$
  select 'UG-' || lpad(((count(*) + 1))::text, 4, '0')
  from public.gym_members where gym_id = p_gym_id;
$$;

revoke execute on function public.next_member_code(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- gym_staff

create table public.gym_staff (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null check (role in ('OWNER','STAFF')),
  status     text not null default 'ACTIVE' check (status in ('ACTIVE','DISABLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, user_id)
);

create index gym_staff_user_idx on public.gym_staff (user_id, status);

create trigger set_updated_at before update on public.gym_staff
  for each row execute function public.tg_set_updated_at();

-- ------------------------------------------------- authorization helpers
-- `security definer` is required: without it the policy on gym_staff recurses
-- into itself. `set search_path = public` is what makes that safe.

create or replace function public.is_gym_staff(p_gym_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gym_staff gs
    where gs.user_id = (select auth.uid())
      and gs.gym_id  = p_gym_id
      and gs.status  = 'ACTIVE'
  );
$$;

create or replace function public.is_gym_owner(p_gym_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gym_staff gs
    where gs.user_id = (select auth.uid())
      and gs.gym_id  = p_gym_id
      and gs.status  = 'ACTIVE'
      and gs.role    = 'OWNER'
  );
$$;

create or replace function public.is_gym_member(p_gym_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gym_members gm
    where gm.user_id = (select auth.uid())
      and gm.gym_id  = p_gym_id
      and gm.status  = 'ACTIVE'
  );
$$;

revoke execute on function public.is_gym_staff(uuid), public.is_gym_owner(uuid),
                          public.is_gym_member(uuid) from public, anon;
grant  execute on function public.is_gym_staff(uuid), public.is_gym_owner(uuid),
                          public.is_gym_member(uuid) to authenticated;

-- ---------------------------------------------------------------- RLS

alter table public.gyms        enable row level security;
alter table public.profiles    enable row level security;
alter table public.gym_members enable row level security;
alter table public.gym_staff   enable row level security;

-- gyms is readable before signup so a scanned QR can resolve a slug to a gym.
-- An anonymous caller has no business seeing the operational tuning columns, and
-- RLS filters rows, not columns — the column grant that handles that lives in
-- 20260826090900_grant_table_privileges.sql with the rest of the surface.
create policy gyms_select_active on public.gyms
for select to anon, authenticated using (is_active);

create policy gyms_update_owner on public.gyms
for update to authenticated
using (public.is_gym_owner(id)) with check (public.is_gym_owner(id));

-- profiles: own row, or a profile belonging to a member of a gym you staff.
create policy profiles_select_self on public.profiles
for select to authenticated using ((select auth.uid()) = id);

create policy profiles_select_staff on public.profiles
for select to authenticated using (
  exists (
    select 1 from public.gym_members gm
    where gm.user_id = profiles.id and public.is_gym_staff(gm.gym_id)
  )
);

create policy profiles_insert_self on public.profiles
for insert to authenticated with check ((select auth.uid()) = id);

create policy profiles_update_self on public.profiles
for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- gym_members: rows are created by create-member-profile with the service key,
-- so there is deliberately no INSERT policy.
create policy gym_members_select on public.gym_members
for select to authenticated
using ((select auth.uid()) = user_id or public.is_gym_staff(gym_id));

create policy gym_members_update_staff on public.gym_members
for update to authenticated
using (public.is_gym_staff(gym_id)) with check (public.is_gym_staff(gym_id));

-- gym_staff: a staff member sees the roster of their own gym. Only an owner can
-- change it, and only within a gym they already own — the `with check` stops an
-- owner from moving a row to another gym_id.
create policy gym_staff_select on public.gym_staff
for select to authenticated
using ((select auth.uid()) = user_id or public.is_gym_staff(gym_id));

create policy gym_staff_update_owner on public.gym_staff
for update to authenticated
using (public.is_gym_owner(gym_id)) with check (public.is_gym_owner(gym_id));
