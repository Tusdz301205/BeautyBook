-- Branch review and operations are deliberately separated. The legacy
-- "BranchStatus" column remains as a compatibility projection for older APIs.
CREATE TYPE "BranchReviewStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'PENDING_REVIEW',
  'NEED_MORE_INFO',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "BranchOperationalStatus" AS ENUM (
  'INACTIVE',
  'READY_TO_PUBLISH',
  'ACTIVE',
  'PAUSED',
  'SUSPENDED',
  'CLOSED',
  'ARCHIVED'
);

CREATE TYPE "BranchServiceMode" AS ENUM ('AT_LOCATION', 'MOBILE', 'BOTH');
CREATE TYPE "BranchDocumentType" AS ENUM (
  'OPERATING_LICENSE',
  'LOCATION_DOCUMENT',
  'SERVICE_LICENSE',
  'FIRE_SAFETY',
  'OTHER'
);
CREATE TYPE "BranchDocumentStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'NEED_MORE_INFO',
  'APPROVED',
  'REJECTED',
  'ARCHIVED'
);
CREATE TYPE "StaffAssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ENDED');
CREATE TYPE "StaffScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "StaffScheduleChangeType" AS ENUM (
  'RECURRING_SCHEDULE',
  'SINGLE_DAY',
  'LEAVE'
);
CREATE TYPE "StaffScheduleRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

ALTER TABLE "branches"
  ALTER COLUMN "address_line" DROP NOT NULL,
  ALTER COLUMN "district_id" DROP NOT NULL,
  ADD COLUMN "public_name" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "ward" TEXT,
  ADD COLUMN "floor" TEXT,
  ADD COLUMN "directions" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "service_mode" "BranchServiceMode" NOT NULL DEFAULT 'AT_LOCATION',
  ADD COLUMN "same_legal_entity" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "manager_name" TEXT,
  ADD COLUMN "scheduled_opening_date" DATE,
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN "booking_start_date" DATE,
  ADD COLUMN "service_areas" JSONB,
  ADD COLUMN "service_radius_km" INTEGER,
  ADD COLUMN "travel_fee" DECIMAL(12,2),
  ADD COLUMN "excluded_service_areas" JSONB,
  ADD COLUMN "review_status" "BranchReviewStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "operational_status" "BranchOperationalStatus" NOT NULL DEFAULT 'INACTIVE',
  ADD COLUMN "submitted_at" TIMESTAMP(3),
  ADD COLUMN "published_at" TIMESTAMP(3);

UPDATE "branches"
SET
  "review_status" = CASE
    WHEN "status" = 'ACTIVE' THEN 'APPROVED'::"BranchReviewStatus"
    WHEN "status" = 'INACTIVE' THEN 'APPROVED'::"BranchReviewStatus"
    ELSE 'PENDING_REVIEW'::"BranchReviewStatus"
  END,
  "operational_status" = CASE
    WHEN "status" = 'ACTIVE' THEN 'ACTIVE'::"BranchOperationalStatus"
    ELSE 'INACTIVE'::"BranchOperationalStatus"
  END,
  "submitted_at" = CASE WHEN "status" = 'PENDING' THEN "created_at" ELSE NULL END,
  "published_at" = CASE WHEN "status" = 'ACTIVE' THEN COALESCE("reviewed_at", "updated_at") ELSE NULL END;

CREATE INDEX "branches_review_status_idx" ON "branches"("review_status");
CREATE INDEX "branches_operational_status_idx" ON "branches"("operational_status");

