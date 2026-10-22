import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { prisma } from "@/lib/prisma";
import { TerminalStatusError, firstLeadIds, getLeadDetail, listLeads, lmsStatusTimes, updateLeadStatusRepo } from "@/lib/leads-repo";

// "New customer" = the first lead ever from a mobile, decided across the whole
// table (the same rule partner rewards use). SKIPS without TEST_DATABASE_URL.
const db = process.env.TEST_DATABASE_URL?.trim() ? describe : describe.skip;

db("new customer (database)", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE lead_status_outbox, webhook_events, lead_activities, partner_rewards, leads
      RESTART IDENTITY CASCADE`);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const lead = (id: string, mobile: string, createdAt: string) =>
    prisma.lead.create({ data: { id, name: id, mobile, pinCode: "560001", createdAt: new Date(createdAt) } });

  it("marks only the earliest lead per mobile, lower id on a tie", async () => {
    await lead("YMLEAD0000000002", "9800000001", "2026-10-01T10:00:00Z");
    await lead("YMLEAD0000000001", "9800000001", "2026-10-05T10:00:00Z");
    await lead("YMLEAD0000000004", "9800000002", "2026-10-02T10:00:00Z");
    await lead("YMLEAD0000000003", "9800000002", "2026-10-02T10:00:00Z");
    await lead("YMLEAD0000000005", "9800000003", "2026-10-03T10:00:00Z");

    const firsts = await firstLeadIds(["9800000001", "9800000002", "9800000003", "9800000001"]);
    expect(Array.from(firsts).sort()).toEqual(["YMLEAD0000000002", "YMLEAD0000000003", "YMLEAD0000000005"]);
    expect(await firstLeadIds([])).toEqual(new Set());

    const byId = Object.fromEntries((await listLeads()).map((l) => [l.id, l.isNewCustomer]));
    expect(byId).toEqual({
      YMLEAD0000000001: false,
      YMLEAD0000000002: true,
      YMLEAD0000000003: true,
      YMLEAD0000000004: false,
      YMLEAD0000000005: true,
    });
  });

  it("tags a lead whose latest status change came from the LMS; a later staff change clears it", async () => {
    await lead("YMLEAD0000000010", "9800000010", "2026-10-01T10:00:00Z");
    await lead("YMLEAD0000000011", "9800000011", "2026-10-01T10:00:00Z");
    const act = (leadId: string, actor: string, at: string) =>
      prisma.leadActivity.create({ data: { leadId, kind: "STATUS_CHANGED", fromStatus: "LEAD_CREATED", toStatus: "DISBURSED", message: "status changed", actor, createdAt: new Date(at) } });
    await act("YMLEAD0000000010", "lms", "2026-10-02T10:00:00Z");
    await act("YMLEAD0000000011", "lms", "2026-10-02T10:00:00Z");
    await act("YMLEAD0000000011", "staff:a@y.co", "2026-10-03T10:00:00Z");
    const tags = await lmsStatusTimes(["YMLEAD0000000010", "YMLEAD0000000011"]);
    expect(Array.from(tags.entries())).toEqual([["YMLEAD0000000010", "2026-10-02T10:00:00.000Z"]]);
  });

  it("resolves partner-user and API-key actors to names for the timeline", async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE partner_api_keys, partner_invites, partner_users, partners RESTART IDENTITY CASCADE`);
    const partner = await prisma.partner.create({ data: { orgName: "Acme Leads", contactEmail: "acme@x.in", status: "active" } });
    const user = await prisma.partnerUser.create({ data: { partnerId: partner.id, name: "Asha Rao", mobile: "9800000020" } });
    await prisma.partnerApiKey.create({ data: { partnerId: partner.id, label: "Production", keyPrefix: "pfx12345", keyHash: "h" } });
    await lead("YMLEAD0000000020", "9800000021", "2026-10-01T10:00:00Z");
    for (const actor of [`partner:${user.id}`, "api:pfx12345", "partner:deleted-user", "staff:a@y.co"]) {
      await prisma.leadActivity.create({ data: { leadId: "YMLEAD0000000020", kind: "SUBMITTED", message: "m", actor } });
    }
    const detail = await getLeadDetail("YMLEAD0000000020");
    expect(detail?.actorNames).toEqual({ [`partner:${user.id}`]: "Asha Rao", "api:pfx12345": "API key “Production”" });
  });

  const outboxRows = (leadId: string) => prisma.leadStatusOutbox.count({ where: { leadId } });

  it("a final status can't be changed: disbursed, then rejected, sends one webhook", async () => {
    await lead("YMLEAD0000000030", "9800000030", "2026-10-01T10:00:00Z");
    await updateLeadStatusRepo("YMLEAD0000000030", "DISBURSED", "staff:a@y.co", { amount: 50_000 });
    await expect(updateLeadStatusRepo("YMLEAD0000000030", "REJECTED", "staff:a@y.co")).rejects.toBeInstanceOf(TerminalStatusError);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: "YMLEAD0000000030" } })).status).toBe("DISBURSED");
    expect(await outboxRows("YMLEAD0000000030")).toBe(1);
  });

  it("of two simultaneous changes from Contacted, exactly one goes through", async () => {
    await prisma.lead.create({ data: { id: "YMLEAD0000000031", name: "x", mobile: "9800000031", pinCode: "560001", status: "CONTACTED" } });
    const results = await Promise.allSettled([
      updateLeadStatusRepo("YMLEAD0000000031", "DISBURSED", "staff:a@y.co", { amount: 50_000 }),
      updateLeadStatusRepo("YMLEAD0000000031", "REJECTED", "staff:b@y.co"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(TerminalStatusError);
    expect(await outboxRows("YMLEAD0000000031")).toBe(1);
    expect(await prisma.leadActivity.count({ where: { leadId: "YMLEAD0000000031" } })).toBe(1);
  });
});
