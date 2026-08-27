# Credentials — what I need, and how to give it to me safely

Read the two rules first. They matter more than the list.

---

## Rule 1 — There are two kinds of value here, and they are handled differently

| Kind | Examples | Safe to paste in chat? |
|---|---|---|
| **Publishable** | Supabase project URL, `anon` key, Razorpay `key_id` | **Yes.** These ship inside the app bundle. Anyone who installs the app already has them. They are useless without a valid session because RLS decides everything. |
| **Secret** | `service_role` key, Razorpay `key_secret`, Razorpay webhook secret, Twilio auth token | **No. Never.** Paste these into a dashboard or a local file yourself, using the commands below. |

Why the second row is absolute: a chat transcript is stored, and a
`service_role` key bypasses every RLS policy in the database — it can read every
member's phone number and rewrite every payment. If one is ever pasted anywhere
it should not be, **rotate it immediately** rather than hoping.

I never need to see a secret. I need to know it *exists* and is *set*. Every
step below is written so you set it and tell me "done".

## Rule 2 — Nothing secret goes in git

`.env.local` and `supabase/.env.production` are already gitignored, and CI runs
a scanner that decodes every JWT in the committed tree *and* in the built app
bundles and fails on any key with a privileged role. That check is tested. But
it protects the repo, not your laptop — so use the commands, don't improvise.

---

# 1. Supabase (hosted project) — **start here, everything depends on it**

Right now everything runs against a local Docker stack. A hosted project is
needed before anything can be deployed or tested by a real person on a phone.

### Steps

1. Go to <https://supabase.com/dashboard> → **New project**
2. Organisation: whatever you use. **Region: `ap-south-1` (Mumbai)** — the gym
   and its members are in India, and this is the difference between a snappy app
   and a sluggish one.
3. Name it `urban-gym-prod` (or the real gym name).
4. **Database password** — generate a long random one, save it to a password
   manager. You will need it roughly never, and losing it is a real problem.
5. Plan: Free works to start. **Pro (₹2,000/mo approx) is required** before
   launch for daily backups and for MFA on the owner account — `docs/04` §4 says
   enable TOTP for the owner before production, and that is a Pro feature.

### What to send me

From **Project Settings → API**:

```
Project URL      https://xxxxxxxxxxxx.supabase.co     ← paste in chat, fine
anon public key  eyJhbGciOi...                        ← paste in chat, fine
```

### What to set yourself, and never send

From the same page, copy the **`service_role`** key, then run **in your terminal
from the repo root**:

```bash
# Links this repo to the hosted project (asks for the DB password once).
pnpm exec supabase login
pnpm exec supabase link --project-ref <the ref from your project URL>
```

Then paste the service_role key into `supabase/.env.production` — create it, it
is gitignored:

```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<paste it here, in the file, not in chat>
```

**Tell me: "Supabase linked, service key set."** That is all I need.

---

# 2. SMS / OTP — **the biggest lead time. Start today.**

This is what blocks members from signing in at all. In India it is not just an
API key: sending SMS to Indian numbers legally requires **DLT registration**
(TRAI regulation), which involves your gym's business documents and takes
**3–10 working days** for approval. Nothing about that is a coding problem, and
no amount of code makes it faster.

### Which provider

Supabase Auth natively supports: `twilio`, `twilio_verify`, `messagebird`,
`textlocal`, `vonage`.

**I recommend Twilio.** Not because it is cheapest — it is not — but because it
is natively supported, so OTP delivery stays entirely inside Supabase Auth and
we never write code that handles an OTP. `docs/04` §3 is explicit: *never write
a custom OTP generator and never store OTPs in your own tables.* Choosing a
provider Supabase does not support means building a hook, and that hook would be
handling one-time codes.

MSG91 is the popular Indian choice and roughly 3× cheaper per message, but
Supabase has no native MSG91 driver — it needs a Send SMS Hook. At a single
gym's volume the saving is a few hundred rupees a month. Say the word if you
want MSG91 and I will build the hook, but Twilio is the lower-risk default.

### Steps (Twilio)

1. <https://www.twilio.com/try-twilio> → sign up, verify your own number.
2. **Start the India DLT registration immediately** — this is the long pole:
   → Console → **Messaging → Regulatory Compliance → India DLT**
   You will need:
   - Business PAN / GST of the gym
   - Entity registration on a DLT portal (Jio/Airtel/VI — any one; it
     propagates)
   - A registered **Header** (sender ID, 6 characters, e.g. `URBGYM`)
   - A registered **Template** whose text must match what we send *exactly*:
     ```
     Your code is {#var#}
     ```
     That is the template already configured in `supabase/config.toml`. If DLT
     approves different wording, send me the exact approved string and I will
     change the config to match — a mismatch means every message is silently
     rejected by the carrier.
3. Buy an Indian sender / messaging service once DLT clears.
4. Create a **Messaging Service** → note its SID.

### What to send me

```
Account SID           ACxxxxxxxxxxxxxxxxxxxxx    ← fine in chat
Messaging Service SID MGxxxxxxxxxxxxxxxxxxxxx    ← fine in chat
Approved template text (exact wording)           ← fine in chat
```

### What to set yourself

The **Auth Token** is a secret. In the Supabase dashboard:

