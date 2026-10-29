import { describe, it, expect, afterAll } from "vitest";

import { BLANK_RATES, agreementFields, templateFor, type AgreementFields } from "@/lib/agreements/fields";
import { effectiveDateParts, indianNumber, istDate, istTimestamp, ordinal } from "@/lib/agreements/format";
import { renderAgreement, sha256 } from "@/lib/agreements/render";
import { AgreementFileError, readAgreementFile, storeAgreementFile } from "@/lib/agreements/files";
import { prisma } from "@/lib/prisma";

// Partner agreements (plan of 27 Oct 2026): the DSA and BC templates, their
// fields, and deterministic rendering (the unsigned PDF's hash is evidence).
// The file store needs TEST_DATABASE_URL and skips without it.
const db = process.env.TEST_DATABASE_URL?.trim() ? describe : describe.skip;

const dsa: AgreementFields = {
  template: "DSA",
  effectiveDate: "2026-10-27",
  companyName: "Yellow Metal Test Pvt Ltd",
  companyOffice: "1 Test Road, Bengaluru 560001",
  partnerName: "FinBuddy Services Pvt Ltd",
  partnerAddress: "80 Feet Road, Koramangala, Bengaluru 560034",
  rates: { perQualifiedLeadRs: 100, disbursedPercent: 1, disbursedFlatRs: null },
};
const bc: AgreementFields = {
  template: "BC",
  effectiveDate: "2026-10-27",
  companyName: "Yellow Metal Test Pvt Ltd",
  companyOffice: "1 Test Road, Bengaluru 560001",
  partnerName: "Suresh Gowda",
  partnerAddress: "12, 3rd Cross, Doddaballapur 561203",
  partnerPan: "ABCPE1234F",
  rates: BLANK_RATES.BC,
};

describe("agreement fields", () => {
  it("individuals sign the BC agreement, companies the DSA", () => {
    expect([templateFor("INDIVIDUAL"), templateFor("COMPANY")]).toEqual(["BC", "DSA"]);
  });

  it("accepts both templates and refuses a DSA disbursal payout given as both % and flat", () => {
    expect(agreementFields.parse(dsa)).toEqual(dsa);
    expect(agreementFields.parse(bc)).toEqual(bc);
    const both = { ...dsa, rates: { perQualifiedLeadRs: null, disbursedPercent: 1, disbursedFlatRs: 500 } };
    expect(agreementFields.safeParse(both).success).toBe(false);
    expect(agreementFields.safeParse({ ...bc, partnerPan: "1234" }).success).toBe(false);
    expect(agreementFields.safeParse({ ...dsa, rates: { ...dsa.rates, disbursedPercent: 120 } }).success).toBe(false);
  });
});

describe("agreement formatting", () => {
  it("writes the effective date the way the agreement does", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "31st"]);
    expect(effectiveDateParts("2026-10-27")).toEqual({ day: "27th", month: "October", year: "2026" });
  });

  it("shows times in IST and amounts with Indian grouping", () => {
    expect(istTimestamp(new Date("2026-10-27T10:35:00Z"))).toBe("27 Oct 2026, 4:05 pm IST");
    expect(istTimestamp(new Date("2026-10-26T18:30:00Z"))).toBe("27 Oct 2026, 12:00 am IST");
    expect(istDate(new Date("2026-10-26T19:00:00Z"))).toBe("2026-10-27");
    expect([0, 100, 1500, 150000, 15000000, 0.75, 1234.5].map(indianNumber)).toEqual(["0", "100", "1,500", "1,50,000", "1,50,00,000", "0.75", "1,234.5"]);
  });
});

describe("renderAgreement", () => {
  it("is deterministic, and any change to the fields changes the fingerprint", async () => {
    const a = await renderAgreement(dsa, { reference: "ref-1" });
    const b = await renderAgreement(dsa, { reference: "ref-1" });
    expect(a.subarray(0, 5).toString()).toBe("%PDF-");
    expect(sha256(a)).toBe(sha256(b));
    const other = await renderAgreement({ ...dsa, partnerName: "FinBuddy Services Private Ltd" }, { reference: "ref-1" });
    expect(sha256(other)).not.toBe(sha256(a));
  });

  it("renders the BC agreement with blanks, and the executed copy with signatures and a certificate page", async () => {
    const unsigned = await renderAgreement(bc, { reference: "ref-2" });
    const at = new Date("2026-10-27T11:00:00Z");
    const executed = await renderAgreement(bc, {
      reference: "ref-2",
      partner: { name: "Suresh Gowda", at },
      company: { name: "Rahul B", designation: "Director", at },
      certificate: {
        reference: "ref-2",
        templateVersion: "bc-v1",
        unsignedSha256: sha256(unsigned),
        sentBy: "admin@ym.example",
        sentAt: at,
        partner: { typedName: "Suresh Gowda", email: "s@example.com", signedAt: at, ip: null, userAgent: null },
        company: { name: "Rahul B", designation: "Director", email: "admin@ym.example", signedAt: at },
      },
    });
    const pages = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
    expect(pages(executed)).toBe(pages(unsigned) + 1);
  });
});

db("agreement file store (database)", () => {
  afterAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE partner_agreements, agreement_files CASCADE`);
    await prisma.$disconnect();
  });

  it("stores the bytes with their hash and reads them back only while they still match", async () => {
    const pdf = await renderAgreement(dsa, { reference: "ref-3" });
    const { id, sha256: hash } = await storeAgreementFile(pdf);
    expect(hash).toBe(sha256(pdf));
    expect((await readAgreementFile(id, hash)).equals(pdf)).toBe(true);
    await expect(readAgreementFile(id, "0".repeat(64))).rejects.toThrow(AgreementFileError);

    await prisma.agreementFile.update({ where: { id }, data: { bytes: Buffer.concat([pdf, Buffer.from(" ")]) } });
    await expect(readAgreementFile(id)).rejects.toThrow(/does not match/);
    await expect(readAgreementFile("missing")).rejects.toThrow(/missing/);
  });
});
