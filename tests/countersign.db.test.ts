import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { prisma } from "@/lib/prisma";
import { ApplicationError, countersignAndApprove, sendAgreement } from "@/lib/partners/applications";
import { hashInviteToken, onboardPartner } from "@/lib/partners/onboarding";
import { readAgreementFile } from "@/lib/agreements/files";
import { can } from "@/lib/auth/roles";

// Partner agreement, last step (plan of 27 Oct 2026, step A7): an admin
// countersigns the signed agreement and the applicant becomes a partner.
// Signing itself happens in LeadBridge; here it is done the way LeadBridge's
// signAgreement leaves the rows. SKIPS without TEST_DATABASE_URL.
const db = process.env.TEST_DATABASE_URL?.trim() ? describe : describe.skip;

const ADMIN = "boss@ym.example";
const DSA_RATES = { perQualifiedLeadRs: 100, disbursedPercent: 1, disbursedFlatRs: null };
const BC_RATES = { perVerifiedApplicationRs: 150, disbursedPercent: 0.75, perActiveLoanMonthlyRs: 20, collectedPercent: 0.5 };
const OK = { confirmed: true, designation: "Director" };

function individual(mobile = "9845000001") {
  return prisma.partnerApplication.create({
    data: {
      applicantType: "INDIVIDUAL",
      name: "Suresh Gowda",
      email: "suresh@example.com",
      mobile,
      town: "Doddaballapur",
      address: "12, 3rd Cross, Doddaballapur 561203",
      pan: "ABCPE1234F",
    },
  });
}

function company() {
  return prisma.partnerApplication.create({
    data: {
      applicantType: "COMPANY",
      name: "Meena Rao",
      email: "ops@finbuddy.example",
      mobile: "9845000010",
      town: "Bengaluru",
      address: "80 Feet Road, Koramangala, Bengaluru 560034",
      companyName: "FinBuddy Services Pvt Ltd",
    },
  });
}

/** Sends the agreement and signs it as the applicant would on LeadBridge. */
async function signed(app: { id: string; name: string; applicantType: string }) {
  await sendAgreement(app.id, app.applicantType === "COMPANY" ? DSA_RATES : BC_RATES, ADMIN);
  const agreement = await prisma.partnerAgreement.findFirstOrThrow({ where: { applicationId: app.id, status: "SENT" } });
  await prisma.partnerAgreement.update({
    where: { id: agreement.id },
    data: { status: "SIGNED", signerTypedName: app.name, signedAt: new Date(), signerIp: "203.0.113.24", signerUserAgent: "Mozilla/5.0 Test" },
  });
  await prisma.partnerApplication.update({ where: { id: app.id }, data: { status: "SIGNED" } });
  return agreement;
}

