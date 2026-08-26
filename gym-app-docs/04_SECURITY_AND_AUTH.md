# 04 — Security & Authentication

> **The one rule:** never trust the client for authorization or for money.
> Everything else in this document is an implementation of that rule.

## 1. Assets worth protecting

| Asset | Why it matters | Primary control |
|---|---|---|
| Member phone numbers | PII; directly abusable | RLS + explicit column selection |
| Member photos & issue photos | PII | Private buckets + signed URLs |
| Payment & membership history | Financial PII | RLS, server-only writes |
| Payment state | Money | Webhook signature + server-only transitions |
| Admin controls | Full gym compromise | `gym_staff` role check + audit log |
| Broadcast targeting | Spam / harassment vector | Server-side audience resolution |
| Cross-gym isolation | Multi-tenant integrity | `gym_id` on every table + RLS |
| Service role key | Total compromise | Never leaves Edge Functions |

## 2. Threat model (what an attacker actually tries)

| # | Attack | Control |
|---|---|---|
| T1 | Modify a request to mark own payment `PAID` | No client-writable path to `payments.status`; RLS grants no UPDATE |
| T2 | Call `confirm-counter-payment` as a member | `is_gym_staff` check → `NOT_GYM_STAFF` |
| T3 | Replay a captured member QR | Single-use `used_at` + 120s TTL |
| T4 | Reuse another member's QR | Token binds `user_id` + `payment_id`; staff sees the member's photo before confirming |
| T5 | Forge a Razorpay webhook | HMAC over the raw body with the webhook secret |
| T6 | Replay a real webhook | Event-id dedupe + state-machine no-op |
| T7 | Pay ₹1 for a ₹1500 plan | Amount read from `membership_plans`, cross-checked against the webhook payload |
| T8 | Read another member's data by changing a UUID | RLS on every table; 404 not 403 |
| T9 | Read another gym's data | `gym_id` scoping in every policy |
| T10 | Broadcast to everyone as a member | `publish-broadcast` is staff-only; audience resolved server-side |
| T11 | Extract the service key from the app bundle | It is never in the bundle; CI greps for it |
| T12 | Brute-force OTP | Provider limits + app-level rate limits + attempt counter |
| T13 | Enumerate members via `member_code` | Lookup requires staff role; member codes are not sequential-guessable across gyms |
| T14 | Upload a malicious file as an "image" | MIME + magic-byte check, size cap, private bucket, no execution path |
| T15 | Self-report attendance to skew crowd | `attendance-event` forces `user_id = auth.uid()`, rate-limited, deduped |
| T16 | Escalate to OWNER | `gym_staff.role` writable only by an existing OWNER, always audited |

## 3. Member authentication

Supabase Auth, **phone OTP only**.

```
phone → signInWithOtp → SMS → verifyOtp → JWT session
```

- **Never** write a custom OTP generator or store OTPs in your own tables.
- The phone on the JWT is the identity. Never accept a phone from a request body (see `docs/07` §3).
- Session persists via AsyncStorage with auto-refresh; expired refresh → sign out and route to onboarding.
- Rate limits: 3 OTP requests / phone / 15 min, 10 / day; 5 verify attempts / phone / 15 min. Configure both in Supabase Auth **and** at the application level.
- Do not log OTPs, phone numbers in full (mask to `+91•••••43210`), or tokens.

## 4. Staff authentication

- Separate path: **email + password** (or magic link) on the admin web app.
- **Enable MFA/TOTP for OWNER before production.** A single owner password is the whole gym's compromise.
- Role comes from `gym_staff`, never from a JWT custom claim the client could influence, and never from a UI flag.
- Sessions are shorter on admin (idle timeout ~30 min).
- A staff account is a normal `auth.users` row; the `gym_staff` row is what grants power. Removing power = set `status='DISABLED'`, which takes effect on the next request because `is_gym_staff()` reads live.
- Bootstrapping the first OWNER is a manual, audited SQL insert in each environment — not a signup flow.

## 5. Authorization — five layers

1. **Client routing** — cosmetic only. Hides the admin UI from members. Assume it is bypassed.
2. **Edge Function role checks** — explicit `is_gym_staff()` / `is_gym_member()` before any work.
3. **Postgres grants** — column-level where needed (`grant update (read_at) on notifications`).
4. **RLS** — enabled on every table in `public`, policy per operation.
5. **Audit log** — every privileged write is attributable.

