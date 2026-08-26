-- docs/05 §12 — local development seed. Idempotent so `supabase db reset` is
-- repeatable. Never loaded against staging or production.
--
-- The phone numbers here match the [auth.sms.test_otp] block in config.toml, so
-- signing a member in locally needs no SMS provider. The one password in this
-- file is the local owner's, which exists because admin sign-in is email +
-- password (docs/04 §4); it is a development credential, not a secret, and no
-- other environment loads this file.

-- ---------------------------------------------------------------- auth users

-- The owner signs in to the admin app with email + password (docs/04 §4); the
-- members sign in with phone OTP (docs/04 §3). Bootstrapping the first OWNER is
-- deliberately a manual insert rather than a signup flow, and this is the local
-- copy of that. The password below is a local development credential only: it is
-- never used by any other environment, and no production secret lives in git.
-- The empty-string token columns are not decoration. GoTrue scans them into
-- non-nullable Go strings, so a NULL there makes every sign-in fail with
-- "Database error querying schema" rather than anything that names the cause.
insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at, encrypted_password,
  phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone_change, phone_change_token,
  reauthentication_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
   'owner@urban-gym.test', now(), crypt('local-dev-password', gen_salt('bf')),
   '+919000000001', now(),
   '', '', '', '', '', '', '', '',
   '{"provider":"email","providers":["email","phone"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333331', 'authenticated', 'authenticated', null, null, null, '+919000000002', now(),
   '', '', '', '', '', '', '', '',
   '{"provider":"phone","providers":["phone"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333332', 'authenticated', 'authenticated', null, null, null, '+919000000003', now(),
   '', '', '', '', '', '', '', '',
   '{"provider":"phone","providers":["phone"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', null, null, null, '+919000000004', now(),
   '', '', '', '', '', '', '', '',
   '{"provider":"phone","providers":["phone"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333334', 'authenticated', 'authenticated', null, null, null, '+919000000005', now(),
   '', '', '', '', '', '', '', '',
   '{"provider":"phone","providers":["phone"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333335', 'authenticated', 'authenticated', null, null, null, '+919000000006', now(),
   '', '', '', '', '', '', '', '',
   '{"provider":"phone","providers":["phone"]}', '{}', now(), now()),

  -- A verified account that belongs to no gym. docs/04 §4: an auth.users row
  -- grants nothing on its own, and this is what that looks like. It is the
  -- fixture for "signed in, but not a member" — the case the admin shell and
  -- every requireMember check have to handle correctly.
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000ff', 'authenticated', 'authenticated', null, null, null, '+919000000099', now(),
   '', '', '', '', '', '', '', '',
   '{"provider":"phone","providers":["phone"]}', '{}', now(), now())
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id, u.id, u.email,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id = '22222222-2222-4222-8222-222222222222'
on conflict (provider, provider_id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id, u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'phone', u.phone),
       'phone', now(), now(), now()
from auth.users u
where u.id in (
  '33333333-3333-4333-8333-333333333331',
  '33333333-3333-4333-8333-333333333332',
  '33333333-3333-4333-8333-333333333333',
  '33333333-3333-4333-8333-333333333334',
  '33333333-3333-4333-8333-333333333335',
  '00000000-0000-4000-8000-0000000000ff'
)
on conflict (provider, provider_id) do nothing;

-- ---------------------------------------------------------------- gym

insert into public.gyms (id, slug, name, timezone, phone, address)
values ('11111111-1111-4111-8111-111111111111', 'urban-gym', 'Urban Gym',
        'Asia/Kolkata', '+912212345678', '3rd Floor, MG Road, Bengaluru 560001')
on conflict (id) do nothing;

-- Mon-Fri 06:00-22:00, Sat 07:00-21:00, Sun closed.
insert into public.gym_hours (gym_id, weekday, opens_at, closes_at, is_closed)
values
  ('11111111-1111-4111-8111-111111111111', 0, null,    null,    true),
  ('11111111-1111-4111-8111-111111111111', 1, '06:00', '22:00', false),
  ('11111111-1111-4111-8111-111111111111', 2, '06:00', '22:00', false),
  ('11111111-1111-4111-8111-111111111111', 3, '06:00', '22:00', false),
  ('11111111-1111-4111-8111-111111111111', 4, '06:00', '22:00', false),
  ('11111111-1111-4111-8111-111111111111', 5, '06:00', '22:00', false),
  ('11111111-1111-4111-8111-111111111111', 6, '07:00', '21:00', false)
on conflict (gym_id, weekday) do nothing;

-- ---------------------------------------------------------------- profiles

