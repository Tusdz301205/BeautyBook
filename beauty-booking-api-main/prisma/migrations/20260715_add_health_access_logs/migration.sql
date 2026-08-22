CREATE TABLE IF NOT EXISTS "health_record_access_logs" (
  "id" UUID NOT NULL,
  "actor_id" UUID,
  "actor_role" TEXT,
  "record_id" UUID,
  "booking_id" UUID,
  "customer_id" UUID,
  "business_id" UUID,
  "branch_id" UUID,
  "consent_id" UUID,
  "purpose" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "health_record_access_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "health_record_access_logs_record_id_created_at_idx"
  ON "health_record_access_logs" ("record_id", "created_at");
CREATE INDEX IF NOT EXISTS "health_record_access_logs_actor_id_created_at_idx"
  ON "health_record_access_logs" ("actor_id", "created_at");
CREATE INDEX IF NOT EXISTS "health_record_access_logs_customer_id_created_at_idx"
  ON "health_record_access_logs" ("customer_id", "created_at");
CREATE INDEX IF NOT EXISTS "health_record_access_logs_business_id_branch_id_created_at_idx"
  ON "health_record_access_logs" ("business_id", "branch_id", "created_at");

-- Append-only enforcement: application roles may insert and read, but not
-- rewrite or delete historical access evidence.
CREATE OR REPLACE FUNCTION prevent_health_access_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'health_record_access_logs is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS health_access_logs_no_update ON "health_record_access_logs";
CREATE TRIGGER health_access_logs_no_update
BEFORE UPDATE ON "health_record_access_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_health_access_log_mutation();

DROP TRIGGER IF EXISTS health_access_logs_no_delete ON "health_record_access_logs";
CREATE TRIGGER health_access_logs_no_delete
BEFORE DELETE ON "health_record_access_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_health_access_log_mutation();
