import { describe, it, expect } from "vitest";

import {
  LEAD_STATUSES,
  STATUS_BADGE_CLASSES,
  hasProvisionalOffer,
  isTerminalStatus,
  joinAddress,
  offerPlanLabel,
  parseLeadStatus,
  statusBadgeClass,
  statusLabel,
  submittedLabel,
  isNewLead,
} from "@/lib/leads";

import { makeLead } from "./fixtures";

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

describe("provisional ONDC offer", () => {
  const base = {
    id: "YMLEAD0000000001",
    leadNo: 1,
    name: "Test",
    mobile: "9876543210",
    pinCode: "360001",
    createdAt: "2026-10-06T00:00:00.000Z",
  };

  it("is absent on a Flow-4 lead that carries no offer", () => {
    expect(hasProvisionalOffer(makeLead(base))).toBe(false);
  });

  it("is present when any offer field was sent — a free processing fee counts", () => {
    expect(hasProvisionalOffer(makeLead({ ...base, offerProcessingFee: 0 }))).toBe(true);
    expect(hasProvisionalOffer(makeLead({ ...base, offerProductType: "BULLET" }))).toBe(true);
  });

  it("labels both plans with their LTV and falls back to the raw value", () => {
    expect(offerPlanLabel("BULLET")).toBe("Bullet · 68% LTV");
    expect(offerPlanLabel("MONTHLY")).toBe("Monthly · 75% LTV");
    expect(offerPlanLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});

describe("submittedLabel", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

  it("buckets a lead's age from 30 minutes up, then shows the date after 96 hours", () => {
    expect(submittedLabel(ago(0), now)).toBe("Under 30 min");
    expect(submittedLabel(ago(0.49), now)).toBe("Under 30 min");
    expect(submittedLabel(ago(0.5), now)).toBe("30 min–1 hr");
    expect(submittedLabel(ago(1), now)).toBe("1–2 hrs");
    expect(submittedLabel(ago(2), now)).toBe("2–6 hrs");
    expect(submittedLabel(ago(6), now)).toBe("6–12 hrs");
    expect(submittedLabel(ago(12), now)).toBe("12–24 hrs");
    expect(submittedLabel(ago(23.99), now)).toBe("12–24 hrs");
    expect(submittedLabel(ago(24), now)).toBe("24–36 hrs");
    expect(submittedLabel(ago(35.99), now)).toBe("24–36 hrs");
    expect(submittedLabel(ago(36), now)).toBe("36–72 hrs");
    expect(submittedLabel(ago(71.99), now)).toBe("36–72 hrs");
    expect(submittedLabel(ago(72), now)).toBe("72–96 hrs");
    expect(submittedLabel(ago(95.99), now)).toBe("72–96 hrs");
    expect(submittedLabel(ago(96), now)).toMatch(/^\d{1,2} \w{3,4} 2026$/);
  });
});

describe("isNewLead", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();

  it("is true for 45 minutes after submission", () => {
    expect(isNewLead(ago(0), now)).toBe(true);
    expect(isNewLead(ago(44.9), now)).toBe(true);
    expect(isNewLead(ago(45), now)).toBe(false);
  });
});
