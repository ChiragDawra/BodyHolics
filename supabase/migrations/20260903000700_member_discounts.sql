-- Phase 13. A price that is lower for one member than the list price.

create type public.discount_type as enum ('percent', 'flat');

create table public.member_discounts (
  id            uuid primary key default gen_random_uuid(),
  -- Denormalised from profiles so the RLS policies below can call is_staff()
  -- directly. The alternative is a policy whose USING clause selects from
  -- another table, which is exactly the shape that produced the infinite
  -- recursion in D72; every other table here carries gym_id for the same
  -- reason.
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  member_id     uuid not null references public.profiles (id) on delete cascade,
  discount_type public.discount_type not null,
  /*
   * Percentage points when `discount_type = 'percent'`, paise when it is
   * 'flat'. One column with two units is a compromise; the alternative is two
   * columns of which one is always null. The CHECK below is what keeps it
   * honest, and it also enforces the agreed ranges: up to 40% off, or between
   * ₹100 and ₹500 off.
   */
  value         integer not null,
  starts_at     timestamptz not null default now(),
  -- Null means it never expires.
  expires_at    timestamptz,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),

  constraint member_discounts_value_in_range check (
    (discount_type = 'percent' and value between 1 and 40)
    or (discount_type = 'flat' and value between 10000 and 50000)
  ),
  constraint member_discounts_expiry_after_start check (
    expires_at is null or expires_at > starts_at
  )
);

create index member_discounts_member_idx
  on public.member_discounts (member_id, created_at desc);

alter table public.member_discounts enable row level security;

-- A member may see their own discount. They cannot create one.
create policy "members read their own discounts"
  on public.member_discounts for select
  to authenticated
  using (member_id = auth.uid());

create policy "staff manage discounts at their gym"
  on public.member_discounts for all
  to authenticated
  using (public.is_staff(gym_id))
  with check (public.is_staff(gym_id));


/**
 * What a given member is actually charged for a given list price.
 *
 * Replaces the identity function introduced in Phase 12. Every price the
 * member is shown and every amount they are charged already goes through
 * here, so nothing else has to change: the plan list on the member's phone,
 * the admin's dropdown, and `record_cash_payment` all pick this up at once.
 *
 * SECURITY DEFINER because the member's own plan list calls it, and a member
 * may read their own discount but the pricing must not depend on who is
 * asking. Clamped at zero so a flat discount larger than the price cannot
 * produce a negative charge.
 *
 * If more than one discount is live, the most recently created one wins —
 * stacking two discounts is not a thing anyone at a desk means to do.
 */
create or replace function public.discounted_price(
  p_profile_id uuid,
  p_price_paise integer
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select greatest(0, coalesce((
    select case d.discount_type
             when 'percent' then p_price_paise - (p_price_paise * d.value / 100)
             when 'flat'    then p_price_paise - d.value
           end
    from public.member_discounts d
    where d.member_id = p_profile_id
      and d.starts_at <= now()
      and (d.expires_at is null or d.expires_at > now())
    order by d.created_at desc
    limit 1
  ), p_price_paise));
$$;

grant execute on function public.discounted_price(uuid, integer) to authenticated;
