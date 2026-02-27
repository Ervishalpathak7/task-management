import { randomBytes, createHash } from "node:crypto";

/**
 * Generate a cryptographically random opaque token.
 * Returns the raw token (sent to user) and its SHA-256 hash (stored in DB).
 */
export function generateOpaqueToken(byteLength = 32): {
  raw: string;
  hash: string;
} {
  const raw = randomBytes(byteLength).toString("hex");
  const hash = hashToken(raw);
  return { raw, hash };
}

/**
 * SHA-256 hash a token string for safe DB storage.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Compare a raw token against a stored hash.
 */
export function verifyTokenHash(rawToken: string, storedHash: string): boolean {
  const hash = hashToken(rawToken);
  // Constant-time comparison via buffer comparison
  if (hash.length !== storedHash.length) return false;
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Re-export from crypto for convenience
import { timingSafeEqual } from "node:crypto";
