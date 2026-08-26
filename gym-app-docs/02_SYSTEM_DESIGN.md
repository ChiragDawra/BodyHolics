# 02 — System Design

## 1. Architecture

```text
┌──────────────────────┐        ┌──────────────────────┐
│   Member App         │        │   Admin Web          │
│   Expo / RN          │        │   Next.js            │
│   • anon key only    │        │   • anon key only    │
└──────────┬───────────┘        └──────────┬───────────┘
           │  JWT                          │  JWT
           ├───────────────┬───────────────┤
           ▼               ▼               ▼
   ┌───────────────┐  ┌──────────────────────────┐
   │  PostgREST    │  │  Edge Functions (Deno)   │
   │  RLS-scoped   │  │  service key, trusted    │
   │  reads/writes │  │  business logic          │
   └───────┬───────┘  └───┬──────────┬───────────┘
           │              │          │
           ▼              ▼          ▼
   ┌────────────────────────────┐  ┌──────────┐
   │  PostgreSQL                │  │ Razorpay │
   │  RLS · constraints ·       │  └────┬─────┘
   │  SECURITY DEFINER fns ·    │       │ webhook
   │  pg_cron                   │◄──────┘
   └────────────────────────────┘
           │
           ├── Supabase Auth (phone OTP, JWT)
           ├── Supabase Storage (private buckets, signed URLs)
           └── Supabase Realtime (gym status, alerts, issue thread)
```

**Trust boundary:** everything above the Edge Function row is untrusted. Both clients hold only the anon/publishable key and a user JWT. The service key exists exclusively inside Edge Functions.

## 2. What lives where

| Concern | Client | PostgREST + RLS | Edge Function | Postgres function |
|---|---|---|---|---|
| Navigation, forms, layout | ✅ | | | |
| Reading own data | ✅ | ✅ | | |
| Admin lists & search | ✅ | ✅ | | |
| Membership activation | | | ✅ | ✅ (atomic) |
| Payment order creation | | | ✅ | |
| Webhook verification | | | ✅ | |
| Counter confirmation | | | ✅ | ✅ |
| Broadcast audience resolution | | | ✅ | |
| QR token mint/redeem | | | ✅ | |
| Gym status derivation | | ✅ (via fn) | | ✅ |
| Crowd bucketing | | ✅ (via fn) | | ✅ |
| Expiry sweep | | | | ✅ (pg_cron) |

Rule of thumb: **if getting it wrong costs money or leaks data, it is not in the client.**

## 3. Multi-tenancy

MVP has one gym; the schema behaves as if it had many (D-014).

```
auth.uid()  →  gym_members / gym_staff  →  gym_id  →  visible rows
```

Every business table carries `gym_id` directly (denormalized on purpose — RLS policies that join two levels deep get slow and hard to reason about). Every RLS policy routes through `is_gym_member(gym_id)` or `is_gym_staff(gym_id)`.

**Cross-tenant reads must return 404, not 403** (see `docs/07` §1).

## 4. Registration sequence

```
Member                 App                 Edge Fn            Supabase Auth      DB
  │  scan QR            │                     │                    │             │
  │────────────────────►│                     │                    │             │
  │                     │  GET gym-by-slug    │                    │             │
  │                     │────────────────────►│───────────────────────────────► │
  │                     │◄─── gym name/logo ──│                    │             │
  │  enter phone        │                     │                    │             │
  │────────────────────►│  signInWithOtp ─────────────────────────►│             │
  │  ◄──── SMS OTP ─────────────────────────────────────────────── │             │
  │  enter OTP          │                     │                    │             │
  │────────────────────►│  verifyOtp ────────────────────────────► │             │
  │                     │◄──────── session (JWT, phone verified) ──│             │
  │  enter name         │                     │                    │             │
  │────────────────────►│ create-member-profile                    │             │
  │                     │────────────────────►│  upsert profile ──────────────► │
  │                     │                     │  insert gym_members ──────────► │
  │                     │◄── profile+member ──│                    │             │
  │  pick plan          │                     │                    │             │
  │────────────────────►│ create-payment-order│                    │             │
  │                     │────────────────────►│  membership PENDING_PAYMENT ──► │
  │                     │                     │  payment PENDING ─────────────► │
  │                     │◄── order / qr path ─│                    │             │
```

**Note the ordering:** the session exists *before* the profile. `create-member-profile` reads the phone from the JWT, never from the body.

## 5. Online payment sequence

```
App          create-payment-order      Razorpay        razorpay-webhook       DB
 │  planId          │                     │                   │                │
 │─────────────────►│  load plan price ─────────────────────────────────────► │
 │                  │  insert membership + payment ──────────────────────────► │
 │                  │  create order ─────►│                   │                │
 │◄── orderId ──────│                     │                   │                │
 │  open checkout ─────────────────────► │                   │                │
 │                                        │  user pays        │                │
 │◄── client result (INFORMATIONAL) ──── │                   │                │
 │                                        │── webhook ───────►│                │
 │                                        │                   │ verify HMAC    │
 │                                        │                   │ payment=PAID ─►│
 │                                        │                   │ activate ─────►│
 │  poll payment-status ──────────────────────────────────────────────────────►│
 │◄── PAID + membership ACTIVE ───────────────────────────────────────────────│
```

**Failure modes and their handling:**

| Failure | Handling |
|---|---|
| Webhook arrives before the client returns | Fine — polling immediately sees `PAID` |
| Webhook delayed minutes | App shows "we'll notify you"; the notification row is created on arrival |
| Webhook never arrives | Hourly reconciliation job queries Razorpay for orders `PENDING` >30 min and syncs (see `docs/08` §7) |
| Webhook replayed | Event id dedupe + state-machine no-op |
| Client crashes after payment | Webhook still activates; member sees it on next open |
| Amount mismatch | Do **not** activate; write an audit row and alert |
| Duplicate order attempt | Blocked by the single-`PENDING_PAYMENT` index |

