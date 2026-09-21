-- Additive only. No legacy booking/request/status is converted into a penalty.
CREATE TYPE "BookingViolationKind" AS ENUM ('LATE_CANCELLATION', 'NO_SHOW');
CREATE TABLE "booking_violation_events" (
  "id" TEXT PRIMARY KEY,
  "booking_id" TEXT NOT NULL REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "customer_id" TEXT NOT NULL REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "business_id" TEXT NOT NULL REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "source_request_id" TEXT REFERENCES "appointment_change_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "kind" "BookingViolationKind" NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "appointment_start_at" TIMESTAMP(3) NOT NULL,
  "recorded_by_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "policy_version" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voided_at" TIMESTAMP(3),
  "voided_by_id" TEXT REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "void_reason" TEXT,
  CONSTRAINT "booking_violation_source_check" CHECK (
    (kind = 'LATE_CANCELLATION' AND source_request_id IS NOT NULL AND occurred_at < appointment_start_at AND occurred_at > appointment_start_at - INTERVAL '4 hours')
    OR (kind = 'NO_SHOW' AND source_request_id IS NULL AND occurred_at > appointment_start_at + INTERVAL '15 minutes')
  ),
  CONSTRAINT "booking_violation_void_check" CHECK (
    (voided_at IS NULL AND voided_by_id IS NULL AND void_reason IS NULL)
    OR (voided_at IS NOT NULL AND voided_by_id IS NOT NULL AND COALESCE(length(trim(void_reason)), 0) >= 3)
  )
);
CREATE UNIQUE INDEX "booking_violation_events_source_request_id_key" ON "booking_violation_events"("source_request_id");
CREATE UNIQUE INDEX "booking_violation_one_valid_event" ON "booking_violation_events"("booking_id") WHERE "voided_at" IS NULL;
CREATE INDEX "booking_violation_events_booking_id_idx" ON "booking_violation_events"("booking_id");
CREATE INDEX "booking_violation_events_customer_id_business_id_occurred_at_idx" ON "booking_violation_events"("customer_id", "business_id", "occurred_at");

CREATE FUNCTION validate_booking_violation_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bookings b JOIN branches br ON br.id = b.branch_id
    WHERE b.id = NEW.booking_id AND b.customer_id = NEW.customer_id AND br.business_id = NEW.business_id) THEN
    RAISE EXCEPTION 'Violation scope does not match booking' USING ERRCODE = '23514';
  END IF;
  IF NEW.kind = 'LATE_CANCELLATION' AND NOT EXISTS (
    SELECT 1 FROM appointment_change_requests r JOIN customer_profiles c ON c.id = NEW.customer_id
    WHERE r.id = NEW.source_request_id AND r.booking_id = NEW.booking_id
      AND r.request_type = 'CANCEL' AND r.requested_by_type = 'CUSTOMER'
      AND r.requested_by = c.user_id AND NEW.recorded_by_id = c.user_id AND r.created_at = NEW.occurred_at
  ) THEN
    RAISE EXCEPTION 'Invalid late cancellation source' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER booking_violation_source_valid BEFORE INSERT ON booking_violation_events
FOR EACH ROW EXECUTE FUNCTION validate_booking_violation_source();

CREATE FUNCTION protect_booking_violation_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Violation evidence must be preserved; use an audited invalidation' USING ERRCODE = '23514';
  END IF;
  IF NEW.booking_id IS DISTINCT FROM OLD.booking_id OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.business_id IS DISTINCT FROM OLD.business_id OR NEW.source_request_id IS DISTINCT FROM OLD.source_request_id
    OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
    OR NEW.appointment_start_at IS DISTINCT FROM OLD.appointment_start_at OR NEW.recorded_by_id IS DISTINCT FROM OLD.recorded_by_id
    OR NEW.policy_version IS DISTINCT FROM OLD.policy_version OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.id IS DISTINCT FROM OLD.id OR OLD.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Violation evidence is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER booking_violation_evidence_immutable BEFORE UPDATE OR DELETE ON booking_violation_events
FOR EACH ROW EXECUTE FUNCTION protect_booking_violation_evidence();
