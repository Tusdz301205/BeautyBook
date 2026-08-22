-- Section A: workspace-bound sessions and staff invitation lifecycle.
-- This migration is additive and preserves all existing users, profiles and history.

CREATE TYPE "AuthWorkspace" AS ENUM ('CUSTOMER', 'SALON', 'PLATFORM');

ALTER TABLE "user_sessions"
  ADD COLUMN "workspace" "AuthWorkspace" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN "business_id" TEXT,
  ADD COLUMN "branch_id" TEXT;

-- Preserve the behavior of already-issued sessions while making their workspace explicit.
UPDATE "user_sessions" AS session
SET "workspace" = CASE
  WHEN EXISTS (
    SELECT 1 FROM "user_roles" ur
    JOIN "roles" r ON r."id" = ur."role_id"
    WHERE ur."user_id" = session."user_id"
      AND (ur."expires_at" IS NULL OR ur."expires_at" > CURRENT_TIMESTAMP)
      AND r."code" IN ('PLATFORM_ADMIN', 'COMPLIANCE', 'SUPPORT', 'MARKETING', 'FINANCE', 'ADMIN')
  ) THEN 'PLATFORM'::"AuthWorkspace"
  WHEN EXISTS (
    SELECT 1 FROM "user_roles" ur
    JOIN "roles" r ON r."id" = ur."role_id"
    WHERE ur."user_id" = session."user_id"
      AND (ur."expires_at" IS NULL OR ur."expires_at" > CURRENT_TIMESTAMP)
      AND r."code" IN ('BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF')
  ) THEN 'SALON'::"AuthWorkspace"
  ELSE 'CUSTOMER'::"AuthWorkspace"
END;

CREATE INDEX "user_sessions_user_id_workspace_business_id_branch_id_revoked_idx"
  ON "user_sessions"("user_id", "workspace", "business_id", "branch_id", "revoked_at");

ALTER TYPE "StaffStatus" ADD VALUE IF NOT EXISTS 'PROFILE_ONLY' BEFORE 'ACTIVE';
ALTER TYPE "StaffStatus" ADD VALUE IF NOT EXISTS 'INVITED' BEFORE 'ACTIVE';
ALTER TYPE "StaffStatus" ADD VALUE IF NOT EXISTS 'LOCKED' AFTER 'ACTIVE';
ALTER TYPE "ReviewStatus" ADD VALUE IF NOT EXISTS 'REPORTED' AFTER 'APPROVED';

ALTER TABLE "staff_invitations"
  ADD COLUMN "staff_profile_id" TEXT,
  ADD COLUMN "accepted_by" TEXT,
  ADD COLUMN "revoked_at" TIMESTAMP(3),
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "staff_invitations"
  ADD CONSTRAINT "staff_invitations_staff_profile_id_fkey"
  FOREIGN KEY ("staff_profile_id") REFERENCES "staff_profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "staff_invitations_staff_profile_id_status_idx"
  ON "staff_invitations"("staff_profile_id", "status");

-- A salon response belongs to one exact review. Older generic business comments
-- remain valid because the new key is nullable.
ALTER TABLE "business_comments"
  ADD COLUMN "review_id" TEXT;

CREATE UNIQUE INDEX "business_comments_review_id_key"
  ON "business_comments"("review_id");

ALTER TABLE "business_comments"
  ADD CONSTRAINT "business_comments_review_id_fkey"
  FOREIGN KEY ("review_id") REFERENCES "reviews"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- PostgreSQL treats NULL values as distinct in a normal composite unique key.
-- Partial unique indexes close that gap for each valid role scope without
-- changing or merging any historical assignment.
CREATE UNIQUE INDEX "user_roles_platform_scope_key"
  ON "user_roles"("user_id", "role_id")
  WHERE "business_id" IS NULL AND "branch_id" IS NULL;

CREATE UNIQUE INDEX "user_roles_business_scope_key"
  ON "user_roles"("user_id", "role_id", "business_id")
  WHERE "business_id" IS NOT NULL AND "branch_id" IS NULL;

CREATE UNIQUE INDEX "user_roles_branch_scope_key"
  ON "user_roles"("user_id", "role_id", "business_id", "branch_id")
  WHERE "business_id" IS NOT NULL AND "branch_id" IS NOT NULL;
