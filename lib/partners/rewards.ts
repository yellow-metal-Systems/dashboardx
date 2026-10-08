import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { syncRewards } from "@/lib/server-bridge";

// =============================================================================
// Partner rewards for LeadDesk: grouped by partner, money for admins only.
//
// serverx CALCULATES rewards (RewardService); nothing here creates one. Every
// read takes `admin`: team members get statuses and counts, and their queries
// never select an amount, so money can't reach their pages. Every admin action
// (approve, reject, pay, rule change, revealing bank details) writes the
// append-only reward_audit_log in the same transaction.
// =============================================================================

export const PAYOUT_DAY = 5;
/** Bank details changed this recently must be confirmed with the partner before paying. */
export const RECENT_CHANGE_DAYS = 7;

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86_400_000;

export class RewardError extends Error {}

/** The payout date for a reward approved at `approvedAt`: the 5th of the next month (IST). */
export function payoutDateFor(approvedAt: Date): Date {
  const ist = new Date(approvedAt.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, PAYOUT_DAY) - IST_OFFSET_MS);
}

/** Start of the Indian financial year (1 April, IST) that `now` falls in. */
export function financialYearStart(now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return new Date(Date.UTC(year, 3, 1) - IST_OFFSET_MS);
}

const rupees = (n: number) => Math.round(n * 100) / 100;
const actorOf = (staffEmail: string) => `staff:${staffEmail}`;

export const maskPan = (pan: string) => `${pan.slice(0, 2)}•••••${pan.slice(-3)}`;
export const maskAccount = (n: string) => `•••• ${n.slice(-4)}`;

/** Loose match of the bank-account holder against the partner's name (word overlap). */
export function holderMatches(holder: string, partnerName: string): boolean {
  const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 2));
  const a = words(holder);
  return Array.from(words(partnerName)).some((w) => a.has(w));
}

// --- rules ------------------------------------------------------------------

export type RewardRules = { basePercent: number; bonusPercent: number; bonusThreshold: number };

export async function rewardRulesAt(at: Date): Promise<RewardRules> {
  const r = await prisma.rewardRate.findFirst({ where: { effectiveFrom: { lte: at } }, orderBy: { effectiveFrom: "desc" } });
  if (!r) throw new RewardError("No reward rules are set.");
  return { basePercent: Number(r.basePercent), bonusPercent: Number(r.bonusPercent), bonusThreshold: Number(r.bonusThreshold) };
}

export const currentRewardRules = () => rewardRulesAt(new Date());

/** Every rule change, newest first: who, when, why. */
export async function rewardRulesHistory() {
  const rows = await prisma.rewardRate.findMany({ orderBy: { effectiveFrom: "desc" }, take: 20 });
  return rows.map((r) => ({
    effectiveFrom: r.effectiveFrom,
    basePercent: Number(r.basePercent),
    bonusPercent: Number(r.bonusPercent),
    bonusThreshold: Number(r.bonusThreshold),
    by: r.createdBy,
    reason: r.reason,
  }));
}

/** New rules apply to loans disbursed from now on; earned rewards keep their amount. A reason is required. */
export async function setRewardRules(rules: RewardRules, reasonRaw: string, staffEmail: string) {
  const { basePercent, bonusPercent, bonusThreshold } = rules;
  if (!(basePercent > 0 && basePercent <= 10)) throw new RewardError("The reward must be more than 0% and at most 10% of the loan.");
  if (!(bonusPercent >= 0 && bonusPercent <= 10)) throw new RewardError("The monthly bonus must be between 0% and 10%.");
  if (!(bonusThreshold >= 100_000 && bonusThreshold <= 10_000_000_000)) {
    throw new RewardError("The monthly bonus threshold must be at least ₹1,00,000.");
  }
  const reason = reasonRaw.trim();
  if (reason.length < 5) throw new RewardError("Say why the rules are changing.");
  const before = await currentRewardRules();
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const next = { basePercent: r3(basePercent), bonusPercent: r3(bonusPercent), bonusThreshold: rupees(bonusThreshold) };
  if (before.basePercent === next.basePercent && before.bonusPercent === next.bonusPercent && before.bonusThreshold === next.bonusThreshold) {
    throw new RewardError("Nothing changed.");
  }
  await prisma.$transaction([
    prisma.rewardRate.create({
      data: { ...next, effectiveFrom: new Date(), createdBy: actorOf(staffEmail), reason: reason.slice(0, 300) },
    }),
    prisma.rewardAuditLog.create({
      data: { action: "RULES_CHANGED", actor: actorOf(staffEmail), details: { before, after: next, reason } },
    }),
  ]);
}

// --- reads ------------------------------------------------------------------

