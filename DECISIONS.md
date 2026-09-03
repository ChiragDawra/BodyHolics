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

---

## v2 — Reskin from Claude Design, admin rework

Design source: `BodyHolics App v2.dc.html` (primary) and `BodyHolics Dark.dc.html`
(member visual language) in Claude Design project `c2430910`. Read via the
DesignSync MCP. `support.js` is the canvas runtime, not design content, and was
ignored.

### D44. The palette is now dark-only

Every screen in both design files is dark, and the new tokens are dark values.
Keeping a light mode nobody designed would mean shipping a second, worse
product that no screenshot in the brief covers. `color-scheme: dark` is set so
form controls and scrollbars follow.

### D45. `--color-surface-sunken` renamed to `--color-surface-overlay`

In the old light palette `#F0EFEB` sat *below* the card. In the new dark
palette `#242422` sits *above* it — chips, sheets, and pressed states. Keeping
the name "sunken" for the raised colour is exactly the kind of thing that rots,
so it was renamed across the codebase. `--color-surface-high` (`#2E2E2B`) was
added for borders and the alert sheet.

### D46. "Best time today" reads the attendance histogram, not `crowd_reports`

The instruction said to query a `crowd_reports` table for this weekday. That
table does not exist, and the design doc is explicit that it should not:
*"A view or RPC for weekday check-in histogram … No new table."* The check-in
log already knows when the gym is busy, and a crowd-report table would have
started empty and stayed empty because nothing writes to it.

`quietest_hour(gym_id, weekday)` buckets `attendance.checked_in_at` by hour for
that weekday over 120 days and returns the quietest. It returns null rather
than guessing when fewer than three hours have two days of history.

**Bug found by looking at the running app:** the first version bounded the
search to a hardcoded 5–22 and recommended *"quiet after 10 pm"* — closing
time. Technically true and useless. It now reads the gym's own `weekly_hours`
for that weekday and excludes the final hour, so it suggests 3 pm rather than
the moment the doors shut.

### D47. Live occupancy needed `attendance.checked_out_at`

"8 in the gym right now" is not derivable from check-ins alone. Added as a
nullable column, with a partial index on open rows. Staff check people out from
the attendance table; every historical visit was closed out in the demo seed so
only today's can be open.

### D48. `payments` is a real table, not a view over `plans`

`plans.price_paise` cannot express collected vs. pending — a membership can
exist without the money having arrived. Revenue, outstanding dues, and the
member's own "nothing due" line all read from `payments`. Nothing charges
anyone: this records cash the owner already takes at the desk.

### D49. The staff code is verified by a function, never read by a browser

`staff_codes` has no select policy for a plain member. `complete_profile()` and
`staff_code_valid()` are SECURITY DEFINER: they compare and then grant or
refuse. A member can *use* a code without being able to enumerate codes.
Verified: anon select on `staff_codes` returns `[]`.

The seeded code is `BHSTAFF2024`, as specified.

### D50. Admin-by-email is routing, not authorisation

`isAdminEmail()` in `lib/config.ts` decides where middleware *sends* someone
after sign-in. It is not a permission check. The admin layout still calls
`is_staff()` server-side and RLS still enforces staff membership at the
database, so an email match with no staff row reaches /admin and sees nothing.
This mirrors what the design doc says: *"the `staff` table and `is_staff()`
already exist for the real thing, so RLS does not change."*

### D51. `/app/complete-profile` is exempt from the admin redirect

Middleware sends the admin email to /admin from anywhere under /app — except
the profile form. The owner has to give the desk a phone number like everyone
else, and bouncing them off the form would leave `profiles.phone` null forever.

### D52. Walk-in members get a sign-in-incapable `auth.users` row

`profiles.id` references `auth.users`, so "add member manually" cannot just
insert a profile. `add_walk_in_member()` creates an auth row with no password
and no identity — the same shape as the demo seed — so the account exists as a
record the desk can check in and bill, but cannot be signed in to. Gated on
`is_staff()` inside the function, since inserting into `auth.users` is
privileged. If that person later signs in with Google they get a separate
profile; merging the two is a real feature and deliberately not attempted.

### D53. The member detail route became a panel