db("partner agreement: countersign and approve (database)", () => {
  beforeEach(async () => {
    delete process.env.EMAIL_MODE;
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE partner_applications, agreement_files, email_messages, partner_invites, partner_users, partners, admin_users
      RESTART IDENTITY CASCADE`);
    await prisma.adminUser.create({ data: { email: ADMIN, name: "Rahul Boss", role: "admin", passwordHash: "x" } });
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("only admins may countersign", () => {
    expect(can("admin", "agreements.countersign")).toBe(true);
    expect(can("financial_operator", "agreements.countersign")).toBe(false);
    expect(can("customer_support", "agreements.countersign")).toBe(false);
  });

  it("countersigns an individual's BC agreement: executed PDF stored, partner and invite created, welcome email with the PDF", async () => {
    const app = await individual();
    const agreement = await signed(app);
    const r = await countersignAndApprove(app.id, OK, ADMIN);

    const a = await prisma.partnerAgreement.findUniqueOrThrow({ where: { id: agreement.id } });
    expect([a.status, a.countersignedBy, a.countersignerName]).toEqual(["EXECUTED", ADMIN, "Rahul Boss"]);
    expect(a.countersignedAt).toBeInstanceOf(Date);
    const pdf = await readAgreementFile(a.executedFileId!, a.executedSha256!);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(a.executedSha256).not.toBe(a.unsignedSha256);

    const after = await prisma.partnerApplication.findUniqueOrThrow({ where: { id: app.id } });
    expect([after.status, after.partnerId, after.reviewedBy]).toEqual(["APPROVED", r.partnerId, ADMIN]);
    const p = await prisma.partner.findUniqueOrThrow({ where: { id: r.partnerId }, include: { users: { include: { invites: true } } } });
    expect(p).toMatchObject({ orgName: "Suresh Gowda", type: "INDIVIDUAL", town: "Doddaballapur", contactEmail: null, status: "invited" });
    expect(p.users.map((u) => [u.mobile, u.email])).toEqual([["9845000001", "suresh@example.com"]]);
    expect(p.users[0].invites.map((i) => i.tokenHash)).toEqual([hashInviteToken(r.token)]);

    const email = await prisma.emailMessage.findFirstOrThrow({ where: { applicationId: app.id, template: "approved" } });
    expect([email.status, email.toAddress]).toEqual(["LOGGED", "suresh@example.com"]);
    expect(email.bodyHtml).toContain(`/invite/${r.token}`);
    expect(email.bodyHtml).toContain("/install");
    expect(email.bodyHtml).toContain("Yellow-Metal-BC-Agreement-signed.pdf");
    expect(r.emailStatus).toBe("LOGGED");

    const events = await prisma.partnerApplicationEvent.findMany({ where: { applicationId: app.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.action)).toEqual(["agreement_sent", "approved"]);

    await expect(countersignAndApprove(app.id, OK, ADMIN)).rejects.toThrow(/already approved or rejected/);
  });

  it("a company becomes an organisation in the company's name, with its email", async () => {
    const app = await company();
    await signed(app);
    const r = await countersignAndApprove(app.id, OK, ADMIN);
    const p = await prisma.partner.findUniqueOrThrow({ where: { id: r.partnerId }, include: { users: true } });
    expect(p).toMatchObject({ orgName: "FinBuddy Services Pvt Ltd", type: "ORGANISATION", contactEmail: "ops@finbuddy.example", isOndc: false });
    expect(p.users.map((u) => u.name)).toEqual(["Meena Rao"]);
  });

  it("refuses before the applicant signs, and without the confirmation box", async () => {
    const app = await individual();
    await expect(countersignAndApprove(app.id, OK, ADMIN)).rejects.toThrow(/hasn't signed/);
    await sendAgreement(app.id, BC_RATES, ADMIN);
    await expect(countersignAndApprove(app.id, OK, ADMIN)).rejects.toThrow(/hasn't signed/);
    await prisma.partnerApplication.update({ where: { id: app.id }, data: { status: "SIGNED" } });
    await expect(countersignAndApprove(app.id, { confirmed: false }, ADMIN)).rejects.toThrow(/Tick the box/);
    expect(await prisma.partner.count()).toBe(0);
  });

  it("rolls everything back when the partner can't be created, and the application keeps waiting", async () => {
    await onboardPartner({ type: "INDIVIDUAL", personName: "Taken", mobile: "9845000002", town: "Malur", staffEmail: "s" });
    const app = await individual("9845000002");
    const agreement = await signed(app);
    const filesBefore = await prisma.agreementFile.count();

    await expect(countersignAndApprove(app.id, OK, ADMIN)).rejects.toThrow(/mobile number already exists/);
    expect((await prisma.partnerApplication.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("SIGNED");
    const a = await prisma.partnerAgreement.findUniqueOrThrow({ where: { id: agreement.id } });
    expect([a.status, a.executedFileId, a.countersignedBy]).toEqual(["SIGNED", null, null]);
    expect(await prisma.agreementFile.count()).toBe(filesBefore);
    expect(await prisma.partner.count()).toBe(1);
    expect(await prisma.emailMessage.count({ where: { template: "approved" } })).toBe(0);
  });

  it("refuses if the signed PDF no longer matches what was sent", async () => {
    const app = await individual();
    const agreement = await signed(app);
    await prisma.agreementFile.update({ where: { id: agreement.unsignedFileId }, data: { bytes: new Uint8Array(Buffer.from("%PDF-1.3 changed")) } });
    await expect(countersignAndApprove(app.id, OK, ADMIN)).rejects.toThrow(ApplicationError);
    expect(await prisma.partner.count()).toBe(0);
  });

  it("refuses if today's code would no longer render exactly what was signed", async () => {
    const app = await individual();
    const agreement = await signed(app);
    // As if the template wording changed after sending: the stored fields now render different bytes.
    const fields = agreement.fields as Record<string, unknown>;
    await prisma.partnerAgreement.update({ where: { id: agreement.id }, data: { fields: { ...fields, partnerAddress: "Somewhere else 560001" } } });
    await expect(countersignAndApprove(app.id, OK, ADMIN)).rejects.toThrow(/wording has changed/);
    await prisma.partnerAgreement.update({ where: { id: agreement.id }, data: { fields: fields as object, templateVersion: "bc-v0" } });
    await expect(countersignAndApprove(app.id, OK, ADMIN)).rejects.toThrow(/wording has changed/);
    expect(await prisma.partner.count()).toBe(0);
  });

  it("approves once, even when two admins press it together", async () => {
    const app = await individual();
    await signed(app);
    const results = await Promise.allSettled([countersignAndApprove(app.id, OK, ADMIN), countersignAndApprove(app.id, OK, ADMIN)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.partner.count()).toBe(1);
    expect(await prisma.partnerAgreement.count({ where: { status: "EXECUTED" } })).toBe(1);
  });
});
