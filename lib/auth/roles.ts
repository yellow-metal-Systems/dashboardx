// =============================================================================
// LeadDesk roles and what each may do (standup 2026-10-15, Rahul):
//
//   admin               everything, including partners, reward rules and the team
//   financial_operator  leads, the LMS review queue, and rewards (approve, reject,
//                       pay, see bank details) — no partners, rules or team
//   customer_support    leads only: view and change status. No rewards, no partners.
//
// The exact split for financial_operator is our reading of the meeting and still
// to be confirmed with Rahul; change it HERE and every page and action follows.
// Pages and server actions check a permission, never a role name.
// =============================================================================

export const STAFF_ROLES = ["admin", "financial_operator", "customer_support"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Admin",
  financial_operator: "Financial operator",
  customer_support: "Customer support",
};

export const PERMISSIONS = [
  "leads.view",
  "leads.update",
  "lms.resolve",
  "partners.view",
  "partners.manage",
  "rewards.view",
  "rewards.manage",
  "rewardRules.manage",
  "team.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const GRANTS: Record<StaffRole, readonly Permission[]> = {
  admin: PERMISSIONS,
  financial_operator: ["leads.view", "leads.update", "lms.resolve", "rewards.view", "rewards.manage"],
  customer_support: ["leads.view", "leads.update"],
};

/** A stored role, or null for anything unknown (a row from before migration 10 reads as customer_support). */
export function parseRole(value: string | null | undefined): StaffRole | null {
  if (value === "staff") return "customer_support";
  return (STAFF_ROLES as readonly string[]).includes(value ?? "") ? (value as StaffRole) : null;
}

export function can(role: StaffRole | null, permission: Permission): boolean {
  return role !== null && GRANTS[role].includes(permission);
}

export function permissionsOf(role: StaffRole | null): Permission[] {
  return role ? [...GRANTS[role]] : [];
}
