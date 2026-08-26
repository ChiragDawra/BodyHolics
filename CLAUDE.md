# CLAUDE.md — Agent Operating Manual

> This file is loaded automatically by Claude Code at the repo root.
> Keep it under ~400 lines. Everything longer lives in `docs/` and is referenced by path.

## 0. What this project is

**Urban Gym App** — a two-client gym management platform for a single urban gym in India, modelled multi-tenant from day one.

| Client | Stack | Users |
|---|---|---|
| `apps/member-mobile` | React Native + Expo (Expo Router) | Gym members |
| `apps/admin-web` | Next.js (App Router) | Gym owner + staff |
| `supabase/` | Postgres + Auth + RLS + Storage + Edge Functions (Deno) | Both |

Payments: **Razorpay**. Currency: **INR, stored in paise (integer)**.

## 1. Read-before-you-code

Before making architectural, schema, auth, or payment changes, read the relevant doc:

| If the task touches… | Read |
|---|---|
| Anything at all, first time in a session | `docs/00_DECISIONS.md` |
| Feature scope, "should this exist" | `docs/01_REQUIREMENTS.md` |
| Flows between systems | `docs/02_SYSTEM_DESIGN.md` |
| Adding/upgrading a dependency | `docs/03_TECH_STACK.md` |
| Auth, RLS, secrets, QR tokens | `docs/04_SECURITY_AND_AUTH.md` |
| Tables, columns, migrations, indexes | `docs/05_DATABASE_DESIGN.md` |
| Where a file goes, layering | `docs/06_CODEBASE_ARCHITECTURE.md` |
| Edge Function request/response | `docs/07_API_CONTRACT.md` |
| CI, envs, releases | `docs/08_DEPLOYMENT_AND_OPERATIONS.md` |
| Any status/enum transition | `docs/09_STATE_MACHINES.md` |
| What to build next | `docs/10_BUILD_PLAN.md` |
| Something is underspecified | `docs/11_OPEN_QUESTIONS.md` — **ask, do not invent** |

## 2. Hard rules (never violate without an explicit human instruction)

1. **The client is never trusted for money or authorization.** Membership never becomes `ACTIVE` because a client said so. Only a verified Razorpay webhook or an authenticated staff counter-confirmation activates it.
2. **Prices come from the database.** Never accept `amount` from a client payload. Load `membership_plans.price_paise`.
3. **No service-role key outside `supabase/functions/`.** Never in `apps/*`, never in a `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` var, never in a test fixture that gets committed.
4. **No schema change outside `supabase/migrations/`.** No `create table` in application code, no manual SQL against a hosted DB.
5. **RLS is enabled on every table in `public`.** A new table without a policy is a bug, not a TODO.
6. **Money is `bigint` paise.** Never `float`, never `numeric` rupees, never a formatted string in the DB.
7. **Timestamps are `timestamptz` in UTC.** Gym-local rendering uses `gyms.timezone`. Never hardcode `Asia/Kolkata` in logic.
8. **The member app has exactly three bottom tabs**: Home, Activity, Me. Alerts are a bell icon → stack screen. Do not add a fourth tab.
9. **Admin has no "Add Member" flow.** Registration is member-led via QR + OTP. Admin can only view/search/edit existing members.
10. **A user account (`auth.users`/`profiles`) is not a membership.** Never collapse them.
11. **Every privileged write is idempotent** and writes an `audit_logs` row.
12. **Never invent a status value.** The allowed sets are in `docs/09_STATE_MACHINES.md` and enforced by check constraints.

## 3. Commands

```bash
pnpm install                  # root, installs all workspaces
pnpm dev                      # turbo: runs member-mobile + admin-web
pnpm --filter admin-web dev
pnpm --filter member-mobile start

pnpm typecheck                # tsc --noEmit across all packages
pnpm lint
pnpm test                     # vitest unit
pnpm test:integration         # runs against local Supabase
pnpm test:e2e                 # playwright (admin-web)

supabase start                # local stack (Docker)
supabase db reset             # re-apply all migrations + seed
supabase migration new <name> # create a timestamped migration
supabase functions serve      # local Edge Functions
supabase gen types typescript --local > packages/types/src/database.ts
```

