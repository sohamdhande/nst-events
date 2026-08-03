-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('STUDENT', 'FACULTY_ADMIN', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "ClubRole" AS ENUM ('MEMBER', 'CORE_MEMBER', 'CLUB_ADMIN', 'FACULTY_MENTOR');

-- CreateEnum
CREATE TYPE "ClubStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISSOLVED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('WORKSHOP', 'SEMINAR', 'COMPETITION', 'MEETUP', 'HACKATHON', 'OTHER');

-- CreateEnum
CREATE TYPE "EventState" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM ('INDIVIDUAL', 'TEAM');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'WAITLISTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('QR', 'MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AttendanceType" AS ENUM ('SINGLE', 'MULTI_SESSION');

-- CreateEnum
CREATE TYPE "ParticipationRole" AS ENUM ('ATTENDEE', 'VOLUNTEER', 'ORGANIZER', 'SPEAKER', 'MENTOR');

-- CreateEnum
CREATE TYPE "CompetitionResult" AS ENUM ('WINNER', 'RUNNER_UP', 'SECOND_RUNNER_UP', 'TOP_10', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "google_sub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "global_role" "GlobalRole" NOT NULL DEFAULT 'STUDENT',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clubs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "banner_url" TEXT,
    "status" "ClubStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "role" "ClubRole" NOT NULL,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "club_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_time" TIMESTAMPTZ NOT NULL,
    "end_time" TIMESTAMPTZ NOT NULL,
    "location_name" TEXT,
    -- TODO Phase 2 (PostGIS): After CREATE EXTENSION postgis, run:
    --   ALTER TABLE events ALTER COLUMN location_geofence TYPE geography(Point,4326)
    --   USING ST_GeomFromText(location_geofence, 4326);
    --   CREATE INDEX ON events USING gist(location_geofence);
    -- For now, stored as TEXT (NULL-safe placeholder for V1 without PostGIS).
    "location_geofence" TEXT,
    "event_type" "EventType" NOT NULL,
    "state" "EventState" NOT NULL DEFAULT 'DRAFT',
    "visibility" "EventVisibility" NOT NULL DEFAULT 'PUBLIC',
    "registration_type" "RegistrationType" NOT NULL DEFAULT 'INDIVIDUAL',
    "attendance_type" "AttendanceType" NOT NULL DEFAULT 'SINGLE',
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "max_capacity" INTEGER,
    "registration_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_clubs" (
    "event_id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "event_clubs_pkey" PRIMARY KEY ("event_id","club_id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "leader_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "team_id" UUID,
    "registration_status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "participation_role" "ParticipationRole" NOT NULL DEFAULT 'ATTENDEE',
    "registered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "start_time" TIMESTAMPTZ NOT NULL,
    "end_time" TIMESTAMPTZ NOT NULL,
    "open_at" TIMESTAMPTZ NOT NULL,
    "close_at" TIMESTAMPTZ NOT NULL,
    "geofence_radius" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "marked_by" UUID,
    "marked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "AttendanceMethod" NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "audit_metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_disputes" (
    "id" UUID NOT NULL,
    "attendance_record_id" UUID,
    "session_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence_urls" TEXT[],
    "status" "DisputeStatus" NOT NULL DEFAULT 'PENDING',
    "dispute_window_expires_at" TIMESTAMPTZ NOT NULL,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ,
    "reviewed_by" UUID,
    "review_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_results" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "result_type" "CompetitionResult" NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "delivered_at" TIMESTAMPTZ,
    "delivery_failed_at" TIMESTAMPTZ,
    "delivery_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "event_reminders" BOOLEAN NOT NULL DEFAULT true,
    "club_announcements" BOOLEAN NOT NULL DEFAULT true,
    "attendance_alerts" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "expo_token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "club_id" UUID,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_handover_requests" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "initiated_by" UUID NOT NULL,
    "successor_id" UUID NOT NULL,
    "faculty_mentor_id" UUID,
    "status" "HandoverStatus" NOT NULL DEFAULT 'PENDING',
    "initiated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ,
    "review_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leadership_handover_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_scores" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "club_id" UUID,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "previous_state" JSONB,
    "new_state" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_google_sub_idx" ON "users"("google_sub");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "clubs_name_key" ON "clubs"("name");

-- CreateIndex
CREATE INDEX "clubs_name_idx" ON "clubs"("name");

-- CreateIndex
CREATE INDEX "club_memberships_club_id_user_id_idx" ON "club_memberships"("club_id", "user_id");

-- CreateIndex
CREATE INDEX "club_memberships_user_id_idx" ON "club_memberships"("user_id");

-- CreateIndex
CREATE INDEX "events_start_time_idx" ON "events"("start_time");

-- CreateIndex
CREATE INDEX "events_state_idx" ON "events"("state");

-- CreateIndex
CREATE UNIQUE INDEX "teams_id_event_id_key" ON "teams"("id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_event_id_name_key" ON "teams"("event_id", "name");

-- CreateIndex
CREATE INDEX "event_registrations_event_id_user_id_idx" ON "event_registrations"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "event_registrations_user_id_idx" ON "event_registrations"("user_id");

-- CreateIndex
CREATE INDEX "event_registrations_team_id_event_id_idx" ON "event_registrations"("team_id", "event_id");

-- CreateIndex
CREATE INDEX "attendance_sessions_event_id_idx" ON "attendance_sessions"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_session_id_user_id_key" ON "attendance_records"("session_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_disputes_session_id_user_id_key" ON "attendance_disputes"("session_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_results_event_id_user_id_key" ON "event_results"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_device_id_key" ON "push_tokens"("device_id");

-- CreateIndex
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

-- CreateIndex
CREATE INDEX "leadership_handover_requests_club_id_idx" ON "leadership_handover_requests"("club_id");

-- CreateIndex
CREATE INDEX "leaderboard_scores_user_id_idx" ON "leaderboard_scores"("user_id");

-- CreateIndex
CREATE INDEX "leaderboard_scores_club_id_idx" ON "leaderboard_scores"("club_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs"("entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_clubs" ADD CONSTRAINT "event_clubs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_clubs" ADD CONSTRAINT "event_clubs_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_disputes" ADD CONSTRAINT "attendance_disputes_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_disputes" ADD CONSTRAINT "attendance_disputes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_disputes" ADD CONSTRAINT "attendance_disputes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_disputes" ADD CONSTRAINT "attendance_disputes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_disputes" ADD CONSTRAINT "attendance_disputes_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_results" ADD CONSTRAINT "event_results_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_results" ADD CONSTRAINT "event_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_results" ADD CONSTRAINT "event_results_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_handover_requests" ADD CONSTRAINT "leadership_handover_requests_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_handover_requests" ADD CONSTRAINT "leadership_handover_requests_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_handover_requests" ADD CONSTRAINT "leadership_handover_requests_successor_id_fkey" FOREIGN KEY ("successor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_handover_requests" ADD CONSTRAINT "leadership_handover_requests_faculty_mentor_id_fkey" FOREIGN KEY ("faculty_mentor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_scores" ADD CONSTRAINT "leaderboard_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_scores" ADD CONSTRAINT "leaderboard_scores_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

