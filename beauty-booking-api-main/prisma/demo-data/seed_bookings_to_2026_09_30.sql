-- Additive, idempotent demo data for 2026-09-16 through 2026-09-30.
-- It intentionally creates no payment records.
BEGIN;

CREATE TEMP TABLE september_booking_seed ON COMMIT DROP AS
WITH staff_service AS (
  SELECT DISTINCT ON (branch."id", staff."id")
    branch."id" AS branch_id,
    owner_profile."user_id" AS owner_user_id,
    staff."id" AS staff_id,
    offering."id" AS service_id,
    offering."business_service_id",
    business_service."canonical_service_id",
    offering."name" AS service_name,
    offering."price",
    offering."duration_minutes"
  FROM "branches" AS branch
  INNER JOIN "businesses" AS business
    ON business."id" = branch."business_id"
  INNER JOIN "business_owner_profiles" AS owner_profile
    ON owner_profile."id" = business."owner_id"
  INNER JOIN "staff_profiles" AS staff
    ON staff."branch_id" = branch."id"
  INNER JOIN "staff_services" AS staff_service
    ON staff_service."staff_id" = staff."id"
  INNER JOIN "services" AS offering
    ON offering."id" = staff_service."service_id"
   AND offering."branch_id" = branch."id"
  INNER JOIN "business_services" AS business_service
    ON business_service."id" = offering."business_service_id"
  WHERE business."status" = 'ACTIVE'
    AND business."deleted_at" IS NULL
    AND branch."status" = 'ACTIVE'
    AND branch."operational_status" = 'ACTIVE'
    AND branch."deleted_at" IS NULL
    AND staff."status" = 'ACTIVE'
    AND staff."is_bookable" = true
    AND offering."status" = 'ACTIVE'
    AND offering."deleted_at" IS NULL
    AND business_service."status" = 'ACTIVE'
    AND business_service."deleted_at" IS NULL
  ORDER BY branch."id", staff."id", offering."id"
),
ranked_staff AS (
  SELECT staff_service.*,
    row_number() OVER (
      PARTITION BY staff_service.branch_id
      ORDER BY staff_service.staff_id
    ) AS slot_number
  FROM staff_service
),
dated_candidates AS (
  SELECT
    gen_random_uuid()::text AS booking_id,
    date_value::date AS appointment_date,
    ranked_staff.*,
    row_number() OVER (
      ORDER BY date_value, ranked_staff.branch_id, ranked_staff.slot_number
    ) AS candidate_number
  FROM generate_series(
    DATE '2026-09-16',
    DATE '2026-09-30',
    INTERVAL '1 day'
  ) AS date_value
  CROSS JOIN ranked_staff
  WHERE ranked_staff.slot_number <= 2
),
customer_pool AS (
  SELECT customer."id" AS customer_id,
    customer."user_id" AS customer_user_id,
    row_number() OVER (ORDER BY customer."id") AS customer_number
  FROM "customer_profiles" AS customer
),
customer_total AS (
  SELECT count(*)::bigint AS total FROM customer_pool
),
prepared AS (
  SELECT
    candidate.*,
    customer.customer_id,
    customer.customer_user_id,
    CASE candidate.slot_number
      WHEN 1 THEN TIME '09:00'
      ELSE TIME '14:00'
    END AS start_time,
    'BB-DEMO-SEP26-' || to_char(candidate.appointment_date, 'YYYYMMDD')
      || '-' || left(candidate.branch_id, 8)
      || '-' || candidate.slot_number::text AS booking_code,
    now() - ((candidate.candidate_number % 6) * INTERVAL '20 minutes') AS created_at
  FROM dated_candidates AS candidate
  CROSS JOIN customer_total
  INNER JOIN customer_pool AS customer
    ON customer.customer_number = ((candidate.candidate_number - 1) % customer_total.total) + 1
)
SELECT prepared.*
FROM prepared
WHERE NOT EXISTS (
  SELECT 1
  FROM "bookings" AS existing
  WHERE existing."booking_code" = prepared.booking_code
);

INSERT INTO "bookings" (
  "id",
  "customer_id",
  "branch_id",
  "booking_code",
  "appointment_date",
  "appointment_start_time",
  "appointment_end_time",
  "status",
  "source",
  "total_amount",
  "final_amount",
  "voucher_discount_amount",
  "sensitive_data_consent",
  "created_at",
  "updated_at"
)
SELECT
  seed.booking_id,
  seed.customer_id,
  seed.branch_id,
  seed.booking_code,
  seed.appointment_date,
  seed.start_time,
  (seed.start_time + seed.duration_minutes * INTERVAL '1 minute')::time,
  'CONFIRMED',
  'ONLINE_WEB',
  seed.price,
  seed.price,
  0,
  false,
  seed.created_at,
  seed.created_at + INTERVAL '5 minutes'
FROM september_booking_seed AS seed;

INSERT INTO "booking_services" (
  "id",
  "booking_id",
  "service_id",
  "business_service_id",
  "canonical_service_id",
  "staff_id",
  "price_at_booking",
  "duration_minutes",
  "service_name_snapshot",
  "sort_order",
  "status",
  "item_start_at",
  "item_end_at",
  "transition_minutes",
  "revision",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  seed.booking_id,
  seed.service_id,
  seed.business_service_id,
  seed.canonical_service_id,
  seed.staff_id,
  seed.price,
  seed.duration_minutes,
  seed.service_name,
  0,
  'SCHEDULED',
  seed.appointment_date + seed.start_time,
  seed.appointment_date + seed.start_time + seed.duration_minutes * INTERVAL '1 minute',
  0,
  1,
  seed.created_at,
  seed.created_at + INTERVAL '5 minutes'
FROM september_booking_seed AS seed;

INSERT INTO "booking_status_histories" (
  "id", "booking_id", "status", "changed_by", "note", "created_at"
)
SELECT
  gen_random_uuid()::text,
  seed.booking_id,
  'PENDING'::"BookingStatus",
  seed.customer_user_id,
  'Khách đặt lịch demo tháng 9',
  seed.created_at
FROM september_booking_seed AS seed
UNION ALL
SELECT
  gen_random_uuid()::text,
  seed.booking_id,
  'CONFIRMED'::"BookingStatus",
  seed.owner_user_id,
  'Cơ sở xác nhận lịch demo tháng 9',
  seed.created_at + INTERVAL '5 minutes'
FROM september_booking_seed AS seed;

COMMIT;
