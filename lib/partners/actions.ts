"use server";

import { revalidatePath } from "next/cache";
import type { PartnerType } from "@prisma/client";

import { requirePermissionOrThrow } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/roles";
import { ApiKeyError, createApiKey, revokeApiKey } from "./api-keys";
import {
  ApplicationError,
  countersignAndApprove,
  inviteUrl,
  RATE_FIELDS,
  parseRates,
  rejectApplication,
  resendAgreement,
  sendAgreement,
  type SentAgreement,
} from "./applications";
import { templateFor } from "@/lib/agreements/fields";
import { prisma } from "@/lib/prisma";
import { AdminError, PartnerAccountError, onboardPartner, resendInvite, setGstinRequired, setPartnerEnabled } from "./onboarding";
import { RewardError, approveReward, markRewardPaid, rejectReward, revealPayoutDetails, setRewardRules } from "./rewards";

// Server actions for partners and rewards. Each re-checks the staff session
// itself: a server action is a POST endpoint that can be called without the page.
// Moved from LeadBridge (lib/admin-actions.ts and lib/reward-actions.ts) when the staff screens moved into LeadDesk.

export type FormState = { error: string | null; inviteUrl?: string; inviteFor?: string };
export type KeyFormState = { error: string | null; key?: string };
export type RewardFormState = { error: string | null; ok?: boolean };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function addPartnerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requirePermissionOrThrow("partners.manage");
  const personName = text(fd, "personName");
  const type: PartnerType = text(fd, "type") === "ORGANISATION" ? "ORGANISATION" : "INDIVIDUAL";
  try {
    // Fields an individual doesn't have (email, ONDC, GSTIN) are ignored for them.
    const { token } = await onboardPartner({
      type,
      personName,
      mobile: text(fd, "mobile"),
      town: text(fd, "town"),
      orgName: text(fd, "orgName"),
      contactEmail: text(fd, "email"),
      isOndc: fd.get("isOndc") === "on",
      gstinRequired: fd.get("gstinRequired") === "on",
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
  const staff = await requirePermissionOrThrow("partners.manage");
  try {
    const token = await resendInvite(text(fd, "partnerUserId"), staff.email);
    return { error: null, inviteUrl: inviteUrl(token), inviteFor: text(fd, "name") };
  } catch (err) {
    if (err instanceof AdminError) return { error: err.message };
    throw err;
  }
}

export async function setGstinRequiredAction(fd: FormData): Promise<void> {
  await requirePermissionOrThrow("partners.manage");
  try {
    await setGstinRequired(text(fd, "partnerId"), fd.get("required") === "true");
  } catch (err) {
    // The form has no error slot; the page simply shows the switch unchanged.
    if (!(err instanceof AdminError)) throw err;
  }
  revalidatePath("/dashboard/partners", "layout");
}

export async function setPartnerEnabledAction(fd: FormData): Promise<void> {
  await requirePermissionOrThrow("partners.manage");
  await setPartnerEnabled(text(fd, "partnerId"), fd.get("enabled") === "true");
  revalidatePath("/dashboard/partners", "layout");
}

/** Creates an organisation API key. The full key is returned once, never stored. */
export async function createApiKeyAction(_prev: KeyFormState, fd: FormData): Promise<KeyFormState> {
  const staff = await requirePermissionOrThrow("partners.manage");
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
  await requirePermissionOrThrow("partners.manage");
  await revokeApiKey(text(fd, "keyId"));
  revalidatePath("/dashboard/partners", "layout");
}

// Money needs rewards.manage (rules: rewardRules.manage): each action re-checks the
// role in the database itself (a server action is a POST endpoint that can be
// called without the page).
async function adminAction(
  fn: (email: string) => Promise<void>,
  permission: Permission = "rewards.manage"
): Promise<RewardFormState> {
  const admin = await requirePermissionOrThrow(permission);
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
  const res = await adminAction((email) =>
    setRewardRules(
      {
        basePercent: Number(text(fd, "basePercent")),
        bonusPercent: Number(text(fd, "bonusPercent")),
        // Entered in crore for readability: 2 → ₹2,00,00,000.
        bonusThreshold: Number(text(fd, "bonusThresholdCrore")) * 10_000_000,
      },
      text(fd, "reason"),
      email
    ),
    "rewardRules.manage"
  );
  // The rules form lives on Settings now; refresh it as well as Rewards.
  if (res.ok) revalidatePath("/dashboard/settings");
  return res;
}

export type RevealState = { error: string | null; details?: { pan: string; accountHolder: string; accountNumber: string; ifsc: string } };

/** Full PAN + account number for an admin about to pay; every reveal is logged. */
export async function revealPayoutDetailsAction(_prev: RevealState, fd: FormData): Promise<RevealState> {
  const admin = await requirePermissionOrThrow("rewards.manage");
  try {
    return { error: null, details: await revealPayoutDetails(text(fd, "partnerId"), admin.email) };
  } catch (err) {
    if (err instanceof RewardError) return { error: err.message };
    throw err;
  }
}

// --- self-service sign-ups (partners.manage) -------------------------------------

export type ApplicationFormState = { error: string | null; inviteUrl?: string; inviteFor?: string; ok?: boolean; message?: string };

/**
 * Countersigns a signed agreement and approves the applicant: creates the partner
 * and emails them the executed copy and their set-password link. The link is
 * also returned, shown once like Add partner's, in case the email doesn't arrive.
 */
export async function countersignAndApproveAction(_prev: ApplicationFormState, fd: FormData): Promise<ApplicationFormState> {
  const staff = await requirePermissionOrThrow("agreements.countersign");
  try {
    const r = await countersignAndApprove(
      text(fd, "applicationId"),
      { confirmed: fd.get("confirmed") === "on", designation: text(fd, "designation") },
      staff.email
    );
    revalidatePath("/dashboard/partners", "layout");
    const message =
      r.emailStatus === "LOGGED"
        ? `Approved. The welcome email to ${r.email} is in Sent emails (demo mode).`
        : r.emailStatus === "FAILED"
          ? `Approved, but the welcome email to ${r.email} failed. Send them the link below.`
          : `Approved. The signed agreement and set-password link were emailed to ${r.email}.`;
    return { error: null, ok: true, message, inviteUrl: inviteUrl(r.token), inviteFor: r.name };
  } catch (err) {
    if (err instanceof ApplicationError) return { error: err.message };
    throw err;
  }
}

export async function rejectApplicationAction(_prev: ApplicationFormState, fd: FormData): Promise<ApplicationFormState> {
  const staff = await requirePermissionOrThrow("partners.manage");
  try {
    await rejectApplication(text(fd, "applicationId"), text(fd, "reason"), staff.email);
    revalidatePath("/dashboard/partners", "layout");
    return { error: null, ok: true };
  } catch (err) {
    if (err instanceof ApplicationError) return { error: err.message };
    throw err;
  }
}

// --- the partner agreement (partners.manage) -----------------------------------

/** The form's payout-rate fields for this application's agreement (BC or DSA). */
async function ratesFrom(fd: FormData, applicationId: string) {
  const app = await prisma.partnerApplication.findUnique({ where: { id: applicationId }, select: { applicantType: true } });
  if (!app) throw new ApplicationError("Application not found.");
  return parseRates(templateFor(app.applicantType), Object.fromEntries(RATE_FIELDS.map((k) => [k, text(fd, k)])));
}

function sentMessage(r: SentAgreement, resent: boolean): string {
  const what = resent ? "A new signing link" : "The agreement";
  if (r.emailStatus === "LOGGED") return `${what} is ready for ${r.email}. Demo mode: open it from Sent emails.`;
  if (r.emailStatus === "FAILED") return `${what} was created, but the email to ${r.email} failed. Resend it to try again.`;
  return `${what} was emailed to ${r.email}.`;
}

/** Sends the BC or DSA agreement with the payout rates entered on the form. */
export async function sendAgreementAction(_prev: ApplicationFormState, fd: FormData): Promise<ApplicationFormState> {
  const staff = await requirePermissionOrThrow("partners.manage");
  const applicationId = text(fd, "applicationId");
  try {
    const sent = await sendAgreement(applicationId, await ratesFrom(fd, applicationId), staff.email);
    revalidatePath("/dashboard/partners", "layout");
    return { error: null, ok: true, message: sentMessage(sent, false) };
  } catch (err) {
    if (err instanceof ApplicationError) return { error: err.message };
    throw err;
  }
}

/** A new signing link; the old one stops working. Rates change only if the form sends them. */
export async function resendAgreementAction(_prev: ApplicationFormState, fd: FormData): Promise<ApplicationFormState> {
  const staff = await requirePermissionOrThrow("partners.manage");
  const applicationId = text(fd, "applicationId");
  try {
    const newRates = fd.get("changeRates") === "on" ? await ratesFrom(fd, applicationId) : undefined;
    const sent = await resendAgreement(applicationId, staff.email, newRates);
    revalidatePath("/dashboard/partners", "layout");
    return { error: null, ok: true, message: sentMessage(sent, true) };
  } catch (err) {
    if (err instanceof ApplicationError) return { error: err.message };
    throw err;
  }
}