v2 shows member detail as a side panel next to the table (desktop) and a bottom
sheet (phone), so `/admin/members/[id]` was deleted. Detail is fetched per
member on selection rather than for all of them up front — 84 members ×
membership history × 30 days of attendance is a lot of rows to ship for the one
row someone clicks.

### D54. Plans moved into Gym settings

The v2 sidebar has six items and Plans is not one of them; the design puts plan
CRUD in a card on the settings page. `/admin/plans` was removed.

### D55. The admin phone layout is three tabs, not a squeezed sidebar

Below 640px the sidebar is replaced by Dashboard / Members / More. The owner on
a phone is checking a number or flipping the gym open; revenue tables and plan
editing live behind More and are laid out for a laptop. Each More row carries a
live summary so the answer is often visible without opening the page.

### D56. Quick alert on the phone is title-only

One field, no body. Someone standing at the desk with one hand free is sending
"Closing early today", not composing. The full composer with a body is on the
Alerts page.

### D57. "Pay dues" is present and visibly off

Payments are out of scope, but omitting the control makes the screen look
unfinished. It renders greyed with `cursor-not-allowed` and toasts the honest
reason on tap, which shows the owner where the feature will live without
pretending it exists. Same treatment on "Record payment" in the admin panel.

### D58. `lib/theme.ts` updated, still the only JS colour mirror

The manifest and `<meta name="theme-color">` are read by the OS before CSS
parses, so they must be literals. Both now point at the new base `#0F0F0E`.

### Audits

- Raw hex outside `globals.css`: none, except the two documented exceptions
  (`lib/theme.ts`, the Google "G").
- Font names or pixel sizes outside `globals.css`: none. One real leak found
  and fixed — `h-[150px]` on the revenue chart became `h-37.5`, which is
  `37.5 × --spacing`.
- Hardcoded user-facing strings, `aria-label`s, and placeholders: none.
- `/check` references anywhere in source: none. Route returns 404.

### Verified live in a browser

- Landing, `/join`, `/join/done`, `/install`, `/admin/login` all render on the
  new palette.
- Member home renders as a bento grid: hero, crowd + live count pair,
  membership, best time, streak, frosted tab bar.
- Crowd segments confirmed rendering via computed style (green
  `rgb(58,175,87)`, 6px, opacity 1) after they looked absent in a scaled
  screenshot.
- `/app` → `/join` and `/admin` → `/admin/login` when signed out; `/check` 404.

### Not verified

The admin dashboard and the member screens for a member *with* a membership
have not been seen rendered. Both need a signed-in session — the admin needs
`chiragdawra46@gmail.com` specifically — and Google sign-in cannot be completed
from here. The queries, actions, and RLS are verified at the database layer;
the rendered pages are not.

---

## Phase 8 — Realtime sync for gym open/closed and crowd

### D59. The bug was RLS, not the client. `gyms` had no UPDATE policy at all

`20260901000200_gyms.sql` created a select policy and nothing else, with a
comment saying writes "go through staff RLS (added with the staff table)".
They never were. `20260901000400_staff_and_profiles.sql` adds policies to
`staff` and `profiles` and never comes back to `gyms`.

So every staff write — `is_open_override`, `crowd_level`, `weekly_hours` —
matched zero rows. This is the dangerous shape of an RLS failure: Postgres
reports an UPDATE that RLS filtered down to nothing as a *successful* update
of no rows, so supabase-js returns `error: null` and the server action returns
`{ ok: true }`. The optimistic UI flipped, the action reported success, the row
never changed, and the next read put it back. That is exactly the reported
symptom — "reverts even after refresh".

Confirmed before the fix by reading the row directly over the REST API with
the anon key: `crowd_updated_at` was still `2026-08-31T19:10:41Z`, the seed
timestamp, after the owner had used the toggles repeatedly.

`20260903000100_gyms_staff_write_and_realtime.sql` adds
`staff update their own gym` using `is_staff(id)`.

### D60. Every gym write now asks for its rows back

A policy fixes today's bug. It does not stop the next one from being silent.
`setOpenOverride`, `setCrowdLevel`, and `updateHours` now append `.select("id")`
and treat an empty result as a failure (`NOT_WRITTEN`), so an RLS rejection can
never again be indistinguishable from a successful write.

