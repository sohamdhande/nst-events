/**
 * Centralized Gamification Scoring Policy
 * 
 * Defines the deterministic points awarded for various actions within the platform.
 * Maintained by the Express application layer to avoid embedding business rules in the database schema.
 */
export const SCORE_RULES = {
  /** Points awarded per valid attendance scan */
  ATTENDANCE: 5,
} as const;
