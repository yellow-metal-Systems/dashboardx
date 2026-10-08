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
  financialYearStart,
  getPartnerRewardStatement,
  listRewardPartners,
  markRewardPaid,
  payoutDateFor,
  rejectReward,
  revealPayoutDetails,
  setRewardRules,
} from "@/lib/partners/rewards";
import { isAdmin } from "@/lib/auth/session";

// Partner onboarding, API keys and reward handling — the staff side, moved here
// from LeadBridge along with its tests. Rewards are CREATED by serverx; these
// tests insert reward rows directly and check what staff can do with them.
// SKIPS without TEST_DATABASE_URL: a throwaway Postgres migrated by serverx.
const db = process.env.TEST_DATABASE_URL?.trim() ? describe : describe.skip;

db("partners and rewards (database)", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE lead_status_outbox, webhook_events, lead_activities, lms_loan_events, leads, reward_audit_log,
        partner_rewards, partner_payout_details_history, partner_payout_details,
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
  const bank = (partnerId: string, accountNumber = "123456789012") =>
    prisma.partnerPayoutDetails.upsert({
      where: { partnerId },
      update: { accountNumber },
      create: { partnerId, pan: "ABCPE1234F", accountHolder: "Priya Sharma", accountNumber, ifsc: "HDFC0001234" },
    });

  it("rewards go Pending → Approved → Paid; paying needs bank details and records exactly where the money went", async () => {
    const { partnerId } = await individual();
    const r = await reward(partnerId);
    await expect(markRewardPaid(r.id, { paymentRef: "UTR1", tds: 0 }, "s@y.co")).rejects.toThrow(/Approve the reward/);
    await approveReward(r.id, "a@y.co");
    await expect(approveReward(r.id, "a@y.co")).rejects.toBeInstanceOf(RewardError);
    await expect(markRewardPaid(r.id, { paymentRef: "UTR1", tds: 0 }, "s@y.co")).rejects.toThrow(/PAN and bank/);
    await bank(partnerId);
    await expect(markRewardPaid(r.id, { paymentRef: "", tds: 0 }, "s@y.co")).rejects.toThrow(/payment reference/);
    await expect(markRewardPaid(r.id, { paymentRef: "UTR1", tds: 2000 }, "s@y.co")).rejects.toThrow(/TDS/);
    await markRewardPaid(r.id, { paymentRef: "UTR1", tds: 100 }, "s@y.co");

    const paid = await prisma.partnerReward.findUniqueOrThrow({ where: { id: r.id }, include: { paidDetails: true } });
    expect([paid.status, paid.paymentRef, Number(paid.tdsAmount), paid.approvedBy, paid.paidBy]).toEqual(["PAID", "UTR1", 100, "staff:a@y.co", "staff:s@y.co"]);
    expect(paid.paidDetails?.accountNumber).toBe("123456789012");
    const log = await prisma.rewardAuditLog.findMany({ where: { rewardId: r.id }, orderBy: { at: "asc" } });
    expect(log.map((l) => [l.action, l.actor])).toEqual([["APPROVED", "staff:a@y.co"], ["PAID", "staff:s@y.co"]]);
    expect(log[1]!.details).toMatchObject({ gross: "2000", tds: 100, net: 1900, paidTo: "•••• 9012" });
    await expect(rejectReward(r.id, "too late", "s@y.co")).rejects.toBeInstanceOf(RewardError);
  });

  it("refuses a UTR already used for another partner, and needs a confirmation after a recent bank change", async () => {
    const a = await individual("9811111111");
    const b = await individual("9822222222");
    const ra = await reward(a.partnerId);
    const rb = await reward(b.partnerId);
    for (const [pid, r] of [[a.partnerId, ra], [b.partnerId, rb]] as const) {
      await approveReward(r.id, "a@y.co");
      await bank(pid);
    }
    await markRewardPaid(ra.id, { paymentRef: "UTR-SAME", tds: 0 }, "s@y.co");
    await expect(markRewardPaid(rb.id, { paymentRef: "UTR-SAME", tds: 0 }, "s@y.co")).rejects.toThrow(/another partner/);

    // B saved details a month ago, then changed the account just now (two history rows).
    await prisma.partnerPayoutDetailsHistory.create({
      data: { partnerId: b.partnerId, pan: "ABCPE1234F", accountHolder: "Priya Sharma", accountNumber: "111111111111", ifsc: "HDFC0001234", savedAt: new Date(Date.now() - 30 * 86_400_000) },
    });
    await prisma.partnerPayoutDetailsHistory.create({
      data: { partnerId: b.partnerId, pan: "ABCPE1234F", accountHolder: "Priya Sharma", accountNumber: "123456789012", ifsc: "HDFC0001234" },
    });
    await expect(markRewardPaid(rb.id, { paymentRef: "UTR-B", tds: 0 }, "s@y.co")).rejects.toThrow(/changed their bank details/);
    await markRewardPaid(rb.id, { paymentRef: "UTR-B", tds: 0, confirmedNewAccount: true }, "s@y.co");
    const log = await prisma.rewardAuditLog.findFirstOrThrow({ where: { rewardId: rb.id, action: "PAID" } });
    expect(log.details).toMatchObject({ confirmedNewAccount: true });
  });

  it("rejecting keeps the approver, records who rejected, and logs it", async () => {
    const { partnerId } = await individual();
    const r = await reward(partnerId);
    await expect(rejectReward(r.id, "", "s@y.co")).rejects.toThrow(/reason/);
    await approveReward(r.id, "a@y.co");
    await rejectReward(r.id, "Loan cancelled by the branch", "b@y.co");
    const after = await prisma.partnerReward.findUniqueOrThrow({ where: { id: r.id } });
    expect([after.status, after.approvedBy, after.rejectedBy, after.rejectedReason]).toEqual([
      "REJECTED", "staff:a@y.co", "staff:b@y.co", "Loan cancelled by the branch",
    ]);
    expect((await prisma.rewardAuditLog.findFirstOrThrow({ where: { rewardId: r.id, action: "REJECTED" } })).details).toMatchObject({ was: "APPROVED" });
  });

  it("groups rewards by partner; team members get counts and statuses, never an amount", async () => {
    const { partnerId } = await individual();
    await approveReward((await reward(partnerId, 2000)).id, "a@y.co");
    await reward(partnerId, 1500);
    await bank(partnerId);

    const admin = await listRewardPartners(true);
    expect(admin.rows[0]).toMatchObject({ orgName: "Priya Sharma", counts: { PENDING: 1, APPROVED: 1, PAID: 0, REJECTED: 0 } });
    expect(admin.rows[0]!.money).toEqual({ toApprove: 1500, owed: 2000, paidThisFy: 0 });
    expect(admin.totals).toEqual({ toApprove: 1500, owed: 2000, paidThisFy: 0 });

    const team = await listRewardPartners(false);
    expect(team.rows[0]!.counts).toEqual(admin.rows[0]!.counts);
    expect(team.totals).toBeNull();
    expect(JSON.stringify(team)).not.toMatch(/money|amount|"flags"|1500|2000/);

    const lead = await prisma.lead.create({
      data: { id: "YMLEAD0000000001", name: "Lakshmi", mobile: "9800000001", pinCode: "560001", partnerId, status: "DISBURSED", disbursementAmount: 300000 },
    });
    await prisma.partnerReward.create({ data: { kind: "LOAN", partnerId, leadId: lead.id, baseAmount: 300000, percent: 1, amount: 3000, disbursedAt: new Date() } });
    const teamSt = await getPartnerRewardStatement(partnerId, false);
    expect(teamSt!.leads[0]).toMatchObject({ name: "Lakshmi", reward: { status: "PENDING" } });
    expect(JSON.stringify(teamSt)).not.toMatch(/"amount"|"baseAmount"|"disbursementAmount"|"percent"|300000|3000/);
    expect([teamSt!.payee, teamSt!.audit]).toEqual([null, []]);
    const adminSt = await getPartnerRewardStatement(partnerId, true);
    expect(Number(adminSt!.leads[0]!.reward!.amount)).toBe(3000);
    expect(adminSt!.payee).toMatchObject({ pan: "AB•••••34F", account: "•••• 9012" });
  });

  it("reveals full bank details only by an action that is logged", async () => {
    const { partnerId } = await individual();
    await bank(partnerId);
    expect(await revealPayoutDetails(partnerId, "a@y.co")).toMatchObject({ pan: "ABCPE1234F", accountNumber: "123456789012" });
    expect((await prisma.rewardAuditLog.findFirstOrThrow({ where: { partnerId } })).action).toBe("DETAILS_REVEALED");
  });

  it("changes the reward rules for future disbursals only, with a reason, sane limits and a log", async () => {
    expect(await currentRewardRules()).toEqual({ basePercent: 1, bonusPercent: 0.25, bonusThreshold: 20_000_000 });
    await expect(setRewardRules({ basePercent: 1.25, bonusPercent: 0.5, bonusThreshold: 30_000_000 }, "", "a@y.co")).rejects.toThrow(/why/);
    await setRewardRules({ basePercent: 1.25, bonusPercent: 0.5, bonusThreshold: 30_000_000 }, "Festive season push", "asha@y.co");
    expect(await currentRewardRules()).toEqual({ basePercent: 1.25, bonusPercent: 0.5, bonusThreshold: 30_000_000 });
    await expect(
      setRewardRules({ basePercent: 0, bonusPercent: 0.25, bonusThreshold: 20_000_000 }, "Testing limits", "a@y.co")
    ).rejects.toBeInstanceOf(RewardError);
    await expect(setRewardRules({ basePercent: 1.25, bonusPercent: 0.5, bonusThreshold: 30_000_000 }, "Same again", "a@y.co")).rejects.toThrow(/Nothing changed/);
    const log = await prisma.rewardAuditLog.findFirstOrThrow({ where: { action: "RULES_CHANGED" } });
    expect(log.details).toMatchObject({ reason: "Festive season push", before: { basePercent: 1 }, after: { basePercent: 1.25 } });
    expect(payoutDateFor(new Date("2026-10-07T10:00:00+05:30")).toISOString()).toBe("2026-11-04T18:30:00.000Z");
    expect(financialYearStart(new Date("2026-10-08T00:00:00Z")).toISOString()).toBe("2026-03-31T18:30:00.000Z");
    expect(financialYearStart(new Date("2027-03-31T18:00:00Z")).toISOString()).toBe("2026-03-31T18:30:00.000Z");
  });

  it("only an active admin counts as admin (read from the database)", async () => {
    const mk = (email: string, role: string, isActive = true) =>
      prisma.adminUser.create({ data: { email, name: email, passwordHash: "x", role, isActive } });
    const admin = await mk("a@y.co", "admin");
    const staff = await mk("s@y.co", "staff");
    const gone = await mk("g@y.co", "admin", false);
    expect(await isAdmin({ userId: admin.id })).toBe(true);
    expect(await isAdmin({ userId: staff.id })).toBe(false);
    expect(await isAdmin({ userId: gone.id })).toBe(false);
    expect(await isAdmin({ userId: "missing" })).toBe(false);
  });
});
