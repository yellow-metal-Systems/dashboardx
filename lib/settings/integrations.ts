import { prisma } from "@/lib/prisma";
import { fetchIntegrationHealth, type IntegrationHealth } from "@/lib/server-bridge";

// Settings → Integrations: is each connection to the outside world alive?
// Read-only. The AarthikLabs numbers come from serverx (the same call as the
// banner); the LMS feed and partner API keys are read from our own tables.

export type IntegrationStatus = {
  lms: { lastReceivedAt: Date | null; lastWeek: number; awaitingReview: number };
  /** Null when serverx can't be reached. */
  aarthik: IntegrationHealth | null;
  apiKeys: { active: number; lastUsedAt: Date | null };
};

const WEEK_MS = 7 * 24 * 3_600_000;

export async function integrationStatus(now = new Date()): Promise<IntegrationStatus> {
  const [lmsLast, lmsWeek, lmsOpen, keysActive, keyLast, aarthik] = await Promise.all([
    prisma.lmsLoanEvent.findFirst({ orderBy: { receivedAt: "desc" }, select: { receivedAt: true } }),
    prisma.lmsLoanEvent.count({ where: { receivedAt: { gte: new Date(now.getTime() - WEEK_MS) } } }),
    // Same definition as the LMS review page.
    prisma.lmsLoanEvent.count({ where: { outcome: { in: ["UNMATCHED", "AMBIGUOUS"] } } }),
    // A disabled partner's keys are refused at the API, so they don't count as live.
    prisma.partnerApiKey.count({ where: { revokedAt: null, partner: { status: { not: "disabled" } } } }),
    prisma.partnerApiKey.findFirst({
      where: { revokedAt: null, lastUsedAt: { not: null }, partner: { status: { not: "disabled" } } },
      orderBy: { lastUsedAt: "desc" },
      select: { lastUsedAt: true },
    }),
    fetchIntegrationHealth(),
  ]);

  return {
    lms: { lastReceivedAt: lmsLast?.receivedAt ?? null, lastWeek: lmsWeek, awaitingReview: lmsOpen },
    aarthik,
    apiKeys: { active: keysActive, lastUsedAt: keyLast?.lastUsedAt ?? null },
  };
}
