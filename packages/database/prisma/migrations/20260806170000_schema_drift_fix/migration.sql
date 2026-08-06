-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'CULTURAL';
ALTER TYPE "EventType" ADD VALUE 'SPORTS';

-- Ignored Prisma destructive drop of manually created BRIN index:
-- DROP INDEX "leaderboard_scores_created_at_brin_idx";
