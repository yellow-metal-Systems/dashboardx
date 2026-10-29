import { createHash } from "crypto";
import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  ApplicationError,
  countApplications,
  companyDetails,
  getApplication,
  listApplications,
  parseRates,
  previewAgreement,
  rejectApplication,
  resendAgreement,
  sendAgreement,
} from "@/lib/partners/applications";
import { readAgreementFile } from "@/lib/agreements/files";
import { sha256 } from "@/lib/agreements/render";

// Partner agreement, admin side (plan of 27 Oct 2026, step A5): send the BC or
// DSA agreement, resend the link, reject. SKIPS without TEST_DATABASE_URL.
const db = process.env.TEST_DATABASE_URL?.trim() ? describe : describe.skip;

const ADMIN = "boss@ym.example";
const DSA_RATES = { perQualifiedLeadRs: 100, disbursedPercent: 1, disbursedFlatRs: null };
const BC_RATES = { perVerifiedApplicationRs: 150, disbursedPercent: 0.75, perActiveLoanMonthlyRs: 20, collectedPercent: 0.5 };

function individual(over: Record<string, unknown> = {}) {
  return prisma.partnerApplication.create({
    data: {
      applicantType: "INDIVIDUAL",
      name: "Suresh Gowda",
      email: "suresh@example.com",
      mobile: "9845000001",
      town: "Doddaballapur",
      address: "12, 3rd Cross, Doddaballapur 561203",
      pan: "ABCPE1234F",
      ...over,
    },
  });
}

function company(over: Record<string, unknown> = {}) {
  return prisma.partnerApplication.create({
    data: {
      applicantType: "COMPANY",
      name: "Meena Rao",
      email: "ops@finbuddy.example",
      mobile: "9845000010",
      town: "Bengaluru",
      address: "80 Feet Road, Koramangala, Bengaluru 560034",
      companyName: "FinBuddy Services Pvt Ltd",
      ...over,
    },
  });
}

/** The signing token, as the applicant would read it from the logged email. */
async function linkTokenFor(applicationId: string, template = "agreement_sent"): Promise<string> {
  const email = await prisma.emailMessage.findFirstOrThrow({ where: { applicationId, template }, orderBy: { createdAt: "desc" } });
  const m = email.bodyHtml?.match(/\/agreement\/([A-Za-z0-9_-]+)/);
  if (!m) throw new Error("no signing link in the email");
  return m[1];
}

const hash = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");

