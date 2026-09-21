-- Additive. No historical event is converted into a restriction on deployment.
CREATE TABLE "customer_booking_policies" (
  "id" TEXT PRIMARY KEY,
  "customer_id" TEXT NOT NULL REFERENCES customer_profiles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "business_id" TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "revision" INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "triggered_by_violation_event_id" TEXT REFERENCES booking_violation_events(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT customer_booking_policy_dates CHECK (
    (starts_at IS NULL AND ends_at IS NULL AND triggered_by_violation_event_id IS NULL)
    OR (starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at > starts_at AND triggered_by_violation_event_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX customer_booking_policies_customer_id_business_id_key ON customer_booking_policies(customer_id,business_id);
CREATE UNIQUE INDEX customer_booking_policies_triggered_by_violation_event_id_key ON customer_booking_policies(triggered_by_violation_event_id);
CREATE INDEX customer_booking_policies_business_id_ends_at_idx ON customer_booking_policies(business_id,ends_at);

CREATE FUNCTION validate_customer_booking_policy_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.triggered_by_violation_event_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM booking_violation_events e WHERE e.id=NEW.triggered_by_violation_event_id
      AND e.customer_id=NEW.customer_id AND e.business_id=NEW.business_id
      AND e.voided_at IS NULL AND NEW.ends_at=e.occurred_at+INTERVAL '30 days'
  ) THEN
    RAISE EXCEPTION 'Restriction requires a valid same-scope event and a 30-day end date' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER customer_booking_policy_scope BEFORE INSERT OR UPDATE OF starts_at,ends_at,triggered_by_violation_event_id
ON customer_booking_policies FOR EACH ROW EXECUTE FUNCTION validate_customer_booking_policy_scope();
