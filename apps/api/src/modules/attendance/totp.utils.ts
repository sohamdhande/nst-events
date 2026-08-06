import crypto from 'crypto';
import { env } from '../../config/env';

const TOTP_WINDOW_SECONDS = 15;
const HMAC_TRUNCATION_LENGTH = 16;
const VERSION = 'v1';

/**
 * Calculates the current TOTP window epoch.
 */
function getCurrentWindowEpoch(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / (TOTP_WINDOW_SECONDS * 1000));
}

/**
 * Generates the truncated Base64URL HMAC-SHA256 signature.
 */
function generateSignature(sessionId: string, windowEpoch: number): string {
  const hmacInput = `${VERSION}:${sessionId}:${windowEpoch}`;
  const hmac = crypto.createHmac('sha256', env.ATTENDANCE_QR_SECRET);
  hmac.update(hmacInput);
  
  // Base64URL encoding (replace + with -, / with _, remove trailing =)
  const base64 = hmac.digest('base64');
  const base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  return base64Url.substring(0, HMAC_TRUNCATION_LENGTH);
}

/**
 * Generates the full QR payload for a given session.
 */
export function generateQrPayload(sessionId: string): string {
  const windowEpoch = getCurrentWindowEpoch();
  const signature = generateSignature(sessionId, windowEpoch);
  return `${VERSION}:${sessionId}:${signature}`;
}

/**
 * Verifies a QR payload, allowing for ±1 window drift.
 */
export function verifyQrPayload(sessionId: string, payload: string): boolean {
  if (!payload || !payload.startsWith(`${VERSION}:${sessionId}:`)) {
    return false;
  }

  const parts = payload.split(':');
  if (parts.length !== 3) {
    return false;
  }
  
  const extractedSignature = parts[2];
  const currentEpoch = getCurrentWindowEpoch();

  // ± 1 window drift tolerance
  const allowedEpochs = [currentEpoch, currentEpoch - 1, currentEpoch + 1];

  for (const epoch of allowedEpochs) {
    const expectedSignature = generateSignature(sessionId, epoch);
    if (
      extractedSignature.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(extractedSignature), Buffer.from(expectedSignature))
    ) {
      return true;
    }
  }

  return false;
}
