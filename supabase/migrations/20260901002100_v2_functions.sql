-- Functions the v2 flows need.

-- Completing the join form. Runs as SECURITY DEFINER for one reason only:
-- the staff code. A member must be able to *use* a code without being able to
-- read the staff_codes table, so the comparison happens here, server-side,
-- and the caller learns nothing except whether it worked.
--
-- Everything else it writes is the caller's own profile row, which their own
-- RLS policy already allows.
create or replace function public.complete_profile(
  p_full_name         text,
  p_phone             text,
  p_emergency_contact text,
  p_staff_code        text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_gym_id  uuid;
  v_role    public.staff_role;
  v_granted boolean := false;
begin
  if v_user_id is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'name_required' using errcode = '22000';
  end if;

  -- Digits only, so "+91 98765 43210" and "9876543210" store the same way.
  if length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 10 then
    raise exception 'phone_required' using errcode = '22000';
  end if;

  update public.profiles
     set full_name         = trim(p_full_name),
         phone             = regexp_replace(p_phone, '\D', '', 'g'),
         emergency_contact = nullif(trim(coalesce(p_emergency_contact, '')), '')
   where id = v_user_id
  returning gym_id into v_gym_id;

  if v_gym_id is null then
    raise exception 'no_profile' using errcode = '22000';
  end if;

  -- Optional staff code. A wrong code is not an error — the member simply
  -- joins as a member, which is what they wanted anyway.
  if coalesce(trim(p_staff_code), '') <> '' then
    select sc.role into v_role
    from public.staff_codes sc
    where sc.gym_id = v_gym_id
      and sc.is_active
      and upper(trim(sc.code)) = upper(trim(p_staff_code));

    if v_role is not null then
      insert into public.staff (gym_id, user_id, role)
      values (v_gym_id, v_user_id, v_role)
      on conflict (gym_id, user_id) do nothing;
      v_granted := true;
    end if;
  end if;

  return jsonb_build_object('gym_id', v_gym_id, 'staff_granted', v_granted);
end;
$$;

grant execute on function public.complete_profile(text, text, text, text) to authenticated;


-- Checks whether a staff code is valid, without revealing any code.
-- Used to light up the green "Staff" chip on the join form as the member types.
create or replace function public.staff_code_valid(p_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  select gym_id into v_gym_id from public.profiles where id = auth.uid();
  if v_gym_id is null then
    return false;
  end if;

  return exists (
    select 1 from public.staff_codes sc
    where sc.gym_id = v_gym_id
      and sc.is_active
      and upper(trim(sc.code)) = upper(trim(coalesce(p_code, '')))
  );
end;
$$;

grant execute on function public.staff_code_valid(text) to authenticated;


-- "Best time today" — buckets this gym's check-ins by weekday and hour and
-- returns the quietest hour for the weekday asked for.
--
-- This is a histogram over `attendance`, not a new table: the design doc is
-- explicit that no crowd-reporting table is needed, because the check-in log
-- already knows when the gym is busy.
--
-- Returns null when there is not enough history to say anything honest.
create or replace function public.quietest_hour(p_gym_id uuid, p_weekday integer)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with hourly as (
    select
      extract(hour from (a.checked_in_at at time zone 'Asia/Kolkata'))::int as hr,
      count(*) as visits,
      count(distinct (a.checked_in_at at time zone 'Asia/Kolkata')::date) as days
    from public.attendance a
    where a.gym_id = p_gym_id
      and extract(isodow from (a.checked_in_at at time zone 'Asia/Kolkata'))::int = p_weekday
      and a.checked_in_at > now() - interval '120 days'
    group by 1
  ),
  ranked as (
    select hr, visits, days, visits::numeric / greatest(days, 1) as avg_per_day
    from hourly
    -- Only hours the gym is plausibly open, and only hours with enough
    -- history that the average means something.
    where hr between 5 and 22 and days >= 2
  )
  select case
    when (select count(*) from ranked) < 3 then null
    else (
      select jsonb_build_object('hour', hr, 'avg_per_day', round(avg_per_day, 1))
      from ranked
      order by avg_per_day asc, hr desc
      limit 1
    )
  end;
$$;

grant execute on function public.quietest_hour(uuid, integer) to authenticated;
