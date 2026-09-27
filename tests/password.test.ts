import { describe, it, expect } from "vitest";

import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("round-trips a correct password", async () => {
    const hash = await hashPassword("a-perfectly-good-passphrase");
    expect(await verifyPassword("a-perfectly-good-passphrase", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("a-perfectly-good-passphrase");
    expect(await verifyPassword("a-perfectly-good-passphras", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("never stores the password itself", async () => {
    const password = "a-perfectly-good-passphrase";
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
  });

  it("salts, so the same password hashes differently every time", async () => {
    const a = await hashPassword("same-password-twice-over");
    const b = await hashPassword("same-password-twice-over");
    expect(a).not.toBe(b);
    // ...and both still verify.
    expect(await verifyPassword("same-password-twice-over", a)).toBe(true);
    expect(await verifyPassword("same-password-twice-over", b)).toBe(true);
  });

  it("stores its parameters, so the cost can be raised without invalidating hashes", async () => {
    const hash = await hashPassword("a-perfectly-good-passphrase");
    const [scheme, N, r, p, salt, digest] = hash.split("$");
    expect(scheme).toBe("scrypt");
    expect(Number(N)).toBeGreaterThanOrEqual(16384);
    expect(Number(r)).toBeGreaterThan(0);
    expect(Number(p)).toBeGreaterThan(0);
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(digest).toMatch(/^[0-9a-f]{128}$/);
  });

  it("normalises unicode, so the same typed passphrase works across input methods", async () => {
    // "é" composed vs decomposed are different byte sequences for the same
    // character; without NFKC normalisation a staff member could be locked out
    // depending on their keyboard.
    const composed = "café-passphrase-long";
    const decomposed = "café-passphrase-long";
    const hash = await hashPassword(composed);
    expect(await verifyPassword(decomposed, hash)).toBe(true);
  });

  it("refuses a malformed or truncated stored hash rather than throwing", async () => {
    for (const bad of ["", "not-a-hash", "scrypt$1$2$3", "bcrypt$x$y$z$a$b", "scrypt$a$b$c$d$e"]) {
      await expect(verifyPassword("anything", bad)).resolves.toBe(false);
    }
  });
});

describe("password policy", () => {
  it("requires length over composition rules", () => {
    expect(validatePasswordStrength("short")).toBeTruthy();
    expect(validatePasswordStrength("P@ss1!")).toBeTruthy();
    // A long passphrase with no symbols is accepted — current NIST guidance.
    expect(validatePasswordStrength("correct horse battery staple")).toBeNull();
  });

  it("rejects leading or trailing whitespace, which is invisible and gets lost", () => {
    expect(validatePasswordStrength(" a-long-enough-passphrase")).toBeTruthy();
    expect(validatePasswordStrength("a-long-enough-passphrase ")).toBeTruthy();
  });

  it("rejects an absurdly long input", () => {
    expect(validatePasswordStrength("x".repeat(500))).toBeTruthy();
  });
});
