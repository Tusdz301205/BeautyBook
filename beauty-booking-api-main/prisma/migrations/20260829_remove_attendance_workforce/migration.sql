-- Remove employee attendance, schedule/leave and payroll subsystems from the
-- active application schema without destroying historical data. Prisma no
-- longer models these tables, but an operator can still inspect or restore the
-- archived rows if the product scope changes again.
--
-- Keep the enum types because the archived tables still depend on them. They
-- are harmless when they are not referenced by the active Prisma schema.
DO $$
DECLARE
  source_table text;
  archive_table text;
BEGIN
  FOREACH source_table IN ARRAY ARRAY[
    'attendance_events',
    'attendance_exception_requests',
    'attendance_qr_uses',
    'attendance_qr_tokens',
    'staff_attendances',
    'branch_attendance_policies',
    'compensation_adjustments',
    'compensation_entries',
    'compensation_assignments',
    'compensation_rules',
    'pay_run_items',
    'pay_runs',
    'timesheet_adjustments',
    'timesheets',
    'staff_schedule_segments',
    'staff_schedule_change_requests',
    'staff_schedule_versions',
    'staff_availabilities',
    'staff_leaves',
    'staff_breaks',
    'staff_working_hours'
  ]
  LOOP
    archive_table := 'archive_20260829_' || source_table;
    IF to_regclass('public.' || quote_ident(source_table)) IS NOT NULL
       AND to_regclass('public.' || quote_ident(archive_table)) IS NULL THEN
      EXECUTE format('ALTER TABLE %I RENAME TO %I', source_table, archive_table);
    END IF;
  END LOOP;
END $$;

-- A special opening is now branch-wide. Prefer an existing branch-wide row;
-- otherwise retain one deterministic row for each branch/date.
CREATE TABLE IF NOT EXISTS "archive_20260829_special_working_days"
AS SELECT * FROM "special_working_days" WITH NO DATA;

INSERT INTO "archive_20260829_special_working_days"
SELECT * FROM "special_working_days";

WITH ranked AS (
  SELECT "id",
    row_number() OVER (
      PARTITION BY "branch_id", "date"
      ORDER BY ("staff_id" IS NULL) DESC, "id"
    ) AS rank
  FROM "special_working_days"
)
DELETE FROM "special_working_days" AS special
USING ranked
WHERE special."id" = ranked."id" AND ranked.rank > 1;

ALTER TABLE "special_working_days" DROP COLUMN IF EXISTS "staff_id" CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "special_working_days_branch_id_date_key"
  ON "special_working_days"("branch_id", "date");

