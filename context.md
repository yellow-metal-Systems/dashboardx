# Context for whoever (or whatever agent) picks this up next

This is `dashboardx` — Yellow Metal's staff-facing lead management system (LeadDesk), split
out of a shared workspace into its own repo under the yellow-metal-Systems org (tech lead's
call: no monorepo). Its sibling is `server` — the Express backend that talks to
AarthikLabs/ONDC. They are two separate repos on purpose; keeping their API contract in sync
is a manual, deliberate process, not enforced by tooling.

## What this repo is

Next.js 14 (App Router), Prisma, PostgreSQL. Staff dashboard: view leads, see
details/activity/duplicate flags, change status, track partners, overview stats.

- Full API documentation (including the AarthikLabs contract details relevant to this side) is
  in `API_DOCUMENTATION.md`.
- Full history of what's changed and why is in `changelog.md`.
- Remaining known gaps/preferences are in `todo.md` (unchanged from before the org split).

## Read before touching scripts/sync-ondc-leads.ts

This script pulls leads from `server`'s `/api/internal/leads` into this DB. It was rewritten
2026-09-25 after discovering it read fields that don't exist on the real backend response at
all (`distributor_ref_id`, `borrower_name`, `address`, `dob`, `ltv_pct`, `duplicate_flag` —
none of these are real backend fields). Two things to know before touching it again:

1. It keys the upsert on the backend's own lead id (`YMLEAD########`) -> `distributorRefId`,
   not a `distributor_ref_id` field — the backend has no such field.
2. It only overwrites local `status` on a re-run when the backend reports a terminal outcome
   (`DISBURSED`/`EXPIRED`) — a real bug a code review caught: unconditionally overwriting
   status was silently reverting staff-set `Contacted` leads (and locally-auto-`Rejected`
   timeout leads) back to `New` on every sync, since the backend only ever reports
   `LEAD_CREATED`/`DISBURSED`/`EXPIRED`. If you're touching this function, don't remove that
   guard without understanding why it's there.

## Open questions / blockers

See `server`'s `QUESTIONS.md` — the open items (status vocabulary beyond
`LEAD_CREATED`/`DISBURSED`, Flow-4 payload shape) are properties of the AarthikLabs contract,
tracked there, not duplicated here.

## Decisions already made — don't silently redo these

- **LTV rate selection**: the branch manager picks 68% (Bullet) vs 75% (Monthly) manually,
  based on the real gold assessed in person — confirmed by Atharva, 2026-09-25. This is why
  `server`'s dashboard-insights response shows both figures instead of guessing one.
- **7-working-day lead timeout** (`New`/`Contacted` -> `Rejected`) is real, tested, with a
  `LeadActivity` audit row (`actor: system:lead-timeout`). See `changelog.md`.
- **No monorepo.** `server` is a separate repo — don't merge them back together.
- **This repo's own `frontend/` twin inside the old `yellow_metal_ondc` workspace is stale and
  not the source of truth** — this repo (`dashboardx`) is canonical going forward.