insert into public.profiles (id, full_name, phone, date_of_birth)
values
  ('22222222-2222-4222-8222-222222222222', 'Ravi Menon',   '+919000000001', '1985-04-12'),
  ('33333333-3333-4333-8333-333333333331', 'Asha Rao',     '+919000000002', '1994-02-28'),
  ('33333333-3333-4333-8333-333333333332', 'Imran Sheikh', '+919000000003', '1990-11-03'),
  ('33333333-3333-4333-8333-333333333333', 'Neha Gupta',   '+919000000004', '1998-07-19'),
  ('33333333-3333-4333-8333-333333333334', 'Vikram Iyer',  '+919000000005', '1987-01-25'),
  ('33333333-3333-4333-8333-333333333335', 'Priya Nair',   '+919000000006', '2000-09-08')
on conflict (id) do nothing;

insert into public.gym_staff (gym_id, user_id, role, status)
values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'OWNER', 'ACTIVE')
on conflict (gym_id, user_id) do nothing;

insert into public.gym_members (gym_id, user_id, member_code, status, joined_at)
values
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333331', 'UG-0001', 'ACTIVE', now() - interval '200 days'),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333332', 'UG-0002', 'ACTIVE', now() - interval '150 days'),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'UG-0003', 'ACTIVE', now() - interval '90 days'),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333334', 'UG-0004', 'ACTIVE', now() - interval '20 days'),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333335', 'UG-0005', 'ACTIVE', now() - interval '5 days')
on conflict (gym_id, user_id) do nothing;

-- ---------------------------------------------------------------- plans

insert into public.membership_plans (id, gym_id, name, description, price_paise, duration_days, sort_order)
values
  ('44444444-4444-4444-8444-444444444441', '11111111-1111-4111-8111-111111111111', 'Monthly',   'One month, full access.',       149900, 30,  1),
  ('44444444-4444-4444-8444-444444444442', '11111111-1111-4111-8111-111111111111', 'Quarterly', 'Three months, full access.',    399900, 90,  2),
  ('44444444-4444-4444-8444-444444444443', '11111111-1111-4111-8111-111111111111', 'Annual',    'Twelve months, full access.',  1299900, 365, 3)
on conflict (id) do nothing;

-- --------------------------------------------------------- memberships
-- One active, one expiring inside the 7-day window, one expired, one pending
-- payment, and one member with no membership at all (the INACTIVE_MEMBERS case).

