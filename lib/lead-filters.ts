import {
  leadRef,
  type AcceptanceState,
  type BranchManagerStatus,
  type Lead,
  type LeadSource,
  type LeadStatus,
} from "./leads";

export type DuplicateFilter = "all" | "only" | "none";

export type LeadFilters = {
  search: string;
  pinCode: string;
  minAmount: string;
  maxAmount: string;
  status: LeadStatus | "all";
  source: LeadSource | "all";
  duplicate: DuplicateFilter;
  acceptanceState: AcceptanceState | "all";
  branchManagerStatus: BranchManagerStatus | "all";
  partnerId: string | "all";
  createdFrom: string;
  createdTo: string;
};

export const EMPTY_FILTERS: LeadFilters = {
  search: "",
  pinCode: "",
  minAmount: "",
  maxAmount: "",
  status: "all",
  source: "all",
  duplicate: "all",
  acceptanceState: "all",
  branchManagerStatus: "all",
  partnerId: "all",
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
    if (f.source !== "all" && lead.source !== f.source) return false;
    if (f.duplicate === "only" && !lead.duplicateFlag) return false;
    if (f.duplicate === "none" && lead.duplicateFlag) return false;
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

    const created = new Date(lead.createdAt);
    if (from && created < from) return false;
    if (to && created > to) return false;
    return true;
  });
}
