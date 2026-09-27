"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "../prisma";
import { getSession } from "./session";
import { verifyPassword } from "./password";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginState = { error: string | null };

/** Keeps the response time roughly constant whether or not the email exists. */
const MIN_LOGIN_DURATION_MS = 400;

async function padTiming(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_LOGIN_DURATION_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_LOGIN_DURATION_MS - elapsed));
  }
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const startedAt = Date.now();

  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    await padTiming(startedAt);
    return { error: parsed.error.issues[0]?.message ?? "Enter your email and password." };
  }

  const { email, password } = parsed.data;

  const user = await prisma.adminUser.findUnique({ where: { email } });

  // One message for "no such account", "wrong password" and "disabled account":
  // distinguishing them tells an attacker which emails are real.
  const genericFailure = { error: "Those details did not match an active account." };

  if (!user || !user.isActive) {
    await padTiming(startedAt);
    return genericFailure;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await padTiming(startedAt);
    return genericFailure;
  }

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.name = user.name;
  session.role = user.role === "admin" ? "admin" : "staff";
  await session.save();

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
