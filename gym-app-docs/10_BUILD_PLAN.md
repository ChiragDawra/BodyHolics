# 10 — Build Plan

Build order matters more than build speed. Each milestone is **demoable** and leaves the system in a working state. Do not start a milestone before the previous one's exit criteria are green.

Ticket ids (`M2-T3`) are stable — reference them in commits and PRs.

---

## M0 — Foundations (no features)

| # | Ticket | Done when |
|---|---|---|
| M0-T1 | pnpm + Turborepo monorepo skeleton, tsconfig/eslint bases | `pnpm typecheck && pnpm lint` pass on an empty repo |
| M0-T2 | `apps/admin-web` Next.js app boots | `/` renders, `pnpm build` succeeds |
| M0-T3 | `apps/member-mobile` Expo app boots with 3 tabs | Runs on a device; tab bar has exactly Home/Activity/Me |
| M0-T4 | Supabase local stack + `supabase db reset` works | `supabase status` all green |
| M0-T5 | `packages/{domain,validation,types,ui,config}` scaffolded | Each builds and is importable from both apps |
| M0-T6 | CI pipeline per `docs/08` §4 | A PR runs all checks |
| M0-T7 | `.env.example` + secret-grep script | `check-no-secrets.sh` fails on a planted fake key |

**Exit:** both apps run, CI is green, nothing is in git that shouldn't be.

---

## M1 — Schema & security spine

| # | Ticket | Done when |
|---|---|---|
| M1-T1 | Migration: extensions, `tg_set_updated_at`, `gyms` | `db reset` clean |
| M1-T2 | Migration: `profiles`, `gym_members`, `gym_staff` + helper fns | `is_gym_staff/member/owner` behave correctly in tests |
| M1-T3 | Migration: `membership_plans`, `memberships`, `payments` + constraints/indexes | All constraints from `docs/05` present |
| M1-T4 | Migration: `gym_hours`, `gym_status_overrides` + `current_gym_status()` | Function returns correct values across timezone edge cases |
| M1-T5 | Migration: `attendance_events`, `crowd_snapshots` + `occupancy`/`crowd_level` | Bucketing tests pass, `INSUFFICIENT_DATA` under 3 |
| M1-T6 | Migration: `broadcasts`, `broadcast_recipients`, `notifications`, `notification_devices` | Immutability trigger rejects an edit to a PUBLISHED row |
| M1-T7 | Migration: `issues`, `issue_messages`, `issue_attachments`, `member_qr_tokens`, `audit_logs` | — |
| M1-T8 | RLS enabled + policies for every table; column grants for `read_at` | pgTAP suite covers `docs/04` §18 rows 1–6 |
| M1-T9 | `v_current_memberships` with `security_invoker` | A member sees only their own row through it |
| M1-T10 | `activate_membership_for_payment()` | Double call is a no-op; period stacking per D-004 |
| M1-T11 | Seed data per `docs/05` §12 | `db reset` produces a usable dataset |
| M1-T12 | `supabase gen types` wired into a script | `pnpm gen:types` works |
| M1-T13 | `packages/domain` state machines + unit tests | 100% coverage on `state/` |

**Exit:** the database can be reset from scratch, RLS tests pass, and no application code exists yet. This milestone is the foundation everything else stands on — do not rush it.

---

## M2 — Auth & registration

| # | Ticket | Depends | Done when |
|---|---|---|---|
| M2-T1 | SMS provider configured (see Q1) | — | A real OTP arrives on a real phone |
| M2-T2 | Supabase clients + session persistence (mobile & web) | M0 | Session survives an app restart |
| M2-T3 | `gym-by-slug` function | M1 | Returns public fields only; 404 on unknown |
| M2-T4 | QR scan screen + manual slug fallback | M2-T3 | Scanning the printed QR shows the gym name |
| M2-T5 | Phone + OTP screens with throttling UI | M2-T1 | 3-request limit enforced with a countdown |
| M2-T6 | `create-member-profile` function | M2-T3 | Phone taken from JWT; re-running is idempotent |
| M2-T7 | Profile screen (name, optional DOB) | M2-T6 | Completing it lands on the plan picker |
| M2-T8 | Admin login + route guard + `gym_staff` check | M1-T2 | A member's JWT cannot load any admin route |
| M2-T9 | Seed the first OWNER per environment | M1-T11 | Documented in the runbook |

**Exit:** a stranger can register from a QR and land on the plan screen. An owner can log in to an empty dashboard.

---

## M3 — Plans, payments, membership (the core)

| # | Ticket | Depends | Done when |
|---|---|---|---|
| M3-T1 | Admin plan CRUD | M2-T8 | Deactivating a plan hides it from members |
| M3-T2 | Member plan list | M3-T1 | Prices from the DB; inactive hidden |
| M3-T3 | `create-payment-order` (both methods) | M1-T3 | Idempotency-key replay returns the same order |
| M3-T4 | Razorpay checkout web page + deep-link return (D-009) | M3-T3 | A test payment completes and returns to the app |
| M3-T5 | `razorpay-webhook` with signature verification | M3-T3 | Bad signature → 401; replay → 200 no-op |
| M3-T6 | `payment-status` polling + "confirming" UI | M3-T5 | 45s timeout shows the deferred state |
| M3-T7 | `create-member-qr-token` + member QR screen with auto-refresh | M1-T7 | QR expires at 120s and refreshes at 100s |
| M3-T8 | Admin QR scanner + `confirm-counter-payment` | M3-T7 | Second scan of the same token → `QR_TOKEN_ALREADY_USED` |
| M3-T9 | Membership display on Home + Me | M1-T9 | Days remaining correct across a timezone boundary |
| M3-T10 | Payment history (member + admin) | M1-T3 | Failed/cancelled payments visible |
| M3-T11 | Renewal flow | M3-T3 | Renewing an ACTIVE membership stacks the period (D-004) |
| M3-T12 | Expiry cron + expiring/expired UI states | M1-T10 | A membership past `end_at` flips within the hour |
| M3-T13 | Reconciliation job (`docs/08` §7) | M3-T5 | A payment captured with the webhook disabled is corrected |