CREATE TABLE "branch_onboarding_progress" (
  "id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "current_step" INTEGER NOT NULL DEFAULT 1,
  "completed_steps" JSONB NOT NULL DEFAULT '[]',
  "draft_data" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "branch_onboarding_progress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "branch_onboarding_progress_branch_id_key"
  ON "branch_onboarding_progress"("branch_id");
ALTER TABLE "branch_onboarding_progress"
  ADD CONSTRAINT "branch_onboarding_progress_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "branch_onboarding_progress" (
  "id", "branch_id", "current_step", "completed_steps", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  "id",
  CASE WHEN "status" = 'ACTIVE' THEN 14 ELSE 1 END,
  CASE
    WHEN "status" = 'ACTIVE' THEN '[1,2,3,4,5,6,7,8,9,10,11,13,14]'::jsonb
    ELSE '[]'::jsonb
  END,
  "created_at",
  "updated_at"
FROM "branches";

CREATE TABLE "branch_booking_policies" (
  "id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "lead_time_minutes" INTEGER NOT NULL DEFAULT 0,
  "booking_horizon_days" INTEGER NOT NULL DEFAULT 90,
  "cancellation_hours" INTEGER NOT NULL DEFAULT 24,
  "reschedule_hours" INTEGER NOT NULL DEFAULT 12,
  "no_show_handling" TEXT,
  "early_check_in_minutes" INTEGER NOT NULL DEFAULT 0,
  "grace_period_minutes" INTEGER NOT NULL DEFAULT 10,
  "allow_walk_in" BOOLEAN NOT NULL DEFAULT true,
  "allow_counter_booking" BOOLEAN NOT NULL DEFAULT true,
  "default_buffer_minutes" INTEGER NOT NULL DEFAULT 0,
  "deposit_policy" JSONB,
  "confirmed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "branch_booking_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "branch_booking_policies_branch_id_key"
  ON "branch_booking_policies"("branch_id");
ALTER TABLE "branch_booking_policies"
  ADD CONSTRAINT "branch_booking_policies_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "branch_booking_policies" (
  "id", "branch_id", "confirmed_at", "created_at", "updated_at"
)
SELECT gen_random_uuid()::text, "id", "updated_at", "created_at", "updated_at"
FROM "branches";

CREATE TABLE "branch_attendance_policies" (
  "id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "use_qr" BOOLEAN NOT NULL DEFAULT true,
  "qr_board_roles" JSONB NOT NULL DEFAULT '["BUSINESS_OWNER","BRANCH_MANAGER","RECEPTIONIST"]',
  "adjustment_reviewer_roles" JSONB NOT NULL DEFAULT '["BUSINESS_OWNER","BRANCH_MANAGER"]',
  "late_threshold_minutes" INTEGER NOT NULL DEFAULT 10,
  "early_leave_rule" TEXT,
  "overtime_rule" TEXT,
  "missing_punch_workflow" TEXT,
  "confirmed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "branch_attendance_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "branch_attendance_policies_branch_id_key"
  ON "branch_attendance_policies"("branch_id");
ALTER TABLE "branch_attendance_policies"
  ADD CONSTRAINT "branch_attendance_policies_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "branch_attendance_policies" (
  "id", "branch_id", "confirmed_at", "created_at", "updated_at"
)
SELECT gen_random_uuid()::text, "id", "updated_at", "created_at", "updated_at"
FROM "branches";

CREATE TABLE "branch_documents" (
  "id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "document_type" "BranchDocumentType" NOT NULL,
  "document_number" TEXT,
  "issued_at" DATE,
  "expires_at" DATE,
  "status" "BranchDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "current_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "branch_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "branch_documents_branch_id_document_type_status_idx"
  ON "branch_documents"("branch_id", "document_type", "status");
ALTER TABLE "branch_documents"
  ADD CONSTRAINT "branch_documents_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "branch_document_versions" (
  "id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "media_id" TEXT NOT NULL,
  "document_name" TEXT NOT NULL,
  "note" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "branch_document_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "branch_document_versions_document_id_version_key"
  ON "branch_document_versions"("document_id", "version");
CREATE INDEX "branch_document_versions_media_id_idx"
  ON "branch_document_versions"("media_id");
ALTER TABLE "branch_document_versions"
  ADD CONSTRAINT "branch_document_versions_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "branch_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branch_document_versions"
  ADD CONSTRAINT "branch_document_versions_media_id_fkey"
  FOREIGN KEY ("media_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "branch_document_versions"
  ADD CONSTRAINT "branch_document_versions_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "branch_review_requests" (
  "id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "status" "BranchReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "profile_snapshot" JSONB NOT NULL,
  "document_snapshot" JSONB,
  "risk_snapshot" JSONB,
  "assigned_to" TEXT,
  "due_at" TIMESTAMP(3),
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "branch_review_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "branch_review_requests_branch_id_submitted_at_idx"
  ON "branch_review_requests"("branch_id", "submitted_at");
CREATE INDEX "branch_review_requests_status_submitted_at_idx"
  ON "branch_review_requests"("status", "submitted_at");
ALTER TABLE "branch_review_requests"
  ADD CONSTRAINT "branch_review_requests_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branch_review_requests"
  ADD CONSTRAINT "branch_review_requests_requested_by_fkey"
  FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "branch_review_requests"
  ADD CONSTRAINT "branch_review_requests_assigned_to_fkey"
  FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "branch_review_events" (
  "id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "actor_id" TEXT,
  "action" TEXT NOT NULL,
  "from_status" "BranchReviewStatus",
  "to_status" "BranchReviewStatus" NOT NULL,
  "reason" TEXT,
  "target_step" INTEGER,
  "deadline" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "branch_review_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "branch_review_events_branch_id_created_at_idx"
  ON "branch_review_events"("branch_id", "created_at");
ALTER TABLE "branch_review_events"
  ADD CONSTRAINT "branch_review_events_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branch_review_events"
  ADD CONSTRAINT "branch_review_events_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "staff_branch_assignments" (
  "id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "status" "StaffAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "job_title" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "is_bookable" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_branch_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "staff_branch_assignments_staff_id_branch_id_start_date_key"
  ON "staff_branch_assignments"("staff_id", "branch_id", "start_date");
CREATE INDEX "staff_branch_assignments_branch_id_status_start_date_idx"
  ON "staff_branch_assignments"("branch_id", "status", "start_date");
CREATE INDEX "staff_branch_assignments_staff_id_status_start_date_idx"
  ON "staff_branch_assignments"("staff_id", "status", "start_date");
ALTER TABLE "staff_branch_assignments"
  ADD CONSTRAINT "staff_branch_assignments_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_branch_assignments"
  ADD CONSTRAINT "staff_branch_assignments_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "staff_branch_assignments" (
  "id", "staff_id", "branch_id", "start_date", "status",
  "job_title", "is_primary", "is_bookable", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  "id",
  "branch_id",
  COALESCE("hired_at", "created_at"::date),
  CASE
    WHEN "status" = 'ACTIVE' THEN 'ACTIVE'::"StaffAssignmentStatus"
    ELSE 'INACTIVE'::"StaffAssignmentStatus"
  END,
  "position",
  true,
  "is_bookable",
  "created_at",
  "updated_at"
FROM "staff_profiles";

CREATE TABLE "staff_schedule_versions" (
  "id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "status" "StaffScheduleStatus" NOT NULL DEFAULT 'PUBLISHED',
  "note" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_schedule_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "staff_schedule_versions_staff_id_branch_id_version_key"
  ON "staff_schedule_versions"("staff_id", "branch_id", "version");
CREATE INDEX "staff_schedule_versions_staff_id_branch_id_effective_from_effective_to_idx"
  ON "staff_schedule_versions"("staff_id", "branch_id", "effective_from", "effective_to");
ALTER TABLE "staff_schedule_versions"
  ADD CONSTRAINT "staff_schedule_versions_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_schedule_versions"
  ADD CONSTRAINT "staff_schedule_versions_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_schedule_versions"
  ADD CONSTRAINT "staff_schedule_versions_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "staff_schedule_segments" (
  "id" TEXT NOT NULL,
  "version_id" TEXT NOT NULL,
  "day_of_week" SMALLINT NOT NULL,
  "start_time" TIME(6) NOT NULL,
  "end_time" TIME(6) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "staff_schedule_segments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "staff_schedule_segments_version_id_day_of_week_sort_order_key"
  ON "staff_schedule_segments"("version_id", "day_of_week", "sort_order");
CREATE INDEX "staff_schedule_segments_version_id_day_of_week_idx"
  ON "staff_schedule_segments"("version_id", "day_of_week");
ALTER TABLE "staff_schedule_segments"
  ADD CONSTRAINT "staff_schedule_segments_version_id_fkey"
  FOREIGN KEY ("version_id") REFERENCES "staff_schedule_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one immutable version from the current weekly schedule. A creator is
-- resolved from the staff account, then a scoped owner/manager, then any active
-- platform account. Existing rows stay available as the legacy fallback.
INSERT INTO "staff_schedule_versions" (
  "id", "staff_id", "branch_id", "version", "effective_from",
  "status", "created_by", "created_at"
)
SELECT
  gen_random_uuid()::text,
  sp."id",
  sp."branch_id",
  1,
  COALESCE(sp."hired_at", sp."created_at"::date),
  'PUBLISHED'::"StaffScheduleStatus",
  COALESCE(
    sp."user_id",
    (
      SELECT ur."user_id"
      FROM "user_roles" ur
      JOIN "roles" r ON r."id" = ur."role_id"
      WHERE ur."business_id" = b."business_id"
        AND r."code" IN ('BUSINESS_OWNER', 'BRANCH_MANAGER')
      ORDER BY CASE WHEN r."code" = 'BUSINESS_OWNER' THEN 0 ELSE 1 END, ur."granted_at"
      LIMIT 1
    ),
    (
      SELECT u."id"
      FROM "users" u
      WHERE u."is_active" = true AND u."deleted_at" IS NULL
      ORDER BY u."created_at"
      LIMIT 1
    )
  ),
  sp."created_at"
FROM "staff_profiles" sp
JOIN "branches" b ON b."id" = sp."branch_id"
WHERE EXISTS (
  SELECT 1 FROM "staff_working_hours" swh
  WHERE swh."staff_id" = sp."id" AND swh."is_off" = false
)
AND COALESCE(
  sp."user_id",
  (
    SELECT ur."user_id"
    FROM "user_roles" ur
    JOIN "roles" r ON r."id" = ur."role_id"
    WHERE ur."business_id" = b."business_id"
      AND r."code" IN ('BUSINESS_OWNER', 'BRANCH_MANAGER')
    ORDER BY CASE WHEN r."code" = 'BUSINESS_OWNER' THEN 0 ELSE 1 END, ur."granted_at"
    LIMIT 1
  ),
  (
    SELECT u."id"
    FROM "users" u
    WHERE u."is_active" = true AND u."deleted_at" IS NULL
    ORDER BY u."created_at"
    LIMIT 1
  )
) IS NOT NULL;

INSERT INTO "staff_schedule_segments" (
  "id", "version_id", "day_of_week", "start_time", "end_time", "sort_order"
)
SELECT
  gen_random_uuid()::text,
  ssv."id",
  swh."day_of_week",
  swh."start_time",
  swh."end_time",
  0
FROM "staff_schedule_versions" ssv
JOIN "staff_working_hours" swh ON swh."staff_id" = ssv."staff_id"
WHERE ssv."version" = 1 AND swh."is_off" = false;

CREATE TABLE "staff_schedule_change_requests" (
  "id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "type" "StaffScheduleChangeType" NOT NULL,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "proposed_data" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "StaffScheduleRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_schedule_change_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "staff_schedule_change_requests_staff_id_status_created_at_idx"
  ON "staff_schedule_change_requests"("staff_id", "status", "created_at");
CREATE INDEX "staff_schedule_change_requests_branch_id_status_created_at_idx"
  ON "staff_schedule_change_requests"("branch_id", "status", "created_at");
ALTER TABLE "staff_schedule_change_requests"
  ADD CONSTRAINT "staff_schedule_change_requests_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_schedule_change_requests"
  ADD CONSTRAINT "staff_schedule_change_requests_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_schedule_change_requests"
  ADD CONSTRAINT "staff_schedule_change_requests_requested_by_fkey"
  FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_schedule_change_requests"
  ADD CONSTRAINT "staff_schedule_change_requests_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" (
  "id", "code", "description", "resource", "action", "scope", "created_at"
)
VALUES
  (
    gen_random_uuid()::text,
    'staff_schedule:read:self',
    'Nhân viên chỉ xem lịch làm việc và booking của chính mình',
    'staff_schedule',
    'read',
    'SELF',
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid()::text,
    'staff_schedule:manage:self',
    'Quyền đặc biệt cho phép nhân viên tự quản lịch trong giới hạn policy',
    'staff_schedule',
    'manage',
    'SELF',
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid()::text,
    'staff_schedule:request_change:self',
    'Nhân viên gửi yêu cầu thay đổi lịch của chính mình',
    'staff_schedule',
    'request_change',
    'SELF',
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("code") DO NOTHING;

DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."role_id" = r."id"
  AND rp."permission_id" = p."id"
  AND r."code" = 'STAFF'
  AND p."code" = 'staff_schedule:read:branch';

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" = 'STAFF'
  AND p."code" IN (
    'staff_schedule:read:self',
    'staff_schedule:request_change:self'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
