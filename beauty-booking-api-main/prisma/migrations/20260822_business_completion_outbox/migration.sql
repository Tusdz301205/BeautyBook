-- BB-BIZ-004: claim impact items before executing a resolution so concurrent
-- operators cannot apply the same business action twice.
ALTER TYPE "ImpactItemStatus" ADD VALUE IF NOT EXISTS 'PROCESSING' BEFORE 'RESOLVED';

-- Critical notifications are committed to an outbox in the same transaction
-- as the impact resolution and projected to the notifications table by a
-- retryable worker.
CREATE TYPE "NotificationOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "notification_outbox" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "target_type" TEXT,
    "target_id" TEXT,
    "action_url" TEXT,
    "metadata" JSONB,
    "related_booking_id" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "status" "NotificationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "notification_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_outbox_dedupe_key_key" ON "notification_outbox"("dedupe_key");
CREATE UNIQUE INDEX "notification_outbox_notification_id_key" ON "notification_outbox"("notification_id");
CREATE INDEX "notification_outbox_status_available_at_idx" ON "notification_outbox"("status", "available_at");
CREATE INDEX "notification_outbox_user_id_created_at_idx" ON "notification_outbox"("user_id", "created_at");

ALTER TABLE "notification_outbox"
  ADD CONSTRAINT "notification_outbox_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notification_outbox"
  ADD CONSTRAINT "notification_outbox_related_booking_id_fkey"
  FOREIGN KEY ("related_booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notification_outbox"
  ADD CONSTRAINT "notification_outbox_notification_id_fkey"
  FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
