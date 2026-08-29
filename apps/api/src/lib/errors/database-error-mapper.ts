import { UnprocessableEntityError, BadRequestError, ForbiddenError, NotFoundError, ConflictError } from '../errors';
import { logger } from '../logger';

/**
 * SQLSTATE → Application Error Mapping
 * 
 * These are the sole machine-readable error codes for business errors.
 * All classification uses err.code (SQLSTATE) or Prisma P-codes.
 */
export const SQLSTATE_MAP: Record<string, {
  semanticCode: string;
  httpStatus: number;
  userMessage: string;
  ErrorClass: new (message: string) => Error;
}> = {
  // Existing Namespace
  U0001: { semanticCode: 'UNAUTHORIZED',               httpStatus: 422, userMessage: 'You are not authorized to perform this action',  ErrorClass: UnprocessableEntityError },
  U0002: { semanticCode: 'WAITLISTED',                 httpStatus: 422, userMessage: 'Your registration is waitlisted',                ErrorClass: UnprocessableEntityError },
  U0003: { semanticCode: 'NOT_REGISTERED',             httpStatus: 422, userMessage: 'You are not registered for this event',          ErrorClass: UnprocessableEntityError },
  U0004: { semanticCode: 'REGISTRATION_NOT_ELIGIBLE',  httpStatus: 422, userMessage: 'Your registration is not eligible',              ErrorClass: UnprocessableEntityError },
  U0005: { semanticCode: 'SESSION_CLOSED',             httpStatus: 422, userMessage: 'This attendance session is closed',              ErrorClass: UnprocessableEntityError },
  U0006: { semanticCode: 'EVENT_LOCKED',               httpStatus: 422, userMessage: 'This event is locked',                           ErrorClass: UnprocessableEntityError },
  U0007: { semanticCode: 'OUTSIDE_GEOFENCE',           httpStatus: 422, userMessage: 'You are outside the allowed location',           ErrorClass: UnprocessableEntityError },
  U0008: { semanticCode: 'MOCK_LOCATION_REJECTED',     httpStatus: 422, userMessage: 'Mock location detected',                         ErrorClass: UnprocessableEntityError },
  U0009: { semanticCode: 'LOCATION_UNAVAILABLE',       httpStatus: 422, userMessage: 'Location data is unavailable',                   ErrorClass: UnprocessableEntityError },
  U0010: { semanticCode: 'INVALID_LOCATION',           httpStatus: 422, userMessage: 'Location data is invalid',                       ErrorClass: UnprocessableEntityError },
  U0011: { semanticCode: 'LOCATION_UNRELIABLE',        httpStatus: 422, userMessage: 'Location accuracy is insufficient',              ErrorClass: UnprocessableEntityError },
  U0012: { semanticCode: 'ACADEMIC_PROFILE_MISSING',   httpStatus: 422, userMessage: 'Academic profile is required',                   ErrorClass: UnprocessableEntityError },
  U0013: { semanticCode: 'ACADEMICALLY_INELIGIBLE',    httpStatus: 422, userMessage: 'You are not academically eligible',              ErrorClass: UnprocessableEntityError },
  U0014: { semanticCode: 'SIGNATURE_ALREADY_CONSUMED', httpStatus: 422, userMessage: 'This QR code has already been used',             ErrorClass: UnprocessableEntityError },
  U0020: { semanticCode: 'Already in a team for this event.', httpStatus: 400, userMessage: 'You are already in a team for this event',       ErrorClass: BadRequestError },
  U0021: { semanticCode: 'Team is full',               httpStatus: 400, userMessage: 'This team is already full',                      ErrorClass: BadRequestError },
  U0022: { semanticCode: 'Event capacity is full.',    httpStatus: 400, userMessage: 'Event capacity is full',                         ErrorClass: BadRequestError },
  U0023: { semanticCode: 'Team is cancelled',          httpStatus: 400, userMessage: 'This team is cancelled',                         ErrorClass: BadRequestError },
  U0024: { semanticCode: 'Invitation expired',         httpStatus: 400, userMessage: 'This invitation has expired',                    ErrorClass: BadRequestError },
  U0025: { semanticCode: 'Invitation invalid',         httpStatus: 400, userMessage: 'This invitation is invalid',                     ErrorClass: BadRequestError },
  U0026: { semanticCode: 'Invitation not for user',    httpStatus: 400, userMessage: 'This invitation is not for you',                 ErrorClass: BadRequestError },
  U0027: { semanticCode: 'Individual registration is not permitted for team events', httpStatus: 400, userMessage: 'Individual registration is not permitted for team events', ErrorClass: BadRequestError },
  U0030: { semanticCode: 'Event is locked',            httpStatus: 400, userMessage: 'This event is locked',                           ErrorClass: BadRequestError },
  U0031: { semanticCode: 'AUDIENCE_NOT_ELIGIBLE',      httpStatus: 403, userMessage: 'You are not academically eligible',              ErrorClass: ForbiddenError },
  
  // Extended ERROR-02 Namespace
  U0032: { semanticCode: 'EVENT_NOT_FOUND',            httpStatus: 404, userMessage: 'Event not found',                                ErrorClass: NotFoundError },
  U0033: { semanticCode: 'EVENT_NOT_PUBLISHED',        httpStatus: 422, userMessage: 'Event is not published',                         ErrorClass: UnprocessableEntityError },
  U0034: { semanticCode: 'TEAM_NOT_FOUND',             httpStatus: 404, userMessage: 'Team not found',                                 ErrorClass: NotFoundError },
  U0035: { semanticCode: 'TEAM_NOT_SUPPORTED',         httpStatus: 422, userMessage: 'Event does not support teams',                   ErrorClass: UnprocessableEntityError },
  U0037: { semanticCode: 'INVITATION_NOT_FOUND',       httpStatus: 404, userMessage: 'Invitation not found',                           ErrorClass: NotFoundError },
  U0038: { semanticCode: 'REGISTRATION_NOT_FOUND',     httpStatus: 404, userMessage: 'Registration not found',                         ErrorClass: NotFoundError },
  U0039: { semanticCode: 'MEMBER_NOT_IN_TEAM',         httpStatus: 404, userMessage: 'Member not found in team',                       ErrorClass: NotFoundError },
  U0040: { semanticCode: 'LEADER_CANNOT_LEAVE',        httpStatus: 400, userMessage: 'Leader cannot leave without transferring leadership', ErrorClass: BadRequestError },
  U0041: { semanticCode: 'NEW_LEADER_NOT_ACTIVE',      httpStatus: 400, userMessage: 'New leader must be an active team member',       ErrorClass: BadRequestError },
  U0043: { semanticCode: 'EVENT_MUST_BE_DRAFT',        httpStatus: 422, userMessage: 'Event must be in DRAFT state',                   ErrorClass: UnprocessableEntityError },
  U0044: { semanticCode: 'EVENT_MUST_BE_PENDING',      httpStatus: 422, userMessage: 'Event must be in PENDING_APPROVAL state',        ErrorClass: UnprocessableEntityError },
  U0045: { semanticCode: 'RACE_CONDITION_STATE',       httpStatus: 409, userMessage: 'Event state changed during transaction',         ErrorClass: ConflictError },
  U0046: { semanticCode: 'RACE_CONDITION_LOCKED',      httpStatus: 409, userMessage: 'Event is already locked',                        ErrorClass: ConflictError },
  U0047: { semanticCode: 'RACE_CONDITION_UNLOCKED',    httpStatus: 409, userMessage: 'Event is already unlocked',                      ErrorClass: ConflictError },
  U0048: { semanticCode: 'DISPUTE_WINDOW_EXPIRED',     httpStatus: 422, userMessage: 'The dispute window has expired',                 ErrorClass: UnprocessableEntityError },
  U0049: { semanticCode: 'SESSION_CLOSED',             httpStatus: 422, userMessage: 'This attendance session is closed',              ErrorClass: UnprocessableEntityError },
  U0050: { semanticCode: 'TEAM_NOT_WAITLISTED',        httpStatus: 400, userMessage: 'Team is not waitlisted',                         ErrorClass: BadRequestError },
  U0051: { semanticCode: 'DISPUTE_NOT_FOUND',          httpStatus: 404, userMessage: 'Dispute not found',                              ErrorClass: NotFoundError },
  U0052: { semanticCode: 'DISPUTE_ALREADY_RESOLVED',   httpStatus: 400, userMessage: 'Dispute is already resolved',                    ErrorClass: BadRequestError },
  U0053: { semanticCode: 'INVALID_RESOLUTION',         httpStatus: 400, userMessage: 'Invalid resolution status',                      ErrorClass: BadRequestError },
  U0054: { semanticCode: 'ATTENDANCE_ALREADY_RECORDED',httpStatus: 409, userMessage: 'Attendance is already recorded',                 ErrorClass: ConflictError },
};

