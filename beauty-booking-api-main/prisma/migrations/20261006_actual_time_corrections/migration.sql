-- Additive only. No planned, financial or historical lifecycle rows are rewritten.
CREATE TYPE "ActualTimingStatus" AS ENUM ('KNOWN', 'UNKNOWN');

CREATE TABLE "booking_service_actual_time_corrections" (
  "id" TEXT PRIMARY KEY,
  "booking_service_id" TEXT NOT NULL REFERENCES booking_services(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "version" INTEGER NOT NULL CHECK (version > 0),
  "actual_started_at" TIMESTAMP(3),
  "actual_completed_at" TIMESTAMP(3),
  "actual_timing_status" "ActualTimingStatus" NOT NULL,
  "old_actual_started_at" TIMESTAMP(3),
  "old_actual_completed_at" TIMESTAMP(3),
  "old_actual_timing_status" "ActualTimingStatus" NOT NULL,
  "old_item_status" "BookingServiceStatus" NOT NULL,
  "new_item_status" "BookingServiceStatus" NOT NULL DEFAULT 'COMPLETED',
  "reason" TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
  "actor_id" TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "corrected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT actual_time_correction_interval CHECK (
    (actual_timing_status='UNKNOWN' AND actual_started_at IS NULL AND actual_completed_at IS NULL)
    OR (actual_timing_status='KNOWN' AND actual_started_at IS NOT NULL AND actual_completed_at IS NOT NULL
      AND actual_started_at < actual_completed_at AND actual_completed_at <= corrected_at)
  ),
  CONSTRAINT actual_time_correction_completed CHECK (new_item_status='COMPLETED')
);
CREATE UNIQUE INDEX booking_service_actual_time_corrections_booking_service_id_version_key
  ON booking_service_actual_time_corrections(booking_service_id,version);
CREATE INDEX booking_service_actual_time_corrections_booking_service_id_corrected_at_idx
  ON booking_service_actual_time_corrections(booking_service_id,corrected_at);

CREATE FUNCTION forbid_actual_time_correction_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Actual time correction history is append-only' USING ERRCODE='23514';
END $$;
CREATE TRIGGER actual_time_correction_append_only BEFORE UPDATE OR DELETE
  ON booking_service_actual_time_corrections FOR EACH ROW EXECUTE FUNCTION forbid_actual_time_correction_rewrite();

CREATE TABLE "booking_actual_time_grants" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "business_id" TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "branch_id" TEXT REFERENCES branches(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "granted_by" TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "reason" TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "revoked_by" TEXT REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "revoke_reason" TEXT,
  CHECK (expires_at IS NULL OR expires_at > granted_at),
  CHECK ((revoked_at IS NULL AND revoked_by IS NULL AND revoke_reason IS NULL)
    OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND revoke_reason IS NOT NULL AND length(btrim(revoke_reason)) BETWEEN 1 AND 2000))
);
CREATE INDEX booking_actual_time_grants_user_id_business_id_branch_id_revoked_at_expires_at_idx
  ON booking_actual_time_grants(user_id,business_id,branch_id,revoked_at,expires_at);

CREATE FUNCTION validate_actual_time_grant_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.user_id,NEW.business_id,NEW.branch_id,NEW.granted_by,NEW.granted_at,NEW.expires_at,NEW.reason)
    IS DISTINCT FROM (OLD.user_id,OLD.business_id,OLD.branch_id,OLD.granted_by,OLD.granted_at,OLD.expires_at,OLD.reason) THEN
    RAISE EXCEPTION 'Scoped correction grants cannot be retargeted' USING ERRCODE='23514';
  END IF;
  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM branches WHERE id=NEW.branch_id AND business_id=NEW.business_id
  ) THEN
    RAISE EXCEPTION 'Correction grant branch must belong to its business' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Revoked correction grants are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER actual_time_grant_scope BEFORE INSERT OR UPDATE
  ON booking_actual_time_grants FOR EACH ROW EXECUTE FUNCTION validate_actual_time_grant_scope();

INSERT INTO permissions(id,code,description,resource,action,scope)
  VALUES ('e0894e26-7c25-4dce-aa29-e9b287bf5101','booking.actual_time.correct',
    'Đính chính thời gian thực tế với lịch sử bổ sung và phạm vi được xác minh','booking','actual_time.correct','TENANT')
  ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id)
  SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
  WHERE r.code='BUSINESS_OWNER' AND p.code='booking.actual_time.correct'
  ON CONFLICT DO NOTHING;
