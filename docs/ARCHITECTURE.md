# Yellow Metal — how the system actually fits together

Replaces the old `API_DOCUMENTATION.md`, which documented four `/api/v1/*` routes,
an in-app webhook dispatcher and HMAC signing **inside this Next.js app**. None of
that was ever built here; it lives in the sibling `serverx` repo. That document also
carried 17 absolute `file:///c:/Users/athar/...` links and quoted a version of the
sync script that had already been deleted. It was the most misleading file in either
repo, so it is gone rather than patched.

Last verified against the code: 2026-09-27.

---

## One system, two repos, one database

```
                    AarthikLabs / ONDC
                           │
              POST /api/v1/{dedupe,leads,branch,status}
                           │  x-api-key
                           ▼
      ┌─────────────────────────────────────────┐
      │  serverx  (Express)                     │
      │  · the 4 partner contracts              │
      │  · signed status webhooks OUT           │
      │  · 7-working-day lead expiry            │
      │  · live gold rate → LTV figures         │
      └───────────────┬─────────────────────────┘
                      │                      ▲
         writes/reads  │                      │ drains lead_status_outbox,
                      ▼                      │ then POSTs the webhook
      ┌─────────────────────────────────────────┐
      │        ONE Supabase Postgres            │
      │  leads · partners · lead_activities     │
      │  webhook_events · lead_status_outbox    │
      │  idempotency_keys · admin_users         │
      └─────────────────────────────────────────┘
                      ▲                      │
         reads/writes  │                      │ writes status + audit row
                      │                      │ + outbox row, in ONE txn
      ┌───────────────┴─────────────────────────┐
      │  dashboardx  (Next.js) — "LeadDesk"     │
      │  · staff UI, session auth               │
      │  · lead list / detail / overview        │
      │  · status changes, disbursement capture │
      └─────────────────────────────────────────┘
                           ▲
                    Yellow Metal staff
```

The two repos stay separate git repos — the tech lead's standing "no monorepo"
call — but they are **one system sharing one `leads` table**, which is what the
Production Build Plan specified all along:

> They're not two separate builds bolted together — they're two faces of the same
> backend, reading and writing the same database. A lead that arrives through the
> Lead Push API is written straight into the same `leads` table the dashboard reads
> from — it shows up on the Lead Listing screen the moment it lands, **no separate
> sync step.**

### What this replaced

There used to be two databases with two divergent `Lead` models, bridged by
`scripts/sync-ondc-leads.ts`, run by hand. That arrangement caused three of the six
defects this work fixed, and the script is deleted:

| Before | Now |
|---|---|
| Two `Lead` tables, two status vocabularies, a translation table between them | One table, one vocabulary, no translation |
| ONDC leads appeared only after someone ran a script | They appear the moment they land |
| The sync silently reverted staff-set `Contacted` leads to `New` on every run | Structurally impossible: nothing to translate |
| Two 7-working-day expiry jobs, each correct alone, racing once the table is shared | One job, in `serverx` |
| Staff status changes never reached AarthikLabs at all | Outbox → webhook, durably |

---

## Who owns what

### Schema

`serverx/prisma/schema.prisma` is the **single source of truth**. This repo owns no
migrations — `prisma/migrations/` was deleted, along with the `db:migrate` script.

After `serverx` ships a migration:

```bash
npm run db:pull     # prisma db pull + generate
```

Then re-apply by hand the camelCase `@map` conventions `db pull` flattens — the
header of `prisma/schema.prisma` says exactly what to restore and why.
`npm run db:drift` reports whether this datamodel is behind the database.

### Columns

Both apps write the shared `leads` table, but to different columns.

| Written by `serverx` | Written by LeadDesk |
|---|---|
| `customer_id`, `loan_id` | `partner_id`, `source` |
| borrower identity: `name`, `mobile_number`, `pincode`, `address_line_*`, `dob`, `gender`, `pan` | `acceptance_state`, `duplicate_flag`, `branch_manager_status` |
| `gold_weight_grams`, `offer_accepted_at` | `loan_amount`, `offer_amount`, `ltv_percent`, `kfs_reference` |
| `disbursement_*`, `product_type`, `tenure*` | `loan_confirmed_amount`, `loan_confirmed_at` |
| `status` (partner-driven outcomes, expiry) | `status` (staff-driven progress) |

`lead_activities` is written by both. `webhook_events`, `lead_status_outbox` and
`idempotency_keys` are `serverx`'s (this app only reads webhook history).
`partners` and `admin_users` are LeadDesk's.

---

## Lead status — one vocabulary

Stored in a `text` column, **not** a Postgres enum, so `serverx` can add an
intermediary status without a migration. AarthikLabs explicitly authorised this:

> Status could be - Lead created, Disbursed, Rejected or **any other intermediary
> status available with you**.
> — Jeenu Vadera, 22 Sep 2026

| Stored value | Shown to staff | Terminal |
|---|---|---|
| `LEAD_CREATED` | New | |
| `CONTACTED` | Contacted | |
| `BRANCH_VISIT_SCHEDULED` | Branch visit | |
| `DISBURSED` | Disbursed | ✓ |
| `REJECTED` | Rejected | ✓ |

Because the set is open, this app must tolerate a value it has never seen. Always go
through `lib/leads.ts`:

- `parseLeadStatus(s)` → the known union, or `null`
- `statusLabel(s)` → always something printable (`AWAITING_DOCUMENTS` → "Awaiting documents")
- `statusBadgeClass(s)` → always a real class, never `undefined`

A bare `Record<LeadStatus, string>` lookup on an unknown value yields `undefined` and
renders a blank label or an unstyled badge. `tests/leads.test.ts` covers this.

Nothing moves out of a terminal status: reopening a disbursed lead would send
AarthikLabs a status regression for a loan that has already paid out.

---

## How a staff status change reaches AarthikLabs

`lib/leads-repo.ts` → `updateLeadStatusRepo` writes **three things in one
transaction**:

1. `leads.status`
2. a `lead_activities` audit row naming the signed-in staff member
3. a `lead_status_outbox` row

`serverx` drains the outbox every 5 seconds and dispatches the signed webhook.

**Why an outbox and not an HTTP call to `serverx`:**

- An HTTP call cannot be part of this transaction, so the audit row and the webhook
  trigger could diverge.
- If `serverx` is down, an HTTP call either blocks the staff member or loses the
  webhook permanently. Outbox rows queue and drain in order on restart.
- `serverx`'s own `PATCH /status` dispatches fire-and-forget, so a `200` from it
  would not have told us the webhook fired anyway.
- A Postgres trigger with `LISTEN`/`NOTIFY`, or Supabase Realtime, is at-most-once:
  a deploy drops every in-flight notification with no record it happened.

A stuck outbox is surfaced as a red banner in the dashboard layout, fed by
`serverx`'s `/api/internal/integration-health`.

`DISBURSED` is special-cased in the UI: it opens `DisbursementDialog` to capture the
amount, date, tenure and loan id, because those fields ride along in the webhook and
used to be sent as nulls — nothing in the UI ever collected them.

---

## What this app calls `serverx` for

Only two read-only things, both non-critical and both degrading to "unavailable"
rather than failing the page (`lib/server-bridge.ts`):

| Call | Why it is not local |
|---|---|
| `GET /api/internal/leads/:id` → `dashboard_insights` | `serverx` owns the live 22K gold-rate lookup and its cache. Returns max eligible loan at **both** 68% (Bullet) and 75% (Monthly) LTV — both, because no field records which plan a lead is on and the branch manager picks it in person after assessing the actual gold. |
| `GET /api/internal/integration-health` | Outbox backlog and webhook failures, for the banner. |

Needs `SERVER_BASE_URL` and an `INTERNAL_API_KEY` matching `serverx`'s.

---

## Keeping the list current

Leads arrive from two directions, and only one of them involves this browser. A lead
posted by AarthikLabs lands in the shared `leads` table with nothing to tell an open
dashboard about it.

`hooks/use-live-refresh.ts` calls `router.refresh()` every 30 seconds while the tab is
visible, and immediately on refocus — which is when staleness matters most, because
someone has been away. A background tab does not poll. The header shows how stale the
data is and offers a manual refresh.

**`router.refresh()` alone is not enough**, and this is the part worth remembering:
`leads-dashboard.tsx` holds the rows in `useState(initialLeads)`, which captures that
array *once on mount*. A re-rendered server component hands down new props and
`useState` ignores them, so the table keeps showing the old list — a soft refresh looks
like it did nothing. The component absorbs each new snapshot in an effect keyed on
`initialLeads`, preserving whichever row is mid-mutation so a server render landing
in-flight cannot flash the old status back.

---

## Authentication

Staff-only, and it did not exist before this work: every route was public, so anyone with the URL could read borrower PII and change any lead's
status.

| Piece | Where |
|---|---|
| Password hashing | `lib/auth/password.ts` — scrypt (Node built-in), salted, parameters stored in the hash so cost can be raised later |
| Session | `lib/auth/session.ts` — `iron-session`, cookie `ym_admin_session`, `httpOnly`, `secure` in production, `SameSite=Lax`, 8h default TTL |
| Route guard | `middleware.ts` — protects `/dashboard/*` at the edge, no database query |
| Layout guard | `app/dashboard/layout.tsx` — `requireStaff()` |
| **Action guard** | `app/dashboard/actions.ts` — `requireStaffOrThrow()` |