/**
 * Extract the PostgreSQL SQLSTATE from a Prisma error.
 * 
 * For $queryRaw/$executeRaw, Prisma throws PrismaClientKnownRequestError
 * with code 'P2010' and the PostgreSQL SQLSTATE in meta.code.
 */
function extractSqlstate(err: unknown): string | undefined {
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    err.code === 'P2010' &&
    'meta' in err &&
    err.meta &&
    typeof err.meta === 'object' &&
    'code' in err.meta &&
    typeof err.meta.code === 'string'
  ) {
    return err.meta.code;
  }
  return undefined;
}

/**
 * Maps a direct database error to the appropriate application error.
 * Handles both RPC SQLSTATE codes and known Prisma P-codes.
 */
export function mapDatabaseError(err: unknown): never {
  // If it's already a handled AppError (e.g. from TypeScript checks), rethrow it
  if (err instanceof Error && (err as any).statusCode) {
    throw err;
  }

  // Handle specific Prisma structured codes
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    if (err.code === 'P2002') {
      throw new ConflictError('A resource with this identifier already exists');
    }
    if (err.code === 'P2025') {
      throw new NotFoundError('Resource not found');
    }
  }

  let sqlstate = extractSqlstate(err);
  
  if (!sqlstate || sqlstate === 'P0001' || sqlstate === 'XX000') {
    const regexFallback = (function(e: unknown) {
      if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string') {
        const msg = (e as any).message;
        const match1 = msg.match(/SQLSTATE\[([A-Z0-9]{5})\]/);
        if (match1) return match1[1];
        const match2 = msg.match(/Code:\s*`([A-Z0-9]{5})`/);
        if (match2) return match2[1];
        const match3 = msg.match(/(U\d{4})/);
        if (match3) return match3[1];
      }
      return undefined;
    })(err);
    
    if (regexFallback) {
      sqlstate = regexFallback;
    }
  }

  if (sqlstate) {
    if (sqlstate === '42501') {
      throw new ForbiddenError('Access denied by Row-Level Security');
    }
    if (sqlstate === '23505') {
      throw new ConflictError('A resource with this identifier already exists');
    }
    if (sqlstate in SQLSTATE_MAP) {
      const mapping = SQLSTATE_MAP[sqlstate];
      throw new mapping.ErrorClass(mapping.semanticCode);
    }
  }

  // Unknown SQLSTATE or non-Prisma error: log internally, throw generic 500
  logger.error(
    { 
      sqlstate, 
      errCode: (err as any)?.code, 
      errName: (err as any)?.name 
    },
    'Unknown database business error'
  );
  throw new Error('An unexpected error occurred');
}
