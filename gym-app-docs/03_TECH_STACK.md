# 03 — Tech Stack

## 1. Selections

| Layer | Choice | Notes |
|---|---|---|
| Member app | React Native + **Expo** (managed, Dev Client) | Expo Router for typed file-based routing |
| Admin app | **Next.js** App Router | Desktop-first, responsive down to tablet |
| Admin styling | Tailwind CSS + shadcn/ui | Copy-in components, no heavy UI dependency |
| Mobile styling | StyleSheet + a small token module in `packages/ui` | NativeWind is optional; do not mix both |
| Backend | **Supabase** — Postgres, Auth, Storage, Realtime, Edge Functions | |
| Server logic | Edge Functions (Deno) | Trusted operations only |
| Payments | **Razorpay** | Standard Checkout via web redirect (D-009) |
| Validation | **Zod** | Shared client + server (mirrored for Deno, D-012) |
| Server state | **TanStack Query v5** | Both apps |
| Forms | **React Hook Form** + `@hookform/resolvers/zod` | |
| Dates | **date-fns** + `date-fns-tz` | No moment, no luxon; pick one and stop |
| Charts (admin) | **Recharts** | |
| QR scan (mobile) | `expo-camera` | |
| QR render (mobile) | `react-native-qrcode-svg` + `react-native-svg` | |
| QR scan (admin) | `html5-qrcode` or `@zxing/browser` | Staff scanner in the browser |
| Testing | **Vitest** (unit) · React Native Testing Library · **Playwright** (admin E2E) · `supabase test db` / pgTAP (RLS) | |
| Monorepo | **pnpm workspaces + Turborepo** | |
| CI | GitHub Actions | |
| Hosting | Vercel (admin) + Supabase managed | |

## 2. Version pinning

**Pin exact versions in the root `package.json` at bootstrap and record them here.** Do not use `^` ranges for Expo, React, React Native, Next, or Supabase packages — minor bumps in this ecosystem are frequently breaking.

```
# Fill in at bootstrap, then treat as authoritative:
expo                       = <pinned>
react-native               = <as required by the Expo SDK>
react                      = <as required by the Expo SDK>
next                       = <pinned>
@supabase/supabase-js      = <pinned>
typescript                 = <pinned>
```

Rules:
- The **Expo SDK version dictates** the React and React Native versions. Never bump RN independently — run `npx expo install --check` / `npx expo-doctor` and let Expo choose.
- Use `npx expo install <pkg>` (not `pnpm add`) for any package with a native module, so Expo resolves a compatible version.
- Upgrade Expo SDKs deliberately, one at a time, on their own branch, with the app run on a physical device before merge.

> Agent note: the docs you were trained on may name an older SDK. Check `package.json` in this repo first; if bootstrapping fresh, check the current Expo docs rather than assuming.

## 3. Monorepo layout

```text
apps/
  member-mobile/
  admin-web/
packages/
  domain/        # pure TS: state machines, calculations, formatting. No I/O, no React.
  validation/    # zod schemas shared by both apps
  types/         # database.ts (generated) + shared DTOs
  ui/            # design tokens; platform-specific primitives live in the apps
  config/        # eslint, tsconfig bases, shared constants
supabase/
  migrations/
  functions/
    _shared/     # Deno-side mirror of domain + validation (D-012)
  seed/
  tests/         # pgTAP / RLS tests
docs/
scripts/
```

`turbo.json` pipelines: `build`, `typecheck`, `lint`, `test` — each with `dependsOn: ["^build"]` for the packages.

## 4. Dependency policy

Before adding any package, the agent must:

1. Check whether an existing dependency already solves it (`pnpm why <pkg>`).
2. Prefer an official `expo-*` or `@supabase/*` package.
3. Reject packages that are unmaintained (>12 months since release), have no types, or pull in a large transitive tree for a small job.
4. Never add a browser-only package to `member-mobile`, or a React Native package to `admin-web`.
5. Never add a second library that does the same job as an existing one (one date library, one form library, one query library).
6. Record non-obvious additions in the PR description with a one-line justification.

