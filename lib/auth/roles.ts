// =============================================================================
// LeadDesk roles and what each may do (standup 2026-10-15, confirmed 2026-10-19):
//
//   admin               everything, including partners, rewards, the LMS review
//                       queue, reward rules and the team
//   financial_operator  leads only: view them and change their status. Nothing else.
//   customer_support    leads only, read-only: view them, change nothing.
//
// Change it HERE and every page and action follows.
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
  financial_operator: ["leads.view", "leads.update"],
  customer_support: ["leads.view"],
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
