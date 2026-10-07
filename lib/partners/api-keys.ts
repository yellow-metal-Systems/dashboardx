import { createHash, randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";

// =============================================================================
// Organisation API keys (LeadBridge's /api/v1). Staff create and revoke them
// here; LeadBridge verifies them. Format lb_<prefix>_<secret>; only SHA-256 of
// the full key is stored, and the key is shown once when created.
// Moved from LeadBridge (lib/api-keys.ts) when the staff screens moved into LeadDesk.
// =============================================================================

const PREFIX_BYTES = 6; // 8 base64url chars
const SECRET_BYTES = 24; // 32 base64url chars, 192 bits

export const hashApiKey = (key: string) => createHash("sha256").update(key, "utf8").digest("hex");

export class ApiKeyError extends Error {}

/** Creates a key for a partner. Returns the full key — the only time it exists in clear. */
export async function createApiKey(partnerId: string, label: string, createdBy: string | null) {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId }, select: { status: true } });
  if (!partner) throw new ApiKeyError("Partner not found.");
  if (partner.status === "disabled") throw new ApiKeyError("Turn the partner back on before creating a key.");
  const name = label.trim();
  if (!name) throw new ApiKeyError("Give the key a name, e.g. “Production”.");

  const prefix = randomBytes(PREFIX_BYTES).toString("base64url");
  const key = `lb_${prefix}_${randomBytes(SECRET_BYTES).toString("base64url")}`;
  await prisma.partnerApiKey.create({
    data: { partnerId, label: name.slice(0, 80), keyPrefix: prefix, keyHash: hashApiKey(key), createdBy },
  });
  return { key, prefix };
}

export async function revokeApiKey(keyId: string) {
  await prisma.partnerApiKey.updateMany({ where: { id: keyId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function listApiKeys(partnerId: string) {
  return prisma.partnerApiKey.findMany({
    where: { partnerId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, keyPrefix: true, createdAt: true, lastUsedAt: true, revokedAt: true },
  });
}
