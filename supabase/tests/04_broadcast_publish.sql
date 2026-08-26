-- docs/09 §5. Audience is a rule evaluated server-side at publish time, a
-- published broadcast is immutable, and a SELECTED_MEMBERS list may not reach
-- outside the gym it was sent from.

begin;
select plan(8);

\set gym      '11111111-1111-4111-8111-111111111111'
\set owner    '22222222-2222-4222-8222-222222222222'
\set asha     '33333333-3333-4333-8333-333333333331'
\set outsider '00000000-0000-4000-8000-0000000000ff'

-- ------------------------------------------------------- audience resolution

-- Five active gym members, of whom four hold a currently valid membership after
-- the seed (one EXPIRED, one PENDING_PAYMENT, one with none at all).
select is(
  (select count(*)::int from public.resolve_broadcast_audience(:'gym', '{"type":"ALL_MEMBERS"}')),
  5,
  'ALL_MEMBERS resolves to every active gym member'
);

select is(
  (select count(*)::int from public.resolve_broadcast_audience(:'gym', '{"type":"ACTIVE_MEMBERS"}')),
  2,
  'ACTIVE_MEMBERS resolves to holders of a currently valid membership'
);

select is(
  (select count(*)::int from public.resolve_broadcast_audience(:'gym', '{"type":"EXPIRING_MEMBERS"}')),
  1,
  'EXPIRING_MEMBERS resolves to the member inside the warning window'
);

select is(
  (select count(*)::int from public.resolve_broadcast_audience(:'gym', '{"type":"INACTIVE_MEMBERS"}')),
  3,
  'INACTIVE_MEMBERS is the complement of ACTIVE_MEMBERS'
);

-- A user id that is not a member of this gym fails the whole call rather than
-- being quietly dropped, so a broadcast cannot be used to probe for user ids.
select throws_ok(
  format($$ select * from public.resolve_broadcast_audience(%L,
            json_build_object('type','SELECTED_MEMBERS','userIds', json_build_array(%L))::jsonb) $$,
         :'gym', :'outsider'),
  'CROSS_TENANT_ACCESS',
  'a SELECTED_MEMBERS list containing a foreign user id is refused'
);

-- ------------------------------------------------------------- publishing

insert into public.broadcasts (id, gym_id, created_by, title, body, category, audience, status)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', :'gym', :'owner',
        'Test notice', 'Body of the test notice.', 'GENERAL',
        '{"type":"ALL_MEMBERS"}', 'DRAFT');

select is(
  (select recipient_count from public.publish_broadcast('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')),
  5,
  'publishing writes one recipient per resolved member'
);

select is(
  (select count(*)::int from public.notifications
   where source_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  5,
  'publishing writes the matching notifications in the same transaction'
);

-- Recipients have already been told; rewriting the text would rewrite what they
-- were told. Guarded by a trigger as well as by the policy.
select throws_ok(
  $$ update public.broadcasts set body = 'rewritten'
     where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' $$,
  'BROADCAST_IMMUTABLE',
  'a published broadcast cannot be edited'
);

select * from finish();
rollback;
