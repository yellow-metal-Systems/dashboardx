import type { Content, ContentText } from "pdfmake/interfaces";

import { effectiveDateParts, indianNumber, istTimestamp } from "./format";
import type { AgreementFields, BcRates, DsaRates, Signature, SigningCertificate } from "./fields";

// =============================================================================
// The two partner agreements, word for word from the documents Rahul shared
// (Downloads/DSA Agreement.docx and BUSINESS CORRESPONDENT (BC) AGREEMENT.pdf,
// 27 Oct 2026). Only the blanks are filled; the bracketed terms ([1 Year],
// [Monthly], [30 days], [90 days]) are printed as written, without brackets.
// Left out: the "1." / "2." before each title, left over from a combined
// document, and the BC PDF's empty bullet lines.
//
// Any change to this wording is a new version (TEMPLATE_VERSIONS in fields.ts):
// a signed agreement must always render from the wording it was signed on.
// =============================================================================

const BLANK = "_____";
const LINE = "____________________________________";

type Run = string | ContentText;

const para = (...text: Run[]): Content => ({ text, style: "body" });
const heading = (text: string): Content => ({ text, style: "heading" });
const labelled = (label: string, text: string): Content => ({ text: [{ text: `${label}: `, bold: true }, text], style: "item" });
const filled = (value: string): ContentText => ({ text: value, bold: true });

const rs = (n: number | null) => (n === null ? `Rs. ${BLANK}` : `Rs. ${indianNumber(n)}`);
const pct = (n: number | null) => (n === null ? `${BLANK} %` : `${indianNumber(n)} %`);

