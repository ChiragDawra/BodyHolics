# 08 — Deployment & Operations

## 1. Environments

| | Supabase project | Razorpay | Webhook URL | Admin URL | Mobile |
|---|---|---|---|---|---|
| local | CLI stack (Docker) | test keys | tunnel (`ngrok`/`cloudflared`) | `localhost:3000` | Expo dev client |
| staging | `gym-staging` | test keys | `https://staging.<domain>/api/...` or the staging Supabase function URL | `staging.<domain>` | EAS `preview` channel |
| production | `gym-prod` | **live keys** | production function URL | `<domain>` | EAS `production` channel |

Never share a project, a key, or a webhook between environments. A staging webhook hitting production data is the classic way to activate a membership nobody paid for.

## 2. First-time local setup

```bash
git clone <repo> && cd <repo>
pnpm install
cp .env.example .env.local                      # fill in local values
supabase start                                   # prints local URL + anon key
supabase db reset                                # migrations + seed
supabase gen types typescript --local > packages/types/src/database.ts
supabase functions serve --env-file supabase/.env.local
pnpm dev
```

Verify the stack is healthy:
- `supabase status` shows all services up
- the seed created 1 gym, 3 plans, 5 members (`select count(*) from gym_members;`)
- `curl localhost:54321/functions/v1/gym-by-slug?slug=urban-gym` returns the gym

### Local webhook testing

```bash
cloudflared tunnel --url http://localhost:54321
# register the printed URL + /functions/v1/razorpay-webhook in the Razorpay test dashboard
```

Test the signature path with a crafted request before trusting the real provider:

```bash
BODY='{"event":"payment.captured","payload":{...}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$RAZORPAY_WEBHOOK_SECRET" -hex | cut -d' ' -f2)
curl -X POST localhost:54321/functions/v1/razorpay-webhook \
  -H "X-Razorpay-Signature: $SIG" -H 'Content-Type: application/json' -d "$BODY"
```

Then send the same body with a wrong signature and confirm you get 401.

## 3. Migration workflow

```bash
supabase migration new add_crowd_thresholds
# edit the generated SQL
supabase db reset            # verify it applies from scratch
pnpm test:db                 # RLS/pgTAP suite
supabase gen types typescript --local > packages/types/src/database.ts
```

Deployment order, every time:

1. Merge to `main` → CI applies to **staging** (`supabase db push --linked`).
2. Verify on staging: RLS suite green, smoke test the affected flow.
3. Tag a release → apply to **production** with a manual approval gate.
4. Run production smoke tests (§9).

Rules:
- Never edit a migration that has been applied anywhere beyond local.
- Never run ad-hoc SQL against production. If you must, write it as a migration first.
- Destructive changes take two releases: (a) stop writing the column, ship; (b) drop it, ship.
- Take a manual backup snapshot immediately before any production migration that alters existing data.

## 4. CI (GitHub Actions)

`ci.yml` on every PR:

```yaml
jobs:
  check:
    steps:
      - pnpm install --frozen-lockfile
      - pnpm typecheck
      - pnpm lint
      - pnpm test                       # unit
      - pnpm test:shared-parity         # D-012: domain vs functions/_shared
      - supabase start && supabase db reset
      - pnpm test:db                    # pgTAP / RLS
      - pnpm test:integration           # edge functions against local stack
      - pnpm --filter admin-web build
      - npx expo-doctor                 # mobile config sanity
      - ./scripts/check-no-secrets.sh   # grep built artifacts for service keys
      - pnpm audit --audit-level high
```

`scripts/check-no-secrets.sh` must fail if `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, or `RAZORPAY_WEBHOOK_SECRET` appears in `apps/admin-web/.next` or the Expo bundle output.

Branch protection on `main`: all checks required, no direct pushes.

## 5. Deploying

**Admin (Vercel):** auto-deploy previews on PR, production on tag. Env vars set per-environment in Vercel, encrypted. Set the security headers from `docs/04` §15 in `next.config.js`.

**Edge Functions:**

```bash
supabase functions deploy --project-ref <ref>
supabase secrets set --project-ref <ref> --env-file supabase/.env.production
```

Deploy functions **before** the client that calls them, and keep them backward-compatible for one release so an old app version doesn't break.

**Mobile (EAS):**

```bash
eas build --profile preview    --platform all    # staging
eas build --profile production --platform all
eas submit --platform ios|android
```

- `production` profile points at the production Supabase URL and anon key.
- Bump `version` and `ios.buildNumber` / `android.versionCode` every build.
- OTA updates (`eas update`) may ship JS-only fixes on the same runtime version. **Never** OTA a change that requires a migration.
- Never ship a dev client as a production build.

## 6. Webhook configuration

| | |
|---|---|
| URL | `https://<project>.supabase.co/functions/v1/razorpay-webhook` |
| Events | `payment.authorized`, `payment.captured`, `payment.failed`, `refund.processed` |
| Secret | `RAZORPAY_WEBHOOK_SECRET`, per environment |
| Auth | `verify_jwt = false` in `supabase/config.toml` for this function only |

The function must return 200 within a few seconds; Razorpay retries on non-2xx. Unhandled event types return 200, not 400.

> `verify_jwt = false` on `razorpay-webhook` is deliberate and is the **only** function allowed to have it. The HMAC is its authentication. Double-check this setting on every deploy.

## 7. Payment reconciliation job

Webhooks are not guaranteed. Run hourly:

