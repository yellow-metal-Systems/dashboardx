# dashboardx — Yellow Metal LeadDesk

The staff-facing lead management UI. Next.js 14 (App Router), Prisma, PostgreSQL on
Supabase.

Branch staff use this to work incoming gold-loan leads: view and filter them, see
duplicates and activity history, move a lead through its statuses, and record a
disbursal. Leads arrive from two places — referral partners, and the AarthikLabs/ONDC
network via the sibling `serverx` service.

> **This repo shares one database with `serverx`, and owns no migrations.**
> Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before changing anything under `prisma/`.

## Quick start

```bash
npm install
cp .env.example .env          # then fill it in — the notes in that file matter
npx prisma generate
npm run db:create-admin       # your staff login (see below)
npm run dev                   # http://localhost:3000
```

The tables must already exist. They are created by `serverx`, not here:

```bash
cd ../serverx && npx prisma migrate deploy
```

### Your first login

There is no default account, on purpose:

```bash
ADMIN_EMAIL='you@yellowmetal.example' ADMIN_PASSWORD='a-long-passphrase' \
  npm run db:create-admin
```

Minimum 12 characters. Run it again with the same email to reset a password.

### There is no offline mode

This app reads and writes the real shared `leads` table and has no demo or
example-data mode. `lib/env.ts` throws at module init if `DATABASE_URL` or
`SESSION_SECRET` is missing, in **every** environment.

An earlier version fell back to in-memory example data when `DATABASE_URL` was blank,
which meant a misconfigured deploy showed staff a plausible dashboard of fake customer
records. All of it — the example leads, the in-memory store, the demo sign-in bypass —
has been removed rather than gated.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` / `build` / `start` | The usual Next.js trio |
| `npm test` | Vitest — 44 tests, no database needed |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm run db:create-admin` | Create or reset a staff login |
| `npm run db:pull` | Re-generate the Prisma client from the live schema after `serverx` ships a migration |
| `npm run db:drift` | Exit 2 if this datamodel is behind the database |

There is deliberately **no `db:migrate`**. See below.

## Schema ownership

`serverx/prisma/schema.prisma` is the single source of truth for every shared table.
This repo's `prisma/schema.prisma` is a client-generation artefact, and
`prisma/migrations/` does not exist.

After `serverx` ships a migration:

```bash
npm run db:pull
```

Then re-apply by hand the camelCase `@map` conventions `db pull` flattens — the header
of `prisma/schema.prisma` lists exactly what to restore and why. `npm run db:drift`
tells you whether you are behind.

**Never run `prisma migrate` or `prisma db push` here.** Either would try to reshape
tables this repo does not own, and would drop the columns `serverx` writes.

## How it connects

| Reads/writes | How |
|---|---|
| Lead data | Prisma, directly against the shared `leads` table. No sync step. |
| Staff status changes | Written locally with an audit row **and** a `lead_status_outbox` row, in one transaction. `serverx` drains the outbox and sends the AarthikLabs webhook. |
| Max eligible loan (68% / 75% LTV) | `GET serverx:/api/internal/leads/:id` — `serverx` owns the live gold-rate lookup. Degrades to "unavailable". |
| Integration health banner | `GET serverx:/api/internal/integration-health` |

Needs `SERVER_BASE_URL` and an `INTERNAL_API_KEY` matching `serverx`'s. Without them the
two read-only figures simply don't render; nothing else breaks.

## Authentication

Staff-only. `iron-session` cookie `ym_admin_session`, scrypt password hashing,
`admin_users` table.

Guarded in three places, and the third is the one that matters:

1. `middleware.ts` — `/dashboard/*` at the edge, no database query.
2. `app/dashboard/layout.tsx` — `requireStaff()`.
3. **`app/dashboard/actions.ts` — `requireStaffOrThrow()`.** A server action is a
   directly invokable POST endpoint, so a middleware- or layout-only guard protects the
   page render and leaves the mutation open.

## Layout

```
app/
  login/                      staff sign-in
  dashboard/
    page.tsx                  lead list
    leads/[id]/page.tsx       detail: LTV figures, timeline, webhook history
    overview/  partners/      stats, partner list (read-only)
    actions.ts                the only server action — auth-guarded
  partner/page.tsx            STATIC MOCK. Submits nowhere. Unlinked from the sidebar.
components/
  leads/                      table, filters, detail sheet, status control, disbursement dialog
  auth/  ui/                  login form; shadcn-style primitives
hooks/use-live-refresh.ts     polls so partner-API leads appear without a reload
lib/
  env.ts                      fail-fast configuration
  leads.ts                    types, canonical statuses, labels, formatters
  leads-repo.ts               all database access
  server-bridge.ts            the two read-only calls to serverx
  auth/                       password, session, sign-in/out
middleware.ts                 edge auth guard
```

## Environment

`.env.example` is the reference. Two things catch people out:

- **Do not use the `db.<project-ref>.supabase.co` hostname in a deployed environment.**
  It has no A record — IPv6 only — and Vercel Lambdas have no IPv6 egress. Use the
  pooler hostnames.
- **`DATABASE_URL` must be the transaction pooler (`:6543`) with `pgbouncer=true`.**
  Without that flag you get intermittent `prepared statement "s0" already exists` under
  load. `DIRECT_URL` is the session pooler, used by `db pull`.

## Related

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the two repos fit together
- [`docs/ENGINEERING_NOTES.md`](docs/ENGINEERING_NOTES.md) — decisions not to silently redo
- [`CHANGELOG.md`](CHANGELOG.md) — what changed and why
- [`docs/TODO.md`](docs/TODO.md) — known gaps and open preference calls
- `../serverx/README.md` — the AarthikLabs-facing service