insert into public.memberships (id, gym_id, user_id, plan_id, status, price_paise, start_at, end_at, activated_at)
values
  ('55555555-5555-4555-8555-555555555551', '11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333331', '44444444-4444-4444-8444-444444444442',
   'ACTIVE', 399900, now() - interval '30 days', now() + interval '60 days', now() - interval '30 days'),

  ('55555555-5555-4555-8555-555555555552', '11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333332', '44444444-4444-4444-8444-444444444441',
   'ACTIVE', 149900, now() - interval '27 days', now() + interval '3 days', now() - interval '27 days'),

  ('55555555-5555-4555-8555-555555555553', '11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444441',
   'EXPIRED', 149900, now() - interval '40 days', now() - interval '10 days', now() - interval '40 days'),

  ('55555555-5555-4555-8555-555555555554', '11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333334', '44444444-4444-4444-8444-444444444443',
   'PENDING_PAYMENT', 1299900, null, null, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- payments

insert into public.payments (id, gym_id, user_id, membership_id, amount_paise, method, status,
                             provider, provider_order_id, provider_payment_id, confirmed_by, paid_at, metadata)
values
  -- online, settled through the webhook
  ('66666666-6666-4666-8666-666666666661', '11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333331', '55555555-5555-4555-8555-555555555551',
   399900, 'ONLINE', 'PAID', 'RAZORPAY', 'order_seed000000001', 'pay_seed000000001',
   null, now() - interval '30 days', '{"method":"upi"}'),

  -- cash at the counter, confirmed by the owner
  ('66666666-6666-4666-8666-666666666662', '11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333332', '55555555-5555-4555-8555-555555555552',
   149900, 'CASH_COUNTER', 'PAID', 'COUNTER', null, null,
   '22222222-2222-4222-8222-222222222222', now() - interval '27 days', '{}'),

  -- started online, still waiting on the provider
  ('66666666-6666-4666-8666-666666666663', '11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333334', '55555555-5555-4555-8555-555555555554',
   1299900, 'ONLINE', 'PENDING', 'RAZORPAY', 'order_seed000000003', null,
   null, null, '{}')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- issues

insert into public.issues (id, gym_id, user_id, category, title, description, status,
                           acknowledged_at, resolved_at, resolved_by)
values
  ('77777777-7777-4777-8777-777777777771', '11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333331', 'EQUIPMENT',
   'Treadmill 3 belt slipping', 'The belt slips under load above 10 km/h.', 'OPEN',
   null, null, null),

  ('77777777-7777-4777-8777-777777777772', '11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333332', 'CLEANLINESS',
   'Locker room needs attention', 'Second row of lockers was not cleaned yesterday.', 'RESOLVED',
   now() - interval '3 days', now() - interval '2 days', '22222222-2222-4222-8222-222222222222')
on conflict (id) do nothing;

insert into public.issue_messages (issue_id, gym_id, author_user_id, author_role, body)
values
  ('77777777-7777-4777-8777-777777777772', '11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222', 'STAFF', 'Cleaned this morning, thanks for flagging it.')
on conflict do nothing;

-- ---------------------------------------------------------------- broadcasts

insert into public.broadcasts (id, gym_id, created_by, title, body, category, audience,
                               status, publish_at, published_at, recipient_count)
values
  ('88888888-8888-4888-8888-888888888881', '11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   'Independence Day hours', 'The gym closes at 14:00 on 15 August.', 'HOLIDAY',
   '{"type":"ALL_MEMBERS"}', 'PUBLISHED', null, now() - interval '6 days', 5),

  ('88888888-8888-4888-8888-888888888882', '11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   'Squat rack maintenance', 'Rack 2 is out of service on Saturday morning.', 'MAINTENANCE',
   '{"type":"ACTIVE_MEMBERS"}', 'SCHEDULED', now() + interval '2 days', null, 0)
on conflict (id) do nothing;

insert into public.broadcast_recipients (broadcast_id, user_id, gym_id, delivered_at)
select '88888888-8888-4888-8888-888888888881', gm.user_id, gm.gym_id, now() - interval '6 days'
from public.gym_members gm
where gm.gym_id = '11111111-1111-4111-8111-111111111111' and gm.status = 'ACTIVE'
on conflict (broadcast_id, user_id) do nothing;

insert into public.notifications (gym_id, user_id, source_type, source_id, title, body, category, created_at)
select br.gym_id, br.user_id, 'BROADCAST', br.broadcast_id,
       'Independence Day hours', 'The gym closes at 14:00 on 15 August.', 'HOLIDAY',
       now() - interval '6 days'
from public.broadcast_recipients br
where br.broadcast_id = '88888888-8888-4888-8888-888888888881'
  and not exists (
    select 1 from public.notifications n
    where n.source_id = br.broadcast_id and n.user_id = br.user_id
  );

-- ------------------------------------------------------------ attendance
-- Roughly 40 closed visits across the last 14 days, plus four members who are
-- in the gym right now so crowd_level() has something to bucket.

insert into public.attendance_events (gym_id, user_id, source_type, event_type, occurred_at, metadata)
select '11111111-1111-4111-8111-111111111111',
       gm.user_id,
       'MANUAL',
       'PRESENCE_START',
       (now() - make_interval(days => d) + make_interval(hours => 7 + (d % 5))),
       '{"closed": true}'::jsonb
from public.gym_members gm
cross join generate_series(1, 8) as d
where gm.gym_id = '11111111-1111-4111-8111-111111111111'
  and gm.status = 'ACTIVE'
  and not exists (
    select 1 from public.attendance_events e
    where e.user_id = gm.user_id and e.metadata ? 'closed'
  );

insert into public.attendance_events (gym_id, user_id, source_type, event_type, occurred_at)
select e.gym_id, e.user_id, 'MANUAL', 'PRESENCE_END', e.occurred_at + interval '75 minutes'
from public.attendance_events e
where e.event_type = 'PRESENCE_START'
  and e.metadata ? 'closed'
  and not exists (
    select 1 from public.attendance_events x
    where x.user_id = e.user_id
      and x.event_type = 'PRESENCE_END'
      and x.occurred_at = e.occurred_at + interval '75 minutes'
  );

-- Four open presences: distinct users, so the one-open-presence index holds.
insert into public.attendance_events (gym_id, user_id, source_type, event_type, occurred_at)
select '11111111-1111-4111-8111-111111111111', gm.user_id, 'MANUAL', 'PRESENCE_START',
       now() - interval '35 minutes'
from public.gym_members gm
where gm.gym_id = '11111111-1111-4111-8111-111111111111'
  and gm.user_id in (
    '33333333-3333-4333-8333-333333333331',
    '33333333-3333-4333-8333-333333333332',
    '33333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-333333333334'
  )
on conflict do nothing;