**Exit:** money works end to end, both ways, and cannot be faked. **This is the riskiest milestone — do not compress its testing.**

---

## M4 — Gym status, hours, admin dashboard

| # | Ticket | Done when |
|---|---|---|
| M4-T1 | Admin weekly hours editor | 7 rows, closed toggle, validation |
| M4-T2 | `current-gym-status` + member Home banner | Member and admin never disagree |
| M4-T3 | `override-gym-status` + admin control | Override auto-expires at `ends_at` |
| M4-T4 | `admin_dashboard_kpis` RPC + 6 KPI cards | One round trip; revenue from PAID payments |
| M4-T5 | `admin_attention_queue` RPC + queue UI | Each item links to its detail page |
| M4-T6 | Member list, search, filters, detail page | Search by name/phone/member code |
| M4-T7 | Initials-avatar fallback component | Renders when `avatar_path` is null |

**Exit:** the owner can run the gym's day from the dashboard.

---

## M5 — Broadcasts, alerts, issues

| # | Ticket | Done when |
|---|---|---|
| M5-T1 | `publish-broadcast` + audience resolution | Empty audience → `BROADCAST_EMPTY_AUDIENCE`, nothing published |
| M5-T2 | Admin composer with live recipient-count preview | Count matches what publishing produces |
| M5-T3 | Scheduling + `publish_due_broadcasts` cron | A scheduled broadcast publishes within a minute |
| M5-T4 | Member alerts screen + bell badge + Realtime | Unread count updates without a refresh |
| M5-T5 | `create-issue` + member issue screens with photo upload | Attachments land in a private bucket |
| M5-T6 | `reply-to-issue` + `update-issue-status` + thread UI | Reopen-on-reply within 7 days works (D-003) |
| M5-T7 | Admin issue queue + resolution metric | — |

**Exit:** the owner can talk to members and handle complaints in-app.

---

## M6 — Attendance, crowd, push

| # | Ticket | Done when |
|---|---|---|
| M6-T1 | `attendance-event` + "I'm at the gym" toggle | Duplicate start is a no-op |
| M6-T2 | Activity tab: summary, calendar, history | Gym-local dates |
| M6-T3 | `current-crowd` + Home badge | `INSUFFICIENT_DATA` renders as "not enough data" |
| M6-T4 | `crowd-snapshot` cron + crowd history charts | 14 days of history renders |
| M6-T5 | Admin attendance analytics + busy-hours heatmap | Staff may see counts |
| M6-T6 | EAS dev build + push credentials + `notification_devices` | A test push arrives on a device |
| M6-T7 | Push fan-out on the events in `docs/02` §10 | Failure is logged and never blocks the in-app alert |

**Exit:** members can see when to come, and get notified without opening the app.

---

## M7 — Hardening & launch

| # | Ticket | Done when |
|---|---|---|
| M7-T1 | Full security suite (`docs/04` §18) automated | Every box green in CI |
| M7-T2 | Rate limiting on every endpoint in `docs/07` §10 | Verified by test |
| M7-T3 | Error/empty/offline states audited on every screen | No raw error text anywhere |
| M7-T4 | Accessibility pass | 44pt targets; crowd not colour-only |
| M7-T5 | Privacy policy + account deletion flow | Required for both stores |
| M7-T6 | Observability + alerting per `docs/08` §10 | An alert fires on a planted failure |
| M7-T7 | Backup restore rehearsal on staging | Timed and documented |
| M7-T8 | Staging → production migration dry run | Documented rollback |
| M7-T9 | Store builds + submission | Review passed |
| M7-T10 | Owner training + printed QR at the counter | Owner completes a counter payment unaided |

**Exit:** the checklist in `docs/01` §8 is fully green.

---

## Dependency graph (critical path)

```
M0 ──► M1 ──► M2 ──► M3 ──► M7
              │       │
              └──► M4 ┴──► M5 ──► M6
```

M4 and M5 can overlap with the tail of M3. **M6 must not start before M3 is stable** — crowd data is worthless if memberships are broken.

## Per-ticket definition of done

Every ticket, no exceptions:

- [ ] `pnpm typecheck` + `pnpm lint` clean
- [ ] Unit tests for any new domain logic
- [ ] RLS test for any new table; integration test for any new function
- [ ] Types regenerated if the schema changed
- [ ] Loading / empty / error states implemented for any new screen
- [ ] Errors use codes from `docs/07` §2
- [ ] Audit log row for any privileged write
- [ ] Docs updated if a decision changed
- [ ] Works on a physical device (mobile tickets) — simulator only is not done

## Rough sizing

| Milestone | Relative effort |
|---|---|
| M0 | S |
| M1 | **L** — the most important, do not rush |
| M2 | M (blocked on SMS provider lead time) |
| M3 | **XL** — the core; budget the most testing here |
| M4 | M |
| M5 | M |
| M6 | M |
| M7 | L |
