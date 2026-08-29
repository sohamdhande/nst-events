import { UnprocessableEntityError, BadRequestError, ForbiddenError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { SQLSTATE_MAP } from '../../lib/errors/database-error-mapper';



/**
 * Maps an offline per-record error_code (SQLSTATE returned from
 * sync_offline_attendance) to a safe semantic result.
 * 
 * Returns { user_id, error_code } with a sanitized error_code.
 * Never exposes raw SQLSTATE for unknown errors.
 */
export function sanitizeOfflineError(
  record: { user_id: string; error_code: string }
): { user_id: string; error_code: string } {
  const mapping = SQLSTATE_MAP[record.error_code];

  if (mapping) {
    return {
      user_id: record.user_id,
      error_code: mapping.semanticCode,
    };
  }

  // Unknown SQLSTATE: log it, return generic safe error
  logger.error(
    { user_id: record.user_id, raw_error_code: record.error_code },
    'Unknown offline attendance error SQLSTATE'
  );
  return {
    user_id: record.user_id,
    error_code: 'ATTENDANCE_ERROR',
  };
}
