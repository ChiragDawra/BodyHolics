-- docs/05 §6 — broadcasts, notifications, issues, QR tokens, audit trail.

-- ---------------------------------------------------------------- broadcasts

create table public.broadcasts (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references public.gyms(id) on delete cascade,
  created_by      uuid not null references public.profiles(id),
  title           text not null check (length(trim(title)) between 3 and 120),
  body            text not null check (length(trim(body)) between 1 and 2000),
  category        text not null
                    check (category in ('HOLIDAY','MAINTENANCE','LOST_AND_FOUND','EQUIPMENT','EVENT','GENERAL')),
  audience        jsonb not null,
  status          text not null default 'DRAFT'
                    check (status in ('DRAFT','SCHEDULED','PUBLISHED','CANCELLED')),
  publish_at      timestamptz,
  published_at    timestamptz,
  recipient_count int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint scheduled_needs_publish_at   check (status <> 'SCHEDULED' or publish_at is not null),
  constraint published_needs_published_at check (status <> 'PUBLISHED' or published_at is not null)
);

create index broadcasts_gym_status_idx on public.broadcasts (gym_id, status, publish_at);

create trigger set_updated_at before update on public.broadcasts
  for each row execute function public.tg_set_updated_at();

-- A published broadcast is terminal and immutable (docs/09 §5). Recipients have
-- already been notified, so rewriting the text would rewrite what they were told.
create or replace function public.tg_broadcast_immutable()
returns trigger language plpgsql set search_path = public as $$
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

-- ------------------------------------------------------------- notifications

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

-- ------------------------------------------------------------------- issues

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
  acknowledged_at timestamptz,                                   -- D-003
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
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 5242880),   -- 5 MB
  created_at   timestamptz not null default now()
);

create index issue_attachments_issue_idx on public.issue_attachments (issue_id, created_at);

-- ---------------------------------------------------------- member_qr_tokens

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

-- ---------------------------------------------------------------- audit_logs

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

-- ---------------------------------------------------------------- RLS

alter table public.broadcasts           enable row level security;
alter table public.broadcast_recipients enable row level security;
alter table public.notifications        enable row level security;
alter table public.notification_devices enable row level security;
alter table public.issues               enable row level security;
alter table public.issue_messages       enable row level security;
alter table public.issue_attachments    enable row level security;
alter table public.member_qr_tokens     enable row level security;
alter table public.audit_logs           enable row level security;

-- broadcasts: the drafting surface is staff-only. Members never read this table;
-- what reaches them is the notifications row written at publish time.
create policy broadcasts_select_staff on public.broadcasts
for select to authenticated using (public.is_gym_staff(gym_id));

create policy broadcasts_insert_staff on public.broadcasts
for insert to authenticated
with check (public.is_gym_staff(gym_id) and (select auth.uid()) = created_by);

-- PUBLISHED is terminal, so it is excluded from the policy as well as guarded by
-- the trigger: two independent stops on the same transition.
create policy broadcasts_update_staff on public.broadcasts
for update to authenticated
using (public.is_gym_staff(gym_id) and status <> 'PUBLISHED')
with check (public.is_gym_staff(gym_id));

create policy broadcast_recipients_select on public.broadcast_recipients
for select to authenticated
using ((select auth.uid()) = user_id or public.is_gym_staff(gym_id));

create policy broadcast_recipients_mark_read on public.broadcast_recipients
for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy notifications_select on public.notifications
for select to authenticated using ((select auth.uid()) = user_id);

create policy notifications_mark_read on public.notifications
for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- The two policies above say "your own row", not "your own read_at". Postgres
-- RLS cannot restrict columns, so on its own that would let a member rewrite the
-- title and body of a notification they were sent (docs/05 §8). The column grant
-- that prevents it is in 20260826090900_grant_table_privileges.sql.

-- notification_devices: a push token is a delivery capability for one person.
create policy notification_devices_select on public.notification_devices
for select to authenticated using ((select auth.uid()) = user_id);

create policy notification_devices_insert on public.notification_devices
for insert to authenticated with check ((select auth.uid()) = user_id);

create policy notification_devices_update on public.notification_devices
for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy notification_devices_delete on public.notification_devices
for delete to authenticated using ((select auth.uid()) = user_id);

-- issues
create policy issues_select on public.issues
for select to authenticated
using ((select auth.uid()) = user_id or public.is_gym_staff(gym_id));

create policy issues_insert_member on public.issues
for insert to authenticated
with check ((select auth.uid()) = user_id and public.is_gym_member(gym_id));

create policy issues_update_staff on public.issues
for update to authenticated
using (public.is_gym_staff(gym_id)) with check (public.is_gym_staff(gym_id));

-- issue_messages: visible to the thread's two sides and to staff. A member may
-- only post on their own issue; staff may post on any issue at their gym.
create policy issue_messages_select on public.issue_messages
for select to authenticated
using (
  public.is_gym_staff(gym_id)
  or exists (
    select 1 from public.issues i
    where i.id = issue_messages.issue_id and i.user_id = (select auth.uid())
  )
);

create policy issue_messages_insert on public.issue_messages
for insert to authenticated
with check (
  (select auth.uid()) = author_user_id
  and (
    (author_role = 'STAFF' and public.is_gym_staff(gym_id))
    or (
      author_role = 'MEMBER'
      and exists (
        select 1 from public.issues i
        where i.id = issue_messages.issue_id
          and i.user_id = (select auth.uid())
          and i.gym_id  = issue_messages.gym_id
      )
    )
  )
);

create policy issue_attachments_select on public.issue_attachments
for select to authenticated
using (
  public.is_gym_staff(gym_id)
  or exists (
    select 1 from public.issues i
    where i.id = issue_attachments.issue_id and i.user_id = (select auth.uid())
  )
);

create policy issue_attachments_insert on public.issue_attachments
for insert to authenticated
with check (
  (select auth.uid()) = uploaded_by
  and exists (
    select 1 from public.issues i
    where i.id = issue_attachments.issue_id
      and i.gym_id = issue_attachments.gym_id
      and (i.user_id = (select auth.uid()) or public.is_gym_staff(i.gym_id))
  )
);

-- member_qr_tokens: no policy at all. RLS is on, so every client read and write
-- is denied; only the service key inside an Edge Function touches this table. A
-- readable token_hash would let a scanner replay someone else's counter payment.

-- audit_logs: append-only from the service key, readable by the owner.
create policy audit_logs_select_owner on public.audit_logs
for select to authenticated using (public.is_gym_owner(gym_id));