export const REWARD_STATUSES = ["PENDING", "APPROVED", "PAID", "REJECTED"] as const;
export type RewardState = (typeof REWARD_STATUSES)[number];

type Counts = Record<RewardState, number>;
const zeroCounts = (): Counts => ({ PENDING: 0, APPROVED: 0, PAID: 0, REJECTED: 0 });

export type PartnerRewardRow = {
  id: string;
  orgName: string;
  type: "INDIVIDUAL" | "ORGANISATION";
  counts: Counts;
  /** Admins only. */
  money?: { toApprove: number; owed: number; paidThisFy: number };
  flags?: { noPayoutDetails: boolean; detailsChangedRecently: boolean; nameMismatch: boolean };
};

/** The latest saved bank details per partner (history), for the "changed recently" flag. */
async function detailsHistory(partnerIds: string[]) {
  const rows = await prisma.partnerPayoutDetailsHistory.findMany({
    where: { partnerId: { in: partnerIds } },
    orderBy: { savedAt: "desc" },
    select: { partnerId: true, savedAt: true },
  });
  const byPartner = new Map<string, Date[]>();
  for (const r of rows) byPartner.set(r.partnerId, [...(byPartner.get(r.partnerId) ?? []), r.savedAt]);
  return byPartner;
}

const changedRecently = (saves: Date[] | undefined, now: Date) =>
  !!saves && saves.length > 1 && now.getTime() - saves[0]!.getTime() < RECENT_CHANGE_DAYS * DAY_MS;

/**
 * Partners that have rewards, with counts by status; admins also get the money
 * and the flags. Asks serverx to create anything due first.
 */
export async function listRewardPartners(admin: boolean, now = new Date()) {
  const synced = await syncRewards();
  const partners = await prisma.partner.findMany({
    where: { rewards: { some: {} } },
    orderBy: { orgName: "asc" },
    select: {
      id: true,
      orgName: true,
      type: true,
      ...(admin ? { payoutDetails: { select: { accountHolder: true } } } : {}),
    },
  });
  const ids = partners.map((p) => p.id);
  const grouped = await prisma.partnerReward.groupBy({
    by: ["partnerId", "status"],
    where: { partnerId: { in: ids } },
    _count: { _all: true },
  });

  let money = new Map<string, NonNullable<PartnerRewardRow["money"]>>();
  let history = new Map<string, Date[]>();
  if (admin) {
    const fyStart = financialYearStart(now);
    const [sums, paid] = await Promise.all([
      prisma.partnerReward.groupBy({
        by: ["partnerId", "status"],
        where: { partnerId: { in: ids }, status: { in: ["PENDING", "APPROVED"] } },
        _sum: { amount: true },
      }),
      prisma.partnerReward.findMany({
        where: { partnerId: { in: ids }, status: "PAID", paidAt: { gte: fyStart } },
        select: { partnerId: true, amount: true, tdsAmount: true },
      }),
    ]);
    money = new Map(ids.map((id) => [id, { toApprove: 0, owed: 0, paidThisFy: 0 }]));
    for (const s of sums) {
      const m = money.get(s.partnerId)!;
      if (s.status === "PENDING") m.toApprove = Number(s._sum.amount ?? 0);
      if (s.status === "APPROVED") m.owed = Number(s._sum.amount ?? 0);
    }
    for (const p of paid) money.get(p.partnerId)!.paidThisFy += Number(p.amount) - Number(p.tdsAmount ?? 0);
    history = await detailsHistory(ids);
  }

  const rows: PartnerRewardRow[] = partners.map((p) => {
    const counts = zeroCounts();
    for (const g of grouped) if (g.partnerId === p.id) counts[g.status as RewardState] = g._count._all;
    const row: PartnerRewardRow = { id: p.id, orgName: p.orgName, type: p.type, counts };
    if (admin) {
      const holder = (p as { payoutDetails?: { accountHolder: string } | null }).payoutDetails?.accountHolder;
      row.money = { ...money.get(p.id)!, paidThisFy: rupees(money.get(p.id)!.paidThisFy) };
      row.flags = {
        noPayoutDetails: !holder,
        detailsChangedRecently: changedRecently(history.get(p.id), now),
        nameMismatch: !!holder && !holderMatches(holder, p.orgName),
      };
    }
    return row;
  });

  const totals = admin
    ? {
        toApprove: rupees(rows.reduce((n, r) => n + r.money!.toApprove, 0)),
        owed: rupees(rows.reduce((n, r) => n + r.money!.owed, 0)),
        paidThisFy: rupees(rows.reduce((n, r) => n + r.money!.paidThisFy, 0)),
      }
    : null;
  return { rows, totals, awaiting: synced?.awaiting ?? [] };
}

