# Changelog

Scoped to this repo (`dashboardx` / LeadDesk) only. Backend history lives in the `server`
repo's own `changelog.md`.

## Phase 1 — Admin dashboard (shipped, 17-24 Sep 2026)

- Initial scaffold (17 Sep, `2ae3f84`): Next.js 14 App Router, leads table, filters, status
  changes, partner tracking, demo mode (in-memory data, no DB required).
- 24 Sep (`ca3f69b`): Yellow Metal LMS design system applied (Manrope font, brand color
  tokens, custom spacing, button/card/badge shapes) — previously a gold/amber Material Design
  3 theme with Geist. Switched off demo mode, now reads/writes real local Postgres.
- Real bugs found and fixed during/after the redesign: a sidebar flex-overflow bug that
  scrolled the entire page (including the sidebar) horizontally; stat-card label misalignment
  when labels wrap to different line counts; a systemic top-padding regression across 13
  `CardContent` usages; client-side count-up/bar-grow animations that replayed on every
  navigation and were the actual cause of reported "lag" (removed — numbers render instantly).

## 7-working-day lead timeout (24 Sep)

`New`/`Contacted` leads with no progress for 7 working days (Mon-Fri, no holiday calendar)
auto-close to `Rejected`, with a `LeadActivity` audit row (`actor: system:lead-timeout`).
Daily Vercel Cron -> `/api/cron/auto-close-leads`, Bearer-auth via `CRON_SECRET`
(constant-time compare). `workingDaysSince()` uses UTC explicitly (was local server time —
nondeterministic across deployment environments) after an audit caught it.

## Backend integration bridge — real bug found and fixed (25 Sep)

`scripts/sync-ondc-leads.ts` pulls leads from the backend (`server` repo) into this DB. It was
reading fields (`distributor_ref_id`, `borrower_name`, `address`, `dob`, `ltv_pct`,
`duplicate_flag`) that don't exist on the backend's actual response at all — every lead was
silently being skipped on every run. Rewritten to read the real fields, key the upsert on the
backend's own lead id, and add an explicit status-mapping table
(`LEAD_CREATED`->`New`, `DISBURSED`->`Converted`, `EXPIRED`->`Rejected`).

A code review then caught a second bug in the same file: `status` was being unconditionally
overwritten on every re-run, silently reverting staff-set `Contacted` leads (and
locally-auto-`Rejected` timeout leads) back to `New`. Fixed: `status` is now only overwritten
when the backend reports a genuinely terminal outcome (`DISBURSED`/`EXPIRED`).

## Org split (25 Sep)

Split out of the shared `yellow_metal_ondc` workspace into its own repo
(`yellow-metal-Systems/dashboardx`), matching the tech lead's "no monorepo" decision. The
backend's own copy of this frontend (`yellow_metal_ondc/frontend/`) is now a stale duplicate —
this repo is the canonical source going forward. Pushed from the existing `Downloads/yellowmetal`
git history (`2ae3f84`, `ca3f69b`) rather than starting fresh, to keep that history intact.
