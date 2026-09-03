-- Phase 10. A member checks themselves in by opening the URL on the code at
-- the gym door.
--
-- Deliberately an RPC rather than an INSERT policy on `attendance`. A policy
-- broad enough to let a member write their own row is also broad enough to
-- let them write a hundred, or backdate one; and the "don't record a second
-- visit within 30 minutes" rule has to hold under two scans a second apart,
-- which a policy cannot express at all. This function is the only way a
-- member can write attendance, and it decides both questions itself.
--
-- The QR carries no identity and no token — it is the same URL on every wall
-- and can be photographed freely. Who is checking in comes from the session
-- cookie, so a stolen photo of the code lets you check *yourself* in, which
-- is not an attack, it is the feature.

create or replace function public.check_in_self()
returns table (created boolean, at_time timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_gym uuid;
  v_existing timestamptz;
  v_new timestamptz;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select p.gym_id into v_gym from public.profiles p where p.id = v_uid;

  if v_gym is null then
    raise exception 'no profile for this account' using errcode = 'P0002';
  end if;

  -- Serialises concurrent scans by the same member, so the check below and
  -- the insert under it cannot interleave with another transaction doing the
  -- same thing. Held to the end of this transaction, then released.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select a.checked_in_at into v_existing
  from public.attendance a
  where a.profile_id = v_uid
    and a.checked_in_at > now() - interval '30 minutes'
  order by a.checked_in_at desc
  limit 1;

  if v_existing is not null then
    return query select false, v_existing;
    return;
  end if;

  -- recorded_by stays null: it means "which staff member recorded this", and
  -- nobody did. `method = 'qr'` is what says the member did it themselves.
  insert into public.attendance (gym_id, profile_id, method)
  values (v_gym, v_uid, 'qr')
  returning attendance.checked_in_at into v_new;

  return query select true, v_new;
end;
$$;

grant execute on function public.check_in_self() to authenticated;
