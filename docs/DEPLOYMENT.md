# Deployment runbook — LeadDesk

The staff-facing half of the system. The partner-facing half (serverx) has its own
runbook, and it is the one with the deadline attached; this deploys after it.

Read alongside: `ARCHITECTURE.md` (how a request moves through this app),
`ENGINEERING_NOTES.md` (why the design is what it is), `.env.example` (every
variable, annotated), and serverx's `docs/DEPLOYMENT.md`.

---

## 1. What this app is, relative to serverx

**One database, one `leads` table, no sync step.** Both applications read and write
the same physical rows. That is the whole architecture, and it is the answer to
most questions that start "where does the data…".

- `prisma/schema.prisma` here is **introspected, not authored**. serverx owns the
  schema and owns every migration. After any serverx migration, run
  `npm run db:pull` here and commit the result. `npm run db:drift` must exit 0.
- A staff status change is **not** an HTTP call to serverx. It writes three rows
  in one transaction: the status, an audit row, and a `lead_status_outbox` row.
  serverx drains that outbox and delivers the partner webhook. If serverx is down,
  nothing is lost — the change sits in the outbox.
- HTTP to serverx is used for exactly two read-only things: the max-eligible-loan
  figures and the integration-health banner. Both degrade to not rendering if
  `INTERNAL_API_KEY` or `SERVER_BASE_URL` is wrong. Nothing else breaks.

This app **must not** run a lead-expiry cron. serverx owns expiry. Two sweeps over
one shared table would race on the same rows with different candidate sets and
each look correct in isolation. `vercel.json` carries the same warning.

---

## 2. Before deploying

### 2.1 Connection strings

Supabase → Project Settings → Database → Connection string. **Not** the direct
`db.<ref>.supabase.co` host — it is IPv6-only and a serverless function cannot
reach it.

| Variable | Which pooler | Why |
|---|---|---|
| `DATABASE_URL` | **transaction**, `:6543`, `?pgbouncer=true&connection_limit=1` | Each concurrent function gets its own client. `pgbouncer=true` disables Prisma's prepared statements, which transaction mode cannot support — without it you get intermittent `prepared statement "s0" already exists` under load. |
| `DIRECT_URL` | **session**, `:5432` | `db pull`, introspection and Studio. Required, because this repo re-introspects after every serverx migration. |

### 2.2 Session secret

```bash
openssl rand -base64 32
```

Minimum 32 characters, validated at module init. There is no session table —
iron-session encrypts the session into the cookie, which is what lets
`middleware.ts` verify it at the edge with no database query. Rotating it signs
every staff member out, which is the intended emergency action.

### 2.3 Match `INTERNAL_API_KEY` to serverx

Same value, both services. It identifies the *service*, not the person; the acting
staff member is passed explicitly as `actor` so the audit row names a human.

---

## 3. Deploy

Vercel → Import `yellow-metal-Systems/dashboardx`. Framework is detected from
`vercel.json`. Build and install commands are the defaults; `postinstall` runs
`prisma generate`.

Environment variables:

```
DATABASE_URL          transaction pooler, pgbouncer=true&connection_limit=1
DIRECT_URL            session pooler
SESSION_SECRET        openssl rand -base64 32
SERVER_BASE_URL       https://<serverx service>
INTERNAL_API_KEY      same value as serverx
SESSION_TTL_SECONDS   28800
```

`lib/env.ts` throws at module init if `DATABASE_URL` or `SESSION_SECRET` is
missing — in **every** environment, not just production. That is deliberate: an
earlier version treated a blank `DATABASE_URL` as "serve example data", which
meant a misconfigured deploy showed staff a plausible dashboard of fake customer
records with a status dropdown that wrote to a `Map` and died with the lambda. A
misconfigured deploy should fail to start, loudly.

### 3.1 Create the first staff login

There is deliberately no default account and no seed. Run locally, against the
deployed database:

```bash
ADMIN_EMAIL='you@yellowmetal.example' ADMIN_PASSWORD='<at least 12 chars>' npm run db:create-admin
```

Passwords are hashed with scrypt (Node built-in — no native dependency to break a
serverless build). The variables are read once and never stored.

### 3.2 Point serverx's CORS at this URL

Go back to the serverx service and set `CORS_ALLOWED_ORIGINS` to the deployed
dashboard origin. Only browser calls are affected; server-side calls from this app
send no `Origin` header and work regardless.

---

## 4. Verification

- [ ] Signing in with a wrong password fails, and the error does not reveal
      whether the address exists
- [ ] `/dashboard` while signed out redirects to sign-in
- [ ] A lead created through the **live serverx API** appears here with no sync
      step and no manual refresh beyond the normal poll
- [ ] Changing a status writes an audit row naming the staff member, and the
      corresponding webhook reaches the partner
- [ ] The integration-health banner renders — proving `SERVER_BASE_URL` and
      `INTERNAL_API_KEY` are right — and is not red
- [ ] `npm run db:drift` exits 0 against the deployed database

A server action is a directly invokable POST endpoint; the `middleware.ts` guard
does not protect it. The guard that matters is `requireStaffOrThrow()` (defined in
`lib/auth/session.ts`), which every action in `app/dashboard/actions.ts` calls as
its first statement. Any new action must do the same — there is no framework
mechanism that will do it for you.

---

## 5. Licensing — a decision to make, not a blocker

**Vercel's Hobby plan is for non-commercial use.** This is a company's internal
staff tool, so strictly it belongs on a paid plan.

**Netlify's free tier permits commercial use** and supports Next.js 14 App Router
including middleware and server actions. If staying free matters more than the
smoother Vercel path, deploy there instead — the environment variables and every
step above are unchanged.

This does not block the partner API handover, which is a separate service.

---

## 6. Known limitations at first release

- **Shared environment.** Partner integration testing writes into the same
  database staff use until a second environment exists. Partner test leads are
  identifiable and are cleaned up before go-live.
- **The status vocabulary is an open set.** Unrecognised values render as-is
  rather than breaking the list.
- **No CI.** `npm test && npm run typecheck && npm run build` is the manual gate
  before every deploy.
