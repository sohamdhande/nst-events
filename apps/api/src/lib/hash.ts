import crypto from 'crypto';

/**
 * Generate a cryptographically secure random token in hex format.
 * Default is 32 bytes (64 hex characters).
 */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function generateRefreshToken(): string {
  return generateToken(32);
}

/**
 * SHA-256 hash a string token into hex format.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function sha256(token: string): string {
  return hashToken(token);
}
