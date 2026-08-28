# Deploying the prototype

Both clients build and are installable PWAs. What is left needs credentials that
only you can supply — a Supabase database password and a Vercel login. Run these
in order from the repo root.

Verified green as of 2026-08-28 on branch `worktree-pwa-ship`:
`pnpm typecheck`, `pnpm lint`, `pnpm test`, both production builds, and
`check-no-secrets` over both built bundles.

---

## 1. Apply migrations to the hosted project

The hosted project is `figrqxfwjzmhqigzitbi`. Nothing here has been run against
it yet, so assume the schema is not applied.

```bash
supabase link --project-ref figrqxfwjzmhqigzitbi
supabase db push
```

`link` prompts for the **database password** (Supabase dashboard → Settings →
Database). It is not the service-role key, and it is not stored in this repo.

Then check what actually landed:

```bash
node scripts/probe-hosted.mjs
```

Read-only. Prints a row count per table and no key material. `404` on a table
means that migration did not apply.

**Do not** run SQL by hand against the hosted database — CLAUDE.md rule 4. If a
migration fails, fix the file in `supabase/migrations/` and push again.

## 2. Create the owner account

```bash
node scripts/seed-demo-owner.mjs --yes-this-is-a-demo-gym
```

Creates the BodyHolics gym, its opening hours, the three plans (₹1,500 / ₹4,000 /
₹14,000), and an OWNER account:

- username `ChiragDawra`
- password `12345678`

The flag is required because the target is not a local stack. That password is
weak and publicly known, and the account it protects can read every member's
phone number — so this is a demo gym only. The script refuses outright once the
gym has real members.

Sign-in accepts the bare username `ChiragDawra`; it is completed to
`ChiragDawra@staff.bodyholics.app` against `NEXT_PUBLIC_ADMIN_USERNAME_DOMAIN`.
A full email address also works and is passed through unchanged.

## 3. Deploy admin-web

```bash
vercel login          # once
cd apps/admin-web
vercel --prod
```

Next.js is auto-detected. Set these in the Vercel project (Settings →
Environment Variables) — copy the values from `apps/admin-web/.env.local`:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://figrqxfwjzmhqigzitbi.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from `.env.local` (publishable) |
| `NEXT_PUBLIC_APP_ENV` | `production` |
| `NEXT_PUBLIC_ADMIN_USERNAME_DOMAIN` | `staff.bodyholics.app` |

`src/lib/env.ts` validates these at module load, so a deploy that is missing one
fails the build rather than shipping a broken page. That is deliberate.

Never set `SUPABASE_SERVICE_ROLE_KEY` on either Vercel project.

## 4. Deploy member-mobile

```bash
cd apps/member-mobile
vercel --prod
```

`apps/member-mobile/vercel.json` already carries the build command, the SPA
catch-all rewrite, and the `/sw.js` no-cache headers. Framework is `null` on
purpose — this is an Expo web export, not a Next.js app.

Environment variables, from `apps/member-mobile/.env.local`:

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://figrqxfwjzmhqigzitbi.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | from `.env.local` (publishable) |
| `EXPO_PUBLIC_APP_ENV` | `production` |
| `EXPO_PUBLIC_JOIN_BASE_URL` | the member app's own deployed URL |

`EXPO_PUBLIC_JOIN_BASE_URL` is a chicken-and-egg: it is the base of the QR join
link, so it has to be the deployed URL. Deploy once, set it to the URL Vercel
returns, then redeploy.

## 5. Check it on a phone

1. Open the admin URL, sign in as `ChiragDawra` / `12345678`.
2. Settings → the gym QR. That QR encodes `<join-base-url>/?slug=<gym-slug>`.
3. Point an iPhone Camera at it. iOS opens the link directly and the member app
   routes straight to phone entry — the in-app viewfinder is skipped, which is
   why iOS Safari lacking `BarcodeDetector` does not matter here.
4. Share → Add to Home Screen. Android offers the install prompt from the
   manifest; iOS uses the `apple-touch-icon` and `apple-mobile-web-app-*` tags,
   because Safari ignores the web manifest.

## Known gap: SMS OTP

Member sign-up is phone + OTP, and Supabase phone OTP needs an SMS provider.
Indian SMS additionally requires DLT-registered templates, which is a
registration process, not a code change (`docs/11_OPEN_QUESTIONS.md` Q1).

Until a provider is configured, member sign-up will not complete on a real
phone number. For a demo, add a test number and its fixed OTP under Supabase
dashboard → Authentication → Phone → Test OTP, and the flow works end to end
without sending an SMS.

## What is deliberately not cached

Neither service worker caches an authenticated response. A cached page outlives
the session that was allowed to see it, and the member QR has a TTL — caching
either would be a leak rather than a speed-up. `/sw.js` itself is served
no-cache, because a cached worker pins an installed PWA to the build that
installed it and no later fix ever reaches it.
