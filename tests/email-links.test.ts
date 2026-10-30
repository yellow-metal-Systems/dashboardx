import { describe, it, expect } from "vitest";

import { linkName, shortPath } from "@/lib/email-links";

describe("demo email links", () => {
  it("names a link by its path, whatever the host", () => {
    expect(linkName("http://localhost:3200/invite/45vo5JThh0RKrENodlvfQbOxRALVfq1YPv_0QW53d8M")).toBe("Set-password link");
    expect(linkName("https://partners.yellowmetal.in/agreement/abc123")).toBe("Signing link");
    expect(linkName("https://partners.yellowmetal.in/install")).toBe("Add-to-home-screen page");
    expect(linkName("https://example.com/help")).toBe("Link");
    expect(linkName("not a url")).toBe("Link");
  });

  it("shortens long tokens but keeps short paths whole", () => {
    expect(shortPath("http://localhost:3200/invite/45vo5JThh0RKrENodlvfQbOxRALVfq1YPv_0QW53d8M")).toBe("/invite/45vo5J…3d8M");
    expect(shortPath("https://partners.yellowmetal.in/install")).toBe("/install");
  });
});
