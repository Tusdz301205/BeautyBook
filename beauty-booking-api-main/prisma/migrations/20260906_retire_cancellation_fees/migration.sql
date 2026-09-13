-- Cancellation/no-show fees are retired from the active product workflow.
-- Keep the columns for backwards-compatible reads of historical policy rows,
-- but make new policies fee-free and clear legacy configuration values.
UPDATE "cancellation_policies"
SET "late_cancel_fee_percent" = 0,
    "no_show_fee_percent" = 0;

ALTER TABLE "cancellation_policies"
  ALTER COLUMN "late_cancel_fee_percent" SET DEFAULT 0,
  ALTER COLUMN "no_show_fee_percent" SET DEFAULT 0;
