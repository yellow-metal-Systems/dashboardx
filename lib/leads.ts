export type LeadStatus = "New" | "Contacted" | "Converted" | "Rejected";

export type Lead = {
  id: string;
  customer: string;
  mobile: string;
  pincode: string;
  loanAmount: number;
  partner: string;
  duplicate: boolean;
  status: LeadStatus;
  submitted: string;
};

// Example / demo data only — not real customer data.
export const EXAMPLE_LEADS: Lead[] = [
  {
    id: "1",
    customer: "Lakshmi Narayanan",
    mobile: "9741023458",
    pincode: "560011",
    loanAmount: 85000,
    partner: "Sree Finserv",
    duplicate: true,
    status: "New",
    submitted: "16 Sep",
  },
  {
    id: "2",
    customer: "Arun Kumar",
    mobile: "9886712340",
    pincode: "560034",
    loanAmount: 150000,
    partner: "Kaveri Credit",
    duplicate: false,
    status: "Contacted",
    submitted: "16 Sep",
  },
  {
    id: "3",
    customer: "Divya Reddy",
    mobile: "9740098123",
    pincode: "500081",
    loanAmount: 60000,
    partner: "Sree Finserv",
    duplicate: false,
    status: "New",
    submitted: "15 Sep",
  },
  {
    id: "4",
    customer: "Mohammed Iqbal",
    mobile: "9902234567",
    pincode: "560078",
    loanAmount: 220000,
    partner: "Nandi Loans",
    duplicate: false,
    status: "Converted",
    submitted: "15 Sep",
  },
  {
    id: "5",
    customer: "Priya Shetty",
    mobile: "9663341290",
    pincode: "560011",
    loanAmount: 45000,
    partner: "Kaveri Credit",
    duplicate: false,
    status: "Rejected",
    submitted: "14 Sep",
  },
  {
    id: "6",
    customer: "Suresh Babu",
    mobile: "9845123067",
    pincode: "517501",
    loanAmount: 95000,
    partner: "Nandi Loans",
    duplicate: false,
    status: "Contacted",
    submitted: "14 Sep",
  },
];

export const LEAD_STATUSES: LeadStatus[] = [
  "New",
  "Contacted",
  "Converted",
  "Rejected",
];

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatInr(amount: number): string {
  return inrFormatter.format(amount);
}

// Tailwind utility classes for each status, built only from the brand's
// existing color tokens (no new colors invented).
export const STATUS_BADGE_CLASSES: Record<LeadStatus, string> = {
  New: "bg-surface-container-high text-on-surface-variant",
  Contacted: "bg-secondary-container text-on-secondary-container",
  Converted: "bg-primary-container text-on-primary-container",
  Rejected: "bg-error-container text-on-error-container",
};
