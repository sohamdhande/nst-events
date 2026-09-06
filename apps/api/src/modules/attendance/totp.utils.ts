import crypto from 'crypto';

export const TOTP_WINDOW_SECONDS = 30;
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
function generateSignature(sessionId: string, windowEpoch: number, qrSecret: string): string {
  const hmacInput = `${VERSION}:${sessionId}:${windowEpoch}`;
  const hmac = crypto.createHmac('sha256', qrSecret);
  hmac.update(hmacInput);
  
  // Base64URL encoding (replace + with -, / with _, remove trailing =)
  const base64 = hmac.digest('base64');
  const base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  return base64Url.substring(0, HMAC_TRUNCATION_LENGTH);
}

/**
 * Generates the full QR payload for a given session.
 */
export function generateQrPayload(sessionId: string, qrSecret: string): string {
  const windowEpoch = getCurrentWindowEpoch();
  const signature = generateSignature(sessionId, windowEpoch, qrSecret);
  return `${VERSION}:${sessionId}:${signature}`;
}

/**
 * Verifies a QR payload, allowing for ±1 window drift.
 */
export function verifyQrPayload(sessionId: string, payload: string, qrSecret: string, timestampMs?: number): boolean {
  if (!payload || !payload.startsWith(`${VERSION}:${sessionId}:`)) {
    return false;
  }

  const parts = payload.split(':');
  if (parts.length !== 3) {
    return false;
  }
  
  const extractedSignature = parts[2];
  const currentEpoch = getCurrentWindowEpoch(timestampMs ?? Date.now());

  // ± 1 window drift tolerance
  const allowedEpochs = [currentEpoch, currentEpoch - 1, currentEpoch + 1];

  for (const epoch of allowedEpochs) {
    const expectedSignature = generateSignature(sessionId, epoch, qrSecret);
    if (
      extractedSignature.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(extractedSignature), Buffer.from(expectedSignature))
    ) {
      return true;
    }
  }

  return false;
}
