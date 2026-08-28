# 00 — Decisions Register & Glossary

This is the tie-breaker document. If any other doc contradicts this one, **this one wins** and the other doc is a bug.

Each decision has an ID so code comments and PRs can reference it (`// see D-004`).

---

## Part A — Glossary (use these exact words)

| Term | Means | Does **not** mean |
|---|---|---|
| **User** | An `auth.users` row + a `profiles` row. Global identity, keyed by verified phone. | A member |
| **Member** | A user who has a `gym_members` row for a given gym. | A paying customer |
| **Membership** | A *purchased time period* — one row in `memberships` with `start_at`/`end_at`. | The person |
| **Plan** | A sellable template (`membership_plans`): name, price, duration. | A membership |
| **Renewal** | A **new** `memberships` row that begins when the previous one ends. | Editing `end_at` |
| **Staff** | A user with a `gym_staff` row. Roles: `OWNER`, `STAFF`. | An admin user table |
| **Counter payment** | Cash or UPI paid physically at the gym, confirmed by staff scanning the member's QR. | A pending online payment |
| **Gym status** | `OPEN`/`CLOSED`, derived from `gym_hours` unless an active override exists. | A stored column |
| **Crowd level** | A bucket: `NOT_CROWDED`/`MODERATE`/`CROWDED`/`VERY_CROWDED`. | A headcount |
| **Attendance event** | One normalized presence signal in `attendance_events`. | A check-in only |
| **Broadcast** | An owner-authored message + its resolved recipient rows. | A push notification |
| **Notification** | A per-user in-app alert record. Push is only a *delivery channel*. | A broadcast |
| **Issue** | A member-reported problem with a message thread. | A support ticket system |

---

## Part B — Resolved ambiguities

The original draft docs contained the contradictions below. Each is now resolved.

### D-001 — Tenancy: `profiles` is global, `gym_members` carries the gym link

**Was ambiguous:** `profiles.gym_id` (doc 05) vs. "gym membership association created" (doc 02 §5) vs. "model as multi-tenant from day one" (doc 02 §4). A `gym_id` on `profiles` makes a user belong to exactly one gym forever, which breaks multi-tenancy the moment gym #2 exists.

**Decided:**
- `profiles` = global identity (id, full_name, phone, avatar_path, dob). **No `gym_id`.**
- `gym_members` = the tenancy edge: `(gym_id, user_id, member_code, status, joined_at)`, unique on `(gym_id, user_id)`.
- Every business table still carries a denormalized `gym_id` for RLS performance.
- `member_code` (e.g. `UG-0142`) is the human-searchable "Member ID" the admin UI searches on.

### D-002 — `EXPIRING` is derived, never stored

**Was ambiguous:** doc 01 §7 lists `EXPIRING` as a membership state; doc 05 lists it as a stored status value.

**Decided:** stored `memberships.status` ∈ `PENDING_PAYMENT | ACTIVE | EXPIRED | CANCELLED`.
`EXPIRING` is a **view-level derivation**: `status = 'ACTIVE' AND end_at <= now() + interval '7 days'`.
`INACTIVE` is dropped — it was indistinguishable from `EXPIRED`.
Threshold `7 days` is configurable via `gyms.expiry_warning_days` (default 7).

### D-003 — Issue statuses are the four in doc 01 §7

**Was ambiguous:** doc 01 §6 says `Submitted → Owner Reviewing → In Progress → Resolved`; doc 01 §7 says `OPEN | IN_PROGRESS | RESOLVED | CLOSED`.

**Decided:** stored values are `OPEN | IN_PROGRESS | RESOLVED | CLOSED`. "Owner reviewing" is not a status — it is the `acknowledged_at` timestamp on `issues`. UI labels:

| Stored | Member UI label | Admin UI label |
|---|---|---|
| `OPEN` (no `acknowledged_at`) | Submitted | New |
| `OPEN` (with `acknowledged_at`) | Seen by gym | Acknowledged |
| `IN_PROGRESS` | In progress | In progress |
| `RESOLVED` | Resolved | Resolved |
| `CLOSED` | Closed | Closed |

### D-004 — Renewal creates a new `memberships` row

**Was ambiguous:** doc 01 §7 — "may create a new membership period or extend an existing active period according to business rules."

**Decided:** always a new row. Never mutate `end_at` of a paid period.
- If an `ACTIVE` membership exists, the new row's `start_at = existing.end_at`.
- Otherwise `start_at = activated_at` (the moment payment confirms).
- `end_at = start_at + plan.duration_days`.
- A user may hold at most one `PENDING_PAYMENT` membership per gym at a time (partial unique index).
- Overlapping `ACTIVE` rows are legal (stacked renewals); "current membership" = the `ACTIVE` row with the latest `end_at`.

