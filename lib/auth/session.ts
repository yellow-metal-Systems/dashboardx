import { cookies } from "next/headers";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { notFound, redirect } from "next/navigation";

import { IS_PRODUCTION, SESSION_SECRET, SESSION_TTL_SECONDS } from "../env";
import { prisma } from "../prisma";

export type StaffSession = {
  userId?: string;
  email?: string;
  name?: string;
  role?: "admin" | "staff";
};

export const SESSION_COOKIE_NAME = "ym_admin_session";

export const sessionOptions: SessionOptions = {
  password: SESSION_SECRET,
  cookieName: SESSION_COOKIE_NAME,
  ttl: SESSION_TTL_SECONDS,
  cookieOptions: {
    httpOnly: true,
    secure: IS_PRODUCTION,
    // Lax, not Strict: Strict would drop the cookie when a staff member follows
    // a link to a lead from an email or chat, which is a normal way to arrive
    // here. Lax still blocks cross-site POSTs, which is the CSRF concern.
    sameSite: "lax",
    path: "/",
  },
};

export async function getSession(): Promise<IronSession<StaffSession>> {
  return getIronSession<StaffSession>(await cookies(), sessionOptions);
}

export type SignedInStaff = {
  userId: string;
  email: string;
  name: string;
  role: "admin" | "staff";
};

/** The signed-in staff member, or null. */
export async function currentStaff(): Promise<SignedInStaff | null> {
  const session = await getSession();
  if (!session.userId || !session.email) return null;
  return {
    userId: session.userId,
    email: session.email,
    name: session.name ?? session.email,
    role: session.role ?? "staff",
  };
}

/**
 * Enforces authentication. Call this at the top of EVERY server action and every
 * protected page.
 *
 * middleware.ts also guards /dashboard, but middleware alone is not enough: a
 * Next.js server action is a POST endpoint that can be invoked directly, so a
 * layout- or middleware-only guard leaves the mutation itself unprotected. This
 * is the check that actually protects the write path.
 */
export async function requireStaff(): Promise<SignedInStaff> {
  const staff = await currentStaff();
  if (!staff) redirect("/login");
  return staff;
}

/** Non-redirecting variant, for server actions that must return an error instead. */
export async function requireStaffOrThrow(): Promise<SignedInStaff> {
  const staff = await currentStaff();
  if (!staff) throw new Error("Not signed in.");
  return staff;
}

/**
 * Money (reward amounts, bank details, approving and paying) is for admins only.
 * Read from the database every time, not the session cookie: an admin who is
 * demoted or deactivated loses access at once, not at their next login.
 */
export async function isAdmin(staff: Pick<SignedInStaff, "userId">): Promise<boolean> {
  const row = await prisma.adminUser.findUnique({
    where: { id: staff.userId },
    select: { role: true, isActive: true },
  });
  return !!row && row.isActive && row.role === "admin";
}

/** For admin-only pages: a team member gets a plain 404, not a hint that the page exists. */
export async function requireAdmin(): Promise<SignedInStaff> {
  const staff = await requireStaff();
  if (!(await isAdmin(staff))) notFound();
  return staff;
}

/** For admin-only server actions. */
export async function requireAdminOrThrow(): Promise<SignedInStaff> {
  const staff = await requireStaffOrThrow();
  if (!(await isAdmin(staff))) throw new Error("Only admins can do this.");
  return staff;
}
