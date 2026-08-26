-- CreateEnum
CREATE TYPE "DirectoryStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "security_version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "authorized_students" (
    "id" UUID NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "status" "DirectoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "authorized_students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "authorized_students_normalized_email_key" ON "authorized_students"("normalized_email");

