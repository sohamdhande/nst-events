/*
  Warnings:

  - Added the required column `qr_secret` to the `attendance_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "attendance_sessions" ADD COLUMN     "qr_secret" TEXT NOT NULL;
