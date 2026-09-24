// One-off/manual sync: pulls leads from the yellow_metal_ondc backend's
// dashboard-facing API and upserts them into LeadDesk's own Lead table,
// keyed on distributorRefId so re-running is idempotent.
//
// Usage: npx tsx scripts/sync-ondc-leads.ts [ondcBaseUrl]

import { PrismaClient, LeadStatus } from "@prisma/client";

const prisma = new PrismaClient();

type OndcLead = {
  id: string;
  distributor_ref_id: string | null;
  borrower_name: string;
  mobile_number: string;
  address: string | null;
  pincode: string | null;
  dob: string | null;
  gold_weight_grams: number | null;
  ltv_pct: number | null;
  status: string;
  duplicate_flag: boolean;
};

type OndcLeadsResponse = {
  data: OndcLead[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
};

function mapStatus(status: string): LeadStatus {
  const normalized = status.trim().toLowerCase();
  const known: Record<string, LeadStatus> = {
    new: "New",
    contacted: "Contacted",
    converted: "Converted",
    rejected: "Rejected",
  };
  return known[normalized] ?? "New";
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
      if (!lead.distributor_ref_id) continue; // nothing to key the upsert on, skip

      await prisma.lead.upsert({
        where: { distributorRefId: lead.distributor_ref_id },
        create: {
          distributorRefId: lead.distributor_ref_id,
          source: "AARTHIKLABS",
          name: lead.borrower_name,
          mobile: lead.mobile_number,
          address: lead.address ?? "",
          pinCode: lead.pincode ?? "",
          dob: lead.dob ? new Date(lead.dob) : null,
          goldGrams: lead.gold_weight_grams,
          ltvPercent: lead.ltv_pct,
          duplicateFlag: lead.duplicate_flag,
          status: mapStatus(lead.status),
        },
        update: {
          name: lead.borrower_name,
          mobile: lead.mobile_number,
          address: lead.address ?? "",
          pinCode: lead.pincode ?? "",
          dob: lead.dob ? new Date(lead.dob) : null,
          goldGrams: lead.gold_weight_grams,
          ltvPercent: lead.ltv_pct,
          duplicateFlag: lead.duplicate_flag,
          status: mapStatus(lead.status),
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
