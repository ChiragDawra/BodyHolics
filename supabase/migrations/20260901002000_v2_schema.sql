-- Schema the v2 design needs. Each item is called out by name in the design
-- doc's "SCHEMA THIS NEEDS THAT DOES NOT EXIST YET" panel.

-- 1. The join form collects a phone and an emergency contact. phone already
--    exists; emergency_contact does not.
alter table public.profiles
  add column if not exists emergency_contact text;

-- 2. Live occupancy — "8 in the gym right now" — is attendance rows today
--    where checked_out_at is null. Staff tap a name to check someone out.
alter table public.attendance
  add column if not exists checked_out_at timestamptz;

create index if not exists attendance_open_idx
  on public.attendance (gym_id, checked_in_at desc)
  where checked_out_at is null;


-- 3. payments. Every revenue figure on the admin dashboard reads from here.
--    plans.price_paise alone cannot express collected vs. pending, because a
--    membership can exist without the money having arrived.
create type public.payment_method as enum ('cash', 'upi', 'card', 'other');
create type public.payment_status as enum ('collected', 'pending', 'refunded');

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  plan_id       uuid references public.plans (id) on delete set null,
  membership_id uuid references public.memberships (id) on delete set null,
  amount_paise  integer not null check (amount_paise >= 0),
  method        public.payment_method not null default 'cash',
  status        public.payment_status not null default 'collected',
  paid_at       timestamptz not null default now(),
  recorded_by   uuid references auth.users (id) on delete set null,
  note          text,
  created_at    timestamptz not null default now()
);

create index payments_gym_paid_idx on public.payments (gym_id, paid_at desc);
create index payments_profile_idx on public.payments (profile_id, paid_at desc);

alter table public.payments enable row level security;

create policy "members read their own payments"
  on public.payments for select
  to authenticated
  using (profile_id = auth.uid());

create policy "staff read payments at their gym"
  on public.payments for select
  to authenticated
  using (public.is_staff(gym_id));

create policy "staff manage payments"
  on public.payments for all
  to authenticated
  using (public.is_staff(gym_id))
  with check (public.is_staff(gym_id));


-- 4. staff_codes. The optional code on the join form grants staff access.
--    Until now staff rows were inserted by hand.
--
--    The code itself is never readable by a browser: no select policy exists
--    for a plain member, and the only way to use a code is the SECURITY
--    DEFINER function added in the next migration, which compares and then
--    either grants or refuses. A member cannot enumerate valid codes.
create table public.staff_codes (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms (id) on delete cascade,
  code       text not null,
  role       public.staff_role not null default 'staff',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (gym_id, code)
);

alter table public.staff_codes enable row level security;

create policy "staff read staff codes at their gym"
  on public.staff_codes for select
  to authenticated
  using (public.is_staff(gym_id));

create policy "owners manage staff codes"
  on public.staff_codes for all
  to authenticated
  using (
    exists (
      select 1 from public.staff s
      where s.gym_id = staff_codes.gym_id
        and s.user_id = auth.uid()
        and s.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.staff s
      where s.gym_id = staff_codes.gym_id
        and s.user_id = auth.uid()
        and s.role = 'owner'
    )
  );

insert into public.staff_codes (gym_id, code, role)
select g.id, 'BHSTAFF2024', 'staff'
from public.gyms g
where g.slug = 'bodyholics'
on conflict (gym_id, code) do nothing;
