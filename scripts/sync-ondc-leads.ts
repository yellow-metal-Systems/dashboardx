// One-off/manual sync: pulls leads from the yellow_metal_ondc backend's
// dashboard-facing API and upserts them into LeadDesk's own Lead table,
// keyed on distributorRefId so re-running is idempotent.
//
// Usage: npx tsx scripts/sync-ondc-leads.ts [ondcBaseUrl]

import { PrismaClient, LeadStatus } from "@prisma/client";

const prisma = new PrismaClient();

// Matches yellow_metal_ondc/backend/prisma/schema.prisma's Lead model
// (getLeads returns raw rows, no field renaming). There is no
// distributor_ref_id, duplicate_flag, or ltv_pct on the backend — those
// were stale field names from before the backend restructure.
type OndcLead = {
  id: string;
  name: string;
  mobile_number: string;
  pincode: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  date_of_birth: string | null;
  gold_weight_grams: number | null;
  status: string;
};

type OndcLeadsResponse = {
  data: OndcLead[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
};

// Only LEAD_CREATED and DISBURSED are confirmed real backend status values
// (see server repo's QUESTIONS.md). UNDISBURSED is the backend's value for
// its 7-working-day timeout (Atharva's call 2026-09-25, still pending
// re-verification - was EXPIRED before), mapped the same way LeadDesk maps
// its own timed-out leads: to Rejected. Anything else unrecognized still
// falls back to New, but explicitly now instead of silently.
const STATUS_MAP: Record<string, LeadStatus> = {
  LEAD_CREATED: "New",
  DISBURSED: "Converted",
  UNDISBURSED: "Rejected",
};

function mapStatus(status: string): LeadStatus {
  return STATUS_MAP[status.trim().toUpperCase()] ?? "New";
}

// Backend statuses that represent a genuinely terminal, backend-driven
// outcome. Only these are allowed to overwrite LeadDesk's status on a
// re-sync — LEAD_CREATED (and anything unrecognized) maps to New, and
// blindly re-writing that on every run clobbers local-only progress the
// backend doesn't know about (staff marking a lead Contacted, or
// LeadDesk's own 7-working-day timeout auto-rejecting it) back to New.
const TERMINAL_BACKEND_STATUSES = new Set(["DISBURSED", "UNDISBURSED"]);

function isTerminalBackendStatus(status: string): boolean {
  return TERMINAL_BACKEND_STATUSES.has(status.trim().toUpperCase());
}

function joinAddress(line1: string | null, line2: string | null): string {
  return [line1, line2].filter(Boolean).join(", ");
}

async function main() {
  const baseUrl = process.argv[2] ?? "http://localhost:8080";
  let page = 1;
  let totalSynced = 0;

  while (true) {
    const res = await fetch(`${baseUrl}/api/internal/leads?page=${page}`, {
      headers: { "x-api-key": process.env.ONDC_INTERNAL_API_KEY ?? "" },
    });
    if (!res.ok) {
      throw new Error(`ONDC backend returned ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as OndcLeadsResponse;

    for (const lead of body.data) {
      // Backend's own lead id (YMLEAD########) is the natural cross-system
      // key — it's globally unique and stable, unlike the nonexistent
      // distributor_ref_id field this script used to read.
      await prisma.lead.upsert({
        where: { distributorRefId: lead.id },
        create: {
          distributorRefId: lead.id,
          source: "AARTHIKLABS",
          name: lead.name,
          mobile: lead.mobile_number,
          address: joinAddress(lead.address_line_1, lead.address_line_2),
          pinCode: lead.pincode ?? "",
          dob: lead.date_of_birth ? new Date(lead.date_of_birth) : null,
          goldGrams: lead.gold_weight_grams,
          status: mapStatus(lead.status),
        },
        update: {
          name: lead.name,
          mobile: lead.mobile_number,
          address: joinAddress(lead.address_line_1, lead.address_line_2),
          pinCode: lead.pincode ?? "",
          dob: lead.date_of_birth ? new Date(lead.date_of_birth) : null,
          goldGrams: lead.gold_weight_grams,
          ...(isTerminalBackendStatus(lead.status) ? { status: mapStatus(lead.status) } : {}),
        },
      });
      totalSynced++;
    }

    if (page >= body.pagination.total_pages) break;
    page++;
  }

  console.log(`Synced ${totalSynced} lead(s) from ${baseUrl} into LeadDesk.`);
}

main()
  .catch((err) => {
    console.error("Sync failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
