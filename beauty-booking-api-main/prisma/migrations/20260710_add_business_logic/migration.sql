-- ============================================================
-- Nghiệp vụ mở rộng cho BeautyBook
-- Bổ sung:
--    - Enum mới (SalonMemberRole, CancelledByType, ChangeRequest*, VoucherStatus, AuditAction mở rộng)
--   - Bảng: SalonMember, CancellationPolicy, Voucher, CustomerVoucher, AppointmentChangeRequest, SalonTrustSnapshot
--   - Bổ sung cột cho bookings (cancelled_by_type, cancellation_fee_amount, final_amount, voucher_discount_amount, voucher_id)
--   - Bổ sung cột audit_logs.reason
-- Tham chiếu: prisma/schema.prisma (đồng bộ hoàn toàn).
-- Apply bằng:  psql ... -f migration.sql  hoặc  npx prisma migrate deploy
-- ============================================================

-- 1. Enums (idempotent với DO block)
DO $$ BEGIN
  CREATE TYPE "SalonMemberRole" AS ENUM ('OWNER', 'MANAGER', 'RECEPTIONIST');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CancelledByType" AS ENUM ('CUSTOMER', 'SALON', 'ADMIN', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ChangeRequestType" AS ENUM ('RESCHEDULE', 'STAFF_CHANGE', 'CANCEL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "VoucherStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Mở rộng AuditAction (PostgreSQL cho phép ADD VALUE)
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CANCEL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FORCE_CANCEL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REFUND';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ESCALATION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POLICY_OVERRIDE';

-- Mở rộng NotificationType
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_RESCHEDULE_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_RESCHEDULE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_RESCHEDULE_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_PAYMENT_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SALON_VIOLATION_ALERT';

-- 2. Bảng mới: salon_members
CREATE TABLE IF NOT EXISTS "salon_members" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id"     TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "branch_id"   TEXT,
  "role"        "SalonMemberRole" NOT NULL,
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  "deleted_at"  TIMESTAMP(3),
  CONSTRAINT "salon_members_user_id_business_id_key" UNIQUE ("user_id", "business_id")
);
CREATE INDEX IF NOT EXISTS "salon_members_business_id_idx" ON "salon_members"("business_id");
CREATE INDEX IF NOT EXISTS "salon_members_branch_id_idx" ON "salon_members"("branch_id");
CREATE INDEX IF NOT EXISTS "salon_members_user_id_idx" ON "salon_members"("user_id");

DO $$ BEGIN
  ALTER TABLE "salon_members" ADD CONSTRAINT "salon_members_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "salon_members" ADD CONSTRAINT "salon_members_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "salon_members" ADD CONSTRAINT "salon_members_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. cancellation_policies
CREATE TABLE IF NOT EXISTS "cancellation_policies" (
  "id"                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "business_id"                TEXT NOT NULL UNIQUE,
  "free_cancel_hours"          INTEGER NOT NULL DEFAULT 2,
  "late_cancel_fee_percent"    INTEGER NOT NULL DEFAULT 50,
  "no_show_fee_percent"        INTEGER NOT NULL DEFAULT 100,
  "reschedule_allowed_hours"   INTEGER NOT NULL DEFAULT 1,
  "notes"                      TEXT,
  "updated_by"                 TEXT,
  "created_at"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                 TIMESTAMP(3) NOT NULL
);
DO $$ BEGIN
  ALTER TABLE "cancellation_policies" ADD CONSTRAINT "cancellation_policies_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. vouchers
CREATE TABLE IF NOT EXISTS "vouchers" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code"            TEXT NOT NULL UNIQUE,
  "name"            TEXT NOT NULL,
  "description"     TEXT,
  "discount_type"   "DiscountType" NOT NULL,
  "discount_value"  DECIMAL(12,2) NOT NULL,
  "min_order_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "max_discount"    DECIMAL(12,2),
  "total_quantity"  INTEGER NOT NULL DEFAULT 0,
  "used_quantity"   INTEGER NOT NULL DEFAULT 0,
  "start_date"      TIMESTAMP(3) NOT NULL,
  "end_date"        TIMESTAMP(3) NOT NULL,
  "status"          "VoucherStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  "deleted_at"      TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "vouchers_status_idx" ON "vouchers"("status");
