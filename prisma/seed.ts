import { PrismaClient, type PartnerStatus } from "@prisma/client";

import { EXAMPLE_LEADS, EXAMPLE_PARTNERS, SOURCE_LABELS } from "../lib/leads";

const prisma = new PrismaClient();

type SeedPartner = {
  id: string;
  orgName: string;
  contactEmail: string;
  status: PartnerStatus;
  createdAt: string;
};

// Example / demo data only — not real partner data.
const PARTNERS: SeedPartner[] = [
  ...EXAMPLE_PARTNERS.map((p, i) => ({
    ...p,
    status: "active" as const,
    createdAt: ["2026-01-12", "2026-02-03", "2026-03-19"][i] ?? "2026-04-02",
  })),
  {
    id: "p_metro",
    orgName: "Metro Gold Connect",
    contactEmail: "hello@metrogoldconnect.example",
    status: "invited",
    createdAt: "2026-09-18",
  },
  {
    id: "p_kcc",
    orgName: "Karnataka Credit Co-op",
    contactEmail: "admin@kcc-coop.example",
    status: "disabled",
    createdAt: "2026-01-28",
  },
];

async function main() {
  for (const p of PARTNERS) {
    const data = {
      orgName: p.orgName,
      contactEmail: p.contactEmail,
      status: p.status,
      createdAt: new Date(p.createdAt),
    };
    await prisma.partner.upsert({
      where: { id: p.id },
      update: data,
      create: { id: p.id, ...data },
    });
  }

  for (const l of EXAMPLE_LEADS) {
    const data = {
      leadNo: l.leadNo,
      partnerId: l.partner?.id ?? null,
      source: l.source,
      name: l.name,
      mobile: l.mobile,
      address: l.address,
      pinCode: l.pinCode,
      loanAmount: l.loanAmount,
      dob: l.dob ? new Date(l.dob) : null,
      goldGrams: l.goldGrams,
      offerAmount: l.offerAmount,
      ltvPercent: l.ltvPercent,
      kfsReference: l.kfsReference,
      acceptanceState: l.acceptanceState,
      status: l.status,
      duplicateFlag: l.duplicateFlag,
      branchManagerStatus: l.branchManagerStatus,
      loanConfirmedAmount: l.loanConfirmedAmount,
      loanConfirmedAt: l.loanConfirmedAt ? new Date(l.loanConfirmedAt) : null,
      createdAt: new Date(l.createdAt),
      updatedAt: new Date(l.updatedAt),
    };
    await prisma.lead.upsert({
      where: { id: l.id },
      update: data,
      create: { id: l.id, ...data },
    });

    const submitter = l.partner?.orgName ?? SOURCE_LABELS[l.source];
    await prisma.leadActivity.deleteMany({ where: { leadId: l.id } });
    await prisma.leadActivity.create({
      data: {
        leadId: l.id,
        kind: "SUBMITTED",
        message: l.duplicateFlag
          ? `Lead submitted by ${submitter}, flagged as duplicate`
          : `Lead submitted by ${submitter}`,
        createdAt: new Date(l.createdAt),
      },
    });
    if (l.status !== "New") {
      await prisma.leadActivity.create({
        data: {
          leadId: l.id,
          kind: "STATUS_CHANGED",
          fromStatus: "New",
          toStatus: l.status,
          message: `Status changed New → ${l.status}`,
          createdAt: new Date(l.updatedAt),
        },
      });
    }
  }

  // Explicit lead numbers bypass the sequence; move it past them so new leads don't collide.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('leads', 'lead_no'), (SELECT COALESCE(MAX(lead_no), 1000) FROM leads))`
  );

  console.log(
    `Seeded ${PARTNERS.length} partners and ${EXAMPLE_LEADS.length} leads.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
