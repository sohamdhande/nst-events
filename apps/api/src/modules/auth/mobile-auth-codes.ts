import crypto from 'crypto';
import { AuthTokenResponse } from './auth.service';

interface PendingCode {
  result: AuthTokenResponse;
  expiresAt: number;
}

const store = new Map<string, PendingCode>();

const CODE_TTL_MS = 60_000; // 60 seconds
const CLEANUP_INTERVAL_MS = 30_000; // sweep every 30s

// Periodic cleanup of expired codes
// .unref() prevents this timer from keeping the process alive during graceful shutdown
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}, CLEANUP_INTERVAL_MS).unref();

/**
 * Create a cryptographically random single-use authorization code
 * and store the full AuthTokenResponse against it for 60 seconds.
 */
export function createMobileAuthCode(result: AuthTokenResponse): string {
  const code = crypto.randomBytes(32).toString('hex');
  store.set(code, { result, expiresAt: Date.now() + CODE_TTL_MS });
  return code;
}

/**
 * Redeem a single-use mobile authorization code.
 * Returns the associated AuthTokenResponse if the code is valid and not expired.
 * The code is deleted immediately on lookup (single-use), regardless of expiry.
 * Returns null if the code is invalid, expired, or already used.
 */
export function redeemMobileAuthCode(code: string): AuthTokenResponse | null {
  const entry = store.get(code);
  if (!entry) return null;

  // Single-use: delete immediately before any further checks
  store.delete(code);

  // Check expiry after deletion
  if (entry.expiresAt <= Date.now()) return null;

  return entry.result;
}
