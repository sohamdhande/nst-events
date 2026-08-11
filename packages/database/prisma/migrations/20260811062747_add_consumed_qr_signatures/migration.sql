-- CreateTable
CREATE TABLE "consumed_qr_signatures" (
    "session_id" UUID NOT NULL,
    "signature" TEXT NOT NULL,
    "consumed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumed_qr_signatures_pkey" PRIMARY KEY ("session_id","signature")
);

-- AddForeignKey
ALTER TABLE "consumed_qr_signatures" ADD CONSTRAINT "consumed_qr_signatures_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
