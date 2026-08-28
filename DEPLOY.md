# Deploying the prototype

Both clients build and are installable PWAs. Most of the setup is already done —
what remains is two deploy commands and one seed command, all listed below.

Verified on 2026-08-28, branch `worktree-pwa-ship`: `pnpm typecheck` (10/10),
`pnpm lint` (10/10), `pnpm test` (8/8), both production builds, and
`check-no-secrets` clean over both built bundles.

You do **not** need to merge this branch into `main`. `vercel deploy` uploads the
files on your disk; it does not care which branch you are on.

---

## Already done

- **Migrations are applied.** All 12, including `20260827090000_support_email_identity`,
  are present on the hosted project `figrqxfwjzmhqigzitbi` (BodyHolics,
  `ap-south-1`, `ACTIVE_HEALTHY`). `supabase migration list --linked` shows local
  and remote in step. There is nothing to push.
- **Supabase CLI is linked** to that project.
- **Two Vercel projects exist**: `admin-web` and `member-mobile`, under
  `chiragdawra46-7007s-projects`.
- **Production environment variables are set on both**, using the hosted
  project's URL and its real anon key (fetched from
  `supabase projects api-keys`, not from `.env.local` — see the warning below).

## What is left

Three commands. Run them from the repo root.

```bash
node scripts/seed-demo-owner.mjs --yes-this-is-a-demo-gym
vercel deploy --prod --project admin-web     --local-config vercel.admin-web.json
vercel deploy --prod --project member-mobile --local-config vercel.member-mobile.json
```

---

## 1. Seed the owner account

```bash
node scripts/seed-demo-owner.mjs --yes-this-is-a-demo-gym
```

Creates the BodyHolics gym (slug `bodyholics`), its opening hours, the three
plans (₹1,500 / ₹4,000 / ₹14,000), and an OWNER account:

- username `ChiragDawra`
- password `12345678`

The flag is required because the target is not a local stack. That password is
weak and publicly known, and the account it protects can read every member's
phone number — so this is a demo gym only. Rotate it before any real member
signs up. The script refuses outright once the gym has members.

Sign-in accepts the bare username `ChiragDawra`, completed to
`ChiragDawra@staff.bodyholics.app` against `NEXT_PUBLIC_ADMIN_USERNAME_DOMAIN`.
A full email address also works and is passed through unchanged.

To see what is already in the hosted database first:

```bash
node scripts/probe-hosted.mjs
```

Read-only, prints a row count per table and no key material.

**Do not** run SQL by hand against the hosted database — CLAUDE.md rule 4. If a
migration ever needs changing, edit the file in `supabase/migrations/` and push.

## 2. Deploy

```bash
vercel deploy --prod --project admin-web     --local-config vercel.admin-web.json
vercel deploy --prod --project member-mobile --local-config vercel.member-mobile.json
```

Both run **from the repo root**, and that matters. This is a pnpm workspace: both
apps import `@gym/domain`, `@gym/validation`, `@gym/ui` and `@gym/types`.
Deploying from inside `apps/admin-web` uploads only that directory, the workspace
packages are absent, and the build fails on unresolved imports. Running from the
root uploads the whole workspace, so `pnpm install` and `pnpm --filter` resolve
normally.

That is what the two root config files are for — `vercel.admin-web.json` and
`vercel.member-mobile.json` each set the filtered build command and point
`outputDirectory` at the right app.

`apps/member-mobile/vercel.json` still exists and holds the same headers and
rewrites. It only applies if you instead set the project's Root Directory to
`apps/member-mobile` in the Vercel dashboard. Pick one route; the root configs
are the one used here.

Never set `SUPABASE_SERVICE_ROLE_KEY` on either Vercel project.

## 3. Check it on a phone

There is **no QR-generation screen in admin-web** — registration is member-led
and the admin app deliberately has no scanner and no "Add Member" flow
(CLAUDE.md rule 9). So the join link is one you construct:

```
https://<member-app-url>/scan?slug=bodyholics
```

`scan.tsx` reads that `slug` query param and routes straight to phone entry,
skipping the camera. Paste that URL into any QR generator to get a QR for the
gym wall.

1. Open the admin URL, sign in as `ChiragDawra` / `12345678`.
2. Point an iPhone Camera at the QR. iOS opens the link and the member app goes
   straight to phone entry — which is why iOS Safari lacking `BarcodeDetector`
   does not matter. Android does the same. Typing `bodyholics` into the code
   field on the scan screen also works.
3. Share → Add to Home Screen. Android offers the install prompt from the
   manifest; iOS uses the `apple-touch-icon` and `apple-mobile-web-app-*` tags,
   because Safari ignores the web manifest.

## Known gap: SMS OTP

Member sign-up is phone + OTP, and Supabase phone OTP needs an SMS provider.
Indian SMS additionally requires DLT-registered templates, which is a
registration process, not a code change (`docs/11_OPEN_QUESTIONS.md` Q1).

Until a provider is configured, sign-up will not complete on a real number. For
a demo, add a test number and its fixed OTP under Supabase dashboard →
Authentication → Phone → Test OTP, and the flow works end to end without
sending an SMS.

## Watch out: `.env.local` points at localhost

Both `apps/admin-web/.env.local` and `apps/member-mobile/.env.local` are
configured for a **local** Supabase stack (`http://127.0.0.1:54321`), and the
anon key in them is the local placeholder. They are correct for local
development and wrong for anything hosted. The Vercel environment variables were
set from `supabase projects api-keys --project-ref figrqxfwjzmhqigzitbi`
instead. Do not copy `.env.local` values into a deploy.

`EXPO_PUBLIC_JOIN_BASE_URL` appears in `apps/member-mobile/.env.local` but is
read by no code in the repo. It is dead config and needs no value on Vercel.

## What is deliberately not cached

Neither service worker caches an authenticated response. A cached page outlives
the session that was allowed to see it, and the member QR has a TTL — caching
either would be a leak rather than a speed-up. `/sw.js` itself is served
no-cache, because a cached worker pins an installed PWA to the build that
installed it and no later fix ever reaches it.
