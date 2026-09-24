---
goal: Build the three AarthikLabs integration APIs (Dedupe, Lead Push, Status Webhook) for LeadDesk Phase 2
version: 1.0
date_created: 2026-09-19
last_updated: 2026-09-19
owner: Atharva Tayade, Ayushman Singh
status: 'Planned'
tags: [feature, api, integration, security]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Atomic, AI-executable breakdown of LeadDesk Phase 2 — the three AarthikLabs-facing APIs (Dedupe, Lead Push, Status Webhook) plus the two prerequisites that block them from safely handling real data (schema migration, staff authentication). Contracts, schema diffs, and threat model are already confirmed in `IMPLEMENTATION_PLAN_LEADDESK_V3.md` (§1–§5) — this plan turns that analysis into discrete tasks with time estimates. Phase 1 (the admin dashboard) is already built and deployed; it is not re-planned here.

## 1. Requirements & Constraints

- **REQ-001**: `POST /api/v1/dedupe` accepts `{ mobile_number }`, returns duplicate flag + existing lead reference, and never blocks or delays the broadcast.
- **REQ-002**: `POST /api/v1/leads` accepts the full borrower + offer payload, inserts a `Lead` row with `status = New`, `source = AARTHIKLABS`, and returns `{ lead_id, status, acknowledged_at }`.
- **REQ-003**: `POST /api/v1/status-updates` fires from the same status-change action already in `app/dashboard/actions.ts` and pushes to an AarthikLabs-owned webhook URL.
- **SEC-001**: Both inbound endpoints require API-key (or mutual-TLS) authentication, separate from the admin dashboard's session auth.
- **SEC-002**: The outbound webhook is HMAC-SHA256 signed over the raw body, verified with `timingSafeEqual`, with an idempotency check via a unique event ID.
- **SEC-003**: The admin dashboard must be authenticated (currently is not) before any real, non-demo lead data is stored — see `IMPLEMENTATION_PLAN_LEADDESK_V3.md` §5.2.
- **CON-001**: Team is 2 engineers (Atharva Tayade, Ayushman Singh), both already familiar with this codebase.
- **CON-002**: Stack is fixed — Next.js 14 App Router API routes + Prisma + PostgreSQL + Vercel — per the fullstack decision engine's 100%-fit validation in V3 §3.
- **GUD-001**: Dedupe is informational only; a duplicate hit must never reject or delay a broadcast response.
- **GUD-002**: No new abstractions beyond what each endpoint needs — reuse `lib/leads-repo.ts` patterns already established in Phase 1.
- **PAT-001**: Follow the existing Next.js Route Handler + Prisma pattern already used by `app/dashboard/actions.ts` (server-side mutation, revalidate, no client-side Prisma calls).

## 2. Implementation Steps

### Implementation Phase 1 — Data model migration

- GOAL-001: Extend the `Lead` schema with the fields the real API contracts require, and resolve the status-vocabulary decision flagged in V3 §2.2 before any endpoint code is written.

| Task | Description | Completed | Date | Estimate |
|------|-------------|-----------|------|----------|
| TASK-001 | Add `distributorRefId`, `consentRefId`, `interestRatePct`, `tenureMonths`, `offerId`, `officerName`, `officerContact`, `statusReason` to the `Lead` model in `prisma/schema.prisma` | | | 1h |
| TASK-002 | **Blocking:** get Ayushman/Rahul sign-off on the `LeadStatus` unification (`Converted`→`Disbursed`, add `BranchVisitScheduled`) — V3 §2.2 | | | 1h (meeting, not coding) |
| TASK-003 | Implement the approved status-enum change across `schema.prisma`, `lib/leads.ts` (`STATUS_BADGE_CLASSES`), and the dashboard status dropdown | | | 2h |
| TASK-004 | Run `prisma migrate dev`, regenerate the client, update `prisma/seed.ts` with values for the new fields | | | 1h |
| TASK-005 | Update `lib/leads.ts` types and `lib/leads-repo.ts` mappers (`toLead`) for the new fields | | | 1h |

Phase 1 subtotal: **6 hours**

### Implementation Phase 2 — Shared inbound API auth

- GOAL-002: One auth + rate-limit layer shared by both AarthikLabs-facing inbound routes, kept separate from admin session auth per SEC-001.

| Task | Description | Completed | Date | Estimate |
|------|-------------|-----------|------|----------|
| TASK-006 | API-key auth middleware for `/api/v1/*` routes (header check against an env-stored key) | | | 2h |
| TASK-007 | Add `AARTHIKLABS_API_KEY` to `.env` / `.env.example` | | | 0.5h |
| TASK-008 | In-memory token-bucket rate limiter shared by both inbound routes (V3 §5.3, DoS mitigation) | | | 2h |

Phase 2 subtotal: **4.5 hours**

### Implementation Phase 3 — Dedupe API

