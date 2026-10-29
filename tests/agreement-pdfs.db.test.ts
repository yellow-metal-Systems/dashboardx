import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

// The routes check the staff session through staffWithPermission; here it is
// a switch the tests flip. Everything else is real, against the test database.
const access = vi.hoisted(() => ({ allowed: true }));
vi.mock("@/lib/auth/session", () => ({
  staffWithPermission: async () => (access.allowed ? { userId: "u1", email: "boss@ym.example", name: "Rahul Boss", role: "admin" } : null),
}));

import { prisma } from "@/lib/prisma";
import { agreementPdf, countersignAndApprove, sendAgreement } from "@/lib/partners/applications";
import { AgreementFileError } from "@/lib/agreements/files";
import { sha256 } from "@/lib/agreements/render";
import { GET as pdfRoute } from "@/app/dashboard/partners/applications/[id]/agreement/route";
import { GET as previewRoute } from "@/app/dashboard/partners/applications/[id]/agreement/preview/route";

// Partner agreement PDFs for staff (plan of 27 Oct 2026, step A8): the copy
// sent for signing, the executed copy, and a preview before sending.
// SKIPS without TEST_DATABASE_URL.
const db = process.env.TEST_DATABASE_URL?.trim() ? describe : describe.skip;

const ADMIN = "boss@ym.example";
const BC_RATES = { perVerifiedApplicationRs: 150, disbursedPercent: 0.75, perActiveLoanMonthlyRs: 20, collectedPercent: 0.5 };

function individual() {
  return prisma.partnerApplication.create({
    data: {
      applicantType: "INDIVIDUAL",
      name: "Suresh Gowda",
      email: "suresh@example.com",
      mobile: "9845000001",
      town: "Doddaballapur",
      address: "12, 3rd Cross, Doddaballapur 561203",
      pan: "ABCPE1234F",
    },
  });
}

/** Signs the sent agreement the way LeadBridge's signAgreement leaves the rows. */
async function sign(applicationId: string) {
  await prisma.partnerAgreement.updateMany({
    where: { applicationId, status: "SENT" },
    data: { status: "SIGNED", signerTypedName: "Suresh Gowda", signedAt: new Date(), signerIp: "203.0.113.24", signerUserAgent: "Test" },
  });
  await prisma.partnerApplication.update({ where: { id: applicationId }, data: { status: "SIGNED" } });
}

const get = (id: string, q = "") =>
  pdfRoute(new Request(`http://ld.test/dashboard/partners/applications/${id}/agreement${q}`), { params: { id } });
const preview = (id: string, q = "") =>
  previewRoute(new Request(`http://ld.test/dashboard/partners/applications/${id}/agreement/preview${q}`), { params: { id } });

db("partner agreement PDFs for staff (database)", () => {
  beforeEach(async () => {
    access.allowed = true;
    delete process.env.EMAIL_MODE;
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE partner_applications, agreement_files, email_messages, partner_invites, partner_users, partners, admin_users
      RESTART IDENTITY CASCADE`);
    await prisma.adminUser.create({ data: { email: ADMIN, name: "Rahul Boss", role: "admin", passwordHash: "x" } });
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("gives the sent copy once sent, and the executed copy only once countersigned", async () => {
    const app = await individual();
    expect(await agreementPdf(app.id, "sent")).toBeNull();

    await sendAgreement(app.id, BC_RATES, ADMIN);
    const sent = await agreementPdf(app.id, "sent");
    const a = await prisma.partnerAgreement.findFirstOrThrow({ where: { applicationId: app.id } });
    expect(sha256(sent!.bytes)).toBe(a.unsignedSha256);
    expect(sent!.fileName).toBe(`Yellow-Metal-BC-Agreement-${a.id.slice(0, 8)}.pdf`);
    expect(await agreementPdf(app.id, "executed")).toBeNull();

    await sign(app.id);
    await countersignAndApprove(app.id, { confirmed: true }, ADMIN);
    const executed = await agreementPdf(app.id, "executed");
    const done = await prisma.partnerAgreement.findUniqueOrThrow({ where: { id: a.id } });
    expect(sha256(executed!.bytes)).toBe(done.executedSha256);
    expect(executed!.fileName).toMatch(/-signed\.pdf$/);
  });

  it("refuses a stored file that no longer matches its fingerprint", async () => {
    const app = await individual();
    await sendAgreement(app.id, BC_RATES, ADMIN);
    const a = await prisma.partnerAgreement.findFirstOrThrow({ where: { applicationId: app.id } });
    await prisma.agreementFile.update({ where: { id: a.unsignedFileId }, data: { bytes: new Uint8Array(Buffer.from("%PDF-1.3 changed")) } });
    await expect(agreementPdf(app.id, "sent")).rejects.toThrow(AgreementFileError);
    expect((await get(app.id)).status).toBe(409);
  });

  it("the download route serves the PDF privately, and a plain 404 to staff without access", async () => {
    const app = await individual();
    expect((await get(app.id)).status).toBe(404);
    await sendAgreement(app.id, BC_RATES, ADMIN);

    const ok = await get(app.id);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(ok.headers.get("cache-control")).toContain("no-store");
    expect(ok.headers.get("x-robots-tag")).toContain("noindex");
    expect(ok.headers.get("content-disposition")).toMatch(/^inline; filename="Yellow-Metal-BC-Agreement-/);
    expect(Buffer.from(await ok.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
    expect((await get(app.id, "?download=1")).headers.get("content-disposition")).toMatch(/^attachment/);
    expect((await get(app.id, "?file=executed")).status).toBe(404);

    access.allowed = false;
    const denied = await get(app.id);
    expect(denied.status).toBe(404);
    expect(denied.headers.get("content-type")).not.toBe("application/pdf");
  });

  it("previews with the rates from the query string, storing nothing", async () => {
    const app = await individual();
    const ok = await preview(app.id, "?perVerifiedApplicationRs=150&disbursedPercent=0.75");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-disposition")).toMatch(/PREVIEW-Yellow-Metal-BC-Agreement\.pdf/);
    expect(await prisma.agreementFile.count()).toBe(0);
    expect(await prisma.partnerAgreement.count()).toBe(0);

    const bad = await preview(app.id, "?disbursedPercent=abc");
    expect([bad.status, await bad.text()]).toEqual([400, "Payout rates must be numbers."]);
    expect((await preview("missing")).status).toBe(404);
    access.allowed = false;
    expect((await preview(app.id)).status).toBe(404);
  });
});
