-- Replay guard for a historical migration that adds ADMIN even though the
-- original RoleCode enum already contained it. Existing databases that have
-- applied 20260731 are intentionally left untouched.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE "migration_name" = '20260731_workforce_payment_core'
      AND "finished_at" IS NOT NULL
  ) AND EXISTS (
    SELECT 1
    FROM pg_enum value
    JOIN pg_type type ON type.oid = value.enumtypid
    WHERE type.typname = 'RoleCode'
      AND value.enumlabel = 'ADMIN'
  ) THEN
    -- Preserve any pre-migration invitation instead of leaving a value that
    -- cannot be represented while the old migration is replayed.
    UPDATE "staff_invitations"
    SET "role_code" = 'PLATFORM_ADMIN'::"RoleCode"
    WHERE "role_code"::text = 'ADMIN';

    ALTER TYPE "RoleCode" RENAME TO "RoleCode_replay_old";
    CREATE TYPE "RoleCode" AS ENUM (
      'PLATFORM_ADMIN',
      'BUSINESS_OWNER',
      'BRANCH_MANAGER',
      'RECEPTIONIST',
      'STAFF',
      'CUSTOMER',
      'GUEST',
      'COMPLIANCE',
      'SUPPORT',
      'MARKETING',
      'FINANCE'
    );

    ALTER TABLE "roles"
      ALTER COLUMN "code" TYPE "RoleCode"
      USING "code"::text::"RoleCode";
    ALTER TABLE "staff_invitations"
      ALTER COLUMN "role_code" TYPE "RoleCode"
      USING "role_code"::text::"RoleCode";

    DROP TYPE "RoleCode_replay_old";
  END IF;
END $$;
