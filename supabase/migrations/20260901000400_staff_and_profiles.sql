-- Staff gate the admin dashboard. Profiles are the member records.

create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.staff_role not null default 'staff',
  created_at  timestamptz not null default now(),
  unique (gym_id, user_id)
);

create index staff_user_id_idx on public.staff (user_id);

-- SECURITY DEFINER so that policies calling it do not re-enter staff's own
-- RLS and recurse. search_path is pinned so it cannot be shadowed.
create or replace function public.is_staff(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff s
    where s.gym_id = p_gym_id
      and s.user_id = auth.uid()
  );
$$;

-- Any-gym variant, for the admin login check before a gym is chosen.
create or replace function public.is_staff_anywhere()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.staff s where s.user_id = auth.uid()
  );
$$;

grant execute on function public.is_staff(uuid) to authenticated;
grant execute on function public.is_staff_anywhere() to authenticated;

alter table public.staff enable row level security;

create policy "staff can read their own gym's staff list"
  on public.staff for select
  to authenticated
  using (public.is_staff(gym_id));

create policy "owners manage staff"
  on public.staff for all
  to authenticated
  using (
    exists (
      select 1 from public.staff s
      where s.gym_id = staff.gym_id
        and s.user_id = auth.uid()
        and s.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.staff s
      where s.gym_id = staff.gym_id
        and s.user_id = auth.uid()
        and s.role = 'owner'
    )
  );


-- Members. One row per signed-in Google account.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  full_name   text,
  email       text,
  avatar_url  text,
  phone       text,
  created_at  timestamptz not null default now()
);

create index profiles_gym_id_idx on public.profiles (gym_id);
create index profiles_full_name_idx on public.profiles (lower(full_name));

alter table public.profiles enable row level security;

create policy "members read their own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "staff read every profile at their gym"
  on public.profiles for select
  to authenticated
  using (public.is_staff(gym_id));

create policy "members update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "members insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "staff update profiles at their gym"
  on public.profiles for update
  to authenticated
  using (public.is_staff(gym_id))
  with check (public.is_staff(gym_id));


-- First Google sign-in creates the profile row. This build has one gym, so
-- new members are attached to the oldest gym row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid;
begin
  select id into v_gym_id from public.gyms order by created_at limit 1;

  if v_gym_id is null then
    return new;
  end if;

  insert into public.profiles (id, gym_id, full_name, email, avatar_url)
  values (
    new.id,
    v_gym_id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
