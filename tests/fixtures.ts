import type { Lead, LeadPartner } from "@/lib/leads";
import { joinAddress } from "@/lib/leads";

// Test fixtures, defined here rather than imported from application code.
//
// These used to come from an EXAMPLE_LEADS export in lib/leads.ts, which meant
// fake customer records shipped in the production bundle purely so tests had
// something to filter. Fixtures belong in the tests.

export const PARTNER_A: LeadPartner = {
  id: "p_a",
  orgName: "Alpha Finserv",
  contactEmail: "ops@alpha.example",
};

export const PARTNER_B: LeadPartner = {
  id: "p_b",
  orgName: "Beta Credit",
  contactEmail: "ops@beta.example",
};

type Required_ = Pick<Lead, "id" | "leadNo" | "name" | "mobile" | "pinCode" | "createdAt">;

/** A lead with every field defaulted; override only what a test cares about. */
export function makeLead(overrides: Partial<Lead> & Required_): Lead {
  const addressLine1 = overrides.addressLine1 ?? null;
  const addressLine2 = overrides.addressLine2 ?? null;
  return {
    customerId: null,
    loanId: null,
    source: "PARTNER",
    partner: null,
    ondcTransactionId: null,
    lspName: null,
    address: joinAddress(addressLine1, addressLine2),
    addressLine1,
    addressLine2,
    loanAmount: null,
    dob: null,
    goldGrams: null,
    offerAmount: null,
    ltvPercent: null,
    kfsReference: null,
    offerAcceptedAt: null,
    offerProductType: null,
    offerRoiPercentPa: null,
    offerProcessingFee: null,
    offerTenureDays: null,
    acceptanceState: "NA",
    status: "LEAD_CREATED",
    duplicateFlag: false,
    isNewCustomer: true,
    lmsUpdatedAt: null,
    branchManagerStatus: "NOT_SENT",
    loanConfirmedAmount: null,
    loanConfirmedAt: null,
    disbursementAmount: null,
    disbursementDate: null,
    productType: "TERM_LOAN",
    tenure: null,
    tenureUnit: "MONTH",
    isDemo: false,
    sourceCreatedAt: overrides.createdAt,
    updatedAt: overrides.createdAt,
    ...overrides,
  };
}

/** A small, deliberately varied set covering each status, source and flag. */
export const LEADS: Lead[] = [
  makeLead({
    id: "l1",
    leadNo: 1041,
    name: "Lakshmi Narayanan",
    mobile: "9741023458",
    addressLine1: "4th Cross, Jayanagar 4th Block",
    addressLine2: "Bengaluru",
    pinCode: "560011",
    loanAmount: 85000,
    partner: PARTNER_A,
    duplicateFlag: true,
    // Same mobile as l7, which came first.
    isNewCustomer: false,
    createdAt: "2026-09-16T09:12:00+05:30",
  }),
  makeLead({
    id: "l2",
    leadNo: 1040,
    name: "Arun Kumar",
    mobile: "9886712340",
    pinCode: "560034",
    loanAmount: 150000,
    partner: PARTNER_B,
    status: "CONTACTED",
    createdAt: "2026-09-16T07:40:00+05:30",
  }),
  makeLead({
    id: "l3",
    leadNo: 1039,
    source: "AARTHIKLABS",
    name: "Divya Reddy",
    mobile: "9740098123",
    pinCode: "500081",
    goldGrams: 42.5,
    offerAmount: 210000,
    acceptanceState: "ACCEPTED",
    status: "BRANCH_VISIT_SCHEDULED",
    createdAt: "2026-09-15T18:22:00+05:30",
  }),
  makeLead({
    id: "l4",
    leadNo: 1038,
    name: "Mohammed Iqbal",
    mobile: "9902234567",
    pinCode: "560078",
    loanAmount: 220000,
    partner: PARTNER_B,
    status: "DISBURSED",
    disbursementAmount: 200000,
    createdAt: "2026-09-15T10:05:00+05:30",
  }),
  makeLead({
    id: "l5",
    leadNo: 1037,
    name: "Priya Shetty",
    mobile: "9663341290",
    pinCode: "560011",
    loanAmount: 45000,
    status: "REJECTED",
    createdAt: "2026-09-14T16:48:00+05:30",
  }),
  makeLead({
    id: "l6",
    leadNo: 1036,
    name: "Suresh Babu",
    mobile: "9845123067",
    pinCode: "517501",
    loanAmount: 95000,
    status: "CONTACTED",
    createdAt: "2026-09-14T12:30:00+05:30",
  }),
  makeLead({
    id: "l7",
    leadNo: 1034,
    name: "Lakshmi Narayanan",
    mobile: "9741023458",
    pinCode: "560011",
    loanAmount: 80000,
    partner: PARTNER_B,
    duplicateFlag: true,
    createdAt: "2026-09-12T11:00:00+05:30",
  }),
];