**Authentication → Providers → Phone** → enable → select Twilio → paste Account
SID, Messaging Service SID, and Auth Token there. It stays in Supabase, never in
our repo.

**Tell me: "Twilio configured in Supabase, DLT approved, template is `<exact text>`."**

> Until DLT clears, member sign-in cannot be tested with a real phone. The local
> stack has test numbers configured so the rest of the app remains testable —
> that is a development shortcut and does not exist in production.

---

# 3. Razorpay — blocks online payment

Counter payments (cash/UPI at the desk) already work end to end and are tested.
This is only for paying inside the app.

### Steps

1. <https://dashboard.razorpay.com/signup>
2. Complete **KYC** — business PAN, bank account, address proof. Test keys work
   immediately; **live keys need KYC approval, typically 2–4 working days.**
3. **Settings → API Keys → Generate Test Key** (do this now, don't wait for KYC)
4. **Settings → Webhooks → Add New Webhook**
   - URL: `https://<your-project-ref>.supabase.co/functions/v1/razorpay-webhook`
   - Secret: **generate a long random string yourself** and paste it into both
     Razorpay and our config (below). This is what proves an incoming webhook is
     really from Razorpay.
   - Active events — tick exactly these four:
     - `payment.authorized`
     - `payment.captured`
     - `payment.failed`
     - `refund.processed`

### What to send me

```
Key ID   rzp_test_xxxxxxxx   ← fine in chat (it is the publishable half)
```

### What to set yourself

Add to `supabase/.env.production`:

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_KEY_SECRET=<from the dashboard — never in chat>
RAZORPAY_WEBHOOK_SECRET=<the random string you set in the webhook — never in chat>
```

Then push them to the hosted project:

```bash
pnpm exec supabase secrets set --env-file supabase/.env.production
```

**Tell me: "Razorpay test keys set, webhook configured."**

> When live keys arrive, repeat with `rzp_live_...` and **regenerate the webhook
> secret** — do not reuse the test one.

---

# 4. Vercel — hosting the admin console

### Steps

1. <https://vercel.com/signup> → sign in with the GitHub account that owns
   `ChiragDawra/BodyHolics`
2. **Add New → Project** → import the repo
3. **Root Directory: `apps/admin-web`**
4. Framework preset: Next.js (auto-detected)
5. **Environment Variables** — add these three, for all environments:
   ```
   NEXT_PUBLIC_SUPABASE_URL       https://xxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY  eyJhbGciOi...
   NEXT_PUBLIC_APP_ENV            production
   ```

Note what is **not** in that list: no `service_role` key, no Razorpay secret.
The admin app is a browser app — anything you put in it ships to the browser.
If you ever find yourself adding a `SUPABASE_SERVICE_ROLE_KEY` here, stop; that
would be the single worst possible mistake in this project.

**Tell me: "Vercel connected"** plus the deployed URL, so I can add it to
`ALLOWED_ORIGINS` for CORS.

---

# 5. Expo / EAS — building the mobile app

Needed to put the app on an actual phone. Not needed for anything else.

### Steps

1. <https://expo.dev/signup>
2. `pnpm exec eas login` in the repo, then `pnpm exec eas init`
3. For the **App Store**: an Apple Developer account (**$99/year**) — enrolment
   itself can take a few days.
4. For **Google Play**: a Play Console account (**$25 one-time**).

### What to send me

```
Expo account/org name   ← fine in chat
```

**Tell me which stores you actually want.** If this is going to a single gym's
members, an Android-only release plus TestFlight for iOS may be enough to start
and skips a chunk of cost and review time.

---

# 6. Push notifications — later, optional

`docs/00` D-013 makes push explicitly optional for launch: alerts are written to
the database and shown in the app regardless, and push is a best-effort delivery
layer on top. Not a blocker.

When you want it: Firebase project → `google-services.json` (Android), and an
APNs key from the Apple Developer account (iOS). Ask me then.

---

# Order to do these in

| # | Item | Why this order | Lead time |
|---|---|---|---|
| 1 | **Twilio + DLT** | Longest wait by far. Start it today even if nothing else moves | **3–10 days** |
| 2 | **Razorpay KYC** | Second longest. Test keys work while you wait | 2–4 days |
| 3 | **Supabase project** | Unblocks deploying anything at all | 10 minutes |
| 4 | **Vercel** | Needs the Supabase URL from step 3 | 15 minutes |
| 5 | **Expo/EAS** | Only needed when you want the app on a real phone | 30 min + store enrolment |
| 6 | Push | After launch | — |

The two registrations at the top are the real schedule. Everything else is an
afternoon.

---

# Summary — what to paste in chat vs. never

**Paste in chat, all safe:**

```
Supabase project URL
Supabase anon key
Twilio Account SID
Twilio Messaging Service SID
DLT-approved template text (exact)
Razorpay Key ID
Vercel deployment URL
Expo account name
```

**Never paste anywhere but a dashboard or a gitignored file:**

```
Supabase service_role key
Supabase database password
Twilio Auth Token
Razorpay Key Secret
Razorpay Webhook Secret
Apple / Google signing credentials
```

If one of the second group ends up somewhere it shouldn't — a screenshot, a
message, a commit — say so and rotate it. Rotating takes five minutes. Not
rotating is how a gym's member list ends up somewhere it should not be.
