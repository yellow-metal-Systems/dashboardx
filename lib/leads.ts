// =============================================================================
// Lead types, the canonical status vocabulary, and display helpers.
// =============================================================================

/**
 * The canonical status vocabulary — ONE set, shared with the AarthikLabs-facing
 * service, stored verbatim in the `leads.status` text column.
 *
 * There used to be two vocabularies in two databases — this UI's
 * New/Contacted/Converted/Rejected and the backend's
 * LEAD_CREATED/DISBURSED/REJECTED — translated by a sync script. That script
 * silently reverted every staff-set `Contacted` lead back to `New` on each run.
 * There is now nothing to translate: the UI renders labels over the stored value.
 *
 * AarthikLabs receives these verbatim. Jeenu Vadera, 22 Sep 2026: "Status could
 * be - Lead created, Disbursed, Rejected or any other intermediary status
 * available with you."
 */
export const LEAD_STATUSES = [
  "LEAD_CREATED",
  "CONTACTED",
  "BRANCH_VISIT_SCHEDULED",
  "DISBURSED",
  "REJECTED",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** What staff see. The stored value stays machine-readable. */
export const STATUS_LABELS: Record<LeadStatus, string> = {
  LEAD_CREATED: "New",
  CONTACTED: "Contacted",
  BRANCH_VISIT_SCHEDULED: "Branch visit",
  DISBURSED: "Disbursed",
  REJECTED: "Rejected",
};

export const TERMINAL_STATUSES: readonly LeadStatus[] = ["DISBURSED", "REJECTED"];

export function isTerminalStatus(status: LeadStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Parses a stored status into the known union.
 *
 * `status` is a text column precisely so the partner-facing service can add an
 * intermediary status without a migration. That means this UI can legitimately
 * read a value it has never heard of, and it must render rather than crash —
 * a `Record<LeadStatus, string>` lookup would otherwise yield `undefined` and
 * produce an unstyled badge or a blank label.
 */
export function parseLeadStatus(status: string): LeadStatus | null {
  return (LEAD_STATUSES as readonly string[]).includes(status) ? (status as LeadStatus) : null;
}

/** Always returns something printable, even for an unrecognised status. */
export function statusLabel(status: string): string {
  const known = parseLeadStatus(status);
  if (known) return STATUS_LABELS[known];
  // Turn AWAITING_DOCUMENTS into "Awaiting documents" rather than showing the
  // raw token or nothing at all.
  return status
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export type LeadSource = "PARTNER" | "AARTHIKLABS";
export type AcceptanceState = "NA" | "ACCEPTED" | "EXPIRED_UNACCEPTED";
export type BranchManagerStatus = "NOT_SENT" | "SENT" | "CONFIRMED" | "DECLINED";
export type PartnerStatus = "invited" | "active" | "disabled";

export type ActivityKind =
  | "SUBMITTED"
  | "STATUS_CHANGED"
  | "DISBURSEMENT_RECORDED"
  | "AUTO_CLOSED"
  | "WEBHOOK_QUEUED"
  | "WEBHOOK_DELIVERED"
  | "WEBHOOK_FAILED";

export type LeadPartner = {
  id: string;
  orgName: string;
  contactEmail: string;
};

export type PartnerSummary = LeadPartner & {
  status: PartnerStatus;
  leadCount: number;
  createdAt: string;
};

export type LeadActivity = {
  id: string;
  kind: ActivityKind;
  fromStatus: string | null;
  toStatus: string | null;
  message: string;
  actor: string | null;
  createdAt: string;
};

/** Delivery history for the AarthikLabs status webhook. Read-only in this app. */
export type LeadWebhookEvent = {
  id: string;
  statusSent: string;
  deliveryStatus: string;
  attempts: number;
  responseCode: number | null;
  errorMessage: string | null;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  createdAt: string;
};

/** Max eligible loan at both real plan rates, computed by the sibling service. */
export type GoldInsights = {
  rateUsed: number | null;
  rateSource: "live" | "cache" | "fallback" | null;
  maxEligibleBullet68: number | null;
  maxEligibleMonthly75: number | null;
};

/** Client-side shape of a lead row: Decimals as numbers, dates as ISO strings. */
export type Lead = {
  id: string;
  leadNo: number;
  customerId: string | null;
  loanId: string | null;
  source: LeadSource;
  partner: LeadPartner | null;
  name: string;
  mobile: string;
  /** Derived from addressLine1 + addressLine2 — there is no single address column. */
  address: string;
  addressLine1: string | null;
  addressLine2: string | null;
  pinCode: string;
  loanAmount: number | null;
  dob: string | null;
  goldGrams: number | null;
  offerAmount: number | null;
  ltvPercent: number | null;
  kfsReference: string | null;
  offerAcceptedAt: string | null;
  acceptanceState: AcceptanceState;
  status: string;
  duplicateFlag: boolean;
  branchManagerStatus: BranchManagerStatus;
  loanConfirmedAmount: number | null;
  loanConfirmedAt: string | null;
  disbursementAmount: number | null;
  disbursementDate: string | null;
  productType: string;
  tenure: number | null;
  tenureUnit: string;
  isDemo: boolean;
  sourceCreatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const LEAD_SOURCES: LeadSource[] = ["PARTNER", "AARTHIKLABS"];
export const ACCEPTANCE_STATES: AcceptanceState[] = ["NA", "ACCEPTED", "EXPIRED_UNACCEPTED"];
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

// Tailwind utility classes built only from the brand's existing colour tokens —
// no new colours invented.
const NEUTRAL_BADGE = "bg-secondary-container font-extrabold text-on-secondary-container";
const SUCCESS_BADGE = "bg-success-solid font-bold text-white";
const ERROR_BADGE = "bg-error-solid font-bold text-white";

export const STATUS_BADGE_CLASSES: Record<LeadStatus, string> = {
  LEAD_CREATED: NEUTRAL_BADGE,
  CONTACTED: NEUTRAL_BADGE,
  BRANCH_VISIT_SCHEDULED: NEUTRAL_BADGE,
  DISBURSED: SUCCESS_BADGE,
  REJECTED: ERROR_BADGE,
};

/** Safe for any status value, including one this build has never seen. */
export function statusBadgeClass(status: string): string {
  const known = parseLeadStatus(status);
  return known ? STATUS_BADGE_CLASSES[known] : NEUTRAL_BADGE;
}

export const PARTNER_STATUS_BADGE_CLASSES: Record<PartnerStatus, string> = {
  active: SUCCESS_BADGE,
  invited: NEUTRAL_BADGE,
  disabled: NEUTRAL_BADGE,
};

export const BRANCH_MANAGER_BADGE_CLASSES: Record<BranchManagerStatus, string> = {
  NOT_SENT: NEUTRAL_BADGE,
  SENT: NEUTRAL_BADGE,
  CONFIRMED: SUCCESS_BADGE,
  DECLINED: ERROR_BADGE,
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

export function joinAddress(line1: string | null, line2: string | null): string {
  return [line1, line2].filter(Boolean).join(", ");
}

export function leadRef(lead: Pick<Lead, "leadNo">): string {
  return `YM-${lead.leadNo}`;
}

export function duplicatesOf(lead: Lead, all: Lead[]): Lead[] {
  return all.filter((l) => l.id !== lead.id && l.mobile === lead.mobile);
}
