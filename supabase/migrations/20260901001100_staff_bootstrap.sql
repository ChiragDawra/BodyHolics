-- Nobody can reach /admin until a row exists in `staff`, and nobody can create
-- that row without already being staff. This breaks the deadlock: the first
-- real person to sign in with Google becomes the owner.
--
-- "Real" excludes the seeded @demo.bodyholics accounts, which are data rather
-- than people and must never be granted anything.
--
-- Once one owner exists this never fires again, so it is safe to leave in
-- place. Removing it after the pitch is one `drop function`.

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

  -- First real sign-in claims ownership of the gym.
  if new.email is not null
     and new.email not like '%@demo.bodyholics'
     and not exists (select 1 from public.staff where gym_id = v_gym_id)
  then
    insert into public.staff (gym_id, user_id, role)
    values (v_gym_id, new.id, 'owner')
    on conflict (gym_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

-- The seeded "today" check-ins were written in UTC and some landed on the
-- wrong side of the Asia/Kolkata day boundary, so the /check counter read 1
-- instead of 6. Re-anchor them to this morning, gym time.
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
    (date_trunc('day', now() at time zone 'Asia/Kolkata')
      + make_interval(hours => (7 + (row_number() over (order by u.email)) * 2)::int))
      at time zone 'Asia/Kolkata',
    'manual'
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.gym_id = v_gym_id
    and u.email like '%@demo.bodyholics'
  limit 6;
end $$;
