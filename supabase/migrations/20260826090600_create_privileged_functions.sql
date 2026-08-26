-- docs/05 §7 and the privileged routines that cross table boundaries. Everything
-- here runs with the definer's rights, so every one of them either checks the
-- caller itself or is revoked from every client-reachable role.

-- ------------------------------------------------------- v_current_memberships
-- The single definition of "valid right now" (D-011). Use this everywhere.
-- security_invoker = true is mandatory: without it the view runs as its owner
-- and silently bypasses RLS.

create view public.v_current_memberships
with (security_invoker = true) as
select m.*,
       (m.end_at <= now() + make_interval(days => g.expiry_warning_days)) as is_expiring,
       greatest(0, ceil(extract(epoch from (m.end_at - now())) / 86400))::int as days_remaining
from public.memberships m
join public.gyms g on g.id = m.gym_id
where m.status = 'ACTIVE' and m.end_at > now();

grant select on public.v_current_memberships to authenticated;

-- ---------------------------------------------------------------- activation
-- docs/09 §2. The only path from PENDING_PAYMENT to ACTIVE. Called by the
-- Razorpay webhook handler and by confirm-counter-payment, both with the
-- service key; never reachable from a client (CLAUDE.md rule 1).

create or replace function public.activate_membership_for_payment(p_payment_id uuid)
returns public.memberships
language plpgsql security definer set search_path = public as $$
declare
  v_payment    public.payments;
  v_membership public.memberships;
  v_plan       public.membership_plans;
  v_start      timestamptz;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_payment.status <> 'PAID' then raise exception 'PAYMENT_NOT_PAID'; end if;

  select * into v_membership from public.memberships
    where id = v_payment.membership_id for update;

  if v_membership.status = 'ACTIVE' then          -- idempotent replay
    return v_membership;
  end if;
  if v_membership.status <> 'PENDING_PAYMENT' then
    raise exception 'INVALID_MEMBERSHIP_TRANSITION';
  end if;

  select * into v_plan from public.membership_plans where id = v_membership.plan_id;

  -- D-004: stack onto any currently valid membership rather than overwriting it.
  select coalesce(max(end_at), now()) into v_start
  from public.memberships
  where gym_id  = v_membership.gym_id
    and user_id = v_membership.user_id
    and status  = 'ACTIVE'
    and end_at  > now();

  update public.memberships
     set status       = 'ACTIVE',
         start_at     = v_start,
         end_at       = v_start + make_interval(days => v_plan.duration_days),
         activated_at = now()
   where id = v_membership.id
   returning * into v_membership;

  insert into public.audit_logs (gym_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_membership.gym_id, v_payment.confirmed_by, 'MEMBERSHIP_ACTIVATED',
          'membership', v_membership.id,
          jsonb_build_object('payment_id', v_payment.id, 'method', v_payment.method));

  insert into public.notifications (gym_id, user_id, source_type, source_id, title, body, category)
  values (v_membership.gym_id, v_membership.user_id, 'MEMBERSHIP', v_membership.id,
          'Membership activated',
          'Your membership is active until ' || to_char(v_membership.end_at, 'DD Mon YYYY') || '.',
          'MEMBERSHIP');

  return v_membership;
end $$;

revoke execute on function public.activate_membership_for_payment(uuid)
  from public, anon, authenticated;
grant  execute on function public.activate_membership_for_payment(uuid) to service_role;

-- ------------------------------------------------------- audience resolution
-- docs/09 §5. Audience is a *rule*, evaluated server-side at publish time — the
-- client never sends a recipient list for the non-SELECTED types. Both the
-- publish-broadcast Edge Function and the cron job below call this, so the rule
-- has exactly one implementation.

