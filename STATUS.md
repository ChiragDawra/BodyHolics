# Project status

**Urban Gym App** — last updated 27 Aug 2026 · branch `main` · 15 commits ·
pushed to `github.com/ChiragDawra/BodyHolics`

The app is structurally complete: schema, backend, both clients, and CI all
exist and run. What is missing is not code — it is three external accounts and a
round of hardening.

---

## Verification

Everything below was run, not assumed.

| Check | Result |
|---|---|
| `pnpm typecheck` | 10/10 packages |
| `pnpm lint` | 10/10 packages |
| `pnpm test` (unit) | domain 107 · validation 36 · both 100% coverage |
| `supabase db reset` | clean from scratch |
| `supabase test db` (pgTAP/RLS) | 38/38 |
| `pnpm test:integration` | 26/26 against the real local stack |
| `pnpm test:shared-parity` | 16 mirrored files in sync |
| `check-no-secrets` | clean |
| `pnpm audit --audit-level high` | passes (3 documented exceptions) |
| `pnpm --filter admin-web build` | 15 routes |
| `expo export` | 4.8 MB iOS bundle |

---

## Done

### Database — 11 migrations, 21 tables

RLS on every table, the full policy matrix from `docs/05` §8,
`v_current_memberships` with `security_invoker`, storage buckets, `pg_cron`
jobs, and a seed that is idempotent across resets.

Three things the spec left open, now decided and recorded as **D-015** / **D-016**:

- **`publish_due_broadcasts()`** was referenced by cron but never defined.
  Written, with `resolve_broadcast_audience()` so the Edge Function and the cron
  job share one implementation of the audience rules.
- **Occupancy functions revoked from `authenticated`.** They return an exact
  headcount, which `docs/05` §5 says must never reach a member — and as
  `security definer` functions a grant would have handed every member the live
  headcount of any gym id they could guess. Members get a bucketed wrapper.
- **The privilege surface is now explicit.** Supabase's default privileges did
  *not* extend to tables these migrations create: every table came out with no
  `SELECT` for `anon`, `authenticated` **or** `service_role`. The entire Data API
  and every Edge Function would have failed at runtime while every RLS test kept
  passing. RLS and `GRANT` are two independent halves of one control.

### Backend — 15 Edge Functions

Fixed order throughout (method → validate → authorize → rate limit → work →
envelope), `gym_id` always resolved server-side.

- **`razorpay-webhook`** — HMAC over raw bytes before any parsing, constant-time
  compare. An amount that disagrees with our row is audited and does **not**
  activate. Replays, unhandled events and unknown orders all return 200, because
  a non-2xx makes the provider retry forever.
- **`confirm-counter-payment`** — takes no `paymentId`; the QR token *is* the
  authorization. Claimed atomically, so a membership cannot be extended twice.
- **`create-member-qr-token`** — 32 CSPRNG bytes, only the sha256 hash stored,
  previous unused token invalidated.
- Plus a rate-limit table with an atomic upsert, and the D-012 Deno mirror kept
  honest by a parity check.

### Admin (Next.js) — 15 routes

Login, overview, members (list + detail), payments, plans, issues (list +
thread), broadcasts (list + compose), attendance, settings (hours, staff, audit).
The app never holds an elevated credential; `gym_staff` is read live on every
request, so revoking access takes effect on the next page load.

### Member app (Expo) — 20 screens

Exactly three tabs. Session in the Keychain via `expo-secure-store`. QR scanner
validates against the server's own slug schema. Counter QR carries the raw token
and nothing else, refreshing every 100s against a 120s TTL. Nothing in the app
decides a payment succeeded — it polls and reports what the webhook wrote.

### CI — 4 jobs

Types, lint, unit, parity, secrets · migrations from scratch, generated-types
freshness, pgTAP, integration · builds both apps and **scans the built bundles**
for privileged JWTs · dependency audit. Every step was run locally before the
workflow was committed.

---

## Pending

### M7 — Hardening and launch

