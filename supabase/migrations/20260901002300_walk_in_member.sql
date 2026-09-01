-- "Add member manually" on the admin Members page.
--
-- profiles.id references auth.users, so a member who joined at the desk and
-- has no phone still needs an auth row. This creates one with no password and
-- no identity, exactly like the demo seed: the account cannot be signed in to
-- and exists only so the desk can check them in and bill them.
--
-- If that person later signs in with Google they get a separate profile.
-- Merging the two is a real feature and is deliberately not attempted here.
--
-- SECURITY DEFINER because inserting into auth.users is privileged. The
-- is_staff() check at the top is what makes that safe: a member calling this
-- gets 28000 and nothing happens.
create or replace function public.add_walk_in_member(
  p_gym_id    uuid,
  p_full_name text,
  p_phone     text,
  p_email     text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email   text;
  v_digits  text;
begin
  if not public.is_staff(p_gym_id) then
    raise exception 'not_staff' using errcode = '28000';
  end if;

  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'name_required' using errcode = '22000';
  end if;

  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_digits) < 10 then
    raise exception 'phone_required' using errcode = '22000';
  end if;

  -- auth.users.email is unique and not null in practice, so a walk-in without
  -- an address gets a placeholder derived from their number. The @walkin.
  -- suffix makes these rows as identifiable as the demo ones.
  v_email := coalesce(
    nullif(lower(trim(p_email)), ''),
    v_digits || '@walkin.bodyholics'
  );

  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'email_taken' using errcode = '23505';
  end if;

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
    jsonb_build_object('provider', 'walk_in', 'providers', array['walk_in']),
    jsonb_build_object('full_name', trim(p_full_name)),
    now(), now()
  );

  -- handle_new_user has already created the profile row; fill in the rest.
  -- It is also written defensively in case that trigger is ever removed.
  insert into public.profiles (id, gym_id, full_name, email, phone)
  values (v_user_id, p_gym_id, trim(p_full_name), nullif(lower(trim(p_email)), ''), v_digits)
  on conflict (id) do update
    set full_name = excluded.full_name,
        phone     = excluded.phone,
        gym_id    = excluded.gym_id;

  return v_user_id;
end;
$$;

revoke all on function public.add_walk_in_member(uuid, text, text, text) from public, anon;
grant execute on function public.add_walk_in_member(uuid, text, text, text) to authenticated;