CREATE INDEX IF NOT EXISTS "vouchers_start_date_end_date_idx" ON "vouchers"("start_date","end_date");

-- 5. customer_vouchers
CREATE TABLE IF NOT EXISTS "customer_vouchers" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "voucher_id"       TEXT NOT NULL,
  "customer_id"      TEXT NOT NULL,
  "status"           "VoucherStatus" NOT NULL DEFAULT 'ACTIVE',
  "acquired_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "used_at"          TIMESTAMP(3),
  "used_booking_id"  TEXT UNIQUE,
  "expires_at"       TIMESTAMP(3),
  CONSTRAINT "customer_vouchers_voucher_id_customer_id_key" UNIQUE ("voucher_id","customer_id")
);
CREATE INDEX IF NOT EXISTS "customer_vouchers_customer_id_idx" ON "customer_vouchers"("customer_id");

DO $$ BEGIN
  ALTER TABLE "customer_vouchers" ADD CONSTRAINT "customer_vouchers_voucher_id_fkey"
    FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "customer_vouchers" ADD CONSTRAINT "customer_vouchers_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 6. appointment_change_requests
CREATE TABLE IF NOT EXISTS "appointment_change_requests" (
  "id"                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "booking_id"           TEXT NOT NULL,
  "requested_by"         TEXT NOT NULL,
  "requested_by_type"    "CancelledByType" NOT NULL,
  "request_type"         "ChangeRequestType" NOT NULL,
  "proposed_start_time"  TIMESTAMP(3),
  "proposed_end_time"    TIMESTAMP(3),
  "proposed_staff_id"    TEXT,
  "reason"               TEXT,
  "status"               "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by"          TEXT,
  "reviewed_at"          TIMESTAMP(3),
  "review_note"          TEXT,
  "expires_at"           TIMESTAMP(3) NOT NULL,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "appointment_change_requests_booking_id_idx" ON "appointment_change_requests"("booking_id");
CREATE INDEX IF NOT EXISTS "appointment_change_requests_status_idx" ON "appointment_change_requests"("status");

DO $$ BEGIN
  ALTER TABLE "appointment_change_requests" ADD CONSTRAINT "appointment_change_requests_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "appointment_change_requests" ADD CONSTRAINT "appointment_change_requests_requested_by_fkey"
    FOREIGN KEY ("requested_by") REFERENCES "users"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "appointment_change_requests" ADD CONSTRAINT "appointment_change_requests_proposed_staff_id_fkey"
    FOREIGN KEY ("proposed_staff_id") REFERENCES "staff_profiles"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "appointment_change_requests" ADD CONSTRAINT "appointment_change_requests_reviewed_by_fkey"
    FOREIGN KEY ("reviewed_by") REFERENCES "users"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 7. salon_trust_snapshots
CREATE TABLE IF NOT EXISTS "salon_trust_snapshots" (
  "id"                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "business_id"                TEXT NOT NULL UNIQUE,
  "total_bookings"             INTEGER NOT NULL DEFAULT 0,
  "cancellation_rate"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "no_show_rate"               DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avg_reject_time_minutes"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "late_cancel_by_salon_rate"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "trust_score"                DOUBLE PRECISION NOT NULL DEFAULT 100,
  "alert_level"                TEXT NOT NULL DEFAULT 'OK',
  "computed_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  ALTER TABLE "salon_trust_snapshots" ADD CONSTRAINT "salon_trust_snapshots_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 8. Bổ sung cột cho bookings
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancelled_by_type" "CancelledByType";
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancellation_fee_amount" DECIMAL(12,2);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "final_amount" DECIMAL(12,2);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "voucher_discount_amount" DECIMAL(12,2);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "voucher_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_voucher_id_fkey"
    FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "bookings_voucher_id_idx" ON "bookings"("voucher_id");

-- 9. Bổ sung cột cho audit_logs
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "reason" TEXT;

-- ============================================================
-- DONE. Schema đồng bộ với prisma/schema.prisma.
-- ============================================================
