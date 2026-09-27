// Test defaults, set before any module under test reads process.env at import
// time. lib/env.ts throws at module init on a bad production configuration, so the
// order matters.
// NODE_ENV is typed readonly by Next's ambient types, hence the cast.
const mutableEnv = process.env as Record<string, string | undefined>;
mutableEnv.NODE_ENV = mutableEnv.NODE_ENV ?? "test";
delete process.env.VERCEL_ENV;

process.env.SESSION_SECRET = "test-session-secret-at-least-32-characters-long";
process.env.LEADDESK_DEMO = "0";

// No test should reach the sibling service or a real database.
delete process.env.INTERNAL_API_KEY;
process.env.SERVER_BASE_URL = "http://127.0.0.1:1";
