-- The gym itself. This build serves exactly one gym, but every table carries
-- gym_id so a second gym is a row, not a rewrite.

create table public.gyms (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  join_code         text not null unique check (char_length(join_code) = 8),
  -- { "mon": { "open": "06:00", "close": "22:00" }, ... } for mon..sun.
  -- A day may be null, meaning closed all day.
  weekly_hours      jsonb not null default '{}'::jsonb,
  -- null  = follow weekly_hours
  -- true  = force open regardless of the schedule
  -- false = force closed regardless of the schedule
  is_open_override  boolean,
  crowd_level       public.crowd_level not null default 'not_crowded',
  crowd_updated_at  timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index gyms_slug_idx on public.gyms (slug);
create index gyms_join_code_idx on public.gyms (join_code);

alter table public.gyms enable row level security;

-- Opening hours, crowd level, and open/closed are public information — the
-- landing page and the join page show them before anyone signs in.
create policy "gyms are readable by everyone"
  on public.gyms for select
  to anon, authenticated
  using (true);

-- Writes go through staff RLS (added with the staff table) or the PIN-gated
-- RPCs in 20260901000700. There is deliberately no anon update policy.
