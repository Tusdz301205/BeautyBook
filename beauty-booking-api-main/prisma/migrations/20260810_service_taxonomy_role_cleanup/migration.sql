-- BeautyBook Section A hardening.
-- This migration is deliberately data-preserving: existing service/booking IDs
-- and the physical `services` table are retained as branch offerings.

-- ---------------------------------------------------------------------------
-- 1. Retire legacy roles fail-closed and preserve an explicit audit record.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "legacy_role_migration_audit" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "legacy_role" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "migrated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legacy_role_migration_audit_pkey" PRIMARY KEY ("id")
);

INSERT INTO "legacy_role_migration_audit" ("id", "user_id", "legacy_role", "action")
SELECT gen_random_uuid()::text, ur."user_id", r."code"::text,
  CASE WHEN r."code"::text = 'ADMIN'
    THEN 'MAPPED_TO_PLATFORM_ADMIN'
    ELSE 'RETIRED_FAIL_CLOSED'
  END
FROM "user_roles" ur
JOIN "roles" r ON r."id" = ur."role_id"
WHERE r."code"::text IN ('ADMIN', 'COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE');

INSERT INTO "roles" ("id", "code", "name", "level", "created_at")
SELECT gen_random_uuid()::text, 'PLATFORM_ADMIN'::"RoleCode", 'Quản trị nền tảng', 'PLATFORM'::"RoleLevel", CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "code"::text = 'PLATFORM_ADMIN');

INSERT INTO "user_roles" (
  "id", "user_id", "role_id", "business_id", "branch_id", "expires_at", "granted_at", "granted_by"
)
SELECT gen_random_uuid()::text, ur."user_id", platform_role."id", NULL, NULL,
  ur."expires_at", ur."granted_at", ur."granted_by"
FROM "user_roles" ur
JOIN "roles" legacy_role ON legacy_role."id" = ur."role_id" AND legacy_role."code"::text = 'ADMIN'
CROSS JOIN LATERAL (
  SELECT "id" FROM "roles" WHERE "code"::text = 'PLATFORM_ADMIN' LIMIT 1
) platform_role
ON CONFLICT DO NOTHING;

-- Any token that carried a retired role must be re-authenticated against the
-- final seven-role model; this prevents an old JWT/session from bypassing it.
UPDATE "user_sessions"
SET "revoked_at" = COALESCE("revoked_at", CURRENT_TIMESTAMP)
WHERE "user_id" IN (SELECT DISTINCT "user_id" FROM "legacy_role_migration_audit");

DELETE FROM "user_roles"
WHERE "role_id" IN (
  SELECT "id" FROM "roles"
  WHERE "code"::text IN ('ADMIN', 'COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE')
);

DELETE FROM "roles"
WHERE "code"::text IN ('ADMIN', 'COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE');

-- No current data is allowed to retain an obsolete role code. These columns
-- are nullable except staff invitations, whose obsolete pending invitations
-- are revoked before the enum is narrowed. Every modified or archived row is
-- preserved verbatim for governance and incident review.
CREATE TABLE IF NOT EXISTS "legacy_role_reference_audit" (
  "id" TEXT NOT NULL,
  "source_table" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "legacy_role" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "row_snapshot" JSONB NOT NULL,
  "migrated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legacy_role_reference_audit_pkey" PRIMARY KEY ("id")
);

INSERT INTO "legacy_role_reference_audit"
  ("id", "source_table", "source_id", "legacy_role", "action", "row_snapshot")
SELECT gen_random_uuid()::text, 'staff_invitations', si."id", si."role_code"::text,
  'REVOKED_AND_ARCHIVED', to_jsonb(si)
FROM "staff_invitations" si
WHERE si."role_code"::text IN ('ADMIN', 'COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE');

INSERT INTO "legacy_role_reference_audit"
  ("id", "source_table", "source_id", "legacy_role", "action", "row_snapshot")
SELECT gen_random_uuid()::text, 'staff_schedule_segments', segment."id", segment."role_code"::text,
  'ROLE_CLEARED', to_jsonb(segment)
FROM "staff_schedule_segments" segment
WHERE segment."role_code"::text IN ('ADMIN', 'COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE');

INSERT INTO "legacy_role_reference_audit"
  ("id", "source_table", "source_id", "legacy_role", "action", "row_snapshot")
