"use server";

import { revalidatePath } from "next/cache";
import type { PartnerType } from "@prisma/client";

import { requireAdminOrThrow, requireStaffOrThrow } from "@/lib/auth/session";
import { LEADBRIDGE_URL } from "@/lib/env";
import { ApiKeyError, createApiKey, revokeApiKey } from "./api-keys";
import { AdminError, PartnerAccountError, onboardPartner, resendInvite, setGstinRequired, setPartnerEnabled } from "./onboarding";
import { RewardError, approveReward, markRewardPaid, rejectReward, revealPayoutDetails, setRewardRules } from "./rewards";

// Server actions for partners and rewards. Each re-checks the staff session
// itself: a server action is a POST endpoint that can be called without the page.
// Moved from LeadBridge (lib/admin-actions.ts and lib/reward-actions.ts) when the staff screens moved into LeadDesk.

export type FormState = { error: string | null; inviteUrl?: string; inviteFor?: string };
export type KeyFormState = { error: string | null; key?: string };
export type RewardFormState = { error: string | null; ok?: boolean };

/** The partner opens this on their phone in LeadBridge (the partner app). */
function inviteUrl(token: string): string {
  return `${LEADBRIDGE_URL.replace(/\/+$/, "")}/invite/${token}`;
}

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function addPartnerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaffOrThrow();
  const personName = text(fd, "personName");
  const type: PartnerType = text(fd, "type") === "ORGANISATION" ? "ORGANISATION" : "INDIVIDUAL";
  const orgName = type === "ORGANISATION" ? text(fd, "orgName") : personName;
  if (type === "ORGANISATION" && !orgName) return { error: "Enter the organisation's name." };
  const contactEmail = text(fd, "email");
  if (!/^\S+@\S+\.\S+$/.test(contactEmail)) return { error: "Enter a valid email address." };
  try {
    const { token } = await onboardPartner({
      orgName,
      type,
      isOndc: fd.get("isOndc") === "on",
      gstinRequired: fd.get("gstinRequired") === "on",
      contactEmail,
      personName,
      mobile: text(fd, "mobile"),
      staffEmail: staff.email,
    });
    revalidatePath("/dashboard/partners", "layout");
    return { error: null, inviteUrl: inviteUrl(token), inviteFor: personName };
  } catch (err) {
    if (err instanceof PartnerAccountError) return { error: err.message };
    throw err;
  }
}

export async function resendInviteAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaffOrThrow();
  try {
    const token = await resendInvite(text(fd, "partnerUserId"), staff.email);
    return { error: null, inviteUrl: inviteUrl(token), inviteFor: text(fd, "name") };
  } catch (err) {
    if (err instanceof AdminError) return { error: err.message };
    throw err;
  }
}

export async function setGstinRequiredAction(fd: FormData): Promise<void> {
  await requireStaffOrThrow();
  await setGstinRequired(text(fd, "partnerId"), fd.get("required") === "true");
  revalidatePath("/dashboard/partners", "layout");
}

export async function setPartnerEnabledAction(fd: FormData): Promise<void> {
  await requireStaffOrThrow();
  await setPartnerEnabled(text(fd, "partnerId"), fd.get("enabled") === "true");
  revalidatePath("/dashboard/partners", "layout");
}

/** Creates an organisation API key. The full key is returned once, never stored. */
export async function createApiKeyAction(_prev: KeyFormState, fd: FormData): Promise<KeyFormState> {
  const staff = await requireStaffOrThrow();
  try {
    const { key } = await createApiKey(text(fd, "partnerId"), text(fd, "label"), staff.email);
    revalidatePath("/dashboard/partners", "layout");
    return { error: null, key };
  } catch (err) {
    if (err instanceof ApiKeyError) return { error: err.message };
    throw err;
  }
}

export async function revokeApiKeyAction(fd: FormData): Promise<void> {
  await requireStaffOrThrow();
  await revokeApiKey(text(fd, "keyId"));
  revalidatePath("/dashboard/partners", "layout");
}

// Money is admin-only: each action re-checks the role in the database itself
// (a server action is a POST endpoint that can be called without the page).
async function adminAction(fn: (email: string) => Promise<void>): Promise<RewardFormState> {
  const admin = await requireAdminOrThrow();
  try {
    await fn(admin.email);
  } catch (err) {
    if (err instanceof RewardError) return { error: err.message };
    throw err;
  }
  revalidatePath("/dashboard/rewards", "layout");
  return { error: null, ok: true };
}

export async function approveRewardAction(_prev: RewardFormState, fd: FormData) {
  return adminAction((email) => approveReward(text(fd, "rewardId"), email));
}

export async function rejectRewardAction(_prev: RewardFormState, fd: FormData) {
  return adminAction((email) => rejectReward(text(fd, "rewardId"), text(fd, "reason"), email));
}

export async function markRewardPaidAction(_prev: RewardFormState, fd: FormData) {
  const tdsRaw = text(fd, "tds");
  return adminAction((email) =>
    markRewardPaid(
      text(fd, "rewardId"),
      { paymentRef: text(fd, "paymentRef"), tds: tdsRaw ? Number(tdsRaw) : 0, confirmedNewAccount: fd.get("confirmedNewAccount") === "on" },
      email
    )
  );
}

export async function setRewardRulesAction(_prev: RewardFormState, fd: FormData) {
  return adminAction((email) =>
    setRewardRules(
      {
        basePercent: Number(text(fd, "basePercent")),
        bonusPercent: Number(text(fd, "bonusPercent")),
        // Entered in crore for readability: 2 → ₹2,00,00,000.
        bonusThreshold: Number(text(fd, "bonusThresholdCrore")) * 10_000_000,
      },
      text(fd, "reason"),
      email
    )
  );
}

export type RevealState = { error: string | null; details?: { pan: string; accountHolder: string; accountNumber: string; ifsc: string } };

/** Full PAN + account number for an admin about to pay; every reveal is logged. */
export async function revealPayoutDetailsAction(_prev: RevealState, fd: FormData): Promise<RevealState> {
  const admin = await requireAdminOrThrow();
  try {
    return { error: null, details: await revealPayoutDetails(text(fd, "partnerId"), admin.email) };
  } catch (err) {
    if (err instanceof RewardError) return { error: err.message };
    throw err;
  }
}