A control failing at one layer must be caught at another. Never rely on layer 1 alone; never rely on layer 4 alone for column restrictions (RLS cannot restrict columns).

## 6. RLS rules of engagement

- `alter table ... enable row level security` in the **same migration** that creates the table.
- Always wrap: `(select auth.uid())` — a bare `auth.uid()` is re-evaluated per row and destroys the query plan.
- Policies route through `is_gym_member(gym_id)` / `is_gym_staff(gym_id)` (defined in `docs/05` §2) rather than inlining `exists(...)` in twenty places.
- Those helper functions are `security definer set search_path = public` — required to avoid infinite recursion on `gym_staff` and to be injection-safe.
- Every exposed view uses `with (security_invoker = true)`. A view without it runs as its owner and **silently bypasses RLS** — this is the most dangerous single mistake available in this stack.
- Write-heavy privileged tables (`memberships`, `payments`, `member_qr_tokens`) have **no INSERT/UPDATE policies at all**. Writes happen only via the service key inside Edge Functions.
- Test policies from the perspective of: member (self), member (other), staff (same gym), staff (other gym), anon.

## 7. Secret handling

| Secret | Lives in | Never in |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase function secrets | app bundles, git, CI logs, tests |
| `RAZORPAY_KEY_SECRET` | Supabase function secrets | anywhere client-visible |
| `RAZORPAY_WEBHOOK_SECRET` | Supabase function secrets | anywhere client-visible |
| DB password | Supabase dashboard | anywhere |
| Anon/publishable key | client bundles (fine) | — |
| `RAZORPAY_KEY_ID` | client (fine, it is public) | — |

- Commit `.env.example` only.
- Rotate immediately if a secret is ever pasted into a chat, a screenshot, a log, or a commit — assume it is public from that moment.
- CI fails the build if a service key pattern is found in `apps/*/dist` or the Expo bundle.

## 8. Payment security

Non-negotiables:

1. Orders are created **server-side** with the amount loaded from `membership_plans`.
2. The webhook signature is verified over the **raw request body** before parsing.
3. Signature comparison is constant-time.
4. The webhook amount is cross-checked against `payments.amount_paise`; a mismatch never activates and always alerts.
5. Only the webhook (online) or an authenticated staff QR redemption (counter) can reach `PAID`.
6. Activation is one atomic Postgres function; calling it twice is a no-op.
7. Card data never touches your servers — Razorpay Checkout handles it. Store nothing beyond order/payment ids and a method label.
8. Refunds are OWNER-only, audited, and reduce reported revenue.

## 9. QR security

**Gym onboarding QR (public, static):** contains only `https://join.<domain>/j/<slug>`. No secret, no id that grants anything. Anyone can scan it — that is the point.

**Member QR (private, ephemeral):**

- Raw token = 32 cryptographically random bytes, base64url.
- Only `sha256(token)` is stored (`member_qr_tokens.token_hash`).
- TTL 120s (counter payment) / 300s (lookup); single use; bound to `user_id`, `gym_id`, and `payment_id`.
- Redemption is atomic: `update ... where token_hash = $1 and used_at is null and expires_at > now() returning *`.
- The app refreshes the QR every 100s and clears it when the screen loses focus.
- The QR encodes the token alone — no name, no phone, no member id, no JSON.
- Screenshots of an expired QR are worthless.

## 10. Input validation

Validate at every trust boundary with Zod:

| Input | Checks |
|---|---|
| Phone | E.164, `^\+[1-9]\d{7,14}$` — but identity always comes from the JWT |
| `planId` | UUID, exists, same gym, `is_active` |
| Amounts | **never accepted from a client** |
| Broadcast audience | union type; `SELECTED_MEMBERS` ids each verified to be gym members, max 500 |
| Issue text | length bounds, trimmed, stored as text (never rendered as HTML) |
| Files | MIME allow-list + magic bytes + size cap |
| Dates | ISO 8601, sane range (`endsAt > startsAt`, override ≤ 30 days) |
| Gym hours | `closes_at > opens_at`, weekday 0–6 |
| Pagination | `limit ≤ 100`, offset bounded |

Reject unknown fields (`.strict()`) on closed shapes so a stray `role: "OWNER"` can never ride along.

## 11. File upload security

