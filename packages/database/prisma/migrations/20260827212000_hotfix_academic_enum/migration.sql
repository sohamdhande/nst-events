-- Hotfix: Realign AssignmentSource enum values with Prisma schema
ALTER TYPE "AssignmentSource" ADD VALUE IF NOT EXISTS 'INSTITUTIONAL_EMAIL_INFERENCE';
ALTER TYPE "AssignmentSource" ADD VALUE IF NOT EXISTS 'SSO_PROVIDER_INFERENCE';
ALTER TYPE "AssignmentSource" ADD VALUE IF NOT EXISTS 'ADMIN_OVERRIDE';
ALTER TYPE "AssignmentSource" ADD VALUE IF NOT EXISTS 'MANUAL_SELECTION';

-- Note: We can't easily drop enum values in Postgres, so we just add the new ones to match the schema.
-- Since the schema doesn't have EMAIL_INFERENCE or ADMIN anymore, Prisma will use the new ones.

-- Note: We can't easily drop enum values in Postgres, so we just add the new ones to match the schema.
-- Since the schema doesn't have EMAIL_INFERENCE or ADMIN anymore, Prisma will use the new ones.

