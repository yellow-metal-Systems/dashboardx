import { describe, it, expect } from "vitest";

import { EMPTY_FILTERS, applyLeadFilters, applyTimeRange, leadMetrics, rangeStart } from "@/lib/lead-filters";
import { customerTag } from "@/lib/leads";
import { can, parseRole, permissionsOf } from "@/lib/auth/roles";
import { makeLead } from "./fixtures";

// Standup 2026-10-15: branch filter, timeline selector + headline numbers, the
// New/Duplicate tag, and the three LeadDesk roles.

const now = new Date("2026-10-18T12:00:00");
const at = (iso: string, extra: Parameters<typeof makeLead>[0] extends infer T ? Partial<T> : never = {}) =>
  makeLead({ id: iso, leadNo: 1, name: "x", mobile: "9000000000", pinCode: "560001", createdAt: new Date(iso).toISOString(), ...extra });

describe("timeline and metrics", () => {
  const leads = [
    at("2026-10-18T09:00:00", { status: "DISBURSED" }),
    at("2026-10-15T09:00:00", { isNewCustomer: false }),
    at("2026-09-25T09:00:00"),
    at("2025-12-01T09:00:00", { status: "DISBURSED" }),
    at("2024-01-01T09:00:00"),
  ];

  it("starts today at local midnight and the others as rolling windows", () => {
    expect(rangeStart("today", now)).toEqual(new Date("2026-10-18T00:00:00"));
    expect(rangeStart("week", now)).toEqual(new Date("2026-10-11T12:00:00"));
    expect(rangeStart("all", now)).toBeNull();
  });

  it("narrows to the range and counts total, new and disbursed", () => {
    expect(applyTimeRange(leads, "today", now)).toHaveLength(1);
    expect(applyTimeRange(leads, "week", now)).toHaveLength(2);
    expect(applyTimeRange(leads, "month", now)).toHaveLength(3);
    expect(leadMetrics(applyTimeRange(leads, "year", now))).toEqual({ total: 4, newCustomers: 3, disbursed: 2 });
    expect(leadMetrics(applyTimeRange(leads, "all", now)).total).toBe(5);
  });

  it("filters by branch", () => {
    const a = at("2026-10-18T09:00:00", { branch: { id: "YM-HOSKOTE", name: "Hoskote", state: null } });
    const b = at("2026-10-18T10:00:00", { branch: null });
    expect(applyLeadFilters([a, b], { ...EMPTY_FILTERS, branchId: "YM-HOSKOTE" })).toEqual([a]);
  });

  it("tags a borrower's first lead New and any later one Duplicate", () => {
    expect(customerTag({ isNewCustomer: true })).toBe("New");
    expect(customerTag({ isNewCustomer: false })).toBe("Duplicate");
  });
});

describe("roles", () => {
  it("gives customer support leads only", () => {
    expect(permissionsOf("customer_support")).toEqual(["leads.view", "leads.update"]);
    expect(can("customer_support", "rewards.view")).toBe(false);
    expect(can("customer_support", "partners.view")).toBe(false);
  });

  it("gives financial operators rewards and LMS review, but not partners, rules or the team", () => {
    expect(can("financial_operator", "rewards.manage")).toBe(true);
    expect(can("financial_operator", "lms.resolve")).toBe(true);
    expect(can("financial_operator", "partners.manage")).toBe(false);
    expect(can("financial_operator", "rewardRules.manage")).toBe(false);
    expect(can("financial_operator", "team.manage")).toBe(false);
  });

  it("gives admins everything, and reads the old 'staff' role as customer support", () => {
    expect(can("admin", "team.manage")).toBe(true);
    expect(parseRole("staff")).toBe("customer_support");
    expect(parseRole("superuser")).toBeNull();
    expect(can(null, "leads.view")).toBe(false);
  });
});
