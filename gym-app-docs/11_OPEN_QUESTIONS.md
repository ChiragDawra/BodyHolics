# 11 — Open Questions

Things a coding agent **must not guess**. Each has a recommendation and a default that applies if you don't decide — but decide the blockers before the milestone that needs them.

When a question is answered: record it as a new `D-xxx` in `docs/00_DECISIONS.md`, update the affected doc, and delete the entry here.

---

## Q1 — SMS / OTP provider (BLOCKS M2)

Supabase phone auth needs an SMS provider you supply. In India, transactional SMS also requires **DLT registration** of the sender header and message template with the telecom operator — a multi-day-to-multi-week process, plus a per-SMS cost.

**Needs deciding:** which provider (MSG91 / Twilio / Gupshup / other), who owns the DLT registration, and what the per-SMS budget is at ~200 members × ~2 OTPs/month.

**Recommendation:** MSG91 — Indian, DLT-aware, cheaper for domestic traffic than Twilio. Start the DLT registration **today**, before writing auth code.

**Fallback to consider:** if SMS cost or DLT lead time is prohibitive, email OTP is supported natively and costs nothing, at the price of a worse gym-floor UX. WhatsApp OTP is a third option with its own approval process.

**Default if undecided:** development proceeds against Supabase's test OTP numbers, and M2 cannot ship.

---

## Q2 — Razorpay account & settlement (BLOCKS M3 production)

Live Razorpay keys need business KYC (PAN, bank account, GST if applicable) in the gym's name, and settlement lands in the gym's account, not yours.

**Needs deciding:** whose account, who completes KYC, and what happens to a member's money if a refund is needed.

**Recommendation:** the gym owner's account, with you as a team member. Never route real member payments through a personal account.

**Also decide:** MDR/transaction fee — absorbed by the gym or passed to the member? If passed on, the plan price and the charged amount differ and the schema needs a `fee_paise` column. Currently it assumes **absorbed by the gym**.

---

## Q3 — Crowd data source (BLOCKS M6)

D-008 resolved this to member-triggered presence ("I'm at the gym"), because passive device scanning is infeasible in Expo and a privacy liability. But member-triggered presence has a real weakness: **most members won't tap it**, so occupancy will under-report.

Options:

| Option | Accuracy | Cost | Effort |
|---|---|---|---|
| A. Member taps "I'm at the gym" (current default) | low | ₹0 | low |
| B. QR poster at the entrance that members scan on arrival | medium | printing | low |
| C. Staff enters a rough count 3–4× a day | medium | staff time | very low |
| D. Turnstile / fingerprint hardware | high | ₹15–50k+ | high, later |

**Recommendation:** ship **A + C** together — members who opt in provide signal, and the owner can pin a manual level when it's obviously wrong. Add B if members ignore A. D is the eventual answer and the schema is already ready for it.

**Also decide:** the thresholds. `{moderate: 10, crowded: 25, very_crowded: 40}` is a guess — what is actually busy for this gym's floor size? Ask the owner and set `gyms.crowd_thresholds`.

---

## Q4 — The walk-in without a smartphone

Registration is member-led by design, and admin has no "Add member" flow. Real gyms have members who won't or can't do this.

Options:
- **A.** Staff assist: use the member's phone, staff walks them through it (no code change). *Recommended.*
- **B.** Staff-initiated invite: staff enters a phone number, member gets a link, member still verifies OTP themselves. Preserves "no admin data entry for identity" while removing friction.
- **C.** Full admin-created member. Breaks the design; identity becomes unverified.

**Recommendation:** A for MVP, B in a later milestone if it actually blocks sign-ups. Never C.

---

## Q5 — Overnight gym hours

`gym_hours` currently supports same-day windows only (`closes_at > opens_at`). A 24-hour gym or one open 22:00→06:00 needs either two rows per day or a `crosses_midnight` flag.

**Question:** are this gym's hours ever crossing midnight? If no, the current constraint stands and is safer. **Default: no.**

---

## Q6 — `member_code` generation under concurrency

`next_member_code()` uses `count(*) + 1`, which can collide if two people register in the same instant. At one gym with a handful of daily sign-ups this is very unlikely, and the unique index catches it (the second insert fails and can retry).

**Question:** accept the retry-on-collision behaviour, or build a proper `counters` table now?

**Recommendation:** accept it for MVP; add a retry loop in `create-member-profile`. Revisit if you ever see a collision in the logs.

---

## Q7 — Refunds

Currently: refunds happen in the Razorpay dashboard, the webhook marks the payment `REFUNDED`, and an OWNER manually cancels the membership.

**Question:** does the owner need an in-app refund button? That means storing refund records, deciding partial vs full, deciding whether the membership is cancelled or pro-rated, and handling the money maths.

**Recommendation:** dashboard-only for MVP. Revisit after you see how often it actually happens. **Pro-rating is a surprising amount of complexity — don't build it speculatively.**

---

## Q8 — Membership pause / freeze

Common gym request ("I'm travelling for a month"). Not in the current model at all — it would mean either extending `end_at` (which D-004 forbids for paid periods) or a `membership_pauses` table with periods excluded from the duration calculation.

**Question:** does the owner offer this today? If yes, it is a real requirement and needs designing before M3, because it changes how `end_at` is computed.

**Default: not supported.** Say so explicitly in the plan terms.

---

## Q9 — Multiple simultaneous plans

Can a member hold, say, a gym membership and a separate personal-training package at the same time? The schema allows overlapping `ACTIVE` rows (D-004 stacks them), but the UI assumes exactly one "current membership."

**Question:** one plan at a time, or several concurrent products?

**Default: one at a time.** If several, `membership_plans` needs a `type` and the Home screen needs a different design.

---

## Q10 — Data retention & deletion

Both app stores require an account-deletion path. Deleting a `profiles` row cascades to memberships and payments, which destroys accounting records.

**Recommended policy:** on deletion request, null the personal fields (`full_name`, `phone`, `avatar_path`) and keep `payments` and `audit_logs` with an anonymized reference for the statutory retention period (typically 7 years for financial records in India — confirm with an accountant). Document this in the privacy policy.

**Needs confirming:** retention period, and who is the data controller (the gym, presumably — not you).

---

## Q11 — Who owns and operates this after launch

If you are building this for a gym rather than as a portfolio piece: who pays the Supabase/Vercel/SMS bills, who is on call when payments fail on a Sunday, and what happens if you stop maintaining it?

Not a technical question, but it determines whether you need a handover runbook, a support contact in the app, and a written scope agreement. **Decide before the owner starts depending on it for revenue.**

---

## Q12 — Portfolio vs production

If the primary goal is a portfolio project (cloud/DevOps roles), some of the above matters much less — DLT registration and Razorpay KYC are weeks of paperwork that demonstrate nothing technical.

A portfolio-optimized variant: keep the entire architecture, but stub the SMS provider and run Razorpay in test mode permanently, then spend that time on CI/CD, IaC, observability dashboards, and load testing — the things a cloud/DevOps interviewer actually asks about.

**Worth answering first**, because it changes the ordering of `docs/10_BUILD_PLAN.md` considerably.