**After any migration, regenerate types.** A stale `database.ts` is the single most common cause of confusing type errors in this repo.

## 4. Definition of done

A change is not done until:

- [ ] `pnpm typecheck` passes with zero errors (strict mode, no new `any`)
- [ ] `pnpm lint` passes
- [ ] New/changed state transitions have unit tests
- [ ] New tables have RLS enabled **and** a policy test in `supabase/tests/`
- [ ] Schema changes are in a migration file, and `supabase db reset` succeeds from scratch
- [ ] `packages/types/src/database.ts` regenerated if schema changed
- [ ] User-facing errors use a code from `docs/07_API_CONTRACT.md` §Errors
- [ ] Docs updated if a decision in `docs/00_DECISIONS.md` changed

## 5. Layering (enforced by lint boundaries)

```
screens/pages  →  features/*/hooks  →  features/*/api  →  supabase client
                        ↓
                  packages/domain (pure, no I/O, no React)
                  packages/validation (zod)
```

- A screen component must not import `@supabase/supabase-js` directly.
- `packages/domain` must have zero runtime dependencies beyond `date-fns`/`zod`.
- `packages/ui` must not import a Supabase client or any app-specific service.
- Edge Functions (Deno) cannot import from `packages/*` — shared logic is mirrored in
  `supabase/functions/_shared/` and kept in sync by `pnpm test:shared-parity`. See
  `docs/06_CODEBASE_ARCHITECTURE.md` §5.

## 6. Naming

| Thing | Convention | Example |
|---|---|---|
| DB table | `snake_case`, plural | `membership_plans` |
| DB column | `snake_case` | `price_paise`, `end_at` |
| Money column | suffix `_paise` | `amount_paise` |
| Timestamp column | suffix `_at` | `activated_at` |
| Boolean column | `is_` / `has_` prefix | `is_active` |
| Status values | `SCREAMING_SNAKE` text + check constraint | `PENDING_PAYMENT` |
| Edge Function dir | `kebab-case`, verb-first | `confirm-counter-payment` |
| Migration file | `<timestamp>_<verb>_<subject>.sql` | `20260901120000_create_memberships.sql` |
| TS type | `PascalCase` | `MembershipStatus` |
| React component file | `PascalCase.tsx` | `CrowdLevelBadge.tsx` |
| Hook | `useThing` in `hooks.ts` | `useCurrentMembership` |
| Zod schema | `thingSchema` | `createIssueSchema` |
| Error code | `SCREAMING_SNAKE` | `PAYMENT_ALREADY_PROCESSED` |

## 7. When you are stuck or the spec is ambiguous

Do **not** guess on: payment state, RLS policy shape, tenancy scoping, money maths, OTP/auth flow, or anything in `docs/11_OPEN_QUESTIONS.md`.

Instead: state the ambiguity, list the 2–3 options with trade-offs, recommend one, and wait.

For everything else (naming a variable, picking a layout, ordering a list) — decide, note it in the PR description, move on.

## 8. Things that will bite you (learned the hard way)

- **Expo Go cannot run `react-native-razorpay`.** Checkout uses the WebView/redirect flow. See `docs/03_TECH_STACK.md` §7.
- **Supabase phone OTP needs a configured SMS provider**, and Indian SMS requires DLT-registered templates. This is a prerequisite, not a code problem. See `docs/11_OPEN_QUESTIONS.md` Q1.
- **`auth.uid()` inside a policy should be wrapped**: `(select auth.uid())` — otherwise Postgres re-evaluates it per row and the query plan degrades badly on large tables.
- **`security definer` views bypass RLS.** Every view exposed to the Data API must be reviewed explicitly.
- **Razorpay webhooks retry.** `provider_payment_id` is unique; the handler must be a no-op on replay, not an error.
- **`supabase gen types` overwrites the whole file.** Never hand-edit `packages/types/src/database.ts`.
- **Do not `select *` on `profiles` from admin lists.** Phone numbers are sensitive; select explicit columns.
