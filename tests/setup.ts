// Test defaults, set before any module under test reads process.env at import
// time. lib/env.ts throws at module init on a bad production configuration, so the
// order matters.
// NODE_ENV is typed readonly by Next's ambient types, hence the cast.
const mutableEnv = process.env as Record<string, string | undefined>;
mutableEnv.NODE_ENV = mutableEnv.NODE_ENV ?? "test";
delete process.env.VERCEL_ENV;

process.env.SESSION_SECRET = "test-session-secret-at-least-32-characters-long";
// Database tests (tests/*.db.test.ts) run against TEST_DATABASE_URL — a throwaway
// Postgres migrated by serverx, which they wipe. Never a Supabase URL. Without
// it they skip.
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (testDatabaseUrl && /supabase\.(co|com)/i.test(testDatabaseUrl)) {
  throw new Error("TEST_DATABASE_URL points at Supabase. Tests truncate tables, refusing to run.");
}
// lib/env.ts now requires a database URL in every environment.
process.env.DATABASE_URL = testDatabaseUrl ?? process.env.DATABASE_URL ?? "postgresql://test:test@127.0.0.1:1/test";

// No test should reach the sibling service or a real database.
delete process.env.INTERNAL_API_KEY;
process.env.SERVER_BASE_URL = "http://127.0.0.1:1";