-- PostgreSQL enum values cannot be removed in place. Existing ON_LEAVE rows
-- become INACTIVE because leave management no longer exists.
CREATE TABLE IF NOT EXISTS "archive_20260829_staff_profiles_on_leave" (
  "snapshot" jsonb NOT NULL,
  "archived_at" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "archive_20260829_staff_profiles_on_leave" ("snapshot")
SELECT to_jsonb(staff_profile.*)
FROM "staff_profiles" AS staff_profile
WHERE staff_profile."status"::text = 'ON_LEAVE';

UPDATE "staff_profiles" SET "status" = 'INACTIVE' WHERE "status"::text = 'ON_LEAVE';
ALTER TABLE "staff_profiles" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "StaffStatus" RENAME TO "StaffStatus_old";
CREATE TYPE "StaffStatus" AS ENUM ('PROFILE_ONLY', 'INVITED', 'ACTIVE', 'LOCKED', 'INACTIVE');
ALTER TABLE "staff_profiles"
  ALTER COLUMN "status" TYPE "StaffStatus" USING ("status"::text::"StaffStatus");
ALTER TABLE "staff_profiles" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
DROP TYPE "StaffStatus_old";

-- Role/user permission rows are deleted through their ON DELETE CASCADE
-- foreign keys when the obsolete permission definitions are removed.
CREATE TABLE IF NOT EXISTS "archive_20260829_permissions"
AS SELECT * FROM "permissions" WITH NO DATA;

CREATE TABLE IF NOT EXISTS "archive_20260829_role_permissions"
AS SELECT role_permission.* FROM "role_permissions" AS role_permission WITH NO DATA;

CREATE TABLE IF NOT EXISTS "archive_20260829_user_permissions"
AS SELECT user_permission.* FROM "user_permissions" AS user_permission WITH NO DATA;

INSERT INTO "archive_20260829_permissions"
SELECT * FROM "permissions"
WHERE "resource" IN (
  'attendance', 'availability', 'timesheet', 'compensation', 'pay_run',
  'staff_schedule', 'staff_leave'
);

INSERT INTO "archive_20260829_role_permissions"
SELECT role_permission.*
FROM "role_permissions" AS role_permission
INNER JOIN "permissions" AS permission ON permission."id" = role_permission."permission_id"
WHERE permission."resource" IN (
  'attendance', 'availability', 'timesheet', 'compensation', 'pay_run',
  'staff_schedule', 'staff_leave'
);

INSERT INTO "archive_20260829_user_permissions"
SELECT user_permission.*
FROM "user_permissions" AS user_permission
INNER JOIN "permissions" AS permission ON permission."id" = user_permission."permission_id"
WHERE permission."resource" IN (
  'attendance', 'availability', 'timesheet', 'compensation', 'pay_run',
  'staff_schedule', 'staff_leave'
);

DELETE FROM "permissions"
WHERE "resource" IN (
  'attendance', 'availability', 'timesheet', 'compensation', 'pay_run',
  'staff_schedule', 'staff_leave'
);

-- Remove attendance-only settings while preserving all booking/platform
-- settings stored in the same JSON document.
CREATE TABLE IF NOT EXISTS "archive_20260829_platform_settings"
AS SELECT * FROM "platform_settings" WITH NO DATA;

INSERT INTO "archive_20260829_platform_settings"
SELECT * FROM "platform_settings" WHERE "key" = 'platform';

UPDATE "platform_settings"
SET "value" = "value"
  - 'checkInEarlyWindowMinutes'
  - 'lateGraceMinutes'
  - 'absentThresholdMinutes'
  - 'checkOutEarlyGraceMinutes'
  - 'overtimeGraceMinutes'
  - 'attendanceQrTtlSeconds'
WHERE "key" = 'platform';

-- The branch onboarding wizard now has 13 steps. Shift persisted steps after
-- the removed attendance-policy step and stamp the new wizard version.
CREATE TABLE IF NOT EXISTS "archive_20260829_branch_onboarding_progress"
AS SELECT * FROM "branch_onboarding_progress" WITH NO DATA;

INSERT INTO "archive_20260829_branch_onboarding_progress"
SELECT * FROM "branch_onboarding_progress";

UPDATE "branch_onboarding_progress"
SET "current_step" = "current_step" - 1
WHERE "current_step" > 9;

UPDATE "branch_onboarding_progress" AS progress
SET "completed_steps" = COALESCE((
  SELECT jsonb_agg(
    CASE WHEN step.value::int > 9 THEN step.value::int - 1 ELSE step.value::int END
    ORDER BY step.ordinality
  )
  FROM jsonb_array_elements_text(progress."completed_steps"::jsonb)
    WITH ORDINALITY AS step(value, ordinality)
  WHERE step.value::int <> 9
), '[]'::jsonb),
"draft_data" = (
  COALESCE("draft_data"::jsonb, '{}'::jsonb) - 'attendancePolicy'
) || jsonb_build_object('wizardVersion', 2);

-- Moving or reassigning a multi-service booking updates its service rows in
-- one transaction. Exclude sibling rows from the overlap probe so their old
-- intervals cannot reject the booking's own atomic move; other bookings are
-- still protected by the provider advisory lock and interval check.
CREATE OR REPLACE FUNCTION "enforce_booking_service_staff_slot"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_booking_status "BookingStatus";
BEGIN
  IF NEW."staff_id" IS NULL
     OR NEW."item_start_at" IS NULL
     OR NEW."item_end_at" IS NULL
     OR NEW."status" NOT IN ('SCHEDULED', 'IN_PROGRESS') THEN
    RETURN NEW;
  END IF;

  SELECT b."status"
  INTO current_booking_status
  FROM "bookings" AS b
  WHERE b."id" = NEW."booking_id"
    AND b."deleted_at" IS NULL;

  IF current_booking_status IS NULL
     OR current_booking_status NOT IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS') THEN
    RETURN NEW;
  END IF;

  IF NEW."item_end_at" <= NEW."item_start_at" THEN
    RAISE EXCEPTION 'Booking service interval must have a positive duration'
      USING ERRCODE = '22007',
            CONSTRAINT = 'booking_services_valid_item_interval';
  END IF;

  IF NOT pg_try_advisory_xact_lock(
    hashtext('beautybook_booking_staff_slot'),
    hashtext(NEW."staff_id")
  ) THEN
    RAISE EXCEPTION 'A reservation for this staff member is being processed'
      USING ERRCODE = '23P01',
            CONSTRAINT = 'booking_services_staff_slot_no_overlap';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "booking_services" AS existing
    INNER JOIN "bookings" AS booking
      ON booking."id" = existing."booking_id"
    WHERE existing."id" <> NEW."id"
      AND existing."booking_id" <> NEW."booking_id"
      AND existing."staff_id" = NEW."staff_id"
      AND existing."status" IN ('SCHEDULED', 'IN_PROGRESS')
      AND existing."item_start_at" IS NOT NULL
      AND existing."item_end_at" IS NOT NULL
      AND existing."item_start_at" < NEW."item_end_at"
      AND existing."item_end_at" > NEW."item_start_at"
      AND booking."deleted_at" IS NULL
      AND booking."status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
  ) THEN
    RAISE EXCEPTION 'Staff member already has a booking in this time range'
      USING ERRCODE = '23P01',
            CONSTRAINT = 'booking_services_staff_slot_no_overlap';
  END IF;

  RETURN NEW;
END;
$$;
