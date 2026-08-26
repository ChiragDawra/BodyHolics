-- The complete privilege surface, in one file so it can be audited as one thing.
--
-- Why this exists at all: RLS and GRANT are two independent halves of the same
-- control. A policy without a grant denies everything; a grant without a policy
-- exposes everything. Supabase's default privileges on `public` did not extend
-- to tables created by these migrations, so every table came out with no SELECT
-- for anon, authenticated *or* service_role — which is to say the whole API was
-- dead and every Edge Function with it. Inheriting the grant half from an
-- invisible default was the mistake; it is stated explicitly from here on.
--
-- Rules for changing this file:
--   * It mirrors the policy matrix in docs/05 §8, verb for verb. A verb granted
--     here with no matching policy is dead weight; a policy with no grant here
--     is a feature that silently does not work.
--   * Three tables use column grants rather than table grants, because RLS
--     cannot restrict columns. Never replace one of those with a blanket grant.
--   * member_qr_tokens appears nowhere below, deliberately.

-- --------------------------------------------------------------- service_role
-- Edge Functions run as service_role and are the only writer for anything
-- privileged. They also need the tables no client may touch at all.

grant select, insert, update, delete on all tables in schema public to service_role;

-- ------------------------------------------------------------------ anon
-- Everything an unauthenticated caller needs to resolve a scanned QR code and
-- decide whether to sign up. Nothing else.

-- Column grant, not a table grant: expiry_warning_days, presence_ttl_minutes and
-- crowd_thresholds are operational tuning and are not anyone's business here.
grant select (id, slug, name, timezone, phone, address, logo_path, is_active)
  on public.gyms to anon;
grant select on public.gym_hours to anon;

-- --------------------------------------------------------- authenticated
-- Read

grant select on public.gyms                 to authenticated;
grant select on public.profiles             to authenticated;
grant select on public.gym_members          to authenticated;
grant select on public.gym_staff            to authenticated;
grant select on public.membership_plans     to authenticated;
grant select on public.memberships          to authenticated;
grant select on public.payments             to authenticated;
grant select on public.gym_hours            to authenticated;
grant select on public.gym_status_overrides to authenticated;
grant select on public.attendance_events    to authenticated;
grant select on public.broadcasts           to authenticated;
grant select on public.broadcast_recipients to authenticated;
grant select on public.notifications        to authenticated;
grant select on public.notification_devices to authenticated;
grant select on public.issues               to authenticated;
grant select on public.issue_messages       to authenticated;
grant select on public.issue_attachments    to authenticated;
grant select on public.audit_logs           to authenticated;
grant select on public.v_current_memberships to authenticated;

-- crowd_snapshots.metadata holds sample_size, an exact headcount. docs/05 §5 says
-- that must never reach a member, and a policy cannot express "not that column".
grant select (id, gym_id, captured_at, level, confidence, source_type)
  on public.crowd_snapshots to authenticated;

-- Write
--
-- memberships and payments are absent on purpose. A membership becomes ACTIVE
-- only through a verified Razorpay webhook or a staff counter-confirmation, both
-- of which run as service_role (CLAUDE.md rule 1). No client writes to either,
-- so no client is granted the verb.

grant insert         on public.profiles             to authenticated;
grant update         on public.profiles             to authenticated;
grant update         on public.gyms                 to authenticated;
grant update         on public.gym_members          to authenticated;
grant update         on public.gym_staff            to authenticated;
grant insert, update on public.membership_plans     to authenticated;
grant insert, update, delete on public.gym_hours    to authenticated;
grant insert, update on public.gym_status_overrides to authenticated;
grant insert         on public.attendance_events    to authenticated;
grant insert, update on public.broadcasts           to authenticated;
grant insert, update on public.issues               to authenticated;
grant insert         on public.issue_messages       to authenticated;
grant insert         on public.issue_attachments    to authenticated;
grant insert, update, delete on public.notification_devices to authenticated;

-- The two column grants that carry real weight. The policies on these tables say
-- "your own row"; without the column restriction that would also mean "your own
-- row's title and body", letting a member rewrite the text of a notification
-- they were sent, or a broadcast receipt (docs/05 §8).
grant update (read_at) on public.notifications        to authenticated;
grant update (read_at) on public.broadcast_recipients to authenticated;

-- ------------------------------------------------------------------ sequences
-- Every primary key here defaults to gen_random_uuid(), so there are no
-- sequences to grant. This is stated rather than omitted so that adding a
-- serial column later is a visible decision.
