-- Reject the losing request immediately instead of waiting on a driver-owned
-- connection. This keeps the same database-level guarantee and remains
-- compatible with pg 9's stricter single-query-per-client behavior.
CREATE OR REPLACE FUNCTION "enforce_booking_service_staff_slot"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_booking_status "BookingStatus";
BEGIN
  IF NEW."staff_id" IS NULL
     OR NEW."item_start_at" IS NULL
     OR NEW."item_end_at" IS NULL
     OR NEW."status" NOT IN ('SCHEDULED', 'IN_PROGRESS') THEN
    RETURN NEW;
  END IF;

  SELECT b."status"
  INTO current_booking_status
  FROM "bookings" AS b
  WHERE b."id" = NEW."booking_id"
    AND b."deleted_at" IS NULL;

  IF current_booking_status IS NULL
     OR current_booking_status NOT IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS') THEN
    RETURN NEW;
  END IF;

  IF NEW."item_end_at" <= NEW."item_start_at" THEN
    RAISE EXCEPTION 'Booking service interval must have a positive duration'
      USING ERRCODE = '22007',
            CONSTRAINT = 'booking_services_valid_item_interval';
  END IF;

  IF NOT pg_try_advisory_xact_lock(
    hashtext('beautybook_booking_staff_slot'),
    hashtext(NEW."staff_id")
  ) THEN
    RAISE EXCEPTION 'A reservation for this staff member is being processed'
      USING ERRCODE = '23P01',
            CONSTRAINT = 'booking_services_staff_slot_no_overlap';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "booking_services" AS existing
    INNER JOIN "bookings" AS booking
      ON booking."id" = existing."booking_id"
    WHERE existing."id" <> NEW."id"
      AND existing."staff_id" = NEW."staff_id"
      AND existing."status" IN ('SCHEDULED', 'IN_PROGRESS')
      AND existing."item_start_at" IS NOT NULL
      AND existing."item_end_at" IS NOT NULL
      AND existing."item_start_at" < NEW."item_end_at"
      AND existing."item_end_at" > NEW."item_start_at"
      AND booking."deleted_at" IS NULL
      AND booking."status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
  ) THEN
    RAISE EXCEPTION 'Staff member already has a booking in this time range'
      USING ERRCODE = '23P01',
            CONSTRAINT = 'booking_services_staff_slot_no_overlap';
  END IF;

  RETURN NEW;
END;
$$;

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

  IF NOT pg_try_advisory_xact_lock(
    hashtext('beautybook_booking_customer_slot'),
    hashtext(NEW."customer_id")
  ) THEN
    RAISE EXCEPTION 'A reservation for this customer is being processed'
      USING ERRCODE = '23P01',
            CONSTRAINT = 'bookings_customer_slot_no_overlap';
  END IF;

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
