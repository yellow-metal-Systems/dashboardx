// Environment validation that fails at module init, not per request.
//
// WHY THIS THROWS
// `isDemoMode()` used to treat a blank DATABASE_URL as "serve the eight example
// leads". In production that means staff see a plausible dashboard of fake
// customers, with a status dropdown that writes to an in-memory Map which dies
// with the lambda — and the auto-close cron reported success while doing nothing.
// A misconfigured deploy looked like a working one. That is strictly worse than
// an error page, so a module-scope throw is deliberate: it fails the route render
// immediately and shows up in the platform's boot logs.

function isTruthy(value: string | undefined): boolean {
  return value?.trim() === "1" || value?.trim().toLowerCase() === "true";
}

const vercelEnv = process.env.VERCEL_ENV?.trim();
export const IS_PRODUCTION =
  vercelEnv === "production" || (!vercelEnv && process.env.NODE_ENV === "production");

const explicitDemo = isTruthy(process.env.LEADDESK_DEMO);
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

if (IS_PRODUCTION && !hasDatabaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Refusing to start in production — falling back to " +
      "in-memory demo data would show staff fake customer records that look real."
  );
}

if (IS_PRODUCTION && explicitDemo) {
  throw new Error(
    "LEADDESK_DEMO=1 is set in production. Refusing to serve example data to staff."
  );
}

if (IS_PRODUCTION && !process.env.SESSION_SECRET?.trim()) {
  throw new Error(
    "SESSION_SECRET is not set. Refusing to start in production — every /dashboard " +
      "route and server action would be unauthenticated."
  );
}

/**
 * Demo mode is now opt-in and development-only. A missing DATABASE_URL outside
 * production still falls back, so a fresh clone runs without a database.
 */
export const DEMO_MODE = !IS_PRODUCTION && (explicitDemo || !hasDatabaseUrl);

/** Base URL of the serverx service, used for the status-update bridge. */
export const SERVER_BASE_URL = process.env.SERVER_BASE_URL?.trim() || "http://localhost:8080";

export const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY?.trim() ?? "";

/**
 * Session cookie signing secret. In development a fixed fallback keeps logins
 * working across restarts; production is validated above.
 */
export const SESSION_SECRET =
  process.env.SESSION_SECRET?.trim() ||
  "dev-only-session-secret-not-for-production-use-min-32-chars";

export const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 8);
