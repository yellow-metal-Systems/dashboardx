// Partner onboarding demo data (plan of 27 Oct 2026, steps A0 and A9).
//
//   npm run onboarding:demo -- seed            local database only
//   npm run onboarding:demo -- clean           lists the test rows it would delete
//   npm run onboarding:demo -- clean --yes     deletes them
//
// seed adds four TEST applications, one at each step an admin acts on, so a demo
// can show every screen without waiting for real applicants:
//   - TEST Suresh Gowda       individual, pending (send the BC agreement)
//   - TEST FinBuddy Services  company, pending (send the DSA agreement)
//   - TEST Kavya Shetty       individual, agreement sent (the signing link is printed)
//   - TEST Ravi Kumar         individual, signed by this script (countersign and approve)
// It goes through the same functions as LeadDesk (sendAgreement), except the
// signature, which is LeadBridge's job: it is written the way LeadBridge's
// signAgreement leaves the rows, with "seed script" as the device. Emails are
// always logged, never sent. Refuses to run against Supabase.
//
// clean removes every application whose applicant or company name starts with
// "TEST ", with its agreements, PDFs, history and emails, and the partners
// approved from them with their logins. A partner that already has leads or
// rewards is left alone and reported. Nothing else is touched (the AarthikLabs
// test leads stay). Safe on Supabase: it lists first and deletes only with --yes.
import { PrismaClient } from "@prisma/client";

process.env.EMAIL_MODE = "log";

const prisma = new PrismaClient();
const TEST = "TEST ";

const isShared = () => /supabase\.(co|com)/i.test(process.env.DATABASE_URL ?? "");

const BC_RATES = { perVerifiedApplicationRs: 150, disbursedPercent: 0.75, perActiveLoanMonthlyRs: 20, collectedPercent: 0.5 };

const APPLICANTS = [
  { key: "pending-individual", applicantType: "INDIVIDUAL", name: "TEST Suresh Gowda", email: "suresh.test@example.com", mobile: "9000000101", town: "Doddaballapur", address: "12, 3rd Cross, Old Bus Stand Road, Doddaballapur, Karnataka 561203", pan: "ABCPG1234F" },
  { key: "pending-company", applicantType: "COMPANY", name: "TEST Meena Rao", companyName: "TEST FinBuddy Services Pvt Ltd", email: "ops.test@example.com", mobile: "9000000102", town: "Bengaluru", address: "4th Floor, 80 Feet Road, Koramangala, Bengaluru, Karnataka 560034", gstin: "29ABCDE1234F1Z5" },
  { key: "sent", applicantType: "INDIVIDUAL", name: "TEST Kavya Shetty", email: "kavya.test@example.com", mobile: "9000000103", town: "Malur", address: "7, Temple Street, Malur, Karnataka 563130", pan: "ABCPS1234K" },
  { key: "signed", applicantType: "INDIVIDUAL", name: "TEST Ravi Kumar", email: "ravi.test@example.com", mobile: "9000000104", town: "Hoskote", address: "22, Market Road, Hoskote, Karnataka 562114", pan: "ABCPK1234R" },
] as const;

function testApplications() {
  return prisma.partnerApplication.findMany({
    where: { OR: [{ name: { startsWith: TEST } }, { companyName: { startsWith: TEST } }] },
    select: { id: true, name: true, companyName: true, status: true, partnerId: true },
  });
}