### D-005 — Membership row is created *before* the payment row

**Was ambiguous:** `payments.membership_id` is `NOT NULL` but doc 07 §4 creates the order first.

**Decided:** `create-payment-order` inserts, in one transaction: `memberships` (`PENDING_PAYMENT`) → `payments` (`PENDING`, `membership_id` set). `payments.membership_id` is `NOT NULL`. If payment fails or is abandoned, a cleanup job cancels both after 24h.

### D-006 — Gym QR encodes `gyms.slug`, not a separate public id

**Was ambiguous:** doc 07 uses `gymPublicId`; doc 05 defines `slug`.

**Decided:** one field, `gyms.slug` (unique, lowercase, `[a-z0-9-]{3,40}`). QR payload is a URL:
`https://join.<domain>/j/<slug>` which deep-links into the app or falls back to a web landing page with store links. The API field name is `gymSlug` everywhere.

### D-007 — `gyms.status_override_enabled` is removed

Redundant. The authoritative override is "does a row in `gym_status_overrides` cover `now()`". A boolean flag creates a second source of truth that will drift.

### D-008 — Crowd MVP source is QR/presence check-ins, not passive device scanning

**Was underspecified and partly infeasible:** doc 02 §10–11 proposes `DEVICE_ACTIVITY` "anonymous device signals". Passive scanning of nearby devices (BLE/Wi-Fi) is not available to a managed Expo app, is a privacy liability, and would not survive app review.

**Decided for MVP:**
- Crowd is computed from `attendance_events` with `source_type IN ('QR','MANUAL')`.
- Members get a **"I'm at the gym"** action on Home → creates a `PRESENCE_START` event; auto-ends after `gyms.presence_ttl_minutes` (default 120) or on explicit end.
- Occupancy = count of distinct users with an open presence window in the last TTL.
- Buckets come from `gyms.crowd_thresholds` (jsonb, per-gym tunable) — see `docs/05_DATABASE_DESIGN.md`.
- If occupancy sample count `< 3`, return `level: null, confidence: 'INSUFFICIENT_DATA'` rather than guessing.
- Owner can pin a manual level (`MANUAL` source) for a time window.
- `DEVICE_ACTIVITY` and `FINGERPRINT` remain valid `source_type` values so the schema is ready, but **no code path produces them in MVP**.

> Flagged for you: see `docs/11_OPEN_QUESTIONS.md` Q3 — you may prefer a turnstile/QR-at-door flow instead.

### D-009 — Razorpay checkout runs in a web redirect, not a native SDK

`react-native-razorpay` requires a custom dev/prod build and does not run in Expo Go, which would block your fastest iteration loop. **Decided:** MVP uses Razorpay **Standard Checkout** on a small server-rendered page hosted on the admin domain, opened via `expo-web-browser`, returning to the app via a deep link. The result the app receives is **informational only** (D-010). Revisit after the app store build pipeline is stable.

### D-010 — The client's payment result is never authoritative

Only the verified `razorpay-webhook` transitions `payments.status → PAID` and activates the membership. The app shows a "confirming payment…" state and polls `GET payment-status` until the webhook lands (with a 90s timeout → "we'll notify you" state).

### D-011 — Membership expiry is a scheduled job + a query-level guard

A `pg_cron` job runs hourly: `ACTIVE` rows with `end_at < now()` → `EXPIRED`.
**But** no read path may trust `status` alone — "is this membership currently valid" is always `status = 'ACTIVE' AND end_at > now()`, expressed once in the `v_current_memberships` view.

### D-012 — Edge Function shared code is mirrored, not imported

Supabase Edge Functions run on Deno and cannot resolve pnpm workspace packages. Domain logic needed on the server lives in `supabase/functions/_shared/` as dependency-free `.ts`, and `packages/domain` re-exports a copy. A parity test (`pnpm test:shared-parity`) fails CI if the two drift.

### D-013 — Push notifications are optional in MVP

`notifications` rows are the source of truth and are always written. Expo push delivery is best-effort and requires a dev build with FCM/APNs credentials. Ship in-app alerts first; push is Milestone 6.

### D-014 — One gym, multi-tenant schema, no tenant-switching UI

MVP ships with a single `gyms` row. Every query is still gym-scoped. The member app resolves `gym_id` from the QR at onboarding and stores it in `gym_members`. No gym-switcher UI is built.

---

## Part C — Change log

| Date | ID | Change |
|---|---|---|
| 2026-08-26 | D-001…D-014 | Initial decisions register created from v1 draft docs |
