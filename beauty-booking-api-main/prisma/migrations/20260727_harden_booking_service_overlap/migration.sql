-- Enforce staff-slot exclusivity in PostgreSQL itself. The advisory lock is
-- acquired inside the INSERT/UPDATE statement, so it remains correct across
-- multiple API instances and does not depend on application-side connection
-- scheduling.
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

  -- Serialize every reservation mutation for one staff member. The database
  -- check below then observes the committed winner before accepting a waiter.
  PERFORM pg_advisory_xact_lock(
    hashtext('beautybook_booking_staff_slot'),
    hashtext(NEW."staff_id")
  );

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

DROP TRIGGER IF EXISTS "booking_services_staff_slot_guard"
  ON "booking_services";

CREATE TRIGGER "booking_services_staff_slot_guard"
BEFORE INSERT OR UPDATE OF
  "booking_id",
  "staff_id",
  "status",
  "item_start_at",
  "item_end_at"
ON "booking_services"
FOR EACH ROW
EXECUTE FUNCTION "enforce_booking_service_staff_slot"();
