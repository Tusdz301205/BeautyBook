DO $$ BEGIN CREATE TYPE "TrustActionType" AS ENUM ('WARNING_SENT', 'EXPLANATION_REQUESTED', 'MONITORING_STARTED', 'BOOKING_RESTRICTED', 'SUSPENDED', 'RESTORED', 'NOTE_ADDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AttendanceMethod" AS ENUM ('QR', 'MANUAL_EXCEPTION', 'MANUAL_ADJUSTMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AttendanceStatus" AS ENUM ('NOT_CHECKED_IN', 'CHECKED_IN', 'CHECKED_OUT', 'LATE', 'LEFT_EARLY', 'ABSENT', 'MISSING_CHECKOUT', 'MANUALLY_ADJUSTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AttendanceExceptionType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'ADJUST_TIME'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AttendanceExceptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REVIEW_REMINDER';

ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "booking_restricted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "booking_restriction_reason" TEXT;

ALTER TABLE "branches"
  ADD COLUMN IF NOT EXISTS "review_note" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);

ALTER TABLE "reviews"
  ADD COLUMN IF NOT EXISTS "is_anonymous" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "trust_actions" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "actor_id" TEXT NOT NULL,
  "action" "TrustActionType" NOT NULL,
  "reason" TEXT NOT NULL,
  "internal_note" TEXT,
  "status_before" TEXT,
  "status_after" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trust_actions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trust_actions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "trust_actions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "trust_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "trust_actions_business_id_created_at_idx" ON "trust_actions"("business_id", "created_at");
CREATE INDEX "trust_actions_branch_id_created_at_idx" ON "trust_actions"("branch_id", "created_at");

CREATE TABLE "business_review_events" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "actor_id" TEXT,
  "action" TEXT NOT NULL,
  "from_status" "BusinessStatus",
  "to_status" "BusinessStatus" NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_review_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_review_events_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "business_review_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "business_review_events_business_id_created_at_idx" ON "business_review_events"("business_id", "created_at");

CREATE TABLE "review_reports" (
  "id" TEXT NOT NULL,
  "review_id" TEXT NOT NULL,
  "reporter_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "review_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "review_reports_review_id_reporter_id_key" ON "review_reports"("review_id", "reporter_id");
CREATE INDEX "review_reports_review_id_created_at_idx" ON "review_reports"("review_id", "created_at");

CREATE TABLE "staff_attendances" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "user_id" TEXT,
  "work_date" DATE NOT NULL,
  "scheduled_start_time" TIME(6) NOT NULL,
  "scheduled_end_time" TIME(6) NOT NULL,
  "check_in_at" TIMESTAMP(3),
  "check_out_at" TIMESTAMP(3),
  "check_in_method" "AttendanceMethod",
  "check_out_method" "AttendanceMethod",
  "status" "AttendanceStatus" NOT NULL DEFAULT 'NOT_CHECKED_IN',
  "late_minutes" INTEGER NOT NULL DEFAULT 0,
  "early_leave_minutes" INTEGER NOT NULL DEFAULT 0,
  "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "adjusted_by" TEXT,
  "adjusted_at" TIMESTAMP(3),
  "adjustment_reason" TEXT,
  "absent_marked_by" TEXT,
  "absent_marked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_attendances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_attendances_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "staff_attendances_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "staff_attendances_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "staff_attendances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "staff_attendances_adjusted_by_fkey" FOREIGN KEY ("adjusted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "staff_attendances_absent_marked_by_fkey" FOREIGN KEY ("absent_marked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "staff_attendances_staff_id_branch_id_work_date_key" ON "staff_attendances"("staff_id", "branch_id", "work_date");
CREATE INDEX "staff_attendances_business_id_work_date_idx" ON "staff_attendances"("business_id", "work_date");
CREATE INDEX "staff_attendances_branch_id_work_date_status_idx" ON "staff_attendances"("branch_id", "work_date", "status");

CREATE TABLE "attendance_exception_requests" (
  "id" TEXT NOT NULL,
  "attendance_id" TEXT,
  "business_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "type" "AttendanceExceptionType" NOT NULL,
  "work_date" DATE NOT NULL,
  "proposed_at" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "note" TEXT,
  "status" "AttendanceExceptionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_exception_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_exception_requests_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "staff_attendances"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "attendance_exception_requests_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_exception_requests_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_exception_requests_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_exception_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "attendance_exception_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "attendance_exception_requests_branch_id_status_created_at_idx" ON "attendance_exception_requests"("branch_id", "status", "created_at");
CREATE INDEX "attendance_exception_requests_staff_id_created_at_idx" ON "attendance_exception_requests"("staff_id", "created_at");