**Do not add:** Redux/MobX (TanStack Query + local state is enough), an ORM (migrations + generated types are the contract), moment.js, axios (use `fetch`), a UI kit for mobile, or any analytics/crash SDK in MVP.

## 5. Environment variables

### Client-safe (may appear in a bundle)

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_APP_ENV=local|staging|production
EXPO_PUBLIC_JOIN_BASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_ENV=
```

### Server-only (Edge Function secrets / Vercel encrypted / GitHub secrets)

```
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_URL=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
EXPO_ACCESS_TOKEN=            # push, CI builds
```

Rules:
- A server-only value must **never** appear after `EXPO_PUBLIC_` or `NEXT_PUBLIC_`.
- `.env.example` is committed with placeholder values; real `.env*` files are gitignored.
- CI runs a grep guard: fail the build if `SERVICE_ROLE` or `KEY_SECRET` appears in any built bundle (`docs/08` §4).
- `RAZORPAY_KEY_ID` is public and may be returned by an API response; `RAZORPAY_KEY_SECRET` never is.

## 6. Environments

| | Supabase | Razorpay | Push | Domain |
|---|---|---|---|---|
| local | local CLI stack (Docker) | test keys | disabled | `localhost` + tunnel for webhooks |
| staging | separate project | test keys | dev build | `staging.<domain>` |
| production | separate project | **live keys** | prod build | `<domain>` |

Never point local or staging at production Razorpay credentials or the production database. Webhook URLs are per-environment.

## 7. Platform gotchas (read before writing mobile code)

### Razorpay + Expo (D-009)

`react-native-razorpay` is a native module: it does **not** run in Expo Go, and it needs a config plugin plus a dev build. MVP therefore uses **Standard Checkout in a browser**:

```
app: create-payment-order → { checkoutUrl }
app: WebBrowser.openAuthSessionAsync(checkoutUrl, redirectUri)
web page (on admin domain): renders Razorpay Standard Checkout with orderId + keyId
on completion: redirects to gymapp://payment/return?paymentId=...
app: closes the browser, polls payment-status
```

The redirect result is informational only (D-010). Revisit the native SDK after the EAS build pipeline is running.

### Phone OTP

Supabase phone auth requires a configured SMS provider. In India, transactional SMS additionally requires **DLT registration** of the sender header and template with the operator. Budget days-to-weeks. Until it is live, use Supabase's test OTP configuration for local development — never ship that config.

### Push notifications

Expo push requires a dev/production build with FCM (Android) and APNs (iOS) credentials. Not available in Expo Go. Deferred to M6 (D-013).

### Camera

`expo-camera` needs `NSCameraUsageDescription` (iOS) and `CAMERA` permission (Android) declared in `app.config.ts`, and a dev build. Handle permission-denied with an explanatory screen and a manual gym-slug fallback.

### Deep links

Configure a scheme (`gymapp://`) plus universal/app links for `https://join.<domain>/j/<slug>`. Test both cold-start and warm-start; the QR must work whether or not the app is installed (fallback web page with store links).

### Deno vs Node

Edge Functions run on Deno: no `process.env` (use `Deno.env.get`), no Node built-ins by default, imports are URL/npm-specifier based, and **pnpm workspace packages are not resolvable**. Hence D-012.

### AsyncStorage & sessions

Supabase JS needs an explicit storage adapter on RN:

```ts
createClient(url, anonKey, {
  auth: { storage: AsyncStorage, autoRefreshToken: true,
          persistSession: true, detectSessionInUrl: false },
});
```

`detectSessionInUrl: false` is required on native or the client throws on startup.

## 8. Coding conventions

- TypeScript **strict**, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` on.
- No `any`. If unavoidable, `// eslint-disable-next-line` with a one-line reason.
- Validate every external input (API body, webhook, deep-link param, storage metadata) with Zod at the boundary; inside the boundary, trust the type.
- Business rules live in `packages/domain`, not in components or route handlers.
- Money: integer paise everywhere; a single `formatPaise(n)` helper for display.
- Dates: UTC in state, formatted only at render with the gym timezone.
- IDs: UUID, except provider IDs which keep their native string form.
- No magic strings for statuses — import the union type from `packages/domain`.
- File naming per `CLAUDE.md` §6.
