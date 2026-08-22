DO $$ BEGIN
  CREATE TYPE "ComboPricingMode" AS ENUM ('FIXED_PRICE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ComboStaffAssignmentMode" AS ENUM ('SINGLE_PROVIDER', 'PER_SERVICE_PROVIDER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "BookingServiceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "BusinessDocumentType" AS ENUM ('BUSINESS_LICENSE', 'OWNER_ID_CARD', 'TAX_DOCUMENT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "BusinessDocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEED_MORE_INFO', 'APPROVED', 'REJECTED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "DocumentReviewAction" AS ENUM ('SUBMIT', 'APPROVE', 'REQUEST_INFO', 'REJECT', 'ARCHIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AttendanceQrPurpose" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'BOTH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AttendanceQrUseAction" AS ENUM ('CHECK_IN', 'CHECK_OUT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AttendanceEventType" AS ENUM (
    'CHECK_IN',
    'CHECK_OUT',
    'ADJUSTMENT_REQUESTED',
    'ADJUSTMENT_APPROVED',
    'ADJUSTMENT_REJECTED',
    'MANUAL_ADJUSTMENT',
    'MARKED_ABSENT',
    'ABSENCE_RESTORED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "onboarding_data" JSONB,
  ADD COLUMN IF NOT EXISTS "onboarding_step" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "marketplace_previewed_at" TIMESTAMP(3);

ALTER TABLE "combos"
  ADD COLUMN IF NOT EXISTS "business_id" TEXT,
  ADD COLUMN IF NOT EXISTS "pricing_mode" "ComboPricingMode" NOT NULL DEFAULT 'FIXED_PRICE',
  ADD COLUMN IF NOT EXISTS "staff_assignment_mode" "ComboStaffAssignmentMode" NOT NULL DEFAULT 'SINGLE_PROVIDER',
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "combos" AS c
SET "business_id" = b."business_id"
FROM "branches" AS b
WHERE c."branch_id" = b."id"
  AND c."business_id" IS NULL;

ALTER TABLE "combos"
  ALTER COLUMN "business_id" SET NOT NULL;

ALTER TABLE "combos"
  ADD CONSTRAINT "combos_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "combos_business_id_status_idx"
  ON "combos"("business_id", "status");

ALTER TABLE "combo_services"
  ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "price_snapshot" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "duration_snapshot" INTEGER,
  ADD COLUMN IF NOT EXISTS "transition_minutes" INTEGER NOT NULL DEFAULT 0;

UPDATE "combo_services" AS cs
SET
  "price_snapshot" = s."price",
  "duration_snapshot" = s."duration_minutes"
FROM "services" AS s
WHERE cs."service_id" = s."id"
  AND (cs."price_snapshot" IS NULL OR cs."duration_snapshot" IS NULL);

WITH ordered AS (
  SELECT
    "combo_id",
    "service_id",
    ROW_NUMBER() OVER (PARTITION BY "combo_id" ORDER BY "service_id") - 1 AS next_order
  FROM "combo_services"
)
UPDATE "combo_services" AS cs
SET "sort_order" = ordered.next_order
FROM ordered
WHERE cs."combo_id" = ordered."combo_id"
  AND cs."service_id" = ordered."service_id";

ALTER TABLE "combo_services"
  ALTER COLUMN "price_snapshot" SET NOT NULL,
  ALTER COLUMN "duration_snapshot" SET NOT NULL;

CREATE INDEX "combo_services_combo_id_sort_order_idx"
  ON "combo_services"("combo_id", "sort_order");

ALTER TABLE "booking_services"
  ADD COLUMN IF NOT EXISTS "service_name_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "status" "BookingServiceStatus" NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN IF NOT EXISTS "item_start_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "item_end_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "transition_minutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "combo_version" INTEGER;

UPDATE "booking_services" AS bs
SET "service_name_snapshot" = s."name"
FROM "services" AS s
WHERE bs."service_id" = s."id"
  AND bs."service_name_snapshot" IS NULL;

UPDATE "booking_services" AS bs
SET "combo_version" = c."version"
FROM "combos" AS c
WHERE bs."combo_id" = c."id"
  AND bs."combo_version" IS NULL;

CREATE TABLE "business_documents" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "document_type" "BusinessDocumentType" NOT NULL,
  "document_number" TEXT,
  "expires_at" DATE,
  "status" "BusinessDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "current_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_documents_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "business_document_versions" (
  "id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "media_id" TEXT NOT NULL,
  "document_name" TEXT NOT NULL,
  "note" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_document_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_document_versions_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "business_documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "business_document_versions_media_id_fkey"
    FOREIGN KEY ("media_id") REFERENCES "media_files"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "business_document_versions_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "document_review_events" (
  "id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "actor_id" TEXT,
  "action" "DocumentReviewAction" NOT NULL,
  "from_status" "BusinessDocumentStatus",
  "to_status" "BusinessDocumentStatus" NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_review_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_review_events_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "business_documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "document_review_events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "business_document_versions_document_id_version_key"
  ON "business_document_versions"("document_id", "version");
CREATE INDEX "business_document_versions_media_id_idx"
  ON "business_document_versions"("media_id");
CREATE INDEX "business_documents_business_id_document_type_status_idx"
  ON "business_documents"("business_id", "document_type", "status");
CREATE INDEX "document_review_events_document_id_created_at_idx"
  ON "document_review_events"("document_id", "created_at");

CREATE TABLE "attendance_qr_tokens" (
  "nonce" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "purpose" "AttendanceQrPurpose" NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_qr_tokens_pkey" PRIMARY KEY ("nonce"),
  CONSTRAINT "attendance_qr_tokens_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_qr_tokens_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_qr_tokens_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "attendance_qr_uses" (
  "id" TEXT NOT NULL,
  "qr_nonce" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "action" "AttendanceQrUseAction" NOT NULL,
  "device_hash" TEXT,
  "redeemed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_qr_uses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_qr_uses_qr_nonce_fkey"
    FOREIGN KEY ("qr_nonce") REFERENCES "attendance_qr_tokens"("nonce")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_qr_uses_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_qr_uses_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "attendance_events" (
  "id" TEXT NOT NULL,
  "attendance_id" TEXT,
  "business_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "event_type" "AttendanceEventType" NOT NULL,
  "event_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "original_data" JSONB,
  "new_data" JSONB,
  "reason" TEXT,
  "source" TEXT NOT NULL,
  CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_events_attendance_id_fkey"
    FOREIGN KEY ("attendance_id") REFERENCES "staff_attendances"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "attendance_events_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_events_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_events_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "attendance_qr_uses_qr_nonce_staff_id_action_key"
  ON "attendance_qr_uses"("qr_nonce", "staff_id", "action");
CREATE INDEX "attendance_qr_tokens_branch_id_expires_at_idx"
  ON "attendance_qr_tokens"("branch_id", "expires_at");
CREATE INDEX "attendance_qr_uses_staff_id_redeemed_at_idx"
  ON "attendance_qr_uses"("staff_id", "redeemed_at");
CREATE INDEX "attendance_events_staff_id_event_at_idx"
  ON "attendance_events"("staff_id", "event_at");
CREATE INDEX "attendance_events_branch_id_event_at_idx"
  ON "attendance_events"("branch_id", "event_at");

CREATE TABLE "user_permissions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "permission_id" TEXT NOT NULL,
  "bundle_code" TEXT,
  "granted_by" TEXT,
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_permissions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "user_permissions_user_id_permission_id_key"
  ON "user_permissions"("user_id", "permission_id");
CREATE INDEX "user_permissions_user_id_revoked_at_expires_at_idx"
  ON "user_permissions"("user_id", "revoked_at", "expires_at");
CREATE INDEX "user_permissions_permission_id_idx"
  ON "user_permissions"("permission_id");

-- PLATFORM_ADMIN is the only platform product role. Preserve the effective
-- permissions of existing platform operators as direct, auditable grants
-- before replacing their legacy role assignment.
INSERT INTO "user_permissions" (
  "id", "user_id", "permission_id", "bundle_code", "granted_by"
)
SELECT
  gen_random_uuid()::text,
  ur."user_id",
  rp."permission_id",
  CASE
    WHEN r."code"::text = 'PLATFORM_ADMIN' THEN 'PLATFORM_FULL'
    ELSE 'LEGACY_' || r."code"::text
  END,
  ur."granted_by"
FROM "user_roles" ur
JOIN "roles" r ON r."id" = ur."role_id"
JOIN "role_permissions" rp ON rp."role_id" = r."id"
WHERE r."code"::text IN ('PLATFORM_ADMIN', 'COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE', 'ADMIN')
ON CONFLICT ("user_id", "permission_id") DO NOTHING;

INSERT INTO "user_roles" (
  "id", "user_id", "role_id", "business_id", "branch_id", "granted_at", "granted_by", "expires_at"
)
SELECT
  gen_random_uuid()::text,
  legacy."user_id",
  platform_role."id",
  NULL,
  NULL,
  MIN(legacy."granted_at"),
  NULL,
  NULL
FROM "user_roles" legacy
JOIN "roles" legacy_role ON legacy_role."id" = legacy."role_id"
CROSS JOIN "roles" platform_role
WHERE legacy_role."code"::text IN ('COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE', 'ADMIN')
  AND platform_role."code"::text = 'PLATFORM_ADMIN'
  AND NOT EXISTS (
    SELECT 1
    FROM "user_roles" current
    WHERE current."user_id" = legacy."user_id"
      AND current."role_id" = platform_role."id"
      AND current."business_id" IS NULL
      AND current."branch_id" IS NULL
  )
GROUP BY legacy."user_id", platform_role."id";

DELETE FROM "user_roles" ur
USING "roles" r
WHERE ur."role_id" = r."id"
  AND r."code"::text IN ('COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE', 'ADMIN');

DELETE FROM "role_permissions" rp
USING "roles" r
WHERE rp."role_id" = r."id"
  AND r."code"::text IN ('COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE', 'ADMIN');

DELETE FROM "roles"
WHERE "code"::text IN ('COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE', 'ADMIN');
