// Writes sample partner agreements for review: the DSA and BC agreements as sent
// for signing, and as executed (both signatures and the signing certificate).
//
//   npm run agreements:samples -- <output folder>
//
// Every name, address and rate here is made up. Yellow Metal's legal name and
// registered office come from COMPANY_LEGAL_NAME / COMPANY_REGISTERED_OFFICE
// when set, otherwise a placeholder.
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

import { TEMPLATE_VERSIONS, type AgreementFields } from "../lib/agreements/fields";
import { renderAgreement, sha256 } from "../lib/agreements/render";

const out = process.argv[2];
if (!out) {
  console.error("Usage: npm run agreements:samples -- <output folder>");
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const companyName = process.env.COMPANY_LEGAL_NAME?.trim() || "[Yellow Metal legal name]";
const companyOffice = process.env.COMPANY_REGISTERED_OFFICE?.trim() || "[Yellow Metal registered office address]";

const samples: { file: string; fields: AgreementFields; email: string }[] = [
  {
    file: "SAMPLE-DSA-agreement",
    email: "ops@samplefinserv.example",
    fields: {
      template: "DSA",
      effectiveDate: "2026-10-27",
      companyName,
      companyOffice,
      partnerName: "SAMPLE FinServ Private Limited",
      partnerAddress: "4th Floor, 80 Feet Road, Koramangala, Bengaluru, Karnataka 560034",
      rates: { perQualifiedLeadRs: 100, disbursedPercent: 1, disbursedFlatRs: null },
    },
  },
  {
    file: "SAMPLE-BC-agreement",
    email: "suresh.sample@example.com",
    fields: {
      template: "BC",
      effectiveDate: "2026-10-27",
      companyName,
      companyOffice,
      partnerName: "Suresh Sample Gowda",
      partnerAddress: "12, 3rd Cross, Old Bus Stand Road, Doddaballapur, Karnataka 561203",
      partnerPan: "ABCPE1234F",
      rates: { perVerifiedApplicationRs: 150, disbursedPercent: 0.75, perActiveLoanMonthlyRs: 20, collectedPercent: 0.5 },
    },
  },
];

async function main() {
  for (const s of samples) {
    const reference = `sample-${s.fields.template.toLowerCase()}`;
    const unsigned = await renderAgreement(s.fields, { reference });
    const sentAt = new Date("2026-10-27T10:30:00Z");
    const partner = { name: s.fields.partnerName.replace(/ Private Limited$/, " (by Meena Rao)"), at: new Date("2026-10-27T11:05:00Z") };
    const company = { name: "Sample Signatory", designation: "Authorised Signatory", at: new Date("2026-10-27T12:40:00Z") };
    const executed = await renderAgreement(s.fields, {
      reference,
      partner,
      company,
      certificate: {
        reference,
        templateVersion: TEMPLATE_VERSIONS[s.fields.template],
        unsignedSha256: sha256(unsigned),
        sentBy: "admin@yellowmetal.example",
        sentAt,
        partner: { typedName: partner.name, email: s.email, signedAt: partner.at, ip: "203.0.113.24", userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile" },
        company: { name: company.name, designation: company.designation, email: "admin@yellowmetal.example", signedAt: company.at },
      },
    });
    writeFileSync(path.join(out, `${s.file}-to-sign.pdf`), unsigned);
    writeFileSync(path.join(out, `${s.file}-executed.pdf`), executed);
    console.log(`${s.file}: to sign ${unsigned.length} bytes, executed ${executed.length} bytes`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
