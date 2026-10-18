import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { parseRole, type StaffRole } from "@/lib/auth/roles";

// =============================================================================
// The LeadDesk team (standup 2026-10-15): an admin invites a colleague by email
// with a role, the colleague opens the link and sets a password, and the admin
// can later change their role or turn the account off.
//
// Like partner invites: single use, 7 days, only the token's SHA-256 is stored,
// and nothing is emailed yet — the admin copies the link (no mail service on the
// free tier). The admin_users row is created only when the invite is accepted.
// =============================================================================

export const STAFF_INVITE_TTL_DAYS = 7;

export class TeamError extends Error {}

const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireRole(role: string): StaffRole {
  const parsed = parseRole(role);
  if (!parsed || role === "staff") throw new TeamError("Choose a role.");
  return parsed;
}

export async function listTeam() {
  const [members, invites] = await Promise.all([
    prisma.adminUser.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    }),
    prisma.staffInvite.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, role: true, expiresAt: true, createdBy: true, createdAt: true },
    }),
  ]);
  return {
    members: members.map((m) => ({ ...m, role: parseRole(m.role) ?? "customer_support" })),
    invites: invites.map((i) => ({ ...i, role: parseRole(i.role) ?? "customer_support" })),
  };
}

/** Creates an invite and returns the raw token — the only time it exists; it is never stored. */
export async function inviteMember(
  input: { email: string; name: string; role: string },
  invitedBy: string
): Promise<string> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!EMAIL.test(email)) throw new TeamError("Enter a valid email address.");
  if (!name) throw new TeamError("Enter their name.");
  const role = requireRole(input.role);
  if (await prisma.adminUser.findUnique({ where: { email }, select: { id: true } })) {
    throw new TeamError("Someone with that email is already on the team.");
  }

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    // One live link per email: a new invite retires any unused older one.
    prisma.staffInvite.deleteMany({ where: { email, usedAt: null } }),
    prisma.staffInvite.create({
      data: {
        email,
        name,
        role,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + STAFF_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        createdBy: invitedBy,
      },
    }),
  ]);
  return token;
}

/** What the join page shows, or null for an unknown, used or expired link. */
export async function findInvite(token: string) {
  const invite = await prisma.staffInvite.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invite || invite.usedAt || invite.expiresAt <= new Date()) return null;
  return { email: invite.email, name: invite.name, role: parseRole(invite.role) ?? "customer_support" };
}

/** Sets the password and creates the login. The link works once. */
export async function acceptInvite(token: string, password: string): Promise<{ email: string }> {
  const weak = validatePasswordStrength(password);
  if (weak) throw new TeamError(weak);
  const passwordHash = await hashPassword(password);

  try {
    return await prisma.$transaction(async (tx) => {
      // Claim the invite first, so two submits of the same link can't both succeed.
      const claimed = await tx.staffInvite.updateMany({
        where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new TeamError("This link has expired or was already used. Ask an admin for a new one.");
      const invite = await tx.staffInvite.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
      await tx.adminUser.create({
        data: { email: invite.email, name: invite.name, role: requireRole(invite.role), passwordHash },
      });
      return { email: invite.email };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new TeamError("An account with this email already exists. Sign in instead.");
    }
    throw err;
  }
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await prisma.staffInvite.deleteMany({ where: { id: inviteId, usedAt: null } });
}

/** Refuses a change that would leave nobody able to manage the team. */
async function keepAnAdmin(tx: Prisma.TransactionClient, losingAdmin: { id: string; role: string; isActive: boolean }) {
  if (losingAdmin.role !== "admin" || !losingAdmin.isActive) return;
  const others = await tx.adminUser.count({ where: { role: "admin", isActive: true, id: { not: losingAdmin.id } } });
  if (others === 0) throw new TeamError("LeadDesk needs at least one active admin.");
}

export async function setMemberRole(memberId: string, role: string, actingUserId: string): Promise<void> {
  const next = requireRole(role);
  if (memberId === actingUserId) throw new TeamError("You can't change your own role.");
  await prisma.$transaction(async (tx) => {
    const member = await tx.adminUser.findUnique({ where: { id: memberId } });
    if (!member) throw new TeamError("Team member not found.");
    if (next !== "admin") await keepAnAdmin(tx, member);
    await tx.adminUser.update({ where: { id: memberId }, data: { role: next } });
  });
}

/** Turning an account off signs it out at its next page load (the layout re-reads the role). */
export async function setMemberActive(memberId: string, active: boolean, actingUserId: string): Promise<void> {
  if (memberId === actingUserId) throw new TeamError("You can't turn off your own account.");
  await prisma.$transaction(async (tx) => {
    const member = await tx.adminUser.findUnique({ where: { id: memberId } });
    if (!member) throw new TeamError("Team member not found.");
    if (!active) await keepAnAdmin(tx, member);
    await tx.adminUser.update({ where: { id: memberId }, data: { isActive: active } });
  });
}
