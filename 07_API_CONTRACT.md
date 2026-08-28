# 07 — API & Integration Contract

Two access paths:

| Path | Use for | Auth |
|---|---|---|
| **Direct Supabase queries** (PostgREST) | Simple reads protected by RLS: my memberships, my payments, my notifications, plan list, gym hours, admin lists | User JWT |
| **Edge Functions** | Anything privileged, atomic, or involving a third party | User JWT + server-side role check |

If a read is expressible as an RLS-protected `select`, **do not write an Edge Function for it.**

---

## 1. Universal conventions

### Request

```
POST https://<project>.supabase.co/functions/v1/<function-name>
Authorization: Bearer <supabase access token>
Content-Type: application/json
X-Request-Id: <uuid>          # optional, echoed back; generate client-side
Idempotency-Key: <uuid>       # required on: create-payment-order, confirm-counter-payment
```

- Every function validates its body with a Zod schema from `supabase/functions/_shared/schemas/`.
- `gym_id` is **never** taken from the body except where explicitly noted (`gymSlug` at onboarding). It is resolved server-side from the caller's `gym_members`/`gym_staff` row.
- Unknown body fields are stripped (`.strict()` where the shape is closed).

### Response envelope

Success — HTTP 200/201, the resource directly:

```json
{ "data": { ... }, "requestId": "..." }
```

Failure — appropriate HTTP status:

```json
{
  "error": {
    "code": "PAYMENT_ALREADY_PROCESSED",
    "message": "This payment has already been processed.",
    "details": null
  },
  "requestId": "..."
}
```

`message` is safe to render to the user verbatim. `details` is `null` in production for 5xx; for 400 validation errors it is a field→message map.

```ts
// packages/domain/src/api.ts  (mirrored in supabase/functions/_shared/api.ts)
export type ApiSuccess<T> = { data: T; requestId: string };
export type ApiFailure = {
  error: { code: ErrorCode; message: string; details: Record<string, string> | null };
  requestId: string;
};
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;
```

### Status codes

| Code | When |
|---|---|
| 200 | success |
| 201 | resource created |
| 400 | validation failure (`VALIDATION_FAILED`) |
| 401 | missing/invalid JWT (`UNAUTHENTICATED`) |
| 403 | authenticated but not permitted (`FORBIDDEN`, `NOT_GYM_STAFF`, `CROSS_TENANT_ACCESS`) |
| 404 | resource not found *or* not visible to this caller — never distinguish the two |
| 409 | state conflict (`INVALID_*_TRANSITION`, `QR_TOKEN_ALREADY_USED`) |
| 422 | semantically invalid (`PLAN_INACTIVE`, `MEMBERSHIP_ALREADY_PENDING`) |
| 429 | rate limited (`RATE_LIMITED`) |
| 500 | unexpected (`INTERNAL_ERROR`) — log full detail server-side, return nothing useful |

**404 vs 403:** if a caller asks for a row in another gym, return **404**, not 403. 403 confirms the row exists.

---

## 2. Error code registry

This is the complete list. Adding a code means adding it here **and** to `ErrorCode` in `packages/domain/src/errors.ts`.

