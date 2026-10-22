"use server";

import { getSession, passwordVersion, requireStaffOrThrow } from "@/lib/auth/session";
import { AccountError, changeOwnPassword } from "./account";

// Server actions for Settings. Each re-checks the session itself: a server
// action is a POST endpoint that can be called without the page.

export type PasswordFormState = { error: string | null; ok?: boolean };

const raw = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function changePasswordAction(_prev: PasswordFormState, fd: FormData): Promise<PasswordFormState> {
  const staff = await requireStaffOrThrow();
  try {
    // Passwords are not trimmed: validatePasswordStrength rejects edge spaces instead.
    const hash = await changeOwnPassword(staff.userId, { current: raw(fd, "current"), next: raw(fd, "password"), confirm: raw(fd, "confirm") });
    // Every other session for this account is now stale; keep this one signed in.
    const session = await getSession();
    session.pwv = await passwordVersion(hash);
    await session.save();
    return { error: null, ok: true };
  } catch (err) {
    if (err instanceof AccountError) return { error: err.message };
    throw err;
  }
}
