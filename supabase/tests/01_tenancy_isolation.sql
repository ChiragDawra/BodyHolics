-- One member must not be able to read another member's money, membership, or
-- alerts, and must not be able to read anything at all at a gym they do not
-- belong to. These are the policies from docs/05 §8 exercised as a real
-- authenticated session rather than read off the catalog.

begin;
select plan(9);

-- Two members of the seeded gym, plus the owner.
\set asha   '33333333-3333-4333-8333-333333333331'
\set imran  '33333333-3333-4333-8333-333333333332'
\set owner  '22222222-2222-4222-8222-222222222222'
\set gym    '11111111-1111-4111-8111-111111111111'

create or replace function pg_temp.act_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
end $$;

-- ---------------------------------------------------------------- memberships

select pg_temp.act_as(:'asha');

select is(
  (select count(*)::int from public.memberships),
  1,
  'a member sees exactly their own membership rows'
);

select is(
  (select count(*)::int from public.memberships where user_id <> :'asha'::uuid),
  0,
  'a member sees no other member''s membership'
);

select is(
  (select count(*)::int from public.payments where user_id <> :'asha'::uuid),
  0,
  'a member sees no other member''s payments'
);

select is(
  (select count(*)::int from public.notifications where user_id <> :'asha'::uuid),
  0,
  'a member sees no other member''s notifications'
);

-- member_qr_tokens has RLS on, no policy, and no grant: a readable token_hash
-- would let a scanner replay someone else's counter payment. Note that this one
-- raises rather than returning zero rows — see the note in 02 on the difference.
select throws_ok(
  $$ select count(*) from public.member_qr_tokens $$,
  '42501',
  null,
  'a member cannot read QR tokens at all'
);

select is(
  (select count(*)::int from public.audit_logs),
  0,
  'a member sees no audit log rows'
);

select is(
  (select count(*)::int from public.broadcasts),
  0,
  'a member sees no broadcast drafts'
);

-- ---------------------------------------------------------------- staff view

reset role;
select pg_temp.act_as(:'owner');

select cmp_ok(
  (select count(*)::int from public.memberships), '>=', 3,
  'staff see every membership at their own gym'
);

select is(
  (select count(*)::int from public.audit_logs where gym_id <> :'gym'::uuid),
  0,
  'the owner sees no audit rows from another gym'
);

reset role;
select * from finish();
rollback;
