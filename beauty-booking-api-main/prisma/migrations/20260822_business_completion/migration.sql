-- CreateEnum
CREATE TYPE "PriceAdjustmentType" AS ENUM ('PROMOTION', 'VOUCHER', 'LOYALTY', 'PACKAGE', 'MANUAL', 'SURCHARGE', 'REFUND');

-- CreateEnum
CREATE TYPE "PriceAdjustmentStatus" AS ENUM ('RESERVED', 'APPLIED', 'RELEASED', 'REVERSED');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('RESERVED', 'APPLIED', 'RELEASED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ServicePriceType" AS ENUM ('FIXED', 'FROM', 'RANGE', 'QUOTE');

-- CreateEnum
CREATE TYPE "ServiceDependencyType" AS ENUM ('REQUIRED', 'ADD_ON', 'INCOMPATIBLE');

-- CreateEnum
CREATE TYPE "BookingItemAction" AS ENUM ('ADD', 'REMOVE', 'REASSIGN', 'RESIZE', 'START', 'COMPLETE', 'SKIP', 'REPRICE');

-- CreateEnum
CREATE TYPE "ImpactSubjectType" AS ENUM ('STAFF', 'BRANCH', 'BUSINESS', 'SCHEDULE');

-- CreateEnum
CREATE TYPE "ImpactAction" AS ENUM ('OFFBOARD', 'PAUSE', 'SUSPEND', 'CLOSE', 'SCHEDULE_CHANGE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "ImpactCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'READY_TO_COMPLETE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImpactResolution" AS ENUM ('REASSIGN', 'RESCHEDULE', 'TRANSFER_BRANCH', 'CANCEL_REFUND', 'APPROVED_EXCEPTION');

-- CreateEnum
CREATE TYPE "ImpactItemStatus" AS ENUM ('PENDING', 'RESOLVED', 'FAILED');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'OFFERED', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewModerationAction" AS ENUM ('REPORT', 'QUARANTINE', 'APPROVE', 'HIDE', 'RESTORE', 'APPEAL_SUBMITTED', 'APPEAL_APPROVED', 'APPEAL_REJECTED');

-- CreateEnum
CREATE TYPE "ReviewAppealStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM', 'EXPIRE', 'REVERSE', 'REFUND_ADJUSTMENT', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED', 'ADJUSTED');

-- CreateEnum
CREATE TYPE "CashShiftStatus" AS ENUM ('OPEN', 'PENDING_APPROVAL', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('PAYMENT', 'REFUND', 'MANUAL_IN', 'MANUAL_OUT');

-- CreateEnum
CREATE TYPE "OwnershipTransferStatus" AS ENUM ('DRAFT', 'PENDING_NEW_OWNER_ACCEPTANCE', 'UNDER_REVIEW', 'NEED_MORE_INFO', 'APPROVED', 'SCHEDULED', 'EXECUTING', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXECUTION_FAILED');

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "audience" "VoucherAudience" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "auto_apply" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "max_usage_per_customer" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "stacking_allowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "total_quantity" INTEGER,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "booking_services" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "skipped_reason" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3),
ADD COLUMN     "variant_id" TEXT;

-- Preserve legacy booking items: backfill before enforcing the non-null invariant.
UPDATE "booking_services" bs
SET "updated_at" = COALESCE(
  (SELECT b."updated_at" FROM "bookings" b WHERE b."id" = bs."booking_id"),
  CURRENT_TIMESTAMP
);
ALTER TABLE "booking_services" ALTER COLUMN "updated_at" SET NOT NULL;

-- Normalize legacy branch combinations. A branch is publicly active only when
-- platform review is approved and operational status is ACTIVE.
UPDATE "branches"
SET "operational_status" = 'INACTIVE'
WHERE "review_status" <> 'APPROVED'
  AND "operational_status" IN ('ACTIVE', 'READY_TO_PUBLISH');

UPDATE "branches"
SET "status" = 'ACTIVE'
WHERE "review_status" = 'APPROVED'
  AND "operational_status" = 'ACTIVE';

UPDATE "branches"
SET "status" = 'INACTIVE'
WHERE "status" = 'ACTIVE'
  AND "operational_status" <> 'ACTIVE';

-- CreateTable
CREATE TABLE "branch_state_transitions" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "from_status" TEXT NOT NULL,
    "to_status" TEXT NOT NULL,
    "from_review_status" TEXT NOT NULL,
    "to_review_status" TEXT NOT NULL,
    "from_operational_status" TEXT NOT NULL,
    "to_operational_status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_state_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_adjustments" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT,
    "branch_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "type" "PriceAdjustmentType" NOT NULL,
    "source_id" TEXT,
    "source_version" INTEGER,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "allocation" JSONB,
    "rule_snapshot" JSONB NOT NULL,
    "status" "PriceAdjustmentStatus" NOT NULL DEFAULT 'RESERVED',
    "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "reversed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_redemptions" (
    "id" TEXT NOT NULL,
    "promotion_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'RESERVED',
    "rule_snapshot" JSONB NOT NULL,
    "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "reversed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_redemptions" (
    "id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "customer_voucher_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'RESERVED',
    "rule_snapshot" JSONB NOT NULL,
    "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "reversed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_variants" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_type" "ServicePriceType" NOT NULL DEFAULT 'FIXED',
    "price" DECIMAL(12,2),
    "max_price" DECIMAL(12,2),
    "duration_minutes" INTEGER,
    "max_duration_minutes" INTEGER,
    "buffer_before_minutes" INTEGER NOT NULL DEFAULT 0,
    "buffer_after_minutes" INTEGER NOT NULL DEFAULT 0,
    "consultation_required" BOOLEAN NOT NULL DEFAULT false,
    "eligibility_rules" JSONB,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "service_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_price_rules" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "adjustment_type" "DiscountType" NOT NULL,
    "adjustment_value" DECIMAL(12,2) NOT NULL,
    "conditions" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_dependencies" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "required_service_id" TEXT NOT NULL,
    "dependency_type" "ServiceDependencyType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_service_adjustments" (
    "id" TEXT NOT NULL,
    "booking_service_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" "BookingItemAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "before_snapshot" JSONB NOT NULL,
    "after_snapshot" JSONB NOT NULL,
    "amount_delta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_service_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_impact_cases" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "subject_type" "ImpactSubjectType" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "action" "ImpactAction" NOT NULL,
    "status" "ImpactCaseStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "deadline_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_impact_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_impact_items" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "resolution" "ImpactResolution",
    "status" "ImpactItemStatus" NOT NULL DEFAULT 'PENDING',
    "replacement_staff_id" TEXT,
    "replacement_branch_id" TEXT,
    "proposed_start_at" TIMESTAMP(3),
    "reason" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "financial_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_impact_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "staff_id" TEXT,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "offered_start_at" TIMESTAMP(3),
    "offer_expires_at" TIMESTAMP(3),
    "offer_token_hash" TEXT,
    "offer_slot_key" TEXT,
    "booking_id" TEXT,
    "accepted_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_moderation_events" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" "ReviewModerationAction" NOT NULL,
    "from_status" "ReviewStatus" NOT NULL,
    "to_status" "ReviewStatus" NOT NULL,
    "reason_code" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "report_category" TEXT,
    "severity" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_moderation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_appeals" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "appellant_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReviewAppealStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "resolution" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_rules" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "version" INTEGER NOT NULL,
    "earn_points_per_amount" INTEGER NOT NULL,
    "earn_amount_unit" DECIMAL(12,2) NOT NULL,
    "redemption_value_per_point" DECIMAL(12,2) NOT NULL,
    "expires_after_days" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_accounts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "refund_request_id" TEXT,
    "type" "LoyaltyTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "rule_snapshot" JSONB,
    "expires_at" TIMESTAMP(3),
    "reversal_of_id" TEXT,
    "reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "payment_id" TEXT,
    "invoice_number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "subtotal_amount" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "tax_inclusive" BOOLEAN NOT NULL DEFAULT true,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "buyer_snapshot" JSONB,
    "seller_snapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "issued_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "booking_service_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_events" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_shifts" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "opened_by" TEXT NOT NULL,
    "closed_by" TEXT,
    "approved_by" TEXT,
    "status" "CashShiftStatus" NOT NULL DEFAULT 'OPEN',
    "open_key" TEXT,
    "opening_balance" DECIMAL(12,2) NOT NULL,
    "expected_closing_balance" DECIMAL(12,2),
    "actual_closing_balance" DECIMAL(12,2),
    "variance_amount" DECIMAL(12,2),
    "variance_reason" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "cash_shift_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "refund_request_id" TEXT,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_transfers" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "old_owner_id" TEXT NOT NULL,
    "new_owner_user_id" TEXT NOT NULL,
    "status" "OwnershipTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "scope_snapshot" JSONB NOT NULL,
    "settlement_agreement" JSONB,
    "impact_snapshot" JSONB,
    "requested_by" TEXT NOT NULL,
    "accepted_by_new_owner_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ownership_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_history" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "transfer_id" TEXT,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ownership_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_entity_versions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "legal_name" TEXT NOT NULL,
    "tax_code" TEXT,
    "registration_number" TEXT,
    "representative_name" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'PENDING',
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_entity_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_account_versions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_holder" TEXT NOT NULL,
    "account_number_ciphertext" TEXT NOT NULL,
    "account_number_iv" TEXT NOT NULL,
    "authentication_tag" TEXT NOT NULL,
    "key_version" TEXT NOT NULL,
    "masked_account_number" TEXT NOT NULL,
    "verification_status" TEXT NOT NULL DEFAULT 'PENDING',
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_account_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_saved_services" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "branch_service_offering_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_saved_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_branch_scopes" (
    "voucher_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,

    CONSTRAINT "voucher_branch_scopes_pkey" PRIMARY KEY ("voucher_id","branch_id")
);

-- CreateTable
CREATE TABLE "voucher_service_scopes" (
    "voucher_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,

    CONSTRAINT "voucher_service_scopes_pkey" PRIMARY KEY ("voucher_id","service_id")
);

-- CreateTable
CREATE TABLE "voucher_combo_scopes" (
    "voucher_id" TEXT NOT NULL,
    "combo_id" TEXT NOT NULL,

    CONSTRAINT "voucher_combo_scopes_pkey" PRIMARY KEY ("voucher_id","combo_id")
);

-- CreateTable
CREATE TABLE "customer_business_segments" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "assigned_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_business_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branch_state_transitions_branch_id_created_at_idx" ON "branch_state_transitions"("branch_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "branch_state_transitions_branch_id_version_key" ON "branch_state_transitions"("branch_id", "version");

-- CreateIndex
CREATE INDEX "price_adjustments_booking_id_status_idx" ON "price_adjustments"("booking_id", "status");

-- CreateIndex
CREATE INDEX "price_adjustments_branch_id_created_at_idx" ON "price_adjustments"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "price_adjustments_source_id_status_idx" ON "price_adjustments"("source_id", "status");

-- CreateIndex
CREATE INDEX "promotion_redemptions_promotion_id_status_idx" ON "promotion_redemptions"("promotion_id", "status");

-- CreateIndex
CREATE INDEX "promotion_redemptions_customer_id_created_at_idx" ON "promotion_redemptions"("customer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_redemptions_promotion_id_booking_id_key" ON "promotion_redemptions"("promotion_id", "booking_id");

-- CreateIndex
CREATE INDEX "voucher_redemptions_voucher_id_customer_id_status_idx" ON "voucher_redemptions"("voucher_id", "customer_id", "status");

-- CreateIndex
CREATE INDEX "voucher_redemptions_booking_id_status_idx" ON "voucher_redemptions"("booking_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_redemptions_voucher_id_booking_id_key" ON "voucher_redemptions"("voucher_id", "booking_id");

-- CreateIndex
CREATE INDEX "service_variants_service_id_status_deleted_at_idx" ON "service_variants"("service_id", "status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_variants_service_id_code_key" ON "service_variants"("service_id", "code");

-- CreateIndex
CREATE INDEX "service_price_rules_service_id_active_priority_idx" ON "service_price_rules"("service_id", "active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "service_dependencies_service_id_required_service_id_depende_key" ON "service_dependencies"("service_id", "required_service_id", "dependency_type");

-- CreateIndex
CREATE INDEX "booking_service_adjustments_booking_id_created_at_idx" ON "booking_service_adjustments"("booking_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "booking_service_adjustments_booking_service_id_version_key" ON "booking_service_adjustments"("booking_service_id", "version");

-- CreateIndex
CREATE INDEX "operational_impact_cases_business_id_status_deadline_at_idx" ON "operational_impact_cases"("business_id", "status", "deadline_at");

-- CreateIndex
CREATE INDEX "operational_impact_cases_subject_type_subject_id_status_idx" ON "operational_impact_cases"("subject_type", "subject_id", "status");

-- CreateIndex
CREATE INDEX "operational_impact_items_case_id_status_idx" ON "operational_impact_items"("case_id", "status");

-- CreateIndex
CREATE INDEX "operational_impact_items_booking_id_idx" ON "operational_impact_items"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "operational_impact_items_case_id_booking_id_key" ON "operational_impact_items"("case_id", "booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_offer_token_hash_key" ON "waitlist_entries"("offer_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_offer_slot_key_key" ON "waitlist_entries"("offer_slot_key");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_booking_id_key" ON "waitlist_entries"("booking_id");

-- CreateIndex
CREATE INDEX "waitlist_entries_branch_id_service_id_status_created_at_idx" ON "waitlist_entries"("branch_id", "service_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "waitlist_entries_customer_id_status_idx" ON "waitlist_entries"("customer_id", "status");

-- CreateIndex
CREATE INDEX "waitlist_entries_offer_expires_at_status_idx" ON "waitlist_entries"("offer_expires_at", "status");

-- CreateIndex
CREATE INDEX "review_moderation_events_review_id_created_at_idx" ON "review_moderation_events"("review_id", "created_at");

-- CreateIndex
CREATE INDEX "review_appeals_review_id_status_idx" ON "review_appeals"("review_id", "status");

-- CreateIndex
CREATE INDEX "review_appeals_appellant_id_created_at_idx" ON "review_appeals"("appellant_id", "created_at");

-- CreateIndex
CREATE INDEX "loyalty_rules_business_id_active_valid_from_idx" ON "loyalty_rules"("business_id", "active", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_rules_business_id_branch_id_version_key" ON "loyalty_rules"("business_id", "branch_id", "version");

-- CreateIndex
CREATE INDEX "loyalty_accounts_customer_id_updated_at_idx" ON "loyalty_accounts"("customer_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_accounts_business_id_customer_id_key" ON "loyalty_accounts"("business_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_transactions_idempotency_key_key" ON "loyalty_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "loyalty_transactions_account_id_created_at_idx" ON "loyalty_transactions"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "loyalty_transactions_business_id_customer_id_created_at_idx" ON "loyalty_transactions"("business_id", "customer_id", "created_at");

-- CreateIndex
CREATE INDEX "loyalty_transactions_expires_at_type_idx" ON "loyalty_transactions"("expires_at", "type");

-- CreateIndex
CREATE INDEX "invoices_branch_id_status_created_at_idx" ON "invoices"("branch_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "invoices_booking_id_idx" ON "invoices"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_business_id_invoice_number_key" ON "invoices"("business_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_events_invoice_id_created_at_idx" ON "invoice_events"("invoice_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cash_shifts_open_key_key" ON "cash_shifts"("open_key");

-- CreateIndex
CREATE INDEX "cash_shifts_branch_id_status_opened_at_idx" ON "cash_shifts"("branch_id", "status", "opened_at");

-- CreateIndex
CREATE UNIQUE INDEX "cash_movements_idempotency_key_key" ON "cash_movements"("idempotency_key");

-- CreateIndex
CREATE INDEX "cash_movements_cash_shift_id_created_at_idx" ON "cash_movements"("cash_shift_id", "created_at");

-- CreateIndex
CREATE INDEX "cash_movements_branch_id_created_at_idx" ON "cash_movements"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "ownership_transfers_business_id_status_effective_at_idx" ON "ownership_transfers"("business_id", "status", "effective_at");

-- CreateIndex
CREATE INDEX "ownership_transfers_new_owner_user_id_status_idx" ON "ownership_transfers"("new_owner_user_id", "status");

-- CreateIndex
CREATE INDEX "ownership_history_business_id_valid_from_idx" ON "ownership_history"("business_id", "valid_from");

-- CreateIndex
CREATE INDEX "legal_entity_versions_business_id_valid_from_idx" ON "legal_entity_versions"("business_id", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "legal_entity_versions_business_id_version_key" ON "legal_entity_versions"("business_id", "version");

-- CreateIndex
CREATE INDEX "payout_account_versions_business_id_valid_from_idx" ON "payout_account_versions"("business_id", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "payout_account_versions_business_id_version_key" ON "payout_account_versions"("business_id", "version");

-- CreateIndex
CREATE INDEX "customer_saved_services_customer_id_created_at_idx" ON "customer_saved_services"("customer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_saved_services_customer_id_branch_service_offering_key" ON "customer_saved_services"("customer_id", "branch_service_offering_id");

-- CreateIndex
CREATE INDEX "voucher_branch_scopes_branch_id_idx" ON "voucher_branch_scopes"("branch_id");

-- CreateIndex
CREATE INDEX "voucher_service_scopes_service_id_idx" ON "voucher_service_scopes"("service_id");

-- CreateIndex
CREATE INDEX "voucher_combo_scopes_combo_id_idx" ON "voucher_combo_scopes"("combo_id");

-- CreateIndex
CREATE INDEX "customer_business_segments_business_id_segment_idx" ON "customer_business_segments"("business_id", "segment");

-- CreateIndex
CREATE UNIQUE INDEX "customer_business_segments_business_id_customer_id_segment_key" ON "customer_business_segments"("business_id", "customer_id", "segment");

-- AddForeignKey
ALTER TABLE "customer_saved_services" ADD CONSTRAINT "customer_saved_services_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_saved_services" ADD CONSTRAINT "customer_saved_services_branch_service_offering_id_fkey" FOREIGN KEY ("branch_service_offering_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Complete controlled overbooking and invoice/ownership workflows added after
-- the initial migration draft. All columns are additive and preserve legacy rows.
CREATE TYPE "InvoiceRequestStatus" AS ENUM ('PENDING', 'FULFILLED', 'REJECTED', 'CANCELLED');

ALTER TABLE "branch_booking_policies"
ADD COLUMN "max_overbooked_slots" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "overbooking_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "vouchers" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "overbooking_overrides" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "policy_limit" INTEGER NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "overbooking_overrides_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "invoices" ADD COLUMN "replaces_invoice_id" TEXT;

CREATE TABLE "invoice_information_requests" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "status" "InvoiceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "buyer_snapshot" JSONB NOT NULL,
    "customer_note" TEXT,
    "resolution_note" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "open_key" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invoice_information_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ownership_transfers"
ADD COLUMN "legal_entity_version_id" TEXT,
ADD COLUMN "payout_account_version_id" TEXT;

ALTER TABLE "legal_entity_versions" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payout_account_versions" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "overbooking_overrides_booking_id_key" ON "overbooking_overrides"("booking_id");
CREATE INDEX "overbooking_overrides_branch_id_start_at_end_at_idx" ON "overbooking_overrides"("branch_id", "start_at", "end_at");
CREATE UNIQUE INDEX "invoices_replaces_invoice_id_key" ON "invoices"("replaces_invoice_id");
CREATE UNIQUE INDEX "invoice_information_requests_invoice_id_key" ON "invoice_information_requests"("invoice_id");
CREATE UNIQUE INDEX "invoice_information_requests_open_key_key" ON "invoice_information_requests"("open_key");
CREATE UNIQUE INDEX "invoice_information_requests_idempotency_key_key" ON "invoice_information_requests"("idempotency_key");
CREATE INDEX "invoice_information_requests_customer_id_created_at_idx" ON "invoice_information_requests"("customer_id", "created_at");
CREATE INDEX "invoice_information_requests_business_id_status_created_at_idx" ON "invoice_information_requests"("business_id", "status", "created_at");
CREATE INDEX "invoice_information_requests_branch_id_status_created_at_idx" ON "invoice_information_requests"("branch_id", "status", "created_at");

ALTER TABLE "overbooking_overrides" ADD CONSTRAINT "overbooking_overrides_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_replaces_invoice_id_fkey" FOREIGN KEY ("replaces_invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_information_requests" ADD CONSTRAINT "invoice_information_requests_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_information_requests" ADD CONSTRAINT "invoice_information_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_information_requests" ADD CONSTRAINT "invoice_information_requests_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_information_requests" ADD CONSTRAINT "invoice_information_requests_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_information_requests" ADD CONSTRAINT "invoice_information_requests_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "voucher_branch_scopes" ADD CONSTRAINT "voucher_branch_scopes_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "voucher_branch_scopes" ADD CONSTRAINT "voucher_branch_scopes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "voucher_service_scopes" ADD CONSTRAINT "voucher_service_scopes_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "voucher_service_scopes" ADD CONSTRAINT "voucher_service_scopes_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "voucher_combo_scopes" ADD CONSTRAINT "voucher_combo_scopes_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "voucher_combo_scopes" ADD CONSTRAINT "voucher_combo_scopes_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
