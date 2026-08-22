-- Keep one customer from holding two overlapping active appointments. As with
-- the staff-slot guard, the lock and overlap check run inside PostgreSQL so
-- they remain correct when several API instances accept traffic at once.
CREATE OR REPLACE FUNCTION "enforce_booking_customer_slot"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."deleted_at" IS NOT NULL
     OR NEW."status" NOT IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS') THEN
    RETURN NEW;
  END IF;

  IF NEW."appointment_end_time" <= NEW."appointment_start_time" THEN
    RAISE EXCEPTION 'Booking interval must have a positive duration'
      USING ERRCODE = '22007',
            CONSTRAINT = 'bookings_valid_appointment_interval';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('beautybook_booking_customer_slot'),
    hashtext(NEW."customer_id")
  );

  IF EXISTS (
    SELECT 1
    FROM "bookings" AS existing
    WHERE existing."id" <> NEW."id"
      AND existing."customer_id" = NEW."customer_id"
      AND existing."appointment_date" = NEW."appointment_date"
      AND existing."appointment_start_time" < NEW."appointment_end_time"
      AND existing."appointment_end_time" > NEW."appointment_start_time"
      AND existing."deleted_at" IS NULL
      AND existing."status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
  ) THEN
    RAISE EXCEPTION 'Customer already has a booking in this time range'
      USING ERRCODE = '23P01',
            CONSTRAINT = 'bookings_customer_slot_no_overlap';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "bookings_customer_slot_guard"
  ON "bookings";

CREATE TRIGGER "bookings_customer_slot_guard"
BEFORE INSERT OR UPDATE OF
  "customer_id",
  "appointment_date",
  "appointment_start_time",
  "appointment_end_time",
  "status",
  "deleted_at"
ON "bookings"
FOR EACH ROW
EXECUTE FUNCTION "enforce_booking_customer_slot"();
