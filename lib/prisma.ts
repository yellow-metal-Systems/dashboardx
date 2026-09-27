import { PrismaClient } from "@prisma/client";

// Imported for its side effect: lib/env.ts validates the environment at module
// init and throws in production if DATABASE_URL or SESSION_SECRET is missing, so
// a misconfigured deploy fails loudly instead of silently serving demo data.
import "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Query logging is a development tool. In production it would print borrower
// mobile numbers and PAN values into the platform's logs.
const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["warn", "error"] : ["warn", "error"],
  });

// Cached across hot reloads in development. On Vercel each concurrent lambda gets
// its own client regardless, which is why DATABASE_URL must point at the
// transaction pooler with connection_limit=1 (see .env.example).
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { prisma };
