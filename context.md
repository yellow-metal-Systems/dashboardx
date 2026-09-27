# Context for whoever (or whatever agent) picks this up next

This is `dashboardx` — Yellow Metal's staff-facing lead management system
(LeadDesk). Next.js 14 App Router, Prisma, PostgreSQL on Supabase.

Its sibling is `serverx` — the Express service that serves the four
AarthikLabs/ONDC contracts. **They are two separate repos sharing ONE database and
ONE `leads` table.** That combination is deliberate: the "no monorepo" call stands,
and so does the Production Build Plan's requirement that the APIs and the dashboard
be "two faces of the same backend, reading and writing the same database... no
separate sync step."

Start with `ARCHITECTURE.md`. It replaced `API_DOCUMENTATION.md`, which described
four `/api/v1/*` routes and a webhook dispatcher inside *this* app that were never
built here.

## The single most important thing to know

**This repo owns no database migrations.** `serverx/prisma/schema.prisma` is the
source of truth for every shared table. `prisma/migrations/` here was deleted, along
with the `db:migrate` script.

After `serverx` ships a migration:

```bash
npm run db:pull      # prisma db pull + generate
```

…then re-apply by hand the camelCase `@map` conventions `db pull` flattens. The
header of `prisma/schema.prisma` lists exactly what to restore. `npm run db:drift`
tells you whether this datamodel is behind the database.

Never run `prisma migrate` or `prisma db push` here. Either would try to reshape
tables this repo does not own.

## Decisions already made — don't silently redo these

- **One status vocabulary, stored as text.** `LEAD_CREATED`, `CONTACTED`,
  `BRANCH_VISIT_SCHEDULED`, `DISBURSED`, `REJECTED`. Sent to AarthikLabs verbatim —
  there is no translation layer, which is what makes the old status-clobbering bug
  structurally impossible. Text rather than a Postgres enum because AarthikLabs
  confirmed the vocabulary is ours to extend, so adding a value must not require a
  migration. **Always go through `parseLeadStatus` / `statusLabel` /
  `statusBadgeClass` in `lib/leads.ts`** — this app can legitimately read a status it
  has never heard of, and a bare `Record<LeadStatus, …>` lookup yields `undefined`.
- **Staff status changes reach AarthikLabs via a `lead_status_outbox` row**, written
  in the same transaction as the status update and the audit row. Not an HTTP call to
  `serverx`: that could not be transactional, would block or lose the webhook when
  `serverx` is down, and `serverx` dispatches fire-and-forget anyway so a `200` would
  prove nothing. Not a trigger with `LISTEN`/`NOTIFY` or Supabase Realtime either —
  both are at-most-once and lose in-flight events on a deploy.
- **Lead expiry belongs to `serverx`.** This repo's `closeStaleLeads`, its
  `/api/cron/auto-close-leads` route and the `vercel.json` cron entry are all
  deleted. Two expiry jobs over one shared table would race on the same rows with
  different candidate sets and each look correct in isolation. Do not re-add a cron
  here without removing `serverx`'s sweep first.
- **Both LTV figures are shown, never one.** 68% Bullet and 75% Monthly, flat, no
  slab tiering (confirmed by Atharva 2026-09-25). No field records which plan a lead
  is on and the branch manager picks it in person after assessing the actual gold, so
  `serverx` returns both and the lead page renders both.
- **`DISBURSED` opens the disbursement dialog.** The amount, date, tenure and loan id
  ride along in the AarthikLabs webhook. Before this, no UI collected them and every
  `DISBURSED` webhook shipped nulls.
- **Demo mode is development-only and fails loudly in production.** `lib/env.ts`
  throws at module init. It used to be a silent fallback on a blank `DATABASE_URL`,
  which meant a misconfigured production deploy showed staff a plausible dashboard of
  fake customers.
- **The auth guard inside the server action is not redundant** with `middleware.ts`.
  A server action is a directly invokable POST endpoint; middleware protects the page
  render, `requireStaffOrThrow()` protects the mutation.
- **Password hashing is scrypt, not bcrypt or Argon2id.** The v1 spec names those
  two; scrypt is the same class of memory-hard KDF, is built into Node, and adds no
  dependency or native build for a handful of staff logins. `verifyPassword`
  dispatches on the stored prefix, so Argon2id can be introduced alongside it later
  without invalidating existing hashes.
- **No monorepo.** `serverx` stays a separate repo.

## Things that will bite you

- **`db.<project-ref>.supabase.co` has no IPv4 address.** Verified. Vercel Lambdas
  have no IPv6 egress, so that hostname cannot work in a deployed environment. Use
  the pooler hostnames — transaction pooler `:6543` with `pgbouncer=true&connection_limit=1`
  for runtime, session pooler `:5432` as `DIRECT_URL`. The old `?schema=dashboard`
  is gone; that schema never existed in the database.
- **`/partner` is a static mock.** Its submit button toggles a banner and writes
  nothing. It is unlinked from the sidebar so it no longer implies a working portal,
  but it is still reachable by URL and is *not* behind auth (middleware only covers
  `/dashboard/*`). It holds no real data.
- **The leads table renders every row client-side.** `listLeads()` caps at 1000
  defensively. Real pagination is still a gap.
- **`useState(props)` captures the value once on mount.** The leads table hit this: a
  lead posted by the partner API needed a manual browser reload, because
  `router.refresh()` re-rendered the server component and the client component ignored
  the new props. `leads-dashboard.tsx` now absorbs each snapshot in an effect keyed on
  `initialLeads`. If you add another client component fed by a server component, it
  needs the same treatment or refreshing will appear to do nothing.
- **The detail sheet has no Activity section.** Anything added to the timeline shows
  only on the full lead page, so UI added in one place is invisible in the other.

## Open questions

See `serverx/QUESTIONS.md`. The live one: whether lead expiry should notify
AarthikLabs — currently it deliberately does not.

## Still not built (and the spec asks for it)

The v1 platform spec's partner side: `PartnerUser` and `Invite` models, invitation
tokens, self-signup, real lead submission from `/partner`, and both transactional
emails (partner invitation, and the ops new-lead alert the build plan lists under its
Phase 3). The partners page is read-only — no invite, no disable.
