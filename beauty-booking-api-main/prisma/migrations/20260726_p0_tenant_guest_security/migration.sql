ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'READ';
ALTER TYPE "VoucherStatus" ADD VALUE IF NOT EXISTS 'RESERVED';
ALTER TYPE "RecurringPlanStatus" ADD VALUE IF NOT EXISTS 'CREATING';
ALTER TYPE "RecurringPlanStatus" ADD VALUE IF NOT EXISTS 'FAILED';

CREATE TYPE "ConsultationTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ConsultationFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'BOOLEAN', 'SINGLE_SELECT', 'MULTI_SELECT', 'DATE');
CREATE TYPE "ConsultationCompletionTiming" AS ENUM ('BEFORE_APPOINTMENT', 'AT_CHECK_IN', 'BEFORE_SERVICE');
CREATE TYPE "ConsultationSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVOKED');
CREATE TYPE "SensitiveAnswerValueType" AS ENUM ('TEXT', 'BOOLEAN', 'STRING_LIST', 'DATE');
CREATE TYPE "ConsentEventAction" AS ENUM ('GRANTED', 'REVOKED');
CREATE TYPE "ConsentRecipientType" AS ENUM ('ASSIGNED_STAFF', 'BRANCH_SPECIALIST');
CREATE TYPE "SensitiveAccessResult" AS ENUM ('GRANTED', 'DENIED', 'REDACTED');
CREATE TYPE "DataSubjectRequestType" AS ENUM ('EXPORT', 'RECTIFICATION', 'ERASURE', 'RESTRICT_PROCESSING', 'OBJECT_PROCESSING', 'DELETE_ACCOUNT');
CREATE TYPE "DataSubjectRequestStatus" AS ENUM ('RECEIVED', 'IDENTITY_VERIFICATION', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

CREATE TABLE "booking_contacts" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_contacts_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "customer_vouchers"
ADD COLUMN "reserved_at" TIMESTAMP(3);

ALTER TABLE "refund_requests"
ADD COLUMN "processing_started_at" TIMESTAMP(3),
ADD COLUMN "processed_by" TEXT,
ADD COLUMN "settlement_reference" TEXT,
ADD COLUMN "failure_reason" TEXT;

ALTER TABLE "recurring_booking_plans"
ADD COLUMN "created_occurrence_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "failure_reason" TEXT;

ALTER TABLE "trust_actions"
ADD COLUMN "restore_of_action_id" TEXT;

CREATE UNIQUE INDEX "booking_contacts_booking_id_key"
ON "booking_contacts"("booking_id");

CREATE INDEX "booking_contacts_phone_idx"
ON "booking_contacts"("phone");

CREATE UNIQUE INDEX "refund_requests_settlement_reference_key"
ON "refund_requests"("settlement_reference");

CREATE UNIQUE INDEX "trust_actions_restore_of_action_id_key"
ON "trust_actions"("restore_of_action_id");

ALTER TABLE "trust_actions"
ADD CONSTRAINT "trust_actions_restore_of_action_id_fkey"
FOREIGN KEY ("restore_of_action_id") REFERENCES "trust_actions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "user_roles" AS ur
SET "business_id" = b."business_id"
FROM "branches" AS b
WHERE ur."branch_id" = b."id"
  AND ur."business_id" IS DISTINCT FROM b."business_id";

CREATE OR REPLACE FUNCTION validate_user_role_scope()
RETURNS trigger AS $$
DECLARE
  role_code TEXT;
  branch_business_id TEXT;
BEGIN
  SELECT "code"::TEXT INTO role_code FROM "roles" WHERE "id" = NEW."role_id";

  IF role_code IN ('BRANCH_MANAGER', 'RECEPTIONIST', 'STAFF')
     AND NEW."branch_id" IS NULL THEN
    RAISE EXCEPTION 'branch-scoped role % requires branch_id', role_code;
  END IF;

  IF NEW."branch_id" IS NOT NULL THEN
    SELECT "business_id" INTO branch_business_id
    FROM "branches" WHERE "id" = NEW."branch_id";
    IF NEW."business_id" IS NULL OR NEW."business_id" <> branch_business_id THEN
      RAISE EXCEPTION 'user role branch and business scope do not match';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "user_roles_scope_guard" ON "user_roles";
CREATE TRIGGER "user_roles_scope_guard"
BEFORE INSERT OR UPDATE OF "role_id", "business_id", "branch_id"
ON "user_roles"
FOR EACH ROW EXECUTE FUNCTION validate_user_role_scope();

CREATE TABLE "consultation_form_templates" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "ConsultationTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "consultation_form_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consultation_form_versions" (
  "id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "notice_version" TEXT NOT NULL,
  "notice_hash" TEXT NOT NULL,
  "notice_content" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "recipient_description" TEXT NOT NULL,
  "retention_days" INTEGER NOT NULL DEFAULT 365,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consultation_form_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consultation_form_fields" (
  "id" TEXT NOT NULL,
  "version_id" TEXT NOT NULL,
  "field_key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "field_type" "ConsultationFieldType" NOT NULL,
  "data_category" "SensitiveDataField",
  "required" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "max_length" INTEGER,
  CONSTRAINT "consultation_form_fields_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_consultation_requirements" (
  "id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "timing" "ConsultationCompletionTiming" NOT NULL DEFAULT 'BEFORE_APPOINTMENT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_consultation_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consultation_submissions" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "version_id" TEXT NOT NULL,
  "status" "ConsultationSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
  "requires_review" BOOLEAN NOT NULL DEFAULT false,
  "submitted_at" TIMESTAMP(3),
  "retention_until" TIMESTAMP(3) NOT NULL,
  "legal_hold_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "consultation_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sensitive_answers" (
  "id" TEXT NOT NULL,
  "submission_id" TEXT NOT NULL,
  "field_id" TEXT NOT NULL,
  "data_category" "SensitiveDataField",
  "value_type" "SensitiveAnswerValueType" NOT NULL,
  "value_ciphertext" TEXT NOT NULL,
  "encryption_iv" TEXT NOT NULL,
  "authentication_tag" TEXT NOT NULL,
  "key_version" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sensitive_answers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consent_events" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "submission_id" TEXT NOT NULL,
  "field_id" TEXT,
  "data_category" "SensitiveDataField",
  "action" "ConsentEventAction" NOT NULL,
  "purpose" TEXT NOT NULL,
  "recipient_type" "ConsentRecipientType" NOT NULL,
  "recipient_id" TEXT,
  "assigned_staff_id" TEXT,
  "notice_version" TEXT NOT NULL,
  "notice_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoke_of_event_id" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consent_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sensitive_data_access_events" (
  "id" TEXT NOT NULL,
  "submission_id" TEXT NOT NULL,
  "answer_id" TEXT,
  "actor_id" TEXT NOT NULL,
  "actor_role" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "result" "SensitiveAccessResult" NOT NULL,
  "break_glass_grant_id" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sensitive_data_access_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sensitive_break_glass_grants" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "granted_by" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sensitive_break_glass_grants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_subject_requests" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "type" "DataSubjectRequestType" NOT NULL,
  "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'RECEIVED',
  "reason" TEXT,
  "identity_verified_at" TIMESTAMP(3),
  "legal_hold_reason" TEXT,
  "resolution" TEXT,
  "deadline_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_preferences" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "email_marketing" BOOLEAN NOT NULL DEFAULT false,
  "sms_marketing" BOOLEAN NOT NULL DEFAULT false,
  "push_marketing" BOOLEAN NOT NULL DEFAULT false,
  "personalized_promotions" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketing_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "privacy_export_packages" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "download_token_hash" TEXT NOT NULL,
  "payload_ciphertext" TEXT NOT NULL,
  "encryption_iv" TEXT NOT NULL,
  "authentication_tag" TEXT NOT NULL,
  "key_version" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "downloaded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "privacy_export_packages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consultation_form_versions_template_id_version_key"
ON "consultation_form_versions"("template_id", "version");
CREATE UNIQUE INDEX "consultation_form_fields_version_id_field_key_key"
ON "consultation_form_fields"("version_id", "field_key");
CREATE UNIQUE INDEX "service_consultation_requirements_service_id_key"
ON "service_consultation_requirements"("service_id");
CREATE UNIQUE INDEX "consultation_submissions_booking_id_service_id_key"
ON "consultation_submissions"("booking_id", "service_id");
CREATE UNIQUE INDEX "sensitive_answers_submission_id_field_id_key"
ON "sensitive_answers"("submission_id", "field_id");
CREATE UNIQUE INDEX "consent_events_revoke_of_event_id_key"
ON "consent_events"("revoke_of_event_id");
CREATE UNIQUE INDEX "marketing_preferences_customer_id_key"
ON "marketing_preferences"("customer_id");
CREATE UNIQUE INDEX "privacy_export_packages_request_id_key"
ON "privacy_export_packages"("request_id");
CREATE UNIQUE INDEX "privacy_export_packages_download_token_hash_key"
ON "privacy_export_packages"("download_token_hash");

CREATE INDEX "consultation_form_templates_business_id_status_idx"
ON "consultation_form_templates"("business_id", "status");
CREATE INDEX "consultation_form_templates_branch_id_status_idx"
ON "consultation_form_templates"("branch_id", "status");
CREATE INDEX "consultation_form_versions_template_id_published_at_idx"
ON "consultation_form_versions"("template_id", "published_at");
CREATE INDEX "consultation_form_fields_version_id_sort_order_idx"
ON "consultation_form_fields"("version_id", "sort_order");
CREATE INDEX "service_consultation_requirements_template_id_idx"
ON "service_consultation_requirements"("template_id");
CREATE INDEX "consultation_submissions_customer_id_created_at_idx"
ON "consultation_submissions"("customer_id", "created_at");
CREATE INDEX "consultation_submissions_business_id_branch_id_status_idx"
ON "consultation_submissions"("business_id", "branch_id", "status");
CREATE INDEX "consultation_submissions_retention_until_legal_hold_reason_idx"
ON "consultation_submissions"("retention_until", "legal_hold_reason");
CREATE INDEX "sensitive_answers_data_category_idx"
ON "sensitive_answers"("data_category");
CREATE INDEX "consent_events_customer_id_created_at_idx"
ON "consent_events"("customer_id", "created_at");
CREATE INDEX "consent_events_booking_id_service_id_created_at_idx"
ON "consent_events"("booking_id", "service_id", "created_at");
CREATE INDEX "consent_events_business_id_branch_id_created_at_idx"
ON "consent_events"("business_id", "branch_id", "created_at");
CREATE INDEX "consent_events_submission_id_action_idx"
ON "consent_events"("submission_id", "action");
CREATE INDEX "sensitive_data_access_events_submission_id_created_at_idx"
ON "sensitive_data_access_events"("submission_id", "created_at");
CREATE INDEX "sensitive_data_access_events_actor_id_created_at_idx"
ON "sensitive_data_access_events"("actor_id", "created_at");
CREATE INDEX "sensitive_data_access_events_business_id_branch_id_created_at_idx"
ON "sensitive_data_access_events"("business_id", "branch_id", "created_at");
CREATE INDEX "sensitive_break_glass_grants_actor_id_booking_id_expires_at_idx"
ON "sensitive_break_glass_grants"("actor_id", "booking_id", "expires_at");
CREATE INDEX "sensitive_break_glass_grants_business_id_branch_id_created_at_idx"
ON "sensitive_break_glass_grants"("business_id", "branch_id", "created_at");
CREATE INDEX "data_subject_requests_customer_id_created_at_idx"
ON "data_subject_requests"("customer_id", "created_at");
CREATE INDEX "data_subject_requests_status_deadline_at_idx"
ON "data_subject_requests"("status", "deadline_at");
CREATE INDEX "privacy_export_packages_customer_id_created_at_idx"
ON "privacy_export_packages"("customer_id", "created_at");
CREATE INDEX "privacy_export_packages_expires_at_idx"
ON "privacy_export_packages"("expires_at");

ALTER TABLE "consultation_form_templates"
ADD CONSTRAINT "consultation_form_templates_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consultation_form_templates"
ADD CONSTRAINT "consultation_form_templates_branch_id_fkey"
FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consultation_form_versions"
ADD CONSTRAINT "consultation_form_versions_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "consultation_form_templates"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consultation_form_fields"
ADD CONSTRAINT "consultation_form_fields_version_id_fkey"
FOREIGN KEY ("version_id") REFERENCES "consultation_form_versions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_consultation_requirements"
ADD CONSTRAINT "service_consultation_requirements_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "consultation_form_templates"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_consultation_requirements"
ADD CONSTRAINT "service_consultation_requirements_service_id_fkey"
FOREIGN KEY ("service_id") REFERENCES "services"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consultation_submissions"
ADD CONSTRAINT "consultation_submissions_version_id_fkey"
FOREIGN KEY ("version_id") REFERENCES "consultation_form_versions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultation_submissions"
ADD CONSTRAINT "consultation_submissions_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultation_submissions"
ADD CONSTRAINT "consultation_submissions_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultation_submissions"
ADD CONSTRAINT "consultation_submissions_branch_id_fkey"
FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultation_submissions"
ADD CONSTRAINT "consultation_submissions_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultation_submissions"
ADD CONSTRAINT "consultation_submissions_service_id_fkey"
FOREIGN KEY ("service_id") REFERENCES "services"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sensitive_answers"
ADD CONSTRAINT "sensitive_answers_submission_id_fkey"
FOREIGN KEY ("submission_id") REFERENCES "consultation_submissions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sensitive_answers"
ADD CONSTRAINT "sensitive_answers_field_id_fkey"
FOREIGN KEY ("field_id") REFERENCES "consultation_form_fields"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consent_events"
ADD CONSTRAINT "consent_events_submission_id_fkey"
FOREIGN KEY ("submission_id") REFERENCES "consultation_submissions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consent_events"
ADD CONSTRAINT "consent_events_field_id_fkey"
FOREIGN KEY ("field_id") REFERENCES "consultation_form_fields"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consent_events"
ADD CONSTRAINT "consent_events_revoke_of_event_id_fkey"
FOREIGN KEY ("revoke_of_event_id") REFERENCES "consent_events"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consent_events"
ADD CONSTRAINT "consent_events_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consent_events"
ADD CONSTRAINT "consent_events_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consent_events"
ADD CONSTRAINT "consent_events_branch_id_fkey"
FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consent_events"
ADD CONSTRAINT "consent_events_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consent_events"
ADD CONSTRAINT "consent_events_service_id_fkey"
FOREIGN KEY ("service_id") REFERENCES "services"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sensitive_data_access_events"
ADD CONSTRAINT "sensitive_data_access_events_submission_id_fkey"
FOREIGN KEY ("submission_id") REFERENCES "consultation_submissions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sensitive_data_access_events"
ADD CONSTRAINT "sensitive_data_access_events_answer_id_fkey"
FOREIGN KEY ("answer_id") REFERENCES "sensitive_answers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sensitive_data_access_events"
ADD CONSTRAINT "sensitive_data_access_events_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sensitive_data_access_events"
ADD CONSTRAINT "sensitive_data_access_events_branch_id_fkey"
FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sensitive_data_access_events"
ADD CONSTRAINT "sensitive_data_access_events_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sensitive_data_access_events"
ADD CONSTRAINT "sensitive_data_access_events_break_glass_grant_id_fkey"
FOREIGN KEY ("break_glass_grant_id") REFERENCES "sensitive_break_glass_grants"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sensitive_break_glass_grants"
ADD CONSTRAINT "sensitive_break_glass_grants_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sensitive_break_glass_grants"
ADD CONSTRAINT "sensitive_break_glass_grants_branch_id_fkey"
FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sensitive_break_glass_grants"
ADD CONSTRAINT "sensitive_break_glass_grants_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "data_subject_requests"
ADD CONSTRAINT "data_subject_requests_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_preferences"
ADD CONSTRAINT "marketing_preferences_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "privacy_export_packages"
ADD CONSTRAINT "privacy_export_packages_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "privacy_export_packages"
ADD CONSTRAINT "privacy_export_packages_request_id_fkey"
FOREIGN KEY ("request_id") REFERENCES "data_subject_requests"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
