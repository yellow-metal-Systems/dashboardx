import { describe, it, expect } from "vitest";

import { formatAge } from "@/hooks/use-live-refresh";

const at = (iso: string) => new Date(iso);

describe("formatAge", () => {
  const now = at("2026-09-27T12:00:00.000Z");

  it("says 'just now' for the first few seconds", () => {
    expect(formatAge(at("2026-09-27T12:00:00.000Z"), now)).toBe("just now");
    expect(formatAge(at("2026-09-27T11:59:55.000Z"), now)).toBe("just now");
  });

  it("counts seconds under a minute", () => {
    expect(formatAge(at("2026-09-27T11:59:45.000Z"), now)).toBe("15s ago");
  });

  it("switches to minutes, then hours", () => {
    expect(formatAge(at("2026-09-27T11:58:00.000Z"), now)).toBe("2m ago");
    expect(formatAge(at("2026-09-27T11:01:00.000Z"), now)).toBe("59m ago");
    // Rolls straight to hours at 60 minutes rather than saying "60m ago".
    expect(formatAge(at("2026-09-27T11:00:00.000Z"), now)).toBe("1h ago");
    expect(formatAge(at("2026-09-27T09:30:00.000Z"), now)).toBe("3h ago");
  });

  it("never shows a negative age from clock skew", () => {
    // The timestamp is set client-side; a corrected system clock could briefly put
    // it in the future, and "-4s ago" would look broken.
    expect(formatAge(at("2026-09-27T12:00:30.000Z"), now)).toBe("just now");
  });
});