| Item | Notes |
|---|---|
| Playwright E2E for admin | `pnpm test:e2e` is wired but has no specs |
| Push notifications (D-013) | `notifications` rows are already written and are the source of truth; Expo push delivery is the missing best-effort layer. Needs a dev build with FCM/APNs credentials |
| Storage policy tests | The buckets and policies exist but were never exercised against real `storage.objects` |
| Deployment | Vercel project, `supabase functions deploy`, EAS build profiles — none set up |
| Load/perf pass | Untested beyond seed-sized data |

### Known gaps

- **`docs/09` §5 reopen window** — a member replying to a `RESOLVED` issue
  outside 7 days posts the message but the issue stays `RESOLVED`. Deliberate
  (refusing the message would lose what they wrote), but worth a product look.
- **`next_member_code` is race-prone** (Q6). Count-based; accepted at one-gym
  scale, with a documented fallback if a unique violation ever appears.
- **Three stray `.md` files at the repo root** — duplicates of the real docs in
  `gym-app-docs/`. `00_DECISIONS.md` there is **stale** (missing D-015/D-016).
  Left untracked rather than deleted, but a `git add -A` would commit the stale
  copy. Recommend deleting all three.
- **3 allowlisted advisories** in build-time Expo tooling, two with no patch
  published. Documented in `docs/12_ACCEPTED_ADVISORIES.md` with a review date of
  27 Nov 2026.

---

## What I need from you

### Blocking — work cannot be finished without these

**1. SMS / OTP provider (Q1) — blocks the entire member auth path.**
Indian SMS requires DLT-registered templates; this is a registration process, not
a code problem. Phone login is currently **disabled** on the local stack
(`no SMS provider is enabled`), so member sign-in has never been exercised end to
end. Everything past authentication is tested via minted tokens.
→ *Need: a provider account (Twilio/MSG91/similar) and DLT template approval.*

**2. Razorpay account (Q2) — blocks online payments.**
The counter-payment path is fully tested. The **online** path is not: order
creation and checkout have never run against a real provider. The webhook's
signature verification, amount-mismatch handling and replay behaviour *are*
tested, against a locally-signed secret.
→ *Need: test keys now, and KYC-completed live keys before launch.*

**3. Design references — the Stitch screens are unresolvable.**
You gave 7 Stitch screen IDs and asked for Motion/21st/Stitch. **21st and Stitch
are not connected to this session**, so those IDs are paths I cannot fetch. Both
apps are built on a design system I defined in `packages/ui/src/tokens.ts` —
coherent and accessible, but mine, not yours.
→ *Need: connect the MCP, or paste/export the screens. The longer this waits the
more there is to rework.*

### Product decisions — I should not guess these

| # | Question | My recommendation |
|---|---|---|
| **Q3** | Where does crowd data come from? Currently QR/presence events only | Ship with presence-based; revisit if it reads wrong |
| **Q4** | The walk-in with no smartphone | Staff-assisted on the member's own phone. Never admin-created identity |
| **Q7** | Does the owner need an in-app refund button? | Razorpay dashboard only for MVP. Pro-rating is a lot of complexity to build speculatively |
| **Q8** | Do you offer membership pause/freeze today? | If **yes, tell me now** — it changes how `end_at` is computed and is not in the model at all |
| **Q10** | Data retention / deletion policy | Needed before launch, not before more code |
| **Q12** | Portfolio piece or real production deployment? | Changes whether M7 is a week or a month |

**Q8 is the one to answer soonest.** Everything else can be decided later
without rework; a pause feature bolted on afterwards would touch the membership
period maths, which is the part most carefully tested.

---

## Running it locally

```bash
pnpm install
supabase start                 # Docker required
pnpm db:test                   # resets, then runs the RLS tests
pnpm --filter admin-web dev    # localhost:3000
pnpm --filter member-mobile start
```

Local admin sign-in: `owner@urban-gym.test` / `local-dev-password`
(seeded, development only — see `supabase/seed/seed.sql`).
