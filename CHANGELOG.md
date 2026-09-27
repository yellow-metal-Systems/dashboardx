# Changelog

Scoped to this repo (`dashboardx` / LeadDesk) only. The AarthikLabs-facing service's
history lives in the `serverx` repo's own `CHANGELOG.md`.

## 2026-09-27 — one database, one table, real auth

LeadDesk and `serverx` now share ONE Supabase Postgres and ONE `leads` table, which is
what the Production Build Plan specified from the start ("two faces of the same
backend... no separate sync step"). Three of the six defects fixed in this pass existed
only because that was not true.

**Verified before changing anything.** Read-only inspection of the live Supabase
project found `serverx`'s tables present as `public."Lead"` / `public."WebhookEvent"`
(PascalCase — its schema had no `@@map`), holding 3 leads and 1 webhook event, all of
them the `test.http` example payload posted three times; and **no `dashboard` schema at
all** — this app had never run against Supabase, so its `?schema=dashboard` URL would
have failed outright. So there was no data to migrate and no merge to get wrong. The
four synthetic rows were backed up to JSON before the schema was rebuilt.

### Schema and ownership

- `serverx` owns every migration. `prisma/migrations/` here is **deleted**, along with
  the `db:migrate` script. Its one migration never even created the `distributorRefId`
  column this schema declared, so it was not a truthful record of the database.
- `prisma/schema.prisma` is now a `db pull` artefact, annotated with the camelCase
  `@map` conventions to re-apply after each pull. Added `db:pull` and `db:drift`.
- `distributorRefId` removed: it existed only to hold `serverx`'s lead id across the
  two-database bridge. With one table, the primary key *is* that value.
- The single `address` column is replaced by the structured `address_line_1`/`_2` pair
  the AarthikLabs contract actually carries; the UI joins them for display.
- Added `isDemo`, so seed rows stay distinguishable from real leads forever rather than
  relying on id-prefix guesswork; and `sourceCreatedAt`, meaning when the partner told
  us as distinct from when the row was written — the old sync set `createdAt` to *sync*
  time, restarting the expiry clock on every import.
- `dob` and `disbursementDate` are DATE columns now, not timestamps. A birth date has
  no time and no zone, and `timestamp(3)` storage is exactly what turns `1991-03-14`
  into a midnight-UTC value that renders as 13 March in IST.

### Status vocabulary — one set, no translation

`New`/`Contacted`/`Converted`/`Rejected` replaced by the canonical
`LEAD_CREATED`/`CONTACTED`/`BRANCH_VISIT_SCHEDULED`/`DISBURSED`/`REJECTED`, stored as
**text** and shared with `serverx`.

This lands the `Converted → Disbursed` rename plus `BranchVisitScheduled` that
`docs/archive/feature-aarthiklabs-apis-1.md` had been blocking on as DEP-003 since 19 Sep, and
it deletes the translation layer whose `STATUS_MAP` / `TERMINAL_BACKEND_STATUSES` guard
existed because an earlier version silently reverted every staff-set `Contacted` lead
to `New` on each sync run. With one vocabulary there is nothing left to translate.

Text rather than a Postgres enum because AarthikLabs confirmed the vocabulary is ours
to extend — which means this app can read a status it has never seen. Hence
`parseLeadStatus`, `statusLabel` and `statusBadgeClass` in `lib/leads.ts`, all of which
degrade gracefully instead of yielding `undefined`. The overview page now reports
unknown statuses rather than dropping them.

### Staff status change now reaches AarthikLabs

`updateLeadStatusRepo` writes the status, the audit row **and** a `lead_status_outbox`
row in one transaction; `serverx` drains it and dispatches the signed webhook. Before
this, staff status changes never reached AarthikLabs at all —
`PATCH /api/internal/leads/:id/status` had no caller anywhere.

An HTTP call to `serverx` was considered and rejected: it could not be part of the
transaction, it would block the staff member or permanently lose the webhook when
`serverx` is down, and `serverx` dispatches fire-and-forget so a `200` would not have
proved the webhook fired. A Postgres trigger with `LISTEN`/`NOTIFY`, and Supabase
Realtime, were rejected as at-most-once — a deploy drops every in-flight notification
with no record it happened.

A stuck outbox now shows as a red banner in the dashboard layout, fed by `serverx`'s
`/api/internal/integration-health`.

### Staff authentication — closes SEC-003 and the plan's Phase 6

Every route was public, including `/partner`. Anyone with the URL could read borrower
PII and change any lead's status.

- `admin_users` table; scrypt password hashing (`lib/auth/password.ts`), salted, with
  the parameters stored in the hash so the cost can be raised later without
  invalidating existing hashes.
- `iron-session` cookie `ym_admin_session` — `httpOnly`, `secure` in production,
  `SameSite=Lax` (not `Strict`, which would drop the cookie when staff follow a link
  to a lead from email or chat).
- `middleware.ts` guards `/dashboard/*` at the edge with no database query;
  `requireStaff()` in the layout; **and `requireStaffOrThrow()` inside the server
  action** — which is the guard that actually matters, because a server action is a
  directly invokable POST endpoint and a middleware-only guard leaves the mutation
  open.
- The signed-in staff member is stamped into `LeadActivity.actor`. Every staff change
  previously recorded `actor: null` while only the automated sweep named itself.
- `/partner` unlinked from the sidebar rather than left implying a working portal.

### Lead expiry removed from this repo

`closeStaleLeads`, `/api/cron/auto-close-leads`, the `vercel.json` cron entry and
`lib/working-days.ts` are all deleted. `serverx` owns expiry, sweeping hourly. Over one
shared table, two expiry jobs would race on the same rows with different candidate sets
(`LEAD_CREATED` vs `New|Contacted`) and each look correct in isolation. `serverx`'s
sweep gained the audit row this repo's version wrote and it previously lacked.

### UI

- **Disbursement dialog** on `DISBURSED`, capturing amount, date, tenure and loan id.
  These have always been part of the status-update contract and the webhook payload,
  and no UI ever collected them — so every `DISBURSED` webhook shipped nulls. Recording
  a disbursal also sets `branchManagerStatus: CONFIRMED` and the confirmed amount.
- **Max eligible loan at both 68% (Bullet) and 75% (Monthly) LTV** now rendered on the
  lead page. `serverx` has returned these since 25 Sep and nothing displayed them.
  Degrades to "unavailable" rather than failing the page.
- **Webhook delivery history** on the lead page, so a failed AarthikLabs update is
  visible to staff instead of silent.
- Status controls have a real pending state and are disabled in flight. The table's
  optimistic update now reverts only the affected row — it used to snapshot the entire
  leads array, so one failure discarded any concurrent edit to a different lead.
- Terminal statuses are locked in the UI. Reopening a disbursed lead would send
  AarthikLabs a status regression for a loan that has already paid out.
- New `components/ui/dialog.tsx`, built on the Radix primitive the Sheet already uses,
  so no new dependency.
- **The leads list stays current without a manual browser reload.** A lead posted by
  AarthikLabs previously required pressing refresh, which reads as a broken integration
  even though the write had already landed. `hooks/use-live-refresh.ts` polls every 30s
  while the tab is visible and on refocus, and the header shows the data's age with a
  manual refresh button.

  Two separate causes, and the second was the real one: nothing asked the server to
  re-render, *and* `useState(initialLeads)` captures that array once on mount — so new
  props from a re-render were ignored and `router.refresh()` on its own would have
  appeared to do nothing. The component now absorbs each server snapshot in an effect,
  preserving any row mid-mutation.

### Configuration

- `lib/env.ts` throws at module init if production has no `DATABASE_URL`, has
  `LEADDESK_DEMO=1`, or has no `SESSION_SECRET`. Demo mode used to be a silent fallback
  on a blank `DATABASE_URL`, so a misconfigured production deploy showed staff a
  plausible dashboard of fake customers whose status dropdown wrote to an in-memory
  `Map` that died with the lambda — while the cron reported success doing nothing.
- **`db.<ref>.supabase.co` has no A record** (verified) and Vercel Lambdas have no IPv6
  egress, so that hostname cannot work in a deployed environment. `.env.example` now
  documents the pooler hostnames: transaction pooler `:6543` with
  `pgbouncer=true&connection_limit=1` for runtime, session pooler as `DIRECT_URL`.
  `?schema=dashboard` removed.
- `CRON_SECRET` gone with the cron route. `ONDC_INTERNAL_API_KEY` gone with the sync
  script — it was present in neither env file, which is why a missing key surfaced as a
  confusing 401 from the backend rather than "you forgot to set it". Replaced by
  `SERVER_BASE_URL` + `INTERNAL_API_KEY`.

### Tests — the first in this repo

40 tests covering: the canonical status vocabulary (including an assertion that it
matches `serverx`'s, which is the only thing catching drift between two repos that
agree by convention rather than shared code), forward-compatibility with an unknown
status, password hashing and policy, lead filtering, and `lib/env.ts` refusing each bad
production configuration.

### Documentation

- `API_DOCUMENTATION.md` **deleted**, replaced by `docs/ARCHITECTURE.md`. The old one was
  778 lines dated 24 Sep documenting four Next.js-native `/api/v1/*` routes, an in-app
  webhook dispatcher and HMAC signing that never existed in this repo; it carried 17
  absolute `file:///c:/Users/athar/...` links under two different roots, quoted the
  pre-fix broken version of the sync script, and left "which backend is real?" as an
  open `[!CAUTION]` question the org split had already answered.
- `docs/archive/feature-aarthiklabs-apis-1.md` marked **Superseded**, with a header recording
  what landed, what was dropped and what is still open.
- `docs/ENGINEERING_NOTES.md` rewritten.

### Deleted

`scripts/sync-ondc-leads.ts` · `app/api/cron/auto-close-leads/route.ts` ·
`lib/working-days.ts` · `prisma/migrations/` · `API_DOCUMENTATION.md` ·
the `vercel.json` cron entry · the `db:migrate` script

---

## Phase 1 — Admin dashboard (shipped, 17-24 Sep 2026)

- Initial scaffold (17 Sep, `2ae3f84`): Next.js 14 App Router, leads table, filters,
  status changes, partner tracking, demo mode (in-memory data, no DB required).
- 24 Sep (`ca3f69b`): Yellow Metal LMS design system applied (Manrope font, brand
  colour tokens, custom spacing, button/card/badge shapes) — previously a gold/amber
  Material Design 3 theme with Geist. Switched off demo mode, read/write real local
  Postgres.
- Real bugs found and fixed during/after the redesign: a sidebar flex-overflow bug that
  scrolled the entire page horizontally; stat-card label misalignment when labels wrap
  to different line counts; a systemic top-padding regression across 13 `CardContent`
  usages; client-side count-up/bar-grow animations that replayed on every navigation
  and were the actual cause of reported "lag" (removed — numbers render instantly).

## 7-working-day lead timeout (24 Sep) — later moved to `serverx`

`New`/`Contacted` leads with no progress for 7 working days (Mon-Fri, no holiday
calendar) auto-closed to `Rejected`, with a `LeadActivity` audit row
(`actor: system:lead-timeout`). Daily Vercel Cron → `/api/cron/auto-close-leads`,
Bearer-auth via `CRON_SECRET` (constant-time compare). `workingDaysSince()` used UTC
explicitly after an audit caught it using local server time, which was
nondeterministic across deployment environments.

**Superseded 27 Sep:** all of this is deleted from this repo. `serverx` owns lead
expiry, and kept the audit-row behaviour.

## Backend integration bridge — real bug found and fixed (25 Sep) — later deleted

`scripts/sync-ondc-leads.ts` pulled leads from the backend into this DB. It was reading
fields (`distributor_ref_id`, `borrower_name`, `address`, `dob`, `ltv_pct`,
`duplicate_flag`) that did not exist on the backend's actual response at all — so every
lead was silently skipped on every run. Rewritten to read the real fields, key the
upsert on the backend's own lead id, and use an explicit status-mapping table.

A code review then caught a second bug in the same file: `status` was being
unconditionally overwritten on every re-run, silently reverting staff-set `Contacted`
leads (and locally auto-`Rejected` timeout leads) back to `New`. Fixed by only
overwriting `status` when the backend reported a genuinely terminal outcome
(`DISBURSED`/`REJECTED`).

**Superseded 27 Sep:** the script is deleted. With one shared table there is no sync
and no status mapping, so that entire class of bug is gone by construction. (Note: the
terminal values were `DISBURSED`/`REJECTED` — earlier revisions of this changelog said
`EXPIRED`, which was an abandoned guess, briefly `UNDISBURSED`, settled on `REJECTED`
on 25 Sep.)

## Org split (25 Sep)

Split out of the shared `yellow_metal_ondc` workspace into its own repo
(`yellow-metal-Systems/dashboardx`), matching the tech lead's "no monorepo" decision.
The backend's own copy of this frontend (`yellow_metal_ondc/frontend/`) is a stale
duplicate — this repo is canonical. Pushed from the existing `Downloads/yellowmetal` git
history (`2ae3f84`, `ca3f69b`) rather than starting fresh, to keep that history intact.