SELECT gen_random_uuid()::text, 'compensation_assignments', assignment."id", assignment."role_code"::text,
  'ROLE_CLEARED', to_jsonb(assignment)
FROM "compensation_assignments" assignment
WHERE assignment."role_code"::text IN ('ADMIN', 'COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE');

UPDATE "staff_invitations"
SET "status" = 'REVOKED', "revoked_at" = COALESCE("revoked_at", CURRENT_TIMESTAMP)
WHERE "role_code"::text IN ('ADMIN', 'COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE');
DELETE FROM "staff_invitations"
WHERE "role_code"::text IN ('ADMIN', 'COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE');
UPDATE "staff_schedule_segments" SET "role_code" = NULL
WHERE "role_code"::text IN ('ADMIN', 'COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE');
UPDATE "compensation_assignments" SET "role_code" = NULL
WHERE "role_code"::text IN ('ADMIN', 'COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE');

ALTER TABLE "roles" ALTER COLUMN "code" TYPE TEXT USING "code"::TEXT;
ALTER TABLE "staff_invitations" ALTER COLUMN "role_code" TYPE TEXT USING "role_code"::TEXT;
ALTER TABLE "staff_schedule_segments" ALTER COLUMN "role_code" TYPE TEXT USING "role_code"::TEXT;
ALTER TABLE "compensation_assignments" ALTER COLUMN "role_code" TYPE TEXT USING "role_code"::TEXT;

DROP TYPE "RoleCode";
CREATE TYPE "RoleCode" AS ENUM (
  'PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER',
  'RECEPTIONIST', 'STAFF', 'CUSTOMER', 'GUEST'
);

ALTER TABLE "roles" ALTER COLUMN "code" TYPE "RoleCode" USING "code"::"RoleCode";
ALTER TABLE "staff_invitations" ALTER COLUMN "role_code" TYPE "RoleCode" USING "role_code"::"RoleCode";
ALTER TABLE "staff_schedule_segments" ALTER COLUMN "role_code" TYPE "RoleCode" USING "role_code"::"RoleCode";
ALTER TABLE "compensation_assignments" ALTER COLUMN "role_code" TYPE "RoleCode" USING "role_code"::"RoleCode";

DROP TYPE IF EXISTS "TenantMemberRole";

-- ---------------------------------------------------------------------------
-- 2. ServiceCategory becomes business-owned, not platform search taxonomy.
-- ---------------------------------------------------------------------------
CREATE TABLE "legacy_service_category_migration_audit" (
  "id" TEXT NOT NULL,
  "original_category_id" TEXT NOT NULL,
  "business_id" TEXT,
  "replacement_category_id" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "migrated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legacy_service_category_migration_audit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "service_categories" ADD COLUMN "business_id" TEXT;
ALTER TABLE "service_categories" DROP CONSTRAINT IF EXISTS "service_categories_slug_key";
DROP INDEX IF EXISTS "service_categories_slug_key";

CREATE TEMP TABLE "_category_business_map" (
  "original_category_id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "replacement_category_id" TEXT NOT NULL,
  PRIMARY KEY ("original_category_id", "business_id")
);

WITH RECURSIVE directly_used AS (
  SELECT bs."category_id" AS "category_id", bs."business_id"
  FROM "business_services" bs
  UNION
  SELECT s."category_id", b."business_id"
  FROM "services" s
  JOIN "branches" b ON b."id" = s."branch_id"
), category_tree AS (
  SELECT du."category_id", du."business_id"
  FROM directly_used du
  UNION
  SELECT parent."id", tree."business_id"
  FROM category_tree tree
  JOIN "service_categories" child ON child."id" = tree."category_id"
  JOIN "service_categories" parent ON parent."id" = child."parent_id"
)
INSERT INTO "_category_business_map" ("original_category_id", "business_id", "replacement_category_id")
SELECT DISTINCT "category_id", "business_id", gen_random_uuid()::text
FROM category_tree;

INSERT INTO "service_categories" (
  "id", "business_id", "parent_id", "name", "slug", "created_at", "updated_at", "deleted_at"
)
SELECT map."replacement_category_id", map."business_id", NULL,
  category."name", category."slug", category."created_at", category."updated_at", category."deleted_at"
FROM "_category_business_map" map
JOIN "service_categories" category ON category."id" = map."original_category_id";

UPDATE "service_categories" child_copy
SET "parent_id" = parent_map."replacement_category_id"
FROM "_category_business_map" child_map
JOIN "service_categories" original_child ON original_child."id" = child_map."original_category_id"
JOIN "_category_business_map" parent_map
  ON parent_map."original_category_id" = original_child."parent_id"
 AND parent_map."business_id" = child_map."business_id"
WHERE child_copy."id" = child_map."replacement_category_id";

INSERT INTO "legacy_service_category_migration_audit" (
  "id", "original_category_id", "business_id", "replacement_category_id", "name", "slug", "action"
)
SELECT gen_random_uuid()::text, original."id", map."business_id", map."replacement_category_id",
  original."name", original."slug", 'COPIED_TO_BUSINESS'
FROM "service_categories" original
JOIN "_category_business_map" map ON map."original_category_id" = original."id"
WHERE original."business_id" IS NULL;

INSERT INTO "legacy_service_category_migration_audit" (
  "id", "original_category_id", "name", "slug", "action"
)
SELECT gen_random_uuid()::text, original."id", original."name", original."slug", 'ARCHIVED_UNUSED'
FROM "service_categories" original
WHERE original."business_id" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "_category_business_map" map WHERE map."original_category_id" = original."id"
  );

