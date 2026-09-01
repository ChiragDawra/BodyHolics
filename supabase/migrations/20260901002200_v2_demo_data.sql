-- Demo data for the v2 surfaces: payments (revenue), phones and emergency
-- contacts (members table), and check-outs (live occupancy).
--
-- Still scoped to the @demo.bodyholics accounts, so the single delete in
-- DECISIONS.md D27 removes all of it.

do $$
declare
  v_gym_id uuid;
  r        record;
  i        integer := 0;
  v_month  integer;
  v_amount integer;
begin
  select id into v_gym_id from public.gyms where slug = 'bodyholics';
  if v_gym_id is null then return; end if;

  -- Phones and emergency contacts. The members table shows a phone column and
  -- the detail panel shows an emergency contact; both were null until now.
  for r in
    select p.id, row_number() over (order by u.email) as n
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.gym_id = v_gym_id and u.email like '%@demo.bodyholics'
  loop
    update public.profiles
       set phone = '9' || lpad(((r.n * 7654321) % 1000000000)::text, 9, '0'),
           -- Deliberately not everyone: the design shows "Not given" for some.
           emergency_contact = case
             when r.n % 3 = 0
               then 'Family contact · +91 ' || lpad(((r.n * 12345) % 100000)::text, 5, '0')
                    || ' ' || lpad(((r.n * 54321) % 100000)::text, 5, '0')
             else null
           end
     where id = r.id;
  end loop;

  -- Payments: one per membership, six months of history. Most collected, a
  -- few left pending so "Outstanding" and "Pending dues" are not zero.
  for r in
    select m.id as membership_id, m.profile_id, m.plan_id, m.start_date,
           coalesce(pl.price_paise, 120000) as price_paise,
           row_number() over (order by m.start_date) as n
    from public.memberships m
    left join public.plans pl on pl.id = m.plan_id
    join public.profiles p on p.id = m.profile_id
    join auth.users u on u.id = p.id
    where m.gym_id = v_gym_id and u.email like '%@demo.bodyholics'
  loop
    insert into public.payments (
      gym_id, profile_id, plan_id, membership_id,
      amount_paise, method, status, paid_at
    )
    values (
      v_gym_id, r.profile_id, r.plan_id, r.membership_id,
      r.price_paise,
      (array['cash','cash','cash','upi','upi','card'])[1 + (r.n % 6)]::public.payment_method,
      case when r.n % 9 = 0 then 'pending' else 'collected' end::public.payment_status,
      (r.start_date + make_interval(hours => (9 + (r.n % 10))::int))::timestamptz
    );
  end loop;

  -- Six months of earlier revenue so the trend line has a shape to draw.
  for v_month in 1 .. 5 loop
    for r in
      select p.id as profile_id, row_number() over (order by u.email) as n
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.gym_id = v_gym_id and u.email like '%@demo.bodyholics'
      limit (8 + v_month * 2)
    loop
      v_amount := (array[120000, 330000, 600000])[1 + (r.n % 3)];
      insert into public.payments (
        gym_id, profile_id, amount_paise, method, status, paid_at
      )
      values (
        v_gym_id, r.profile_id, v_amount,
        (array['cash','cash','upi'])[1 + (r.n % 3)]::public.payment_method,
        'collected',
        (date_trunc('month', now()) - make_interval(months => v_month)
          + make_interval(days => (r.n % 26)::int, hours => 11))::timestamptz
      );
    end loop;
  end loop;

  -- Check most of today's arrivals back out, leaving a handful still inside
  -- so "in the gym right now" is a real number rather than everyone.
  for r in
    select a.id, row_number() over (order by a.checked_in_at) as n
    from public.attendance a
    where a.gym_id = v_gym_id
      and a.checked_in_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata')
                              at time zone 'Asia/Kolkata')
  loop
    if r.n % 3 <> 0 then
      update public.attendance
         set checked_out_at = checked_in_at + make_interval(mins => (55 + (r.n * 7) % 40)::int)
       where id = r.id
         and checked_in_at + make_interval(mins => (55 + (r.n * 7) % 40)::int) < now();
    end if;
  end loop;

  -- Close out every historical visit; only today's can still be open.
  update public.attendance
     set checked_out_at = checked_in_at + interval '70 minutes'
   where gym_id = v_gym_id
     and checked_out_at is null
     and checked_in_at < (date_trunc('day', now() at time zone 'Asia/Kolkata')
                          at time zone 'Asia/Kolkata');
end $$;