**The action guard is the one that matters.** A Next.js server action is a directly
invokable POST endpoint; a middleware- or layout-only guard protects the page render
and leaves the mutation open.

`SameSite=Lax` rather than `Strict` deliberately: `Strict` would drop the cookie when
a staff member follows a link to a lead from email or chat, which is a normal way to
arrive. `Lax` still blocks cross-site POSTs.

Create the first account with
`ADMIN_EMAIL='...' ADMIN_PASSWORD='...' npm run db:create-admin`.

---

## No demo mode, no example data

This app has no mode in which it runs without a real database. `lib/env.ts` throws at
module init if `DATABASE_URL` or `SESSION_SECRET` is missing, in every environment.

There used to be a `LEADDESK_DEMO` flag serving eight example leads from an in-memory
store, and — worse — a blank `DATABASE_URL` fell into it *silently*. A misconfigured
production deploy therefore showed staff a plausible dashboard of fake customers whose
status dropdown wrote to a `Map` that died with the lambda, while the auto-close cron
reported success doing nothing.

All of it is gone rather than gated: the example leads and partners, `lib/demo-store.ts`,
the demo sign-in bypass, the demo banner, and the static `/partner` mock page.
Test fixtures now live in `tests/fixtures.ts` where they belong. `tests/env.test.ts`
covers each refusal.

---

## Database connection

Both repos point at the same Supabase project. Two things to get right:

- **Never use the `db.<project-ref>.supabase.co` hostname in a deployed
  environment.** Verified for this project: it has no A record, IPv6 only. Vercel
  Lambdas have no IPv6 egress, so it cannot connect at all. Use the pooler
  hostnames.
- **`DATABASE_URL` → transaction pooler `:6543` with `pgbouncer=true` and
  `connection_limit=1`.** `pgbouncer=true` is mandatory: it disables Prisma's
  prepared statements, which PgBouncer's transaction mode cannot support. Without
  it you get intermittent `prepared statement "s0" already exists` under load.
  `DIRECT_URL` → session pooler `:5432`, used by `db pull` and Studio.

The old `?schema=dashboard` is gone. That schema never existed in the database — its
one migration had been applied only to a local Docker Postgres, if anywhere.

---

## Layout

```
app/
  page.tsx                      → /login or /dashboard
  login/page.tsx                staff sign-in
  dashboard/
    layout.tsx                  auth guard, integration-health banner
    page.tsx                    lead list
    leads/[id]/page.tsx         lead detail: LTV figures, timeline, webhook history
    overview/page.tsx           stats
    partners/page.tsx           partner list (read-only)
    actions.ts                  the only server action — auth-guarded
  partner/page.tsx              STATIC MOCK. Submits nowhere. Unlinked from the sidebar.
components/
  auth/login-form.tsx
  leads/
    leads-dashboard.tsx         table, filters, per-row optimistic status change
    lead-detail-sheet.tsx       slide-over (note: no Activity section — page only)
    lead-status-select.tsx      status control with pending state
    disbursement-dialog.tsx     captures the figures that go to AarthikLabs
  ui/                           shadcn-style primitives
lib/
  env.ts                        fail-fast configuration
  leads.ts                      types, canonical statuses, labels, formatters
  leads-repo.ts                 all database access
  server-bridge.ts              the two read-only calls to serverx
  lead-filters.ts               client-side filtering
  auth/                         password, session, sign-in/out actions
middleware.ts                   edge auth guard for /dashboard/*
```

## Known gaps

Real, and deliberately not addressed in this pass:

- **The leads table renders every row client-side.** No pagination; `listLeads()`
  caps at 1000 rows defensively. Fine at current volume.
- **There is no partner-facing route at all.** The v1 spec's partner side —
  `PartnerUser`, `Invite`, invitation tokens, self-signup, real submission — does not
  exist. An earlier static mock at `/partner` was deleted rather than left implying a
  working portal.
- **No transactional email.** The v1 spec requires a partner-invitation email and an
  ops new-lead alert (§6.1, §11). Neither exists.
- **The partners page is read-only.** No invite, no disable.
- **The detail sheet has no Activity section**, so anything added to the timeline is
  visible only on the full lead page.
- **The leads list polls rather than subscribing.** Up to 30 seconds before a lead
  written by the partner API appears, and the lead detail and overview pages refresh
  only on navigation. Good enough for a table a handful of staff watch; a
  Realtime/LISTEN subscription would be the next step if it ever isn't.

## Related

- `docs/ENGINEERING_NOTES.md` — decisions not to silently redo
- `CHANGELOG.md` — what changed and why
- `../serverx/README.md` — the partner-facing service
- `../serverx/docs/` — the AarthikLabs handover pack
- `docs/archive/feature-aarthiklabs-apis-1.md` — **superseded**; see its header
