import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sha256 } from "./render";

// Agreement PDFs live in Postgres (agreement_files, serverx migration 12): no
// storage service or extra secret, and each PDF is ~50–100 KB. Swap the body of
// these two functions for Supabase Storage if that ever stops being enough.

type FileDb = Pick<Prisma.TransactionClient, "agreementFile">;

export async function storeAgreementFile(bytes: Buffer, db: FileDb = prisma): Promise<{ id: string; sha256: string }> {
  const hash = sha256(bytes);
  const row = await db.agreementFile.create({
    data: { sha256: hash, sizeBytes: bytes.length, bytes: new Uint8Array(bytes) },
    select: { id: true },
  });
  return { id: row.id, sha256: hash };
}

export class AgreementFileError extends Error {}

/**
 * The stored bytes, checked against the hash recorded when they were stored.
 * Throws if the file is missing or its bytes no longer match: an agreement is
 * never shown or signed from a file that changed.
 */
export async function readAgreementFile(id: string, expectedSha256?: string, db: FileDb = prisma): Promise<Buffer> {
  const row = await db.agreementFile.findUnique({ where: { id }, select: { bytes: true, sha256: true } });
  if (!row) throw new AgreementFileError("The agreement file is missing.");
  const bytes = Buffer.from(row.bytes);
  const actual = sha256(bytes);
  if (actual !== row.sha256 || (expectedSha256 && actual !== expectedSha256)) {
    throw new AgreementFileError("The stored agreement does not match its fingerprint.");
  }
  return bytes;
}
