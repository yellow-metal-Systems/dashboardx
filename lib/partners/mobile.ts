// Moved from LeadBridge (lib/mobile.ts) when the staff screens moved into LeadDesk.

// Indian mobile numbers, as partners type them.
//
// Accept "+91 98765 43210", "098765-43210" etc. and keep the 10 digits — the
// same normalisation serverx applies to Lead.mobile_number, so a partner's login
// and a borrower's lead are stored in one shape.
export function normaliseMobile(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
}

export const isValidMobile = (m: string): boolean => /^[6-9]\d{9}$/.test(m);
