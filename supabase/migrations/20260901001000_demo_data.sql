-- Demo members, memberships, and attendance so the owner sees a working gym
-- during the pitch rather than a set of zeroes.
--
-- These rows are clearly marked: every demo account uses the @demo.bodyholics
-- email domain, so `delete from auth.users where email like '%@demo.bodyholics'`
-- removes all of it and the cascades clean up everything downstream.
--
-- Real members arrive through Google sign-in and the handle_new_user trigger.
-- Nothing here interferes with that path.

do $$
declare
  v_gym_id      uuid;
  v_monthly     uuid;
  v_quarterly   uuid;
  v_annual      uuid;
  v_user_id     uuid;
  v_name        text;
  v_email       text;
  v_plan        uuid;
  v_start       date;
  v_days        integer;
  v_status      public.membership_status;
  v_visit_count integer;
  i             integer;
  j             integer;

  names text[] := array[
    'Arjun Mehta', 'Priya Nair', 'Rohit Sharma', 'Sneha Iyer',
    'Vikram Singh', 'Ananya Desai', 'Karan Patel', 'Meera Joshi',
    'Aditya Rao', 'Nisha Kapoor', 'Sameer Khan', 'Divya Reddy',
    'Harsh Gupta', 'Pooja Bhatt', 'Nikhil Verma', 'Ritu Malhotra',
    'Siddharth Bose', 'Kavya Menon', 'Manish Agarwal', 'Tanvi Shah'
  ];
begin
  select id into v_gym_id from public.gyms where slug = 'bodyholics';
  if v_gym_id is null then
    raise notice 'no gym, skipping demo data';
    return;
  end if;

  -- Already seeded? Do nothing.
  if exists (select 1 from public.profiles p
             join auth.users u on u.id = p.id
             where u.email like '%@demo.bodyholics') then
    raise notice 'demo data already present, skipping';
    return;
  end if;

  select id into v_monthly   from public.plans where gym_id = v_gym_id and name = 'Monthly';
  select id into v_quarterly from public.plans where gym_id = v_gym_id and name = 'Quarterly';
  select id into v_annual    from public.plans where gym_id = v_gym_id and name = 'Annual';

  for i in 1 .. array_length(names, 1) loop
    v_name  := names[i];
    v_email := lower(replace(v_name, ' ', '.')) || '@demo.bodyholics';
    v_user_id := gen_random_uuid();

    -- A minimal but valid auth.users row. No password and no identity, so
    -- these accounts cannot be signed in to — they exist only as data.
    insert into auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', v_email,
      '', now(),
      jsonb_build_object('provider', 'demo', 'providers', array['demo']),
      jsonb_build_object('full_name', v_name),
      now() - (i || ' days')::interval,
      now()
    );

    -- handle_new_user creates the profile; make sure the name landed.
    update public.profiles
       set full_name = v_name,
           created_at = now() - ((i * 9) || ' days')::interval
     where id = v_user_id;

    -- Spread members across plans and states: mostly active, a few expired.
    if i % 7 = 0 then
      v_plan := v_monthly; v_days := 30; v_start := current_date - 55; v_status := 'expired';
    elsif i % 5 = 0 then
      v_plan := v_annual; v_days := 365; v_start := current_date - 40; v_status := 'active';
    elsif i % 3 = 0 then
      v_plan := v_quarterly; v_days := 90; v_start := current_date - 20; v_status := 'active';
    else
      v_plan := v_monthly; v_days := 30; v_start := current_date - (i % 25); v_status := 'active';
    end if;

    insert into public.memberships (gym_id, profile_id, plan_id, start_date, end_date, status)
    values (v_gym_id, v_user_id, v_plan, v_start, v_start + v_days, v_status);

    -- An earlier, finished membership for some members, so the history view
    -- has more than one row to show.
    if i % 4 = 0 then
      insert into public.memberships (gym_id, profile_id, plan_id, start_date, end_date, status)
      values (v_gym_id, v_user_id, v_monthly, v_start - 35, v_start - 5, 'expired');
    end if;

    -- Attendance over the last six weeks. Expired members stopped coming.
    v_visit_count := case when v_status = 'expired' then 4 else 8 + (i % 12) end;

    for j in 1 .. v_visit_count loop
      insert into public.attendance (gym_id, profile_id, checked_in_at, method)
      values (
        v_gym_id,
        v_user_id,
        (current_date - ((j * 3 + i) % 42))
          + make_interval(hours => (6 + ((i * 5 + j * 7) % 15))::int,
                          mins  => ((i * 13 + j * 17) % 60)::int),
        'manual'
      );
    end loop;
  end loop;

  -- A handful of check-ins today so the /check screen is not empty.
  insert into public.attendance (gym_id, profile_id, checked_in_at, method)
  select v_gym_id, p.id,
         (current_date + make_interval(hours => (7 + (row_number() over ()) * 2)::int)),
         'manual'
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email like '%@demo.bodyholics'
  order by u.email
  limit 6;

  insert into public.alerts (gym_id, title, body, created_at)
  values
    (v_gym_id, 'New squat rack is in',
     'Two more racks on the far wall from Monday. No more waiting at peak hours.',
     now() - interval '2 days'),
    (v_gym_id, 'Closing at 8pm on Sunday',
     'Deep clean of the flooring. Back to normal hours from Monday.',
     now() - interval '6 hours');
end $$;
