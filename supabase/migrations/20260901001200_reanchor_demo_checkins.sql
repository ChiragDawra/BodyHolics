-- Today's demo check-ins were pinned to fixed morning hours, so running the
-- app before that hour showed timestamps in the future and every row read
-- "just now". Spread them backwards from the current moment instead, which is
-- correct whatever time of day the demo runs.

do $$
declare
  v_gym_id uuid;
begin
  select id into v_gym_id from public.gyms where slug = 'bodyholics';
  if v_gym_id is null then return; end if;

  delete from public.attendance
  where gym_id = v_gym_id
    and checked_in_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata')
                          at time zone 'Asia/Kolkata');

  insert into public.attendance (gym_id, profile_id, checked_in_at, method)
  select
    v_gym_id,
    p.id,
    greatest(
      now() - make_interval(mins => (row_number() over (order by u.email) * 37)::int),
      (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')
    ),
    'manual'
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.gym_id = v_gym_id
    and u.email like '%@demo.bodyholics'
  limit 6;
end $$;
