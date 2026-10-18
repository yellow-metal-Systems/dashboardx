import { prisma } from "@/lib/prisma";
import { PartnerAccountError, createPartnerWithInvite } from "./onboarding";

// =============================================================================
// Self-service sign-ups (standup 2026-10-15): individuals apply on LeadBridge's
// public page with their name, mobile and town, and wait. Staff approve here —
// which creates the partner, its login and an invite link, exactly as if staff
// had added them — or reject with a reason.
// =============================================================================

export class ApplicationError extends Error {}

export const APPLICATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export async function listApplications(status: ApplicationStatus = "PENDING") {
  return prisma.partnerApplication.findMany({
    where: { status },
    orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
    take: 200,
  });
}

export function countPendingApplications(): Promise<number> {
  return prisma.partnerApplication.count({ where: { status: "PENDING" } });
}

/** Approves a pending application. Returns the invite token (shown once) and the new partner. */
export async function approveApplication(
  applicationId: string,
  staffEmail: string
): Promise<{ token: string; partnerId: string; name: string }> {
  // Claim it first, so two staff approving at once can't create two partners.
  const claimed = await prisma.partnerApplication.updateMany({
    where: { id: applicationId, status: "PENDING" },
    data: { status: "APPROVED", reviewedBy: staffEmail, reviewedAt: new Date() },
  });
  if (claimed.count !== 1) throw new ApplicationError("This application was already reviewed.");
  const app = await prisma.partnerApplication.findUniqueOrThrow({ where: { id: applicationId } });

  try {
    const { token, partnerId } = await createPartnerWithInvite({
      orgName: app.name,
      contactEmail: null,
      town: app.town,
      type: "INDIVIDUAL",
      isOndc: false,
      gstinRequired: false,
      user: { name: app.name, mobile: app.mobile },
      createdBy: staffEmail,
    });
    await prisma.partnerApplication.update({ where: { id: applicationId }, data: { partnerId } });
    return { token, partnerId, name: app.name };
  } catch (err) {
    // Put it back in the queue, e.g. the mobile number already has a login.
    await prisma.partnerApplication.update({
      where: { id: applicationId },
      data: { status: "PENDING", reviewedBy: null, reviewedAt: null },
    });
    if (err instanceof PartnerAccountError) throw new ApplicationError(err.message);
    throw err;
  }
}

export async function rejectApplication(applicationId: string, reason: string, staffEmail: string): Promise<void> {
  const why = reason.trim();
  if (!why) throw new ApplicationError("Give a reason for rejecting.");
  const res = await prisma.partnerApplication.updateMany({
    where: { id: applicationId, status: "PENDING" },
    data: { status: "REJECTED", rejectReason: why.slice(0, 300), reviewedBy: staffEmail, reviewedAt: new Date() },
  });
  if (res.count !== 1) throw new ApplicationError("This application was already reviewed.");
}
