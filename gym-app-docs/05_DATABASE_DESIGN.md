# 05 — Database Design

PostgreSQL via Supabase. **All SQL below is intended to be copied into migrations largely as-is.** Where a choice was made, D-xxx references `docs/00_DECISIONS.md`.

## 0. Conventions

| Rule | Value |
|---|---|
| Primary keys | `uuid default gen_random_uuid()` |
| Timestamps | `timestamptz`, UTC, column suffix `_at` |
| Money | `bigint`, paise, column suffix `_paise`, `check (x >= 0)` |
| Status columns | `text` + `check (... in (...))` — **not** PG enums (D: enums need a migration to extend, checks don't) |
| Tenancy | every business table has `gym_id uuid not null references gyms(id)` |
| Soft delete | none. Use status columns. |
| `updated_at` | maintained by trigger, never by application code |

## 1. Extensions & shared helpers

```sql
-- 0001_init_extensions.sql
create extension if not exists pgcrypto;      -- gen_random_uuid, digest
create extension if not exists pg_cron;       -- scheduled jobs (enable in Supabase dashboard)

-- updated_at trigger, applied to every table with that column
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
```

## 2. Tenancy & identity

### `gyms`

```sql
create table public.gyms (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique
                          check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),   -- D-006
  name                  text not null check (length(trim(name)) between 2 and 120),
  timezone              text not null default 'Asia/Kolkata',
  phone                 text,
  address               text,
  logo_path             text,
  expiry_warning_days   int  not null default 7  check (expiry_warning_days between 1 and 60),  -- D-002
  presence_ttl_minutes  int  not null default 120 check (presence_ttl_minutes between 15 and 600), -- D-008
  crowd_thresholds      jsonb not null default '{"moderate":10,"crowded":25,"very_crowded":40}'::jsonb,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger set_updated_at before update on public.gyms
  for each row execute function public.tg_set_updated_at();
```

> `crowd_thresholds`: occupancy `< moderate` → `NOT_CROWDED`; `< crowded` → `MODERATE`; `< very_crowded` → `CROWDED`; else `VERY_CROWDED`. Tune per gym without a deploy.

### `profiles` — global identity, 1:1 with `auth.users` (D-001)

```sql
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null check (length(trim(full_name)) between 2 and 120),
  phone         text not null unique,           -- E.164, e.g. +919876543210
  avatar_path   text,
  date_of_birth date check (date_of_birth < current_date),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint phone_e164 check (phone ~ '^\+[1-9][0-9]{7,14}$')
);
create trigger set_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();
```

> **No `gym_id` here** — see D-001. `phone` is mirrored from `auth.users.phone` at signup by the `create-member-profile` function; it is duplicated deliberately so the Data API can join/search without touching the `auth` schema.

### `gym_members` — the tenancy edge (D-001)

```sql
create table public.gym_members (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  member_code  text not null,                    -- human-searchable, e.g. 'UG-0142'
  status       text not null default 'ACTIVE'
                 check (status in ('ACTIVE','BLOCKED')),
  joined_at    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (gym_id, user_id),
  unique (gym_id, member_code)
);
create index gym_members_gym_status_idx on public.gym_members (gym_id, status);
create trigger set_updated_at before update on public.gym_members
  for each row execute function public.tg_set_updated_at();

-- member_code generation: zero-padded per-gym sequence
create or replace function public.next_member_code(p_gym_id uuid)
returns text language sql volatile as $$
  select 'UG-' || lpad(((count(*) + 1))::text, 4, '0')
  from public.gym_members where gym_id = p_gym_id;
$$;
```

> The `count(*)`-based code is race-prone under concurrency. Acceptable for one gym at MVP scale; if you ever see a unique violation, switch to a per-gym `counters` table with `update ... returning`. Noted in `docs/11_OPEN_QUESTIONS.md` Q6.

### `gym_staff`

```sql
create table public.gym_staff (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null check (role in ('OWNER','STAFF')),
  status     text not null default 'ACTIVE' check (status in ('ACTIVE','DISABLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, user_id)
);
create index gym_staff_user_idx on public.gym_staff (user_id, status);
create trigger set_updated_at before update on public.gym_staff
  for each row execute function public.tg_set_updated_at();
```

### Authorization helper functions

These are used by **every** RLS policy. Define them once.

```sql
-- Is the current user active staff at this gym?
create or replace function public.is_gym_staff(p_gym_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gym_staff gs
    where gs.user_id = (select auth.uid())
      and gs.gym_id  = p_gym_id
      and gs.status  = 'ACTIVE'
  );
$$;

create or replace function public.is_gym_owner(p_gym_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gym_staff gs
    where gs.user_id = (select auth.uid())
      and gs.gym_id  = p_gym_id
      and gs.status  = 'ACTIVE'
      and gs.role    = 'OWNER'
  );
$$;

-- Is the current user a member of this gym?
create or replace function public.is_gym_member(p_gym_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gym_members gm
    where gm.user_id = (select auth.uid())
      and gm.gym_id  = p_gym_id
      and gm.status  = 'ACTIVE'
  );
$$;

revoke execute on function public.is_gym_staff(uuid), public.is_gym_owner(uuid),
                          public.is_gym_member(uuid) from public;
grant  execute on function public.is_gym_staff(uuid), public.is_gym_owner(uuid),
                          public.is_gym_member(uuid) to authenticated;
```

> `security definer` here is **required**: without it, the policy on `gym_staff` would recurse into itself. `set search_path = public` is required to make it safe.

## 3. Plans, memberships, payments

### `membership_plans`

```sql
create table public.membership_plans (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  name          text not null check (length(trim(name)) between 2 and 80),
  description   text,
  price_paise   bigint not null check (price_paise >= 0),
  duration_days int    not null check (duration_days between 1 and 3650),
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index membership_plans_gym_active_idx
  on public.membership_plans (gym_id, is_active, sort_order);
create trigger set_updated_at before update on public.membership_plans
  for each row execute function public.tg_set_updated_at();
```

> **Never delete or edit the price of a plan that has been sold.** To change a price, set `is_active = false` and create a new plan row. `memberships.plan_id` must always resolve to the plan as sold. Enforced socially + by the audit log; add a trigger if it becomes a problem.

### `memberships` (D-002, D-004, D-005)

```sql
create table public.memberships (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  plan_id       uuid not null references public.membership_plans(id),
  status        text not null default 'PENDING_PAYMENT'
                  check (status in ('PENDING_PAYMENT','ACTIVE','EXPIRED','CANCELLED')),
  price_paise   bigint not null check (price_paise >= 0),  -- snapshot of plan price at purchase
  start_at      timestamptz,
  end_at        timestamptz,
  activated_at  timestamptz,
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint membership_period_valid
    check (end_at is null or start_at is null or end_at > start_at),
  constraint membership_active_has_period
    check (status <> 'ACTIVE' or (start_at is not null and end_at is not null and activated_at is not null))
);

-- at most one pending membership per member per gym (D-004)
create unique index memberships_one_pending_idx
  on public.memberships (gym_id, user_id)
  where status = 'PENDING_PAYMENT';

create index memberships_gym_status_end_idx on public.memberships (gym_id, status, end_at);
create index memberships_user_idx           on public.memberships (user_id, status, end_at desc);
create index memberships_expiring_idx       on public.memberships (gym_id, end_at)
  where status = 'ACTIVE';

create trigger set_updated_at before update on public.memberships
  for each row execute function public.tg_set_updated_at();
```

> `price_paise` is snapshotted onto the membership so revenue and history survive plan price changes.

### `payments` (D-005, D-010)

```sql
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  gym_id              uuid not null references public.gyms(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  membership_id       uuid not null references public.memberships(id) on delete restrict,
  amount_paise        bigint not null check (amount_paise >= 0),
  currency            text not null default 'INR' check (currency = 'INR'),
  method              text not null
                        check (method in ('ONLINE','UPI_COUNTER','CASH_COUNTER','OTHER')),
  status              text not null default 'PENDING'
                        check (status in ('PENDING','AUTHORIZED','PAID','FAILED','CANCELLED','REFUNDED')),
  provider            text check (provider in ('RAZORPAY','COUNTER')),
  provider_order_id   text unique,
  provider_payment_id text unique,
  idempotency_key     text unique,
  confirmed_by        uuid references public.profiles(id),   -- staff who confirmed a counter payment
  paid_at             timestamptz,
  failure_reason      text,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint payment_paid_has_timestamp
    check (status <> 'PAID' or paid_at is not null),
  constraint counter_payment_has_confirmer
    check (method not in ('UPI_COUNTER','CASH_COUNTER') or status <> 'PAID' or confirmed_by is not null)
);

create index payments_gym_status_idx  on public.payments (gym_id, status, created_at desc);
create index payments_membership_idx  on public.payments (membership_id);
create index payments_user_idx        on public.payments (user_id, created_at desc);
create index payments_revenue_idx     on public.payments (gym_id, paid_at) where status = 'PAID';

create trigger set_updated_at before update on public.payments
  for each row execute function public.tg_set_updated_at();
```

> **Never store card data, VPA, or any provider secret.** `metadata` may hold the Razorpay event id and method label (`upi`, `card`) only.

### Activation function (single source of truth — see `docs/09_STATE_MACHINES.md` §2)

```sql
create or replace function public.activate_membership_for_payment(p_payment_id uuid)
returns public.memberships
language plpgsql security definer set search_path = public as $$
declare
  v_payment    public.payments;
  v_membership public.memberships;
  v_plan       public.membership_plans;
  v_start      timestamptz;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_payment.status <> 'PAID' then raise exception 'PAYMENT_NOT_PAID'; end if;

  select * into v_membership from public.memberships
    where id = v_payment.membership_id for update;

  if v_membership.status = 'ACTIVE' then          -- idempotent replay
    return v_membership;
  end if;
  if v_membership.status <> 'PENDING_PAYMENT' then
    raise exception 'INVALID_MEMBERSHIP_TRANSITION';
  end if;

  select * into v_plan from public.membership_plans where id = v_membership.plan_id;

  -- D-004: stack onto any currently valid membership
  select coalesce(max(end_at), now()) into v_start
  from public.memberships
  where gym_id = v_membership.gym_id
    and user_id = v_membership.user_id
    and status = 'ACTIVE'
    and end_at > now();

  update public.memberships
     set status = 'ACTIVE',
         start_at = v_start,
         end_at = v_start + make_interval(days => v_plan.duration_days),
         activated_at = now()
   where id = v_membership.id
   returning * into v_membership;

  insert into public.audit_logs (gym_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_membership.gym_id, v_payment.confirmed_by, 'MEMBERSHIP_ACTIVATED',
          'membership', v_membership.id,
          jsonb_build_object('payment_id', v_payment.id, 'method', v_payment.method));

  insert into public.notifications (gym_id, user_id, source_type, source_id, title, body, category)
  values (v_membership.gym_id, v_membership.user_id, 'MEMBERSHIP', v_membership.id,
          'Membership activated',
          'Your membership is active until ' || to_char(v_membership.end_at, 'DD Mon YYYY') || '.',
          'MEMBERSHIP');

  return v_membership;
end $$;

revoke execute on function public.activate_membership_for_payment(uuid) from public, authenticated;
```

> Only Edge Functions using the service key call this. It is deliberately **not** granted to `authenticated`.

## 4. Gym hours & overrides (D-007)

```sql
create table public.gym_hours (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),   -- 0 = Sunday, matches extract(dow)
  opens_at   time,
  closes_at  time,
  is_closed  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, weekday),
  constraint hours_present_when_open
    check (is_closed or (opens_at is not null and closes_at is not null and closes_at > opens_at))
);
create trigger set_updated_at before update on public.gym_hours
  for each row execute function public.tg_set_updated_at();

create table public.gym_status_overrides (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  forced_status text not null check (forced_status in ('OPEN','CLOSED')),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  reason        text,
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now(),
  constraint override_range_valid check (ends_at > starts_at)
);
create index gym_status_overrides_window_idx
  on public.gym_status_overrides (gym_id, starts_at, ends_at);
```

### Status resolution function

```sql
create or replace function public.current_gym_status(p_gym_id uuid)
returns table (status text, source text, override_reason text, changes_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz text; v_local timestamp; v_dow smallint; v_hours public.gym_hours; v_ovr public.gym_status_overrides;
begin
  select timezone into v_tz from public.gyms where id = p_gym_id;
  if v_tz is null then raise exception 'GYM_NOT_FOUND'; end if;

  select * into v_ovr from public.gym_status_overrides
   where gym_id = p_gym_id and now() between starts_at and ends_at
   order by starts_at desc limit 1;

  if found then
    return query select v_ovr.forced_status, 'MANUAL_OVERRIDE'::text, v_ovr.reason, v_ovr.ends_at;
    return;
  end if;

  v_local := now() at time zone v_tz;
  v_dow   := extract(dow from v_local)::smallint;
  select * into v_hours from public.gym_hours where gym_id = p_gym_id and weekday = v_dow;

  if not found or v_hours.is_closed then
    return query select 'CLOSED'::text, 'SCHEDULE'::text, null::text, null::timestamptz;
  elsif v_local::time >= v_hours.opens_at and v_local::time < v_hours.closes_at then
    return query select 'OPEN'::text, 'SCHEDULE'::text, null::text,
                        ((v_local::date + v_hours.closes_at) at time zone v_tz);
  else
    return query select 'CLOSED'::text, 'SCHEDULE'::text, null::text,
                        ((v_local::date + v_hours.opens_at) at time zone v_tz);
  end if;
end $$;
grant execute on function public.current_gym_status(uuid) to authenticated, anon;
```

## 5. Attendance & crowd (D-008)

```sql
create table public.attendance_events (
  id               uuid primary key default gen_random_uuid(),
  gym_id           uuid not null references public.gyms(id) on delete cascade,
  user_id          uuid references public.profiles(id) on delete set null,  -- null for aggregate-only sources
  source_type      text not null
                     check (source_type in ('MANUAL','QR','DEVICE_ACTIVITY','FINGERPRINT')),
  event_type       text not null
                     check (event_type in ('CHECK_IN','CHECK_OUT','PRESENCE_START','PRESENCE_END')),
  occurred_at      timestamptz not null default now(),
  source_reference text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index attendance_gym_time_idx  on public.attendance_events (gym_id, occurred_at desc);
create index attendance_user_time_idx on public.attendance_events (user_id, occurred_at desc);
-- one open presence per user per gym at a time
create unique index attendance_one_open_presence_idx
  on public.attendance_events (gym_id, user_id)
  where event_type = 'PRESENCE_START' and (metadata->>'closed') is null;

create table public.crowd_snapshots (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  captured_at timestamptz not null default now(),
  level       text check (level in ('NOT_CROWDED','MODERATE','CROWDED','VERY_CROWDED')),
  confidence  text not null default 'OK'
                check (confidence in ('OK','LOW','INSUFFICIENT_DATA')),
  source_type text not null
                check (source_type in ('DEVICE_ACTIVITY','FINGERPRINT','MANUAL','HYBRID','QR')),
  metadata    jsonb not null default '{}'::jsonb
);
create index crowd_snapshots_gym_time_idx on public.crowd_snapshots (gym_id, captured_at desc);
```

> **`crowd_snapshots` must never contain a raw device identifier, a user id, or an exact headcount that is exposed to members.** `metadata` may hold `{"sample_size": 14}` for admin analytics only; the member API never returns it.

Occupancy + bucketing:

```sql
create or replace function public.current_occupancy(p_gym_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct e.user_id)::int
  from public.attendance_events e
  join public.gyms g on g.id = e.gym_id
  where e.gym_id = p_gym_id
    and e.event_type in ('PRESENCE_START','CHECK_IN')
    and e.occurred_at > now() - make_interval(mins => g.presence_ttl_minutes)
    and not exists (
      select 1 from public.attendance_events x
      where x.gym_id = e.gym_id and x.user_id = e.user_id
        and x.event_type in ('PRESENCE_END','CHECK_OUT')
        and x.occurred_at > e.occurred_at
    );
$$;

create or replace function public.crowd_level(p_gym_id uuid)
returns table (level text, confidence text, sample_size int)
language plpgsql stable security definer set search_path = public as $$
declare v int; t jsonb;
begin
  select public.current_occupancy(p_gym_id) into v;
  select crowd_thresholds into t from public.gyms where id = p_gym_id;
  if v < 3 then
    return query select null::text, 'INSUFFICIENT_DATA'::text, v;   -- D-008
  elsif v < (t->>'moderate')::int      then return query select 'NOT_CROWDED','OK',v;
  elsif v < (t->>'crowded')::int       then return query select 'MODERATE','OK',v;
  elsif v < (t->>'very_crowded')::int  then return query select 'CROWDED','OK',v;
  else                                      return query select 'VERY_CROWDED','OK',v;
  end if;
end $$;
```

## 6. Broadcasts, notifications, issues, QR, audit

```sql
create table public.broadcasts (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  created_by   uuid not null references public.profiles(id),
  title        text not null check (length(trim(title)) between 3 and 120),
  body         text not null check (length(trim(body)) between 1 and 2000),
  category     text not null
                 check (category in ('HOLIDAY','MAINTENANCE','LOST_AND_FOUND','EQUIPMENT','EVENT','GENERAL')),
  audience     jsonb not null,                    -- {"type":"ACTIVE_MEMBERS"} | {"type":"SELECTED_MEMBERS","userIds":[...]}
  status       text not null default 'DRAFT'
                 check (status in ('DRAFT','SCHEDULED','PUBLISHED','CANCELLED')),
  publish_at   timestamptz,
  published_at timestamptz,
  recipient_count int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint scheduled_needs_publish_at check (status <> 'SCHEDULED' or publish_at is not null),
  constraint published_needs_published_at check (status <> 'PUBLISHED' or published_at is not null)
);
create index broadcasts_gym_status_idx on public.broadcasts (gym_id, status, publish_at);
create trigger set_updated_at before update on public.broadcasts
  for each row execute function public.tg_set_updated_at();

-- published broadcasts are immutable (docs/09 §5)
create or replace function public.tg_broadcast_immutable()
returns trigger language plpgsql as $$
begin
  if old.status = 'PUBLISHED'
     and (new.title, new.body, new.audience, new.category) is distinct from
         (old.title, old.body, old.audience, old.category) then
    raise exception 'BROADCAST_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger broadcast_immutable before update on public.broadcasts
  for each row execute function public.tg_broadcast_immutable();

create table public.broadcast_recipients (
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  delivered_at timestamptz,
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  primary key (broadcast_id, user_id)
);
create index broadcast_recipients_user_idx on public.broadcast_recipients (user_id, created_at desc);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  source_type text not null
                check (source_type in ('BROADCAST','MEMBERSHIP','PAYMENT','ISSUE','SYSTEM')),
  source_id   uuid,
  title       text not null,
  body        text not null,
  category    text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.notification_devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  platform     text not null check (platform in ('IOS','ANDROID','WEB')),
  push_token   text not null,
  is_active    boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, push_token)
);
create trigger set_updated_at before update on public.notification_devices
  for each row execute function public.tg_set_updated_at();

create table public.issues (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references public.gyms(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  category        text not null
                    check (category in ('EQUIPMENT','CLEANLINESS','STAFF','BILLING','SAFETY','OTHER')),
  title           text not null check (length(trim(title)) between 3 and 120),
  description     text not null check (length(trim(description)) between 1 and 2000),
  status          text not null default 'OPEN'
                    check (status in ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  acknowledged_at timestamptz,                        -- D-003
  resolved_at     timestamptz,
  resolved_by     uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index issues_gym_status_idx on public.issues (gym_id, status, created_at desc);
create index issues_user_idx       on public.issues (user_id, created_at desc);
create trigger set_updated_at before update on public.issues
  for each row execute function public.tg_set_updated_at();

create table public.issue_messages (
  id             uuid primary key default gen_random_uuid(),
  issue_id       uuid not null references public.issues(id) on delete cascade,
  gym_id         uuid not null references public.gyms(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id),
  author_role    text not null check (author_role in ('MEMBER','STAFF')),
  body           text not null check (length(trim(body)) between 1 and 2000),
  created_at     timestamptz not null default now()
);
create index issue_messages_issue_idx on public.issue_messages (issue_id, created_at);

create table public.issue_attachments (
  id           uuid primary key default gen_random_uuid(),
  issue_id     uuid not null references public.issues(id) on delete cascade,
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  uploaded_by  uuid not null references public.profiles(id),
  storage_path text not null,
  mime_type    text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 5242880),  -- 5 MB
  created_at   timestamptz not null default now()
);

create table public.member_qr_tokens (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  purpose    text not null check (purpose in ('COUNTER_PAYMENT','MEMBER_LOOKUP')),
  payment_id uuid references public.payments(id) on delete cascade,
  token_hash text not null unique,                 -- sha256 hex of the raw token
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint counter_token_has_payment
    check (purpose <> 'COUNTER_PAYMENT' or payment_id is not null)
);
create index member_qr_tokens_expiry_idx on public.member_qr_tokens (expires_at)
  where used_at is null;

create table public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_logs_gym_time_idx on public.audit_logs (gym_id, created_at desc);
create index audit_logs_entity_idx   on public.audit_logs (entity_type, entity_id);
```

## 7. Views

```sql
-- The single definition of "valid right now" (D-011). Use this everywhere.
create view public.v_current_memberships
with (security_invoker = true) as     -- IMPORTANT: inherits caller's RLS
select m.*,
       (m.end_at <= now() + make_interval(days => g.expiry_warning_days)) as is_expiring,
       greatest(0, ceil(extract(epoch from (m.end_at - now())) / 86400))::int as days_remaining
from public.memberships m
join public.gyms g on g.id = m.gym_id
where m.status = 'ACTIVE' and m.end_at > now();
```

> `security_invoker = true` is mandatory on every exposed view. Without it the view runs as its owner and **silently bypasses RLS**.

## 8. RLS

Enable on every table, then write policies. A table with RLS on and no policy denies everything — that is the correct default while you build.

```sql
alter table public.gyms                 enable row level security;
alter table public.profiles             enable row level security;
alter table public.gym_members          enable row level security;
alter table public.gym_staff            enable row level security;
alter table public.membership_plans     enable row level security;
alter table public.memberships          enable row level security;
alter table public.payments             enable row level security;
alter table public.gym_hours            enable row level security;
alter table public.gym_status_overrides enable row level security;
alter table public.attendance_events    enable row level security;
alter table public.crowd_snapshots      enable row level security;
alter table public.broadcasts           enable row level security;
alter table public.broadcast_recipients enable row level security;
alter table public.notifications        enable row level security;
alter table public.notification_devices enable row level security;
alter table public.issues               enable row level security;
alter table public.issue_messages       enable row level security;
alter table public.issue_attachments    enable row level security;
alter table public.member_qr_tokens     enable row level security;
alter table public.audit_logs           enable row level security;
```

### Policy matrix

`self` = the row belongs to `auth.uid()`. `staff` = `is_gym_staff(gym_id)`. `owner` = `is_gym_owner(gym_id)`. `—` = no policy (service key only).

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `gyms` | anon+auth (public fields via a view) | — | owner | — |
| `profiles` | self, or staff of a gym the profile is a member of | self (id = uid) | self | — |
| `gym_members` | self, staff | — (function) | staff | — |
| `gym_staff` | self, staff of same gym | — | owner | — |
| `membership_plans` | member, staff (active plans) | staff | staff | — |
| `memberships` | self, staff | — | — | — |
| `payments` | self, staff | — | — | — |
| `gym_hours` | member, staff, anon | staff | staff | staff |
| `gym_status_overrides` | member, staff | staff | staff | — |
| `attendance_events` | self, staff | self (`PRESENCE_*` only) | — | — |
| `crowd_snapshots` | member, staff | — | — | — |
| `broadcasts` | staff | staff | staff (non-published) | — |
| `broadcast_recipients` | self, staff | — | self (`read_at` only) | — |
| `notifications` | self | — | self (`read_at` only) | — |
| `notification_devices` | self | self | self | self |
| `issues` | self, staff | self | staff | — |
| `issue_messages` | author, issue owner, staff | self on own/staff issue | — | — |
| `issue_attachments` | issue owner, staff | self | — | — |
| `member_qr_tokens` | — | — | — | — |
| `audit_logs` | owner | — | — | — |

### Representative policies

```sql
-- profiles: a member reads their own; staff read profiles of their gym's members
create policy profiles_select_self on public.profiles
for select to authenticated using ((select auth.uid()) = id);

create policy profiles_select_staff on public.profiles
for select to authenticated using (
  exists (
    select 1 from public.gym_members gm
    where gm.user_id = profiles.id and public.is_gym_staff(gm.gym_id)
  )
);

create policy profiles_update_self on public.profiles
for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- memberships: read-only for everyone; all writes go through Edge Functions
create policy memberships_select on public.memberships
for select to authenticated
using ((select auth.uid()) = user_id or public.is_gym_staff(gym_id));

-- payments: same
create policy payments_select on public.payments
for select to authenticated
using ((select auth.uid()) = user_id or public.is_gym_staff(gym_id));

-- notifications: read own, mark own as read, nothing else
create policy notifications_select on public.notifications
for select to authenticated using ((select auth.uid()) = user_id);

create policy notifications_mark_read on public.notifications
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- issues: member sees own, staff see gym's; member creates own
create policy issues_select on public.issues
for select to authenticated
using ((select auth.uid()) = user_id or public.is_gym_staff(gym_id));

create policy issues_insert_member on public.issues
for insert to authenticated
with check ((select auth.uid()) = user_id and public.is_gym_member(gym_id));

create policy issues_update_staff on public.issues
for update to authenticated
using (public.is_gym_staff(gym_id)) with check (public.is_gym_staff(gym_id));

-- attendance: a member may only record their own presence
create policy attendance_insert_self on public.attendance_events
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and public.is_gym_member(gym_id)
  and event_type in ('PRESENCE_START','PRESENCE_END')
  and source_type = 'MANUAL'
);
```

> **The `notifications_mark_read` policy above lets a member rewrite `title`/`body` of their own notification.** Postgres RLS cannot restrict columns. Fix with a column grant:
> ```sql
> revoke update on public.notifications from authenticated;
> grant update (read_at) on public.notifications to authenticated;
> ```
> Do the same for `broadcast_recipients (read_at)`. This pattern is easy to forget — check it in review.

## 9. Scheduled jobs (`pg_cron`)

```sql
select cron.schedule('expire-memberships', '5 * * * *', $$
  update public.memberships set status = 'EXPIRED'
  where status = 'ACTIVE' and end_at < now();
$$);

select cron.schedule('publish-scheduled-broadcasts', '* * * * *', $$
  select public.publish_due_broadcasts();
$$);

select cron.schedule('cleanup-stale-pending', '0 * * * *', $$
  update public.payments set status = 'CANCELLED'
  where status = 'PENDING' and created_at < now() - interval '24 hours';
  update public.memberships set status = 'CANCELLED', cancelled_at = now()
  where status = 'PENDING_PAYMENT' and created_at < now() - interval '24 hours';
$$);

select cron.schedule('purge-used-qr-tokens', '0 3 * * *', $$
  delete from public.member_qr_tokens where expires_at < now() - interval '7 days';
$$);

select cron.schedule('auto-close-resolved-issues', '0 4 * * *', $$
  update public.issues set status = 'CLOSED'
  where status = 'RESOLVED' and resolved_at < now() - interval '7 days';
$$);

select cron.schedule('crowd-snapshot', '*/10 * * * *', $$
  insert into public.crowd_snapshots (gym_id, level, confidence, source_type, metadata)
  select g.id, c.level, c.confidence, 'QR', jsonb_build_object('sample_size', c.sample_size)
  from public.gyms g, lateral public.crowd_level(g.id) c
  where g.is_active;
$$);
```

## 10. Derived metrics (admin dashboard)

| KPI | Definition |
|---|---|
| Active members | `count(distinct user_id) from v_current_memberships where gym_id = $1` |
| Inactive members | `gym_members` (ACTIVE) minus the above |
| New members this month | `count(*) from gym_members where gym_id=$1 and joined_at >= date_trunc('month', now() at time zone tz)` |
| Revenue this month | `sum(amount_paise) from payments where gym_id=$1 and status='PAID' and paid_at >= <month start>` — **never** from plan prices |
| Expiring soon | `count(*) from v_current_memberships where gym_id=$1 and is_expiring` |
| Pending payments | `count(*) from payments where gym_id=$1 and status='PENDING'` |

All month boundaries are computed **in gym timezone**, then converted to UTC for the query.

## 11. Storage buckets

| Bucket | Public | Path pattern | Max size | MIME |
|---|---|---|---|---|
| `avatars` | no | `{user_id}/{uuid}.webp` | 2 MB | jpeg/png/webp |
| `issue-attachments` | no | `{gym_id}/{issue_id}/{uuid}.webp` | 5 MB | jpeg/png/webp |
| `gym-assets` | yes | `{gym_id}/logo.webp` | 1 MB | jpeg/png/webp/svg |

Private buckets are read via **signed URLs with a 60-minute TTL**, generated server-side. Storage RLS policies mirror the table policies: a member may write only under their own `{user_id}/` prefix.

## 12. Seed data (`supabase/seed/seed.sql`)

Must create, for local dev: 1 gym (`urban-gym`), 7 `gym_hours` rows, 3 plans (1/3/12 month), 1 owner staff user, 5 member users with a mix of `ACTIVE`/`EXPIRING`/`EXPIRED` memberships, 3 payments in different states, 2 issues, 1 published + 1 scheduled broadcast, ~40 attendance events across the last 14 days. Seeding must be idempotent (`on conflict do nothing`) so `supabase db reset` is repeatable.

## 13. Migration rules

- One logical change per migration; never edit a migration that has been applied to staging or production.
- File name: `<utc_timestamp>_<verb>_<subject>.sql`.
- Every migration that creates a table must, in the **same file**: enable RLS, add policies, add indexes, add the `updated_at` trigger.
- Destructive changes (drop column, narrow a type) go in two migrations across two releases: stop writing → then drop.
- After every migration: `supabase gen types typescript --local > packages/types/src/database.ts`.