| Code | HTTP | User-facing message |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Please check the highlighted fields. |
| `UNAUTHENTICATED` | 401 | Please sign in again. |
| `FORBIDDEN` | 403 | You don't have access to this. |
| `NOT_GYM_STAFF` | 403 | Staff access is required for this action. |
| `NOT_GYM_MEMBER` | 403 | You're not registered at this gym yet. |
| `CROSS_TENANT_ACCESS` | 403 | You don't have access to this. |
| `NOT_FOUND` | 404 | We couldn't find that. |
| `GYM_NOT_FOUND` | 404 | We couldn't find that gym. Check the QR code. |
| `GYM_INACTIVE` | 422 | This gym isn't accepting new members right now. |
| `PLAN_NOT_FOUND` | 404 | That plan is no longer available. |
| `PLAN_INACTIVE` | 422 | That plan is no longer available. |
| `MEMBERSHIP_ALREADY_PENDING` | 409 | You already have a payment in progress. |
| `INVALID_MEMBERSHIP_TRANSITION` | 409 | This membership can't be changed that way. |
| `PAYMENT_NOT_FOUND` | 404 | We couldn't find that payment. |
| `PAYMENT_ALREADY_PROCESSED` | 409 | This payment has already been processed. |
| `PAYMENT_NOT_PENDING` | 409 | This payment is no longer awaiting confirmation. |
| `INVALID_PAYMENT_TRANSITION` | 409 | This payment can't be updated that way. |
| `PAYMENT_PROVIDER_ERROR` | 502 | We couldn't reach the payment provider. Please try again. |
| `WEBHOOK_SIGNATURE_INVALID` | 401 | *(never shown to a user)* |
| `QR_TOKEN_INVALID` | 400 | This code isn't valid. Ask the member to refresh it. |
| `QR_TOKEN_EXPIRED` | 409 | This code has expired. Ask the member to refresh it. |
| `QR_TOKEN_ALREADY_USED` | 409 | This code has already been used. |
| `BROADCAST_IMMUTABLE` | 409 | Published announcements can't be edited. |
| `BROADCAST_EMPTY_AUDIENCE` | 422 | No members match this audience. |
| `ISSUE_CLOSED` | 409 | This issue is closed. Please raise a new one. |
| `INVALID_ISSUE_TRANSITION` | 409 | This issue can't be updated that way. |
| `OVERRIDE_RANGE_INVALID` | 400 | The end time must be after the start time. |
| `FILE_TOO_LARGE` | 400 | That file is too large. |
| `UNSUPPORTED_FILE_TYPE` | 400 | Please upload a JPG, PNG, or WebP image. |
| `RATE_LIMITED` | 429 | Too many attempts. Please wait a moment. |
| `INTERNAL_ERROR` | 500 | Something went wrong on our end. Please try again. |

---

## 3. Onboarding & profile

### `GET /functions/v1/gym-by-slug?slug=<slug>` — public

No auth. Used by the join screen after scanning the QR (D-006).

```ts
type GymPublic = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  timezone: string;
  isActive: boolean;
};
```

Returns only these fields. Errors: `GYM_NOT_FOUND`, `GYM_INACTIVE`.

### `POST /functions/v1/create-member-profile`

Called once, immediately after Supabase phone-OTP verification.

```ts
type CreateMemberProfileRequest = {
  gymSlug: string;
  fullName: string;          // 2–120 chars
  dateOfBirth?: string;      // ISO date, optional
};

type CreateMemberProfileResponse = {
  profile: { id: string; fullName: string; phone: string; avatarUrl: string | null };
  member: { gymId: string; memberCode: string; joinedAt: string };
};
```

Server:
1. Require an authenticated session with a **verified phone** (`auth.users.phone_confirmed_at is not null`) → else `UNAUTHENTICATED`.
2. Resolve gym by slug; require `is_active` → else `GYM_NOT_FOUND` / `GYM_INACTIVE`.
3. Upsert `profiles` with `phone` taken from the **JWT, not the body**.
4. Insert `gym_members` with `next_member_code(gym_id)`; on conflict `(gym_id,user_id)` do nothing (idempotent — re-running returns the existing row).
5. Audit `MEMBER_REGISTERED`.

> The client never supplies a phone number. Trusting a body-supplied phone would let anyone claim another member's identity.

---

## 4. Payments

### `POST /functions/v1/create-payment-order`

```ts
type CreatePaymentOrderRequest = {
  planId: string;
  method: 'ONLINE' | 'UPI_COUNTER' | 'CASH_COUNTER';
};

type CreatePaymentOrderResponse = {
  paymentId: string;
  membershipId: string;
  amountPaise: number;
  currency: 'INR';
  method: 'ONLINE' | 'UPI_COUNTER' | 'CASH_COUNTER';
  // present only when method === 'ONLINE'
  razorpay?: { orderId: string; keyId: string; checkoutUrl: string };
};
```

Server (single transaction for steps 4–5):
1. Authenticate; resolve `gym_id` from `gym_members` → else `NOT_GYM_MEMBER`.
2. Load plan; must be same gym and `is_active` → else `PLAN_NOT_FOUND` / `PLAN_INACTIVE`.
3. Reject if a `PENDING_PAYMENT` membership already exists → `MEMBERSHIP_ALREADY_PENDING`.
4. Insert `memberships` (`PENDING_PAYMENT`, `price_paise` snapshotted from the plan).
5. Insert `payments` (`PENDING`, `amount_paise` **from the plan row**, `idempotency_key` from the header).
6. If `ONLINE`: create the Razorpay order server-side with `receipt = payment.id`, store `provider_order_id`. On provider failure, roll back and return `PAYMENT_PROVIDER_ERROR`.
7. Return. **`keyId` is the public Razorpay key id — the secret never leaves the server.**