UPDATE "business_services" bs
SET "category_id" = map."replacement_category_id"
FROM "_category_business_map" map
WHERE map."original_category_id" = bs."category_id"
  AND map."business_id" = bs."business_id";

UPDATE "services" offering
SET "category_id" = map."replacement_category_id"
FROM "branches" branch, "_category_business_map" map
WHERE branch."id" = offering."branch_id"
  AND map."original_category_id" = offering."category_id"
  AND map."business_id" = branch."business_id";

-- Break legacy self-references before deleting the original global tree. The
-- per-business copies already point to their corresponding copied parents.
UPDATE "service_categories"
SET "parent_id" = NULL
WHERE "business_id" IS NULL;

DELETE FROM "service_categories" WHERE "business_id" IS NULL;

ALTER TABLE "service_categories" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "service_categories"
  ADD CONSTRAINT "service_categories_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "service_categories_business_id_slug_key"
  ON "service_categories"("business_id", "slug");
CREATE INDEX "service_categories_business_id_deleted_at_idx"
  ON "service_categories"("business_id", "deleted_at");

DROP TABLE "_category_business_map";

-- ---------------------------------------------------------------------------
-- 3. Platform canonical taxonomy, independent from salon menu categories.
-- ---------------------------------------------------------------------------
CREATE TYPE "CanonicalServiceStatus" AS ENUM ('ACTIVE', 'DEPRECATED', 'MERGED');
CREATE TYPE "ServiceMappingStatus" AS ENUM ('MAPPED', 'UNMAPPED', 'SUGGESTED');

CREATE TABLE "canonical_services" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "parent_id" TEXT,
  "replacement_canonical_id" TEXT,
  "synonyms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "CanonicalServiceStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canonical_services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "canonical_services_code_key" UNIQUE ("code"),
  CONSTRAINT "canonical_services_slug_key" UNIQUE ("slug"),
  CONSTRAINT "canonical_services_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "canonical_services"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "canonical_services_replacement_canonical_id_fkey"
    FOREIGN KEY ("replacement_canonical_id") REFERENCES "canonical_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "canonical_services_merge_state_check" CHECK (
    ("status" <> 'MERGED' AND "replacement_canonical_id" IS NULL)
    OR ("status" = 'MERGED' AND "replacement_canonical_id" IS NOT NULL AND "replacement_canonical_id" <> "id")
  )
);
CREATE INDEX "canonical_services_parent_id_idx" ON "canonical_services"("parent_id");
CREATE INDEX "canonical_services_replacement_canonical_id_idx" ON "canonical_services"("replacement_canonical_id");
CREATE INDEX "canonical_services_status_name_idx" ON "canonical_services"("status", "name");

