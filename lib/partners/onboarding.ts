import { createHash, randomBytes } from "crypto";
import { Prisma, type PartnerType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isValidMobile, normaliseMobile } from "./mobile";

// =============================================================================
// Partner onboarding for LeadDesk staff: add a partner and its first login, send
// a single-use invite link, resend it, turn a partner off and on. The partner
// opens the link in LeadBridge (the partner app) to set a password; LeadBridge
// hashes the token the same way to check it.
// Moved from LeadBridge (lib/accounts.ts and lib/admin.ts) when the staff screens moved into LeadDesk.
// =============================================================================

export const INVITE_TTL_DAYS = 7;

/** Only the hash is stored, so a database read cannot be replayed as a link. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function newInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export class PartnerAccountError extends Error {}

export class AdminError extends Error {}

type InviteDb = Pick<Prisma.TransactionClient, "partnerInvite">;

async function createInvite(db: InviteDb, partnerUserId: string, createdBy: string | null) {
  // One live link per login: issuing a new one retires any unused older ones.
  await db.partnerInvite.deleteMany({ where: { partnerUserId, usedAt: null } });
  const token = newInviteToken();
  await db.partnerInvite.create({
    data: {
      partnerUserId,
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      createdBy,
    },
  });
  return token;
}

/**
 * Creates a partner, its first login and an invite. Returns the raw token —
 * the ONLY time it exists outside the link; it is never stored.
 */
export async function createPartnerWithInvite(input: {
  orgName: string;
  contactEmail: string;
  type: PartnerType;
  isOndc: boolean;
  user: { name: string; mobile: string; email?: string | null };
  createdBy: string | null;
}): Promise<{ partnerId: string; partnerUserId: string; token: string }> {
  const mobile = normaliseMobile(input.user.mobile);
  if (!isValidMobile(mobile)) throw new PartnerAccountError("Enter a valid 10-digit mobile number.");
  if (!input.orgName.trim()) throw new PartnerAccountError("Enter the partner's name.");
  if (!input.user.name.trim()) throw new PartnerAccountError("Enter the person's name.");

  try {
    return await prisma.$transaction(async (tx) => {
      const partner = await tx.partner.create({
        data: {
          orgName: input.orgName.trim(),
          contactEmail: input.contactEmail.trim().toLowerCase(),
          contactMobile: mobile,
          type: input.type,
          isOndc: input.isOndc,
          status: "invited",
        },
      });
      const user = await tx.partnerUser.create({
        data: {
          partnerId: partner.id,
          name: input.user.name.trim(),
          mobile,
          email: input.user.email?.trim().toLowerCase() || null,
          status: "invited",
        },
      });
      const token = await createInvite(tx, user.id, input.createdBy);
      return { partnerId: partner.id, partnerUserId: user.id, token };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new PartnerAccountError("A partner login with that mobile number already exists.");
    }
    throw err;
  }
}

/** A fresh link for an existing login (lost link, or the old one expired). */
export async function reissueInvite(partnerUserId: string, createdBy: string | null): Promise<string> {
  return prisma.$transaction((tx) => createInvite(tx, partnerUserId, createdBy));
}

export async function listPartners() {
  return prisma.partner.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: {
        select: { id: true, name: true, mobile: true, status: true, lastLoginAt: true },
        orderBy: { createdAt: "asc" },
      },
      apiKeys: {
        select: { id: true, label: true, keyPrefix: true, createdAt: true, lastUsedAt: true, revokedAt: true },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { leads: true } },
    },
  });
}

export async function onboardPartner(input: {
  orgName: string;
  type: PartnerType;
  isOndc: boolean;
  contactEmail: string;
  personName: string;
  mobile: string;
  staffEmail: string;
}) {
  return createPartnerWithInvite({
    orgName: input.orgName || input.personName,
    contactEmail: input.contactEmail,
    type: input.type,
    isOndc: input.isOndc,
    user: { name: input.personName, mobile: input.mobile, email: input.contactEmail },
    createdBy: input.staffEmail,
  });
}

export async function resendInvite(partnerUserId: string, staffEmail: string) {
  const user = await prisma.partnerUser.findUnique({ where: { id: partnerUserId }, include: { partner: true } });
  if (!user) throw new AdminError("Login not found.");
  if (user.status === "disabled" || user.partner.status === "disabled") {
    throw new AdminError("Turn the partner back on before sending a new link.");
  }
  return reissueInvite(partnerUserId, staffEmail);
}

/**
 * Turning a partner off blocks login and new leads for all its logins; its leads
 * stay. Turning it back on restores each login to active (if it had set a
 * password) or invited (if it never did).
 */
export async function setPartnerEnabled(partnerId: string, enabled: boolean) {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId }, include: { users: true } });
  if (!partner) throw new AdminError("Partner not found.");

  if (!enabled) {
    await prisma.$transaction([
      prisma.partner.update({ where: { id: partnerId }, data: { status: "disabled" } }),
      prisma.partnerUser.updateMany({ where: { partnerId }, data: { status: "disabled" } }),
    ]);
    return;
  }

  const hasActivated = partner.users.some((u) => u.passwordHash);
  await prisma.$transaction([
    prisma.partner.update({ where: { id: partnerId }, data: { status: hasActivated ? "active" : "invited" } }),
    prisma.partnerUser.updateMany({
      where: { partnerId, status: "disabled", passwordHash: { not: null } },
      data: { status: "active" },
    }),
    prisma.partnerUser.updateMany({
      where: { partnerId, status: "disabled", passwordHash: null },
      data: { status: "invited" },
    }),
  ]);
}
