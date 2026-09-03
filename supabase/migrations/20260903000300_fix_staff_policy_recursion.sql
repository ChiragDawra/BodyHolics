-- `owners manage staff` was a FOR ALL policy on public.staff whose USING
-- clause selected from public.staff. Evaluating the policy required reading
-- the table, which required evaluating the policy:
--
--   ERROR: 42P17: infinite recursion detected in policy for relation "staff"
--
-- Because it is FOR ALL it also governs SELECT, so *every* read of the staff
-- table failed, not just an owner's writes. `getStaff()` destructures only
-- `data` and ignores `error`, so the failure surfaced as an empty list: the
-- Staff panel in Gym settings has been showing nothing at all.
--
-- `owners manage staff codes` has the same shape. It is a policy on
-- staff_codes rather than on staff, so it is not itself recursive, but it
-- reads public.staff to decide — which re-entered the broken policy above and
-- failed with it. That is why the staff code never rendered either.
--
-- The existing is_staff() avoids this by being SECURITY DEFINER, which does
-- not re-enter the table's own RLS. The owner check needs the same treatment.

create or replace function public.is_gym_owner(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff s
    where s.gym_id = p_gym_id
      and s.user_id = auth.uid()
      and s.role = 'owner'
  );
$$;

grant execute on function public.is_gym_owner(uuid) to authenticated;

drop policy if exists "owners manage staff" on public.staff;

create policy "owners manage staff"
  on public.staff for all
  to authenticated
  using (public.is_gym_owner(gym_id))
  with check (public.is_gym_owner(gym_id));

drop policy if exists "owners manage staff codes" on public.staff_codes;

create policy "owners manage staff codes"
  on public.staff_codes for all
  to authenticated
  using (public.is_gym_owner(gym_id))
  with check (public.is_gym_owner(gym_id));
