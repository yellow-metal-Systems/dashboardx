import type {
  Lead as LeadRow,
  LeadActivity as ActivityRow,
  Partner as PartnerRow,
} from "@prisma/client";

import { prisma } from "./prisma";
import {
  LEAD_STATUSES,
  duplicatesOf,
  type Lead,
  type LeadActivity,
  type LeadPartner,
  type LeadStatus,
  type PartnerSummary,
} from "./leads";
import { demoPartnerSummaries, demoStore, demoUpdateStatus, PARTNER_SEEDS } from "./demo-store";
import { workingDaysSince } from "./working-days";

// Demo mode serves in-memory example data with no database — used explicitly
// via LEADDESK_DEMO=1, or automatically whenever DATABASE_URL isn't set (e.g.
// a frontend-only deploy that hasn't been wired to Postgres yet).
export function isDemoMode(): boolean {
  return process.env.LEADDESK_DEMO?.trim() === "1" || !process.env.DATABASE_URL?.trim();
}

type LeadWithPartner = LeadRow & { partner: PartnerRow | null };

function num(value: { toNumber(): number } | null): number | null {
  return value === null ? null : value.toNumber();
}

function toPartner(row: PartnerRow): LeadPartner {
  return { id: row.id, orgName: row.orgName, contactEmail: row.contactEmail };
}

