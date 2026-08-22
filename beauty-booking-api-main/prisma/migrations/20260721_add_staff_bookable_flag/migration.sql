ALTER TABLE "staff_profiles"
ADD COLUMN "is_bookable" BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve booking capability only for actual service-provider accounts and
-- account-less provider profiles. Operational roles remain opt-in.
UPDATE "staff_profiles" AS sp
SET "is_bookable" = TRUE
WHERE sp."deleted_at" IS NULL
  AND sp."status" = 'ACTIVE'
  AND EXISTS (
    SELECT 1 FROM "staff_services" AS ss WHERE ss."staff_id" = sp."id"
  )
  AND (
    sp."user_id" IS NULL
    OR EXISTS (
      SELECT 1
      FROM "user_roles" AS ur
      JOIN "roles" AS r ON r."id" = ur."role_id"
      WHERE ur."user_id" = sp."user_id"
        AND r."code" = 'STAFF'
        AND (ur."expires_at" IS NULL OR ur."expires_at" > NOW())
    )
  );

CREATE INDEX "staff_profiles_branch_id_status_is_bookable_public_visible_idx"
ON "staff_profiles"("branch_id", "status", "is_bookable", "public_visible");
