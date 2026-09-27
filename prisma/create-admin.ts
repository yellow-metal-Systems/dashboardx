// Creates or updates a staff login. The only bootstrap this app needs.
//
//   ADMIN_EMAIL='you@yellowmetal.example' ADMIN_PASSWORD='a-long-passphrase' \
//     npm run db:create-admin
//
// Replaces the old prisma/seed.ts, which also inserted eight example leads and
// five example partners. There is no example data in this app any more: it reads
// and writes the real shared `leads` table, and fake rows that look real are a
// liability in a staff tool.
//
// This only INSERTs/UPDATEs a row — it issues no DDL. The schema is owned by the
// serverx repo.

import { PrismaClient } from "@prisma/client";

import { hashPassword, validatePasswordStrength } from "../lib/auth/password";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Yellow Metal staff";
  const role = process.env.ADMIN_ROLE?.trim() === "staff" ? "staff" : "admin";

  if (!email || !password) {
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD.\n\n" +
        "  ADMIN_EMAIL='you@yellowmetal.example' ADMIN_PASSWORD='a-long-passphrase' \\\n" +
        "    npm run db:create-admin\n"
    );
  }

  const weak = validatePasswordStrength(password);
  if (weak) throw new Error(`ADMIN_PASSWORD rejected: ${weak}`);

  const passwordHash = await hashPassword(password);

  const existing = await prisma.adminUser.findUnique({ where: { email } });

  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, isActive: true, name, role },
    create: { email, name, passwordHash, role },
  });

  console.log(
    existing
      ? `Updated the password for ${email} (role: ${role}).`
      : `Created staff account ${email} (role: ${role}).`
  );
  console.log("Sign in at /login.");
}

main()
  .catch((err) => {
    console.error("\n" + (err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