Replaying the same `Idempotency-Key` returns the original response, not a new order.

### `GET /functions/v1/payment-status?paymentId=<uuid>`

Polled by the app while waiting for the webhook (D-010).

```ts
type PaymentStatusResponse = {
  paymentId: string;
  status: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  membership: { id: string; status: string; endAt: string | null } | null;
};
```

Caller must own the payment or be staff. Poll at 2s intervals, max 45 attempts, then show "we'll notify you when it confirms".

### `POST /functions/v1/razorpay-webhook` — **no user auth**

Public endpoint. Authenticated by HMAC signature only.

```
X-Razorpay-Signature: <hmac_sha256(rawBody, RAZORPAY_WEBHOOK_SECRET)>
```

Server:
1. Read the **raw body bytes** — compute HMAC before any JSON parsing. Comparing a re-serialized body will fail intermittently.
2. Constant-time compare → mismatch = `WEBHOOK_SIGNATURE_INVALID`, HTTP 401, log and drop.
3. Handle events: `payment.authorized`, `payment.captured`, `payment.failed`, `refund.processed`. Ignore everything else with **HTTP 200** (an unhandled event must not trigger provider retries).
4. Look up `payments` by `provider_order_id` (or `provider_payment_id` on refunds) → not found = 200 + log (order may belong to another environment).
5. Verify `amount` in the payload equals `payments.amount_paise` → mismatch = log a `PAYMENT_AMOUNT_MISMATCH` audit row and do **not** activate.
6. Apply the transition via the state machine; already in target state → 200 no-op.
7. On `PAID`: call `activate_membership_for_payment(payment_id)`.
8. Always return HTTP 200 within 5 seconds. Slow work goes to a queue, not the request.

> Store the provider event id in `payments.metadata.eventIds[]` and skip duplicates. Razorpay retries on non-2xx.

### `POST /functions/v1/confirm-counter-payment` — staff only

```ts
type ConfirmCounterPaymentRequest = {
  memberQrToken: string;                       // raw token from the scanned QR
  method: 'CASH_COUNTER' | 'UPI_COUNTER';
};

type ConfirmCounterPaymentResponse = {
  payment: { id: string; amountPaise: number; status: 'PAID'; paidAt: string };
  membership: { id: string; status: 'ACTIVE'; startAt: string; endAt: string };
  member: { fullName: string; memberCode: string; avatarUrl: string | null };
};
```

Server:
1. Authenticate; require active `gym_staff` → `NOT_GYM_STAFF`.
2. Hash the token; `update member_qr_tokens set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning *` → zero rows: distinguish `QR_TOKEN_INVALID` / `QR_TOKEN_EXPIRED` / `QR_TOKEN_ALREADY_USED` by a follow-up read.
3. Token's `gym_id` must equal the staff member's gym → `CROSS_TENANT_ACCESS`.
4. Load the linked payment `for update`; must be `PENDING` → `PAYMENT_NOT_PENDING` / `PAYMENT_ALREADY_PROCESSED`.
5. **Amount comes from the payment row, never the request.**
6. Set `status='PAID'`, `paid_at=now()`, `method`, `confirmed_by`, `provider='COUNTER'`.
7. `activate_membership_for_payment(...)`.
8. Audit `COUNTER_PAYMENT_CONFIRMED`.

Repeating the call fails at step 2 (token already used) — the membership can never be extended twice.

> **Do not** accept a `paymentId` in the request. The QR token *is* the authorization; a raw payment id would let staff confirm arbitrary payments.

### `POST /functions/v1/create-member-qr-token` — member only

```ts
type CreateQrTokenRequest  = { purpose: 'COUNTER_PAYMENT' | 'MEMBER_LOOKUP'; paymentId?: string };
type CreateQrTokenResponse = { token: string; expiresAt: string; ttlSeconds: number };
```

