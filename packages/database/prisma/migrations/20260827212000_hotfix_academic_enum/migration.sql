-- Hotfix: Realign AssignmentSource enum values with Prisma schema
ALTER TYPE "AssignmentSource" ADD VALUE IF NOT EXISTS 'INSTITUTIONAL_EMAIL_INFERENCE';
ALTER TYPE "AssignmentSource" ADD VALUE IF NOT EXISTS 'SSO_PROVIDER_INFERENCE';
ALTER TYPE "AssignmentSource" ADD VALUE IF NOT EXISTS 'ADMIN_OVERRIDE';
ALTER TYPE "AssignmentSource" ADD VALUE IF NOT EXISTS 'MANUAL_SELECTION';

-- Note: We can't easily drop enum values in Postgres, so we just add the new ones to match the schema.
-- Since the schema doesn't have EMAIL_INFERENCE or ADMIN anymore, Prisma will use the new ones.

-- Update existing records if any
UPDATE "user_academic_profiles" SET "assignment_source" = 'INSTITUTIONAL_EMAIL_INFERENCE' WHERE "assignment_source"::text = 'EMAIL_INFERENCE';
UPDATE "user_academic_profiles" SET "assignment_source" = 'ADMIN_OVERRIDE' WHERE "assignment_source"::text = 'ADMIN';
