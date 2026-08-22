CREATE INDEX IF NOT EXISTS "branches_status_deleted_at_created_at_idx"
  ON "branches" ("status", "deleted_at", "created_at");

CREATE INDEX IF NOT EXISTS "services_branch_id_status_deleted_at_created_at_idx"
  ON "services" ("branch_id", "status", "deleted_at", "created_at");

CREATE INDEX IF NOT EXISTS "reviews_status_deleted_at_booking_id_idx"
  ON "reviews" ("status", "deleted_at", "booking_id");