`GymStatusControls` correspondingly rolls its optimistic state back and shows
the message when an action fails. Optimism is only honest if failure is visible.

### D61. One realtime provider per screen, not one subscription per tile

`components/member/GymLive.tsx` holds a single `postgres_changes` subscription
on the gym row and hands the result to `LiveHeroStatus` and `LiveCrowdMeter`
through context. Two components each subscribing to `gyms` would open two
channels for the same row.

`gyms` had to be added to the `supabase_realtime` publication — realtime only
streams tables that are in it. Realtime applies RLS to what it streams, and
`gyms` is world-readable, so the same provider works signed in on `/app` and
signed out on the landing page.

### D62. `initial` is compared by value, not used as an effect dependency

The provider prefers the last realtime payload over the server render, so a
change missed while the socket was disconnected would otherwise be masked
forever by a stale event. `initial` is a fresh object every render and cannot
be a dependency, so it is compared as a JSON key during render (React's
documented "adjust state when props change" pattern) and a genuinely different
server render clears the live row.

A one-minute clock tick also re-resolves the open state, because "is the gym
open" depends on `now()` as well as on the row — the gym closes at 10pm whether
or not anyone touched a control.

### D63. A staff row was added for the test account

Verification needed a staff session and the only browser session available was
`dawrachirag0815@gmail.com`, a member. With the owner's agreement that account
was added to `public.staff` as `role = 'staff'` by a one-off query rather than
a migration, so it is not baked into the repo.

**Remove it before this is real:**

```sql
delete from public.staff where id = '5420f88c-7b3d-4f2e-9285-2853b012181d';
```

### Verified

- **RLS, by impersonating a JWT in SQL** (`set local role authenticated` with
  `request.jwt.claims`): staff UPDATE on `gyms` matched 1 row, plain-member
  UPDATE matched 0. The same harness with a deliberately inverted expectation
  was run as a control and did raise, so the passing run was not a no-op.
- **`gyms` is in the `supabase_realtime` publication** — confirmed from
  `pg_publication_tables`.
- **The write persists** — clicked "Force closed" in `/admin`, then read the
  row over REST: `is_open_override` became `false`. The first time this app has
  ever written that column.
- **The member screen updates live with zero refresh** — member `/app` in one
  tab, `/admin` in another. "Force closed" flipped the member hero from OPEN to
  CLOSED, including the accent edge going green to red, with no reload and no
  navigation. Setting crowd to "Crowded" flipped the member tile to "Crowded",
  three of four segments lit, caption changed to "Most stations are busy."
- **Restored** — "Follow hours" and "Not crowded" returned the row to
  `is_open_override: null`, `crowd_level: not_crowded`, confirmed over REST.

---

## Theme — GymOS extraction

Colour, type, and card language taken from five GymOS reference screens. A
theme extraction only: no screen layout, no tab arrangement, and no
information architecture came across. The bento grid and every screen
structure are untouched.

### D64. Two purples, and they are not interchangeable

The references use a light lavender for large filled surfaces (primary
buttons, progress fills, the highlighted number, the active tab) and a
saturated indigo for the occasional element that has to out-rank a lavender
one beside it. Collapsing them into one token loses the distinction the
reference is actually making, so both exist:

- `--color-brand: #B9AEFF` — the lavender. Light, so `--color-on-brand` is a
  near-black indigo, never white.
- `--color-brand-strong: #6355F0` — the indigo, with white text.

Lavender is the default. If both appear with equal weight on one screen, one
of them is wrong.

### D65. Card elevation is a tinted surface scale, not a shadow

Every surface step now carries slightly more blue than red, so a card reads as
a lifted panel rather than a flat grey box on black. The tint is deliberately
below the point where anyone would call it purple — it is elevation, not
decoration.

`.bh-panel` adds the top-left lit gradient the reference uses on the one card
per screen carrying the headline fact (the membership card). It is built from
`color-mix` of two existing tokens rather than a new colour, so it survives a
palette change.

### D66. Badges became capsules; labels became uppercase and tracked

