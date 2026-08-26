-- docs/05 §3 — what is sold, what was bought, and what was paid.
-- The activation function that ties the three together lives in
-- 20260826090600_create_privileged_functions.sql, because it writes to
-- audit_logs and notifications, which do not exist yet.

-- ---------------------------------------------------------- membership_plans

create table public.membership_plans (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  name          text not null check (length(trim(name)) between 2 and 80),
  description   text,
  price_paise   bigint not null check (price_paise >= 0),
  duration_days int    not null check (duration_days between 1 and 3650),
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index membership_plans_gym_active_idx
  on public.membership_plans (gym_id, is_active, sort_order);

create trigger set_updated_at before update on public.membership_plans
  for each row execute function public.tg_set_updated_at();

-- docs/05 §3: a sold plan is a historical record. Repricing one in place would
-- silently restate past revenue and change what a renewal is worth, so the way
-- to change a price is is_active = false plus a new row. The doc leaves this to
-- convention and says to add a trigger if it becomes a problem; it is a
-- one-statement guard on money, so it goes in from the start.
create or replace function public.tg_plan_terms_immutable_once_sold()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.price_paise, new.duration_days) is distinct from (old.price_paise, old.duration_days)
     and exists (select 1 from public.memberships m where m.plan_id = old.id) then
    raise exception 'PLAN_ALREADY_SOLD';
  end if;
  return new;
end $$;

create trigger plan_terms_immutable_once_sold before update on public.membership_plans
  for each row execute function public.tg_plan_terms_immutable_once_sold();

-- ---------------------------------------------------------------- memberships

create table public.memberships (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  plan_id       uuid not null references public.membership_plans(id),
  status        text not null default 'PENDING_PAYMENT'
                  check (status in ('PENDING_PAYMENT','ACTIVE','EXPIRED','CANCELLED')),
  price_paise   bigint not null check (price_paise >= 0),  -- snapshot at purchase
  start_at      timestamptz,
  end_at        timestamptz,
  activated_at  timestamptz,
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint membership_period_valid
    check (end_at is null or start_at is null or end_at > start_at),
  constraint membership_active_has_period
    check (status <> 'ACTIVE'
           or (start_at is not null and end_at is not null and activated_at is not null))
);

-- D-004: at most one pending membership per member per gym.
create unique index memberships_one_pending_idx
  on public.memberships (gym_id, user_id)
  where status = 'PENDING_PAYMENT';

create index memberships_gym_status_end_idx on public.memberships (gym_id, status, end_at);
create index memberships_user_idx           on public.memberships (user_id, status, end_at desc);
create index memberships_expiring_idx       on public.memberships (gym_id, end_at)
  where status = 'ACTIVE';

create trigger set_updated_at before update on public.memberships
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------- payments

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  gym_id              uuid not null references public.gyms(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  membership_id       uuid not null references public.memberships(id) on delete restrict,
  amount_paise        bigint not null check (amount_paise >= 0),
  currency            text not null default 'INR' check (currency = 'INR'),
  method              text not null
                        check (method in ('ONLINE','UPI_COUNTER','CASH_COUNTER','OTHER')),
  status              text not null default 'PENDING'
                        check (status in ('PENDING','AUTHORIZED','PAID','FAILED','CANCELLED','REFUNDED')),
  provider            text check (provider in ('RAZORPAY','COUNTER')),
  provider_order_id   text unique,
  provider_payment_id text unique,
  idempotency_key     text unique,
  confirmed_by        uuid references public.profiles(id),
  paid_at             timestamptz,
  failure_reason      text,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint payment_paid_has_timestamp
    check (status <> 'PAID' or paid_at is not null),
  constraint counter_payment_has_confirmer
    check (method not in ('UPI_COUNTER','CASH_COUNTER')
           or status <> 'PAID'
           or confirmed_by is not null)
);

create index payments_gym_status_idx on public.payments (gym_id, status, created_at desc);
create index payments_membership_idx on public.payments (membership_id);
create index payments_user_idx       on public.payments (user_id, created_at desc);
create index payments_revenue_idx    on public.payments (gym_id, paid_at) where status = 'PAID';

create trigger set_updated_at before update on public.payments
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------- RLS

alter table public.membership_plans enable row level security;
alter table public.memberships      enable row level security;
alter table public.payments         enable row level security;

-- A member sees what is on sale. Staff also see retired plans, because a plan
-- that was withdrawn still appears against historical memberships.
create policy membership_plans_select_member on public.membership_plans
for select to authenticated
using (is_active and public.is_gym_member(gym_id));

create policy membership_plans_select_staff on public.membership_plans
for select to authenticated
using (public.is_gym_staff(gym_id));

create policy membership_plans_insert_staff on public.membership_plans
for insert to authenticated with check (public.is_gym_staff(gym_id));

create policy membership_plans_update_staff on public.membership_plans
for update to authenticated
using (public.is_gym_staff(gym_id)) with check (public.is_gym_staff(gym_id));

-- memberships and payments are read-only to every client. There is no INSERT,
-- UPDATE or DELETE policy on either, by design: a membership becomes ACTIVE
-- only via a verified webhook or a staff counter-confirmation, both of which
-- run with the service key inside an Edge Function (CLAUDE.md rule 1).
create policy memberships_select on public.memberships
for select to authenticated
using ((select auth.uid()) = user_id or public.is_gym_staff(gym_id));

create policy payments_select on public.payments
for select to authenticated
using ((select auth.uid()) = user_id or public.is_gym_staff(gym_id));
