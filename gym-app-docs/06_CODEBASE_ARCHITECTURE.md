# 06 — Codebase Architecture

## 1. Repository layout

```text
repo/
├── CLAUDE.md
├── docs/                        # these files
├── apps/
│   ├── member-mobile/
│   │   ├── app/                        # Expo Router — routes only, thin
│   │   │   ├── _layout.tsx             # providers: Query, Auth, Theme
│   │   │   ├── (auth)/
│   │   │   │   ├── scan.tsx
│   │   │   │   ├── phone.tsx
│   │   │   │   └── otp.tsx
│   │   │   ├── (onboarding)/
│   │   │   │   ├── profile.tsx
│   │   │   │   ├── plans.tsx
│   │   │   │   └── payment-method.tsx
│   │   │   ├── (tabs)/
│   │   │   │   ├── _layout.tsx         # EXACTLY 3 tabs
│   │   │   │   ├── index.tsx           # Home
│   │   │   │   ├── activity.tsx
│   │   │   │   └── me.tsx
│   │   │   ├── alerts/index.tsx
│   │   │   ├── membership/[id].tsx
│   │   │   ├── payments/
│   │   │   │   ├── checkout.tsx
│   │   │   │   ├── counter-qr.tsx
│   │   │   │   └── return.tsx          # deep-link target after checkout
│   │   │   └── issues/{index,new,[id]}.tsx
│   │   ├── src/
│   │   │   ├── features/               # ← most code lives here
│   │   │   ├── components/             # cross-feature primitives
│   │   │   ├── lib/                    # supabase client, storage, notifications
│   │   │   ├── providers/
│   │   │   └── theme/
│   │   ├── assets/
│   │   └── app.config.ts
│   └── admin-web/
│       ├── app/
│       │   ├── (auth)/login/page.tsx
│       │   └── (dashboard)/
│       │       ├── layout.tsx
│       │       ├── page.tsx            # KPIs + attention queue
│       │       ├── members/{page.tsx,[id]/page.tsx}
│       │       ├── payments/page.tsx
│       │       ├── plans/page.tsx
│       │       ├── attendance/page.tsx
│       │       ├── broadcasts/{page.tsx,new/page.tsx}
│       │       ├── issues/{page.tsx,[id]/page.tsx}
│       │       └── settings/{hours,staff,audit}/page.tsx
│       ├── src/{features,components,lib,hooks}/
│       └── middleware.ts               # session refresh + route guard
├── packages/
│   ├── domain/                         # pure logic, zero I/O
│   ├── validation/                     # zod schemas
│   ├── types/                          # database.ts (GENERATED) + DTOs
│   ├── ui/                             # tokens + shared pure components
│   └── config/                         # tsconfig/eslint bases
├── supabase/
│   ├── migrations/
│   ├── functions/
│   │   ├── _shared/                    # Deno mirror (D-012)
│   │   │   ├── auth.ts                 # requireUser, requireStaff, requireMember
│   │   │   ├── response.ts             # ok(), fail(), envelope
│   │   │   ├── errors.ts               # ErrorCode registry
│   │   │   ├── ratelimit.ts
│   │   │   ├── schemas/
│   │   │   └── state/                  # mirrored state machines
│   │   ├── gym-by-slug/
│   │   ├── create-member-profile/
│   │   ├── create-payment-order/
│   │   ├── payment-status/
│   │   ├── razorpay-webhook/
│   │   ├── confirm-counter-payment/
│   │   ├── create-member-qr-token/
│   │   ├── current-gym-status/
│   │   ├── override-gym-status/
│   │   ├── publish-broadcast/
│   │   ├── create-issue/
│   │   ├── reply-to-issue/
│   │   ├── update-issue-status/
│   │   ├── attendance-event/
│   │   └── current-crowd/
│   ├── seed/seed.sql
│   └── tests/                          # pgTAP RLS tests
├── scripts/
├── .github/workflows/
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## 2. Feature module shape

Every feature folder in either app has the same five files. **Do not invent per-feature structures.**

```text
src/features/membership/
├── api.ts          # data access. The ONLY place a supabase call may appear.
├── hooks.ts        # TanStack Query wrappers around api.ts
├── schemas.ts      # zod (re-export from packages/validation where shared)
├── types.ts        # feature-local types
└── components/     # presentational; props in, JSX out
```

Feature list (mobile): `auth`, `onboarding`, `membership`, `payments`, `attendance`, `crowd`, `gym-status`, `alerts`, `issues`, `profile`.

Feature list (admin): `auth`, `dashboard`, `members`, `plans`, `payments`, `hours`, `broadcasts`, `issues`, `attendance`, `staff`, `audit`.

### Example — `api.ts`

```ts
import { supabase } from '@/lib/supabase';
import type { Membership } from '@gym/domain';

