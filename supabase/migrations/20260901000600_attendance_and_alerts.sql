-- Attendance is recorded by staff from the admin dashboard. There is no
-- self-check-in and no camera anywhere in this build.

create table public.attendance (
  id             uuid primary key default gen_random_uuid(),
  gym_id         uuid not null references public.gyms (id) on delete cascade,
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  checked_in_at  timestamptz not null default now(),
  method         public.attendance_method not null default 'manual',
  recorded_by    uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index attendance_profile_id_idx on public.attendance (profile_id, checked_in_at desc);
create index attendance_gym_day_idx on public.attendance (gym_id, checked_in_at desc);

alter table public.attendance enable row level security;

-- Deliberately no anon policy. The /check screen reads counts through the
-- PIN-gated RPCs instead, so member names never leak to the anon key.
create policy "members read their own attendance"
  on public.attendance for select
  to authenticated
  using (profile_id = auth.uid());

create policy "staff read attendance at their gym"
  on public.attendance for select
  to authenticated
  using (public.is_staff(gym_id));

create policy "staff record attendance"
  on public.attendance for insert
  to authenticated
  with check (public.is_staff(gym_id));

create policy "staff delete attendance"
  on public.attendance for delete
  to authenticated
  using (public.is_staff(gym_id));


-- Notices the owner pushes to members. Delivered live over Realtime.
create table public.alerts (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  title       text not null check (char_length(trim(title)) > 0),
  body        text not null default '',
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index alerts_gym_created_idx on public.alerts (gym_id, created_at desc);

alter table public.alerts enable row level security;

create policy "members read alerts for their gym"
  on public.alerts for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.gym_id = alerts.gym_id
    )
    or public.is_staff(gym_id)
  );

create policy "staff publish alerts"
  on public.alerts for insert
  to authenticated
  with check (public.is_staff(gym_id));

create policy "staff delete alerts"
  on public.alerts for delete
  to authenticated
  using (public.is_staff(gym_id));


-- Read receipts drive the unread badge on the bell icon.
create table public.alert_reads (
  alert_id    uuid not null references public.alerts (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  read_at     timestamptz not null default now(),
  primary key (alert_id, profile_id)
);

alter table public.alert_reads enable row level security;

create policy "members read their own read receipts"
  on public.alert_reads for select
  to authenticated
  using (profile_id = auth.uid());

create policy "members mark alerts read"
  on public.alert_reads for insert
  to authenticated
  with check (profile_id = auth.uid());

-- Realtime: members subscribe to new alerts for their gym.
alter publication supabase_realtime add table public.alerts;
