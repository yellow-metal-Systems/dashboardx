// Environment validation that fails at module init, not per request.
//
// There is deliberately no fallback behaviour here. An earlier version treated a
// blank DATABASE_URL as "serve in-memory example data", which meant a
// misconfigured production deploy showed staff a plausible dashboard of fake
// customer records, with a status dropdown writing to a Map that died with the
// lambda — while the auto-close cron reported success doing nothing. A
// misconfigured deploy should fail to start, loudly, in every environment.

function required(name: string, hint: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. ${hint}`);
  }
  return value;
}

const vercelEnv = process.env.VERCEL_ENV?.trim();
export const IS_PRODUCTION =
  vercelEnv === "production" || (!vercelEnv && process.env.NODE_ENV === "production");

/**
 * The database. No fallback — this app has no mode in which it runs without one.
 */
export const DATABASE_URL = required(
  "DATABASE_URL",
  "This app reads and writes the shared `leads` table and has no offline mode. " +
    "See .env.example; use the Supabase transaction pooler in a deployed environment."
);

/**
 * Session cookie signing key. Without it every /dashboard route and every server
 * action would be unauthenticated, so it is required everywhere rather than only
 * in production.
 */
export const SESSION_SECRET = required(
  "SESSION_SECRET",
  "Generate one with: openssl rand -base64 32"
);

if (SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters.");
}

export const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 8);

/** Base URL of the serverx service, for the two read-only calls in lib/server-bridge.ts. */
export const SERVER_BASE_URL = process.env.SERVER_BASE_URL?.trim() || "http://localhost:8080";

/**
 * Must match serverx's INTERNAL_API_KEY. Optional: without it the two figures
 * server-bridge fetches simply do not render, and nothing else is affected.
 */
export const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY?.trim() ?? "";

/** LeadBridge, the partner app: invite links sent to partners point here. */
export const LEADBRIDGE_URL = process.env.LEADBRIDGE_URL?.trim() || "http://localhost:3200";
