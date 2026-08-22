-- Controlled backfill: only create a missing active assignment when the
-- StaffProfile primary branch exactly matches an active branch-scoped role.
-- Ambiguous/cross-branch cases are deliberately left untouched for review.
INSERT INTO "staff_branch_assignments" (
  "id", "staff_id", "branch_id", "start_date", "end_date", "status",
  "job_title", "is_primary", "is_bookable", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  sp."id",
  sp."branch_id",
  COALESCE(sp."created_at"::date, CURRENT_DATE),
  NULL,
  'ACTIVE'::"StaffAssignmentStatus",
  sp."position",
  TRUE,
  sp."is_bookable",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "staff_profiles" sp
WHERE sp."user_id" IS NOT NULL
  AND sp."deleted_at" IS NULL
  AND sp."status" NOT IN ('INACTIVE', 'LOCKED')
  AND EXISTS (
    SELECT 1
    FROM "user_roles" ur
    JOIN "roles" r ON r."id" = ur."role_id"
    WHERE ur."user_id" = sp."user_id"
      AND ur."branch_id" = sp."branch_id"
      AND (ur."expires_at" IS NULL OR ur."expires_at" > CURRENT_TIMESTAMP)
      AND r."code" IN ('STAFF', 'RECEPTIONIST', 'BRANCH_MANAGER')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "staff_branch_assignments" sba
    WHERE sba."staff_id" = sp."id"
      AND sba."branch_id" = sp."branch_id"
      AND sba."status" = 'ACTIVE'
  );
