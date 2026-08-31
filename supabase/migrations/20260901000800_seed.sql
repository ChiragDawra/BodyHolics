-- The one gym this build serves, plus its plans. Idempotent: re-running this
-- migration against a database that already has the gym changes nothing.

insert into public.gyms (name, slug, join_code, weekly_hours, crowd_level)
values (
  'BodyHolics',
  'bodyholics',
  'BH7K2M9Q',
  jsonb_build_object(
    'mon', jsonb_build_object('open', '06:00', 'close', '22:00'),
    'tue', jsonb_build_object('open', '06:00', 'close', '22:00'),
    'wed', jsonb_build_object('open', '06:00', 'close', '22:00'),
    'thu', jsonb_build_object('open', '06:00', 'close', '22:00'),
    'fri', jsonb_build_object('open', '06:00', 'close', '22:00'),
    'sat', jsonb_build_object('open', '07:00', 'close', '20:00'),
    'sun', jsonb_build_object('open', '07:00', 'close', '20:00')
  ),
  'not_crowded'
)
on conflict (slug) do nothing;

-- Demo PIN is 1234. Stored bcrypt-hashed; the plaintext exists nowhere.
insert into public.gym_secrets (gym_id, check_pin_hash)
select g.id, extensions.crypt('1234', extensions.gen_salt('bf', 10))
from public.gyms g
where g.slug = 'bodyholics'
on conflict (gym_id) do nothing;

insert into public.plans (gym_id, name, price_paise, duration_days, is_active)
select g.id, v.name, v.price_paise, v.duration_days, true
from public.gyms g
cross join (values
  ('Monthly',   120000, 30),
  ('Quarterly', 330000, 90),
  ('Half-year', 600000, 180),
  ('Annual',   1000000, 365)
) as v(name, price_paise, duration_days)
where g.slug = 'bodyholics'
  and not exists (
    select 1 from public.plans p
    where p.gym_id = g.id and p.name = v.name
  );
