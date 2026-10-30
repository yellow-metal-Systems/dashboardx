import { describe, it, expect } from "vitest";

import { EMPTY_FILTERS, applyLeadFilters, countActiveFilters, previousWindowMetrics } from "@/lib/lead-filters";
import { LEADS } from "./fixtures";

const all = LEADS;

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
    expect(applyLeadFilters(all, { ...EMPTY_FILTERS, status: "REJECTED" })).toHaveLength(1);
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

  it("filters new customers both ways", () => {
    const yes = applyLeadFilters(all, { ...EMPTY_FILTERS, newCustomer: "yes" });
    const no = applyLeadFilters(all, { ...EMPTY_FILTERS, newCustomer: "no" });
    expect(yes.every((l) => l.isNewCustomer)).toBe(true);
    expect(no.map((l) => l.id)).toEqual(["l1"]);
    expect(yes.length + no.length).toBe(all.length);
  });

  it("combines filters", () => {
    const combined = applyLeadFilters(all, {
      ...EMPTY_FILTERS,
      newCustomer: "yes",
      acceptanceState: "ACCEPTED",
    });
    expect(combined.every((l) => l.isNewCustomer && l.acceptanceState === "ACCEPTED")).toBe(true);
    expect(combined).toHaveLength(1);
  });

  it("filters by partner", () => {
    const byPartner = applyLeadFilters(all, { ...EMPTY_FILTERS, partnerId: "p_b" });
    expect(byPartner).toHaveLength(3);
    expect(byPartner.every((l) => l.partner?.id === "p_b")).toBe(true);
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
    expect(onlyThatDay).toHaveLength(2);
  });
});

describe("countActiveFilters", () => {
  it("ignores the free-text search box", () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, search: "lakshmi" })).toBe(0);
  });

  it("counts each non-default filter once", () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, status: "DISBURSED" })).toBe(1);
    expect(
      countActiveFilters({ ...EMPTY_FILTERS, status: "DISBURSED", newCustomer: "no" })
    ).toBe(2);
  });
});

describe("KPI trend helpers", () => {
  const now = new Date(2026, 9, 30, 12, 0); // 30 Oct 2026, noon local
  const at = (daysAgo: number, extra: Partial<(typeof LEADS)[number]> = {}) => ({
    ...LEADS[0],
    id: `L${daysAgo}-${Math.random()}`,
    createdAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
    ...extra,
  });

  it("compares a range with the equally long window just before it", () => {
    const leads = [at(1), at(2, { status: "DISBURSED" }), at(8, { isNewCustomer: true }), at(9, { isNewCustomer: false }), at(20)];
    expect(previousWindowMetrics(leads, "week", now)).toEqual({ total: 2, newCustomers: 1, disbursed: 0 });
    expect(previousWindowMetrics(leads, "all", now)).toBeNull();
  });

  it("compares today with yesterday up to the same time, not with last night", () => {
    const hoursAgo = (h: number) => ({ ...LEADS[0], id: `H${h}`, createdAt: new Date(now.getTime() - h * 3_600_000).toISOString() });
    // now is noon: 26 h ago is 10 am yesterday (counts), 14 h ago is 10 pm yesterday (does not).
    expect(previousWindowMetrics([hoursAgo(26), hoursAgo(14)], "today", now)?.total).toBe(1);
  });
});
