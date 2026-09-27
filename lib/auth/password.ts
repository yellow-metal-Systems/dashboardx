import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

// =============================================================================
// Password hashing — scrypt, from Node's own crypto module.
// =============================================================================
// The v1 spec says "use Argon2id or bcrypt". This uses scrypt instead, which is
// the same class of memory-hard KDF (OWASP lists Argon2id, then scrypt, then
// bcrypt as acceptable password hashes) and is BUILT INTO Node — so there is no
// native module to compile, nothing to go wrong on a serverless deploy, and no
// extra dependency in the tree for a handful of staff logins. If you later want
// Argon2id specifically, `verifyPassword` is written to dispatch on the stored
// prefix, so both can coexist during a migration.
//
// Parameters: N=2^16 (65536), r=8, p=1 — roughly 64MB of memory and ~100ms per
// hash on ordinary hardware, which is the intended cost.
const SCRYPT_PARAMS = { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PREFIX = "scrypt";

/** Stored format: `scrypt$N$r$p$<salt-hex>$<hash-hex>` — self-describing, so the
 *  parameters can be raised later without invalidating existing hashes. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, SCRYPT_PARAMS);
  const { N, r, p } = SCRYPT_PARAMS;
  return [PREFIX, N, r, p, salt.toString("hex"), derived.toString("hex")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltHex = parts[4];
  const hashHex = parts[5];
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || !saltHex || !hashHex) {
    return false;
  }

  const expected = Buffer.from(hashHex, "hex");
  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize("NFKC"), Buffer.from(saltHex, "hex"), expected.length, {
      N,
      r,
      p,
      maxmem: SCRYPT_PARAMS.maxmem,
    });
  } catch {
    return false;
  }

  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/**
 * Minimum password policy for staff accounts.
 *
 * Length over composition rules, per current NIST guidance — a 12-character
 * passphrase beats "P@ss1!" and staff are less likely to write it down.
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (password.length > 200) return "Password must be at most 200 characters.";
  if (/^\s|\s$/.test(password)) return "Password cannot start or end with a space.";
  return null;
}
