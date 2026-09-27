// Seeds example data for local development.
//
// Every row it writes is marked `isDemo: true`, so synthetic data stays
// distinguishable from real leads forever rather than relying on id-prefix
// guesswork. It refuses to run against a production environment.
//
//   npm run db:seed
//   npm run db:seed -- --admin-only        # just the staff login
//
// NOTE: this seeds tables whose schema is owned by the `serverx` repo. It only
// ever INSERTs/UPDATEs rows — it never issues DDL — so it is safe to run here.

import { PrismaClient, type PartnerStatus } from "@prisma/client";

import { EXAMPLE_LEADS, EXAMPLE_PARTNERS, SOURCE_LABELS, statusLabel } from "../lib/leads";
import { hashPassword } from "../lib/auth/password";

const prisma = new PrismaClient();

if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed example data into a production environment.");
}

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

/**
 * The first staff account, so a fresh environment is usable.
 *
 * Deliberately NOT a weak default: the password is read from an environment
 * variable, and the script tells you what to set rather than seeding
 * "admin/admin" that someone forgets to change.
 */
async function seedAdminUser(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@yellowmetal.example").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    console.log(
      "\nSkipped the staff account: SEED_ADMIN_PASSWORD is not set.\n" +
        "  To create one:  SEED_ADMIN_PASSWORD='a-long-passphrase' npm run db:seed\n" +
        `  (email defaults to ${email}; override with SEED_ADMIN_EMAIL)\n`
    );
    return;
  }

  if (password.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters.");
  }

  const passwordHash = await hashPassword(password);
  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, isActive: true },
    create: { email, name: "Yellow Metal Admin", passwordHash, role: "admin" },
  });
  console.log(`Staff account ready: ${email}`);
}

async function seedExampleData(): Promise<void> {
  for (const p of PARTNERS) {
    const data = {
      orgName: p.orgName,
      contactEmail: p.contactEmail,
      status: p.status,
      isDemo: true,
      createdAt: new Date(p.createdAt),
    };
    await prisma.partner.upsert({
      where: { id: p.id },
      update: data,
      create: { id: p.id, ...data },
    });
  }

  for (const l of EXAMPLE_LEADS) {
    // Note the field set: there is no single `address` column — the structured
    // address_line_1 / address_line_2 pair is what the partner contract carries,
    // and the UI joins them for display.
    const data = {
      leadNo: l.leadNo,
      partnerId: l.partner?.id ?? null,
      source: l.source,
      customerId: l.customerId,
      loanId: l.loanId,
      name: l.name,
      mobile: l.mobile,
      addressLine1: l.addressLine1,
      addressLine2: l.addressLine2,
      pinCode: l.pinCode,
      loanAmount: l.loanAmount,
      dob: l.dob ? new Date(l.dob) : null,
      goldGrams: l.goldGrams,
      offerAmount: l.offerAmount,
      ltvPercent: l.ltvPercent,
      kfsReference: l.kfsReference,
      offerAcceptedAt: l.offerAcceptedAt ? new Date(l.offerAcceptedAt) : null,
      acceptanceState: l.acceptanceState,
      status: l.status,
      duplicateFlag: l.duplicateFlag,
      branchManagerStatus: l.branchManagerStatus,
      loanConfirmedAmount: l.loanConfirmedAmount,
      loanConfirmedAt: l.loanConfirmedAt ? new Date(l.loanConfirmedAt) : null,
      disbursementAmount: l.disbursementAmount,
      disbursementDate: l.disbursementDate ? new Date(l.disbursementDate) : null,
      productType: l.productType,
      tenure: l.tenure,
      tenureUnit: l.tenureUnit,
      isDemo: true,
      sourceCreatedAt: new Date(l.createdAt),
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
        toStatus: "LEAD_CREATED",
        message: l.duplicateFlag
          ? `Lead submitted by ${submitter}, flagged as duplicate`
          : `Lead submitted by ${submitter}`,
        actor: l.source === "AARTHIKLABS" ? "system:aarthiklabs" : "demo@yellowmetal.example",
        createdAt: new Date(l.createdAt),
      },
    });

    if (l.status !== "LEAD_CREATED") {
      await prisma.leadActivity.create({
        data: {
          leadId: l.id,
          kind: l.disbursementAmount !== null ? "DISBURSEMENT_RECORDED" : "STATUS_CHANGED",
          fromStatus: "LEAD_CREATED",
          toStatus: l.status,
          message: `Status changed ${statusLabel("LEAD_CREATED")} → ${statusLabel(l.status)}`,
          actor: "demo@yellowmetal.example",
          createdAt: new Date(l.updatedAt),
        },
      });
    }
  }

  // Explicit lead numbers bypass the sequence; move it past them so a lead
  // created afterwards doesn't collide on leads_lead_no_key.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('leads', 'lead_no'), (SELECT COALESCE(MAX(lead_no), 1000) FROM leads))`
  );

  console.log(`Seeded ${PARTNERS.length} partners and ${EXAMPLE_LEADS.length} leads (all isDemo).`);
}

async function main(): Promise<void> {
  const adminOnly = process.argv.includes("--admin-only");
  if (!adminOnly) await seedExampleData();
  await seedAdminUser();
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
