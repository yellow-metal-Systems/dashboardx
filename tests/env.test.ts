import { describe, it, expect, afterEach, vi } from "vitest";

// lib/env.ts throws at MODULE INIT, so each case needs a fresh module registry.
// vi.resetModules() plus a dynamic import gives us that.

const ORIGINAL = { ...process.env };

/**
 * NODE_ENV is typed readonly by Next's ambient types, so it needs a cast.
 *
 * Resolved at the CALL SITE rather than captured once: the cleanup below restores
 * process.env in place precisely so a stale reference cannot happen, but taking
 * the object fresh each time removes the trap entirely.
 */
const env = () => process.env as Record<string, string | undefined>;

async function loadEnv() {
  vi.resetModules();
  return import("@/lib/env");
}

const VALID_DB = "postgresql://user:pw@host:6543/postgres";
const VALID_SECRET = "a-session-secret-of-quite-sufficient-length";

afterEach(() => {
  // Restore IN PLACE. Reassigning process.env would hand every later test a
  // detached object, so writes would land somewhere the module under test never
  // reads — which is exactly how the NODE_ENV case below silently failed.
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL);
  vi.resetModules();
});

describe("configuration is validated at startup, in every environment", () => {
  it("REGRESSION: refuses to start without DATABASE_URL", async () => {
    // This is the bug this file exists to prevent. A blank DATABASE_URL used to
    // mean "serve the eight example leads from memory", so a misconfigured
    // production deploy showed staff a plausible dashboard of FAKE customers
    // whose status dropdown wrote to a Map that died with the lambda — while the
    // auto-close cron reported success doing nothing.
    //
    // There is no longer a fallback to fall into: this app has no offline mode,
    // so it now fails in development too rather than only in production.
    delete process.env.DATABASE_URL;
    process.env.SESSION_SECRET = VALID_SECRET;

    await expect(loadEnv()).rejects.toThrow(/DATABASE_URL is not set/);
  });

  it("refuses to start without SESSION_SECRET", async () => {
    // Without it, every /dashboard route and every server action would be
    // unauthenticated.
    process.env.DATABASE_URL = VALID_DB;
    delete process.env.SESSION_SECRET;

    await expect(loadEnv()).rejects.toThrow(/SESSION_SECRET is not set/);
  });

  it("rejects a SESSION_SECRET too short to be worth signing with", async () => {
    process.env.DATABASE_URL = VALID_DB;
    process.env.SESSION_SECRET = "too-short";

    await expect(loadEnv()).rejects.toThrow(/at least 32 characters/);
  });

  it("starts when both are present", async () => {
    process.env.DATABASE_URL = VALID_DB;
    process.env.SESSION_SECRET = VALID_SECRET;

    const env = await loadEnv();
    expect(env.DATABASE_URL).toBe(VALID_DB);
    expect(env.SESSION_SECRET).toBe(VALID_SECRET);
  });

  it("exposes no demo or example-data mode at all", async () => {
    process.env.DATABASE_URL = VALID_DB;
    process.env.SESSION_SECRET = VALID_SECRET;
    // Setting the old flag must have no effect — there is nothing left to switch on.
    process.env.LEADDESK_DEMO = "1";

    const env = await loadEnv();
    expect(env).not.toHaveProperty("DEMO_MODE");
  });
});

describe("production detection", () => {
  it("treats VERCEL_ENV=production as production", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.DATABASE_URL = VALID_DB;
    process.env.SESSION_SECRET = VALID_SECRET;

    expect((await loadEnv()).IS_PRODUCTION).toBe(true);
  });

  it("treats a Vercel preview as not-production", async () => {
    // A preview deploy has a real database and real auth, but it is not prod.
    process.env.VERCEL_ENV = "preview";
    process.env.DATABASE_URL = VALID_DB;
    process.env.SESSION_SECRET = VALID_SECRET;

    expect((await loadEnv()).IS_PRODUCTION).toBe(false);
  });

  it("falls back to NODE_ENV when VERCEL_ENV is absent", async () => {
    delete process.env.VERCEL_ENV;
    env().NODE_ENV = "production";
    process.env.DATABASE_URL = VALID_DB;
    process.env.SESSION_SECRET = VALID_SECRET;

    expect((await loadEnv()).IS_PRODUCTION).toBe(true);
  });
});

describe("optional configuration", () => {
  it("defaults SERVER_BASE_URL and tolerates a missing INTERNAL_API_KEY", async () => {
    process.env.DATABASE_URL = VALID_DB;
    process.env.SESSION_SECRET = VALID_SECRET;
    delete process.env.SERVER_BASE_URL;
    delete process.env.INTERNAL_API_KEY;

    const env = await loadEnv();
    expect(env.SERVER_BASE_URL).toBe("http://localhost:8080");
    // Absent is fine: the two figures server-bridge fetches simply don't render.
    expect(env.INTERNAL_API_KEY).toBe("");
  });
});
