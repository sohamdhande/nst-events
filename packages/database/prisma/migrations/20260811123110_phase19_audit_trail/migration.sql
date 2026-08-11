/*
  Warnings:

  - Added the required column `created_by` to the `attendance_sessions` table without a default value. This is not possible if the table is not empty.

*/


-- AlterTable
ALTER TABLE "attendance_sessions" ADD COLUMN     "created_by" UUID NOT NULL;

-- AlterTable

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