db("partner agreement: send, resend, reject (database)", () => {
  beforeEach(async () => {
    delete process.env.EMAIL_MODE;
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE partner_applications, agreement_files, email_messages RESTART IDENTITY CASCADE`);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("parses payout rates from the form: blank is null, anything else must be a number", () => {
    expect(parseRates("DSA", { perQualifiedLeadRs: "1,000", disbursedPercent: "", disbursedFlatRs: "500" })).toEqual({
      perQualifiedLeadRs: 1000,
      disbursedPercent: null,
      disbursedFlatRs: 500,
    });
    expect(() => parseRates("BC", { disbursedPercent: "abc" })).toThrow(/must be numbers/);
    expect(() => parseRates("DSA", { disbursedPercent: "1", disbursedFlatRs: "500" })).toThrow(/not both/);
  });

  it("uses placeholders for Yellow Metal's name until it is configured", () => {
    delete process.env.COMPANY_LEGAL_NAME;
    expect(companyDetails().name).toBe("[Yellow Metal legal name]");
  });

  it("sends an individual the BC agreement: exact PDF stored, link hashed, email logged, history written", async () => {
    const app = await individual();
    const res = await sendAgreement(app.id, BC_RATES, ADMIN);
    expect(res).toMatchObject({ emailStatus: "LOGGED", email: "suresh@example.com" });

    const after = await prisma.partnerApplication.findUniqueOrThrow({ where: { id: app.id } });
    expect([after.status, after.reviewedBy]).toEqual(["AGREEMENT_SENT", ADMIN]);

    const agreement = await prisma.partnerAgreement.findUniqueOrThrow({ where: { id: res.agreementId } });
    expect([agreement.template, agreement.templateVersion, agreement.status, agreement.sentBy]).toEqual(["BC", "bc-v1", "SENT", ADMIN]);
    expect(agreement.fields).toMatchObject({ partnerName: "Suresh Gowda", partnerPan: "ABCPE1234F", rates: BC_RATES });
    const days = (agreement.tokenExpiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThan(14.1);

    const pdf = await readAgreementFile(agreement.unsignedFileId, agreement.unsignedSha256);
    expect(sha256(pdf)).toBe(agreement.unsignedSha256);

    const token = await linkTokenFor(app.id);
    expect(agreement.tokenHash).toBe(hash(token));
    expect(JSON.stringify(agreement)).not.toContain(token);

    const events = await prisma.partnerApplicationEvent.findMany({ where: { applicationId: app.id } });
    expect(events.map((e) => [e.action, e.actor])).toEqual([["agreement_sent", ADMIN]]);
  });

  it("sends a company the DSA agreement in the company's name", async () => {
    const app = await company();
    const res = await sendAgreement(app.id, DSA_RATES, ADMIN);
    const agreement = await prisma.partnerAgreement.findUniqueOrThrow({ where: { id: res.agreementId } });
    expect([agreement.template, (agreement.fields as { partnerName: string }).partnerName]).toEqual(["DSA", "FinBuddy Services Pvt Ltd"]);
  });

  it("previews without storing or sending anything", async () => {
    const app = await company();
    const pdf = await previewAgreement(app.id, DSA_RATES);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(await prisma.partnerAgreement.count()).toBe(0);
    expect(await prisma.emailMessage.count()).toBe(0);
  });

  it("sends only once, even when two admins press Send together", async () => {
    const app = await individual();
    const results = await Promise.allSettled([sendAgreement(app.id, BC_RATES, ADMIN), sendAgreement(app.id, BC_RATES, "other@ym.example")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.partnerAgreement.count()).toBe(1);
    await expect(sendAgreement(app.id, BC_RATES, ADMIN)).rejects.toThrow(/already sent/);
  });

  it("refuses an application from before the new form, which has no email or address", async () => {
    const old = await prisma.partnerApplication.create({ data: { name: "Old", mobile: "9845000005", town: "Malur" } });
    await expect(sendAgreement(old.id, BC_RATES, ADMIN)).rejects.toThrow(/apply again/);
    expect((await prisma.partnerApplication.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("PENDING");
  });

  it("resend voids the old link, issues a new one, and can change the rates", async () => {
    const app = await individual();
    const first = await sendAgreement(app.id, BC_RATES, ADMIN);
    const oldToken = await linkTokenFor(app.id);

    const second = await resendAgreement(app.id, ADMIN, { ...BC_RATES, perVerifiedApplicationRs: 200 });
    const newToken = await linkTokenFor(app.id, "agreement_resent");
    expect(newToken).not.toBe(oldToken);

    const old = await prisma.partnerAgreement.findUniqueOrThrow({ where: { id: first.agreementId } });
    const fresh = await prisma.partnerAgreement.findUniqueOrThrow({ where: { id: second.agreementId } });
    expect([old.status, old.voidReason]).toEqual(["VOID", "resent"]);
    expect([fresh.status, fresh.tokenHash]).toEqual(["SENT", hash(newToken)]);
    expect((fresh.fields as { rates: typeof BC_RATES }).rates.perVerifiedApplicationRs).toBe(200);

    // Without new rates, a resend keeps the last ones.
    const third = await resendAgreement(app.id, ADMIN);
    expect(((await prisma.partnerAgreement.findUniqueOrThrow({ where: { id: third.agreementId } })).fields as { rates: typeof BC_RATES }).rates.perVerifiedApplicationRs).toBe(200);
    expect(await prisma.partnerAgreement.count({ where: { status: { not: "VOID" } } })).toBe(1);
  });

  it("can't resend once signed, or before anything was sent", async () => {
    const app = await individual();
    await expect(resendAgreement(app.id, ADMIN)).rejects.toThrow(/no unsigned agreement/);
    await sendAgreement(app.id, BC_RATES, ADMIN);
    await prisma.partnerAgreement.updateMany({ data: { status: "SIGNED" } });
    await prisma.partnerApplication.update({ where: { id: app.id }, data: { status: "SIGNED" } });
    await expect(resendAgreement(app.id, ADMIN)).rejects.toThrow(/already signed/);
  });

  it("reject works at any step before approval, voids the agreement and emails the reason", async () => {
    const app = await individual();
    await sendAgreement(app.id, BC_RATES, ADMIN);
    await rejectApplication(app.id, "  Outside our branches  ", ADMIN);

    const after = await prisma.partnerApplication.findUniqueOrThrow({ where: { id: app.id } });
    expect([after.status, after.rejectReason]).toEqual(["REJECTED", "Outside our branches"]);
    expect(await prisma.partnerAgreement.count({ where: { status: "VOID", voidReason: "rejected" } })).toBe(1);
    const email = await prisma.emailMessage.findFirstOrThrow({ where: { template: "rejected" } });
    expect(email.bodyHtml).toContain("Outside our branches");

    await expect(rejectApplication(app.id, "again", ADMIN)).rejects.toThrow(ApplicationError);
    await expect(rejectApplication((await company()).id, "   ", ADMIN)).rejects.toThrow(/reason/);
  });

  it("lists by status with the link expiry, counts each status, and never exposes the token hash", async () => {
    const a = await individual();
    await company();
    await sendAgreement(a.id, BC_RATES, ADMIN);

    const sent = await listApplications("AGREEMENT_SENT");
    expect(sent).toHaveLength(1);
    expect(sent[0].linkExpiresAt).toBeInstanceOf(Date);
    expect(await countApplications()).toMatchObject({ PENDING: 1, AGREEMENT_SENT: 1, SIGNED: 0 });

    const detail = await getApplication(a.id);
    expect(detail?.template).toBe("BC");
    expect(detail?.agreement?.status).toBe("SENT");
    expect(detail?.agreement).not.toHaveProperty("tokenHash");
    expect(detail?.events.map((e) => e.action)).toEqual(["agreement_sent"]);
    expect(await getApplication("missing")).toBeNull();
  });
});
