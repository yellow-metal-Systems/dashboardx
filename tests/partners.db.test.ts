import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { prisma } from "@/lib/prisma";
import { ApiKeyError, createApiKey, hashApiKey, listApiKeys, revokeApiKey } from "@/lib/partners/api-keys";
import {
  PartnerAccountError,
  hashInviteToken,
  listPartners,
  onboardPartner,
  resendInvite,
  setPartnerEnabled,
} from "@/lib/partners/onboarding";
import {
  RewardError,
  approveReward,
  currentRewardRules,
  listRewardsForStaff,
  markRewardPaid,
  payoutDateFor,
  rejectReward,
  setRewardRules,
} from "@/lib/partners/rewards";

// Partner onboarding, API keys and reward handling — the staff side, moved here
// from LeadBridge along with its tests. Rewards are CREATED by serverx; these
// tests insert reward rows directly and check what staff can do with them.
// SKIPS without TEST_DATABASE_URL: a throwaway Postgres migrated by serverx.
const db = process.env.TEST_DATABASE_URL?.trim() ? describe : describe.skip;

db("partners and rewards (database)", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE lead_status_outbox, webhook_events, lead_activities, leads, partner_rewards, partner_payout_details,
        reward_rates, partner_api_keys, partner_invites, partner_users, partners, admin_users
      RESTART IDENTITY CASCADE`);
    await prisma.rewardRate.create({
      data: { id: "initial", basePercent: 1, bonusPercent: 0.25, bonusThreshold: 20_000_000, effectiveFrom: new Date("2000-01-01T00:00:00Z") },
    });
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const individual = (mobile = "+91 98111 11111") =>
    onboardPartner({
      orgName: "",
      type: "INDIVIDUAL",
      isOndc: false,
      contactEmail: "Priya@Example.com",
      personName: "Priya Sharma",
      mobile,
      staffEmail: "asha@yellowmetal.example",
    });

  it("onboards an individual named after the person, as invited, storing only the invite's hash", async () => {
    const { partnerId, partnerUserId, token } = await individual();
    const p = await prisma.partner.findUniqueOrThrow({ where: { id: partnerId }, include: { users: true } });
    expect(p).toMatchObject({ orgName: "Priya Sharma", contactEmail: "priya@example.com", contactMobile: "9811111111", status: "invited" });
    expect(p.users.map((u) => [u.mobile, u.status])).toEqual([["9811111111", "invited"]]);
    const invite = await prisma.partnerInvite.findFirstOrThrow({ where: { partnerUserId } });
    expect(invite.tokenHash).toBe(hashInviteToken(token));
    expect(JSON.stringify(invite)).not.toContain(token);
    expect(invite.createdBy).toBe("asha@yellowmetal.example");
    expect((await listPartners()).map((x) => x.orgName)).toEqual(["Priya Sharma"]);
  });

  it("refuses a mobile that already has a login, or isn't a valid mobile", async () => {
    await individual();
    await expect(individual("9811111111")).rejects.toBeInstanceOf(PartnerAccountError);
    await expect(individual("12345")).rejects.toThrow(/valid 10-digit/);
  });

  it("a new invite link retires the old unused one; none for a turned-off partner", async () => {
    const { partnerId, partnerUserId, token } = await individual();
    const fresh = await resendInvite(partnerUserId, "asha@y.co");
    expect(fresh).not.toBe(token);
    expect((await prisma.partnerInvite.findMany({ where: { partnerUserId } })).map((i) => i.tokenHash)).toEqual([hashInviteToken(fresh)]);
    await setPartnerEnabled(partnerId, false);
    await expect(resendInvite(partnerUserId, "asha@y.co")).rejects.toThrow(/Turn the partner back on/);
  });

  it("turning a partner off disables its logins; on again restores active or invited", async () => {
    const { partnerId, partnerUserId } = await individual();
    await prisma.partnerUser.update({ where: { id: partnerUserId }, data: { passwordHash: "scrypt$x", status: "active" } });
    await setPartnerEnabled(partnerId, false);
    expect((await prisma.partnerUser.findUniqueOrThrow({ where: { id: partnerUserId } })).status).toBe("disabled");
    await setPartnerEnabled(partnerId, true);
    expect((await prisma.partner.findUniqueOrThrow({ where: { id: partnerId } })).status).toBe("active");
    expect((await prisma.partnerUser.findUniqueOrThrow({ where: { id: partnerUserId } })).status).toBe("active");
  });

  it("issues API keys as lb_<prefix>_<secret>, stores only the hash, and revokes them", async () => {
    const { partnerId } = await individual();
    const { key } = await createApiKey(partnerId, "Production", "asha@y.co");
    expect(key).toMatch(/^lb_[\w-]{8}_[\w-]{32}$/);
    const row = (await listApiKeys(partnerId))[0]!;
    expect(row.label).toBe("Production");
    const stored = await prisma.partnerApiKey.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.keyHash).toBe(hashApiKey(key));
    expect(JSON.stringify(stored)).not.toContain(key.slice(12));
    await revokeApiKey(row.id);
    expect((await listApiKeys(partnerId))[0]!.revokedAt).not.toBeNull();
    await expect(createApiKey(partnerId, "  ", null)).rejects.toBeInstanceOf(ApiKeyError);
    await setPartnerEnabled(partnerId, false);
    await expect(createApiKey(partnerId, "Second", null)).rejects.toThrow(/Turn the partner back on/);
  });

  async function reward(partnerId: string, amount = 2000) {
    return prisma.partnerReward.create({
      data: { kind: "LOAN", partnerId, baseAmount: amount * 100, percent: 1, amount, disbursedAt: new Date() },
    });
  }

  it("rewards go Pending → Approved → Paid; paying needs PAN and bank details and a reference", async () => {
    const { partnerId } = await individual();
    const r = await reward(partnerId);
    await expect(markRewardPaid(r.id, { paymentRef: "UTR1", tds: 0 }, "s@y.co")).rejects.toThrow(/Approve the reward/);
    await approveReward(r.id, "s@y.co");
    await expect(approveReward(r.id, "s@y.co")).rejects.toBeInstanceOf(RewardError);
    await expect(markRewardPaid(r.id, { paymentRef: "UTR1", tds: 0 }, "s@y.co")).rejects.toThrow(/PAN and bank/);
    await prisma.partnerPayoutDetails.create({
      data: { partnerId, pan: "ABCPE1234F", accountHolder: "Priya Sharma", accountNumber: "123456789012", ifsc: "HDFC0001234" },
    });
    await expect(markRewardPaid(r.id, { paymentRef: "", tds: 0 }, "s@y.co")).rejects.toThrow(/payment reference/);
    await expect(markRewardPaid(r.id, { paymentRef: "UTR1", tds: 2000 }, "s@y.co")).rejects.toThrow(/TDS/);
    await markRewardPaid(r.id, { paymentRef: "UTR1", tds: 100 }, "s@y.co");
    const paid = await prisma.partnerReward.findUniqueOrThrow({ where: { id: r.id } });
    expect([paid.status, paid.paymentRef, Number(paid.tdsAmount), paid.paidBy]).toEqual(["PAID", "UTR1", 100, "staff:s@y.co"]);
    await expect(rejectReward(r.id, "too late", "s@y.co")).rejects.toBeInstanceOf(RewardError);
  });

  it("rejects an unpaid reward with a reason, and lists rewards by status with totals", async () => {
    const { partnerId } = await individual();
    const a = await reward(partnerId, 2000);
    const b = await reward(partnerId, 1500);
    await expect(rejectReward(a.id, "", "s@y.co")).rejects.toThrow(/reason/);
    await rejectReward(a.id, "Loan cancelled by the branch", "s@y.co");
    const { rows, summary, awaiting } = await listRewardsForStaff("PENDING");
    expect(rows.map((r) => r.id)).toEqual([b.id]);
    expect(summary.PENDING).toEqual({ count: 1, total: 1500 });
    expect(summary.REJECTED).toEqual({ count: 1, total: 2000 });
    expect(awaiting).toEqual([]); // serverx isn't reachable in tests
  });

  it("changes the reward rules for future disbursals only, with sane limits", async () => {
    expect(await currentRewardRules()).toEqual({ basePercent: 1, bonusPercent: 0.25, bonusThreshold: 20_000_000 });
    await setRewardRules({ basePercent: 1.25, bonusPercent: 0.5, bonusThreshold: 30_000_000 }, "asha@y.co");
    expect(await currentRewardRules()).toEqual({ basePercent: 1.25, bonusPercent: 0.5, bonusThreshold: 30_000_000 });
    await expect(
      setRewardRules({ basePercent: 0, bonusPercent: 0.25, bonusThreshold: 20_000_000 }, "a@y.co")
    ).rejects.toBeInstanceOf(RewardError);
    expect(payoutDateFor(new Date("2026-10-07T10:00:00+05:30")).toISOString()).toBe("2026-11-04T18:30:00.000Z");
  });
});