## 6. Counter payment sequence

```
Member App                      Staff App (admin-web)          Edge Fn            DB
 │ create-payment-order(CASH_COUNTER) ──────────────────────────────────────────►│ payment PENDING
 │ create-member-qr-token(paymentId) ───────────────────────────────────────────►│ token_hash, 120s
 │ show QR                            │                            │              │
 │                                    │ scan QR → raw token        │              │
 │                                    │ confirm-counter-payment ──►│              │
 │                                    │                            │ redeem token (atomic) ─►│
 │                                    │                            │ payment PAID ──────────►│
 │                                    │                            │ activate ──────────────►│
 │                                    │◄── member + membership ────│              │
 │◄── realtime / poll: ACTIVE ────────────────────────────────────────────────────│
```

Staff sees the member's name, photo, plan, and amount **after** redeeming the token — the scan is the lookup. There is no "search member then mark paid" path, because that path can be abused without the member present.

## 7. Gym status

See `docs/09_STATE_MACHINES.md` §3 for resolution order. Distribution:

- Member app: fetch on foreground + every 60s while Home is visible.
- Optional: Realtime subscription on `gym_status_overrides` for instant propagation of an owner override.
- Admin: same function, so both clients cannot disagree.

## 8. Broadcast delivery

```
Owner composes → preview recipient count (dry-run resolve)
      ↓
publish-broadcast  ── transaction ──┐
      ↓                             │ insert broadcast_recipients (N rows)
  broadcast PUBLISHED               │ insert notifications (N rows)
      ↓                             │ set recipient_count
  push fan-out (best effort, async) ┘
      ↓
member bell badge updates via Realtime on notifications
```

`notifications` is the source of truth (D-013). Push is a delivery attempt whose failure is logged and never blocks.

For a gym with a few hundred members, N inserts in one statement is fine. Above ~10k recipients, batch in chunks of 1000 and move fan-out to a queue.

## 9. Attendance & crowd (D-008)

```
member taps "I'm at the gym"
      ↓
attendance-event PRESENCE_START (source MANUAL, user forced to caller)
      ↓
occupancy = distinct users with an open presence window < presence_ttl_minutes
      ↓
crowd_level() buckets via gyms.crowd_thresholds
      ↓
sample_size < 3 → INSUFFICIENT_DATA (never a fabricated level)
      ↓
member sees a level; staff may see the count
```

`crowd_snapshots` is written every 10 minutes by `pg_cron` to build history.

**Future fingerprint path** replaces only the event producer:

```
turnstile/fingerprint device → ingest endpoint (service key)
   → attendance_events (source FINGERPRINT, CHECK_IN/CHECK_OUT)
   → same occupancy + bucketing code, unchanged
```

The adapter interface lives in `docs/08` §12. No client code changes.

## 10. Notifications

| Event | Notification | Push |
|---|---|---|
| Membership activated | ✅ | ✅ |
| Membership expiring (T-7, T-3, T-1) | ✅ (pg_cron) | ✅ |
| Membership expired | ✅ | ✅ |
| Payment failed | ✅ | ✅ |
| Broadcast published | ✅ | ✅ if category ≠ GENERAL |
| Issue acknowledged / replied / resolved | ✅ | ✅ |
| Gym status overridden with notify=true | ✅ (as a broadcast) | ✅ |

Expiry reminders are deduped by `(user_id, membership_id, day_offset)` so a re-run of the job never double-notifies.

## 11. Realtime usage

Use Supabase Realtime for exactly three things:

1. `notifications` insert for the current user → bell badge.
2. `gym_status_overrides` insert/update → status banner.
3. `issue_messages` insert for an open thread → live reply.

Everything else uses TanStack Query with sensible `staleTime`. Realtime subscriptions respect RLS but cost a connection — do not subscribe to tables "just in case".

## 12. Time

- Persist UTC (`timestamptz`).
- `gyms.timezone` is the only source of local time; read it once and pass it down.
- Convert at the boundary: DB → UTC instant → format in gym tz for display.
- "Today", "this month", and calendar grouping are **gym-local**, computed as `(ts at time zone gyms.timezone)::date`.
- Never call `new Date().getTimezoneOffset()` for business logic — the member's phone may be travelling.

## 13. Idempotency policy

| Operation | Idempotency mechanism |
|---|---|
| `create-payment-order` | `Idempotency-Key` header → unique `payments.idempotency_key` |
| `razorpay-webhook` | provider event id dedupe + state-machine no-op |
| `confirm-counter-payment` | single-use QR token (`used_at` set atomically) |
| `activate_membership_for_payment` | returns early if already `ACTIVE` |
| `publish-broadcast` | status guard: only `DRAFT`/`SCHEDULED` can publish |
| `create-member-profile` | `on conflict (gym_id,user_id) do nothing` |
| `attendance-event` | open-presence unique index |
| notifications from cron | dedupe key in `metadata` |

**Every one of these is tested by calling the operation twice and asserting the second call changed nothing.**

## 14. Degradation

| Dependency down | Behaviour |
|---|---|
| Razorpay | Online payment disabled with a clear message; counter payment still works |
| SMS provider | Registration blocked (unavoidable); existing sessions unaffected |
| Realtime | Falls back to polling; nothing breaks |
| Push provider | In-app alerts unaffected |
| Storage | Photos show initials avatars; issue creation works without attachments |
| The whole backend | App shows cached membership + last known status with a timestamp |