INSERT INTO "canonical_services" ("id", "code", "slug", "name", "synonyms") VALUES
  (gen_random_uuid()::text, 'MENS_HAIRCUT', 'cat-toc-nam', 'Cắt tóc nam', ARRAY['cắt tóc nam','tóc nam']),
  (gen_random_uuid()::text, 'WOMENS_HAIRCUT', 'cat-toc-nu', 'Cắt tóc nữ', ARRAY['cắt tóc nữ','tóc nữ','cắt layer','cắt bob']),
  (gen_random_uuid()::text, 'HAIR_COLOR', 'nhuom-toc', 'Nhuộm tóc', ARRAY['nhuộm tóc','balayage','highlight']),
  (gen_random_uuid()::text, 'HAIR_PERM', 'uon-toc', 'Uốn tóc', ARRAY['uốn tóc','uốn setting']),
  (gen_random_uuid()::text, 'HAIR_WASH', 'goi-dau', 'Gội đầu', ARRAY['gội đầu']),
  (gen_random_uuid()::text, 'HEAD_SPA', 'goi-dau-duong-sinh', 'Gội đầu dưỡng sinh', ARRAY['head spa','gội dưỡng sinh']),
  (gen_random_uuid()::text, 'SKIN_CARE', 'cham-soc-da', 'Chăm sóc da', ARRAY['facial','chăm sóc da']),
  (gen_random_uuid()::text, 'BODY_MASSAGE', 'massage-body', 'Massage body', ARRAY['massage toàn thân','massage body']),
  (gen_random_uuid()::text, 'FOOT_MASSAGE', 'massage-foot', 'Massage foot', ARRAY['massage chân','massage foot']),
  (gen_random_uuid()::text, 'GEL_POLISH', 'son-gel', 'Sơn gel', ARRAY['sơn gel','gel polish']),
  (gen_random_uuid()::text, 'NAIL_EXTENSION', 'dap-mong', 'Đắp móng', ARRAY['đắp móng','nối móng']),
  (gen_random_uuid()::text, 'NAIL_CARE', 'cham-soc-mong', 'Chăm sóc móng', ARRAY['chăm sóc móng','nail care']);

ALTER TABLE "business_services"
  ADD COLUMN "canonical_service_id" TEXT,
  ADD COLUMN "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "mapping_status" "ServiceMappingStatus" NOT NULL DEFAULT 'UNMAPPED';

-- Controlled allow-list only. Ambiguous names intentionally remain UNMAPPED.
UPDATE "business_services" bs
SET "canonical_service_id" = canonical."id", "mapping_status" = 'MAPPED'
FROM "canonical_services" canonical
WHERE canonical."code" = CASE LOWER(TRIM(bs."name"))
  WHEN 'cắt tóc nam' THEN 'MENS_HAIRCUT'
  WHEN 'cắt tóc nam theo yêu cầu' THEN 'MENS_HAIRCUT'
  WHEN 'cắt tóc nữ' THEN 'WOMENS_HAIRCUT'
  WHEN 'cắt tóc nữ theo yêu cầu' THEN 'WOMENS_HAIRCUT'
  WHEN 'cắt layer hàn quốc' THEN 'WOMENS_HAIRCUT'
  WHEN 'cắt bob nữ' THEN 'WOMENS_HAIRCUT'
  WHEN 'cắt tóc nữ premium' THEN 'WOMENS_HAIRCUT'
  WHEN 'nhuộm tóc' THEN 'HAIR_COLOR'
  WHEN 'nhuộm tóc thời trang' THEN 'HAIR_COLOR'
  WHEN 'nhuộm highlight' THEN 'HAIR_COLOR'
  WHEN 'balayage' THEN 'HAIR_COLOR'
  WHEN 'balayage premium' THEN 'HAIR_COLOR'
  WHEN 'uốn tóc' THEN 'HAIR_PERM'
  WHEN 'uốn setting' THEN 'HAIR_PERM'
  WHEN 'uốn xoăn lạnh' THEN 'HAIR_PERM'
  WHEN 'gội đầu' THEN 'HAIR_WASH'
  WHEN 'gội đầu dưỡng sinh' THEN 'HEAD_SPA'
  WHEN 'gội đầu dưỡng sinh hoàng gia 18 bước' THEN 'HEAD_SPA'
  WHEN 'chăm sóc da' THEN 'SKIN_CARE'
  WHEN 'chăm sóc da mặt cơ bản' THEN 'SKIN_CARE'
  WHEN 'chăm sóc da mặt chuyên sâu' THEN 'SKIN_CARE'
  WHEN 'massage body' THEN 'BODY_MASSAGE'
  WHEN 'massage body 60 phút' THEN 'BODY_MASSAGE'
  WHEN 'massage body 90 phút' THEN 'BODY_MASSAGE'
  WHEN 'massage foot' THEN 'FOOT_MASSAGE'
  WHEN 'massage foot 60 phút' THEN 'FOOT_MASSAGE'
  WHEN 'sơn gel' THEN 'GEL_POLISH'
  WHEN 'sơn gel tay' THEN 'GEL_POLISH'
  WHEN 'sơn gel chân' THEN 'GEL_POLISH'
  WHEN 'sơn gel tay + chân' THEN 'GEL_POLISH'
  WHEN 'đắp móng' THEN 'NAIL_EXTENSION'
  WHEN 'đắp móng gel' THEN 'NAIL_EXTENSION'
  WHEN 'chăm sóc móng' THEN 'NAIL_CARE'
  ELSE NULL
