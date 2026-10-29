import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { prisma } from "@/lib/prisma";
import { TeamError, acceptInvite, findInvite, inviteMember, listTeam, setMemberActive, setMemberRole } from "@/lib/team/team";
import { countPendingApplications, rejectApplication } from "@/lib/partners/applications";
import { AdminError, PartnerAccountError, onboardPartner, setGstinRequired } from "@/lib/partners/onboarding";
import { verifyPassword } from "@/lib/auth/password";
import { updateLeadStatusRepo } from "@/lib/leads-repo";

// Standup 2026-10-15, staff side: the LeadDesk team (invites, roles, turning an
// account off), self-service partner sign-ups, organisation onboarding, and the
// plan a loan was actually given on.
// SKIPS without TEST_DATABASE_URL: a throwaway Postgres migrated by serverx.
const db = process.env.TEST_DATABASE_URL?.trim() ? describe : describe.skip;

const PASSWORD = "correct-horse-battery-staple";

db("team, sign-ups and onboarding (database)", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE lead_status_outbox, webhook_events, lead_activities, lms_loan_events, leads, reward_audit_log,
        partner_rewards, partner_payout_details_history, partner_payout_details, partner_api_keys, partner_invites,
        partner_users, partners, admin_users, staff_invites, partner_applications
      RESTART IDENTITY CASCADE`);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const admin = () =>
    prisma.adminUser.create({ data: { email: "boss@ym.example", name: "Boss", role: "admin", passwordHash: "x" } });

  describe("team", () => {
    it("invites a colleague with a role; the link sets their password once", async () => {
      const token = await inviteMember({ email: " Ops@YM.example ", name: "Ops Person", role: "financial_operator" }, "boss@ym.example");
      expect(await findInvite(token)).toEqual({ email: "ops@ym.example", name: "Ops Person", role: "financial_operator" });
      expect((await listTeam()).invites).toHaveLength(1);
      // Only the hash is stored.
      expect(JSON.stringify(await prisma.staffInvite.findMany())).not.toContain(token);

      await acceptInvite(token, PASSWORD);
      const member = await prisma.adminUser.findUniqueOrThrow({ where: { email: "ops@ym.example" } });
      expect([member.role, member.isActive]).toEqual(["financial_operator", true]);
      expect(await verifyPassword(PASSWORD, member.passwordHash)).toBe(true);

      expect(await findInvite(token)).toBeNull();
      await expect(acceptInvite(token, PASSWORD)).rejects.toThrow(/expired or was already used/);
    });

    it("refuses a bad email, an unknown role, an existing member and a weak password", async () => {
      await admin();
      await expect(inviteMember({ email: "nope", name: "A", role: "admin" }, "b")).rejects.toThrow(TeamError);
      await expect(inviteMember({ email: "a@b.in", name: "A", role: "staff" }, "b")).rejects.toThrow(/Choose a role/);
      await expect(inviteMember({ email: "boss@ym.example", name: "A", role: "admin" }, "b")).rejects.toThrow(/already on the team/);
      const token = await inviteMember({ email: "a@b.in", name: "A", role: "customer_support" }, "b");
      await expect(acceptInvite(token, "short")).rejects.toThrow(TeamError);
      expect(await findInvite(token)).not.toBeNull(); // a refused password doesn't burn the link
    });

    it("a new invite for the same email retires the old link", async () => {
      const first = await inviteMember({ email: "a@b.in", name: "A", role: "customer_support" }, "b");
      await inviteMember({ email: "a@b.in", name: "A", role: "admin" }, "b");
      expect(await findInvite(first)).toBeNull();
    });

    it("changes roles and turns accounts off, but never your own and never the last admin", async () => {
      const boss = await admin();
      const other = await prisma.adminUser.create({ data: { email: "o@ym.example", name: "O", role: "customer_support", passwordHash: "x" } });

      await expect(setMemberRole(boss.id, "customer_support", boss.id)).rejects.toThrow(/your own role/);
      await expect(setMemberActive(boss.id, false, boss.id)).rejects.toThrow(/your own account/);
      // The only admin can't be demoted or turned off by anyone.
      await expect(setMemberRole(boss.id, "customer_support", other.id)).rejects.toThrow(/at least one active admin/);
      await expect(setMemberActive(boss.id, false, other.id)).rejects.toThrow(/at least one active admin/);

      await setMemberRole(other.id, "admin", boss.id);
      await setMemberActive(boss.id, false, other.id);
      const after = await prisma.adminUser.findMany({ orderBy: { email: "asc" } });
      expect(after.map((m) => [m.email, m.role, m.isActive])).toEqual([
        ["boss@ym.example", "admin", false],
        ["o@ym.example", "admin", true],
      ]);
    });

    it("two admins demoting each other at once still leaves one admin", async () => {
      const a = await admin();
      const b = await prisma.adminUser.create({ data: { email: "b@ym.example", name: "B", role: "admin", passwordHash: "x" } });
      const results = await Promise.allSettled([
        setMemberRole(a.id, "customer_support", b.id),
        setMemberRole(b.id, "customer_support", a.id),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(TeamError);
      expect(await prisma.adminUser.count({ where: { role: "admin", isActive: true } })).toBe(1);
    });

    it("the database refuses an unknown role", async () => {
      await expect(
        prisma.adminUser.create({ data: { email: "x@ym.example", name: "X", role: "staff", passwordHash: "x" } })
      ).rejects.toThrow(/admin_users_role_check/);
    });
  });

  describe("partner sign-ups", () => {
    const apply = (mobile = "9845000001") =>
      prisma.partnerApplication.create({ data: { name: "Suresh Gowda", mobile, town: "Doddaballapur" } });

    // Approving (countersign and approve) is tested in agreement-flow.db.test.ts.
    it("counts applications waiting for an admin", async () => {
      await apply();
      expect(await countPendingApplications()).toBe(1);
      await apply("9845000002");
      expect(await countPendingApplications()).toBe(2);
    });

    it("rejecting needs a reason and happens once", async () => {
      const app = await apply();
      await expect(rejectApplication(app.id, " ", "s")).rejects.toThrow(/reason/);
      await rejectApplication(app.id, "Outside our area", "s");
      expect((await prisma.partnerApplication.findUniqueOrThrow({ where: { id: app.id } })).rejectReason).toBe("Outside our area");
      await expect(rejectApplication(app.id, "again", "s")).rejects.toThrow(/already approved or rejected/);
    });
  });

  describe("onboarding", () => {
    it("an organisation needs a name and an email; an individual needs a town", async () => {
      const base = { personName: "Priya", mobile: "9811100001", staffEmail: "s" };
      await expect(onboardPartner({ ...base, type: "ORGANISATION", contactEmail: "a@b.in" })).rejects.toThrow(/organisation's name/);
      await expect(onboardPartner({ ...base, type: "ORGANISATION", orgName: "Finance Buddha" })).rejects.toThrow(/valid email/);
      await expect(onboardPartner({ ...base, type: "INDIVIDUAL" })).rejects.toThrow(PartnerAccountError);

      const { partnerId } = await onboardPartner({
        ...base,
        type: "ORGANISATION",
        orgName: "Finance Buddha",
        contactEmail: "Ops@FinanceBuddha.example",
        isOndc: true,
        gstinRequired: true,
      });
      const p = await prisma.partner.findUniqueOrThrow({ where: { id: partnerId } });
      expect(p).toMatchObject({ type: "ORGANISATION", contactEmail: "ops@financebuddha.example", isOndc: true, gstinRequired: true });
    });

    it("only an organisation can require the customer's GSTIN", async () => {
      const { partnerId } = await onboardPartner({ type: "INDIVIDUAL", personName: "P", mobile: "9811100002", town: "Malur", staffEmail: "s" });
      await expect(setGstinRequired(partnerId, true)).rejects.toThrow(AdminError);
      await setGstinRequired(partnerId, false); // turning it off is always fine
    });
  });

  it("records the plan and rate a loan was actually given on", async () => {
    await prisma.lead.create({ data: { id: "YMLEAD0000000001", name: "B", mobile: "9000000001", pinCode: "560001", offerProductType: "BULLET" } });
    await updateLeadStatusRepo("YMLEAD0000000001", "DISBURSED", "s@ym.example", {
      amount: 300000,
      date: "2026-10-18",
      plan: "MONTHLY",
      roiPercentPa: 18,
    });
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: "YMLEAD0000000001" } });
    expect([lead.offerProductType, lead.disbursedPlan, Number(lead.disbursedRoiPercentPa)]).toEqual(["BULLET", "MONTHLY", 18]);
  });
});
