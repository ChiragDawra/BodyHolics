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

---

## Phase 3 — Auth

### D21. A missing `?g=` join code is allowed; only a *wrong* code is rejected

The spec says `/join?g=<code>` validates the code. A bare `/join` with no code
at all is treated as valid rather than shown the error screen — the owner will
share the plain link too, and a member who cannot get past a "no code" screen
is a member who does not join. A code that is present but does not match is
still rejected.

### D22. `getUser()` everywhere on the server, never `getSession()`

`getSession()` reads the cookie without verifying it, so its contents can be
forged. Every server-side auth check revalidates the token with Supabase.

### D23. Middleware is not the authorisation boundary

Middleware checks only that a session exists, because it runs before RLS and
can be bypassed by anything reaching a route handler directly. Staff membership
is verified again server-side on the page via `is_staff_anywhere()`, and RLS
enforces it a third time at the database. Middleware is a redirect convenience,
not a gate.

### D24. `/auth/callback` validates its `next` parameter

Only same-origin relative paths are accepted, and `//host` (protocol-relative)
is rejected. Without this the callback is an open redirect.

### D25. Sign-out is a POST form, not a click handler

A GET sign-out can be triggered by a link prefetch or an `<img>` tag. The form
also works with JavaScript disabled.

### D26. A signed-in non-staff user sees an explanation, not a redirect loop

`/admin/login` distinguishes "not signed in" from "signed in but not staff" and
offers sign-out in the second case.

---

## Phase 4 — Member app

### D27. Demo data is seeded as a migration, with a deletable marker

`20260901001000_demo_data.sql` creates 20 members with memberships, six weeks of
attendance, and two alerts, so the pitch shows a working gym rather than a set
of zeroes. Every demo account uses the `@demo.bodyholics` email domain, so
`delete from auth.users where email like '%@demo.bodyholics'` removes all of it
and the foreign key cascades clean up the rest.

The rows are inserted straight into `auth.users` with no password and no
identity row, so none of them can be signed in to — they exist only as data.
Real members still arrive through Google and the `handle_new_user` trigger,
untouched by any of this.

### D28. The crowd level is four bars, not a percentage

The owner sets this by hand from the desk. A precise-looking "68% full" would
claim accuracy the data does not have. Four bars reads honestly and is legible
across a loud room. It carries `role="meter"` with an `aria-valuetext` so it is
not just a row of coloured divs to a screen reader.

### D29. Member pages are `force-dynamic`

Opening hours, crowd level, and membership status all change through the day.
A cached member home screen showing "Open now" on a closed gym is the one
failure this app cannot have.

### D30. Google avatars use `unoptimized`

`next/image` would otherwise proxy every avatar through the Vercel image
optimizer, which on the Hobby plan is a metered resource spent on a 56px circle.
The alternative — adding `lh3.googleusercontent.com` to `remotePatterns` — still
pays that cost.

---

## Phase 5 — Admin dashboard

### D31. `/admin/login` lives in a separate route group

`app/(admin)/admin/layout.tsx` guards everything beneath it, and a layout
cannot opt one of its own children out of that guard without a redirect loop.
The login page therefore sits in `app/(admin-auth)/admin/login/`, which resolves
to the same URL but inherits no guard.

### D32. Every admin write is a server action that re-checks staff status

Three layers guard admin writes: middleware (session exists), the server action
(`is_staff_anywhere()`), and RLS at the database. The middle layer exists to
turn a silent empty result into a message the user can read.

### D33. Membership end dates are derived, never entered

`startMembership` reads `duration_days` off the plan and computes the end date
server-side. There is no date field in the UI, so the plan and the membership
cannot disagree.

### D34. Prices are entered in whole rupees and stored as paise

The form takes rupees because that is what the owner says out loud; the action
multiplies by 100 on the way in. The database never sees a decimal.

### D35. Member search needs two characters before it lists anyone

One letter against a few hundred members is a wall of names, and staff have a
queue waiting. Results are also capped at 8.

### D36. The first real Google sign-in becomes the gym owner

Nobody can reach `/admin` until a row exists in `staff`, and nobody can create
that row without already being staff. `handle_new_user` breaks the deadlock by
granting `owner` to the first sign-in whose email is not a seeded
`@demo.bodyholics` account. It never fires again once an owner exists.

Without this the dashboard would be unreachable and the pitch would need a
manual SQL step on the day.

### D37. The seeded "today" check-ins were re-anchored to Asia/Kolkata

They were originally written in UTC, so some fell on the wrong side of the
gym-time day boundary and `/check` read 1 check-in instead of 6. Fixed in
`20260901001100`.

---

## Phase 6 — Owner quick-check

Already built in Phase 2 (see D19). This phase was verification rather than
construction. Confirmed live in a browser at 375px against the real database:

- PIN pad rejects `9999` with a red shake and clears itself.
- PIN `1234` unlocks: lock icon opens, green pulse ring fires, dashboard loads.
- Today's count (6), active members (18), crowd level, open/closed, and the
  last five members to check in all read from Supabase.
- `/check` returns 200 with no session — the PIN and the RPCs are the gate.

Screenshots in `design/screenshots/`.

---

## Phase 7 — Polish

### D38. `middleware.ts` migrated to `proxy.ts`

Next 16 deprecates the `middleware` file convention and warns on every dev
boot. Renamed the file and the exported function; behaviour is unchanged.

### D39. One documented JS mirror of the colour tokens: `lib/theme.ts`

The audit for raw hex found six real leaks. `<meta name="theme-color">` and the
two manifests' `background_color`/`theme_color` are read by the operating system
before any CSS parses, so they cannot reference a custom property — they must be
literals in JavaScript.

Rather than leave six scattered hex values, they now come from `lib/theme.ts`,
which exists solely to hold them and says in its own comment that it must stay
in sync with `globals.css`. The coupling is real but it is now in one file
instead of six.

### D40. The Google "G" keeps its own colours

`components/ui/icons.tsx` carries four literal hex values for the Google logo.
Google's brand guidelines require those exact values on a sign-in button; they
are not our design tokens and must not follow our palette in either theme. This
is a documented exception, noted in the component.

### D41. Four `aria-label`s were hardcoded and are now in `strings.ts`

Screen readers read these aloud, which makes them user-facing copy like any
other. `common.close`, `common.mainNav`, and `common.dashboardNav` were added.

### D42. `formatRelative` no longer says "just now" about the future

A timestamp ahead of the current time produced a negative interval, which fell
through to "just now" and read as a lie next to a check-in that had not
happened. Future timestamps now render as a clock time.

Found by looking at the running app, not by a test — the demo check-ins were
seeded at fixed morning hours and the app was being run after midnight.

### D43. Demo check-ins are anchored to `now()`, not to a fixed hour

Pinning them to 9am, 11am, and so on meant they sat in the future whenever the
app ran earlier in the day. They now spread backwards from the current moment,
which is correct whatever time the pitch happens.

### Audit results

- Raw hex outside `globals.css`: none, excluding the two documented exceptions
  above.
- Font names or pixel sizes outside `globals.css`: none.
- Hardcoded user-facing strings in components: none.
- Route protection verified live: `/app/*` → `/join`, `/admin/*` →
  `/admin/login`, `/check` reachable with no session, `/sw.js` not intercepted.