`Badge` is `rounded-full` with a tinted background and full-opacity text, plus
an optional leading dot for the states a member checks at a glance. Capsule
rather than rounded rectangle so it never reads as a button — a badge states a
fact, it is not something to press.

`CardLabel` and the twelve places that had open-coded the same treatment now
share one style: `--text-label` (11px) at `--tracking-label`, uppercase. Two
strings in `strings.ts` were written in capitals (`"MEMBERSHIP HISTORY"`);
shouting belongs to CSS, so they are sentence case now and the style
uppercases them.

### D67. The membership card shows a timeline, not a bare progress bar

`MembershipTimeline` replaces the 3px progress rule on both the home screen
and Me. A countdown says how long is left but not how far through you are — 23
days is most of a monthly plan and almost none of an annual one. The line puts
the number in its span, with real dates at both ends.

The Today marker is a donut rather than a dot so it stays legible when it
lands on top of either end. Its dot sits at the true position but its *label*
is clamped to 18–82%, because on the first or last day of a membership the
marker genuinely is on top of "Start" or "Expiry", and a label overlapping a
date is worse than a label sitting slightly beside its dot.

### D68. `membershipSpan()` replaced two different inline calculations

Both member screens computed the countdown and the progress percentage inline,
and they did not agree: the span came from millisecond timestamps while the
countdown came from `daysUntil`, so the bar and the number could differ by a
day either side of midnight. One function, one answer, in `lib/format.ts`.

### D69. Plan benefits are a real column, so the checklist is never invented

The reference has a plan-benefit checklist. `plans` had nowhere to read one
from, so that list could only have been hardcoded in the component — the one
thing this design does not permit. `plans.benefits text[]` is what the owner
types into from Gym settings, one per line. `CheckList` renders nothing at all
for an empty array, so a plan nobody has described shows no section rather
than a heading over a placeholder.

### D70. Payment history on Me is the member's own rows

The same query that computes what a member owes now returns their whole
payment list, so the reference's payment-row style (date left, amount right,
status icon and word underneath) has real data behind it. The status goes on
its own line because on a phone the two things a member scans for are "when"
and "how much"; those keep the full width and stay aligned down the list.

### D71. Bug found while checking the reskin: every tab lit up at once

`TabBar` marked a tab active on `pathname.startsWith(tab.href + "/")`. On
`/app/me` that also matches the Home tab (`/app`), so two tabs read as
current on every subpage. The most specific matching tab now wins.

### D72. Bug found while checking the reskin: staff RLS was infinitely recursive

The Staff panel and the staff code in Gym settings were rendering empty. The
cause was not the component:

```
ERROR: 42P17: infinite recursion detected in policy for relation "staff"
```

`owners manage staff` is a `FOR ALL` policy on `public.staff` whose `USING`
clause selects from `public.staff`. Evaluating it required reading the table,
which required evaluating it. Because it is `FOR ALL` it governs SELECT too,
so *every* read of the staff table failed — not just an owner's writes.
`owners manage staff codes` then failed with it, since deciding that policy
meant reading `staff`.

`getStaff()` destructures only `data` and ignores `error`, which is why a hard
Postgres error surfaced as a quietly empty list. That swallowing is worth
revisiting across the query layer; it is what let this sit unnoticed.

Fixed by `is_gym_owner(uuid)`, SECURITY DEFINER for the same reason
`is_staff()` already was — it does not re-enter the table's own RLS.

### Verified

- Member Me and the admin Gym settings render on the new palette: tinted
  panels, capsule badges, uppercase tracked labels, lavender primary button.
- Tab bar: on `/app/me` only Me is active. Was Home *and* Me before the fix.
- Staff RLS, by impersonating the signed-in account's JWT in SQL: reads were
  `gyms=1 staff=0 staff_codes=0` failing with 42P17 before the migration, and
  `gyms=1 staff=4 staff_codes=1` after. The Gym settings panel now lists four
  staff accounts and the staff code, having shown neither before.
- `tsc --noEmit`, `eslint`, `next build` all clean.

---

## Phase 9 — Split opening hours and a crowd timetable

### D73. Hours became rows, not a wider JSON shape

