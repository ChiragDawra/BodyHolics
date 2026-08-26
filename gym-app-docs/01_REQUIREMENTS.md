# 01 — Product Requirements

## 1. One-paragraph summary

A gym management platform for a single urban gym in India, built multi-tenant from day one. Members self-register by scanning the gym's QR code and verifying their phone by OTP — the owner never types member data. Members buy a plan in-app (Razorpay) or pay cash/UPI at the counter by showing a short-lived QR the staff scans. The app shows whether the gym is open, how crowded it is, membership expiry, attendance, announcements, and lets members report issues. The owner gets a dashboard for members, revenue, hours, announcements, and issue handling.

**It should feel like an operational system, not a CRUD demo.** The difference is: server-authoritative money, real state machines, an audit trail, and idempotent operations.

## 2. Roles & capabilities

| Capability | Member | STAFF | OWNER |
|---|---|---|---|
| Self-register via QR + OTP | ✅ | — | — |
| View own profile / membership / payments / attendance | ✅ | — | — |
| Buy plan online / choose pay-at-counter | ✅ | — | — |
| Show member QR | ✅ | — | — |
| View gym status + crowd level | ✅ | ✅ | ✅ |
| Receive announcements | ✅ | — | — |
| Report / reply to issues | ✅ | reply only | reply only |
| Search & view members | — | ✅ | ✅ |
| Confirm counter payment | — | ✅ | ✅ |
| View revenue & payment history | — | view | ✅ |
| Manage plans (create / deactivate / price) | — | — | ✅ |
| Manage weekly hours | — | ✅ | ✅ |
| Override gym status | — | ✅ | ✅ |
| Create & publish broadcasts | — | ✅ | ✅ |
| Resolve / close issues | — | ✅ | ✅ |
| Cancel membership / issue refund | — | — | ✅ |
| Manage staff roles | — | — | ✅ |
| View audit log | — | — | ✅ |

## 3. MVP scope boundary

**In:** registration, plans, online + counter payments, membership lifecycle, gym hours + override, broadcasts, in-app alerts, attendance/presence, crowd level, issues, admin dashboard, audit log.

**Out (do not build, do not scaffold, do not add a "coming soon" tab):** AI coach, diet generator, social feed, body composition tracking, trainer marketplace, multi-gym SaaS billing, per-device location tracking, exact public headcount, fingerprint hardware integration itself, class booking, personal training scheduling, referral programs, in-app chat.

The **data model** must stay ready for fingerprint attendance (see D-008); the **code** must not contain a vendor SDK.

## 4. Prerequisites (block development if missing)

| # | Item | Blocks | Status |
|---|---|---|---|
| P1 | Supabase project (local + staging + prod) | everything | |
| P2 | **SMS provider configured for phone OTP** (MSG91/Twilio) with **DLT-registered template** for India | registration, all auth | ⚠️ see Q1 |
| P3 | Razorpay account — test keys now, live keys + KYC before launch | payments | ⚠️ see Q2 |
| P4 | Node LTS + pnpm + Git + GitHub repo | everything | |
| P5 | Domain name (for join links + webhook endpoint + admin) | QR onboarding, webhooks | |
| P6 | Apple / Google developer accounts | store release only | not needed until M7 |
| P7 | Expo account (EAS) | dev builds, push | needed by M2 |

> P2 is the single most common project-stalling item. Indian SMS requires DLT registration of sender ID and template through the operator, which takes days to weeks. Start it before writing code.

## 5. Member app — screen requirements

Exactly **three** bottom tabs. Alerts live behind the top-right bell.

### 5.1 Onboarding (`/onboarding`)

Flow: `Scan gym QR → gym confirmed → phone → OTP → name → plan → payment method → done`

| Requirement | Acceptance criterion |
|---|---|
| QR resolves the gym | Scanning a valid gym QR shows the gym name and logo before any data is entered |
| Invalid/unknown QR | Shows "We couldn't find that gym" with a retry, never a raw error |
| Phone OTP | Given a valid Indian mobile number, an OTP arrives and verification creates a session |
| OTP throttling | After 3 requests in 15 minutes the resend button is disabled with a countdown |
| No admin data entry | A member can complete registration end-to-end with zero admin involvement |
| Duplicate prevention | Registering again with the same verified phone signs in to the existing account; it never creates a second profile |
| Manual entry fallback | The gym slug can also be typed if the camera is unavailable |
| Abandonment | Closing the app mid-flow and reopening resumes at the last completed step |

### 5.2 Home (`/(tabs)/index`)

Above the fold, in this priority order:

1. **Gym status** — OPEN/CLOSED, with "closes at 10:30 PM" or "opens at 5:00 AM", and the override reason if any.
2. **Membership** — plan name, days remaining, a clear renew CTA when `EXPIRING`, a blocking state when `EXPIRED`.
3. **Crowd level** — badge + label. When `INSUFFICIENT_DATA`, show "Not enough data right now", **not** "Not crowded".
4. **"I'm at the gym"** toggle (D-008).
5. Attendance summary — visits this month, current streak.
6. Bell (unread count) + report-an-issue shortcut.

| Requirement | Acceptance criterion |
|---|---|
| Status accuracy | Member and admin apps show the same status within 60s of a change |
| Expired membership | Shows an unmissable expired state with a renew CTA; does not silently show "0 days left" |
| Pending payment | If a counter payment is pending, Home shows a persistent "Show QR at counter" card |
| Offline | Last-known values render from cache with a "last updated" timestamp, not a spinner or an error |

