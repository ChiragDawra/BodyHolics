# DECISIONS.md

Decisions made while building autonomously, with the reasoning. Newest phase
last. Anything here was a judgement call, not a spec instruction.

---

## Phase 1 — Schema and RLS

### D1. `/check` writes go through PIN-gated `SECURITY DEFINER` RPCs, not anon RLS policies

The spec says `/check` has no middleware and no Supabase session — the PIN pad
is the only gate — and that its data comes from "public-read RLS". Taken
literally for writes, that means opening `anon` INSERT/UPDATE policies on
`gyms`, `alerts`, and `attendance`. Anyone who reads the anon key out of the JS
bundle could then publish alerts to every member and flip the gym open or
closed.

Instead every `/check` operation is a `SECURITY DEFINER` function
(`check_dashboard`, `check_set_crowd`, `check_set_open`,
`check_publish_alert`). Each one re-verifies the PIN against a bcrypt hash
before doing anything. There is no anon write policy on any table.

Verified against the live database with the anon key: a direct
`PATCH /rest/v1/gyms` returns `[]` (no rows), and `check_dashboard` with PIN
`9999` returns `28000 invalid_pin`.

This also satisfies "written so swapping to a server-verified hash is one line"
— it already *is* server-verified. The client-side `1234` comparison in the PIN
pad remains only so the shake animation fires instantly without a round trip.

### D2. The PIN hash lives in `gym_secrets`, a table with RLS on and zero policies

RLS is row-level, not column-level, so a `check_pin_hash` column on `gyms`
would be exposed by the public read policy that the landing page needs. The
hash is in its own table with RLS enabled, no policy created, and privileges
revoked from `anon`/`authenticated`. Only `SECURITY DEFINER` functions reach
it. Verified: anon `SELECT` returns `42501 permission denied`.

### D3. Attendance has no anon read policy

`/check` shows the last five members who checked in, by name. Serving that over
a public policy would hand member names to anyone with the anon key. Those rows
come back through `check_dashboard` instead, behind the PIN.

### D4. Money stored as integer paise

`plans.price_paise integer`. Never float for currency. Nothing charges anyone in
this build — payments are explicitly out of scope — so this only records the
sticker price the owner already collects in cash.

### D5. `attendance_method` enum includes `'qr'` even though QR is out of scope

Adding an enum value later is cheap; migrating a live column is not. The value
exists and is unused. No QR code is generated or read anywhere in this build.

### D6. Every table carries `gym_id` despite serving exactly one gym

A second gym becomes a row rather than a schema change. Costs one column and
one index per table now.

### D7. `is_staff()` is `SECURITY DEFINER` with a pinned `search_path`

A policy on `staff` that queries `staff` recurses under RLS. `SECURITY DEFINER`
breaks the cycle; `set search_path = public, pg_temp` stops the function being
shadowed by a caller-controlled schema.

### D8. New members are attached to the oldest gym row by trigger

`handle_new_user` fires on `auth.users` insert and creates the `profiles` row.
The trigger cannot see the join code from the OAuth flow, and this build has one
gym, so it selects `gyms order by created_at limit 1`. Multi-gym would move this
to an explicit post-OAuth write.

### D9. Membership validity is computed, not trusted

`memberships.status` is stored so staff can cancel explicitly, but an expired
`end_date` always overrides a stale `'active'`. Reads go through
`membership_is_current()`.

### D10. Migrations applied to the live remote project

The Supabase CLI was already authenticated and reached the remote database
through a Management API login role, so no database password was needed. All
eight migrations are applied to `hpxqrnjnpdxnbmvlavdm`.

### D11. Could not read the service-role key

Reading it was blocked by the sandbox, and no workaround was attempted. This is
why `/check` uses PIN-gated RPCs (D1) rather than a server-side service-role
client. The design is arguably better for it: the privileged path is five
audited SQL functions instead of a key that can do anything.

---

## Phase 2 — Tokens, primitives, PWA

### D12. The blank token values in the brief were filled in, not left empty

The spec supplied some hex values and left others blank (`--color-ink`,
`--color-brand`, `--color-success`, the crowd buckets, and others). Those were
chosen to sit with the supplied ones: brand `#E1502A` (rusted iron orange),
ink `#1A1917` — a true warm near-black rather than the tinted `#0B0B0B` the
design pipeline explicitly rejects. Every dark-mode value was supplied and is
used verbatim.

### D13. Fonts load through `next/font/google`, not a `<link>` to Google Fonts

The brief says "import DM Sans and Inter from Google Fonts in root layout".
`next/font/google` does exactly that at build time and then self-hosts the
files, which removes a render-blocking third-party round trip — the audience is
on patchy 4G. The token file still owns the font names: `--font-display` and
`--font-body` point at the CSS variables `next/font` generates.

### D14. `--spacing` added alongside `--space-unit`

Tailwind v4 derives its entire spacing scale from `--spacing`. Without it, every
`p-4`/`gap-3` in the app would come from Tailwind's built-in default rather than
the token file, which would quietly break the "every value flows from `@theme`"
rule. Both are `0.25rem`.

### D15. Dark mode is a plain `:root` override, not a nested `@theme`

A `@theme` block nested inside `@media` is not valid Tailwind v4. Since `@theme`
compiles to custom properties on `:root`, redefining the same names inside
`@media (prefers-color-scheme: dark)` achieves the same thing and is what
actually works.

### D16. Both manifests are route handlers, not the `app/manifest.ts` convention

The file convention injects one `<link rel="manifest">` into every page in the
app. The owner's `/check` app needs a different manifest with its own
`start_url` and `scope`, so each route group links its own and the convention is
not used.

### D17. The service worker is registered per route group, not at the root

`/app` and `/check` mount the registrar; the public landing page does not. A
visitor who reads the landing page and leaves should not have a service worker
installed for an app they never opened.

### D18. Icons generated from one vector master with the `sharp` that ships with Next

`scripts/generate-icons.mjs` renders all six artefacts from
`design/icon-master.svg`. No new dependency: it uses Next's own transitive
`sharp`. The `.ico` is a hand-built container around a 32×32 PNG because sharp
cannot write ICO. Outputs are committed, so the script only runs when the mark
changes.

The first version of the mark was a ring whose square hub fell inside the ring's
inner radius, so it rendered as a plain donut. Reworked to a solid disc with a
square hole cut out of it, which is what makes it not read as a generic circle
at 32px.

### D19. `/check` was wired to real data in Phase 2 rather than Phase 6

Phase 2 asked for placeholder cards and Phase 6 for real data. The RPCs already
existed from Phase 1, so building the dashboard twice would have been wasted
work. Phase 6 becomes verification of what is already live.

### D20. Three React Compiler lint errors fixed by restructuring, not by disabling

`next lint` runs the React Compiler rules, which reject setting state
synchronously inside an effect. Rather than suppress them:
- `usePlatform` now reads the browser through `useSyncExternalStore`.
- `PinPad` decides the outcome in the keypress handler, since reaching the
  fourth digit *is* the submit.
- `CheckDashboard` extracts a pure `fetchDashboard()` so state is only set
  after an await.

All three are better code than what they replaced.
