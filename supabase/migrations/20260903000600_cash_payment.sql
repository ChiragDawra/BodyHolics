-- Phase 12. The desk takes cash and the member's countdown starts.
--
-- Two writes have to happen together or not at all: the payment row and the
-- membership it buys. Doing them as two statements from the server action
-- leaves a real failure mode where the money is recorded and the membership
-- is not, or the reverse — and the person who would notice is standing at the
-- desk having just handed over ₹1,200.

-- Who confirmed the cash, and when.
--
-- Distinct from `recorded_by` / `paid_at`, which say who typed the row in and
-- when the money changed hands. For a payment taken at the desk all four
-- coincide, and the reason to separate them is the case that does not: a
-- member saying they have paid, verified by staff afterwards. A payment with
-- no `verified_at` has not been confirmed by anyone.
alter table public.payments
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users (id) on delete set null;

-- Everything already collected was, by definition, taken at the desk by staff.
update public.payments
set verified_at = paid_at,
    verified_by = recorded_by
where status = 'collected'
  and verified_at is null;


/**
 * What a given member is actually charged for a given list price.
 *
 * A seam, deliberately introduced now rather than later: every price the
 * member sees and every amount they are charged goes through this one
 * function, so Phase 13 adds per-member discounts by replacing its body and
 * touching nothing else. Until then it is the identity function.
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
  select p_price_paise;
$$;

grant execute on function public.discounted_price(uuid, integer) to authenticated;


create or replace function public.record_cash_payment(
  p_profile_id uuid,
  p_plan_id uuid
)
returns table (membership_id uuid, starts_on date, ends_on date, amount_paise integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_staff uuid := auth.uid();
  v_gym uuid;
  v_duration int;
  v_price int;
  v_start date;
  v_end date;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_membership uuid;
begin
  select p.gym_id into v_gym from public.profiles p where p.id = p_profile_id;
  if v_gym is null then
    raise exception 'no such member' using errcode = 'P0002';
  end if;

  -- SECURITY DEFINER bypasses RLS, so the staff check has to be explicit.
  if not public.is_staff(v_gym) then
    raise exception 'not staff at this gym' using errcode = '42501';
  end if;

  select pl.duration_days, pl.price_paise into v_duration, v_price
  from public.plans pl
  where pl.id = p_plan_id and pl.gym_id = v_gym;

  if v_duration is null then
    raise exception 'no such plan' using errcode = 'P0002';
  end if;

  -- The price is read from the plan here rather than passed in, so nothing a
  -- browser sends can decide what a member is charged. Phase 13 applies the
  -- member's discount at this same point, for the same reason.
  v_price := public.discounted_price(p_profile_id, v_price);

  /*
   * Renewing early must not throw away the days already paid for. If the
   * member still has a membership running, the new one starts the day after
   * that one ends; otherwise it starts today.
   */
  select max(m.end_date) into v_start
  from public.memberships m
  where m.profile_id = p_profile_id
    and m.status = 'active'
    and m.end_date >= v_today;

  v_start := coalesce(v_start + 1, v_today);
  v_end := v_start + v_duration;

  insert into public.memberships (gym_id, profile_id, plan_id, start_date, end_date, status)
  values (v_gym, p_profile_id, p_plan_id, v_start, v_end, 'active')
  returning id into v_membership;

  insert into public.payments (
    gym_id, profile_id, plan_id, membership_id, amount_paise,
    method, status, paid_at, recorded_by, verified_at, verified_by
  )
  values (
    v_gym, p_profile_id, p_plan_id, v_membership, v_price,
    'cash', 'collected', now(), v_staff, now(), v_staff
  );

  return query select v_membership, v_start, v_end, v_price;
end;
$$;

grant execute on function public.record_cash_payment(uuid, uuid) to authenticated;

-- Memberships drive the member's countdown, which has to appear the moment
-- the desk takes the money.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'memberships'
  ) then
    alter publication supabase_realtime add table public.memberships;
  end if;
end
$$;
