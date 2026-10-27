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

export type NewPartnerInput = {
  orgName: string;
  contactEmail: string | null;
  town?: string | null;
  type: PartnerType;
  isOndc: boolean;
  gstinRequired?: boolean;
  user: { name: string; mobile: string; email?: string | null };
  createdBy: string | null;
};

export type NewPartner = { partnerId: string; partnerUserId: string; token: string };

export const MOBILE_TAKEN = "A user with that mobile number already exists.";

/** True for the unique-mobile clash createPartnerWithInvite turns into MOBILE_TAKEN. */
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Inserts the partner, its first login and an invite inside the caller's
 * transaction (countersign-and-approve creates the partner in the same
 * transaction as the approval). The caller maps a unique clash with
 * isUniqueViolation.
 */
export async function insertPartnerWithInvite(tx: Prisma.TransactionClient, input: NewPartnerInput): Promise<NewPartner> {
  const mobile = normaliseMobile(input.user.mobile);
  if (!isValidMobile(mobile)) throw new PartnerAccountError("Enter a valid 10-digit mobile number.");
  if (!input.orgName.trim()) throw new PartnerAccountError("Enter the partner's name.");
  if (!input.user.name.trim()) throw new PartnerAccountError("Enter the person's name.");

  const partner = await tx.partner.create({
    data: {
      orgName: input.orgName.trim(),
      contactEmail: input.contactEmail?.trim().toLowerCase() || null,
      contactMobile: mobile,
      town: input.town?.trim() || null,
      type: input.type,
      isOndc: input.isOndc,
      gstinRequired: input.gstinRequired ?? false,
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
}

/**
 * Creates a partner, its first login and an invite. Returns the raw token —
 * the ONLY time it exists outside the link; it is never stored.
 */
export async function createPartnerWithInvite(input: NewPartnerInput): Promise<NewPartner> {
  try {
    return await prisma.$transaction((tx) => insertPartnerWithInvite(tx, input));
  } catch (err) {
    if (isUniqueViolation(err)) throw new PartnerAccountError(MOBILE_TAKEN);
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

const EMAIL = /^\S+@\S+\.\S+$/;

/**
 * Adds a partner from LeadDesk (standup 2026-10-15). What is collected depends
 * on who they are:
 *   - an individual: name, mobile and town only. No email (rarely used in tier
 *     3-4 towns), no ONDC, no GSTIN — their leads are personal loans.
 *   - an organisation: company name, contact person, email, ONDC and the
 *     customer-GSTIN switch; it usually integrates through an API key.
 */
export async function onboardPartner(input: {
  type: PartnerType;
  personName: string;
  mobile: string;
  town?: string;
  orgName?: string;
  contactEmail?: string;
  isOndc?: boolean;
  gstinRequired?: boolean;
  staffEmail: string;
}) {
  if (input.type === "INDIVIDUAL") {
    if (!input.town?.trim()) throw new PartnerAccountError("Enter the town they work in.");
    return createPartnerWithInvite({
      orgName: input.personName,
      contactEmail: null,
      town: input.town,
      type: "INDIVIDUAL",
      isOndc: false,
      gstinRequired: false,
      user: { name: input.personName, mobile: input.mobile },
      createdBy: input.staffEmail,
    });
  }
  if (!input.orgName?.trim()) throw new PartnerAccountError("Enter the organisation's name.");
  const email = input.contactEmail?.trim() ?? "";
  if (!EMAIL.test(email)) throw new PartnerAccountError("Enter a valid email address.");
  return createPartnerWithInvite({
    orgName: input.orgName,
    contactEmail: email,
    town: input.town,
    type: "ORGANISATION",
    isOndc: input.isOndc ?? false,
    gstinRequired: input.gstinRequired ?? false,
    user: { name: input.personName, mobile: input.mobile, email },
    createdBy: input.staffEmail,
  });
}

export async function resendInvite(partnerUserId: string, staffEmail: string) {
  const user = await prisma.partnerUser.findUnique({ where: { id: partnerUserId }, include: { partner: true } });
  if (!user) throw new AdminError("User not found.");
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

/**
 * Staff switch: this organisation's leads must include the customer's GSTIN
 * (serverx enforces it). Not for individuals, whose leads are personal loans;
 * serverx ignores the switch for them anyway.
 */
export async function setGstinRequired(partnerId: string, required: boolean) {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId }, select: { type: true } });
  if (!partner) throw new AdminError("Partner not found.");
  if (required && partner.type !== "ORGANISATION") throw new AdminError("Only organisations can require the customer's GSTIN.");
  await prisma.partner.update({ where: { id: partnerId }, data: { gstinRequired: required } });
}