/** A reward as a statement shows it. The money fields are present for admins only. */
export type StatementReward = {
  id: string;
  kind: "LOAN" | "MONTHLY_BONUS";
  status: RewardState;
  periodMonth: Date | null;
  disbursedAt: Date;
  approvedAt: Date | null;
  paidAt: Date | null;
  rejectedReason: string | null;
  approvedBy?: string | null;
  paidBy?: string | null;
  paymentRef?: string | null;
  rejectedBy?: string | null;
  amount?: Prisma.Decimal;
  baseAmount?: Prisma.Decimal;
  percent?: Prisma.Decimal;
  tdsAmount?: Prisma.Decimal | null;
};

export type StatementLead = {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  disbursementDate: Date | null;
  /** Admins only. */
  disbursementAmount?: Prisma.Decimal | null;
  reward: StatementReward | null;
};

/** One partner's statement: every lead they sent with its reward, their monthly bonuses, and (admins) payee + audit log. */
export async function getPartnerRewardStatement(partnerId: string, admin: boolean, now = new Date()) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, orgName: true, type: true, status: true },
  });
  if (!partner) return null;
  await syncRewards(partnerId);

  const rewardSelect = admin
    ? {
        id: true, kind: true, status: true, periodMonth: true, disbursedAt: true, approvedAt: true, approvedBy: true,
        paidAt: true, paidBy: true, paymentRef: true, rejectedReason: true, rejectedBy: true,
        amount: true, baseAmount: true, percent: true, tdsAmount: true,
      }
    : { id: true, kind: true, status: true, periodMonth: true, disbursedAt: true, approvedAt: true, paidAt: true, rejectedReason: true };

  const [leads, bonuses] = await Promise.all([
    prisma.lead.findMany({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true, name: true, status: true, createdAt: true, disbursementDate: true,
        ...(admin ? { disbursementAmount: true } : {}),
        reward: { select: rewardSelect },
      },
    }),
    prisma.partnerReward.findMany({ where: { partnerId, kind: "MONTHLY_BONUS" }, orderBy: { periodMonth: "desc" }, select: rewardSelect }),
  ]);

  let payee: null | {
    pan: string; accountHolder: string; account: string; ifsc: string; savedAt: Date | null; changedRecently: boolean; nameMismatch: boolean;
  } = null;
  let audit: { id: string; action: string; actor: string; at: Date; rewardId: string | null; details: unknown }[] = [];
  if (admin) {
    const [d, hist, log] = await Promise.all([
      prisma.partnerPayoutDetails.findUnique({ where: { partnerId } }),
      detailsHistory([partnerId]),
      prisma.rewardAuditLog.findMany({ where: { partnerId }, orderBy: { at: "desc" }, take: 50 }),
    ]);
    if (d) {
      const saves = hist.get(partnerId);
      payee = {
        pan: maskPan(d.pan),
        accountHolder: d.accountHolder,
        account: maskAccount(d.accountNumber),
        ifsc: d.ifsc,
        savedAt: saves?.[0] ?? d.updatedAt,
        changedRecently: changedRecently(saves, now),
        nameMismatch: !holderMatches(d.accountHolder, partner.orgName),
      };
    }
    audit = log.map((l) => ({ id: l.id, action: l.action, actor: l.actor, at: l.at, rewardId: l.rewardId, details: l.details }));
  }
  return {
    partner,
    admin,
    leads: leads as unknown as StatementLead[],
    bonuses: bonuses as unknown as StatementReward[],
    payee,
    audit,
  };
}

// --- admin actions ----------------------------------------------------------

export async function approveReward(rewardId: string, staffEmail: string) {
  await prisma.$transaction(async (tx) => {
    const res = await tx.partnerReward.updateMany({
      where: { id: rewardId, status: "PENDING" },
      data: { status: "APPROVED", approvedAt: new Date(), approvedBy: actorOf(staffEmail) },
    });
    if (res.count !== 1) throw new RewardError("Only a pending reward can be approved. Reload and try again.");
    const r = await tx.partnerReward.findUniqueOrThrow({ where: { id: rewardId }, select: { partnerId: true, amount: true } });
    await tx.rewardAuditLog.create({
      data: { partnerId: r.partnerId, rewardId, action: "APPROVED", actor: actorOf(staffEmail), details: { amount: r.amount.toString() } },
    });
  });
}

