import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { prisma } from "@/lib/prisma";
import { firstLeadIds, listLeads } from "@/lib/leads-repo";

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
});
