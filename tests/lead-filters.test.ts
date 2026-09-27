import { describe, it, expect } from "vitest";

import { EMPTY_FILTERS, applyLeadFilters, countActiveFilters } from "@/lib/lead-filters";
import { EXAMPLE_LEADS } from "@/lib/leads";

const all = EXAMPLE_LEADS;

describe("applyLeadFilters", () => {
  it("returns everything with no filters applied", () => {
    expect(applyLeadFilters(all, EMPTY_FILTERS)).toHaveLength(all.length);
  });

  it("searches by name, mobile and lead reference", () => {
    expect(applyLeadFilters(all, { ...EMPTY_FILTERS, search: "lakshmi" })).toHaveLength(2);
    expect(applyLeadFilters(all, { ...EMPTY_FILTERS, search: "9886712340" })).toHaveLength(1);
    expect(applyLeadFilters(all, { ...EMPTY_FILTERS, search: "ym-1040" })).toHaveLength(1);
  });

  it("filters on the canonical status values", () => {
    const disbursed = applyLeadFilters(all, { ...EMPTY_FILTERS, status: "DISBURSED" });
    expect(disbursed).toHaveLength(1);
    expect(disbursed[0]?.status).toBe("DISBURSED");

    expect(applyLeadFilters(all, { ...EMPTY_FILTERS, status: "CONTACTED" })).toHaveLength(2);
    expect(
      applyLeadFilters(all, { ...EMPTY_FILTERS, status: "BRANCH_VISIT_SCHEDULED" })
    ).toHaveLength(1);
  });

  it("filters by pincode prefix", () => {
    expect(applyLeadFilters(all, { ...EMPTY_FILTERS, pinCode: "5600" }).length).toBeGreaterThan(0);
    expect(applyLeadFilters(all, { ...EMPTY_FILTERS, pinCode: "999999" })).toHaveLength(0);
  });

  it("filters on either the requested amount or the computed offer", () => {
    // Partner leads carry the customer's ask; AarthikLabs leads carry the offer.
    const big = applyLeadFilters(all, { ...EMPTY_FILTERS, minAmount: "200000" });
    expect(big.length).toBeGreaterThan(0);
    for (const lead of big) {
      expect((lead.loanAmount ?? lead.offerAmount ?? 0) >= 200000).toBe(true);
    }
  });

  it("tolerates a formatted amount with commas and a rupee sign", () => {
    const a = applyLeadFilters(all, { ...EMPTY_FILTERS, minAmount: "150000" });
    const b = applyLeadFilters(all, { ...EMPTY_FILTERS, minAmount: "₹1,50,000" });
    expect(b.length).toBe(a.length);
  });

  it("filters duplicates both ways", () => {
    const only = applyLeadFilters(all, { ...EMPTY_FILTERS, duplicate: "only" });
    const none = applyLeadFilters(all, { ...EMPTY_FILTERS, duplicate: "none" });
    expect(only.every((l) => l.duplicateFlag)).toBe(true);
    expect(none.every((l) => !l.duplicateFlag)).toBe(true);
    expect(only.length + none.length).toBe(all.length);
  });

  it("filters by source and combines filters", () => {
    const combined = applyLeadFilters(all, {
      ...EMPTY_FILTERS,
      source: "AARTHIKLABS",
      acceptanceState: "ACCEPTED",
    });
    expect(combined.every((l) => l.source === "AARTHIKLABS")).toBe(true);
    expect(combined.every((l) => l.acceptanceState === "ACCEPTED")).toBe(true);
  });

  it("returns an empty list, not an error, when nothing matches", () => {
    const none = applyLeadFilters(all, { ...EMPTY_FILTERS, search: "nobody-by-this-name" });
    expect(none).toEqual([]);
  });

  it("filters by creation date range inclusively", () => {
    const onlyThatDay = applyLeadFilters(all, {
      ...EMPTY_FILTERS,
      createdFrom: "2026-09-16",
      createdTo: "2026-09-16",
    });
    expect(onlyThatDay.length).toBe(2);
  });
});

describe("countActiveFilters", () => {
  it("ignores the free-text search box", () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, search: "lakshmi" })).toBe(0);
  });

  it("counts each non-default filter once", () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, status: "DISBURSED" })).toBe(1);
    expect(
      countActiveFilters({ ...EMPTY_FILTERS, status: "DISBURSED", source: "PARTNER" })
    ).toBe(2);
  });
});
