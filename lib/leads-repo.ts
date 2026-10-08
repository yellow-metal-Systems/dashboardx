import type {
  Lead as LeadRow,
  LeadActivity as ActivityRow,
  Partner as PartnerRow,
  WebhookEvent as WebhookEventRow,
} from "@prisma/client";

import { prisma } from "./prisma";
import { fetchBranchNames, type BranchInfo } from "./server-bridge";
import {
  LEAD_STATUSES,
  isTerminalStatus,
  joinAddress,
  parseLeadStatus,
  statusLabel,
  type Lead,
  type LeadActivity,
  type LeadPartner,
  type LeadStatus,
  type LeadWebhookEvent,
} from "./leads";

type LeadWithPartner = LeadRow & { partner: PartnerRow | null };

function num(value: { toNumber(): number } | null): number | null {
  return value === null ? null : value.toNumber();
}

/** A DATE column has no time or zone — keep it as YYYY-MM-DD, not an ISO instant. */
function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toPartner(row: PartnerRow): LeadPartner {
  return { id: row.id, orgName: row.orgName, contactEmail: row.contactEmail };
}

export function toLead(
  row: LeadWithPartner,
  isNewCustomer: boolean,
  lmsUpdatedAt: string | null = null,
  branches: Map<string, BranchInfo> = new Map()
): Lead {
  return {
    id: row.id,
    leadNo: row.leadNo,
    customerId: row.customerId,
    loanId: row.loanId,
    source: row.source,
    partner: row.partner ? toPartner(row.partner) : null,
    ondcTransactionId: row.ondcTransactionId,
    lspName: row.lspName,
    name: row.name,
    mobile: row.mobile,
    // There is no single `address` column: the structured pair is what
    // AarthikLabs sends and is strictly more information, so the UI joins them.
    address: joinAddress(row.addressLine1, row.addressLine2),
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    pinCode: row.pinCode,
    loanAmount: num(row.loanAmount),
    dob: dateOnly(row.dob),
    goldGrams: num(row.goldGrams),
    offerAmount: num(row.offerAmount),
    ltvPercent: num(row.ltvPercent),
    kfsReference: row.kfsReference,
    offerAcceptedAt: row.offerAcceptedAt?.toISOString() ?? null,
    offerProductType: row.offerProductType,
    offerRoiPercentPa: num(row.offerRoiPercentPa),
    offerProcessingFee: num(row.offerProcessingFee),
    offerTenureDays: row.offerTenureDays,
    acceptanceState: row.acceptanceState,
    status: row.status,
    duplicateFlag: row.duplicateFlag,
    isNewCustomer,
    lmsUpdatedAt,
    branchManagerStatus: row.branchManagerStatus,
    loanConfirmedAmount: num(row.loanConfirmedAmount),
    loanConfirmedAt: row.loanConfirmedAt?.toISOString() ?? null,
    disbursementAmount: num(row.disbursementAmount),
    disbursementDate: dateOnly(row.disbursementDate),
    productType: row.productType,
    tenure: row.tenure,
    tenureUnit: row.tenureUnit,
    isDemo: row.isDemo,
    sourceCreatedAt: row.sourceCreatedAt?.toISOString() ?? null,
    externalRef: row.externalRef,
    agentRef: row.agentRef,
    gstin: row.gstin,
    branch: row.branchId
      ? { id: row.branchId, name: branches.get(row.branchId)?.name ?? row.branchId, state: branches.get(row.branchId)?.state ?? null }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toActivity(row: ActivityRow): LeadActivity {
  return {
    id: row.id,
    kind: row.kind,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    message: row.message,
    actor: row.actor,
    createdAt: row.createdAt.toISOString(),
  };
}

function toWebhookEvent(row: WebhookEventRow): LeadWebhookEvent {
  return {
    id: row.id,
    statusSent: row.statusSent,
    deliveryStatus: row.deliveryStatus,
    attempts: row.attempts,
    responseCode: row.responseCode,
    errorMessage: row.errorMessage,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

// -----------------------------------------------------------------------------
// Reads
// -----------------------------------------------------------------------------

export async function listLeads(): Promise<Lead[]> {
  const rows = await prisma.lead.findMany({
    include: { partner: true },
    orderBy: { createdAt: "desc" },
    // Defensive cap. The table is still rendered client-side in full (real
    // pagination is a known gap in todo.md), so this bounds the payload rather
    // than letting one page load grow without limit.
    take: 1000,
  });
  const [firsts, lms, branches] = await Promise.all([
    firstLeadIds(rows.map((r) => r.mobile)),
    lmsStatusTimes(rows.map((r) => r.id)),
    fetchBranchNames(),
  ]);
  return rows.map((r) => toLead(r, firsts.has(r.id), lms.get(r.id) ?? null, branches));
}

/**
 * Leads whose LATEST status change came from the LMS (actor "lms"), with when —
 * for the "LMS" tag on the status. A later change by staff clears it.
 */
export async function lmsStatusTimes(leadIds: string[]): Promise<Map<string, string>> {
  if (leadIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ lead_id: string; actor: string | null; created_at: Date }[]>`
    SELECT DISTINCT ON (lead_id) lead_id, actor, created_at FROM lead_activities
    WHERE lead_id = ANY(${leadIds}::text[]) AND kind IN ('STATUS_CHANGED', 'DISBURSEMENT_RECORDED')
    ORDER BY lead_id, created_at DESC`;
  return new Map(rows.filter((r) => r.actor === "lms").map((r) => [r.lead_id, r.created_at.toISOString()]));
}

/** LMS loan events no lead could be matched to yet (staff resolve them on /dashboard/leads/lms-review). */
export function countLmsToMatch(): Promise<number> {
  return prisma.lmsLoanEvent.count({ where: { outcome: { in: ["UNMATCHED", "AMBIGUOUS"] } } });
}

/**
 * The first lead ever for each mobile (earliest created_at, then lowest id —
 * the same rule partner rewards use), across the whole table rather than just
 * the rows on screen.
 *
 * "New customer" stand-in: when the LMS can say who is already a YellowMetal
 * customer, serverx will record its answer on the lead at submission and this is
 * the one place to read it instead.
 */
export async function firstLeadIds(mobiles: string[]): Promise<Set<string>> {
  const unique = Array.from(new Set(mobiles));
  if (unique.length === 0) return new Set();
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT ON (mobile_number) id FROM leads
    WHERE mobile_number = ANY(${unique}::text[])
    ORDER BY mobile_number, created_at, id`;
  return new Set(rows.map((r) => r.id));
}

export async function listPartners(): Promise<LeadPartner[]> {
  const rows = await prisma.partner.findMany({ orderBy: { orgName: "asc" } });
  return rows.map(toPartner);
}

export type LeadDetail = {
  lead: Lead;
  activities: LeadActivity[];
  duplicates: Lead[];
  webhookEvents: LeadWebhookEvent[];
};

export async function getLeadDetail(id: string): Promise<LeadDetail | null> {
    const row = await prisma.lead.findUnique({
    where: { id },
    include: {
      partner: true,
      activities: { orderBy: { createdAt: "asc" } },
      webhookEvents: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!row) return null;

  const duplicateRows = await prisma.lead.findMany({
    where: { mobile: row.mobile, id: { not: row.id } },
    include: { partner: true },
    orderBy: { createdAt: "desc" },
  });

  const [firsts, lms, branches] = await Promise.all([firstLeadIds([row.mobile]), lmsStatusTimes([row.id]), fetchBranchNames()]);
  return {
    lead: toLead(row, firsts.has(row.id), lms.get(row.id) ?? null, branches),
    activities: row.activities.map(toActivity),
    duplicates: duplicateRows.map((d) => toLead(d, firsts.has(d.id))),
    webhookEvents: row.webhookEvents.map(toWebhookEvent),
  };
}

// -----------------------------------------------------------------------------
// Overview stats
// -----------------------------------------------------------------------------

export type OverviewStats = {
  totalLeads: number;
  last30Days: number;
  prior30Days: number;
  newToday: number;
  activePartners: number;
  duplicates: number;
  disbursed: number;
  byStatus: Record<LeadStatus, number>;
  /** Statuses present in the data that this build does not know about. */
  unknownStatuses: { status: string; count: number }[];
  topPartners: { id: string; orgName: string; count: number }[];
};

const DAY_MS = 86_400_000;

function emptyStatusTally(): Record<LeadStatus, number> {
  return Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>;
}

export async function getOverviewStats(now = new Date()): Promise<OverviewStats> {
    const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const since60 = new Date(now.getTime() - 60 * DAY_MS);

  const [
    totalLeads,
    last30Days,
    prior30Days,
    newToday,
    activePartners,
    duplicates,
    disbursed,
    statusGroups,
    partnerGroups,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: since30 } } }),
    prisma.lead.count({ where: { createdAt: { gte: since60, lt: since30 } } }),
    prisma.lead.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.partner.count({ where: { status: "active" } }),
    prisma.lead.count({ where: { duplicateFlag: true } }),
    prisma.lead.count({ where: { status: "DISBURSED" } }),
    prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.lead.groupBy({
      by: ["partnerId"],
      where: { partnerId: { not: null }, createdAt: { gte: since30 } },
      _count: { _all: true },
    }),
  ]);

  const byStatus = emptyStatusTally();
  const unknownStatuses: { status: string; count: number }[] = [];
  for (const g of statusGroups) {
    const known = parseLeadStatus(g.status);
    if (known) byStatus[known] = g._count._all;
    // `status` is a text column so the partner-facing service can add an
    // intermediary status without a migration. Surface rather than drop those.
    else unknownStatuses.push({ status: g.status, count: g._count._all });
  }

  const ranked = partnerGroups
    .filter((g): g is typeof g & { partnerId: string } => g.partnerId !== null)
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 5);
  const partners = await prisma.partner.findMany({
    where: { id: { in: ranked.map((g) => g.partnerId) } },
  });
  const nameById = new Map(partners.map((p) => [p.id, p.orgName]));

  return {
    totalLeads,
    last30Days,
    prior30Days,
    newToday,
    activePartners,
    duplicates,
    disbursed,
    byStatus,
    unknownStatuses,
    topPartners: ranked.map((g) => ({
      id: g.partnerId,
      orgName: nameById.get(g.partnerId) ?? "Unknown partner",
      count: g._count._all,
    })),
  };
}

// -----------------------------------------------------------------------------
// Writes
// -----------------------------------------------------------------------------

export type DisbursementDetails = {
  loanId?: string;
  amount?: number;
  date?: string;
  tenure?: number;
};

export class TerminalStatusError extends Error {
  constructor(from: string) {
    super(`This lead is already ${statusLabel(from)} and cannot be moved again.`);
    this.name = "TerminalStatusError";
  }
}

/**
 * Applies a staff status change.
 *
 * Three writes, ONE transaction:
 *   1. leads.status
 *   2. a lead_activities audit row naming the staff member
 *   3. a lead_status_outbox row
 *
 * serverx drains the outbox and dispatches the AarthikLabs webhook. This is why
 * it is an outbox row and not an HTTP call to serverx:
 *
 *   - An HTTP call cannot be part of this transaction, so the audit row and the
 *     webhook trigger could diverge.
 *   - If serverx is down, an HTTP call either blocks the staff member or loses
 *     the webhook permanently. Outbox rows queue and drain in order on restart.
 *   - serverx's own PATCH endpoint already dispatches fire-and-forget, so a 200
 *     from it would not have told us the webhook fired anyway.
 */
export async function updateLeadStatusRepo(
  id: string,
  status: LeadStatus,
  actor: string,
  disbursement?: DisbursementDetails
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.lead.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    if (current.status === status) return; // no-op: no audit row, no webhook

    const currentKnown = parseLeadStatus(current.status);
    if (currentKnown && isTerminalStatus(currentKnown)) {
      // Reopening a disbursed lead would send AarthikLabs a status regression for
      // a loan that has already paid out.
      throw new TerminalStatusError(current.status);
    }

    await tx.lead.update({
      where: { id },
      data: {
        status,
        ...(disbursement?.loanId ? { loanId: disbursement.loanId } : {}),
        ...(disbursement?.amount !== undefined ? { disbursementAmount: disbursement.amount } : {}),
        ...(disbursement?.date ? { disbursementDate: new Date(disbursement.date) } : {}),
        ...(disbursement?.tenure !== undefined ? { tenure: disbursement.tenure } : {}),
        // Recording a disbursal is also the branch manager confirming the loan.
        ...(status === "DISBURSED" && disbursement?.amount !== undefined
          ? {
              branchManagerStatus: "CONFIRMED" as const,
              loanConfirmedAmount: disbursement.amount,
              loanConfirmedAt: new Date(),
            }
          : {}),
      },
    });

    await tx.leadActivity.create({
      data: {
        leadId: id,
        kind: disbursement?.amount !== undefined ? "DISBURSEMENT_RECORDED" : "STATUS_CHANGED",
        fromStatus: current.status,
        toStatus: status,
        message: `Status changed ${statusLabel(current.status)} → ${statusLabel(status)}`,
        // Previously omitted, so every staff change recorded actor: null while
        // only the automated sweep named itself.
        actor,
      },
    });

    await tx.leadStatusOutbox.create({ data: { leadId: id, status, actor } });
  });
}

// NOTE: `closeStaleLeads` used to live here, called by a daily Vercel cron at
// /api/cron/auto-close-leads. Both are deleted. Lead expiry is now owned solely
// by serverx's LeadLifecycleService, which sweeps hourly against the same table.
// Two expiry jobs over one table would race on the same rows with different
// candidate sets (LEAD_CREATED vs New|Contacted) and each look correct alone.
