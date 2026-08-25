-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('EMAIL_INFERENCE', 'ADMIN');

-- CreateTable
CREATE TABLE "academic_programs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "academic_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_batches" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "admission_year" INTEGER NOT NULL,
    "graduation_year" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "academic_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_academic_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "assignment_source" "AssignmentSource" NOT NULL,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "user_academic_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "academic_programs_code_key" ON "academic_programs"("code");

-- CreateIndex
CREATE INDEX "academic_batches_program_id_idx" ON "academic_batches"("program_id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_batches_program_id_admission_year_graduation_year_key" ON "academic_batches"("program_id", "admission_year", "graduation_year");

-- CreateIndex
CREATE UNIQUE INDEX "user_academic_profiles_user_id_key" ON "user_academic_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_academic_profiles_batch_id_idx" ON "user_academic_profiles"("batch_id");

-- AddForeignKey
ALTER TABLE "academic_batches" ADD CONSTRAINT "academic_batches_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "academic_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_academic_profiles" ADD CONSTRAINT "user_academic_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_academic_profiles" ADD CONSTRAINT "user_academic_profiles_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "academic_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_academic_profiles" ADD CONSTRAINT "user_academic_profiles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