- `COUNTER_PAYMENT` requires `paymentId`, owned by the caller, status `PENDING`.
- Raw token = 32 random bytes, base64url. **Only the sha256 hash is stored.**
- TTL 120s (`COUNTER_PAYMENT`) / 300s (`MEMBER_LOOKUP`).
- Creating a new token invalidates the caller's previous unused token for the same purpose.
- Rate limit: 20 per user per hour.

QR payload is the raw token string, nothing else. No JSON, no member data, no URL.

---

## 5. Gym status

### `GET /functions/v1/current-gym-status?gymId=<uuid>`

```ts
type GymStatusResponse = {
  status: 'OPEN' | 'CLOSED';
  source: 'SCHEDULE' | 'MANUAL_OVERRIDE';
  changesAt: string | null;      // when it next flips, if known
  overrideReason: string | null;
};
```

Thin wrapper over `current_gym_status()`. Cache 60s client-side; refetch on app foreground.

### `POST /functions/v1/override-gym-status` — staff only

```ts
type OverrideGymStatusRequest = {
  status: 'OPEN' | 'CLOSED';
  startsAt: string;              // ISO; defaults to now if omitted
  endsAt: string;                // ISO; required, must be > startsAt, max +30 days
  reason?: string;               // max 200 chars
  notifyMembers?: boolean;       // default false — if true, also publishes a MAINTENANCE broadcast
};
```

Errors: `OVERRIDE_RANGE_INVALID`, `NOT_GYM_STAFF`. Audit `GYM_STATUS_OVERRIDDEN`.

To cancel an active override: `POST /functions/v1/override-gym-status` with `endsAt = now()` on the existing id, or `DELETE`-style `cancel-gym-override` with `{ overrideId }`.

---

## 6. Broadcasts

### `POST /functions/v1/publish-broadcast` — staff only

```ts
type Audience =
  | { type: 'ALL_MEMBERS' | 'ACTIVE_MEMBERS' | 'EXPIRING_MEMBERS' | 'INACTIVE_MEMBERS' }
  | { type: 'SELECTED_MEMBERS'; userIds: string[] };   // 1–500

type PublishBroadcastRequest = {
  broadcastId?: string;          // publish an existing DRAFT/SCHEDULED
  title?: string; body?: string; // or create-and-publish in one call
  category?: 'HOLIDAY' | 'MAINTENANCE' | 'LOST_AND_FOUND' | 'EQUIPMENT' | 'EVENT' | 'GENERAL';
  audience?: Audience;
  publishAt?: string;            // future ISO → SCHEDULED instead of PUBLISHED
};

type PublishBroadcastResponse = {
  broadcastId: string;
  status: 'SCHEDULED' | 'PUBLISHED';
  recipientCount: number;
  publishedAt: string | null;
};
```

Server resolves recipients from live data (see `docs/09_STATE_MACHINES.md` §5), inserts `broadcast_recipients` + `notifications` in one transaction, sets `recipient_count`. Zero recipients → `BROADCAST_EMPTY_AUDIENCE` (nothing is published). `SELECTED_MEMBERS` ids are each verified to be members of the caller's gym; any foreign id → `CROSS_TENANT_ACCESS`.

**The client never sends a recipient list for the non-`SELECTED` types.** Audience is a *rule*, evaluated server-side.

### Reads (direct Supabase)

- Member alerts: `select * from notifications where user_id = auth.uid() order by created_at desc` (RLS-scoped).
- Unread count: `select count(*) ... where read_at is null`.
- Mark read: `update notifications set read_at = now() where id = $1` (column-granted, see `docs/05` §8).

---

## 7. Issues

| Operation | Path | Actor |
|---|---|---|
| Create | `POST create-issue` | member |
| List mine | direct `select` on `issues` | member |
| List gym's | direct `select` on `issues` | staff |
| Add message | `POST reply-to-issue` | member (own) or staff |
| Change status | `POST update-issue-status` | staff |

```ts
type CreateIssueRequest = {
  category: 'EQUIPMENT' | 'CLEANLINESS' | 'STAFF' | 'BILLING' | 'SAFETY' | 'OTHER';
  title: string;                 // 3–120
  description: string;           // 1–2000
  attachmentPaths?: string[];    // already uploaded to storage, max 3
};

type ReplyToIssueRequest = { issueId: string; body: string };

type UpdateIssueStatusRequest = {
  issueId: string;
  status: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  message?: string;              // required when status === 'CLOSED'
};
```