async function seed() {
  if (isShared()) throw new Error("seed is for the local demo database only; DATABASE_URL points at Supabase.");
  // Imported here so clean never loads the PDF renderer.
  const { sendAgreement } = await import("../lib/partners/applications");

  const admin = await prisma.adminUser.findFirst({ where: { role: "admin", isActive: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No active admin. Create one first: npm run db:create-admin");
  if ((await testApplications()).length) throw new Error("TEST applications already exist. Run clean --yes first.");

  for (const a of APPLICANTS) {
    const { key, ...data } = a;
    const app = await prisma.partnerApplication.create({ data });
    await prisma.partnerApplicationEvent.create({ data: { applicationId: app.id, action: "applied", actor: "applicant", detail: { via: "seed script" } } });

    if (key === "sent" || key === "signed") {
      await sendAgreement(app.id, BC_RATES, admin.email);
    }
    if (key === "signed") {
      const agreement = await prisma.partnerAgreement.findFirstOrThrow({ where: { applicationId: app.id, status: "SENT" } });
      await prisma.$transaction([
        prisma.partnerAgreement.update({
          where: { id: agreement.id },
          data: { status: "SIGNED", signerTypedName: app.name, signedAt: new Date(), signerIp: "127.0.0.1", signerUserAgent: "seed script" },
        }),
        prisma.partnerApplication.update({ where: { id: app.id }, data: { status: "SIGNED" } }),
        prisma.partnerApplicationEvent.create({ data: { applicationId: app.id, action: "signed", actor: "applicant", detail: { agreementId: agreement.id, via: "seed script" } } }),
      ]);
    }
    console.log(`${a.name.padEnd(20)} ${key}`);
    if (key === "sent") {
      const email = await prisma.emailMessage.findFirstOrThrow({ where: { applicationId: app.id, template: "agreement_sent" } });
      const link = email.bodyHtml?.match(/href="([^"]*\/agreement\/[^"]+)"/)?.[1];
      console.log(`  signing link: ${link ?? "(see Sent emails)"}  (sign as "${a.name}")`);
    }
  }
  console.log(`\nSent by ${admin.email}. Emails are on LeadDesk's Sent emails page.`);
}

async function clean(confirmed: boolean) {
  const apps = await testApplications();
  const appIds = apps.map((a) => a.id);
  const partnerIds = apps.flatMap((a) => (a.partnerId ? [a.partnerId] : []));

  const partners = await prisma.partner.findMany({
    where: { id: { in: partnerIds } },
    select: { id: true, orgName: true, _count: { select: { leads: true, rewards: true, rewardAuditLog: true } } },
  });
  const kept = partners.filter((p) => p._count.leads > 0 || p._count.rewards > 0 || p._count.rewardAuditLog > 0);
  const removable = partners.filter((p) => !kept.includes(p)).map((p) => p.id);
  const agreements = await prisma.partnerAgreement.findMany({
    where: { applicationId: { in: appIds } },
    select: { unsignedFileId: true, executedFileId: true },
  });
  const fileIds = agreements.flatMap((a) => [a.unsignedFileId, ...(a.executedFileId ? [a.executedFileId] : [])]);
  const emails = await prisma.emailMessage.count({ where: { applicationId: { in: appIds } } });

  console.log(`${isShared() ? "SUPABASE" : "local"} database`);
  for (const a of apps) console.log(`  application  ${a.companyName ?? a.name}  (${a.status})`);
  console.log(`  ${agreements.length} agreements, ${fileIds.length} PDFs, ${emails} emails, ${removable.length} partners with their logins`);
  for (const p of kept) console.log(`  KEPT partner ${p.orgName}: it has leads or rewards; remove it by hand if it really is a test`);

  if (!apps.length) return console.log("No TEST rows.");
  if (!confirmed) return console.log("\nNothing deleted. Run again with --yes to delete these.");

  await prisma.$transaction(async (tx) => {
    await tx.emailMessage.deleteMany({ where: { applicationId: { in: appIds } } });
    // Agreements and history go with their application (ON DELETE CASCADE).
    await tx.partnerApplication.deleteMany({ where: { id: { in: appIds } } });
    await tx.agreementFile.deleteMany({ where: { id: { in: fileIds } } });
    // Invites go with their login; API keys and payout details with the partner.
    await tx.partnerPayoutDetailsHistory.deleteMany({ where: { partnerId: { in: removable } } });
    await tx.partnerUser.deleteMany({ where: { partnerId: { in: removable } } });
    await tx.partner.deleteMany({ where: { id: { in: removable } } });
  });
  console.log("Deleted.");
}

async function main() {
  const [cmd, flag] = process.argv.slice(2);
  if (cmd === "seed") return seed();
  if (cmd === "clean") return clean(flag === "--yes");
  console.error("Usage: npm run onboarding:demo -- seed | clean [--yes]");
  process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