function scopeBox(text: string): Content {
  return {
    table: { widths: ["*"], body: [[{ text: [{ text: "Scope: ", bold: true }, text], style: "scope" }]] },
    layout: {
      fillColor: () => "#EEF2F7",
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [0, 0, 0, 12],
  };
}

function title(main: string, sub: string): Content[] {
  return [
    { text: main, style: "title" },
    { text: sub, style: "subtitle" },
  ];
}

function executedOn(f: AgreementFields, kind: string): Content {
  const d = effectiveDateParts(f.effectiveDate);
  return para(
    `This ${kind} ("`,
    { text: "Agreement", bold: true },
    '") is executed on this ',
    filled(d.day),
    " day of ",
    filled(d.month),
    ", ",
    filled(d.year),
    ' ("',
    { text: "Effective Date", bold: true },
    '"), by and between:',
  );
}

function companyParty(f: AgreementFields): Content {
  return para(
    { text: "THE PLATFORM / COMPANY: ", bold: true },
    filled(f.companyName),
    ", a company incorporated under the laws of India, having its registered office at ",
    filled(f.companyOffice),
    ' (hereinafter referred to as the "',
    { text: "Company", bold: true },
    '");',
  );
}

function table(head: string[], rows: string[][], widths: string[]): Content {
  return {
    table: {
      headerRows: 1,
      widths,
      body: [head.map((h) => ({ text: h, bold: true, fillColor: "#EEF2F7" })), ...rows],
    },
    layout: {
      hLineColor: () => "#C9D3E0",
      vLineColor: () => "#C9D3E0",
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    style: "table",
    margin: [0, 4, 0, 16],
  };
}

/** The two signature blocks side by side. Unsigned blocks keep the template's line. */
function signatures(partnerLabel: string, partnerCaption: string, company?: Signature, partner?: Signature): Content {
  const block = (label: string, caption: string, sig?: Signature): Content => ({
    stack: [
      { text: label, bold: true, margin: [0, 0, 0, 18] },
      sig
        ? {
            stack: [
              { text: "Signed electronically by", style: "small" },
              { text: sig.name, bold: true },
              // Always a line, so both signature lines sit at the same height.
              { text: sig.designation || " ", style: "small" },
              { text: istTimestamp(sig.at), style: "small" },
            ],
            margin: [0, 0, 0, 2],
          }
        : { text: " ", margin: [0, 0, 0, 36] },
      { text: LINE },
      { text: caption, margin: [0, 4, 0, 0] },
    ],
  });
  return {
    columns: [block("For the Company:", "Authorized Signatory", company), block(partnerLabel, partnerCaption, partner)],
    columnGap: 40,
    margin: [0, 24, 0, 0],
    unbreakable: true,
  };
}

function dsaBody(f: Extract<AgreementFields, { template: "DSA" }>, company?: Signature, partner?: Signature): Content[] {
  const r: DsaRates = f.rates;
  const disbursal =
    r.disbursedFlatRs !== null
      ? `${rs(r.disbursedFlatRs)} flat`
      : r.disbursedPercent !== null
        ? `${pct(r.disbursedPercent)} of Disbursed Amount`
        : `${BLANK} % of Disbursed Amount / Rs. ${BLANK} flat`;
  return [
    ...title("DIRECT SELLING AGENT (DSA) AGREEMENT", "(Lead Generation & Sourcing Partner)"),
    scopeBox(
      "This Agreement governs DSAs who strictly source, generate, and pass prospective Gold Loan leads to the Company via the App. DSAs do not engage in physical gold handling, evaluation, document verification, or loan lifecycle management.",
    ),
    executedOn(f, "Direct Selling Agent Agreement"),
    companyParty(f),
    { text: "AND", style: "body", bold: true },
    para(
      { text: "THE DIRECT SELLING AGENT (DSA): ", bold: true },
      filled(f.partnerName),
      ", having address / registered office at ",
      filled(f.partnerAddress),
      ' (hereinafter referred to as the "',
      { text: "DSA", bold: true },
      '").',
    ),

    heading("1. SCOPE OF SERVICES"),
    labelled("Lead Sourcing & Generation", "The DSA shall identify and source prospective borrowers interested in obtaining gold loans through the Company's mobile application (\"App\")."),
    labelled("Information Submission", "The DSA shall enter basic customer contact details and preliminary requirements into the App."),
    labelled("No Execution / Management", "The DSA's sole involvement ends upon submitting a valid lead via the App. The DSA shall not collect documents, inspect gold, manage loan accounts, or participate in loan collection or recovery."),

    heading("2. OBLIGATIONS & RESTRICTIONS OF THE DSA"),
    labelled("Accuracy of Leads", "Ensure that all contact details and information entered into the App are collected with customer consent and are accurate."),
    labelled("No Cash / Gold Handling", "The DSA is strictly prohibited from accepting, receiving, or handling cash, fees, or physical gold ornaments from prospective borrowers under any circumstances."),
    labelled("Non-Exclusivity", "This agreement is on a non-exclusive basis."),
    labelled("Brand Usage", "The DSA shall not use the Company's name, logo, or trademark without prior written consent."),

    heading("3. COMMISSIONS AND PAYMENTS"),
    labelled("Payout Basis", "The Company shall pay the DSA a referral commission solely for leads that result in successful loan disbursals, as detailed in Annexure A."),
    labelled("Settlement", "Commissions will be reconciled and remitted on a Monthly basis into the bank account specified by the DSA."),
    labelled("Tax Deduction", "Payments are subject to statutory Tax Deducted at Source (TDS) as per applicable tax laws."),

    heading("4. CONFIDENTIALITY AND DATA PRIVACY"),
    para("The DSA shall strictly maintain the confidentiality of all customer contact data and proprietary app information. The DSA shall not retain, share, sell, or copy any lead data outside the App."),

    heading("5. TERM AND TERMINATION"),
    para("This Agreement shall remain valid for 1 Year and may be terminated by either Party by giving 15 days' written notice, or immediately by the Company in case of misrepresentation, fraud, or policy violation."),

    { text: "ANNEXURE A: DSA PAYOUT STRUCTURE", style: "annex" },
    table(
      ["Trigger Event", "Validation Criteria", "Commission / Payout Rate"],
      [
        ["Qualified Lead Submission", "Lead passes internal phone/KYC check", `${rs(r.perQualifiedLeadRs)} per qualified lead`],
        ["Disbursed Gold Loan", "Loan successfully disbursed via App", disbursal],
      ],
      ["*", "*", "*"],
    ),
    signatures("For the DSA:", "Authorized Signatory / Individual", company, partner),
  ];
}

function bcBody(f: Extract<AgreementFields, { template: "BC" }>, company?: Signature, partner?: Signature): Content[] {
  const r: BcRates = f.rates;
  const numbered = (n: number, label: string, text: string): Content => ({
    text: [`${n}. `, { text: `${label}: `, bold: true }, text],
    style: "item",
  });
  return [
    ...title("BUSINESS CORRESPONDENT (BC) AGREEMENT", "(End-to-End Gold Loan Lifecycle Operations & Management Agent)"),
    scopeBox(
      "This Agreement governs Individual Business Correspondents (BCs) responsible for managing the full lifecycle of gold loans—including customer verification, physical gold assessment assistance, loan documentation support, doorstep servicing, customer support, and repayment/recovery assistance via the App.",
    ),
    executedOn(f, "Business Correspondent Agreement"),
    companyParty(f),
    { text: "AND", style: "body", bold: true },
    para(
      { text: "THE BUSINESS CORRESPONDENT (BC AGENT): ", bold: true },
      filled(f.partnerName),
      ", residing at ",
      filled(f.partnerAddress),
      ", Govt ID / Aadhaar / PAN: ",
      filled(`PAN ${f.partnerPan}`),
      ' (hereinafter referred to as the "',
      { text: "BC Agent", bold: true },
      '").',
    ),

    heading("1. END-TO-END GOLD LOAN LIFECYCLE SCOPE"),
    para("The BC Agent is onboarded as an individual operator to manage gold loans throughout their complete lifecycle via the Company's Loan Management App, covering:"),
    numbered(1, "Sourcing & Onboarding", "Identifying borrowers, explaining loan terms, and completing digital onboarding."),
    numbered(2, "Identity & Field Verification", "Conducting physical/doorstep KYC checks and address verifications."),
    numbered(3, "Gold Collateral Handling & Inspection Assistance", "Assisting authorized gold appraisers/the App workflow during physical gold weighing, purity testing, and secure pouching protocols."),
    numbered(4, "Loan Servicing & Account Management", "Acting as the primary point of contact for borrower queries, loan renewals, top-ups, and balance requests."),
    numbered(5, "Repayment & Recovery Assistance", "Facilitating timely interest/principal repayments via app-generated UPI/payment links and conducting field follow-ups for delinquent accounts under strict compliance with fair practice codes."),

    heading("2. BC AGENT OPERATIONAL OBLIGATIONS"),
    labelled("Strict App Compliance", "Perform all lifecycle actions (verifications, uploads, customer updates, repayment tracking) exclusively through the designated BC Mobile App module."),
    labelled("Compliance with Gold Handling & Safety Protocols", "Follow company-mandated safety procedures, tamper-evident sealing, and dual-custody rules whenever participating in doorstep gold evaluation or transportation assistance."),
    labelled("Fair Practice & Collection Code", "Strictly adhere to the RBI Fair Practices Code. The BC Agent shall not use coercive, abusive, or intimidating methods for loan servicing or recovery."),
    labelled("No Unauthorized Cash Retention", "All financial transactions must be completed digitally via the App. No cash shall be held or collected unless explicitly authorized in writing with an automated app receipt."),

    heading("3. COMMISSIONS, INCENTIVES & CLAWBACK"),
    { text: [{ text: "Fee Structure: ", bold: true }, "The Company shall compensate the BC Agent according to the lifecycle milestone rates set in ", { text: "Schedule B", bold: true }, "."], style: "item" },
    labelled("Clawback & Penalty", "In the event of fraudulent gold appraisal assistance, fake KYC submissions, or deliberate misrepresentation leading to loan default within 90 days, the Company reserves the right to claw back commissions and initiate legal proceedings."),

    heading("4. CONFIDENTIALITY, SECURITY & DATA PROTECTION"),
    para("The BC Agent shall keep all borrower records, gold valuation logs, and app credentials strictly confidential. Unauthorized copying or sharing of borrower personal data is grounds for immediate termination and legal action."),

    heading("5. INDEMNIFICATION & LIABILITY"),
    para("The BC Agent shall fully indemnify the Company against any financial loss, theft, fraud, gross negligence, or regulatory violation caused by the BC Agent during field operations, gold handling, or customer interactions."),

    heading("6. TERM, TERMINATION & GOVERNING LAW"),
    para("This Agreement is valid for 1 Year and renewable subject to performance. Either party may terminate with 30 days notice. Immediate termination applies in cases of fraud or misconduct. Disputes shall be resolved through arbitration under Indian laws."),

    { text: "SCHEDULE B: BC LIFECYCLE PAYOUT MATRIX", style: "annex" },
    table(
      ["Lifecycle Stage", "BC Action / Milestone", "Payout / Incentive Rate"],
      [
        ["1. Sourcing & Verification", "Completed digital KYC & physical verification", `${rs(r.perVerifiedApplicationRs)} per verified application`],
        ["2. Disbursal & Gold Evaluation", "Successful gold evaluation assistance & disbursal", `${pct(r.disbursedPercent)} of Disbursed Loan Value`],
        ["3. Portfolio Servicing", "Regular loan account management & servicing", `${rs(r.perActiveLoanMonthlyRs)} per active loan / month`],
        ["4. Interest Collection / Recovery", "On-time interest payment collection via app link", `${pct(r.collectedPercent)} of Collected Amount`],
      ],
      ["*", "*", "*"],
    ),
    signatures("For the BC Agent:", "Individual BC Signatory / Signature", company, partner),
  ];
}

/** The last page of an executed agreement: what was signed, by whom, when, from where. */
export function certificatePage(c: SigningCertificate): Content[] {
  const row = (k: string, v: string): Content[] => [{ text: k, style: "small", color: "#4A5568" }, { text: v, style: "small" }];
  return [
    { text: "Signing certificate", style: "title", pageBreak: "before", alignment: "left" },
    para(
      "This agreement was signed electronically. The partner opened a single-use link sent to their email address, read the agreement, typed their full name and confirmed their agreement. Yellow Metal then countersigned. The fingerprint below identifies the exact document the partner was shown; any change to its text would change the fingerprint.",
    ),
    {
      table: {
        widths: [150, "*"],
        body: [
          row("Agreement reference", c.reference),
          row("Template version", c.templateVersion),
          row("Fingerprint of the document sent (SHA-256)", c.unsignedSha256),
          row("Sent by", c.sentBy),
          row("Sent at", istTimestamp(c.sentAt)),
          row("Partner signed as", c.partner.typedName),
          row("Partner email (signing link sent to)", c.partner.email),
          row("Partner signed at", istTimestamp(c.partner.signedAt)),
          row("Partner IP address", c.partner.ip ?? "Not recorded"),
          row("Partner device", c.partner.userAgent ?? "Not recorded"),
          row("Countersigned for the Company by", c.company.designation ? `${c.company.name}, ${c.company.designation}` : c.company.name),
          row("Countersigner login", c.company.email),
          row("Countersigned at", istTimestamp(c.company.signedAt)),
        ],
      },
      layout: { hLineWidth: (i: number) => (i === 0 ? 0 : 0.5), vLineWidth: () => 0, hLineColor: () => "#C9D3E0" },
      margin: [0, 8, 0, 0],
    },
  ];
}

export function agreementContent(f: AgreementFields, company?: Signature, partner?: Signature): Content[] {
  return f.template === "DSA" ? dsaBody(f, company, partner) : bcBody(f, company, partner);
}