export async function fetchCurrentMembership(gymId: string): Promise<Membership | null> {
  const { data, error } = await supabase
    .from('v_current_memberships')
    .select('id, plan_id, status, start_at, end_at, days_remaining, is_expiring')
    .eq('gym_id', gymId)
    .order('end_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data ? toMembership(data) : null;
}
```

Note: no `user_id` filter — RLS already scopes it. Adding a redundant filter is fine, but **never** rely on the filter instead of RLS.

### Example — `hooks.ts`

```ts
export function useCurrentMembership(gymId: string) {
  return useQuery({
    queryKey: ['membership', 'current', gymId],
    queryFn: () => fetchCurrentMembership(gymId),
    staleTime: 60_000,
  });
}
```

### Query key conventions

`[domain, scope, ...params]` — e.g. `['membership','current',gymId]`, `['payments','list',gymId,filters]`, `['issues','detail',issueId]`. After a mutation, invalidate the narrowest key that covers the change.

## 3. Layering rules (enforce with `eslint-plugin-boundaries`)

| Layer | May import | May **not** import |
|---|---|---|
| `app/` route files | features, components, providers | `@supabase/supabase-js` |
| `features/*/components` | `packages/ui`, feature types | `api.ts`, supabase |
| `features/*/hooks` | `api.ts`, `packages/domain` | supabase directly |
| `features/*/api` | `lib/supabase`, `packages/domain`, `packages/validation` | React, hooks |
| `packages/domain` | `zod`, `date-fns` | React, supabase, anything with I/O |
| `packages/ui` | react, tokens | any app feature, supabase |
| `supabase/functions/*` | `_shared/`, Deno std, npm specifiers | `packages/*` |

Add a CI lint rule for each of these. A rule that is documented but unenforced will be broken within two weeks.

## 4. `packages/domain` — what belongs here

```text
domain/src/
├── state/            # canTransition() per machine (docs/09)
├── membership.ts     # daysRemaining, isExpiring, computePeriod
├── gym-status.ts     # pure resolution given hours + override + now
├── crowd.ts          # bucketing given occupancy + thresholds
├── money.ts          # formatPaise, parseRupees
├── time.ts           # gym-local date helpers
├── errors.ts         # ErrorCode union + message map
└── types.ts          # Membership, Payment, Issue, Broadcast DTOs
```

Every function here is **pure** and has a unit test. This is where correctness is cheapest to verify.

## 5. Supabase client factories

```text
lib/supabase.ts (mobile)      → createMobileClient()   anon key + AsyncStorage
lib/supabase/client.ts (web)  → createBrowserClient()  anon key
lib/supabase/server.ts (web)  → createServerClient()   anon key + cookies (RSC/route handlers)
functions/_shared/db.ts       → createAdminClient()    SERVICE KEY — Deno only
```

`createAdminClient` exists **only** under `supabase/functions/`. Add an ESLint rule banning the identifier anywhere in `apps/`.

## 6. Edge Function template

Every function follows this exact shape:

```ts
// supabase/functions/<name>/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';
import { ok, fail, withRequestId } from '../_shared/response.ts';
import { requireStaff } from '../_shared/auth.ts';
import { rateLimit } from '../_shared/ratelimit.ts';
import { requestSchema } from './schema.ts';

serve(withRequestId(async (req, ctx) => {
  if (req.method !== 'POST') return fail('NOT_FOUND', ctx);

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION_FAILED', ctx, parsed.error.flatten().fieldErrors);

  const auth = await requireStaff(req);              // resolves gymId server-side
  if (!auth.ok) return fail(auth.code, ctx);

  const limited = await rateLimit(`fn:${auth.userId}`, 20, '1h');
  if (limited) return fail('RATE_LIMITED', ctx);

  try {
    const result = await doWork(auth, parsed.data);  // db + audit inside a transaction
    return ok(result, ctx);
  } catch (e) {
    return fail(mapError(e), ctx);                   // never leak e.message
  }
}));
```

Order is fixed: **method → validate → authenticate/authorize → rate limit → work → envelope.**

## 7. State management

- **Server state:** TanStack Query only. `staleTime` per resource: gym status 60s, membership 5 min, plans 30 min, notifications 30s (plus Realtime), payments 0 while a payment is pending.
- **Local state:** `useState`/`useReducer` for modals, forms, toggles.
- **Global ephemeral:** one small context for onboarding progress and one for the resolved `gymId` + theme. Nothing else.
- **Never** mirror database rows into a global store. There is one source of truth and it is the server.

## 8. Error handling

```ts
// packages/domain/src/errors.ts
export const ERROR_MESSAGES: Record<ErrorCode, string> = { /* docs/07 §2 table */ };
export function messageFor(code: ErrorCode) { return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR; }
```

- `api.ts` normalizes every thrown thing into `AppError { code, message, requestId }`.
- Components render `error.message`; they never inspect `error.code` except for a handful of documented branches (e.g. `MEMBERSHIP_ALREADY_PENDING` → route to the pending payment).
- Never surface SQL text, stack traces, provider payloads, or UUIDs to a user.
- Show `requestId` in a small monospace line on fatal error screens so a member can quote it to support.

## 9. Testing

| Level | Tool | What |
|---|---|---|
| Unit | Vitest | Everything in `packages/domain`: expiry, status resolution, crowd buckets, transitions, money formatting, QR TTL |
| Component | RNTL / Testing Library | Loading/empty/error states, the three-tab layout, status badges |
| DB / RLS | pgTAP via `supabase test db` | Every row in the `docs/04` §18 checklist |
| Function integration | Vitest against a local stack | Each Edge Function: happy path, wrong role, cross-tenant, replay, validation failure |
| E2E | Playwright (admin) + Maestro/manual (mobile) | The seven critical paths below |

**Critical E2E paths:**

1. Register → pay online → membership ACTIVE
2. Register → pay at counter → staff scans → ACTIVE
3. Renew an ACTIVE membership → new period stacks correctly
4. Owner publishes a broadcast → member sees an alert
5. Owner overrides gym status → member Home reflects it
6. Member files an issue → staff replies → resolved → member notified
7. Membership crosses `end_at` → EXPIRED → renew CTA appears

Coverage target: **100% of `packages/domain`**, everything else pragmatic.

## 10. Rules for the coding agent

**Must:**
- Read `docs/00_DECISIONS.md` before the first change in a session.
- Put data access in `api.ts`, logic in `packages/domain`, and nothing else in components.
- Add a unit test with every new domain function and every state transition.
- Add an RLS test with every new table.
- Regenerate `packages/types/src/database.ts` after every migration.
- Use an existing error code, or add one to `docs/07` §2 in the same PR.
- Write an `audit_logs` row for every privileged write.
- Update `docs/00_DECISIONS.md` when a decision changes, with a new D-id.

**Must not:**
- Add a fourth bottom tab, or move Alerts into the tab bar.
- Add an "Add member" flow to admin.
- Call `createAdminClient` outside `supabase/functions/`.
- Write `update ... set status = ...` without going through the state machine.
- Accept an amount, price, phone, `gym_id`, or role from a request body.
- Create a table, index, or policy outside `supabase/migrations/`.
- Hand-edit generated types.
- Add a dependency that duplicates an existing one.
- Leave a `TODO: add RLS`. If the policy is unknown, leave the table with RLS on and no policy (deny-all) and ask.
- Guess on anything listed in `docs/11_OPEN_QUESTIONS.md`.
