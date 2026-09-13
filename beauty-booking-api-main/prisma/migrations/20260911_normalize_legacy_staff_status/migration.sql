-- Some long-lived databases applied the workforce-removal migration before its
-- ON_LEAVE cleanup was added. Preserve those legacy rows, normalize them to the
-- supported INACTIVE state and align the PostgreSQL enum with Prisma.
CREATE TABLE IF NOT EXISTS "archive_20260911_staff_profiles_on_leave" (
  "staff_profile_id" text PRIMARY KEY,
  "snapshot" jsonb NOT NULL,
  "archived_at" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "archive_20260911_staff_profiles_on_leave" ("staff_profile_id", "snapshot")
SELECT staff_profile."id", to_jsonb(staff_profile.*)
FROM "staff_profiles" AS staff_profile
WHERE staff_profile."status"::text = 'ON_LEAVE'
ON CONFLICT ("staff_profile_id") DO NOTHING;

UPDATE "staff_profiles"
SET "status" = 'INACTIVE'
WHERE "status"::text = 'ON_LEAVE';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum AS enum_value
    INNER JOIN pg_type AS enum_type ON enum_type.oid = enum_value.enumtypid
    WHERE enum_type.typname = 'StaffStatus'
      AND enum_value.enumlabel = 'ON_LEAVE'
  ) THEN
    EXECUTE 'ALTER TABLE "staff_profiles" ALTER COLUMN "status" DROP DEFAULT';
    EXECUTE 'ALTER TYPE "StaffStatus" RENAME TO "StaffStatus_legacy_20260911"';
    EXECUTE 'CREATE TYPE "StaffStatus" AS ENUM (''PROFILE_ONLY'', ''INVITED'', ''ACTIVE'', ''LOCKED'', ''INACTIVE'')';
    EXECUTE 'ALTER TABLE "staff_profiles" ALTER COLUMN "status" TYPE "StaffStatus" USING ("status"::text::"StaffStatus")';
    EXECUTE 'ALTER TABLE "staff_profiles" ALTER COLUMN "status" SET DEFAULT ''ACTIVE''';
    EXECUTE 'DROP TYPE "StaffStatus_legacy_20260911"';
  END IF;
END $$;
