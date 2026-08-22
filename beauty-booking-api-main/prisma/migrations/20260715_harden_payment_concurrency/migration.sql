-- Preserve multiple failed/pending attempts while guaranteeing that a booking
-- can have at most one settled payment across concurrent collectors.
CREATE UNIQUE INDEX IF NOT EXISTS "payments_one_settled_per_booking"
ON "payments" ("booking_id")
WHERE "status" IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED');