create or replace function public.resolve_broadcast_audience(p_gym_id uuid, p_audience jsonb)
returns table (user_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v_type text := p_audience->>'type';
  v_ids  uuid[];
begin
  if v_type = 'ALL_MEMBERS' then
    return query
      select gm.user_id from public.gym_members gm
      where gm.gym_id = p_gym_id and gm.status = 'ACTIVE';

  elsif v_type = 'ACTIVE_MEMBERS' then
    return query
      select distinct gm.user_id from public.gym_members gm
      where gm.gym_id = p_gym_id and gm.status = 'ACTIVE'
        and exists (
          select 1 from public.v_current_memberships cm
          where cm.gym_id = p_gym_id and cm.user_id = gm.user_id
        );

  elsif v_type = 'EXPIRING_MEMBERS' then
    return query
      select distinct gm.user_id from public.gym_members gm
      where gm.gym_id = p_gym_id and gm.status = 'ACTIVE'
        and exists (
          select 1 from public.v_current_memberships cm
          where cm.gym_id = p_gym_id and cm.user_id = gm.user_id and cm.is_expiring
        );

  elsif v_type = 'INACTIVE_MEMBERS' then
    return query
      select gm.user_id from public.gym_members gm
      where gm.gym_id = p_gym_id and gm.status = 'ACTIVE'
        and not exists (
          select 1 from public.v_current_memberships cm
          where cm.gym_id = p_gym_id and cm.user_id = gm.user_id
        );

  elsif v_type = 'SELECTED_MEMBERS' then
    select array_agg(value::uuid) into v_ids
    from jsonb_array_elements_text(coalesce(p_audience->'userIds', '[]'::jsonb));

    if v_ids is null or array_length(v_ids, 1) is null then
      return;
    end if;

    -- Every id is verified to be an active member of *this* gym. One foreign id
    -- fails the whole call rather than being quietly dropped, so a staff account
    -- cannot use a broadcast to probe which user ids exist elsewhere.
    if exists (
      select 1 from unnest(v_ids) as requested(id)
      where not exists (
        select 1 from public.gym_members gm
        where gm.gym_id = p_gym_id and gm.user_id = requested.id and gm.status = 'ACTIVE'
      )
    ) then
      raise exception 'CROSS_TENANT_ACCESS';
    end if;

    return query select distinct u.id from unnest(v_ids) as u(id);

  else
    raise exception 'VALIDATION_FAILED';
  end if;
end $$;

revoke execute on function public.resolve_broadcast_audience(uuid, jsonb)
  from public, anon, authenticated;
grant  execute on function public.resolve_broadcast_audience(uuid, jsonb) to service_role;

-- ------------------------------------------------------------ publish helpers
-- docs/09 §5: publishing is the only moment recipients are resolved, and the
-- recipients plus their notifications are written in one transaction.

create or replace function public.publish_broadcast(p_broadcast_id uuid)
returns public.broadcasts
language plpgsql security definer set search_path = public as $$
declare
  v_broadcast public.broadcasts;
  v_count     int;
begin
  select * into v_broadcast from public.broadcasts where id = p_broadcast_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if v_broadcast.status = 'PUBLISHED' then        -- idempotent replay
    return v_broadcast;
  end if;
  if v_broadcast.status not in ('DRAFT','SCHEDULED') then
    raise exception 'INVALID_BROADCAST_TRANSITION';
  end if;

  insert into public.broadcast_recipients (broadcast_id, user_id, gym_id, delivered_at)
  select v_broadcast.id, r.user_id, v_broadcast.gym_id, now()
  from public.resolve_broadcast_audience(v_broadcast.gym_id, v_broadcast.audience) r
  on conflict (broadcast_id, user_id) do nothing;

  -- Counted from the table rather than from the INSERT, so a row skipped by
  -- ON CONFLICT still counts as a recipient of this broadcast.
  select count(*)::int into v_count
  from public.broadcast_recipients where broadcast_id = v_broadcast.id;

  if v_count = 0 then
    raise exception 'BROADCAST_EMPTY_AUDIENCE';
  end if;

  insert into public.notifications (gym_id, user_id, source_type, source_id, title, body, category)
  select v_broadcast.gym_id, br.user_id, 'BROADCAST', v_broadcast.id,
         v_broadcast.title, v_broadcast.body, v_broadcast.category
  from public.broadcast_recipients br
  where br.broadcast_id = v_broadcast.id;

  update public.broadcasts
     set status = 'PUBLISHED', published_at = now(), recipient_count = v_count
   where id = v_broadcast.id
   returning * into v_broadcast;

  insert into public.audit_logs (gym_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_broadcast.gym_id, v_broadcast.created_by, 'BROADCAST_PUBLISHED',
          'broadcast', v_broadcast.id, jsonb_build_object('recipient_count', v_count));

  return v_broadcast;
end $$;

revoke execute on function public.publish_broadcast(uuid) from public, anon, authenticated;
grant  execute on function public.publish_broadcast(uuid) to service_role;

-- Called once a minute by pg_cron (docs/05 §9). One broadcast failing must not
-- stop the others, so each is published in its own subtransaction.
--
-- docs/09 §5 defines the empty-audience outcome for the API path only ("nothing
-- is published"). Leaving such a broadcast SCHEDULED would make cron retry it
-- every minute forever, so here it is moved to the terminal CANCELLED state with
-- an audit row explaining why. Recorded in docs/00_DECISIONS.md as D-015.
create or replace function public.publish_due_broadcasts()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_id        uuid;
  v_gym_id    uuid;
  v_published int := 0;
begin
  for v_id, v_gym_id in
    select id, gym_id from public.broadcasts
    where status = 'SCHEDULED' and publish_at <= now()
    order by publish_at
  loop
    begin
      perform public.publish_broadcast(v_id);
      v_published := v_published + 1;
    exception
      when others then
        if sqlerrm = 'BROADCAST_EMPTY_AUDIENCE' then
          update public.broadcasts set status = 'CANCELLED' where id = v_id;
          insert into public.audit_logs (gym_id, action, entity_type, entity_id, metadata)
          values (v_gym_id, 'BROADCAST_CANCELLED_EMPTY_AUDIENCE', 'broadcast', v_id, '{}'::jsonb);
        else
          raise warning 'publish_due_broadcasts: broadcast % failed: %', v_id, sqlerrm;
        end if;
    end;
  end loop;

  return v_published;
end $$;

revoke execute on function public.publish_due_broadcasts() from public, anon, authenticated;
grant  execute on function public.publish_due_broadcasts() to service_role;
