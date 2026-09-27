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