Rules:
- A member replying to their own `RESOLVED` issue within 7 days reopens it to `IN_PROGRESS` (D-003 / `docs/09` §4).
- Replying to a `CLOSED` issue → `ISSUE_CLOSED`.
- Staff reply sets `acknowledged_at` if null and moves `OPEN → IN_PROGRESS`.
- Every status change writes a `notifications` row for the member and an `audit_logs` row.

---

## 8. Attendance & crowd

### `POST /functions/v1/attendance-event`

```ts
type AttendanceEventRequest = {
  eventType: 'PRESENCE_START' | 'PRESENCE_END';
};
```

Member-callable for their **own** presence only (D-008). `source_type` is forced to `MANUAL` server-side. `CHECK_IN`/`CHECK_OUT` and `QR`/`FINGERPRINT` sources are **service-key only** and have no user-facing endpoint.

- `PRESENCE_START` while one is already open → 200 no-op (idempotent).
- Rate limit: 10/hour/user.

### `GET /functions/v1/current-crowd?gymId=<uuid>`

```ts
type CrowdResponse = {
  level: 'NOT_CROWDED' | 'MODERATE' | 'CROWDED' | 'VERY_CROWDED' | null;
  confidence: 'OK' | 'LOW' | 'INSUFFICIENT_DATA';
  updatedAt: string;
  source: 'QR' | 'MANUAL' | 'FINGERPRINT' | 'HYBRID';
};
```

**Never returns `sampleSize` or any identifier to a member.** The admin variant (`admin-crowd-analytics`, staff only) may include `sampleSize` and hourly history.

### Reads (direct Supabase)

- My attendance: `select occurred_at, event_type from attendance_events where user_id = auth.uid() and gym_id = $1 order by occurred_at desc limit 200`.
- Calendar view: aggregate client-side by local date using `gyms.timezone`.

---

## 9. Admin reads (direct Supabase, no functions needed)

| Screen | Query |
|---|---|
| Member list | `gym_members` join `profiles` join `v_current_memberships`, paginated with `.range()`, ordered by `full_name` |
| Member search | `ilike` on `full_name`, exact on `phone`, exact on `member_code` — use a `pg_trgm` index on `full_name` if the list exceeds ~2000 rows |
| Dashboard KPIs | one RPC `admin_dashboard_kpis(gym_id)` returning a single row — six round trips is wasteful |
| Payment history | `payments` filtered by `status`/date, joined to `profiles` |
| Attention queue | one RPC `admin_attention_queue(gym_id)` returning expiring, pending payments, open issues, scheduled broadcasts |

Both RPCs are `stable security invoker` so RLS still applies.

---

## 10. Rate limits (application-level, enforced in the function)

| Operation | Limit |
|---|---|
| OTP request | 3 / phone / 15 min, 10 / phone / day (also configure in Supabase Auth) |
| OTP verify | 5 attempts / phone / 15 min |
| `create-payment-order` | 5 / user / hour |
| `create-member-qr-token` | 20 / user / hour |
| `create-issue` | 5 / user / day |
| `attendance-event` | 10 / user / hour |
| `publish-broadcast` | 20 / gym / day |
| File upload | 20 / user / day |

Implement with a `rate_limits (key, window_start, count)` table and an atomic upsert, or Supabase's built-in limits where available. Exceeding → `RATE_LIMITED` with a `Retry-After` header.

---

## 11. Function checklist

Every new Edge Function must:

- [ ] parse and validate the body with Zod before touching the DB
- [ ] resolve `gym_id` server-side, never from the body
- [ ] check role (`is_gym_staff` / `is_gym_member`) explicitly, not implicitly via RLS
- [ ] be idempotent, or document why it cannot be
- [ ] return the standard envelope with a code from §2
- [ ] write an `audit_logs` row for any privileged write
- [ ] log `{requestId, function, userId, gymId, outcome, latencyMs}` — and never a token, OTP, or secret
- [ ] have an integration test covering: happy path, wrong role, cross-tenant, replay
