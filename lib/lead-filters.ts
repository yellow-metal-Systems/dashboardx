import {
  leadRef,
  type AcceptanceState,
  type BranchManagerStatus,
  type Lead,
  type LeadStatus,
} from "./leads";

export type NewCustomerFilter = "all" | "yes" | "no";

export type LeadFilters = {
  search: string;
  pinCode: string;
  minAmount: string;
  maxAmount: string;
  status: LeadStatus | "all";
  newCustomer: NewCustomerFilter;
  acceptanceState: AcceptanceState | "all";
  branchManagerStatus: BranchManagerStatus | "all";
  partnerId: string | "all";
  /** A branch id from the branch master, e.g. "YM-HOSKOTE". */
  branchId: string | "all";
  createdFrom: string;
  createdTo: string;
};

export const EMPTY_FILTERS: LeadFilters = {
  search: "",
  pinCode: "",
  minAmount: "",
  maxAmount: "",
  status: "all",
  newCustomer: "all",
  acceptanceState: "all",
  branchManagerStatus: "all",
  partnerId: "all",
  branchId: "all",
  createdFrom: "",
  createdTo: "",
};

export function countActiveFilters(f: LeadFilters): number {
  return (Object.keys(EMPTY_FILTERS) as (keyof LeadFilters)[]).filter(
    (key) => key !== "search" && f[key] !== EMPTY_FILTERS[key]
  ).length;
}

function parseAmount(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw.replace(/[,\s₹]/g, ""));
  return Number.isNaN(n) ? null : n;
}

// Partner leads carry the customer's ask; AarthikLabs leads carry the computed offer.
function leadAmount(lead: Lead): number | null {
  return lead.loanAmount ?? lead.offerAmount;
}

export function applyLeadFilters(leads: Lead[], f: LeadFilters): Lead[] {
  const search = f.search.trim().toLowerCase();
  const pin = f.pinCode.trim();
  const min = parseAmount(f.minAmount);
  const max = parseAmount(f.maxAmount);
  const from = f.createdFrom ? new Date(`${f.createdFrom}T00:00:00`) : null;
  const to = f.createdTo ? new Date(`${f.createdTo}T23:59:59.999`) : null;

  return leads.filter((lead) => {
    if (
      search &&
      !lead.name.toLowerCase().includes(search) &&
      !lead.mobile.includes(search) &&
      !leadRef(lead).toLowerCase().includes(search)
    ) {
      return false;
    }
    if (pin && !lead.pinCode.includes(pin)) return false;

    const amount = leadAmount(lead);
    if (min !== null && (amount === null || amount < min)) return false;
    if (max !== null && (amount === null || amount > max)) return false;

    if (f.status !== "all" && lead.status !== f.status) return false;
    if (f.newCustomer === "yes" && !lead.isNewCustomer) return false;
    if (f.newCustomer === "no" && lead.isNewCustomer) return false;
    if (f.acceptanceState !== "all" && lead.acceptanceState !== f.acceptanceState) {
      return false;
    }
    if (
      f.branchManagerStatus !== "all" &&
      lead.branchManagerStatus !== f.branchManagerStatus
    ) {
      return false;
    }
    if (f.partnerId !== "all" && lead.partner?.id !== f.partnerId) return false;
    if (f.branchId !== "all" && lead.branch?.id !== f.branchId) return false;

    const created = new Date(lead.createdAt);
    if (from && created < from) return false;
    if (to && created > to) return false;
    return true;
  });
}

// -----------------------------------------------------------------------------
// Timeline selector + headline numbers (standup 2026-10-15): "select today or
// last week or last month or last year … total leads, how many were new, how
// many were disbursed."
// -----------------------------------------------------------------------------

export const TIME_RANGES = ["today", "week", "month", "year", "all"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  today: "Today",
  week: "Last 7 days",
  month: "Last 30 days",
  year: "Last 12 months",
  all: "All time",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Where a range starts: local midnight for "today", otherwise a rolling window. Null for all time. */
export function rangeStart(range: TimeRange, now = new Date()): Date | null {
  switch (range) {
    case "today": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "week":
      return new Date(now.getTime() - 7 * DAY_MS);
    case "month":
      return new Date(now.getTime() - 30 * DAY_MS);
    case "year":
      return new Date(now.getTime() - 365 * DAY_MS);
    case "all":
      return null;
  }
}

/** The leads created in the range. */
export function applyTimeRange(leads: Lead[], range: TimeRange, now = new Date()): Lead[] {
  const start = rangeStart(range, now);
  return start ? leads.filter((l) => new Date(l.createdAt) >= start) : leads;
}

export type LeadMetrics = { total: number; newCustomers: number; disbursed: number };

/**
 * The three headline cards, for leads already narrowed to a range. "New" is a
 * borrower's first lead ever (the New tag); a repeat is a Duplicate.
 */
export function leadMetrics(leads: Lead[]): LeadMetrics {
  return {
    total: leads.length,
    newCustomers: leads.filter((l) => l.isNewCustomer).length,
    disbursed: leads.filter((l) => l.status === "DISBURSED").length,
  };
}