### 5.3 Activity (`/(tabs)/activity`)

- Attendance summary (this month / all time / streak).
- Month calendar with visited days marked; tapping a day shows that day's sessions.
- Attendance history list (paginated).
- Crowd history — typical busy hours by weekday, from `crowd_snapshots`.

| Requirement | Acceptance criterion |
|---|---|
| Timezone | A visit at 11:30 PM IST appears on that IST date, not the UTC one |
| Empty state | A new member sees an explanatory empty state, not a blank calendar |
| Crowd history privacy | Shows levels and typical patterns only — never a count |

### 5.4 Me (`/(tabs)/me`)

Sections: Profile (photo, name, phone, member code) · Membership (current + history) · Payment history (with status and receipt) · Attendance · My issues · Settings (notifications, language if any) · Logout.

| Requirement | Acceptance criterion |
|---|---|
| Payment history | Every payment shows amount, method, status, date; failed and cancelled ones are visible, not hidden |
| Membership history | All past periods listed; nothing is deleted on renewal |
| Photo upload | Images are compressed client-side to ≤2 MB WebP before upload |
| Logout | Clears the session and all cached member data |

### 5.5 Alerts (`/alerts`, from the bell)

Chronological notifications, unread badge, tap to read, category icons. Marking read is optimistic with rollback on failure.

### 5.6 Payment (`/payments/*`)

| Requirement | Acceptance criterion |
|---|---|
| Price display | The price shown is the price charged, always from the server |
| Online flow | After checkout the app shows "Confirming…" and resolves only when the server confirms (D-010) |
| Webhook delay | If confirmation takes >45s, show "We'll notify you when it's confirmed" and leave the app usable |
| Counter flow | Choosing counter payment creates a `PENDING` payment and shows the QR screen |
| QR freshness | The QR refreshes automatically before its 120s expiry; a stale QR is never displayed |
| Failure | A failed payment shows a retry that reuses the pending membership, not a duplicate one |

### 5.7 Issues (`/issues/*`)

Create (category, title, description, up to 3 photos), list, thread view with replies, status chip using the D-003 labels.

## 6. Admin dashboard — screen requirements

### 6.1 Dashboard

Six KPI cards: active members · inactive members · new this month · revenue this month · expiring soon · pending payments.

Attention queue (each item links to its detail): expiring memberships · pending/overdue payments · open issues · counter-payment registrations awaiting confirmation · broadcasts scheduled in the next 24h.

| Requirement | Acceptance criterion |
|---|---|
| Revenue source | Computed from `PAID` payments, never from plan prices (a refunded payment reduces it) |
| Load | The whole dashboard loads in one RPC round trip |
| Month boundary | "This month" is the gym's local month |

### 6.2 Members

- Paginated list: avatar (photo or initials), name, member code, phone, membership status chip, expiry.
- Search by name (partial), phone (exact), member code (exact).
- Filters: status, plan, expiring within N days.
- Detail: profile, membership history, payment history, attendance, issues, audit trail.
- **No "Add member" button.** If a walk-in has no smartphone, see Q4.

### 6.3 Plans

Create, edit (name/description/sort/active), deactivate. **Editing the price of a plan with sales creates a new plan version instead** — the UI must make this explicit rather than silently repricing history.

### 6.4 Payments

List with filters (status, method, date range), counter-payment confirmation via QR scanner, revenue summary, CSV export. Refunds are OWNER-only and go through Razorpay's dashboard in MVP (see Q7).

### 6.5 Gym status

Weekly hours editor (7 rows, closed toggle per day), current derived status, override control (status, window, reason, optional "notify members"), list of active/upcoming overrides.

### 6.6 Broadcasts

Composer (title, body, category, audience) with a **live recipient count preview before publishing**, schedule option, list of drafts/scheduled/published with read-rate per broadcast. Published broadcasts are read-only.

### 6.7 Issues

Queue grouped by status, thread view with staff reply, status transitions per D-003, resolution time metric.

### 6.8 Attendance

Daily/weekly visit volume, busy-hours heatmap by weekday, current occupancy (staff **may** see the number), crowd history.

## 7. Cross-cutting requirements

| Area | Requirement |
|---|---|
| Authorization | Every acceptance criterion in `docs/04_SECURITY_AND_AUTH.md` §18 must fail closed |
| Money | All amounts are integer paise end-to-end; formatting happens only at render |
| Timezone | All logic in UTC; all display in `gyms.timezone` |
| Errors | Every user-visible error is a mapped code from `docs/07_API_CONTRACT.md` §2 |
| Loading | Every async surface has explicit loading, empty, error, and offline states |
| Accessibility | Minimum 44×44pt touch targets; crowd level is never conveyed by colour alone — always colour + label |
| Language | English only in MVP; keep all user-facing strings in a single module so Hindi/Punjabi can be added later without refactoring |
| Analytics | No third-party analytics SDK in MVP; product metrics come from the database |

## 8. Definition of "production-ready" for this project

- [ ] A stranger can register, pay online, and be active without anyone touching the admin panel
- [ ] A stranger can register, pay cash at the counter, and be active in under 60 seconds of staff time
- [ ] The owner can close the gym tomorrow and every member's app reflects it
- [ ] No client can activate a membership without money moving
- [ ] Every privileged action is attributable to a person in `audit_logs`
- [ ] The database can be restored and the system works
- [ ] All twelve attacks in `docs/04_SECURITY_AND_AUTH.md` §18 fail
