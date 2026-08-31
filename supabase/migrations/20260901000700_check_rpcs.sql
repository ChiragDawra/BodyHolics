-- The owner's /check screen has no Supabase session — it is gated by a PIN.
-- Rather than opening anon write policies on gyms, attendance, and alerts,
-- every /check operation goes through one of these SECURITY DEFINER functions
-- and each one re-verifies the PIN against the bcrypt hash in gym_secrets.
--
-- The client-side comparison in the PIN pad is only for instant feedback. The
-- database is what actually enforces it, and the hash never leaves the server.

create or replace function public.check_pin_valid(p_gym_slug text, p_pin text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash text;
begin
  select s.check_pin_hash
    into v_hash
  from public.gym_secrets s
  join public.gyms g on g.id = s.gym_id
  where g.slug = p_gym_slug;

  if v_hash is null or p_pin is null then
    return false;
  end if;

  return extensions.crypt(p_pin, v_hash) = v_hash;
end;
$$;

-- Raises rather than returning, so a caller can never forget to check.
create or replace function public.check_assert_pin(p_gym_slug text, p_pin text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid;
begin
  if not public.check_pin_valid(p_gym_slug, p_pin) then
    raise exception 'invalid_pin' using errcode = '28000';
  end if;

  select id into v_gym_id from public.gyms where slug = p_gym_slug;
  return v_gym_id;
end;
$$;


-- Everything the /check dashboard renders, in one round trip.
create or replace function public.check_dashboard(p_gym_slug text, p_pin text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid;
  v_result jsonb;
begin
  v_gym_id := public.check_assert_pin(p_gym_slug, p_pin);

  select jsonb_build_object(
    'gym_id', g.id,
    'gym_name', g.name,
    'crowd_level', g.crowd_level,
    'is_open_override', g.is_open_override,
    'weekly_hours', g.weekly_hours,
    'today_count', (
      select count(*)
      from public.attendance a
      where a.gym_id = g.id
        and a.checked_in_at >= date_trunc('day', now() at time zone 'Asia/Kolkata')
                               at time zone 'Asia/Kolkata'
    ),
    'active_members', (
      select count(*)
      from public.memberships m
      where m.gym_id = g.id
        and m.status = 'active'
        and m.end_date >= current_date
    ),
    'recent', coalesce((
      select jsonb_agg(r)
      from (
        select p.full_name, a.checked_in_at
        from public.attendance a
        join public.profiles p on p.id = a.profile_id
        where a.gym_id = g.id
        order by a.checked_in_at desc
        limit 5
      ) r
    ), '[]'::jsonb),
    'latest_alert', (
      select jsonb_build_object('title', al.title, 'created_at', al.created_at)
      from public.alerts al
      where al.gym_id = g.id
      order by al.created_at desc
      limit 1
    )
  )
  into v_result
  from public.gyms g
  where g.id = v_gym_id;

  return v_result;
end;
$$;


create or replace function public.check_set_crowd(
  p_gym_slug text,
  p_pin text,
  p_level public.crowd_level
)
returns public.crowd_level
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid;
begin
  v_gym_id := public.check_assert_pin(p_gym_slug, p_pin);

  update public.gyms
     set crowd_level = p_level,
         crowd_updated_at = now()
   where id = v_gym_id;

  return p_level;
end;
$$;


-- null clears the override and hands control back to weekly_hours.
create or replace function public.check_set_open(
  p_gym_slug text,
  p_pin text,
  p_open boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid;
begin
  v_gym_id := public.check_assert_pin(p_gym_slug, p_pin);

  update public.gyms
     set is_open_override = p_open
   where id = v_gym_id;

  return jsonb_build_object('is_open_override', p_open);
end;
$$;


create or replace function public.check_publish_alert(
  p_gym_slug text,
  p_pin text,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid;
  v_id uuid;
begin
  v_gym_id := public.check_assert_pin(p_gym_slug, p_pin);

  if coalesce(trim(p_title), '') = '' then
    raise exception 'empty_title' using errcode = '22000';
  end if;

  insert into public.alerts (gym_id, title, body)
  values (v_gym_id, trim(p_title), coalesce(trim(p_body), ''))
  returning id into v_id;

  return v_id;
end;
$$;


revoke all on function public.check_pin_valid(text, text) from public;
revoke all on function public.check_assert_pin(text, text) from public;

grant execute on function public.check_dashboard(text, text) to anon, authenticated;
grant execute on function public.check_set_crowd(text, text, public.crowd_level) to anon, authenticated;
grant execute on function public.check_set_open(text, text, boolean) to anon, authenticated;
grant execute on function public.check_publish_alert(text, text, text, text) to anon, authenticated;
