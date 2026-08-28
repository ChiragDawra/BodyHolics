-- D-021 — a profile may be identified by a verified phone or a verified email,
-- but the guarantees that made phone-only safe have to survive the change.

begin;
select plan(6);

-- profiles.id references auth.users, so these need real auth rows or every
-- insert below fails on the foreign key before it ever reaches the constraint
-- under test. Rolled back with the transaction.
insert into auth.users (instance_id, id, aud, role, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone_change, phone_change_token, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
       '', '', '', '', '', '', '', ''
from unnest(array[
  '00000000-0000-4000-8000-00000000dead',
  '00000000-0000-4000-8000-00000000e001',
  '00000000-0000-4000-8000-00000000e002',
  '00000000-0000-4000-8000-00000000e003',
  '00000000-0000-4000-8000-00000000e004'
]::uuid[]) as id;

select is(
  (select count(*)::int from public.profiles where phone is null and email is null),
  0,
  'no seeded profile is without an identity'
);

-- The constraint that stops `phone drop not null` becoming a quiet loosening.
select throws_ok(
  $$ insert into public.profiles (id, full_name, phone, email)
     values ('00000000-0000-4000-8000-00000000dead', 'Nobody', null, null) $$,
  '23514',
  null,
  'a profile with neither a phone nor an email is refused'
);

select lives_ok(
  $$ insert into public.profiles (id, full_name, phone, email)
     values ('00000000-0000-4000-8000-00000000e001', 'Email Only', null, 'demo@example.com') $$,
  'a profile with only a verified email is allowed'
);

-- Google returns the address as the member typed it. Without a case-insensitive
-- index, Asha@x.com and asha@x.com become two members with two memberships.
select throws_ok(
  $$ insert into public.profiles (id, full_name, phone, email)
     values ('00000000-0000-4000-8000-00000000e002', 'Same Person', null, 'DEMO@Example.com') $$,
  '23505',
  null,
  'the same email in different case cannot create a second member'
);

select throws_ok(
  $$ insert into public.profiles (id, full_name, phone, email)
     values ('00000000-0000-4000-8000-00000000e003', 'Bad Address', null, 'not-an-email') $$,
  '23514',
  null,
  'a malformed email is refused'
);

-- The phone rule is unchanged for anyone who still has one.
select throws_ok(
  $$ insert into public.profiles (id, full_name, phone)
     values ('00000000-0000-4000-8000-00000000e004', 'Bad Phone', '9876543210') $$,
  '23514',
  null,
  'a phone without a country code is still refused'
);

select * from finish();
rollback;