export async function rejectReward(rewardId: string, reasonRaw: string, staffEmail: string) {
  const reason = reasonRaw.trim();
  if (reason.length < 3) throw new RewardError("Give a short reason the partner can understand.");
  await prisma.$transaction(async (tx) => {
    const before = await tx.partnerReward.findUnique({ where: { id: rewardId }, select: { status: true, partnerId: true } });
    const res = await tx.partnerReward.updateMany({
      where: { id: rewardId, status: { in: ["PENDING", "APPROVED"] } },
      data: { status: "REJECTED", rejectedAt: new Date(), rejectedReason: reason.slice(0, 300), rejectedBy: actorOf(staffEmail) },
    });
    if (res.count !== 1 || !before) throw new RewardError("A paid or already rejected reward can't be rejected.");
    await tx.rewardAuditLog.create({
      data: { partnerId: before.partnerId, rewardId, action: "REJECTED", actor: actorOf(staffEmail), details: { was: before.status, reason } },
    });
  });
}

/**
 * Records a payment. Stores which bank details it went to (a history row —
 * snapshotting the current details if they predate the history), refuses a UTR
 * already used for another partner, and needs an explicit confirmation when the
 * partner changed their bank details in the last RECENT_CHANGE_DAYS days.
 */
export async function markRewardPaid(
  rewardId: string,
  input: { paymentRef: string; tds: number; confirmedNewAccount?: boolean },
  staffEmail: string,
  now = new Date()
) {
  const paymentRef = input.paymentRef.trim();
  if (!paymentRef || paymentRef.length > 100) throw new RewardError("Enter the payment reference (UTR or transfer id).");
  const reward = await prisma.partnerReward.findUnique({
    where: { id: rewardId },
    include: { partner: { select: { payoutDetails: true } } },
  });
  if (!reward) throw new RewardError("Reward not found.");
  if (reward.status !== "APPROVED") throw new RewardError("Approve the reward before marking it paid.");
  const current = reward.partner.payoutDetails;
  if (!current) throw new RewardError("The partner hasn't added PAN and bank details yet.");
  if (!Number.isFinite(input.tds) || input.tds < 0 || input.tds >= Number(reward.amount)) {
    throw new RewardError("TDS must be zero or more, and less than the reward.");
  }
  const reused = await prisma.partnerReward.findFirst({
    where: { paymentRef, partnerId: { not: reward.partnerId } },
    select: { id: true },
  });
  if (reused) throw new RewardError("That payment reference is already recorded for another partner.");

  const saves = (await detailsHistory([reward.partnerId])).get(reward.partnerId);
  if (changedRecently(saves, now) && !input.confirmedNewAccount) {
    throw new RewardError(
      `The partner changed their bank details in the last ${RECENT_CHANGE_DAYS} days. Confirm the new account with them, then tick the box.`
    );
  }

  const tds = rupees(input.tds);
  await prisma.$transaction(async (tx) => {
    const latest = await tx.partnerPayoutDetailsHistory.findFirst({
      where: { partnerId: reward.partnerId },
      orderBy: { savedAt: "desc" },
    });
    const same =
      latest &&
      latest.pan === current.pan &&
      latest.accountNumber === current.accountNumber &&
      latest.ifsc === current.ifsc &&
      latest.accountHolder === current.accountHolder;
    const paidTo = same
      ? latest
      : await tx.partnerPayoutDetailsHistory.create({
          data: {
            partnerId: reward.partnerId,
            pan: current.pan,
            accountHolder: current.accountHolder,
            accountNumber: current.accountNumber,
            ifsc: current.ifsc,
            savedBy: `${actorOf(staffEmail)} (snapshot at payment)`,
          },
        });
    const res = await tx.partnerReward.updateMany({
      where: { id: rewardId, status: "APPROVED" },
      data: { status: "PAID", paidAt: now, paidBy: actorOf(staffEmail), paymentRef, tdsAmount: tds, paidDetailsId: paidTo.id },
    });
    if (res.count !== 1) throw new RewardError("Someone else just changed this reward. Reload and try again.");
    await tx.rewardAuditLog.create({
      data: {
        partnerId: reward.partnerId,
        rewardId,
        action: "PAID",
        actor: actorOf(staffEmail),
        details: {
          paymentRef,
          gross: reward.amount.toString(),
          tds,
          net: rupees(Number(reward.amount) - tds),
          paidTo: maskAccount(paidTo.accountNumber),
          confirmedNewAccount: !!input.confirmedNewAccount,
        } as Prisma.InputJsonValue,
      },
    });
  });
}

/** The full PAN and account number, for an admin about to pay. Logged. */
export async function revealPayoutDetails(partnerId: string, staffEmail: string) {
  const d = await prisma.partnerPayoutDetails.findUnique({ where: { partnerId } });
  if (!d) throw new RewardError("The partner hasn't added PAN and bank details yet.");
  await prisma.rewardAuditLog.create({ data: { partnerId, action: "DETAILS_REVEALED", actor: actorOf(staffEmail) } });
  return { pan: d.pan, accountHolder: d.accountHolder, accountNumber: d.accountNumber, ifsc: d.ifsc };
}
