-- Bring the historical user_roles table in line with the scoped RBAC model
-- before later migrations query role expiry and tenant/branch ownership.
DO $$
BEGIN
  CREATE TYPE "RoleLevel" AS ENUM ('PLATFORM', 'TENANT', 'BRANCH', 'CUSTOMER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PermissionScope" AS ENUM ('PLATFORM', 'TENANT', 'BRANCH', 'SELF', 'PUBLIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'PLATFORM_ADMIN';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'COMPLIANCE';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'SUPPORT';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'MARKETING';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'FINANCE';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'BRANCH_MANAGER';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'RECEPTIONIST';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'GUEST';

ALTER TABLE "roles"
ADD COLUMN IF NOT EXISTS "level" "RoleLevel" NOT NULL DEFAULT 'CUSTOMER';

UPDATE "roles"
SET "level" = CASE
  WHEN "code"::TEXT IN ('ADMIN', 'PLATFORM_ADMIN', 'COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE')
    THEN 'PLATFORM'::"RoleLevel"
  WHEN "code"::TEXT = 'BUSINESS_OWNER'
    THEN 'TENANT'::"RoleLevel"
  WHEN "code"::TEXT IN ('BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF')
    THEN 'BRANCH'::"RoleLevel"
  ELSE 'CUSTOMER'::"RoleLevel"
END;

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "scope" "PermissionScope" NOT NULL DEFAULT 'SELF',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "role_id" TEXT NOT NULL,
  "permission_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "permissions_code_key"
ON "permissions"("code");

CREATE INDEX IF NOT EXISTS "permissions_resource_action_idx"
ON "permissions"("resource", "action");

CREATE INDEX IF NOT EXISTS "role_permissions_permission_id_idx"
ON "role_permissions"("permission_id");

DO $$
BEGIN
  ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_permission_id_fkey"
  FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Legacy booking reads still select this compatibility flag. New sensitive
-- data writes use contextual consultation consent events instead.
ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "sensitive_data_consent" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "user_roles"
ADD COLUMN IF NOT EXISTS "id" TEXT DEFAULT gen_random_uuid()::text,
ADD COLUMN IF NOT EXISTS "business_id" TEXT,
ADD COLUMN IF NOT EXISTS "branch_id" TEXT,
ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "granted_by" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'user_roles'
      AND column_name = 'assigned_at'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'user_roles'
      AND column_name = 'granted_at'
  ) THEN
    ALTER TABLE "user_roles" RENAME COLUMN "assigned_at" TO "granted_at";
  END IF;
END $$;

ALTER TABLE "user_roles"
ADD COLUMN IF NOT EXISTS "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "user_roles"
SET "id" = gen_random_uuid()::text
WHERE "id" IS NULL;

ALTER TABLE "user_roles"
ALTER COLUMN "id" SET NOT NULL;

-- Recover scoped assignments from the business membership/staff records that
-- pre-date scoped RBAC. The first candidate updates the historical row and
-- additional candidates become independent assignments.
CREATE TEMP TABLE "_user_role_scope_candidates" (
  "user_id" TEXT NOT NULL,
  "role_id" TEXT NOT NULL,
  "business_id" TEXT,
  "branch_id" TEXT
) ON COMMIT DROP;

INSERT INTO "_user_role_scope_candidates" ("user_id", "role_id", "business_id", "branch_id")
SELECT DISTINCT ur."user_id", ur."role_id", b."id", NULL
FROM "user_roles" ur
JOIN "roles" r ON r."id" = ur."role_id" AND r."code"::TEXT = 'BUSINESS_OWNER'
JOIN "business_owner_profiles" bop ON bop."user_id" = ur."user_id"
JOIN "businesses" b ON b."owner_id" = bop."id";

INSERT INTO "_user_role_scope_candidates" ("user_id", "role_id", "business_id", "branch_id")
SELECT DISTINCT ur."user_id", ur."role_id", sm."business_id", sm."branch_id"
FROM "user_roles" ur
JOIN "roles" r ON r."id" = ur."role_id"
JOIN "salon_members" sm ON sm."user_id" = ur."user_id"
WHERE (r."code"::TEXT = 'BRANCH_MANAGER' AND sm."role"::TEXT = 'MANAGER')
   OR (r."code"::TEXT = 'RECEPTIONIST' AND sm."role"::TEXT = 'RECEPTIONIST');

INSERT INTO "_user_role_scope_candidates" ("user_id", "role_id", "business_id", "branch_id")
SELECT DISTINCT ur."user_id", ur."role_id", b."business_id", sp."branch_id"
FROM "user_roles" ur
JOIN "roles" r ON r."id" = ur."role_id" AND r."code"::TEXT = 'STAFF'
JOIN "staff_profiles" sp ON sp."user_id" = ur."user_id"
JOIN "branches" b ON b."id" = sp."branch_id";

WITH ranked AS (
  SELECT
    c.*,
    ROW_NUMBER() OVER (
      PARTITION BY c."user_id", c."role_id"
      ORDER BY c."business_id", c."branch_id" NULLS FIRST
    ) AS position
  FROM "_user_role_scope_candidates" c
)
UPDATE "user_roles" ur
SET
  "business_id" = ranked."business_id",
  "branch_id" = ranked."branch_id"
FROM ranked
WHERE ranked.position = 1
  AND ur."user_id" = ranked."user_id"
  AND ur."role_id" = ranked."role_id"
  AND ur."business_id" IS NULL
  AND ur."branch_id" IS NULL;

INSERT INTO "user_roles" (
  "id",
  "user_id",
  "role_id",
  "business_id",
  "branch_id",
  "expires_at",
  "granted_at",
  "granted_by"
)
SELECT
  gen_random_uuid()::text,
  c."user_id",
  c."role_id",
  c."business_id",
  c."branch_id",
  NULL,
  CURRENT_TIMESTAMP,
  NULL
FROM "_user_role_scope_candidates" c
WHERE NOT EXISTS (
  SELECT 1
  FROM "user_roles" existing
  WHERE existing."user_id" = c."user_id"
    AND existing."role_id" = c."role_id"
    AND existing."business_id" IS NOT DISTINCT FROM c."business_id"
    AND existing."branch_id" IS NOT DISTINCT FROM c."branch_id"
);

ALTER TABLE "user_roles"
DROP CONSTRAINT IF EXISTS "user_roles_pkey";

ALTER TABLE "user_roles"
ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_user_id_role_id_business_id_branch_id_key"
ON "user_roles"("user_id", "role_id", "business_id", "branch_id");

CREATE INDEX IF NOT EXISTS "user_roles_user_id_idx"
ON "user_roles"("user_id");

CREATE INDEX IF NOT EXISTS "user_roles_role_id_idx"
ON "user_roles"("role_id");

CREATE INDEX IF NOT EXISTS "user_roles_business_id_idx"
ON "user_roles"("business_id");

CREATE INDEX IF NOT EXISTS "user_roles_branch_id_idx"
ON "user_roles"("branch_id");

DO $$
BEGIN
  ALTER TABLE "user_roles"
  ADD CONSTRAINT "user_roles_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "user_roles"
  ADD CONSTRAINT "user_roles_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "user_roles"
  ADD CONSTRAINT "user_roles_granted_by_fkey"
  FOREIGN KEY ("granted_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
