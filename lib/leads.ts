export type LeadStatus = "New" | "Contacted" | "Converted" | "Rejected";
export type LeadSource = "PARTNER" | "AARTHIKLABS";
export type AcceptanceState = "NA" | "ACCEPTED" | "EXPIRED_UNACCEPTED";
export type BranchManagerStatus = "NOT_SENT" | "SENT" | "CONFIRMED" | "DECLINED";

export type LeadPartner = {
  id: string;
  orgName: string;
  contactEmail: string;
};

export type PartnerStatus = "invited" | "active" | "disabled";

export type PartnerSummary = LeadPartner & {
  status: PartnerStatus;
  leadCount: number;
  createdAt: string;
};

export const PARTNER_STATUS_BADGE_CLASSES: Record<PartnerStatus, string> = {
  active: "bg-success-solid font-bold text-white",
  invited: "bg-secondary-container font-extrabold text-on-secondary-container",
  disabled: "bg-secondary-container font-extrabold text-on-secondary-container",
};

export type ActivityKind = "SUBMITTED" | "STATUS_CHANGED";

export type LeadActivity = {
  id: string;
  kind: ActivityKind;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus | null;
  message: string;
  actor: string | null;
  createdAt: string;
};

// Client-side shape of a Lead row: Decimals as numbers, dates as ISO strings.
export type Lead = {
  id: string;
  leadNo: number;
  source: LeadSource;
  partner: LeadPartner | null;
  name: string;
  mobile: string;
  address: string;
  pinCode: string;
  loanAmount: number | null;
  dob: string | null;
  goldGrams: number | null;
  offerAmount: number | null;
  ltvPercent: number | null;
  kfsReference: string | null;
  acceptanceState: AcceptanceState;
  status: LeadStatus;
  duplicateFlag: boolean;
  branchManagerStatus: BranchManagerStatus;
  loanConfirmedAmount: number | null;
  loanConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const LEAD_STATUSES: LeadStatus[] = [
  "New",
  "Contacted",
  "Converted",
  "Rejected",
];

export const LEAD_SOURCES: LeadSource[] = ["PARTNER", "AARTHIKLABS"];
export const ACCEPTANCE_STATES: AcceptanceState[] = [
  "NA",
  "ACCEPTED",
  "EXPIRED_UNACCEPTED",
];
export const BRANCH_MANAGER_STATUSES: BranchManagerStatus[] = [
  "NOT_SENT",
  "SENT",
  "CONFIRMED",
  "DECLINED",
];

export const SOURCE_LABELS: Record<LeadSource, string> = {
  PARTNER: "Partner",
  AARTHIKLABS: "AarthikLabs / ONDC",
};

export const ACCEPTANCE_LABELS: Record<AcceptanceState, string> = {
  NA: "N/A",
  ACCEPTED: "Accepted",
  EXPIRED_UNACCEPTED: "Expired / not accepted",
};

export const BRANCH_MANAGER_LABELS: Record<BranchManagerStatus, string> = {
  NOT_SENT: "Not sent",
  SENT: "Sent",
  CONFIRMED: "Confirmed",
  DECLINED: "Declined",
};

// Tailwind utility classes for each status, built only from the brand's
// existing color tokens (no new colors invented).
export const STATUS_BADGE_CLASSES: Record<LeadStatus, string> = {
  New: "bg-secondary-container font-extrabold text-on-secondary-container",
  Contacted: "bg-secondary-container font-extrabold text-on-secondary-container",
  Converted: "bg-success-solid font-bold text-white",
  Rejected: "bg-error-solid font-bold text-white",
};

export const BRANCH_MANAGER_BADGE_CLASSES: Record<BranchManagerStatus, string> = {
  NOT_SENT: "bg-secondary-container font-extrabold text-on-secondary-container",
  SENT: "bg-secondary-container font-extrabold text-on-secondary-container",
  CONFIRMED: "bg-success-solid font-bold text-white",
  DECLINED: "bg-error-solid font-bold text-white",
};

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatInr(amount: number): string {
  return inrFormatter.format(amount);
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function leadRef(lead: Pick<Lead, "leadNo">): string {
  return `YM-${lead.leadNo}`;
}

export function duplicatesOf(lead: Lead, all: Lead[]): Lead[] {
  return all.filter((l) => l.id !== lead.id && l.mobile === lead.mobile);
}

const PARTNERS: Record<string, LeadPartner> = {
  sree: {
    id: "p_sree",
    orgName: "Sree Finserv",
    contactEmail: "ops@sreefinserv.example",
  },
  kaveri: {
    id: "p_kaveri",
    orgName: "Kaveri Credit",
    contactEmail: "leads@kavericredit.example",
  },
  nandi: {
    id: "p_nandi",
    orgName: "Nandi Loans",
    contactEmail: "desk@nandiloans.example",
  },
};

export const EXAMPLE_PARTNERS: LeadPartner[] = Object.values(PARTNERS);

function lead(
  overrides: Partial<Lead> &
    Pick<
      Lead,
      "id" | "leadNo" | "name" | "mobile" | "address" | "pinCode" | "createdAt"
    >
): Lead {
  return {
    source: "PARTNER",
    partner: null,
    loanAmount: null,
    dob: null,
    goldGrams: null,
    offerAmount: null,
    ltvPercent: null,
    kfsReference: null,
    acceptanceState: "NA",
    status: "New",
    duplicateFlag: false,
    branchManagerStatus: "NOT_SENT",
    loanConfirmedAmount: null,
    loanConfirmedAt: null,
    updatedAt: overrides.createdAt,
    ...overrides,
  };
}

// Example / demo data only — not real customer data.
export const EXAMPLE_LEADS: Lead[] = [
  lead({
    id: "ld_001",
    leadNo: 1041,
    name: "Lakshmi Narayanan",
    mobile: "9741023458",
    address: "4th Cross, Jayanagar 4th Block, Bengaluru",
    pinCode: "560011",
    loanAmount: 85000,
    partner: PARTNERS.sree,
    duplicateFlag: true,
    createdAt: "2026-09-16T09:12:00+05:30",
  }),
  lead({
    id: "ld_002",
    leadNo: 1040,
    name: "Arun Kumar",
    mobile: "9886712340",
    address: "12, 80 Feet Road, Koramangala, Bengaluru",
    pinCode: "560034",
    loanAmount: 150000,
    partner: PARTNERS.kaveri,
    status: "Contacted",
    branchManagerStatus: "SENT",
    createdAt: "2026-09-16T07:40:00+05:30",
    updatedAt: "2026-09-17T11:05:00+05:30",
  }),
  lead({
    id: "ld_003",
    leadNo: 1039,
    source: "AARTHIKLABS",
    name: "Divya Reddy",
    mobile: "9740098123",
    address: "Plot 22, Hitech City, Hyderabad",
    pinCode: "500081",
    dob: "1991-03-14",
    goldGrams: 42.5,
    offerAmount: 210000,
    ltvPercent: 72,
    kfsReference: "KFS-2026-09-000318",
    acceptanceState: "ACCEPTED",
    createdAt: "2026-09-15T18:22:00+05:30",
  }),
  lead({
    id: "ld_004",
    leadNo: 1038,
    name: "Mohammed Iqbal",
    mobile: "9902234567",
    address: "JP Nagar 7th Phase, Bengaluru",
    pinCode: "560078",
    loanAmount: 220000,
    partner: PARTNERS.nandi,
    status: "Converted",
    branchManagerStatus: "CONFIRMED",
    loanConfirmedAmount: 200000,
    loanConfirmedAt: "2026-09-17T15:30:00+05:30",
    createdAt: "2026-09-15T10:05:00+05:30",
    updatedAt: "2026-09-17T15:30:00+05:30",
  }),
  lead({
    id: "ld_005",
    leadNo: 1037,
    name: "Priya Shetty",
    mobile: "9663341290",
    address: "Jayanagar 3rd Block, Bengaluru",
    pinCode: "560011",
    loanAmount: 45000,
    partner: PARTNERS.kaveri,
    status: "Rejected",
    branchManagerStatus: "DECLINED",
    createdAt: "2026-09-14T16:48:00+05:30",
    updatedAt: "2026-09-16T09:00:00+05:30",
  }),
  lead({
    id: "ld_006",
    leadNo: 1036,
    name: "Suresh Babu",
    mobile: "9845123067",
    address: "Tiruchanoor Road, Tirupati",
    pinCode: "517501",
    loanAmount: 95000,
    partner: PARTNERS.nandi,
    status: "Contacted",
    createdAt: "2026-09-14T12:30:00+05:30",
    updatedAt: "2026-09-15T10:10:00+05:30",
  }),
  lead({
    id: "ld_007",
    leadNo: 1035,
    source: "AARTHIKLABS",
    name: "Kavitha Menon",
    mobile: "9895512378",
    address: "MG Road, Ernakulam, Kochi",
    pinCode: "682011",
    dob: "1986-11-02",
    goldGrams: 18,
    offerAmount: 88000,
    ltvPercent: 70,
    kfsReference: "KFS-2026-09-000297",
    acceptanceState: "EXPIRED_UNACCEPTED",
    createdAt: "2026-09-13T20:15:00+05:30",
  }),
  lead({
    id: "ld_008",
    leadNo: 1034,
    name: "Lakshmi Narayanan",
    mobile: "9741023458",
    address: "4th Cross, Jayanagar 4th Block, Bengaluru",
    pinCode: "560011",
    loanAmount: 80000,
    partner: PARTNERS.kaveri,
    duplicateFlag: true,
    createdAt: "2026-09-12T11:00:00+05:30",
  }),
];
