ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

CREATE TYPE "BookingConfirmationMode" AS ENUM ('MANUAL_CONFIRMATION', 'AUTO_CONFIRMATION');
CREATE TYPE "StaffAssignmentMode" AS ENUM ('CUSTOMER_SELECTS_STAFF', 'AUTO_ASSIGN_IF_ANY_STAFF', 'MANUAL_ASSIGN_BY_RECEPTIONIST');
CREATE TYPE "BookingSource" AS ENUM ('ONLINE_WEB', 'ONLINE_APP', 'WALK_IN', 'PHONE', 'STAFF_CREATED', 'ADMIN_CREATED');

ALTER TABLE "branches"
  ADD COLUMN "booking_confirmation_mode" "BookingConfirmationMode" NOT NULL DEFAULT 'MANUAL_CONFIRMATION',
  ADD COLUMN "staff_assignment_mode" "StaffAssignmentMode" NOT NULL DEFAULT 'AUTO_ASSIGN_IF_ANY_STAFF',
  ADD COLUMN "pending_hold_minutes" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "bookings"
  ADD COLUMN "source" "BookingSource" NOT NULL DEFAULT 'ONLINE_WEB',
  ADD COLUMN "pending_expires_at" TIMESTAMP(3);

CREATE INDEX "bookings_status_pending_expires_at_idx" ON "bookings"("status", "pending_expires_at");
