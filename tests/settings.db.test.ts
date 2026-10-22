import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { passwordVersion, sessionIsCurrent } from "@/lib/auth/session";
import { AccountError, changeOwnPassword } from "@/lib/settings/account";
import { integrationStatus } from "@/lib/settings/integrations";

// Settings v1: a member changing their own password, and the integrations panel.
// SKIPS without TEST_DATABASE_URL: a throwaway Postgres migrated by serverx.
const db = process.env.TEST_DATABASE_URL?.trim() ? describe : describe.skip;

const OLD = "old staff passphrase";
const NEW = "brand new staff passphrase";

db("settings (database)", () => {
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

  const member = async (isActive = true) =>
    prisma.adminUser.create({
      data: { email: "ops@ym.example", name: "Ops", role: "customer_support", passwordHash: await hashPassword(OLD), isActive },
    });
  const hashOf = async (id: string) => (await prisma.adminUser.findUniqueOrThrow({ where: { id } })).passwordHash;

  describe("changeOwnPassword", () => {
    it("changes it when the current password is right", async () => {
      const m = await member();
      await changeOwnPassword(m.id, { current: OLD, next: NEW, confirm: NEW });
      const stored = await hashOf(m.id);
      expect(await verifyPassword(NEW, stored)).toBe(true);
      expect(await verifyPassword(OLD, stored)).toBe(false);
    });

    it.each([
      ["a wrong current password", { current: "not my password at all", next: NEW, confirm: NEW }, /current password/],
      ["a short new password", { current: OLD, next: "short", confirm: "short" }, /12 characters/],
      ["a confirmation that doesn't match", { current: OLD, next: NEW, confirm: NEW + "x" }, /don't match/],
      ["the same password again", { current: OLD, next: OLD, confirm: OLD }, /different/],
    ])("refuses %s and leaves the old one working", async (_label, input, message) => {
      const m = await member();
      const before = await hashOf(m.id);
      await expect(changeOwnPassword(m.id, input)).rejects.toThrow(message);
      await expect(changeOwnPassword(m.id, input)).rejects.toBeInstanceOf(AccountError);
      expect(await hashOf(m.id)).toBe(before);
    });

    it("ends sessions signed in with the old password; the changer's re-saved session stays valid", async () => {
      const m = await member();
      const before = { userId: m.id, pwv: await passwordVersion(m.passwordHash) };
      expect(await sessionIsCurrent(before)).toBe(true);
      expect(await sessionIsCurrent({ userId: m.id })).toBe(false); // a cookie from before pwv existed

      const hash = await changeOwnPassword(m.id, { current: OLD, next: NEW, confirm: NEW });
      expect(await sessionIsCurrent(before)).toBe(false);
      expect(await sessionIsCurrent({ userId: m.id, pwv: await passwordVersion(hash) })).toBe(true);
    });

    it("refuses a turned-off account", async () => {
      const m = await member(false);
      await expect(changeOwnPassword(m.id, { current: OLD, next: NEW, confirm: NEW })).rejects.toThrow(/turned off/);
    });
  });

  describe("integrationStatus", () => {
    it("counts LMS events from the last week, the ones waiting to match, and live API keys", async () => {
      const now = new Date("2026-10-22T10:00:00Z");
      const day = 24 * 3_600_000;
      const event = (eventId: string, outcome: "APPLIED" | "UNMATCHED" | "AMBIGUOUS", daysAgo: number) =>
        prisma.lmsLoanEvent.create({
          data: { eventId, event: "DISBURSED", payload: {}, outcome, receivedAt: new Date(now.getTime() - daysAgo * day) },
        });
      await event("E1", "APPLIED", 1);
      await event("E2", "UNMATCHED", 2);
      await event("E3", "AMBIGUOUS", 10);

      const partner = await prisma.partner.create({ data: { orgName: "Acme Gold", contactEmail: "a@acme.example" } });
      const lastUsedAt = new Date(now.getTime() - 3_600_000);
      await prisma.partnerApiKey.create({ data: { partnerId: partner.id, label: "live", keyPrefix: "ym_a", keyHash: "h1", lastUsedAt } });
      await prisma.partnerApiKey.create({ data: { partnerId: partner.id, label: "old", keyPrefix: "ym_b", keyHash: "h2", revokedAt: now } });

      const s = await integrationStatus(now);
      expect(s.lms).toEqual({ lastReceivedAt: new Date(now.getTime() - day), lastWeek: 2, awaitingReview: 2 });
      expect(s.apiKeys).toEqual({ active: 1, lastUsedAt });
    });

    it("doesn't count a disabled partner's keys as live", async () => {
      const lastUsedAt = new Date("2026-10-22T09:00:00Z");
      const off = await prisma.partner.create({ data: { orgName: "Off Gold", contactEmail: "o@off.example", status: "disabled" } });
      await prisma.partnerApiKey.create({ data: { partnerId: off.id, label: "live", keyPrefix: "ym_c", keyHash: "h3", lastUsedAt } });
      expect((await integrationStatus()).apiKeys).toEqual({ active: 0, lastUsedAt: null });
    });

    it("reports nothing received when the LMS has never called", async () => {
      const s = await integrationStatus();
      expect(s.lms).toEqual({ lastReceivedAt: null, lastWeek: 0, awaitingReview: 0 });
      expect(s.apiKeys).toEqual({ active: 0, lastUsedAt: null });
    });
  });
});
