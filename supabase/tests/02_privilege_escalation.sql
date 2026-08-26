-- The writes a member must never be able to make. Each of these would be a real
-- escalation if a policy or grant regressed, and none of them is caught by a
-- typecheck or by reading the policy list.

begin;
select plan(11);

\set asha  '33333333-3333-4333-8333-333333333331'
\set gym   '11111111-1111-4111-8111-111111111111'
\set plan1 '44444444-4444-4444-8444-444444444441'

create or replace function pg_temp.act_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
end $$;

select pg_temp.act_as(:'asha');

-- CLAUDE.md rule 1: a membership never becomes ACTIVE because a client said so.
--
-- These raise rather than reporting zero rows, and the distinction is worth
-- knowing. RLS and GRANT are separate controls:
--
--   * grant present, no matching policy -> UPDATE/DELETE silently affect zero
--     rows (only INSERT raises, since a rejected new row has nothing to filter);
--   * no grant at all                   -> every verb raises 42501.
--
-- memberships and payments are in the second case: no client is granted UPDATE
-- on either, because only a verified webhook or a staff counter-confirmation
-- moves them, and both run as service_role. Failing closed at the grant layer
-- means a future policy mistake cannot open this by itself.
select throws_ok(
  $$ update public.memberships set status = 'ACTIVE' $$,
  '42501',
  null,
  'a member cannot update a membership'
);

select is(
  (select status from public.memberships where id = '55555555-5555-4555-8555-555555555551'),
  'ACTIVE',
  'and the row it targeted is untouched'
);

select throws_ok(
  $$ update public.payments set status = 'PAID', paid_at = now() $$,
  '42501',
  null,
  'a member cannot update a payment'
);

select throws_ok(
  format($$ insert into public.memberships (gym_id, user_id, plan_id, status, price_paise)
            values (%L, %L, %L, 'ACTIVE', 0) $$, :'gym', :'asha', :'plan1'),
  '42501',
  null,
  'a member cannot insert a membership'
);

-- CLAUDE.md rule 2: prices come from the database.
select throws_ok(
  format($$ insert into public.payments (gym_id, user_id, membership_id, amount_paise, method)
            select %L, %L, id, 1, 'CASH_COUNTER' from public.memberships limit 1 $$,
         :'gym', :'asha'),
  '42501',
  null,
  'a member cannot insert a payment'
);

-- The activation path is service-key only.
select throws_ok(
  $$ select public.activate_membership_for_payment('66666666-6666-4666-8666-666666666661') $$,
  '42501',
  null,
  'a member cannot call activate_membership_for_payment'
);

-- docs/05 §5: an exact headcount must never reach a member.
select throws_ok(
  format($$ select public.current_occupancy(%L) $$, :'gym'),
  '42501',
  null,
  'a member cannot call current_occupancy'
);

-- RLS cannot restrict columns; the column grant is what stops this.
select throws_ok(
  $$ update public.notifications set title = 'rewritten' $$,
  '42501',
  null,
  'a member cannot rewrite the text of their own notification'
);

-- ...but marking it read must still work, or the alerts screen is broken.
select lives_ok(
  $$ update public.notifications set read_at = now() $$,
  'a member can mark their own notification read'
);

-- docs/05 §5: metadata carries sample_size, an exact headcount. RLS cannot
-- restrict columns, so this is a grant-level denial and does raise.
select throws_ok(
  $$ select metadata from public.crowd_snapshots $$,
  '42501',
  null,
  'a member cannot read crowd_snapshots.metadata'
);

-- Only PRESENCE_* events are member-writable; CHECK_IN is service-key only.
select throws_ok(
  format($$ insert into public.attendance_events (gym_id, user_id, source_type, event_type)
            values (%L, %L, 'MANUAL', 'CHECK_IN') $$, :'gym', :'asha'),
  '42501',
  null,
  'a member cannot record a CHECK_IN'
);

reset role;
select * from finish();
rollback;
