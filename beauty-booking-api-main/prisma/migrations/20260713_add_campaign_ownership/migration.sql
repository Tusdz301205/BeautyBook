CREATE TYPE "VoucherScope" AS ENUM ('PLATFORM', 'TENANT', 'CUSTOMER', 'COMPENSATION', 'CAMPAIGN');
ALTER TABLE "promotions" ADD COLUMN "business_id" TEXT, ADD COLUMN "created_by_platform" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "vouchers" ADD COLUMN "business_id" TEXT, ADD COLUMN "scope" "VoucherScope" NOT NULL DEFAULT 'TENANT', ADD COLUMN "created_by_platform" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "promotions_business_id_idx" ON "promotions"("business_id");
CREATE INDEX "vouchers_business_id_scope_idx" ON "vouchers"("business_id", "scope");
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
