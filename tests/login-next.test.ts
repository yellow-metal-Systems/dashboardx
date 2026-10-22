import { describe, it, expect } from "vitest";

import { safeNextPath } from "@/lib/auth/session";

// After sign-in, ?next= may only send you somewhere inside LeadDesk.
describe("safeNextPath", () => {
  it("keeps a /dashboard path", () => {
    for (const p of ["/dashboard", "/dashboard/settings", "/dashboard?status=NEW", "/dashboard/leads/YMLEAD1?tab=x"]) {
      expect(safeNextPath(p)).toBe(p);
    }
  });

  it("falls back to /dashboard for anything else", () => {
    for (const p of [undefined, null, "", "/", "/login", "/dashboardx", "https://evil.example/dashboard", "//evil.example", "/dashboard//evil.example", "/dashboard/\\evil", "/\\evil.example"]) {
      expect(safeNextPath(p)).toBe("/dashboard");
    }
  });
});
