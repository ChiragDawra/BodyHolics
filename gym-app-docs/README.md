# Urban Gym App — Engineering Documentation

Authoritative specs for the gym member app + admin dashboard. Written to be read by a coding agent.

## How to use these

1. **`CLAUDE.md` goes at the repo root**, not in `docs/`. Claude Code loads it automatically at the start of every session — it is the entry point that routes to everything else.
2. Everything else goes in `docs/`.
3. `00_DECISIONS.md` is the tie-breaker. If two docs disagree, that one wins and the other is a bug.
4. `11_OPEN_QUESTIONS.md` is the "do not guess" list. Answer a question → promote it to a `D-xxx` decision → delete the entry.

```
repo/
├── CLAUDE.md          ← root
└── docs/
    ├── 00_DECISIONS.md
    ├── 01_REQUIREMENTS.md
    ├── ...
    └── 11_OPEN_QUESTIONS.md
```

## Index

| Doc | Contents | Read when |
|---|---|---|
| `CLAUDE.md` | Agent operating manual: hard rules, commands, naming, gotchas | Every session, first |
| `00_DECISIONS.md` | Glossary + D-001…D-014 resolving every ambiguity | Every session, second |
| `01_REQUIREMENTS.md` | Scope, roles, per-screen acceptance criteria, prerequisites | Planning a feature |
| `02_SYSTEM_DESIGN.md` | Architecture, sequences, failure modes, idempotency policy | Changing how systems talk |
| `03_TECH_STACK.md` | Choices, version pinning, env vars, platform gotchas | Adding a dependency |
| `04_SECURITY_AND_AUTH.md` | Threat model, auth, RLS rules, secrets, 16-item test suite | Touching auth, RLS, money |
| `05_DATABASE_DESIGN.md` | Full DDL, indexes, RLS policies, functions, cron, seed | Any schema work |
| `06_CODEBASE_ARCHITECTURE.md` | Layout, feature module shape, layering, function template, agent rules | Deciding where a file goes |
| `07_API_CONTRACT.md` | Every endpoint with TS types, error registry, rate limits | Writing an Edge Function or client call |
| `08_DEPLOYMENT_AND_OPERATIONS.md` | Envs, migrations, CI, webhooks, backups, observability, rollout | Shipping anything |
| `09_STATE_MACHINES.md` | Every status transition table | Any status change |
| `10_BUILD_PLAN.md` | M0–M7 milestones, ticket ids, dependency graph, DoD | Deciding what's next |
| `11_OPEN_QUESTIONS.md` | Q1–Q12 needing a human decision | When something is underspecified |

## The twelve rules, in one place

1. Never trust the client for authorization or money.
2. Prices come from the database.
3. The service key never leaves Edge Functions.
4. No schema change outside migrations.
5. RLS on every table; `security_invoker` on every view.
6. Money is integer paise.
7. UTC in the database, gym timezone at render.
8. Exactly three bottom tabs.
9. No admin "Add member" flow.
10. Users and memberships are separate entities.
11. Every privileged write is idempotent and audited.
12. Never invent a status value.

## Where to start

Q1 and Q2 in `11_OPEN_QUESTIONS.md` have real-world lead times measured in weeks. Start them before writing code. Then M0 → M1 in `10_BUILD_PLAN.md`.
