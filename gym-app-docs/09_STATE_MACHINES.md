# 09 — State Machines

Every status column in this system is a finite state machine. This file is the **only** place transitions are defined. Check constraints enforce the value set; these tables enforce the *transitions*.

Implementation rule: each machine has a pure function in `packages/domain/src/state/` of the shape

```ts
export function canTransition(from: Status, to: Status, ctx: Ctx): Result<void, TransitionError>
```

and a mirrored copy in `supabase/functions/_shared/state/` (see D-012). Any transition in application code goes through it. No `update ... set status = 'X'` without it.

---

## 1. Payment

**Values:** `PENDING | AUTHORIZED | PAID | FAILED | CANCELLED | REFUNDED`

```
                    ┌──────────► FAILED
                    │
PENDING ──► AUTHORIZED ──► PAID ──► REFUNDED
   │                          ▲
   ├──► CANCELLED             │
   │                          │
   └──────────────────────────┘   (counter payment: PENDING → PAID directly)
```

| From | To | Allowed by | Trigger |
|---|---|---|---|
| `PENDING` | `AUTHORIZED` | server | webhook `payment.authorized` |
| `PENDING` | `PAID` | server | webhook `payment.captured`, or `confirm-counter-payment` by staff |
| `PENDING` | `FAILED` | server | webhook `payment.failed` |
| `PENDING` | `CANCELLED` | server | member abandons; or 24h cleanup job |
| `AUTHORIZED` | `PAID` | server | webhook `payment.captured` |
| `AUTHORIZED` | `FAILED` | server | webhook `payment.failed` |
| `PAID` | `REFUNDED` | server (OWNER only) | webhook `refund.processed` |
| any | same value | server | **no-op, return 200** (webhook replay) |
| anything else | — | — | reject with `INVALID_PAYMENT_TRANSITION` |

**Terminal:** `PAID` (except → `REFUNDED`), `FAILED`, `CANCELLED`, `REFUNDED`.

**Idempotency:** the handler must `select ... for update` the payment row, compare current status, and return success without writing if the target status is already set. Replays are normal, not errors.

**Never:** a client-initiated transition to `PAID`. There is no API surface for it.

---

## 2. Membership

**Stored values:** `PENDING_PAYMENT | ACTIVE | EXPIRED | CANCELLED`
**Derived (never stored):** `EXPIRING` — see D-002.

```
PENDING_PAYMENT ──► ACTIVE ──► EXPIRED
       │               │
       └──► CANCELLED  └──► CANCELLED
```

| From | To | Allowed by | Trigger |
|---|---|---|---|
| `PENDING_PAYMENT` | `ACTIVE` | server | linked payment reached `PAID` |
| `PENDING_PAYMENT` | `CANCELLED` | server | payment `FAILED`/`CANCELLED`, or 24h cleanup |
| `ACTIVE` | `EXPIRED` | `pg_cron` job | `end_at < now()` |
| `ACTIVE` | `CANCELLED` | staff (`OWNER`) | refund or admin cancellation, always audited |
| `EXPIRED` | — | — | terminal; renewal creates a **new row** (D-004) |

**Activation is atomic with payment.** `activate_membership_for_payment(payment_id)` is a `security definer` SQL function that, in one transaction:
1. locks the payment row,
2. verifies `status = 'PAID'`,
3. computes `start_at` (D-004) and `end_at = start_at + plan.duration_days`,
4. sets `memberships.status = 'ACTIVE'`, `activated_at = now()`,
5. inserts an `audit_logs` row,
6. inserts a `notifications` row for the member.

Calling it twice for the same payment is a no-op.

**Derived states used in UI/queries:**

| Derived | Definition |
|---|---|
| `EXPIRING` | `status='ACTIVE' AND end_at BETWEEN now() AND now() + (gyms.expiry_warning_days \|\| ' days')::interval` |
| current membership | the `ACTIVE` row for `(gym_id,user_id)` with max `end_at` and `end_at > now()` |
| days remaining | `ceil(extract(epoch from (end_at - now()))/86400)` |

---

## 3. Gym status

**Values:** `OPEN | CLOSED`. Not stored on `gyms` — computed.

Resolution order (first match wins):

1. **Active override** — a `gym_status_overrides` row where `now() BETWEEN starts_at AND ends_at` → `forced_status`, `source = 'MANUAL_OVERRIDE'`.
2. **Schedule** — `gym_hours` row for the current weekday **in gym timezone**; `OPEN` if `is_closed = false` and local time ∈ `[opens_at, closes_at)`.
3. Fallback → `CLOSED`, `source = 'SCHEDULE'`.

```sql
-- gym_hours weekday uses ISO-ish 0=Sunday..6=Saturday, matching extract(dow)
-- ALWAYS convert: (now() at time zone gyms.timezone)::time
```

