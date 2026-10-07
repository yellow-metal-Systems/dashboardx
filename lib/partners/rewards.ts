import { prisma } from "@/lib/prisma";
import { syncRewards } from "@/lib/server-bridge";

// =============================================================================
// Partner rewards for LeadDesk staff: review, approve, reject, record payment,
// and the reward rules (1% of each disbursed loan, 0.25% of a month above
// Rs 2 crore). serverx CALCULATES rewards (RewardService); nothing here creates
// one. Paying needs the partner's PAN + bank details; approved rewards are paid
// on the 5th of the next month.
// Moved from LeadBridge (lib/rewards.ts) when the staff screens moved into LeadDesk.
// =============================================================================

export const PAYOUT_DAY = 5;

const IST_OFFSET_MS = 330 * 60 * 1000;

export class RewardError extends Error {}

/** The payout date for a reward approved at `approvedAt`: the 5th of the next month (IST). */
export function payoutDateFor(approvedAt: Date): Date {
  const ist = new Date(approvedAt.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, PAYOUT_DAY) - IST_OFFSET_MS);
}

const rupees = (n: number) => Math.round(n * 100) / 100;

export type RewardRules = { basePercent: number; bonusPercent: number; bonusThreshold: number };

export async function rewardRulesAt(at: Date): Promise<RewardRules> {
  const r = await prisma.rewardRate.findFirst({ where: { effectiveFrom: { lte: at } }, orderBy: { effectiveFrom: "desc" } });
  if (!r) throw new RewardError("No reward rules are set.");
  return { basePercent: Number(r.basePercent), bonusPercent: Number(r.bonusPercent), bonusThreshold: Number(r.bonusThreshold) };
}

export const currentRewardRules = () => rewardRulesAt(new Date());

/** New rules apply to loans disbursed from now on; earned rewards keep their amount. */
export async function setRewardRules(rules: RewardRules, staffEmail: string) {
  const { basePercent, bonusPercent, bonusThreshold } = rules;
  if (!(basePercent > 0 && basePercent <= 10)) throw new RewardError("The reward must be more than 0% and at most 10% of the loan.");
  if (!(bonusPercent >= 0 && bonusPercent <= 10)) throw new RewardError("The monthly bonus must be between 0% and 10%.");
  if (!(bonusThreshold >= 100_000 && bonusThreshold <= 10_000_000_000)) {
    throw new RewardError("The monthly bonus threshold must be at least ₹1,00,000.");
  }
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  await prisma.rewardRate.create({
    data: {
      basePercent: r3(basePercent),
      bonusPercent: r3(bonusPercent),
      bonusThreshold: rupees(bonusThreshold),
      effectiveFrom: new Date(),
      createdBy: `staff:${staffEmail}`,
    },
  });
}

export const REWARD_STATUSES = ["PENDING", "APPROVED", "PAID", "REJECTED"] as const;

export type RewardState = (typeof REWARD_STATUSES)[number];

/**
 * Rewards in one status, plus counts and totals for every status. serverx
 * creates rewards (it is the only place they are calculated); this asks it to
 * create any that are due first, so a disbursal shows here straight away.
 */
export async function listRewardsForStaff(status: RewardState) {
  const synced = await syncRewards();
  const [rows, counts] = await Promise.all([
    prisma.partnerReward.findMany({
      where: { status },
      orderBy: { disbursedAt: "asc" },
      include: {
        lead: { select: { id: true, name: true } },
        partner: { select: { id: true, orgName: true, payoutDetails: true } },
      },
    }),
    prisma.partnerReward.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amount: true } }),
  ]);
  const summary = Object.fromEntries(
    REWARD_STATUSES.map((s) => {
      const g = counts.find((c) => c.status === s);
      return [s, { count: g?._count._all ?? 0, total: Number(g?._sum.amount ?? 0) }];
    })
  ) as Record<RewardState, { count: number; total: number }>;
  return { rows, summary, awaiting: synced?.awaiting ?? [] };
}

export async function approveReward(rewardId: string, staffEmail: string) {
  const res = await prisma.partnerReward.updateMany({
    where: { id: rewardId, status: "PENDING" },
    data: { status: "APPROVED", approvedAt: new Date(), approvedBy: `staff:${staffEmail}` },
  });
  if (res.count !== 1) throw new RewardError("Only a pending reward can be approved. Reload and try again.");
}

export async function rejectReward(rewardId: string, reasonRaw: string, staffEmail: string) {
  const reason = reasonRaw.trim();
  if (reason.length < 3) throw new RewardError("Give a short reason the partner can understand.");
  const res = await prisma.partnerReward.updateMany({
    where: { id: rewardId, status: { in: ["PENDING", "APPROVED"] } },
    data: { status: "REJECTED", rejectedAt: new Date(), rejectedReason: reason.slice(0, 300), approvedBy: `staff:${staffEmail}` },
  });
  if (res.count !== 1) throw new RewardError("A paid or already rejected reward can't be rejected.");
}

export async function markRewardPaid(rewardId: string, input: { paymentRef: string; tds: number }, staffEmail: string) {
  const paymentRef = input.paymentRef.trim();
  if (!paymentRef || paymentRef.length > 100) throw new RewardError("Enter the payment reference (UTR or transfer id).");
  const reward = await prisma.partnerReward.findUnique({
    where: { id: rewardId },
    include: { partner: { select: { payoutDetails: { select: { partnerId: true } } } } },
  });
  if (!reward) throw new RewardError("Reward not found.");
  if (reward.status !== "APPROVED") throw new RewardError("Approve the reward before marking it paid.");
  if (!reward.partner.payoutDetails) throw new RewardError("The partner hasn't added PAN and bank details yet.");
  if (!Number.isFinite(input.tds) || input.tds < 0 || input.tds >= Number(reward.amount)) {
    throw new RewardError("TDS must be zero or more, and less than the reward.");
  }
  const res = await prisma.partnerReward.updateMany({
    where: { id: rewardId, status: "APPROVED" },
    data: { status: "PAID", paidAt: new Date(), paidBy: `staff:${staffEmail}`, paymentRef, tdsAmount: input.tds },
  });
  if (res.count !== 1) throw new RewardError("Someone else just changed this reward. Reload and try again.");
}
