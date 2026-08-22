-- CreateEnum
CREATE TYPE "ConsentScope" AS ENUM ('SKIN_CONDITION', 'ALLERGY', 'MEDICATION', 'PREGNANCY', 'GENERAL_HEALTH');

-- CreateEnum
CREATE TYPE "SensitiveDataField" AS ENUM ('SKIN_CONDITION', 'ALLERGY', 'MEDICATION', 'PREGNANCY', 'GENERAL_HEALTH', 'OTHER');

-- CreateTable
CREATE TABLE "sensitive_consents" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "scope" "ConsentScope" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "policy_version" TEXT NOT NULL DEFAULT 'pdpa-vn-91/2025',
    "ip" TEXT,

    CONSTRAINT "sensitive_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_health_records" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "consent_id" TEXT NOT NULL,
    "field" "SensitiveDataField" NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_accessed_at" TIMESTAMP(3),
    "last_accessed_by" TEXT,

    CONSTRAINT "booking_health_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sensitive_consents_customer_id_scope_key" ON "sensitive_consents"("customer_id", "scope");

-- CreateIndex
CREATE INDEX "sensitive_consents_customer_id_idx" ON "sensitive_consents"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_health_records_booking_id_field_key" ON "booking_health_records"("booking_id", "field");

-- CreateIndex
CREATE INDEX "booking_health_records_customer_id_idx" ON "booking_health_records"("customer_id");

-- CreateIndex
CREATE INDEX "booking_health_records_consent_id_idx" ON "booking_health_records"("consent_id");

-- AddForeignKey
ALTER TABLE "sensitive_consents" ADD CONSTRAINT "sensitive_consents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_health_records" ADD CONSTRAINT "booking_health_records_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_health_records" ADD CONSTRAINT "booking_health_records_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "sensitive_consents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_health_records" ADD CONSTRAINT "booking_health_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