- GOAL-003: `POST /api/v1/dedupe`, per V3 §3.1.

| Task | Description | Completed | Date | Estimate |
|------|-------------|-----------|------|----------|
| TASK-009 | Zod request schema: `{ mobile_number: string }` | | | 0.5h |
| TASK-010 | Route handler: query `Lead` by `mobile`, map to `{ is_duplicate, existing_lead_id, existing_status, last_submitted_at }` | | | 1.5h |
| TASK-011 | Unit tests: duplicate found, not found, malformed input | | | 1.5h |

Phase 3 subtotal: **3.5 hours**

### Implementation Phase 4 — Lead Push API

- GOAL-004: `POST /api/v1/leads`, per V3 §3.2.

| Task | Description | Completed | Date | Estimate |
|------|-------------|-----------|------|----------|
| TASK-012 | Zod request schema for the nested payload (`borrower`, `offer_accepted` blocks) | | | 1.5h |
| TASK-013 | Route handler: validate, map to `Lead` row (`source = AARTHIKLABS`, `status = New`), insert | | | 2.5h |
| TASK-014 | Idempotency-key handling — **depends on** Nishit confirming the field name (V3 §7, external open item) | | | 1.5h |
| TASK-015 | Internal ops notification stub (log-only, same pattern as the v1 plan's Resend stub) | | | 1h |
| TASK-016 | Integration tests: happy path, duplicate-mobile flagging, malformed payload | | | 2h |

Phase 4 subtotal: **8.5 hours**

### Implementation Phase 5 — Status Webhook Dispatcher

- GOAL-005: Outbound `POST` to AarthikLabs on every status change, per V3 §3.3.

| Task | Description | Completed | Date | Estimate |
|------|-------------|-----------|------|----------|
| TASK-017 | HMAC-SHA256 signing helper (raw body + `timingSafeEqual`, per SEC-002) | | | 1.5h |
| TASK-018 | Hook the dispatcher into the existing `updateLeadStatus` action in `app/dashboard/actions.ts` | | | 2h |
| TASK-019 | Retry/backoff on delivery failure + failure logging | | | 2.5h |
| TASK-020 | Tests: signature verification, retry-on-failure, payload shape | | | 2h |

Phase 5 subtotal: **8 hours**

### Implementation Phase 6 — Staff dashboard authentication (blocking prerequisite)

- GOAL-006: Close the SEC-003 gap. Not one of the three APIs, but real lead data — from AarthikLabs or otherwise — cannot safely reach this dashboard without it.

| Task | Description | Completed | Date | Estimate |
|------|-------------|-----------|------|----------|
| TASK-021 | `iron-session` config for `ym_admin_session` (httpOnly, secure in prod, SameSite=Lax) | | | 1.5h |
| TASK-022 | Admin login page + seed one `AdminUser` | | | 2h |
| TASK-023 | Session guard on the `(protected)` dashboard route group | | | 1.5h |
| TASK-024 | Manual verification: cookie flags in devtools, logout clears session, expired session redirects | | | 1h |

Phase 6 subtotal: **6 hours**

### Implementation Phase 7 — Integration testing

- GOAL-007: End-to-end validation per the Production Build Plan's Phase 6.

| Task | Description | Completed | Date | Estimate |
|------|-------------|-----------|------|----------|
| TASK-025 | Local end-to-end run: dedupe → lead push → appears in dashboard → status change → webhook fires | | | 2h |
| TASK-026 | Joint test with AarthikLabs sandbox credentials — **our-side effort only**; wall-clock depends on their sandbox availability (V3 §7, still open) | | | 4h |

Phase 7 subtotal: **6 hours (our-side effort)**

## 3. Alternatives

- **ALT-001**: Build the two inbound endpoints as a separate Express/Fastify microservice instead of Next.js API routes — rejected; the fullstack decision engine matched `next-app-router-postgres` at 100% fit (V3 §3), and a separate service would re-introduce the "two builds bolted together" problem the Production Build Plan explicitly warns against.
- **ALT-002**: Defer staff authentication (Phase 6) until after the three APIs ship — rejected; V3 §5.2 scores unauthenticated access to borrower PII as Critical (8.2 DREAD). Sequencing APIs before auth would mean real AarthikLabs leads land in an unauthenticated dashboard.
- **ALT-003**: Use JWT-based auth for the inbound APIs instead of a static API key — deferred; adds complexity (key rotation, algorithm confirmation) not justified at ~5 QPS p99 year-one traffic. Revisit if AarthikLabs requires it.

## 4. Dependencies

- **DEP-001**: Nishit (AarthikLabs) confirms the idempotency-key field name for `POST /leads` — blocks TASK-014.
- **DEP-002**: Nishit confirms dedupe matching strength (mobile-only vs. DOB/name) — informs TASK-010 if it changes before build.
- **DEP-003**: Ayushman/Rahul sign off on the `LeadStatus` enum unification — blocks TASK-003 and everything downstream of it.
- **DEP-004**: AarthikLabs provides a sandbox environment and webhook receiver URL for TASK-026.
- **DEP-005**: `@prisma/client` 6.19.3 and the existing Postgres instance (currently demo mode in production — V3 §6) must be attached before Phase 7 can run against real data.

## 5. Files

- **FILE-001**: `prisma/schema.prisma` — new `Lead` fields, `LeadStatus` enum change (Phase 1).
- **FILE-002**: `prisma/seed.ts` — updated seed data matching the new schema (Phase 1).
- **FILE-003**: `lib/leads.ts` — types, `STATUS_BADGE_CLASSES`, status labels (Phase 1).
- **FILE-004**: `lib/leads-repo.ts` — `toLead` mapper updates (Phase 1).
- **FILE-005**: `app/api/v1/dedupe/route.ts` — new (Phase 3).
- **FILE-006**: `app/api/v1/leads/route.ts` — new (Phase 4).
- **FILE-007**: `lib/webhooks/status-dispatcher.ts` — new (Phase 5).
- **FILE-008**: `app/dashboard/actions.ts` — hook the webhook dispatcher into `updateLeadStatus` (Phase 5).
- **FILE-009**: `lib/auth/session.ts`, `app/admin/login/page.tsx`, `app/dashboard/(protected)/layout.tsx` — new (Phase 6).
- **FILE-010**: `.env.example` — `AARTHIKLABS_API_KEY`, webhook secret (Phase 2).

## 6. Testing

- **TEST-001**: Dedupe API — duplicate found, not found, malformed `mobile_number`.
- **TEST-002**: Lead Push API — happy path insert, duplicate-mobile flagging, malformed nested payload, idempotent retry.
- **TEST-003**: Status Webhook — HMAC signature verification (valid/invalid), retry-on-failure, exact payload shape against V3 §3.3.
- **TEST-004**: Auth middleware — inbound requests rejected without a valid API key; admin routes rejected without a valid session.
- **TEST-005**: End-to-end (Phase 7) — full broadcast-to-disbursement flow through the real dashboard.

## 7. Risks & Assumptions

- **RISK-001**: DEP-001/DEP-002 (AarthikLabs' answers) arrive late — Phase 4 and part of Phase 3 stall. Mitigation: build and test everything else (Phases 1, 2, 5, 6) in parallel; these do not depend on AarthikLabs' answers.
- **RISK-002**: DEP-003 (status-enum sign-off) is delayed — blocks Phase 1 TASK-003 onward, i.e., the critical path for every other phase. This is the single highest-leverage item to resolve first.
- **RISK-003**: AarthikLabs sandbox (DEP-004) isn't ready when Phases 1–6 finish — Phase 7's wall-clock time is outside this team's control regardless of how fast the coding goes.
- **ASSUMPTION-001**: Both engineers can dedicate focused time to this work (not context-switching against other coursework/commitments) for the estimate below to hold.
- **ASSUMPTION-002**: No major rework is needed after DEP-001/DEP-002 land — i.e., the draft contracts in V3 §3 are close to final.

## 8. Related Specifications / Further Reading

- `IMPLEMENTATION_PLAN_LEADDESK_V3.md` — full architecture, schema diff, API contracts, and STRIDE/DREAD threat model this plan is derived from.
- `IMPLEMENTATION_PLAN_LEADDESK_V2.md` — original Phase 1/2 plan, superseded for Phase 2 by v3.
- `Yellow Metal ↔ AarthikLabs — Broadcast Flow & API Specs.pdf` — source of REQ-001/002/003.
- `YellowMetal_Production_Build_Plan.pdf` — source of the phase ordering and the "APIs + Dashboard are one system" constraint (CON-002).

## 9. Time Estimate Summary

| Scope | Hours | Working days (1 engineer) | Working days (2 engineers, parallelized) |
|---|---|---|---|
| **The 3 APIs only** (Phases 3 + 4 + 5 — Dedupe, Lead Push, Webhook) | 20h | ~2.5 days | ~1.5–2 days |
| **+ blocking prerequisites** (Phases 1, 2, 6 — schema, inbound auth, staff auth) | +16.5h → 36.5h | ~4.5 days | ~2.5–3 days |
| **+ integration testing** (Phase 7, our-side effort) | +6h → 42.5h | ~5.5 days | ~3–3.5 days |

**Bottom line:** building the three API endpoints themselves is roughly **1.5–2.5 working days** split across two engineers. Getting to a state where they can safely handle real AarthikLabs traffic — schema migration, inbound auth, and (critically) staff dashboard authentication — is realistically **3–4 working days**. These numbers assume DEP-001/002/003 (external answers + internal sign-off) land before Phase 3/4 coding starts; if they slip, the calendar time slips with them even though the coding effort doesn't change.
