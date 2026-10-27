import { createHash, randomBytes, randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { IS_PRODUCTION, LEADBRIDGE_URL } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { agreementSent, approved, rejected } from "@/lib/email-templates";
import {
  BLANK_RATES,
  TEMPLATE_VERSIONS,
  agreementFields,
  bcRates,
  dsaRates,
  templateFor,
  type AgreementFields,
  type AgreementTemplate,
  type BcRates,
  type DsaRates,
} from "@/lib/agreements/fields";
import { istDate } from "@/lib/agreements/format";
import { renderAgreement } from "@/lib/agreements/render";
import { AgreementFileError, readAgreementFile, storeAgreementFile } from "@/lib/agreements/files";
import { INVITE_TTL_DAYS, MOBILE_TAKEN, PartnerAccountError, insertPartnerWithInvite, isUniqueViolation } from "./onboarding";

// =============================================================================
// Self-service sign-ups (standup 2026-10-15) and the partner agreement (plan of
// 27 Oct 2026). A person or company applies on LeadBridge; an admin here sends
// the agreement (BC for individuals, DSA for companies) with the payout rates;
// the applicant signs it on LeadBridge through a single-use link; an admin
// countersigns and approves, which creates the partner. An admin can resend the
// link (the old one stops working) or reject at any point before approval.
//
//   PENDING → AGREEMENT_SENT → SIGNED → APPROVED, or → REJECTED
//
// Every step claims the application with a conditional update, so two admins
// acting at once can't both send, resend, reject or approve.
// =============================================================================

export class ApplicationError extends Error {}

export const APPLICATION_STATUSES = ["PENDING", "AGREEMENT_SENT", "SIGNED", "APPROVED", "REJECTED"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: "Pending",
  AGREEMENT_SENT: "Agreement sent",
  SIGNED: "Signed",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/** Days a signing link works. */
export const AGREEMENT_LINK_TTL_DAYS = Number(process.env.AGREEMENT_LINK_TTL_DAYS ?? 14);

type Tx = Prisma.TransactionClient;

// --- reading ---------------------------------------------------------------------

/** The current (not VOID) agreement's summary: never the token hash or the file. */
const agreementSummary = {
  id: true,
  template: true,
  templateVersion: true,
  status: true,
  fields: true,
  unsignedSha256: true,
  tokenExpiresAt: true,
  sentBy: true,
  sentAt: true,
  signerTypedName: true,
  signedAt: true,
  signerIp: true,
  signerUserAgent: true,
  countersignedBy: true,
  countersignerName: true,
  countersignedAt: true,
  executedSha256: true,
} satisfies Prisma.PartnerAgreementSelect;

export async function listApplications(status: ApplicationStatus = "PENDING") {
  const rows = await prisma.partnerApplication.findMany({
    where: { status },
    orderBy: { createdAt: status === "APPROVED" || status === "REJECTED" ? "desc" : "asc" },
    take: 200,
    include: { agreements: { where: { status: { not: "VOID" } }, select: { tokenExpiresAt: true, sentAt: true, signedAt: true } } },
  });
  return rows.map(({ agreements, ...app }) => ({
    ...app,
    linkExpiresAt: agreements[0]?.tokenExpiresAt ?? null,
    agreementSentAt: agreements[0]?.sentAt ?? null,
    signedAt: agreements[0]?.signedAt ?? null,
  }));
}

/** How many applications are in each status, for the tabs. */
export async function countApplications(): Promise<Record<ApplicationStatus, number>> {
  const groups = await prisma.partnerApplication.groupBy({ by: ["status"], _count: { _all: true } });
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<ApplicationStatus, number>;
  for (const g of groups) if (g.status in counts) counts[g.status as ApplicationStatus] = g._count._all;
  return counts;
}

/** Applications waiting for an admin: new ones and signed ones. */
export function countPendingApplications(): Promise<number> {
  return prisma.partnerApplication.count({ where: { status: { in: ["PENDING", "SIGNED"] } } });
}

/** One application for its page: details, the current agreement, and the history (newest last). */
export async function getApplication(id: string) {
  const app = await prisma.partnerApplication.findUnique({
    where: { id },
    include: {
      agreements: { where: { status: { not: "VOID" } }, select: agreementSummary },
      events: { orderBy: { createdAt: "asc" }, select: { id: true, action: true, actor: true, detail: true, createdAt: true } },
    },
  });
  if (!app) return null;
  const { agreements, ...rest } = app;
  return { ...rest, template: templateFor(app.applicantType), agreement: agreements[0] ?? null };
}

/** Payout rates the agreement form starts with. Blank until Rahul confirms defaults. */
export function defaultRates(template: AgreementTemplate): DsaRates | BcRates {
  return { ...BLANK_RATES[template] };
}

// --- the agreement -----------------------------------------------------------------

/** Yellow Metal's legal name and registered office, as printed on every agreement. */
export function companyDetails(): { name: string; office: string } {
  const name = process.env.COMPANY_LEGAL_NAME?.trim();
  const office = process.env.COMPANY_REGISTERED_OFFICE?.trim();
  if (name && office) return { name, office };
  if (IS_PRODUCTION) {
    throw new ApplicationError("Set COMPANY_LEGAL_NAME and COMPANY_REGISTERED_OFFICE before sending agreements.");
  }
  return { name: name || "[Yellow Metal legal name]", office: office || "[Yellow Metal registered office address]" };
}

/** Rates from a form: each field a number or blank (null). Throws a readable error for anything else. */
export function parseRates(template: AgreementTemplate, raw: Record<string, string | undefined>): DsaRates | BcRates {
  const num = (k: string) => {
    const v = raw[k]?.trim();
    if (!v) return null;
    const n = Number(v.replace(/,/g, ""));
    if (!Number.isFinite(n)) throw new ApplicationError("Payout rates must be numbers.");
    return n;
  };
  const parsed =
    template === "DSA"
      ? dsaRates.safeParse({ perQualifiedLeadRs: num("perQualifiedLeadRs"), disbursedPercent: num("disbursedPercent"), disbursedFlatRs: num("disbursedFlatRs") })
      : bcRates.safeParse({
          perVerifiedApplicationRs: num("perVerifiedApplicationRs"),
          disbursedPercent: num("disbursedPercent"),
          perActiveLoanMonthlyRs: num("perActiveLoanMonthlyRs"),
          collectedPercent: num("collectedPercent"),
        });
  if (!parsed.success) throw new ApplicationError(parsed.error.issues[0]?.message ?? "Check the payout rates.");
  return parsed.data;
}

type ApplicationRow = Awaited<ReturnType<typeof prisma.partnerApplication.findUniqueOrThrow>>;

/** Everything the template needs, from the application, today's date (IST) and the rates. */
export function fieldsFor(app: ApplicationRow, rates: DsaRates | BcRates, now = new Date()): AgreementFields {
  const template = templateFor(app.applicantType);
  if (!app.email || !app.address || (template === "BC" && !app.pan) || (template === "DSA" && !app.companyName)) {
    throw new ApplicationError("This application is missing details the agreement needs (it predates the new sign-up form). Ask the applicant to apply again.");
  }
  const company = companyDetails();
  const parsed = agreementFields.safeParse({
    template,
    effectiveDate: istDate(now),
    companyName: company.name,
    companyOffice: company.office,
    partnerName: template === "DSA" ? app.companyName : app.name,
    partnerAddress: app.address,
    ...(template === "BC" ? { partnerPan: app.pan } : {}),
    rates,
  });
  if (!parsed.success) throw new ApplicationError(parsed.error.issues[0]?.message ?? "The agreement details are not valid.");
  return parsed.data;
}

/** The agreement as it would be sent, without storing or sending anything. */
export async function previewAgreement(applicationId: string, rates: DsaRates | BcRates): Promise<Buffer> {
  const app = await prisma.partnerApplication.findUnique({ where: { id: applicationId } });
  if (!app) throw new ApplicationError("Application not found.");
  return renderAgreement(fieldsFor(app, rates), { reference: "PREVIEW" });
}

const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

/** The applicant opens this in LeadBridge to read and sign. */
export function signingUrl(token: string): string {
  return `${LEADBRIDGE_URL.replace(/\/+$/, "")}/agreement/${token}`;
}

function addEvent(db: Tx, applicationId: string, action: string, actor: string, detail?: Prisma.InputJsonValue) {
  return db.partnerApplicationEvent.create({ data: { applicationId, action, actor, detail } });
}

/** Renders, stores and records a new agreement for the application. Runs inside the caller's transaction. */
async function issueAgreement(tx: Tx, app: ApplicationRow, fields: AgreementFields, pdf: Buffer, agreementId: string, staffEmail: string) {
  const token = randomBytes(32).toString("base64url");
  const file = await storeAgreementFile(pdf, tx);
  const agreement = await tx.partnerAgreement.create({
    data: {
      id: agreementId,
      applicationId: app.id,
      template: fields.template,
      templateVersion: TEMPLATE_VERSIONS[fields.template],
      fields: fields as unknown as Prisma.InputJsonValue,
      unsignedFileId: file.id,
      unsignedSha256: file.sha256,
      tokenHash: hashToken(token),
      tokenExpiresAt: new Date(Date.now() + AGREEMENT_LINK_TTL_DAYS * 24 * 60 * 60 * 1000),
      sentBy: staffEmail,
    },
  });
  return { token, agreement };
}

export type SentAgreement = { agreementId: string; emailStatus: "LOGGED" | "SENT" | "FAILED"; email: string };

async function emailAgreement(app: ApplicationRow, template: AgreementTemplate, token: string, expiresAt: Date, resent: boolean) {
  const sent = await sendEmail({
    to: app.email!,
    template: resent ? "agreement_resent" : "agreement_sent",
    applicationId: app.id,
    ...agreementSent({ name: app.name, template, link: signingUrl(token), expiresAt, resent }),
  });
  if (sent.status === "FAILED") {
    await addEvent(prisma, app.id, "email_failed", "system", { template: resent ? "agreement_resent" : "agreement_sent" });
  }
  return sent.status;
}

/** Sends the agreement for a pending application: stores the exact PDF, emails a single-use signing link. */
export async function sendAgreement(applicationId: string, rates: DsaRates | BcRates, staffEmail: string): Promise<SentAgreement> {
  const app = await prisma.partnerApplication.findUnique({ where: { id: applicationId } });
  if (!app) throw new ApplicationError("Application not found.");
  if (app.status !== "PENDING") throw new ApplicationError("The agreement was already sent for this application.");
  const fields = fieldsFor(app, rates);
  const agreementId = randomUUID();
  const pdf = await renderAgreement(fields, { reference: agreementId });

  const { token, agreement } = await prisma.$transaction(async (tx) => {
    const claimed = await tx.partnerApplication.updateMany({
      where: { id: app.id, status: "PENDING" },
      data: { status: "AGREEMENT_SENT", reviewedBy: staffEmail, reviewedAt: new Date() },
    });
    if (claimed.count !== 1) throw new ApplicationError("The agreement was already sent for this application.");
    const issued = await issueAgreement(tx, app, fields, pdf, agreementId, staffEmail);
    await addEvent(tx, app.id, "agreement_sent", staffEmail, { agreementId, template: fields.template, templateVersion: TEMPLATE_VERSIONS[fields.template] });
    return issued;
  });

  const emailStatus = await emailAgreement(app, fields.template, token, agreement.tokenExpiresAt, false);
  return { agreementId, emailStatus, email: app.email! };
}

/**
 * A new signing link for an agreement that hasn't been signed: the old link
 * stops working. New rates may be given; otherwise the agreement is the same,
 * re-issued with today's date.
 */
export async function resendAgreement(applicationId: string, staffEmail: string, rates?: DsaRates | BcRates): Promise<SentAgreement> {
  const app = await prisma.partnerApplication.findUnique({
    where: { id: applicationId },
    include: { agreements: { where: { status: "SENT" }, select: { id: true, fields: true } } },
  });
  if (!app) throw new ApplicationError("Application not found.");
  const current = app.agreements[0];
  if (app.status !== "AGREEMENT_SENT" || !current) {
    throw new ApplicationError(app.status === "SIGNED" ? "The applicant has already signed." : "There is no unsigned agreement to resend.");
  }
  const previous = current.fields as unknown as AgreementFields;
  const fields = fieldsFor(app, rates ?? previous.rates);
  const agreementId = randomUUID();
  const pdf = await renderAgreement(fields, { reference: agreementId });

  const { token, agreement } = await prisma.$transaction(async (tx) => {
    const voided = await tx.partnerAgreement.updateMany({
      where: { id: current.id, status: "SENT" },
      data: { status: "VOID", voidedAt: new Date(), voidReason: "resent" },
    });
    const still = await tx.partnerApplication.count({ where: { id: app.id, status: "AGREEMENT_SENT" } });
    if (voided.count !== 1 || still !== 1) throw new ApplicationError("The agreement changed meanwhile (signed, resent or rejected). Reload the page.");
    const issued = await issueAgreement(tx, app, fields, pdf, agreementId, staffEmail);
    await addEvent(tx, app.id, "agreement_resent", staffEmail, { agreementId, replaces: current.id });
    return issued;
  });

  const emailStatus = await emailAgreement(app, fields.template, token, agreement.tokenExpiresAt, true);
  return { agreementId, emailStatus, email: app.email! };
}

/** Rejects an application at any point before approval; its agreement's link stops working. */
export async function rejectApplication(applicationId: string, reason: string, staffEmail: string): Promise<void> {
  const why = reason.trim();
  if (!why) throw new ApplicationError("Give a reason for rejecting.");
  const app = await prisma.$transaction(async (tx) => {
    const res = await tx.partnerApplication.updateMany({
      where: { id: applicationId, status: { in: ["PENDING", "AGREEMENT_SENT", "SIGNED"] } },
      data: { status: "REJECTED", rejectReason: why.slice(0, 300), reviewedBy: staffEmail, reviewedAt: new Date() },
    });
    if (res.count !== 1) throw new ApplicationError("This application was already approved or rejected.");
    await tx.partnerAgreement.updateMany({
      where: { applicationId, status: { in: ["SENT", "SIGNED"] } },
      data: { status: "VOID", voidedAt: new Date(), voidReason: "rejected" },
    });
    await addEvent(tx, applicationId, "rejected", staffEmail, { reason: why.slice(0, 300) });
    return tx.partnerApplication.findUniqueOrThrow({ where: { id: applicationId } });
  });

  // Applications from before the email field have no address to write to.
  if (app.email) {
    const sent = await sendEmail({ to: app.email, template: "rejected", applicationId, ...rejected({ name: app.name, reason: why.slice(0, 300) }) });
    if (sent.status === "FAILED") await addEvent(prisma, applicationId, "email_failed", "system", { template: "rejected" });
  }
}

// --- countersign and approve -------------------------------------------------------

/** The partner opens this in LeadBridge to set a password. */
export function inviteUrl(token: string): string {
  return `${LEADBRIDGE_URL.replace(/\/+$/, "")}/invite/${token}`;
}

/** LeadBridge's page on adding the app to a phone's home screen. */
export function installUrl(): string {
  return `${LEADBRIDGE_URL.replace(/\/+$/, "")}/install`;
}

export type Approval = {
  partnerId: string;
  /** The raw invite token, returned once so the admin can also share the link by hand. */
  token: string;
  name: string;
  email: string;
  emailStatus: "LOGGED" | "SENT" | "FAILED";
};

/**
 * The last step: an admin countersigns the signed agreement for Yellow Metal and
 * the applicant becomes a partner. Only a SIGNED application, checked here. The
 * executed PDF (both signatures and the signing certificate) is rendered from the
 * stored fields, and in one transaction: the agreement moves to EXECUTED with
 * that file, the application to APPROVED, and the partner, its login and invite
 * are created. Any failure rolls all of it back and the application stays
 * SIGNED. Then the welcome email goes out with the executed PDF attached and
 * the set-password link.
 */
export async function countersignAndApprove(
  applicationId: string,
  input: { confirmed: boolean; designation?: string | null },
  staffEmail: string,
  now = new Date()
): Promise<Approval> {
  if (!input.confirmed) throw new ApplicationError("Tick the box to countersign the agreement for Yellow Metal.");
  const app = await prisma.partnerApplication.findUnique({
    where: { id: applicationId },
    include: { agreements: { where: { status: "SIGNED" } } },
  });
  if (!app) throw new ApplicationError("Application not found.");
  const agreement = app.agreements[0];
  if (app.status !== "SIGNED" || !agreement || !agreement.signedAt || !agreement.signerTypedName) {
    throw new ApplicationError(
      app.status === "APPROVED" || app.status === "REJECTED"
        ? "This application was already approved or rejected."
        : "The applicant hasn't signed the agreement yet."
    );
  }
  if (!app.email) throw new ApplicationError("This application has no email address.");
  const signer = await prisma.adminUser.findUnique({ where: { email: staffEmail }, select: { name: true } });
  if (!signer) throw new ApplicationError("Your LeadDesk account was not found.");

  // The PDF the applicant signed must still be the one sent.
  try {
    await readAgreementFile(agreement.unsignedFileId, agreement.unsignedSha256);
  } catch (err) {
    if (err instanceof AgreementFileError) throw new ApplicationError(`${err.message} It can't be countersigned.`);
    throw err;
  }

  const fields = agreement.fields as unknown as AgreementFields;
  const designation = input.designation?.trim().slice(0, 100) || null;
  const executed = await renderAgreement(fields, {
    reference: agreement.id,
    partner: { name: agreement.signerTypedName, at: agreement.signedAt },
    company: { name: signer.name, designation, at: now },
    certificate: {
      reference: agreement.id,
      templateVersion: agreement.templateVersion,
      unsignedSha256: agreement.unsignedSha256,
      sentBy: agreement.sentBy,
      sentAt: agreement.sentAt,
      partner: {
        typedName: agreement.signerTypedName,
        email: app.email,
        signedAt: agreement.signedAt,
        ip: agreement.signerIp,
        userAgent: agreement.signerUserAgent,
      },
      company: { name: signer.name, designation, email: staffEmail, signedAt: now },
    },
  });

  const company = app.applicantType === "COMPANY";
  let created: { partnerId: string; token: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      const claimed = await tx.partnerApplication.updateMany({
        where: { id: app.id, status: "SIGNED" },
        data: { status: "APPROVED", reviewedBy: staffEmail, reviewedAt: now },
      });
      if (claimed.count !== 1) throw new ApplicationError("This application changed meanwhile (approved or rejected). Reload the page.");
      const file = await storeAgreementFile(executed, tx);
      const done = await tx.partnerAgreement.updateMany({
        where: { id: agreement.id, status: "SIGNED" },
        data: {
          status: "EXECUTED",
          countersignedBy: staffEmail,
          countersignerName: signer.name,
          countersignedAt: now,
          executedFileId: file.id,
          executedSha256: file.sha256,
        },
      });
      if (done.count !== 1) throw new ApplicationError("This agreement changed meanwhile. Reload the page.");
      const partner = await insertPartnerWithInvite(tx, {
        orgName: company ? app.companyName ?? app.name : app.name,
        contactEmail: company ? app.email : null,
        town: app.town,
        type: company ? "ORGANISATION" : "INDIVIDUAL",
        isOndc: false,
        gstinRequired: false,
        user: { name: app.name, mobile: app.mobile, email: app.email },
        createdBy: staffEmail,
      });
      await tx.partnerApplication.update({ where: { id: app.id }, data: { partnerId: partner.partnerId } });
      await addEvent(tx, app.id, "approved", staffEmail, { agreementId: agreement.id, partnerId: partner.partnerId, executedSha256: file.sha256 });
      return partner;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApplicationError(`${MOBILE_TAKEN} Nothing was changed; the application is still waiting.`);
    if (err instanceof PartnerAccountError) throw new ApplicationError(err.message);
    throw err;
  }

  const sent = await sendEmail({
    to: app.email,
    template: "approved",
    applicationId: app.id,
    attachments: [{ filename: `Yellow-Metal-${fields.template}-Agreement-signed.pdf`, content: executed }],
    ...approved({ name: app.name, template: fields.template, inviteLink: inviteUrl(created.token), inviteDays: INVITE_TTL_DAYS, installLink: installUrl() }),
  });
  if (sent.status === "FAILED") await addEvent(prisma, app.id, "email_failed", "system", { template: "approved" });
  return { partnerId: created.partnerId, token: created.token, name: app.name, email: app.email, emailStatus: sent.status };
}
