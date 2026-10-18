"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermissionOrThrow } from "@/lib/auth/session";
import { TeamError, acceptInvite, inviteMember, revokeInvite, setMemberActive, setMemberRole } from "./team";

// Server actions for the Team page (team.manage) and the public join page. Each
// re-checks permission itself: a server action is a POST endpoint that can be
// called without the page.

export type TeamFormState = { error: string | null; inviteUrl?: string; inviteFor?: string; ok?: boolean };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** The colleague opens this to set a password: LeadDesk's own /join page. */
function joinUrl(token: string): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/join/${token}`;
}

async function teamAction(fn: (staff: { userId: string; email: string }) => Promise<TeamFormState | void>): Promise<TeamFormState> {
  const staff = await requirePermissionOrThrow("team.manage");
  try {
    const res = await fn(staff);
    revalidatePath("/dashboard/team");
    return res ?? { error: null, ok: true };
  } catch (err) {
    if (err instanceof TeamError) return { error: err.message };
    throw err;
  }
}

export async function inviteMemberAction(_prev: TeamFormState, fd: FormData): Promise<TeamFormState> {
  return teamAction(async (staff) => {
    const token = await inviteMember({ email: text(fd, "email"), name: text(fd, "name"), role: text(fd, "role") }, staff.email);
    return { error: null, inviteUrl: joinUrl(token), inviteFor: text(fd, "name") };
  });
}

export async function revokeInviteAction(_prev: TeamFormState, fd: FormData): Promise<TeamFormState> {
  return teamAction(() => revokeInvite(text(fd, "inviteId")));
}

export async function setMemberRoleAction(_prev: TeamFormState, fd: FormData): Promise<TeamFormState> {
  return teamAction((staff) => setMemberRole(text(fd, "memberId"), text(fd, "role"), staff.userId));
}

export async function setMemberActiveAction(_prev: TeamFormState, fd: FormData): Promise<TeamFormState> {
  return teamAction((staff) => setMemberActive(text(fd, "memberId"), fd.get("active") === "true", staff.userId));
}

export type JoinState = { error: string | null };

/** Public: the invite token is the credential. On success, on to sign-in. */
export async function acceptStaffInviteAction(_prev: JoinState, fd: FormData): Promise<JoinState> {
  const password = String(fd.get("password") ?? "");
  if (password !== String(fd.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  try {
    await acceptInvite(text(fd, "token"), password);
  } catch (err) {
    if (err instanceof TeamError) return { error: err.message };
    throw err;
  }
  redirect("/login?joined=1");
}
