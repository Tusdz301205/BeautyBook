ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MOCK_ONLINE';
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'REFUNDED', 'FAILED');
CREATE TABLE "refund_requests" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" JSONB,
  "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "requested_by" TEXT NOT NULL,
  "reviewed_by" TEXT,
  "review_note" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "refund_requests_payment_id_status_idx" ON "refund_requests"("payment_id", "status");
CREATE INDEX "refund_requests_requested_by_idx" ON "refund_requests"("requested_by");
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
