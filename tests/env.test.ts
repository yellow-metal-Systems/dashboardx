import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// lib/env.ts throws at MODULE INIT, so each case needs a fresh module registry.
// vi.resetModules() plus a dynamic import gives us that.

const ORIGINAL = { ...process.env };

// NODE_ENV is typed readonly by Next's ambient types. Named procEnv to avoid
// shadowing the `env` module each test loads.
const procEnv = process.env as Record<string, string | undefined>;

async function loadEnv() {
  vi.resetModules();
  return import("@/lib/env");
}

describe("production configuration is validated at startup", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
    vi.resetModules();
  });

  it("REGRESSION: refuses to start in production without DATABASE_URL", async () => {
    // This is the bug this file exists to prevent. isDemoMode() used to treat a
    // blank DATABASE_URL as "serve the eight example leads", so a misconfigured
    // production deploy showed staff a plausible dashboard of FAKE customers whose
    // status dropdown wrote to an in-memory Map that died with the lambda — and
    // the auto-close cron reported success while doing nothing.
    process.env.VERCEL_ENV = "production";
    delete process.env.DATABASE_URL;
    process.env.SESSION_SECRET = "a-session-secret-of-sufficient-length";

    await expect(loadEnv()).rejects.toThrow(/DATABASE_URL is not set/);
  });

  it("refuses to serve demo data in production even when a database is configured", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.DATABASE_URL = "postgresql://user:pw@host:6543/postgres";
    process.env.SESSION_SECRET = "a-session-secret-of-sufficient-length";
    process.env.LEADDESK_DEMO = "1";

    await expect(loadEnv()).rejects.toThrow(/LEADDESK_DEMO=1 is set in production/);
  });

  it("refuses to start in production without a session secret", async () => {
    // Without it, every /dashboard route and every server action would be
    // unauthenticated.
    process.env.VERCEL_ENV = "production";
    process.env.DATABASE_URL = "postgresql://user:pw@host:6543/postgres";
    delete process.env.SESSION_SECRET;
    process.env.LEADDESK_DEMO = "0";

    await expect(loadEnv()).rejects.toThrow(/SESSION_SECRET is not set/);
  });

  it("starts, with demo mode off, when production is configured properly", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.DATABASE_URL = "postgresql://user:pw@host:6543/postgres";
    process.env.SESSION_SECRET = "a-session-secret-of-sufficient-length";
    process.env.LEADDESK_DEMO = "0";

    const env = await loadEnv();
    expect(env.IS_PRODUCTION).toBe(true);
    expect(env.DEMO_MODE).toBe(false);
  });
});

describe("development still works without a database", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL };
    vi.resetModules();
  });

  it("falls back to demo mode when DATABASE_URL is absent outside production", async () => {
    // A fresh clone must run without anyone provisioning Postgres first.
    delete process.env.VERCEL_ENV;
    procEnv.NODE_ENV = "development";
    delete process.env.DATABASE_URL;
    delete process.env.LEADDESK_DEMO;

    const env = await loadEnv();
    expect(env.IS_PRODUCTION).toBe(false);
    expect(env.DEMO_MODE).toBe(true);
  });

  it("honours an explicit LEADDESK_DEMO=1 in development", async () => {
    delete process.env.VERCEL_ENV;
    procEnv.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://user:pw@localhost:5433/leaddesk";
    process.env.LEADDESK_DEMO = "1";

    expect((await loadEnv()).DEMO_MODE).toBe(true);
  });

  it("uses the real database in development when one is configured", async () => {
    delete process.env.VERCEL_ENV;
    procEnv.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://user:pw@localhost:5433/leaddesk";
    process.env.LEADDESK_DEMO = "0";

    expect((await loadEnv()).DEMO_MODE).toBe(false);
  });
});
