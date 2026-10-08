import { INTERNAL_API_KEY, SERVER_BASE_URL } from "./env";
import type { GoldInsights } from "./leads";

// =============================================================================
// Calls into the sibling `serverx` service.
// =============================================================================
// Almost nothing needs this any more: both apps read and write the same `leads`
// table, so there is no lead syncing. What is left is the small set of things
// serverx genuinely owns.
//
// The status-change path deliberately does NOT go through here — it writes the
// status and a `lead_status_outbox` row in one local transaction, and serverx
// drains that. See updateLeadStatusRepo in lib/leads-repo.ts for why.

const FETCH_TIMEOUT_MS = 4_000;

function isConfigured(): boolean {
  return Boolean(INTERNAL_API_KEY);
}

/**
 * Max eligible loan at 68% (Bullet) and 75% (Monthly) LTV, plus the 22K rate used.
 *
 * Owned by serverx because it calls the live gold-rate API and caches it. Both
 * figures are returned rather than one chosen: no field records which plan a lead
 * is on, and the branch manager picks it in person after assessing the real gold.
 *
 * Non-critical: returns null on any failure so a lead page still renders when the
 * sibling service or the gold API is down. The UI shows "unavailable" rather than
 * a wrong number.
 */
export async function fetchGoldInsights(leadId: string): Promise<GoldInsights | null> {
  if (!isConfigured()) return null;

  try {
    const res = await fetch(
      `${SERVER_BASE_URL}/api/internal/leads/${encodeURIComponent(leadId)}`,
      {
        headers: { "x-api-key": INTERNAL_API_KEY },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;

    const body = (await res.json()) as {
      data?: {
        dashboard_insights?: {
          current_22k_spot_rate_used?: number | null;
          rate_source?: GoldInsights["rateSource"];
          max_eligible_loan_amount_bullet_68_ltv?: number | null;
          max_eligible_loan_amount_monthly_75_ltv?: number | null;
        };
      };
    };

    const insights = body.data?.dashboard_insights;
    if (!insights) return null;

    return {
      rateUsed: insights.current_22k_spot_rate_used ?? null,
      rateSource: insights.rate_source ?? null,
      maxEligibleBullet68: insights.max_eligible_loan_amount_bullet_68_ltv ?? null,
      maxEligibleMonthly75: insights.max_eligible_loan_amount_monthly_75_ltv ?? null,
    };
  } catch {
    // Deliberately swallowed: this is a decorative figure on a page that must
    // still render the lead.
    return null;
  }
}

export type IntegrationHealth = {
  healthy: boolean;
  outboxBacklogOver15Min: number;
  webhooksInFlight: number;
  webhooksFailed: number;
};

/**
 * Is the AarthikLabs bridge healthy?
 *
 * A non-zero outbox backlog means staff status changes are NOT reaching
 * AarthikLabs — otherwise invisible until a partner asks why they never heard
 * about a disbursal.
 */
export async function fetchIntegrationHealth(): Promise<IntegrationHealth | null> {
  if (!isConfigured()) return null;

  try {
    const res = await fetch(`${SERVER_BASE_URL}/api/internal/integration-health`, {
      headers: { "x-api-key": INTERNAL_API_KEY },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const body = (await res.json()) as {
      data?: {
        healthy: boolean;
        outbox_backlog_over_15min: number;
        webhooks_in_flight: number;
        webhooks_failed: number;
      };
    };
    if (!body.data) return null;

    return {
      healthy: body.data.healthy,
      outboxBacklogOver15Min: body.data.outbox_backlog_over_15min,
      webhooksInFlight: body.data.webhooks_in_flight,
      webhooksFailed: body.data.webhooks_failed,
    };
  } catch {
    return null;
  }
}

export type RewardSync = {
  created: number;
  /** Disbursed leads that will earn once their loan amount is recorded. */
  awaiting: { leadId: string; name: string; partnerId: string; orgName: string }[];
};

/**
 * Asks serverx — the only place rewards are calculated — to create any partner
 * rewards that are due now (it also does this every minute). Null if serverx is
 * unreachable: the Rewards page still shows what already exists.
 */
export async function syncRewards(partnerId?: string): Promise<RewardSync | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(`${SERVER_BASE_URL}/api/internal/rewards/sync`, {
      method: "POST",
      headers: { "x-api-key": INTERNAL_API_KEY, "content-type": "application/json" },
      body: JSON.stringify(partnerId ? { partner_id: partnerId } : {}),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      created: number;
      awaiting: { lead_id: string; name: string; partner_id: string; org_name: string }[];
    };
    return {
      created: body.created,
      awaiting: body.awaiting.map((a) => ({ leadId: a.lead_id, name: a.name, partnerId: a.partner_id, orgName: a.org_name })),
    };
  } catch {
    return null;
  }
}

export type BranchInfo = { name: string; state: string };

/**
 * Branch names by id. The branch master lives in serverx (src/data/branches.ts);
 * cached for an hour; empty if serverx can't be reached (pages then show the id).
 */
export async function fetchBranchNames(): Promise<Map<string, BranchInfo>> {
  if (!isConfigured()) return new Map();
  try {
    const res = await fetch(`${SERVER_BASE_URL}/api/internal/branches`, {
      headers: { "x-api-key": INTERNAL_API_KEY },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return new Map();
    const body = (await res.json()) as { branches: { branch_id: string; branch_name: string; state: string }[] };
    return new Map(body.branches.map((b) => [b.branch_id, { name: b.branch_name, state: b.state }]));
  } catch {
    return new Map();
  }
}

/**
 * Applies an LMS loan event that couldn't be matched to the lead staff picked
 * (serverx applies it exactly as if the LMS had named the lead).
 */
export async function resolveLmsEvent(
  eventId: string,
  leadId: string,
  actor: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isConfigured()) return { ok: false, error: "The lead service isn't configured." };
  try {
    const res = await fetch(`${SERVER_BASE_URL}/api/internal/lms/loan-events/${encodeURIComponent(eventId)}/resolve`, {
      method: "POST",
      headers: { "x-api-key": INTERNAL_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ lead_id: leadId, actor }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, error: body?.message ?? `The lead service answered ${res.status}.` };
  } catch {
    return { ok: false, error: "Couldn't reach the lead service. Try again." };
  }
}
