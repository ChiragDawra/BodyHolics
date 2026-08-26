-- docs/09 §2 and D-004. Activation is the one place money turns into access, so
-- the two properties that matter are tested directly: a replayed webhook must be
-- a no-op, and a renewal must stack onto the remaining period rather than
-- truncate it.

begin;
select plan(7);

\set gym    '11111111-1111-4111-8111-111111111111'
\set neha   '33333333-3333-4333-8333-333333333333'
\set vikram '33333333-3333-4333-8333-333333333334'
\set asha   '33333333-3333-4333-8333-333333333331'
\set annual '44444444-4444-4444-8444-444444444443'

-- These run as the migration owner, standing in for an Edge Function using the
-- service key. That is the only caller the function is granted to.

-- ------------------------------------------------ replay is a no-op, not an error

select is(
  (select status from public.memberships where id = '55555555-5555-4555-8555-555555555554'),
  'PENDING_PAYMENT',
  'the seeded annual membership starts pending'
);

update public.payments
   set status = 'PAID', provider_payment_id = 'pay_test_replay', paid_at = now()
 where id = '66666666-6666-4666-8666-666666666663';

select is(
  (select status from public.activate_membership_for_payment('66666666-6666-4666-8666-666666666663')),
  'ACTIVE',
  'a paid payment activates its membership'
);

select is(
  (select status from public.activate_membership_for_payment('66666666-6666-4666-8666-666666666663')),
  'ACTIVE',
  'replaying the same payment returns the same active membership'
);

select is(
  (select count(*)::int from public.audit_logs
   where entity_id = '55555555-5555-4555-8555-555555555554' and action = 'MEMBERSHIP_ACTIVATED'),
  1,
  'a replayed activation does not write a second audit row'
);

-- ------------------------------------------------------------- period stacking

-- Asha already has an ACTIVE membership ending in 60 days. A renewal bought now
-- must begin when that one ends, not today.
insert into public.memberships (id, gym_id, user_id, plan_id, status, price_paise)
values ('99999999-9999-4999-8999-999999999991', :'gym', :'asha', :'annual', 'PENDING_PAYMENT', 1299900);

insert into public.payments (id, gym_id, user_id, membership_id, amount_paise, method, status,
                             provider, provider_payment_id, paid_at)
values ('99999999-9999-4999-8999-999999999992', :'gym', :'asha',
        '99999999-9999-4999-8999-999999999991', 1299900, 'ONLINE', 'PAID',
        'RAZORPAY', 'pay_test_stack', now());

select lives_ok(
  $$ select public.activate_membership_for_payment('99999999-9999-4999-8999-999999999992') $$,
  'a renewal activates while an existing membership is still valid'
);

select cmp_ok(
  (select start_at from public.memberships where id = '99999999-9999-4999-8999-999999999991'),
  '>',
  now() + interval '59 days',
  'the renewal starts when the current period ends, not today (D-004)'
);

-- ------------------------------------------------------- unpaid cannot activate

insert into public.memberships (id, gym_id, user_id, plan_id, status, price_paise)
values ('99999999-9999-4999-8999-999999999993', :'gym', :'neha', :'annual', 'PENDING_PAYMENT', 1299900);

insert into public.payments (id, gym_id, user_id, membership_id, amount_paise, method, status)
values ('99999999-9999-4999-8999-999999999994', :'gym', :'neha',
        '99999999-9999-4999-8999-999999999993', 1299900, 'ONLINE', 'PENDING');

select throws_ok(
  $$ select public.activate_membership_for_payment('99999999-9999-4999-8999-999999999994') $$,
  'PAYMENT_NOT_PAID',
  'an unpaid payment cannot activate anything'
);

select * from finish();
rollback;
