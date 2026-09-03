-- Phase 14. The outbox.
--
-- There is no WhatsApp provider yet: the Business API needs a verified Meta
-- Business Account and a dedicated number that do not exist. So this table is
-- honest about that. Rows are written `queued` and nothing moves them to
-- `sent`, because nothing has been sent. When a provider is connected, the
-- one function in lib/whatsapp.ts starts filling in `sent_at` or `error`, and
-- no other code changes.
--
-- Deliberately NOT modelled as fire-and-forget logging. A queued row is the
-- record that the gym intended to tell someone something, which is worth
-- keeping whether or not the message ever goes out.

create type public.whatsapp_message_type as enum ('fee_reminder', 'invoice', 'alert');
create type public.whatsapp_status as enum ('queued', 'sent', 'failed');

create table public.whatsapp_messages (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms (id) on delete cascade,
  member_id  uuid not null references public.profiles (id) on delete cascade,
  type       public.whatsapp_message_type not null,
  /*
   * The number as it was when the message was queued. Snapshotted rather than
   * joined, because if a member changes their number next month the honest
   * record is still "we tried to reach the old one".
   */
  phone      text not null,
  body       text not null,
  status     public.whatsapp_status not null default 'queued',
  -- Both null until a real provider fills them in.
  sent_at    timestamptz,
  error      text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index whatsapp_messages_gym_created_idx
  on public.whatsapp_messages (gym_id, created_at desc);
create index whatsapp_messages_member_idx
  on public.whatsapp_messages (member_id, created_at desc);

alter table public.whatsapp_messages enable row level security;

-- Staff only. A member has no use for the outbox, and the bodies quote other
-- members' amounts in the aggregate case.
create policy "staff manage whatsapp messages"
  on public.whatsapp_messages for all
  to authenticated
  using (public.is_staff(gym_id))
  with check (public.is_staff(gym_id));
