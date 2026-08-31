-- Secrets that must never reach a browser: the /check PIN hash.
--
-- RLS is enabled and NO policy is created. That is intentional and is the
-- whole security model of this table: with zero policies, every role except
-- the table owner is denied. Only SECURITY DEFINER functions can read it.
-- Do not add a policy here.

create table public.gym_secrets (
  gym_id          uuid primary key references public.gyms (id) on delete cascade,
  check_pin_hash  text not null,
  updated_at      timestamptz not null default now()
);

alter table public.gym_secrets enable row level security;

revoke all on public.gym_secrets from anon, authenticated;