- Client compresses to WebP, ≤2 MB (avatars) / ≤5 MB (issue photos).
- Server/storage policy re-checks MIME and size — the client check is UX, not security.
- Object paths are non-guessable: `{gym_id}/{issue_id}/{uuid}.webp`.
- Private buckets; access via **signed URLs, 60-minute TTL**, generated server-side.
- Storage RLS: a member may write only under their own prefix; staff may read their gym's prefix.
- Strip EXIF (including GPS) on upload.
- Never render user-supplied paths as raw URLs in the admin UI.

## 12. Rate limiting

See `docs/07` §10 for the table. Implementation: a `rate_limits(key text primary key, window_start timestamptz, count int)` table with an atomic upsert, checked at the top of each function. `key` = `{function}:{user_id or ip}:{window}`.

## 13. Audit logging

Write an `audit_logs` row for: member profile edited by staff · membership activated / cancelled · payment confirmed / refunded · gym status overridden · plan created / deactivated · broadcast published · issue resolved / closed · staff role changed / disabled · any amount mismatch or signature failure.

Record `actor_user_id`, `gym_id`, `action`, `entity_type`, `entity_id`, `metadata`, `created_at`.

Never log: OTPs, tokens, raw QR tokens, passwords, webhook secrets, full phone numbers, card data.

`audit_logs` has **no UPDATE or DELETE policy** for any role. Append only.

## 14. Privacy

- Collect the minimum: phone, name, optional photo, optional DOB.
- No location permission is requested in MVP. Do not add one for crowd estimation (D-008).
- Crowd data is aggregate only; members never see counts or other members' presence.
- `crowd_snapshots` must not contain user ids or device identifiers.
- Provide a documented account-deletion path before store submission (both stores require it): delete `profiles` (cascades), retain `payments`/`audit_logs` with the user reference nulled for legal/accounting reasons, and say so in the privacy policy.
- Write a privacy policy covering: what is collected, why, retention, third parties (Supabase, Razorpay), and how to request deletion.

## 15. Web hardening (admin)

- HTTPS only, HSTS.
- `Content-Security-Policy` — no `unsafe-eval`; allow the Razorpay checkout origin only on the checkout page.
- `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` denying geolocation/microphone.
- Secure, `HttpOnly`, `SameSite=Lax` cookies for the session.
- No dangerouslySetInnerHTML on any member-supplied content.

## 16. Mobile hardening

- No secrets in the bundle (they are extractable — assume any string in the app is public).
- Session tokens in AsyncStorage are readable on a rooted device; keep token lifetime short and rely on server-side authorization.
- Disable remote debugging in production builds.
- Do not log request/response bodies in production.

## 17. Dependency & supply chain

- `pnpm audit` in CI; fail on high/critical.
- Lockfile committed; CI uses `--frozen-lockfile`.
- Dependabot or a weekly manual review.
- No `postinstall` scripts from unfamiliar packages.

## 18. Pre-production security test suite

Each of these must be an automated test that **fails closed**:

- [ ] Member A cannot read Member B's profile, memberships, payments, notifications, or issues
- [ ] Member cannot read `gym_staff`, `audit_logs`, or another gym's anything
- [ ] Member cannot UPDATE `memberships`, `payments`, or `broadcasts` by any route
- [ ] Member cannot mark a notification's `title`/`body` (column grant test)
- [ ] Member cannot call `confirm-counter-payment`, `publish-broadcast`, or `override-gym-status`
- [ ] Staff of gym A cannot read or write anything in gym B (returns 404, not 403)
- [ ] A forged webhook (bad signature) is rejected with 401 and activates nothing
- [ ] A replayed webhook is a 200 no-op and does not extend a membership
- [ ] A webhook with a mismatched amount does not activate
- [ ] A reused QR token returns `QR_TOKEN_ALREADY_USED`
- [ ] An expired QR token returns `QR_TOKEN_EXPIRED`
- [ ] Confirming the same counter payment twice extends the membership exactly once
- [ ] A 6 MB upload and a `.exe` renamed to `.jpg` are both rejected
- [ ] `SERVICE_ROLE` / `KEY_SECRET` appear in no built artifact (grep test in CI)
- [ ] Every table in `public` has `rowsecurity = true` (assert with a query over `pg_tables`)
- [ ] Every view in `public` has `security_invoker = true`
