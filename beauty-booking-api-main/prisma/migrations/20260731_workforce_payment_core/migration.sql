-- CreateEnum
CREATE TYPE "ScheduleSegmentType" AS ENUM ('SHIFT', 'BREAK');

-- CreateEnum
CREATE TYPE "StaffAvailabilityStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PolicyVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DepositType" AS ENUM ('NONE', 'FIXED', 'PERCENTAGE', 'FULL_PREPAYMENT');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('CREATED', 'PENDING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "FinancialLedgerType" AS ENUM ('SERVICE_CHARGE', 'PACKAGE_CHARGE', 'PROMOTION', 'VOUCHER', 'PAYMENT_RECEIVED', 'REFUND', 'REVERSAL', 'ADJUSTMENT', 'PLATFORM_FEE', 'PLATFORM_FEE_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "PlatformFeeStatus" AS ENUM ('ACCRUED', 'STATEMENTED', 'ADJUSTED');

-- CreateEnum
CREATE TYPE "PlatformStatementStatus" AS ENUM ('DRAFT', 'REVIEW', 'ISSUED', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "StatementLineType" AS ENUM ('FEE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TreatmentPackageStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PackagePurchaseStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PackageInstallmentStatus" AS ENUM ('DUE', 'PENDING', 'PAID', 'FAILED', 'WAIVED');

-- CreateEnum
CREATE TYPE "PackageEntitlementStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'REDEEMED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('RAW', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "TimesheetAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CompensationRuleType" AS ENUM ('HOURLY_WAGE', 'FIXED_COMPONENT', 'SERVICE_COMMISSION', 'PRODUCT_COMMISSION', 'BONUS', 'ALLOWANCE', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "CommissionCalculationBasis" AS ENUM ('APPROVED_PAID_TIME', 'SERVICE_AMOUNT', 'AFTER_DISCOUNT', 'AFTER_VOUCHER', 'AFTER_REFUND', 'FIXED');

-- CreateEnum
CREATE TYPE "CompensationEntryType" AS ENUM ('HOURLY_WAGE', 'FIXED_COMPONENT', 'SERVICE_COMMISSION', 'PRODUCT_COMMISSION', 'BONUS', 'ALLOWANCE', 'ADJUSTMENT', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "CompensationEntryStatus" AS ENUM ('EARNED', 'INCLUDED_IN_PAY_RUN', 'LOCKED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PayRunStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'LOCKED', 'EXPORTED', 'MARKED_PAID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttendanceEventType" ADD VALUE 'BREAK_START';
ALTER TYPE "AttendanceEventType" ADD VALUE 'BREAK_END';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_PAID';

-- AlterEnum
ALTER TYPE "RoleCode" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "staff_schedule_segments" ADD COLUMN     "role_code" "RoleCode",
ADD COLUMN     "segment_type" "ScheduleSegmentType" NOT NULL DEFAULT 'SHIFT';

-- Preserve the exact published schedule/role segments used at clock-in.
ALTER TABLE "staff_attendances"
ADD COLUMN     "schedule_version_id" TEXT,
ADD COLUMN     "schedule_snapshot" JSONB;

CREATE INDEX "staff_attendances_schedule_version_id_idx" ON "staff_attendances"("schedule_version_id");

-- CreateTable
CREATE TABLE "pricing_snapshots" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "subtotal_amount" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "final_amount" DECIMAL(12,2) NOT NULL,
    "items" JSONB NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_policies" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "service_id" TEXT,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PolicyVersionStatus" NOT NULL DEFAULT 'ACTIVE',
    "deposit_type" "DepositType" NOT NULL DEFAULT 'NONE',
    "deposit_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "allow_split_payment" BOOLEAN NOT NULL DEFAULT true,
    "allow_installments" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_policy_snapshots" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "payment_policy_id" TEXT,
    "policy_version" INTEGER,
    "deposit_type" "DepositType" NOT NULL DEFAULT 'NONE',
    "deposit_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "required_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "allow_split_payment" BOOLEAN NOT NULL DEFAULT true,
    "allow_installments" BOOLEAN NOT NULL DEFAULT false,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_policy_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT,
    "package_purchase_id" TEXT,
    "package_installment_id" TEXT,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "method" "PaymentMethod" NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'CREATED',
    "idempotency_key" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "intent_id" TEXT,
    "payment_id" TEXT,
    "booking_id" TEXT,
    "package_purchase_id" TEXT,
    "package_installment_id" TEXT,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "method" "PaymentMethod" NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_ref" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "provider_event_id" TEXT,
    "evidence" JSONB,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "reversal_of_id" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_ledger_entries" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "payment_id" TEXT,
    "payment_transaction_id" TEXT,
    "refund_id" TEXT,
    "type" "FinancialLedgerType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "actor_id" TEXT,
    "correlation_id" TEXT,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_allocations" (
    "id" TEXT NOT NULL,
    "refund_id" TEXT NOT NULL,
    "booking_service_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_fee_entries" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "base_amount" DECIMAL(12,2) NOT NULL,
    "fee_rate" DECIMAL(7,4) NOT NULL,
    "fee_amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" "PlatformFeeStatus" NOT NULL DEFAULT 'ACCRUED',
    "calculation_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_fee_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_fee_adjustments" (
    "id" TEXT NOT NULL,
    "platform_fee_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "refund_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_fee_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_statements" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "PlatformStatementStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "gross_fee_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "adjustment_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "issued_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_statement_lines" (
    "id" TEXT NOT NULL,
    "statement_id" TEXT NOT NULL,
    "platform_fee_id" TEXT,
    "fee_adjustment_id" TEXT,
    "line_type" "StatementLineType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "source_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_packages" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "total_price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "session_count" INTEGER NOT NULL,
    "validity_days" INTEGER NOT NULL DEFAULT 365,
    "status" "TreatmentPackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_purchases" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" "PackagePurchaseStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "pricing_snapshot" JSONB NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_installments" (
    "id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PackageInstallmentStatus" NOT NULL DEFAULT 'DUE',
    "payment_intent_id" TEXT,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "package_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_session_entitlements" (
    "id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "PackageEntitlementStatus" NOT NULL DEFAULT 'AVAILABLE',
    "booking_id" TEXT,
    "redeemed_booking_service_id" TEXT,
    "reserved_at" TIMESTAMP(3),
    "redeemed_at" TIMESTAMP(3),

    CONSTRAINT "package_session_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_availabilities" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "StaffAvailabilityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheets" (
    "id" TEXT NOT NULL,
    "attendance_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "scheduled_minutes" INTEGER NOT NULL DEFAULT 0,
    "actual_worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "approved_paid_minutes" INTEGER,
    "approved_breakdown" JSONB,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'RAW',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_adjustments" (
    "id" TEXT NOT NULL,
    "timesheet_id" TEXT NOT NULL,
    "proposed_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "old_data" JSONB NOT NULL,
    "new_data" JSONB NOT NULL,
    "status" "TimesheetAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheet_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_rules" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "type" "CompensationRuleType" NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PolicyVersionStatus" NOT NULL DEFAULT 'ACTIVE',
    "calculation_basis" "CommissionCalculationBasis" NOT NULL DEFAULT 'APPROVED_PAID_TIME',
    "rate" DECIMAL(12,4),
    "fixed_amount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_assignments" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "role_code" "RoleCode",
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_entries" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "timesheet_id" TEXT,
    "booking_service_id" TEXT,
    "rule_id" TEXT,
    "pay_run_item_id" TEXT,
    "original_entry_id" TEXT,
    "type" "CompensationEntryType" NOT NULL,
    "status" "CompensationEntryStatus" NOT NULL DEFAULT 'EARNED',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "calculation_basis" TEXT NOT NULL,
    "calculation_snapshot" JSONB NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_adjustments" (
    "id" TEXT NOT NULL,
    "original_entry_id" TEXT NOT NULL,
    "resulting_entry_id" TEXT NOT NULL,
    "refund_id" TEXT,
    "reason" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_runs" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "PayRunStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "gross_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "adjustment_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deduction_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "marked_paid_at" TIMESTAMP(3),
    "marked_paid_by" TEXT,
    "export_reference" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_run_items" (
    "id" TEXT NOT NULL,
    "pay_run_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "timesheet_id" TEXT,
    "gross_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "adjustment_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deduction_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "PayRunStatus" NOT NULL DEFAULT 'DRAFT',
    "external_reference" TEXT,

    CONSTRAINT "pay_run_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pricing_snapshots_booking_id_key" ON "pricing_snapshots"("booking_id");

-- CreateIndex
CREATE INDEX "pricing_snapshots_business_id_captured_at_idx" ON "pricing_snapshots"("business_id", "captured_at");

-- CreateIndex
CREATE INDEX "pricing_snapshots_branch_id_captured_at_idx" ON "pricing_snapshots"("branch_id", "captured_at");

-- CreateIndex
CREATE INDEX "payment_policies_business_id_status_effective_from_effectiv_idx" ON "payment_policies"("business_id", "status", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "payment_policies_branch_id_status_idx" ON "payment_policies"("branch_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_policies_business_id_branch_id_service_id_version_key" ON "payment_policies"("business_id", "branch_id", "service_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "payment_policy_snapshots_booking_id_key" ON "payment_policy_snapshots"("booking_id");

-- CreateIndex
CREATE INDEX "payment_policy_snapshots_business_id_captured_at_idx" ON "payment_policy_snapshots"("business_id", "captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_idempotency_key_key" ON "payment_intents"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_intents_booking_id_status_idx" ON "payment_intents"("booking_id", "status");

-- CreateIndex
CREATE INDEX "payment_intents_package_purchase_id_status_idx" ON "payment_intents"("package_purchase_id", "status");

-- CreateIndex
CREATE INDEX "payment_intents_business_id_created_at_idx" ON "payment_intents"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_intents_branch_id_created_at_idx" ON "payment_intents"("branch_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_idempotency_key_key" ON "payment_transactions"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_provider_event_id_key" ON "payment_transactions"("provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_reversal_of_id_key" ON "payment_transactions"("reversal_of_id");

-- CreateIndex
CREATE INDEX "payment_transactions_booking_id_status_idx" ON "payment_transactions"("booking_id", "status");

-- CreateIndex
CREATE INDEX "payment_transactions_package_purchase_id_status_idx" ON "payment_transactions"("package_purchase_id", "status");

-- CreateIndex
CREATE INDEX "payment_transactions_business_id_created_at_idx" ON "payment_transactions"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_transactions_branch_id_created_at_idx" ON "payment_transactions"("branch_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_ledger_entries_idempotency_key_key" ON "financial_ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "financial_ledger_entries_business_id_occurred_at_idx" ON "financial_ledger_entries"("business_id", "occurred_at");

-- CreateIndex
CREATE INDEX "financial_ledger_entries_branch_id_occurred_at_idx" ON "financial_ledger_entries"("branch_id", "occurred_at");

-- CreateIndex
CREATE INDEX "financial_ledger_entries_booking_id_occurred_at_idx" ON "financial_ledger_entries"("booking_id", "occurred_at");

-- CreateIndex
CREATE INDEX "financial_ledger_entries_source_type_source_id_idx" ON "financial_ledger_entries"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "refund_allocations_refund_id_idx" ON "refund_allocations"("refund_id");

-- CreateIndex
CREATE INDEX "refund_allocations_booking_service_id_idx" ON "refund_allocations"("booking_service_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_fee_entries_booking_id_key" ON "platform_fee_entries"("booking_id");

-- CreateIndex
CREATE INDEX "platform_fee_entries_business_id_created_at_idx" ON "platform_fee_entries"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_fee_entries_branch_id_created_at_idx" ON "platform_fee_entries"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_fee_adjustments_platform_fee_id_created_at_idx" ON "platform_fee_adjustments"("platform_fee_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_fee_adjustments_business_id_created_at_idx" ON "platform_fee_adjustments"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_statements_business_id_status_period_start_idx" ON "platform_statements"("business_id", "status", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "platform_statements_business_id_period_start_period_end_ver_key" ON "platform_statements"("business_id", "period_start", "period_end", "version");

-- CreateIndex
CREATE INDEX "platform_statement_lines_statement_id_idx" ON "platform_statement_lines"("statement_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_statement_lines_statement_id_platform_fee_id_fee_a_key" ON "platform_statement_lines"("statement_id", "platform_fee_id", "fee_adjustment_id");

-- CreateIndex
CREATE INDEX "treatment_packages_business_id_status_idx" ON "treatment_packages"("business_id", "status");

-- CreateIndex
CREATE INDEX "treatment_packages_branch_id_status_idx" ON "treatment_packages"("branch_id", "status");

-- CreateIndex
CREATE INDEX "package_purchases_customer_id_status_idx" ON "package_purchases"("customer_id", "status");

-- CreateIndex
CREATE INDEX "package_purchases_business_id_status_idx" ON "package_purchases"("business_id", "status");

-- CreateIndex
CREATE INDEX "package_installments_status_due_at_idx" ON "package_installments"("status", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "package_installments_purchase_id_sequence_key" ON "package_installments"("purchase_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "package_session_entitlements_redeemed_booking_service_id_key" ON "package_session_entitlements"("redeemed_booking_service_id");

-- CreateIndex
CREATE INDEX "package_session_entitlements_purchase_id_status_idx" ON "package_session_entitlements"("purchase_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "package_session_entitlements_purchase_id_sequence_key" ON "package_session_entitlements"("purchase_id", "sequence");

-- CreateIndex
CREATE INDEX "staff_availabilities_staff_id_branch_id_day_of_week_effecti_idx" ON "staff_availabilities"("staff_id", "branch_id", "day_of_week", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "staff_availabilities_business_id_status_idx" ON "staff_availabilities"("business_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "timesheets_attendance_id_key" ON "timesheets"("attendance_id");

-- CreateIndex
CREATE INDEX "timesheets_business_id_work_date_status_idx" ON "timesheets"("business_id", "work_date", "status");

-- CreateIndex
CREATE INDEX "timesheets_branch_id_work_date_status_idx" ON "timesheets"("branch_id", "work_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "timesheets_staff_id_branch_id_work_date_key" ON "timesheets"("staff_id", "branch_id", "work_date");

-- CreateIndex
CREATE INDEX "timesheet_adjustments_timesheet_id_status_created_at_idx" ON "timesheet_adjustments"("timesheet_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "compensation_rules_business_id_type_status_effective_from_e_idx" ON "compensation_rules"("business_id", "type", "status", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "compensation_rules_business_id_branch_id_name_version_key" ON "compensation_rules"("business_id", "branch_id", "name", "version");

-- CreateIndex
CREATE INDEX "compensation_assignments_staff_id_branch_id_effective_from__idx" ON "compensation_assignments"("staff_id", "branch_id", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "compensation_assignments_rule_id_staff_id_branch_id_role_co_key" ON "compensation_assignments"("rule_id", "staff_id", "branch_id", "role_code", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "compensation_entries_dedupe_key_key" ON "compensation_entries"("dedupe_key");

-- CreateIndex
CREATE INDEX "compensation_entries_staff_id_earned_at_status_idx" ON "compensation_entries"("staff_id", "earned_at", "status");

-- CreateIndex
CREATE INDEX "compensation_entries_business_id_earned_at_type_idx" ON "compensation_entries"("business_id", "earned_at", "type");

-- CreateIndex
CREATE INDEX "compensation_entries_branch_id_earned_at_idx" ON "compensation_entries"("branch_id", "earned_at");

-- CreateIndex
CREATE INDEX "compensation_entries_source_type_source_id_idx" ON "compensation_entries"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "compensation_adjustments_resulting_entry_id_key" ON "compensation_adjustments"("resulting_entry_id");

-- CreateIndex
CREATE INDEX "compensation_adjustments_original_entry_id_created_at_idx" ON "compensation_adjustments"("original_entry_id", "created_at");

-- CreateIndex
CREATE INDEX "pay_runs_business_id_status_period_start_idx" ON "pay_runs"("business_id", "status", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "pay_runs_business_id_period_start_period_end_key" ON "pay_runs"("business_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "pay_run_items_staff_id_status_idx" ON "pay_run_items"("staff_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pay_run_items_pay_run_id_staff_id_key" ON "pay_run_items"("pay_run_id", "staff_id");

-- AddForeignKey
ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_policies" ADD CONSTRAINT "payment_policies_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_policies" ADD CONSTRAINT "payment_policies_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_policies" ADD CONSTRAINT "payment_policies_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_policy_snapshots" ADD CONSTRAINT "payment_policy_snapshots_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_policy_snapshots" ADD CONSTRAINT "payment_policy_snapshots_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_policy_snapshots" ADD CONSTRAINT "payment_policy_snapshots_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_policy_snapshots" ADD CONSTRAINT "payment_policy_snapshots_payment_policy_id_fkey" FOREIGN KEY ("payment_policy_id") REFERENCES "payment_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_package_purchase_id_fkey" FOREIGN KEY ("package_purchase_id") REFERENCES "package_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_package_installment_id_fkey" FOREIGN KEY ("package_installment_id") REFERENCES "package_installments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "payment_intents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_package_purchase_id_fkey" FOREIGN KEY ("package_purchase_id") REFERENCES "package_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_package_installment_id_fkey" FOREIGN KEY ("package_installment_id") REFERENCES "package_installments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "payment_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refund_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_allocations" ADD CONSTRAINT "refund_allocations_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refund_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_allocations" ADD CONSTRAINT "refund_allocations_booking_service_id_fkey" FOREIGN KEY ("booking_service_id") REFERENCES "booking_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_fee_entries" ADD CONSTRAINT "platform_fee_entries_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_fee_entries" ADD CONSTRAINT "platform_fee_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_fee_entries" ADD CONSTRAINT "platform_fee_entries_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_fee_adjustments" ADD CONSTRAINT "platform_fee_adjustments_platform_fee_id_fkey" FOREIGN KEY ("platform_fee_id") REFERENCES "platform_fee_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_fee_adjustments" ADD CONSTRAINT "platform_fee_adjustments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_fee_adjustments" ADD CONSTRAINT "platform_fee_adjustments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_fee_adjustments" ADD CONSTRAINT "platform_fee_adjustments_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refund_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_statements" ADD CONSTRAINT "platform_statements_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_statement_lines" ADD CONSTRAINT "platform_statement_lines_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "platform_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_statement_lines" ADD CONSTRAINT "platform_statement_lines_platform_fee_id_fkey" FOREIGN KEY ("platform_fee_id") REFERENCES "platform_fee_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_statement_lines" ADD CONSTRAINT "platform_statement_lines_fee_adjustment_id_fkey" FOREIGN KEY ("fee_adjustment_id") REFERENCES "platform_fee_adjustments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_packages" ADD CONSTRAINT "treatment_packages_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_packages" ADD CONSTRAINT "treatment_packages_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_purchases" ADD CONSTRAINT "package_purchases_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "treatment_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_purchases" ADD CONSTRAINT "package_purchases_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_purchases" ADD CONSTRAINT "package_purchases_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_purchases" ADD CONSTRAINT "package_purchases_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_installments" ADD CONSTRAINT "package_installments_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "package_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_session_entitlements" ADD CONSTRAINT "package_session_entitlements_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "package_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_session_entitlements" ADD CONSTRAINT "package_session_entitlements_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_session_entitlements" ADD CONSTRAINT "package_session_entitlements_redeemed_booking_service_id_fkey" FOREIGN KEY ("redeemed_booking_service_id") REFERENCES "booking_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_availabilities" ADD CONSTRAINT "staff_availabilities_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_availabilities" ADD CONSTRAINT "staff_availabilities_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_availabilities" ADD CONSTRAINT "staff_availabilities_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "staff_attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staff_attendances" ADD CONSTRAINT "staff_attendances_schedule_version_id_fkey" FOREIGN KEY ("schedule_version_id") REFERENCES "staff_schedule_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_adjustments" ADD CONSTRAINT "timesheet_adjustments_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_rules" ADD CONSTRAINT "compensation_rules_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_rules" ADD CONSTRAINT "compensation_rules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_assignments" ADD CONSTRAINT "compensation_assignments_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "compensation_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_assignments" ADD CONSTRAINT "compensation_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_assignments" ADD CONSTRAINT "compensation_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_entries" ADD CONSTRAINT "compensation_entries_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_entries" ADD CONSTRAINT "compensation_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_entries" ADD CONSTRAINT "compensation_entries_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_entries" ADD CONSTRAINT "compensation_entries_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_entries" ADD CONSTRAINT "compensation_entries_booking_service_id_fkey" FOREIGN KEY ("booking_service_id") REFERENCES "booking_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_entries" ADD CONSTRAINT "compensation_entries_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "compensation_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_entries" ADD CONSTRAINT "compensation_entries_pay_run_item_id_fkey" FOREIGN KEY ("pay_run_item_id") REFERENCES "pay_run_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_entries" ADD CONSTRAINT "compensation_entries_original_entry_id_fkey" FOREIGN KEY ("original_entry_id") REFERENCES "compensation_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_adjustments" ADD CONSTRAINT "compensation_adjustments_original_entry_id_fkey" FOREIGN KEY ("original_entry_id") REFERENCES "compensation_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_adjustments" ADD CONSTRAINT "compensation_adjustments_resulting_entry_id_fkey" FOREIGN KEY ("resulting_entry_id") REFERENCES "compensation_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_adjustments" ADD CONSTRAINT "compensation_adjustments_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refund_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_run_items" ADD CONSTRAINT "pay_run_items_pay_run_id_fkey" FOREIGN KEY ("pay_run_id") REFERENCES "pay_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_run_items" ADD CONSTRAINT "pay_run_items_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_run_items" ADD CONSTRAINT "pay_run_items_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Controlled backfill. Existing rows are retained; no source table is reset.
-- ---------------------------------------------------------------------------

INSERT INTO "pricing_snapshots" (
  "id", "booking_id", "business_id", "branch_id", "currency",
  "subtotal_amount", "discount_amount", "final_amount", "items", "captured_at"
)
SELECT
  gen_random_uuid()::text,
  b."id",
  br."business_id",
  b."branch_id",
  'VND',
  b."total_amount",
  GREATEST(0, b."total_amount" - COALESCE(b."final_amount", b."total_amount")),
  COALESCE(b."final_amount", b."total_amount"),
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'bookingServiceId', bs."id",
      'serviceId', bs."service_id",
      'name', COALESCE(bs."service_name_snapshot", s."name"),
      'price', bs."price_at_booking",
      'durationMinutes', bs."duration_minutes",
      'comboId', bs."combo_id"
    ) ORDER BY bs."sort_order", bs."id")
    FROM "booking_services" bs
    JOIN "services" s ON s."id" = bs."service_id"
    WHERE bs."booking_id" = b."id"
  ), '[]'::jsonb),
  b."created_at"
FROM "bookings" b
JOIN "branches" br ON br."id" = b."branch_id"
ON CONFLICT ("booking_id") DO NOTHING;

INSERT INTO "payment_policy_snapshots" (
  "id", "booking_id", "business_id", "branch_id", "payment_policy_id",
  "policy_version", "deposit_type", "deposit_value", "required_amount",
  "allow_split_payment", "allow_installments", "captured_at"
)
SELECT
  gen_random_uuid()::text,
  b."id",
  br."business_id",
  b."branch_id",
  NULL,
  NULL,
  'NONE'::"DepositType",
  0,
  0,
  true,
  false,
  b."created_at"
FROM "bookings" b
JOIN "branches" br ON br."id" = b."branch_id"
ON CONFLICT ("booking_id") DO NOTHING;

INSERT INTO "payment_intents" (
  "id", "booking_id", "business_id", "branch_id", "amount", "currency",
  "method", "provider", "status", "idempotency_key", "created_by",
  "created_at", "updated_at"
)
SELECT
  'legacy-intent-' || p."id",
  p."booking_id",
  br."business_id",
  b."branch_id",
  p."amount",
  'VND',
  p."method",
  CASE
    WHEN p."method" = 'CASH' THEN 'CASH_INTERNAL'
    WHEN p."method" = 'BANK_TRANSFER' THEN 'MANUAL_BANK_TRANSFER'
    ELSE 'LEGACY_IMPORT'
  END,
  CASE
    WHEN p."status" IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED') THEN 'SUCCEEDED'::"PaymentIntentStatus"
    WHEN p."status" = 'FAILED' THEN 'FAILED'::"PaymentIntentStatus"
    ELSE 'PENDING'::"PaymentIntentStatus"
  END,
  'LEGACY:PAYMENT:' || p."id",
  COALESCE(b."cancelled_by", cp."user_id"),
  p."created_at",
  p."updated_at"
FROM "payments" p
JOIN "bookings" b ON b."id" = p."booking_id"
JOIN "branches" br ON br."id" = b."branch_id"
JOIN "customer_profiles" cp ON cp."id" = b."customer_id"
ON CONFLICT ("idempotency_key") DO NOTHING;

INSERT INTO "payment_transactions" (
  "id", "intent_id", "payment_id", "booking_id", "business_id", "branch_id",
  "amount", "currency", "method", "provider", "status", "transaction_ref",
  "idempotency_key", "verified_at", "created_at"
)
SELECT
  'legacy-transaction-' || p."id",
  'legacy-intent-' || p."id",
  p."id",
  p."booking_id",
  br."business_id",
  b."branch_id",
  p."amount",
  'VND',
  p."method",
  CASE
    WHEN p."method" = 'CASH' THEN 'CASH_INTERNAL'
    WHEN p."method" = 'BANK_TRANSFER' THEN 'MANUAL_BANK_TRANSFER'
    ELSE 'LEGACY_IMPORT'
  END,
  CASE
    WHEN p."status" IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED') THEN 'VERIFIED'::"PaymentTransactionStatus"
    WHEN p."status" = 'FAILED' THEN 'FAILED'::"PaymentTransactionStatus"
    ELSE 'PENDING'::"PaymentTransactionStatus"
  END,
  p."transaction_ref",
  'LEGACY:TX:' || p."id",
  CASE WHEN p."status" IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')
    THEN COALESCE(p."paid_at", p."updated_at") ELSE NULL END,
  p."created_at"
FROM "payments" p
JOIN "bookings" b ON b."id" = p."booking_id"
JOIN "branches" br ON br."id" = b."branch_id"
ON CONFLICT ("idempotency_key") DO NOTHING;

INSERT INTO "financial_ledger_entries" (
  "id", "business_id", "branch_id", "booking_id", "payment_id",
  "payment_transaction_id", "type", "direction", "amount", "currency",
  "source_type", "source_id", "idempotency_key", "occurred_at"
)
SELECT
  gen_random_uuid()::text,
  pt."business_id",
  pt."branch_id",
  pt."booking_id",
  pt."payment_id",
  pt."id",
  'PAYMENT_RECEIVED'::"FinancialLedgerType",
  'CREDIT'::"LedgerDirection",
  pt."amount",
  pt."currency",
  'LEGACY_PAYMENT',
  pt."payment_id",
  'LEDGER:PAYMENT:' || pt."id",
  COALESCE(pt."verified_at", pt."created_at")
FROM "payment_transactions" pt
WHERE pt."status" = 'VERIFIED'
ON CONFLICT ("idempotency_key") DO NOTHING;

INSERT INTO "financial_ledger_entries" (
  "id", "business_id", "branch_id", "booking_id", "payment_id", "refund_id",
  "type", "direction", "amount", "currency", "source_type", "source_id",
  "idempotency_key", "occurred_at"
)
SELECT
  gen_random_uuid()::text,
  br."business_id",
  b."branch_id",
  p."booking_id",
  p."id",
  rr."id",
  'REFUND'::"FinancialLedgerType",
  'DEBIT'::"LedgerDirection",
  rr."amount",
  'VND',
  'LEGACY_REFUND',
  rr."id",
  'LEDGER:REFUND:' || rr."id",
  COALESCE(rr."processed_at", rr."updated_at")
FROM "refund_requests" rr
JOIN "payments" p ON p."id" = rr."payment_id"
JOIN "bookings" b ON b."id" = p."booking_id"
JOIN "branches" br ON br."id" = b."branch_id"
WHERE rr."status" = 'REFUNDED'
ON CONFLICT ("idempotency_key") DO NOTHING;

INSERT INTO "timesheets" (
  "id", "attendance_id", "business_id", "branch_id", "staff_id", "work_date",
  "scheduled_minutes", "actual_worked_minutes", "break_minutes",
  "approved_paid_minutes", "status", "generated_at", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  sa."id",
  sa."business_id",
  sa."branch_id",
  sa."staff_id",
  sa."work_date",
  GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (
    sa."scheduled_end_time" - sa."scheduled_start_time"
  )) / 60))::integer,
  CASE
    WHEN sa."check_in_at" IS NOT NULL AND sa."check_out_at" IS NOT NULL
      THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (
        sa."check_out_at" - sa."check_in_at"
      )) / 60))::integer
    ELSE 0
  END,
  0,
  NULL,
  'RAW'::"TimesheetStatus",
  CURRENT_TIMESTAMP,
  sa."created_at",
  sa."updated_at"
FROM "staff_attendances" sa
ON CONFLICT ("attendance_id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Database-enforced append-only and locked-period invariants.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION beautybook_reject_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; post a reversal or adjustment instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER financial_ledger_entries_append_only
BEFORE UPDATE OR DELETE ON "financial_ledger_entries"
FOR EACH ROW EXECUTE FUNCTION beautybook_reject_mutation();

CREATE OR REPLACE FUNCTION beautybook_protect_verified_transaction()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" IN ('VERIFIED', 'REVERSED') THEN
    RAISE EXCEPTION 'Verified/reversed payment transactions are immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" IN ('VERIFIED', 'REVERSED') THEN
    RAISE EXCEPTION 'Verified/reversed payment transactions are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_transactions_immutable_after_verification
BEFORE UPDATE OR DELETE ON "payment_transactions"
FOR EACH ROW EXECUTE FUNCTION beautybook_protect_verified_transaction();

CREATE OR REPLACE FUNCTION beautybook_protect_locked_compensation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Compensation entries are append-only; post an adjustment instead';
  END IF;
  IF OLD."status" IN ('LOCKED', 'REVERSED') THEN
    RAISE EXCEPTION 'Locked/reversed compensation entries are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER compensation_entries_immutable_when_locked
BEFORE UPDATE OR DELETE ON "compensation_entries"
FOR EACH ROW EXECUTE FUNCTION beautybook_protect_locked_compensation();

CREATE OR REPLACE FUNCTION beautybook_protect_issued_statement()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" IN ('ISSUED', 'PAID', 'OVERDUE') THEN
    RAISE EXCEPTION 'Issued platform statements are immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" IN ('ISSUED', 'PAID', 'OVERDUE') THEN
    IF (to_jsonb(NEW) - ARRAY['status', 'paid_at', 'updated_at'])
       <> (to_jsonb(OLD) - ARRAY['status', 'paid_at', 'updated_at']) THEN
      RAISE EXCEPTION 'Issued platform statement financial data is immutable';
    END IF;
    IF NOT (
      (OLD."status" = 'ISSUED' AND NEW."status" IN ('PAID', 'OVERDUE')) OR
      (OLD."status" = 'OVERDUE' AND NEW."status" = 'PAID') OR
      OLD."status" = NEW."status"
    ) THEN
      RAISE EXCEPTION 'Invalid issued platform statement transition';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_statements_immutable_after_issue
BEFORE UPDATE OR DELETE ON "platform_statements"
FOR EACH ROW EXECUTE FUNCTION beautybook_protect_issued_statement();

-- ---------------------------------------------------------------------------
-- Permission catalog additions and role mappings.
-- ---------------------------------------------------------------------------

INSERT INTO "permissions" ("id", "code", "description", "resource", "action", "scope", "created_at")
VALUES
  (gen_random_uuid()::text, 'availability:read:self', 'Nhân viên xem availability của mình', 'availability', 'read', 'SELF', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'availability:read:branch', 'Quản lý xem availability trong chi nhánh', 'availability', 'read', 'BRANCH', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'availability:manage:self', 'Nhân viên quản lý availability của mình', 'availability', 'manage', 'SELF', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'availability:manage:branch', 'Quản lý quản lý availability trong chi nhánh', 'availability', 'manage', 'BRANCH', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'availability:manage:tenant', 'Chủ doanh nghiệp quản lý availability', 'availability', 'manage', 'TENANT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'timesheet:generate:branch', 'Tạo raw timesheet từ attendance trong chi nhánh', 'timesheet', 'generate', 'BRANCH', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'timesheet:generate:tenant', 'Tạo raw timesheet từ attendance trong doanh nghiệp', 'timesheet', 'generate', 'TENANT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'timesheet:read:self', 'Nhân viên xem bảng công của mình', 'timesheet', 'read', 'SELF', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'timesheet:read:branch', 'Quản lý xem bảng công chi nhánh', 'timesheet', 'read', 'BRANCH', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'timesheet:read:tenant', 'Chủ doanh nghiệp xem bảng công toàn doanh nghiệp', 'timesheet', 'read', 'TENANT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'timesheet:adjust:self', 'Nhân viên yêu cầu điều chỉnh bảng công', 'timesheet', 'adjust', 'SELF', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'timesheet:review:branch', 'Quản lý duyệt bảng công chi nhánh', 'timesheet', 'review', 'BRANCH', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'timesheet:review:tenant', 'Chủ doanh nghiệp duyệt bảng công', 'timesheet', 'review', 'TENANT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'compensation:read:self', 'Nhân viên xem thu nhập của mình', 'compensation', 'read', 'SELF', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'compensation:read:tenant', 'Chủ doanh nghiệp xem thu nhập nhân sự', 'compensation', 'read', 'TENANT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'compensation:manage:tenant', 'Chủ doanh nghiệp quản lý quy tắc thu nhập', 'compensation', 'manage', 'TENANT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'pay_run:read:self', 'Nhân viên xem kỳ thu nhập của mình', 'pay_run', 'read', 'SELF', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'pay_run:manage:tenant', 'Chủ doanh nghiệp quản lý kỳ thu nhập', 'pay_run', 'manage', 'TENANT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'payment_intent:create:self', 'Khách tạo payment intent cho booking của mình', 'payment_intent', 'create', 'SELF', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'payment_intent:create:branch', 'Lễ tân tạo payment intent tại chi nhánh', 'payment_intent', 'create', 'BRANCH', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'payment_intent:create:tenant', 'Chủ doanh nghiệp tạo payment intent', 'payment_intent', 'create', 'TENANT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'payment_transaction:verify:branch', 'Xác minh chuyển khoản thủ công tại chi nhánh', 'payment_transaction', 'verify', 'BRANCH', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'payment_transaction:verify:tenant', 'Xác minh chuyển khoản trong doanh nghiệp', 'payment_transaction', 'verify', 'TENANT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'payment_policy:manage:tenant', 'Quản lý chính sách cọc và trả trước', 'payment_policy', 'manage', 'TENANT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'financial_ledger:read:tenant', 'Xem ledger tài chính doanh nghiệp', 'financial_ledger', 'read', 'TENANT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'financial_ledger:read:platform', 'Xem ledger tài chính nền tảng', 'financial_ledger', 'read', 'PLATFORM', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'platform_statement:read:tenant', 'Xem đối soát phí nền tảng', 'platform_statement', 'read', 'TENANT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'platform_statement:manage:platform', 'Quản lý đối soát phí nền tảng', 'platform_statement', 'manage', 'PLATFORM', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'treatment_package:manage:tenant', 'Quản lý gói liệu trình', 'treatment_package', 'manage', 'TENANT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'package_purchase:create:self', 'Khách mua gói liệu trình cho mình', 'package_purchase', 'create', 'SELF', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'package_purchase:create:branch', 'Lễ tân bán gói tại chi nhánh', 'package_purchase', 'create', 'BRANCH', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'package_purchase:create:tenant', 'Chủ doanh nghiệp bán gói', 'package_purchase', 'create', 'TENANT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'package_purchase:read:self', 'Khách xem gói đã mua', 'package_purchase', 'read', 'SELF', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'package_purchase:read:tenant', 'Chủ doanh nghiệp xem giao dịch gói', 'package_purchase', 'read', 'TENANT', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'treatment_package:read:public', 'Xem danh mục gói liệu trình đang được bán', 'treatment_package', 'read', 'PUBLIC', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON (
  (r."code" = 'BUSINESS_OWNER' AND p."code" IN (
    'availability:read:branch', 'availability:manage:tenant',
    'timesheet:generate:tenant', 'timesheet:read:tenant', 'timesheet:review:tenant',
    'compensation:read:tenant', 'compensation:manage:tenant',
    'pay_run:manage:tenant', 'payment_intent:create:tenant',
    'payment_transaction:verify:tenant', 'payment_policy:manage:tenant',
    'financial_ledger:read:tenant', 'platform_statement:read:tenant',
    'treatment_package:manage:tenant', 'treatment_package:read:public',
    'package_purchase:create:tenant',
    'package_purchase:read:tenant'
  )) OR
  (r."code" = 'BRANCH_MANAGER' AND p."code" IN (
    'availability:read:branch', 'availability:manage:branch',
    'timesheet:generate:branch', 'timesheet:read:branch', 'timesheet:review:branch'
  )) OR
  (r."code" = 'RECEPTIONIST' AND p."code" IN (
    'payment_intent:create:branch', 'payment_transaction:verify:branch',
    'treatment_package:read:public', 'package_purchase:create:branch'
  )) OR
  (r."code" = 'STAFF' AND p."code" IN (
    'availability:read:self', 'availability:manage:self',
    'timesheet:read:self', 'timesheet:adjust:self',
    'compensation:read:self', 'pay_run:read:self'
  )) OR
  (r."code" = 'CUSTOMER' AND p."code" IN (
    'payment_intent:create:self', 'treatment_package:read:public',
    'package_purchase:create:self',
    'package_purchase:read:self'
  )) OR
  (r."code" = 'FINANCE' AND p."code" IN (
    'financial_ledger:read:platform', 'platform_statement:manage:platform'
  ))
)
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Manager is operational by default; finance remains an explicit future grant.
DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."role_id" = r."id"
  AND rp."permission_id" = p."id"
  AND r."code" = 'BRANCH_MANAGER'
  AND p."code" IN (
    'payment:read:branch', 'payment:create:branch',
    'report:revenue:branch', 'financial_ledger:read:tenant',
    'platform_statement:read:tenant'
  );
