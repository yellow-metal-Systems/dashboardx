import { describe, it, expect } from "vitest";

import {
  LEAD_STATUSES,
  STATUS_BADGE_CLASSES,
  isTerminalStatus,
  joinAddress,
  parseLeadStatus,
  statusBadgeClass,
  statusLabel,
} from "@/lib/leads";

describe("canonical status vocabulary", () => {
  it("matches the vocabulary the AarthikLabs-facing service stores", () => {
    // These five values must stay identical to serverx's
    // src/services/statusMap.ts. They are ONE vocabulary in ONE text column, and
    // the two repos agree by convention rather than shared code — so this test is
    // the thing that catches a drift.
    expect([...LEAD_STATUSES]).toEqual([
      "LEAD_CREATED",
      "CONTACTED",
      "BRANCH_VISIT_SCHEDULED",
      "DISBURSED",
      "REJECTED",
    ]);
  });

  it("has a label and a badge style for every status", () => {
    for (const status of LEAD_STATUSES) {
      expect(statusLabel(status), status).toBeTruthy();
      expect(STATUS_BADGE_CLASSES[status], status).toBeTruthy();
    }
  });

  it("shows staff friendly labels, not raw tokens", () => {
    expect(statusLabel("LEAD_CREATED")).toBe("New");
    expect(statusLabel("DISBURSED")).toBe("Disbursed");
    expect(statusLabel("BRANCH_VISIT_SCHEDULED")).toBe("Branch visit");
  });

  it("treats only DISBURSED and REJECTED as terminal", () => {
    expect(isTerminalStatus("DISBURSED")).toBe(true);
    expect(isTerminalStatus("REJECTED")).toBe(true);
    expect(isTerminalStatus("LEAD_CREATED")).toBe(false);
    expect(isTerminalStatus("CONTACTED")).toBe(false);
    expect(isTerminalStatus("BRANCH_VISIT_SCHEDULED")).toBe(false);
  });

  it("does not recognise either of the two abandoned status vocabularies", () => {
    // The old UI vocabulary...
    for (const old of ["New", "Contacted", "Converted", "Rejected"]) {
      expect(parseLeadStatus(old), old).toBeNull();
    }
    // ...and the two abandoned timeout status names.
    expect(parseLeadStatus("EXPIRED")).toBeNull();
    expect(parseLeadStatus("UNDISBURSED")).toBeNull();
  });
});

describe("forward compatibility with an unknown status", () => {
  // `status` is a text column precisely so the partner-facing service can add an
  // intermediary status without a migration (AarthikLabs confirmed the vocabulary
  // is ours to extend). This UI can therefore legitimately read a value it has
  // never heard of, and must render rather than break.

  it("returns null from parseLeadStatus instead of lying", () => {
    expect(parseLeadStatus("AWAITING_DOCUMENTS")).toBeNull();
  });

  it("still produces a readable label", () => {
    // Not `undefined`, which is what a bare Record<LeadStatus, string> lookup
    // would have yielded.
    expect(statusLabel("AWAITING_DOCUMENTS")).toBe("Awaiting documents");
    expect(statusLabel("PENDING_KYC_REVIEW")).toBe("Pending kyc review");
  });

  it("still produces a usable badge class rather than undefined", () => {
    const cls = statusBadgeClass("AWAITING_DOCUMENTS");
    expect(cls).toBeTruthy();
    expect(cls).not.toContain("undefined");
  });

  it("degrades gracefully on an empty status", () => {
    expect(() => statusLabel("")).not.toThrow();
    expect(statusBadgeClass("")).toBeTruthy();
  });
});

describe("joinAddress", () => {
  it("joins the two structured address lines the partner contract carries", () => {
    // There is no single `address` column: address_line_1 / address_line_2 is what
    // AarthikLabs sends, and is strictly more information.
    expect(joinAddress("24 Kalawad Road", "Near KKV Hall")).toBe("24 Kalawad Road, Near KKV Hall");
  });

  it("omits a missing line instead of leaving a dangling comma", () => {
    expect(joinAddress("24 Kalawad Road", null)).toBe("24 Kalawad Road");
    expect(joinAddress(null, "Near KKV Hall")).toBe("Near KKV Hall");
    expect(joinAddress(null, null)).toBe("");
  });
});