1. Find `payments` with `status='PENDING'`, `method='ONLINE'`, `created_at < now() - 30 min`, `provider_order_id is not null`.
2. Query Razorpay for that order's payments.
3. If captured → run the same transition path as the webhook (idempotent).
4. If failed → mark `FAILED`.
5. If still pending after 24h → `CANCELLED` + cancel the pending membership.
6. Log every correction to `audit_logs` with `action = 'PAYMENT_RECONCILED'` — a rising count here means the webhook is unhealthy.

## 8. Backups & recovery

- Enable Supabase automated backups; PITR on production if the plan allows.
- Monthly manual export as a second copy: `supabase db dump -f backup-$(date +%F).sql`.
- Storage buckets are **not** covered by a DB backup — script a periodic object sync.

**Documented recovery runbook** (rehearse quarterly on staging, timed):
1. Restore the database to a point in time.
2. Restore storage objects.
3. Re-apply function secrets.
4. Re-register the Razorpay webhook URL if the project ref changed.
5. Verify owner login, member login, and a test payment.
6. Reconcile payments taken during the outage window (§7).

An untested backup is not a backup.

## 9. Smoke tests after every production deploy

- [ ] Owner can log in
- [ ] Member list loads and search works
- [ ] `gym-by-slug` returns the gym for the production QR
- [ ] A test member can request and verify an OTP
- [ ] `create-payment-order` returns an order (use a ₹1 test plan, deactivated afterwards)
- [ ] The webhook endpoint responds 401 to an unsigned request
- [ ] Current gym status matches reality
- [ ] Publishing a broadcast to a test audience delivers

## 10. Observability

**Product metrics** (SQL over your own data, no third-party SDK): registrations/day · active memberships · renewal rate · online payment success rate · counter vs online split · broadcast read rate · median issue resolution time · daily attendance events.

**Technical metrics:** Edge Function error rate and p95 latency · webhook failure count · `PAYMENT_RECONCILED` count · auth failure rate · slow queries (`pg_stat_statements`) · mobile crash rate · push delivery failures.

**Alert on:** any webhook signature failure · any amount mismatch · payment success rate below 90% over an hour · more than 5 reconciliations in an hour · any 5xx spike · a `PENDING` payment older than 6 hours · failed cron jobs.

**Log format** (structured JSON, one line per request):

```json
{"requestId":"...","fn":"confirm-counter-payment","userId":"...","gymId":"...",
 "outcome":"OK","code":null,"latencyMs":142}
```

Never log: OTPs · tokens · raw QR tokens · passwords · webhook secrets · full phone numbers · request bodies containing PII.

## 11. Release checklist

**Backend**
- [ ] migrations applied to staging then production
- [ ] every `public` table has `rowsecurity = true`
- [ ] every `public` view has `security_invoker = true`
- [ ] function secrets set for the target environment
- [ ] webhook registered, signature verification tested with a bad signature
- [ ] cron jobs scheduled and observed to run once
- [ ] backup taken immediately before the migration

**Admin**
- [ ] owner login (+ MFA if enabled) · member search · counter payment scan · plan management · hours + override · broadcast publish · issue reply

**Member**
- [ ] QR onboarding · OTP · membership display · online checkout · counter QR · alerts · attendance · issue reporting

**Cross-system**
- [ ] online payment activates the membership
- [ ] counter payment activates the membership
- [ ] a gym closure reaches the member app within 60s
- [ ] a broadcast reaches exactly the intended audience (verify `recipient_count`)
- [ ] an issue reply notifies the member
- [ ] a membership past `end_at` becomes `EXPIRED` on the next cron tick

## 12. Rollout plan

1. **Internal** — you + owner, seeded data, staging.
2. **Owner pilot** — production, owner uses the admin daily for a week; no members yet.
3. **5–10 member pilot** — hand-picked regulars, both payment paths exercised, daily check-in with the owner.
4. **Full rollout** — QR printed and displayed at the counter; keep the old register/spreadsheet running in parallel for 30 days.
5. **Cutover** — retire the old process only after a full month with zero payment discrepancies.

Have a rollback plan for each: for mobile, the previous EAS build; for admin, a Vercel instant rollback; for the database, forward-fix (never restore a backup over live payment data without reconciling).

## 13. Future: fingerprint attendance

Do not couple to a vendor. Define the adapter once:

```ts
// packages/domain/src/attendance/source.ts
export type NormalizedAttendanceEvent = {
  gymId: string;
  userId: string | null;
  sourceType: 'MANUAL' | 'QR' | 'DEVICE_ACTIVITY' | 'FINGERPRINT';
  eventType: 'CHECK_IN' | 'CHECK_OUT' | 'PRESENCE_START' | 'PRESENCE_END';
  occurredAt: string;
  sourceReference?: string;
  metadata?: Record<string, unknown>;
};

export interface AttendanceSource {
  readonly id: string;
  ingest(events: NormalizedAttendanceEvent[]): Promise<{ accepted: number; rejected: number }>;
  health(): Promise<{ ok: boolean; lastEventAt: string | null; detail?: string }>;
}
```

Integration is then: a service-key-authenticated ingest endpoint + a vendor-specific mapper. `attendance_events`, occupancy, crowd bucketing, and every UI stay unchanged. A device mapping table (`device_id → gym_id`, `vendor_user_id → user_id`) is the only new schema.

Before buying hardware, confirm: does it push (webhook/MQTT) or must it be polled? does it expose a stable per-user identifier? does it work offline and backfill? Answer these before writing any code.
