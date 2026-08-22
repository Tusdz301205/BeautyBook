ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "address" TEXT;

ALTER TABLE "staff_profiles"
  ADD COLUMN IF NOT EXISTS "employee_code" TEXT,
  ADD COLUMN IF NOT EXISTS "experience_years" INTEGER,
  ADD COLUMN IF NOT EXISTS "public_visible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "emergency_contact_name" TEXT,
  ADD COLUMN IF NOT EXISTS "emergency_contact_phone" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "staff_profiles_branch_id_employee_code_key"
  ON "staff_profiles"("branch_id", "employee_code");

DO $$ BEGIN
  CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "media_files"
  ADD COLUMN IF NOT EXISTS "storage_key" TEXT,
  ADD COLUMN IF NOT EXISTS "original_name" TEXT,
  ADD COLUMN IF NOT EXISTS "safe_name" TEXT,
  ADD COLUMN IF NOT EXISTS "mime_type" TEXT,
  ADD COLUMN IF NOT EXISTS "extension" TEXT,
  ADD COLUMN IF NOT EXISTS "business_id" TEXT,
  ADD COLUMN IF NOT EXISTS "branch_id" TEXT,
  ADD COLUMN IF NOT EXISTS "entity_type" TEXT,
  ADD COLUMN IF NOT EXISTS "entity_id" TEXT,
  ADD COLUMN IF NOT EXISTS "visibility" "MediaVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS "media_files_storage_key_key" ON "media_files"("storage_key");
CREATE INDEX IF NOT EXISTS "media_files_business_id_branch_id_idx" ON "media_files"("business_id", "branch_id");
CREATE INDEX IF NOT EXISTS "media_files_entity_type_entity_id_idx" ON "media_files"("entity_type", "entity_id");

ALTER TYPE "ComboStatus" ADD VALUE IF NOT EXISTS 'PAUSED';
ALTER TYPE "ComboStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TABLE "combos"
  ADD COLUMN IF NOT EXISTS "valid_from" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "valid_to" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "max_usage" INTEGER,
  ADD COLUMN IF NOT EXISTS "used_count" INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  CREATE TYPE "RecurringStaffMode" AS ENUM ('SAME_STAFF', 'ANY_AVAILABLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "recurring_booking_plans"
  ADD COLUMN IF NOT EXISTS "service_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "combo_id" TEXT,
  ADD COLUMN IF NOT EXISTS "staff_id" TEXT,
  ADD COLUMN IF NOT EXISTS "staff_mode" "RecurringStaffMode" NOT NULL DEFAULT 'ANY_AVAILABLE',
  ADD COLUMN IF NOT EXISTS "preferred_time" TEXT NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS "occurrence_count" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "day_of_week" INTEGER,
  ADD COLUMN IF NOT EXISTS "day_of_month" INTEGER;
CREATE INDEX IF NOT EXISTS "recurring_booking_plans_branch_id_status_idx" ON "recurring_booking_plans"("branch_id", "status");
DO $$ BEGIN
  ALTER TABLE "recurring_booking_plans" ADD CONSTRAINT "recurring_booking_plans_combo_id_fkey"
    FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "recurring_booking_plans" ADD CONSTRAINT "recurring_booking_plans_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
  ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "target_type" TEXT,
  ADD COLUMN IF NOT EXISTS "target_id" TEXT,
  ADD COLUMN IF NOT EXISTS "action_url" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

DO $$ BEGIN
  CREATE TYPE "VoucherAudience" AS ENUM ('ALL', 'NEW_CUSTOMER', 'RETURNING_CUSTOMER', 'BIRTHDAY', 'VIP', 'SELECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "vouchers"
  ADD COLUMN IF NOT EXISTS "audience" "VoucherAudience" NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS "max_usage_per_customer" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "auto_issue" BOOLEAN NOT NULL DEFAULT false;