END;

ALTER TABLE "business_services"
  ADD CONSTRAINT "business_services_canonical_service_id_fkey"
  FOREIGN KEY ("canonical_service_id") REFERENCES "canonical_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "business_services_mapping_state_check" CHECK (
    "mapping_status" <> 'MAPPED' OR "canonical_service_id" IS NOT NULL
  );
CREATE INDEX "business_services_canonical_service_id_mapping_status_idx"
  ON "business_services"("canonical_service_id", "mapping_status");

-- ---------------------------------------------------------------------------
-- 4. Existing `services` rows are the BranchServiceOffering implementation.
-- ---------------------------------------------------------------------------
ALTER TABLE "services" ADD COLUMN "bookable" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "services" ALTER COLUMN "business_service_id" SET NOT NULL;
ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "services_business_service_id_fkey";
ALTER TABLE "services"
  ADD CONSTRAINT "services_business_service_id_fkey"
  FOREIGN KEY ("business_service_id") REFERENCES "business_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "services_branch_id_business_service_id_key"
  ON "services"("branch_id", "business_service_id");

-- Database-level tenant invariant: an offering and its BusinessService must
-- belong to the same business. A constraint trigger covers writes from every
-- client, not just the NestJS service layer.
CREATE OR REPLACE FUNCTION "enforce_branch_offering_business_scope"()
RETURNS TRIGGER AS $$
DECLARE
  branch_business TEXT;
  service_business TEXT;
BEGIN
  SELECT "business_id" INTO branch_business FROM "branches" WHERE "id" = NEW."branch_id";
  SELECT "business_id" INTO service_business FROM "business_services" WHERE "id" = NEW."business_service_id";
  IF branch_business IS NULL OR service_business IS NULL OR branch_business <> service_business THEN
    RAISE EXCEPTION 'BranchServiceOffering crosses business scope';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "services_business_scope_guard"
AFTER INSERT OR UPDATE OF "branch_id", "business_service_id" ON "services"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION "enforce_branch_offering_business_scope"();

-- ---------------------------------------------------------------------------
-- 5. Complete booking snapshots without changing any historical offering ID.
-- ---------------------------------------------------------------------------
ALTER TABLE "booking_services"
  ADD COLUMN "business_service_id" TEXT,
  ADD COLUMN "canonical_service_id" TEXT;

UPDATE "booking_services" item
SET "business_service_id" = offering."business_service_id",
    "canonical_service_id" = business_service."canonical_service_id",
    "service_name_snapshot" = COALESCE(item."service_name_snapshot", offering."name")
FROM "services" offering
JOIN "business_services" business_service ON business_service."id" = offering."business_service_id"
WHERE item."service_id" = offering."id";

ALTER TABLE "booking_services" ALTER COLUMN "business_service_id" SET NOT NULL;
ALTER TABLE "booking_services" ALTER COLUMN "service_name_snapshot" SET NOT NULL;
ALTER TABLE "booking_services"
  ADD CONSTRAINT "booking_services_business_service_id_fkey"
  FOREIGN KEY ("business_service_id") REFERENCES "business_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "booking_services_canonical_service_id_fkey"
  FOREIGN KEY ("canonical_service_id") REFERENCES "canonical_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "booking_services_business_service_id_idx" ON "booking_services"("business_service_id");
CREATE INDEX "booking_services_canonical_service_id_idx" ON "booking_services"("canonical_service_id");