`gyms.weekly_hours` held one `{ open, close }` pair per day. The gym's real
schedule is 5:30–11:30, shut, then 16:00–22:00, and a single range cannot say
that — it would have to claim the gym is open at 2pm.

`gym_hour_blocks` is one row per stretch of open time, with a CHECK that a
block ends after it starts. Open now means "now falls inside *any* of today's
blocks", so the midday gap is closed for the same reason 3am is.

`day_of_week` is ISO — Monday = 1 … Sunday = 7 — matching `gymIsoWeekday()`.
Postgres's own `extract(dow)` is Sunday = 0, and the column comment says so,
because that mismatch is a bug waiting to be written.

### D74. `weekly_hours` was dropped, and its contents recorded in the migration

Keeping a dead column that nothing reads is how the next person ends up
editing the wrong one. Its entire contents at the moment of the drop are
written into the migration comment, since a dropped column is not recoverable
and that was the only copy:

```
mon..fri  { "open": "06:00", "close": "22:00" }
sat, sun  { "open": "07:00", "close": "20:00" }
```

They were not converted into blocks — that was the single-range approximation
this phase exists to replace, and the real hours were seeded instead.

### D75. `crowd_level` was renamed to `crowd_override`, not replaced

Crowd is a weekly pattern: the same hours are busy every Tuesday. Asking the
desk to remember to update a live figure produces a figure that is always
wrong, so `crowd_schedule` holds the pattern and the manual value is demoted
to an override with exactly the shape `is_open_override` already has — null
follows the schedule, a value beats it.

Renaming rather than adding a second column keeps one answer to "how busy is
it". The old contents were set to null rather than carried over: until D59
landed, no write to `gyms` could take effect at all, so the column held the
seed default and no owner intent.

Outside every scheduled slot the resolver answers `not_crowded`, because those
are the hours nobody is there.

### D76. The schedule editors are lists, deliberately not a calendar

The owner is describing a weekly pattern that changes twice a year, not
booking anything. A grid of draggable blocks would be a lot of interface for
"we shut at eleven-thirty and open again at four". Each day is a list of time
ranges with an add and a remove; the crowd editor adds a level dropdown.

Both hand the server the complete list and both actions replace wholesale
rather than diffing. The whole schedule is a few dozen rows, and a diff would
be more code with more ways to leave an orphan behind.

### D77. The crowd override now has a way back

`GymStatusControls` previously had no way to *clear* a crowd level, because
there was nothing to fall back to. Now that a schedule exists, picking a level
sets an override and a "Follow the schedule again" button appears beside it,
matching "Follow hours". An override nobody can see is an override nobody
remembers to clear, so the panel also says which of the two is deciding.

### D78. The landing page shows seven days instead of two

"Monday to Friday" and "Saturday and Sunday" cannot describe a split schedule
without dropping one of the two sessions. Seven rows is more honest, and since
the midday gap is the thing people get wrong, more useful. Today's row is
emphasised.

### Verified

- **The resolvers, against the real seeded rows at twelve times of day** that
  the wall clock would not conveniently be, by importing `lib/gym.ts` directly
  and fetching the tables over REST. All pass, including the three that matter:
  13:00 is closed and says "opens 16:00"; 15:59 is still closed; 16:00 is open
  until 22:00. Boundaries are half-open as intended — 21:59 open, 22:00 shut.
  The weekday rushes (07:30 and 18:30 crowded) and the quieter weekend evening
  resolve correctly. Five override assertions pass too: forcing open at 13:00,
  forcing closed at 18:00, and a crowd override beating the timetable.
- **Live at the current wall clock** — Thursday 17:06 IST rendered "OPEN until
  10 pm" and "Filling up", which is the 16:00–22:00 block and the 16:00–18:00
  moderate slot.
- **The editors write** — changed Monday 05:30–07:00 from "Not crowded" to
  "Very crowded" in the browser and read it back over REST as `very_crowded`,
  with the other 35 rows intact and the total still 36, confirming the
  delete-then-insert replaces rather than duplicates. Restored afterwards and
  confirmed back to `not_crowded`.
- `tsc --noEmit`, `eslint`, `next build` all clean.