**Overnight hours** (e.g. `opens_at 05:00`, `closes_at 23:30`) are same-day only. If a gym ever needs 22:00→06:00, store two rows or add a `crosses_midnight` flag — **do not** silently wrap. Flagged in `docs/11_OPEN_QUESTIONS.md` Q5.

**Overrides expire automatically** — there is no "clear override" write; `ends_at` does the work. Staff "cancel override" sets `ends_at = now()`.

---

## 4. Issue

**Values:** `OPEN | IN_PROGRESS | RESOLVED | CLOSED`

```
OPEN ──► IN_PROGRESS ──► RESOLVED ──► CLOSED
  │                          │            ▲
  │                          └──► IN_PROGRESS (reopened)
  └──────────────────────────────────────┘  (closed without action)
```

| From | To | Actor | Notes |
|---|---|---|---|
| `OPEN` | `IN_PROGRESS` | staff | also sets `acknowledged_at` if null |
| `OPEN` | `CLOSED` | staff | duplicate/invalid; requires a closing message |
| `IN_PROGRESS` | `RESOLVED` | staff | sets `resolved_at`, `resolved_by` |
| `RESOLVED` | `IN_PROGRESS` | staff **or** member reply within 7 days | reopen |
| `RESOLVED` | `CLOSED` | `pg_cron` after 7 days, or member confirms | terminal |
| `CLOSED` | — | — | terminal; member must file a new issue |

Members may always **append messages**; appending never changes status except the reopen case above.

---

## 5. Broadcast

**Values:** `DRAFT | SCHEDULED | PUBLISHED | CANCELLED`

| From | To | Actor | Notes |
|---|---|---|---|
| `DRAFT` | `SCHEDULED` | staff | requires `publish_at > now()` |
| `DRAFT` | `PUBLISHED` | staff | immediate publish |
| `SCHEDULED` | `PUBLISHED` | `pg_cron` | at `publish_at` |
| `SCHEDULED` | `CANCELLED` | staff | before `publish_at` |
| `SCHEDULED` | `DRAFT` | staff | un-schedule |
| `PUBLISHED` | — | — | **terminal and immutable** |

**Publishing is the only moment recipients are resolved.** `publish-broadcast` resolves the audience server-side from live membership data and inserts `broadcast_recipients` + `notifications` rows in one transaction. Editing a `PUBLISHED` broadcast is not possible — issue a new one. Title/body of a published broadcast are protected by a trigger.

Audience resolution:

| `audience.type` | Recipients |
|---|---|
| `ALL_MEMBERS` | every `gym_members` row with `status='ACTIVE'` |
| `ACTIVE_MEMBERS` | members with a currently-valid membership (D-011) |
| `EXPIRING_MEMBERS` | members whose current membership is `EXPIRING` (D-002) |
| `INACTIVE_MEMBERS` | gym members with **no** currently-valid membership |
| `SELECTED_MEMBERS` | explicit `userIds[]`, each validated to belong to the gym |

---

## 6. Member QR token

**Values:** implicit — `VALID | USED | EXPIRED`, derived from `used_at` and `expires_at`.

| Condition | State |
|---|---|
| `used_at IS NULL AND expires_at > now()` | `VALID` |
| `used_at IS NOT NULL` | `USED` (terminal) |
| `used_at IS NULL AND expires_at <= now()` | `EXPIRED` (terminal) |

- TTL: **120 seconds** for `COUNTER_PAYMENT`, 300s for `MEMBER_LOOKUP`.
- Single use. Redemption does `update ... set used_at = now() where id = $1 and used_at is null returning *`; zero rows → `QR_TOKEN_ALREADY_USED`.
- Only the **hash** is stored (`token_hash = encode(digest(token,'sha256'),'hex')`). The raw token exists only in the QR image and the redeem request.
- The member app auto-refreshes the QR every 100s while the screen is open.

---

## 7. Attendance / presence

`attendance_events` is append-only. There is no status column; a presence *window* is derived:

- `PRESENCE_START` with no matching `PRESENCE_END` within `presence_ttl_minutes` → treated as ended at `occurred_at + ttl`.
- `CHECK_IN`/`CHECK_OUT` behave the same way for QR/fingerprint sources.
- Never `UPDATE` or `DELETE` an attendance event. Corrections are new events with `metadata.corrects = <id>`.

---

## 8. Transition-test checklist

For each machine above, integration tests must prove:

- [ ] every allowed transition succeeds
- [ ] every disallowed transition returns the documented error code
- [ ] repeating an allowed transition is a no-op, not an error (idempotency)
- [ ] a member-role JWT cannot perform any staff-only transition
- [ ] a staff JWT from gym A cannot transition a row in gym B
