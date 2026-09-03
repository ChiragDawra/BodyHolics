-- What a plan actually includes, in the gym's own words.
--
-- The membership screen has a benefits checklist. Without somewhere real to
-- read it from, that list could only ever be invented in the component, which
-- is the one thing the design is not allowed to do. This is the column the
-- owner types into from Gym settings; a plan nobody has described yet has an
-- empty array and the checklist renders nothing at all.
alter table public.plans
  add column if not exists benefits text[] not null default '{}'::text[];
