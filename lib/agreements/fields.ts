import { z } from "zod";

// =============================================================================
// What goes into a partner agreement (plan of 27 Oct 2026). Individuals sign
// the Business Correspondent (BC) agreement, companies the Direct Selling Agent
// (DSA) agreement. The wording lives in templates.ts under a version id; these
// are the values filled into it, stored as-is on partner_agreements.fields so
// the same PDF can be rendered again.
// =============================================================================

export const AGREEMENT_TEMPLATES = ["DSA", "BC"] as const;
export type AgreementTemplate = (typeof AGREEMENT_TEMPLATES)[number];

/** The wording each template renders today. A wording change is a new version. */
export const TEMPLATE_VERSIONS: Record<AgreementTemplate, string> = { DSA: "dsa-v1", BC: "bc-v1" };

export const TEMPLATE_TITLES: Record<AgreementTemplate, string> = {
  DSA: "Direct Selling Agent (DSA) Agreement",
  BC: "Business Correspondent (BC) Agreement",
};

/** INDIVIDUAL → BC, COMPANY → DSA. */
export function templateFor(applicantType: string): AgreementTemplate {
  return applicantType === "COMPANY" ? "DSA" : "BC";
}

const rupees = z.number().nonnegative("Must be zero or more.").max(10_000_000).nullable();
const percent = z.number().nonnegative("Must be zero or more.").max(100, "Must be 100 or less.").nullable();

/** Annexure A of the DSA agreement. The disbursal payout is a percentage or a flat amount, not both. */
export const dsaRates = z
  .object({
    perQualifiedLeadRs: rupees,
    disbursedPercent: percent,
    disbursedFlatRs: rupees,
  })
  .refine((r) => r.disbursedPercent === null || r.disbursedFlatRs === null, {
    message: "Give the disbursal payout as a percentage or a flat amount, not both.",
    path: ["disbursedFlatRs"],
  });
export type DsaRates = z.infer<typeof dsaRates>;

/** Schedule B of the BC agreement. */
export const bcRates = z.object({
  perVerifiedApplicationRs: rupees,
  disbursedPercent: percent,
  perActiveLoanMonthlyRs: rupees,
  collectedPercent: percent,
});
export type BcRates = z.infer<typeof bcRates>;

const common = {
  /** YYYY-MM-DD, the "Effective Date". */
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  companyName: z.string().trim().min(2).max(200),
  companyOffice: z.string().trim().min(5).max(400),
  partnerName: z.string().trim().min(2).max(200),
  partnerAddress: z.string().trim().min(5).max(400),
};

export const agreementFields = z.discriminatedUnion("template", [
  z.object({ template: z.literal("DSA"), ...common, rates: dsaRates }),
  z.object({ template: z.literal("BC"), ...common, partnerPan: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/), rates: bcRates }),
]);
export type AgreementFields = z.infer<typeof agreementFields>;

/** Blank rates: the agreement shows the template's blanks until an admin fills them. */
export const BLANK_RATES = {
  DSA: { perQualifiedLeadRs: null, disbursedPercent: null, disbursedFlatRs: null } satisfies DsaRates,
  BC: { perVerifiedApplicationRs: null, disbursedPercent: null, perActiveLoanMonthlyRs: null, collectedPercent: null } satisfies BcRates,
};

/** A signature block once signed: the name as typed (or the countersigner's), and when. */
export type Signature = { name: string; at: Date; designation?: string | null };

/** The evidence printed on the executed agreement's last page. */
export type SigningCertificate = {
  reference: string;
  templateVersion: string;
  unsignedSha256: string;
  sentBy: string;
  sentAt: Date;
  partner: { typedName: string; email: string; signedAt: Date; ip: string | null; userAgent: string | null };
  company: { name: string; designation: string | null; email: string; signedAt: Date };
};
