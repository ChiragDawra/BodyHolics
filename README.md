# BodyHolics

Gym management for one small independent gym in India.

One Next.js 16 app (App Router), TypeScript strict, Tailwind v4, Supabase.
Three route groups in the same app:

| Group      | Routes     | Shape                                 |
|------------|------------|---------------------------------------|
| `(public)` | `/`, `/join` | Landing and QR registration          |
| `(member)` | `/app/*`   | Member PWA, phone-first, installable  |
| `(check)`  | `/check/*` | Owner quick-check PWA, phone-first    |
| `(admin)`  | `/admin/*` | Full dashboard, desktop-first         |

## Setup

```bash
cp .env.example .env.local   # fill in the Supabase project URL and anon key
npm install
npm run dev
```

## House rules

- RLS on every table from the moment it is created. A table without a policy is a bug.
- Supabase is the source of truth. No `localStorage`/`sessionStorage` standing in for it.
- No `getUserMedia`, no camera API, anywhere. QR join goes through the phone's own camera app.
- Every colour, font, size, and radius comes from the `@theme` block in `app/globals.css`.
- Every user-facing string comes from `lib/strings.ts`.

See `Design-Pipelin.MD` for how the UI gets designed.
