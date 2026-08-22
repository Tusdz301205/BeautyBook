CREATE TABLE "business_services" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "base_price" DECIMAL(12,2) NOT NULL,
    "base_duration_minutes" INTEGER NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "business_services_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "services" ADD COLUMN "business_service_id" TEXT;

CREATE INDEX "business_services_business_id_status_deleted_at_idx"
  ON "business_services"("business_id", "status", "deleted_at");
CREATE INDEX "business_services_category_id_idx" ON "business_services"("category_id");
CREATE INDEX "services_business_service_id_idx" ON "services"("business_service_id");

-- Backfill one catalog definition per business/category/name. The original
-- branch service rows and every booking reference remain untouched.
INSERT INTO "business_services" (
  "id", "business_id", "category_id", "name", "description",
  "base_price", "base_duration_minutes", "status", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  b."business_id",
  s."category_id",
  MIN(s."name"),
  MAX(s."description"),
  MIN(s."price"),
  MIN(s."duration_minutes"),
  CASE WHEN BOOL_OR(s."status" = 'ACTIVE') THEN 'ACTIVE'::"ServiceStatus" ELSE 'INACTIVE'::"ServiceStatus" END,
  MIN(s."created_at"),
  MAX(s."updated_at")
FROM "services" s
JOIN "branches" b ON b."id" = s."branch_id"
WHERE s."deleted_at" IS NULL
GROUP BY b."business_id", s."category_id", LOWER(TRIM(s."name"));

UPDATE "services" s
SET "business_service_id" = bs."id"
FROM "branches" b, "business_services" bs
WHERE b."id" = s."branch_id"
  AND bs."business_id" = b."business_id"
  AND bs."category_id" = s."category_id"
  AND LOWER(TRIM(bs."name")) = LOWER(TRIM(s."name"));

ALTER TABLE "business_services"
  ADD CONSTRAINT "business_services_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_services"
  ADD CONSTRAINT "business_services_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "services"
  ADD CONSTRAINT "services_business_service_id_fkey"
  FOREIGN KEY ("business_service_id") REFERENCES "business_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
