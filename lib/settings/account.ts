import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

// Settings → My account. Any signed-in member may change their own password;
// they must know the current one, so a session left open on a shared screen
// cannot be used to lock the owner out.

export class AccountError extends Error {}

export async function changeOwnPassword(
  userId: string,
  input: { current: string; next: string; confirm: string }
): Promise<string> {
  const row = await prisma.adminUser.findUnique({ where: { id: userId }, select: { passwordHash: true, isActive: true } });
  if (!row || !row.isActive) throw new AccountError("Your account is turned off.");
  if (!(await verifyPassword(input.current, row.passwordHash))) throw new AccountError("Your current password is not right.");

  const weak = validatePasswordStrength(input.next);
  if (weak) throw new AccountError(weak);
  if (input.next !== input.confirm) throw new AccountError("The new passwords don't match.");
  if (input.next === input.current) throw new AccountError("Choose a password that is different from your current one.");

  const passwordHash = await hashPassword(input.next);
  await prisma.adminUser.update({ where: { id: userId }, data: { passwordHash } });
  return passwordHash; // the caller re-fingerprints its own session with it
}