export function toLead(row: LeadWithPartner): Lead {
  return {
    id: row.id,
    leadNo: row.leadNo,
    source: row.source,
    partner: row.partner ? toPartner(row.partner) : null,
    name: row.name,
    mobile: row.mobile,
    address: row.address,
    pinCode: row.pinCode,
    loanAmount: num(row.loanAmount),
    dob: row.dob?.toISOString() ?? null,
    goldGrams: num(row.goldGrams),
    offerAmount: num(row.offerAmount),
    ltvPercent: num(row.ltvPercent),
    kfsReference: row.kfsReference,
    acceptanceState: row.acceptanceState,
    status: row.status,
    duplicateFlag: row.duplicateFlag,
    branchManagerStatus: row.branchManagerStatus,
    loanConfirmedAmount: num(row.loanConfirmedAmount),
    loanConfirmedAt: row.loanConfirmedAt?.toISOString() ?? null,
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

export async function listLeads(): Promise<Lead[]> {
  if (isDemoMode()) {
    return [...demoStore().leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const rows = await prisma.lead.findMany({
    include: { partner: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toLead);
}

export async function listPartners(): Promise<LeadPartner[]> {
  if (isDemoMode()) {
    return PARTNER_SEEDS.map((p) => ({
      id: p.id,
      orgName: p.orgName,
      contactEmail: p.contactEmail,
    })).sort((a, b) => a.orgName.localeCompare(b.orgName));
  }
  const rows = await prisma.partner.findMany({ orderBy: { orgName: "asc" } });
  return rows.map(toPartner);
}

export type LeadDetail = {
  lead: Lead;
  activities: LeadActivity[];
  duplicates: Lead[];
};

export async function getLeadDetail(id: string): Promise<LeadDetail | null> {
  if (isDemoMode()) {
    const store = demoStore();
    const lead = store.leads.find((l) => l.id === id);
    if (!lead) return null;
    return {
      lead,
      activities: store.activities.get(id) ?? [],
      duplicates: duplicatesOf(lead, store.leads),
    };
  }

  const row = await prisma.lead.findUnique({
    where: { id },
    include: {
      partner: true,
      activities: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) return null;

  const duplicateRows = await prisma.lead.findMany({
    where: { mobile: row.mobile, id: { not: row.id } },
    include: { partner: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    lead: toLead(row),
    activities: row.activities.map(toActivity),
    duplicates: duplicateRows.map(toLead),
  };
}

export async function listPartnerSummaries(): Promise<PartnerSummary[]> {
  if (isDemoMode()) {
    return demoPartnerSummaries().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const rows = await prisma.partner.findMany({
    include: { _count: { select: { leads: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    ...toPartner(r),
    status: r.status,
    leadCount: r._count.leads,
    createdAt: r.createdAt.toISOString(),
  }));
}

export type OverviewStats = {
  totalLeads: number;
  last30Days: number;
  prior30Days: number;
  newToday: number;
  activePartners: number;
  duplicates: number;
  converted: number;
  byStatus: Record<LeadStatus, number>;
  topPartners: { id: string; orgName: string; count: number }[];
};

const DAY_MS = 86_400_000;

function computeOverviewFromLeads(
  leads: Lead[],
  partners: { id: string; orgName: string; status: string }[],
  now: Date
): OverviewStats {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const since60 = new Date(now.getTime() - 60 * DAY_MS);

  const byStatus = Object.fromEntries(
    LEAD_STATUSES.map((s) => [s, 0])
  ) as Record<LeadStatus, number>;
  for (const l of leads) byStatus[l.status]++;

  const last30 = leads.filter((l) => new Date(l.createdAt) >= since30);
  const prior30 = leads.filter((l) => {
    const d = new Date(l.createdAt);
    return d >= since60 && d < since30;
  });

  const countsByPartner = new Map<string, number>();
  for (const l of last30) {
    if (!l.partner) continue;
    countsByPartner.set(l.partner.id, (countsByPartner.get(l.partner.id) ?? 0) + 1);
  }
  const nameById = new Map(partners.map((p) => [p.id, p.orgName]));
  const topPartners = Array.from(countsByPartner.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ id, orgName: nameById.get(id) ?? "Unknown partner", count }));

  return {
    totalLeads: leads.length,
    last30Days: last30.length,
    prior30Days: prior30.length,
    newToday: leads.filter((l) => new Date(l.createdAt) >= startOfToday).length,
    activePartners: partners.filter((p) => p.status === "active").length,
    duplicates: leads.filter((l) => l.duplicateFlag).length,
    converted: leads.filter((l) => l.status === "Converted").length,
    byStatus,
    topPartners,
  };
}

export async function getOverviewStats(now = new Date()): Promise<OverviewStats> {
  if (isDemoMode()) {
    return computeOverviewFromLeads(demoStore().leads, PARTNER_SEEDS, now);
  }

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
    converted,
    statusGroups,
    partnerGroups,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: since30 } } }),
    prisma.lead.count({ where: { createdAt: { gte: since60, lt: since30 } } }),
    prisma.lead.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.partner.count({ where: { status: "active" } }),
    prisma.lead.count({ where: { duplicateFlag: true } }),
    prisma.lead.count({ where: { status: "Converted" } }),
    prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.lead.groupBy({
      by: ["partnerId"],
      where: { partnerId: { not: null }, createdAt: { gte: since30 } },
      _count: { _all: true },
    }),
  ]);

  const byStatus = Object.fromEntries(
    LEAD_STATUSES.map((s) => [s, 0])
  ) as Record<LeadStatus, number>;
  for (const g of statusGroups) byStatus[g.status] = g._count._all;

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
    converted,
    byStatus,
    topPartners: ranked.map((g) => ({
      id: g.partnerId,
      orgName: nameById.get(g.partnerId) ?? "Unknown partner",
      count: g._count._all,
    })),
  };
}

export async function updateLeadStatusRepo(id: string, status: LeadStatus): Promise<void> {
  if (isDemoMode()) {
    demoUpdateStatus(id, status);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.lead.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    if (current.status === status) return;

    await tx.lead.update({ where: { id }, data: { status } });
    await tx.leadActivity.create({
      data: {
        leadId: id,
        kind: "STATUS_CHANGED",
        fromStatus: current.status,
        toStatus: status,
        message: `Status changed ${current.status} → ${status}`,
      },
    });
  });
}

const LEAD_TIMEOUT_WORKING_DAYS = 7;

// Closes (rejects) leads that have sat in New or Contacted for 7 working
// days without reaching Converted. Called on a schedule from the
// /api/cron/auto-close-leads route, not from any user-facing action.
export async function closeStaleLeads(): Promise<string[]> {
  if (isDemoMode()) return [];

  const candidates = await prisma.lead.findMany({
    where: { status: { in: ["New", "Contacted"] } },
    select: { id: true, status: true, createdAt: true },
    take: 500, // defensive cap — no real pagination need expected at current volume
  });

  const closedIds: string[] = [];
  for (const lead of candidates) {
    if (workingDaysSince(lead.createdAt) < LEAD_TIMEOUT_WORKING_DAYS) continue;

    await prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id: lead.id }, data: { status: "Rejected" } });
      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          kind: "STATUS_CHANGED",
          fromStatus: lead.status,
          toStatus: "Rejected",
          message: `Auto-closed — no action within ${LEAD_TIMEOUT_WORKING_DAYS} working days`,
          actor: "system:lead-timeout",
        },
      });
    });
    closedIds.push(lead.id);
  }

  return closedIds;
}
