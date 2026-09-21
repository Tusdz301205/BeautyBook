# Health/consultation archive — preflight

Database copy: `beautybook_test_restriction_2026091901`. No production DB writes. Archive preserves table OIDs, rows and existing constraints; no INSERT SELECT/fake rows.

| Model | Physical table | Rows | Incoming FK | Outgoing FK | Runtime usage / REMOVE reason | Archive mapping |
|---|---|---:|---|---|---|---|
| SensitiveConsent | sensitive_consents | 2 | booking_health_records_consent_id_fkey | sensitive_consents_customer_id_fkey | Retired health/consultation; no current production delegate/route consumer found; see trace below | archive_health_20260919.sensitive_consents |
| BookingHealthRecord | booking_health_records | 0 | None | booking_health_records_booking_id_fkey; booking_health_records_consent_id_fkey; booking_health_records_customer_id_fkey | Retired health/consultation; no current production delegate/route consumer found; see trace below | archive_health_20260919.booking_health_records |
| HealthRecordAccessLog | health_record_access_logs | 0 | None | None | Retired health/consultation; no current production delegate/route consumer found; see trace below | archive_health_20260919.health_record_access_logs |
| ConsultationFormTemplate | consultation_form_templates | 0 | consultation_form_versions_template_id_fkey; service_consultation_requirements_template_id_fkey | consultation_form_templates_branch_id_fkey; consultation_form_templates_business_id_fkey | Retired health/consultation; no current production delegate/route consumer found; see trace below | archive_health_20260919.consultation_form_templates |
| ConsultationFormVersion | consultation_form_versions | 0 | consultation_form_fields_version_id_fkey; consultation_submissions_version_id_fkey | consultation_form_versions_template_id_fkey | Retired health/consultation; no current production delegate/route consumer found; see trace below | archive_health_20260919.consultation_form_versions |
| ConsultationFormField | consultation_form_fields | 0 | consent_events_field_id_fkey; sensitive_answers_field_id_fkey | consultation_form_fields_version_id_fkey | Retired health/consultation; no current production delegate/route consumer found; see trace below | archive_health_20260919.consultation_form_fields |
| ServiceConsultationRequirement | service_consultation_requirements | 0 | None | service_consultation_requirements_service_id_fkey; service_consultation_requirements_template_id_fkey | Retired health/consultation; no current production delegate/route consumer found; see trace below | archive_health_20260919.service_consultation_requirements |
| ConsultationSubmission | consultation_submissions | 0 | consent_events_submission_id_fkey; sensitive_answers_submission_id_fkey; sensitive_data_access_events_submission_id_fkey | consultation_submissions_booking_id_fkey; consultation_submissions_branch_id_fkey; consultation_submissions_business_id_fkey; consultation_submissions_customer_id_fkey; consultation_submissions_service_id_fkey; consultation_submissions_version_id_fkey | Retired health/consultation; no current production delegate/route consumer found; see trace below | archive_health_20260919.consultation_submissions |
| SensitiveAnswer | sensitive_answers | 0 | sensitive_data_access_events_answer_id_fkey | sensitive_answers_field_id_fkey; sensitive_answers_submission_id_fkey | Retired health/consultation; no current production delegate/route consumer found; see trace below | archive_health_20260919.sensitive_answers |
| ConsentEvent | consent_events | 0 | consent_events_revoke_of_event_id_fkey | consent_events_booking_id_fkey; consent_events_branch_id_fkey; consent_events_business_id_fkey; consent_events_customer_id_fkey; consent_events_field_id_fkey; consent_events_revoke_of_event_id_fkey; consent_events_service_id_fkey; consent_events_submission_id_fkey | Retired health/consultation; no current production delegate/route consumer found; see trace below | archive_health_20260919.consent_events |
| SensitiveDataAccessEvent | sensitive_data_access_events | 0 | None | sensitive_data_access_events_answer_id_fkey; sensitive_data_access_events_booking_id_fkey; sensitive_data_access_events_branch_id_fkey; sensitive_data_access_events_break_glass_grant_id_fkey; sensitive_data_access_events_business_id_fkey; sensitive_data_access_events_submission_id_fkey | Retired health/consultation; no current production delegate/route consumer found; see trace below | archive_health_20260919.sensitive_data_access_events |
| SensitiveBreakGlassGrant | sensitive_break_glass_grants | 0 | sensitive_data_access_events_break_glass_grant_id_fkey | sensitive_break_glass_grants_booking_id_fkey; sensitive_break_glass_grants_branch_id_fkey; sensitive_break_glass_grants_business_id_fkey | Retired health/consultation; no current production delegate/route consumer found; see trace below | archive_health_20260919.sensitive_break_glass_grants |

## Source dependency trace

Exact model/table names and inverse relation aliases were scanned in BE/FE source, seeds, tests, migrations, scripts and OpenAPI. Hits below are evidence to classify, not automatic deletion authority.

- `beauty-booking-api-main/src/privacy/privacy-center.service.spec.ts:58` — expect(payload).not.toHaveProperty('consultationSubmissions');
- `beauty-booking-api-main/src/privacy/privacy-center.service.spec.ts:59` — expect(payload).not.toHaveProperty('healthRecords');
- `beauty-booking-api-main/prisma/migrations/20260713_add_health_records/migration.sql:2` — CREATE TYPE "ConsentScope" AS ENUM ('SKIN_CONDITION', 'ALLERGY', 'MEDICATION', 'PREGNANCY', 'GENERAL_HEALTH');
- `beauty-booking-api-main/prisma/migrations/20260713_add_health_records/migration.sql:8` — CREATE TABLE "sensitive_consents" (
- `beauty-booking-api-main/prisma/migrations/20260713_add_health_records/migration.sql:11` — "scope" "ConsentScope" NOT NULL,
- `beauty-booking-api-main/prisma/migrations/20260713_add_health_records/migration.sql:18` — CONSTRAINT "sensitive_consents_pkey" PRIMARY KEY ("id")
- `beauty-booking-api-main/prisma/migrations/20260713_add_health_records/migration.sql:22` — CREATE TABLE "booking_health_records" (
- `beauty-booking-api-main/prisma/migrations/20260713_add_health_records/migration.sql:33` — CONSTRAINT "booking_health_records_pkey" PRIMARY KEY ("id")
- `beauty-booking-api-main/prisma/migrations/20260713_add_health_records/migration.sql:37` — CREATE UNIQUE INDEX "sensitive_consents_customer_id_scope_key" ON "sensitive_consents"("customer_id", "scope");
- `beauty-booking-api-main/prisma/migrations/20260713_add_health_records/migration.sql:40` — CREATE INDEX "sensitive_consents_customer_id_idx" ON "sensitive_consents"("customer_id");
- `beauty-booking-api-main/prisma/migrations/20260713_add_health_records/migration.sql:43` — CREATE UNIQUE INDEX "booking_health_records_booking_id_field_key" ON "booking_health_records"("booking_id", "field");
- `beauty-booking-api-main/prisma/migrations/20260713_add_health_records/migration.sql:46` — CREATE INDEX "booking_health_records_customer_id_idx" ON "booking_health_records"("customer_id");
- `beauty-booking-api-main/prisma/migrations/20260713_add_health_records/migration.sql:49` — CREATE INDEX "booking_health_records_consent_id_idx" ON "booking_health_records"("consent_id");
- `beauty-booking-api-main/prisma/migrations/20260713_add_health_records/migration.sql:52` — ALTER TABLE "sensitive_consents" ADD CONSTRAINT "sensitive_consents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
- `beauty-booking-api-main/prisma/migrations/20260713_add_health_records/migration.sql:55` — ALTER TABLE "booking_health_records" ADD CONSTRAINT "booking_health_records_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
- `beauty-booking-api-main/prisma/migrations/20260713_add_health_records/migration.sql:58` — ALTER TABLE "booking_health_records" ADD CONSTRAINT "booking_health_records_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "sensitive_consents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
- `beauty-booking-api-main/prisma/migrations/20260713_add_health_records/migration.sql:61` — ALTER TABLE "booking_health_records" ADD CONSTRAINT "booking_health_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
- `beauty-booking-api-main/prisma/migrations/20260715_add_health_access_logs/migration.sql:1` — CREATE TABLE IF NOT EXISTS "health_record_access_logs" (
- `beauty-booking-api-main/prisma/migrations/20260715_add_health_access_logs/migration.sql:17` — CONSTRAINT "health_record_access_logs_pkey" PRIMARY KEY ("id")
- `beauty-booking-api-main/prisma/migrations/20260715_add_health_access_logs/migration.sql:20` — CREATE INDEX IF NOT EXISTS "health_record_access_logs_record_id_created_at_idx"
- `beauty-booking-api-main/prisma/migrations/20260715_add_health_access_logs/migration.sql:21` — ON "health_record_access_logs" ("record_id", "created_at");
- `beauty-booking-api-main/prisma/migrations/20260715_add_health_access_logs/migration.sql:22` — CREATE INDEX IF NOT EXISTS "health_record_access_logs_actor_id_created_at_idx"
- `beauty-booking-api-main/prisma/migrations/20260715_add_health_access_logs/migration.sql:23` — ON "health_record_access_logs" ("actor_id", "created_at");
- `beauty-booking-api-main/prisma/migrations/20260715_add_health_access_logs/migration.sql:24` — CREATE INDEX IF NOT EXISTS "health_record_access_logs_customer_id_created_at_idx"
- `beauty-booking-api-main/prisma/migrations/20260715_add_health_access_logs/migration.sql:25` — ON "health_record_access_logs" ("customer_id", "created_at");
- `beauty-booking-api-main/prisma/migrations/20260715_add_health_access_logs/migration.sql:26` — CREATE INDEX IF NOT EXISTS "health_record_access_logs_business_id_branch_id_created_at_idx"
- `beauty-booking-api-main/prisma/migrations/20260715_add_health_access_logs/migration.sql:27` — ON "health_record_access_logs" ("business_id", "branch_id", "created_at");
- `beauty-booking-api-main/prisma/migrations/20260715_add_health_access_logs/migration.sql:34` — RAISE EXCEPTION 'health_record_access_logs is append-only';
- `beauty-booking-api-main/prisma/migrations/20260715_add_health_access_logs/migration.sql:38` — DROP TRIGGER IF EXISTS health_access_logs_no_update ON "health_record_access_logs";
- `beauty-booking-api-main/prisma/migrations/20260715_add_health_access_logs/migration.sql:40` — BEFORE UPDATE ON "health_record_access_logs"
- `beauty-booking-api-main/prisma/migrations/20260715_add_health_access_logs/migration.sql:43` — DROP TRIGGER IF EXISTS health_access_logs_no_delete ON "health_record_access_logs";
- `beauty-booking-api-main/prisma/migrations/20260715_add_health_access_logs/migration.sql:45` — BEFORE DELETE ON "health_record_access_logs"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:6` — CREATE TYPE "ConsultationTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:9` — CREATE TYPE "ConsultationSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVOKED');
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:10` — CREATE TYPE "SensitiveAnswerValueType" AS ENUM ('TEXT', 'BOOLEAN', 'STRING_LIST', 'DATE');
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:11` — CREATE TYPE "ConsentEventAction" AS ENUM ('GRANTED', 'REVOKED');
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:100` — CREATE TABLE "consultation_form_templates" (
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:106` — "status" "ConsultationTemplateStatus" NOT NULL DEFAULT 'DRAFT',
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:110` — CONSTRAINT "consultation_form_templates_pkey" PRIMARY KEY ("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:113` — CREATE TABLE "consultation_form_versions" (
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:125` — CONSTRAINT "consultation_form_versions_pkey" PRIMARY KEY ("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:128` — CREATE TABLE "consultation_form_fields" (
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:140` — CONSTRAINT "consultation_form_fields_pkey" PRIMARY KEY ("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:143` — CREATE TABLE "service_consultation_requirements" (
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:151` — CONSTRAINT "service_consultation_requirements_pkey" PRIMARY KEY ("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:154` — CREATE TABLE "consultation_submissions" (
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:162` — "status" "ConsultationSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:169` — CONSTRAINT "consultation_submissions_pkey" PRIMARY KEY ("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:172` — CREATE TABLE "sensitive_answers" (
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:177` — "value_type" "SensitiveAnswerValueType" NOT NULL,
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:184` — CONSTRAINT "sensitive_answers_pkey" PRIMARY KEY ("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:187` — CREATE TABLE "consent_events" (
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:197` — "action" "ConsentEventAction" NOT NULL,
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:209` — CONSTRAINT "consent_events_pkey" PRIMARY KEY ("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:212` — CREATE TABLE "sensitive_data_access_events" (
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:227` — CONSTRAINT "sensitive_data_access_events_pkey" PRIMARY KEY ("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:230` — CREATE TABLE "sensitive_break_glass_grants" (
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:242` — CONSTRAINT "sensitive_break_glass_grants_pkey" PRIMARY KEY ("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:288` — CREATE UNIQUE INDEX "consultation_form_versions_template_id_version_key"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:289` — ON "consultation_form_versions"("template_id", "version");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:290` — CREATE UNIQUE INDEX "consultation_form_fields_version_id_field_key_key"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:291` — ON "consultation_form_fields"("version_id", "field_key");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:292` — CREATE UNIQUE INDEX "service_consultation_requirements_service_id_key"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:293` — ON "service_consultation_requirements"("service_id");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:294` — CREATE UNIQUE INDEX "consultation_submissions_booking_id_service_id_key"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:295` — ON "consultation_submissions"("booking_id", "service_id");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:296` — CREATE UNIQUE INDEX "sensitive_answers_submission_id_field_id_key"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:297` — ON "sensitive_answers"("submission_id", "field_id");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:298` — CREATE UNIQUE INDEX "consent_events_revoke_of_event_id_key"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:299` — ON "consent_events"("revoke_of_event_id");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:307` — CREATE INDEX "consultation_form_templates_business_id_status_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:308` — ON "consultation_form_templates"("business_id", "status");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:309` — CREATE INDEX "consultation_form_templates_branch_id_status_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:310` — ON "consultation_form_templates"("branch_id", "status");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:311` — CREATE INDEX "consultation_form_versions_template_id_published_at_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:312` — ON "consultation_form_versions"("template_id", "published_at");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:313` — CREATE INDEX "consultation_form_fields_version_id_sort_order_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:314` — ON "consultation_form_fields"("version_id", "sort_order");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:315` — CREATE INDEX "service_consultation_requirements_template_id_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:316` — ON "service_consultation_requirements"("template_id");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:317` — CREATE INDEX "consultation_submissions_customer_id_created_at_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:318` — ON "consultation_submissions"("customer_id", "created_at");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:319` — CREATE INDEX "consultation_submissions_business_id_branch_id_status_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:320` — ON "consultation_submissions"("business_id", "branch_id", "status");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:321` — CREATE INDEX "consultation_submissions_retention_until_legal_hold_reason_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:322` — ON "consultation_submissions"("retention_until", "legal_hold_reason");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:323` — CREATE INDEX "sensitive_answers_data_category_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:324` — ON "sensitive_answers"("data_category");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:325` — CREATE INDEX "consent_events_customer_id_created_at_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:326` — ON "consent_events"("customer_id", "created_at");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:327` — CREATE INDEX "consent_events_booking_id_service_id_created_at_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:328` — ON "consent_events"("booking_id", "service_id", "created_at");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:329` — CREATE INDEX "consent_events_business_id_branch_id_created_at_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:330` — ON "consent_events"("business_id", "branch_id", "created_at");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:331` — CREATE INDEX "consent_events_submission_id_action_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:332` — ON "consent_events"("submission_id", "action");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:333` — CREATE INDEX "sensitive_data_access_events_submission_id_created_at_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:334` — ON "sensitive_data_access_events"("submission_id", "created_at");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:335` — CREATE INDEX "sensitive_data_access_events_actor_id_created_at_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:336` — ON "sensitive_data_access_events"("actor_id", "created_at");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:337` — CREATE INDEX "sensitive_data_access_events_business_id_branch_id_created_at_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:338` — ON "sensitive_data_access_events"("business_id", "branch_id", "created_at");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:339` — CREATE INDEX "sensitive_break_glass_grants_actor_id_booking_id_expires_at_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:340` — ON "sensitive_break_glass_grants"("actor_id", "booking_id", "expires_at");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:341` — CREATE INDEX "sensitive_break_glass_grants_business_id_branch_id_created_at_idx"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:342` — ON "sensitive_break_glass_grants"("business_id", "branch_id", "created_at");
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:352` — ALTER TABLE "consultation_form_templates"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:353` — ADD CONSTRAINT "consultation_form_templates_business_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:356` — ALTER TABLE "consultation_form_templates"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:357` — ADD CONSTRAINT "consultation_form_templates_branch_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:360` — ALTER TABLE "consultation_form_versions"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:361` — ADD CONSTRAINT "consultation_form_versions_template_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:362` — FOREIGN KEY ("template_id") REFERENCES "consultation_form_templates"("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:364` — ALTER TABLE "consultation_form_fields"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:365` — ADD CONSTRAINT "consultation_form_fields_version_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:366` — FOREIGN KEY ("version_id") REFERENCES "consultation_form_versions"("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:368` — ALTER TABLE "service_consultation_requirements"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:369` — ADD CONSTRAINT "service_consultation_requirements_template_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:370` — FOREIGN KEY ("template_id") REFERENCES "consultation_form_templates"("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:372` — ALTER TABLE "service_consultation_requirements"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:373` — ADD CONSTRAINT "service_consultation_requirements_service_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:376` — ALTER TABLE "consultation_submissions"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:377` — ADD CONSTRAINT "consultation_submissions_version_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:378` — FOREIGN KEY ("version_id") REFERENCES "consultation_form_versions"("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:380` — ALTER TABLE "consultation_submissions"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:381` — ADD CONSTRAINT "consultation_submissions_customer_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:384` — ALTER TABLE "consultation_submissions"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:385` — ADD CONSTRAINT "consultation_submissions_business_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:388` — ALTER TABLE "consultation_submissions"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:389` — ADD CONSTRAINT "consultation_submissions_branch_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:392` — ALTER TABLE "consultation_submissions"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:393` — ADD CONSTRAINT "consultation_submissions_booking_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:396` — ALTER TABLE "consultation_submissions"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:397` — ADD CONSTRAINT "consultation_submissions_service_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:400` — ALTER TABLE "sensitive_answers"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:401` — ADD CONSTRAINT "sensitive_answers_submission_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:402` — FOREIGN KEY ("submission_id") REFERENCES "consultation_submissions"("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:404` — ALTER TABLE "sensitive_answers"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:405` — ADD CONSTRAINT "sensitive_answers_field_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:406` — FOREIGN KEY ("field_id") REFERENCES "consultation_form_fields"("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:408` — ALTER TABLE "consent_events"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:409` — ADD CONSTRAINT "consent_events_submission_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:410` — FOREIGN KEY ("submission_id") REFERENCES "consultation_submissions"("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:412` — ALTER TABLE "consent_events"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:413` — ADD CONSTRAINT "consent_events_field_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:414` — FOREIGN KEY ("field_id") REFERENCES "consultation_form_fields"("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:416` — ALTER TABLE "consent_events"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:417` — ADD CONSTRAINT "consent_events_revoke_of_event_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:418` — FOREIGN KEY ("revoke_of_event_id") REFERENCES "consent_events"("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:420` — ALTER TABLE "consent_events"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:421` — ADD CONSTRAINT "consent_events_customer_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:424` — ALTER TABLE "consent_events"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:425` — ADD CONSTRAINT "consent_events_business_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:428` — ALTER TABLE "consent_events"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:429` — ADD CONSTRAINT "consent_events_branch_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:432` — ALTER TABLE "consent_events"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:433` — ADD CONSTRAINT "consent_events_booking_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:436` — ALTER TABLE "consent_events"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:437` — ADD CONSTRAINT "consent_events_service_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:440` — ALTER TABLE "sensitive_data_access_events"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:441` — ADD CONSTRAINT "sensitive_data_access_events_submission_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:442` — FOREIGN KEY ("submission_id") REFERENCES "consultation_submissions"("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:444` — ALTER TABLE "sensitive_data_access_events"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:445` — ADD CONSTRAINT "sensitive_data_access_events_answer_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:446` — FOREIGN KEY ("answer_id") REFERENCES "sensitive_answers"("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:448` — ALTER TABLE "sensitive_data_access_events"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:449` — ADD CONSTRAINT "sensitive_data_access_events_business_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:452` — ALTER TABLE "sensitive_data_access_events"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:453` — ADD CONSTRAINT "sensitive_data_access_events_branch_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:456` — ALTER TABLE "sensitive_data_access_events"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:457` — ADD CONSTRAINT "sensitive_data_access_events_booking_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:460` — ALTER TABLE "sensitive_data_access_events"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:461` — ADD CONSTRAINT "sensitive_data_access_events_break_glass_grant_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:462` — FOREIGN KEY ("break_glass_grant_id") REFERENCES "sensitive_break_glass_grants"("id")
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:464` — ALTER TABLE "sensitive_break_glass_grants"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:465` — ADD CONSTRAINT "sensitive_break_glass_grants_business_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:468` — ALTER TABLE "sensitive_break_glass_grants"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:469` — ADD CONSTRAINT "sensitive_break_glass_grants_branch_id_fkey"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:472` — ALTER TABLE "sensitive_break_glass_grants"
- `beauty-booking-api-main/prisma/migrations/20260726_p0_tenant_guest_security/migration.sql:473` — ADD CONSTRAINT "sensitive_break_glass_grants_booking_id_fkey"
- `beauty-booking-api-main/prisma/schema.prisma:246` — healthRecords           BookingHealthRecord[]
- `beauty-booking-api-main/prisma/schema.prisma:253` — consents                SensitiveConsent[]
- `beauty-booking-api-main/prisma/schema.prisma:254` — consultationSubmissions ConsultationSubmission[]
- `beauty-booking-api-main/prisma/schema.prisma:255` — consentEvents           ConsentEvent[]
- `beauty-booking-api-main/prisma/schema.prisma:424` — consultationTemplates     ConsultationFormTemplate[]
- `beauty-booking-api-main/prisma/schema.prisma:425` — consultationSubmissions   ConsultationSubmission[]
- `beauty-booking-api-main/prisma/schema.prisma:426` — consultationConsentEvents ConsentEvent[]
- `beauty-booking-api-main/prisma/schema.prisma:427` — sensitiveAccessEvents     SensitiveDataAccessEvent[]
- `beauty-booking-api-main/prisma/schema.prisma:428` — sensitiveBreakGlassGrants SensitiveBreakGlassGrant[]
- `beauty-booking-api-main/prisma/schema.prisma:512` — consultationTemplates     ConsultationFormTemplate[]
- `beauty-booking-api-main/prisma/schema.prisma:513` — consultationSubmissions   ConsultationSubmission[]
- `beauty-booking-api-main/prisma/schema.prisma:514` — consultationConsentEvents ConsentEvent[]
- `beauty-booking-api-main/prisma/schema.prisma:515` — sensitiveAccessEvents     SensitiveDataAccessEvent[]
- `beauty-booking-api-main/prisma/schema.prisma:516` — sensitiveBreakGlassGrants SensitiveBreakGlassGrant[]
- `beauty-booking-api-main/prisma/schema.prisma:869` — consultationRequirement   ServiceConsultationRequirement?
- `beauty-booking-api-main/prisma/schema.prisma:870` — consultationSubmissions   ConsultationSubmission[]
- `beauty-booking-api-main/prisma/schema.prisma:871` — consultationConsentEvents ConsentEvent[]
- `beauty-booking-api-main/prisma/schema.prisma:1058` — healthRecords             BookingHealthRecord[]
- `beauty-booking-api-main/prisma/schema.prisma:1071` — consultationSubmissions   ConsultationSubmission[]
- `beauty-booking-api-main/prisma/schema.prisma:1072` — consultationConsentEvents ConsentEvent[]
- `beauty-booking-api-main/prisma/schema.prisma:1073` — sensitiveAccessEvents     SensitiveDataAccessEvent[]
- `beauty-booking-api-main/prisma/schema.prisma:1074` — sensitiveBreakGlassGrants SensitiveBreakGlassGrant[]
- `beauty-booking-api-main/prisma/schema.prisma:2121` — model SensitiveConsent {
- `beauty-booking-api-main/prisma/schema.prisma:2124` — scope         ConsentScope
- `beauty-booking-api-main/prisma/schema.prisma:2130` — healthRecords BookingHealthRecord[]
- `beauty-booking-api-main/prisma/schema.prisma:2135` — @@map("sensitive_consents")
- `beauty-booking-api-main/prisma/schema.prisma:2138` — model BookingHealthRecord {
- `beauty-booking-api-main/prisma/schema.prisma:2151` — consent        SensitiveConsent   @relation(fields: [consentId], references: [id])
- `beauty-booking-api-main/prisma/schema.prisma:2157` — @@map("booking_health_records")
- `beauty-booking-api-main/prisma/schema.prisma:2160` — model HealthRecordAccessLog {
- `beauty-booking-api-main/prisma/schema.prisma:2181` — @@map("health_record_access_logs")
- `beauty-booking-api-main/prisma/schema.prisma:2184` — model ConsultationFormTemplate {
- `beauty-booking-api-main/prisma/schema.prisma:2190` — status       ConsultationTemplateStatus       @default(DRAFT)
- `beauty-booking-api-main/prisma/schema.prisma:2194` — versions     ConsultationFormVersion[]
- `beauty-booking-api-main/prisma/schema.prisma:2195` — requirements ServiceConsultationRequirement[]
- `beauty-booking-api-main/prisma/schema.prisma:2201` — @@map("consultation_form_templates")
- `beauty-booking-api-main/prisma/schema.prisma:2204` — model ConsultationFormVersion {
- `beauty-booking-api-main/prisma/schema.prisma:2216` — template             ConsultationFormTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
- `beauty-booking-api-main/prisma/schema.prisma:2217` — fields               ConsultationFormField[]
- `beauty-booking-api-main/prisma/schema.prisma:2218` — submissions          ConsultationSubmission[]
- `beauty-booking-api-main/prisma/schema.prisma:2222` — @@map("consultation_form_versions")
- `beauty-booking-api-main/prisma/schema.prisma:2225` — model ConsultationFormField {
- `beauty-booking-api-main/prisma/schema.prisma:2237` — version       ConsultationFormVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
- `beauty-booking-api-main/prisma/schema.prisma:2238` — answers       SensitiveAnswer[]
- `beauty-booking-api-main/prisma/schema.prisma:2239` — consentEvents ConsentEvent[]
- `beauty-booking-api-main/prisma/schema.prisma:2243` — @@map("consultation_form_fields")
- `beauty-booking-api-main/prisma/schema.prisma:2246` — model ServiceConsultationRequirement {
- `beauty-booking-api-main/prisma/schema.prisma:2254` — template   ConsultationFormTemplate     @relation(fields: [templateId], references: [id], onDelete: Cascade)
- `beauty-booking-api-main/prisma/schema.prisma:2258` — @@map("service_consultation_requirements")
- `beauty-booking-api-main/prisma/schema.prisma:2261` — model ConsultationSubmission {
- `beauty-booking-api-main/prisma/schema.prisma:2269` — status          ConsultationSubmissionStatus @default(DRAFT)
- `beauty-booking-api-main/prisma/schema.prisma:2276` — version         ConsultationFormVersion      @relation(fields: [versionId], references: [id])
- `beauty-booking-api-main/prisma/schema.prisma:2277` — answers         SensitiveAnswer[]
- `beauty-booking-api-main/prisma/schema.prisma:2278` — consentEvents   ConsentEvent[]
- `beauty-booking-api-main/prisma/schema.prisma:2279` — accessEvents    SensitiveDataAccessEvent[]
- `beauty-booking-api-main/prisma/schema.prisma:2290` — @@map("consultation_submissions")
- `beauty-booking-api-main/prisma/schema.prisma:2293` — model SensitiveAnswer {
- `beauty-booking-api-main/prisma/schema.prisma:2298` — valueType         SensitiveAnswerValueType   @map("value_type")
- `beauty-booking-api-main/prisma/schema.prisma:2305` — submission        ConsultationSubmission     @relation(fields: [submissionId], references: [id], onDelete: Cascade)
- `beauty-booking-api-main/prisma/schema.prisma:2306` — field             ConsultationFormField      @relation(fields: [fieldId], references: [id])
- `beauty-booking-api-main/prisma/schema.prisma:2307` — accessEvents      SensitiveDataAccessEvent[]
- `beauty-booking-api-main/prisma/schema.prisma:2311` — @@map("sensitive_answers")
- `beauty-booking-api-main/prisma/schema.prisma:2314` — model ConsentEvent {
- `beauty-booking-api-main/prisma/schema.prisma:2324` — action          ConsentEventAction
- `beauty-booking-api-main/prisma/schema.prisma:2336` — submission      ConsultationSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
- `beauty-booking-api-main/prisma/schema.prisma:2337` — field           ConsultationFormField? @relation(fields: [fieldId], references: [id])
- `beauty-booking-api-main/prisma/schema.prisma:2338` — revokeOf        ConsentEvent?          @relation("ConsentEventRevocation", fields: [revokeOfEventId], references: [id], onDelete: SetNull)
- `beauty-booking-api-main/prisma/schema.prisma:2339` — revokedBy       ConsentEvent?          @relation("ConsentEventRevocation")
- `beauty-booking-api-main/prisma/schema.prisma:2350` — @@map("consent_events")
- `beauty-booking-api-main/prisma/schema.prisma:2353` — model SensitiveDataAccessEvent {
- `beauty-booking-api-main/prisma/schema.prisma:2368` — submission        ConsultationSubmission    @relation(fields: [submissionId], references: [id], onDelete: Restrict)
- `beauty-booking-api-main/prisma/schema.prisma:2369` — answer            SensitiveAnswer?          @relation(fields: [answerId], references: [id], onDelete: SetNull)
- `beauty-booking-api-main/prisma/schema.prisma:2373` — breakGlassGrant   SensitiveBreakGlassGrant? @relation(fields: [breakGlassGrantId], references: [id], onDelete: SetNull)
- `beauty-booking-api-main/prisma/schema.prisma:2378` — @@map("sensitive_data_access_events")
- `beauty-booking-api-main/prisma/schema.prisma:2381` — model SensitiveBreakGlassGrant {
- `beauty-booking-api-main/prisma/schema.prisma:2396` — accessEvents SensitiveDataAccessEvent[]
- `beauty-booking-api-main/prisma/schema.prisma:2400` — @@map("sensitive_break_glass_grants")
- `beauty-booking-api-main/prisma/schema.prisma:3794` — enum ConsentScope {
- `beauty-booking-api-main/prisma/schema.prisma:3802` — enum ConsultationTemplateStatus {
- `beauty-booking-api-main/prisma/schema.prisma:3823` — enum ConsultationSubmissionStatus {
- `beauty-booking-api-main/prisma/schema.prisma:3829` — enum SensitiveAnswerValueType {
- `beauty-booking-api-main/prisma/schema.prisma:3836` — enum ConsentEventAction {
- `beauty-booking-api-main/scripts/audit-health-archive.mjs:38` — assert.equal(rows.find(r=>r.model==='SensitiveConsent').count,2,'Expected two original consent records; stop for review');
- `beauty-booking-api-main/scripts/audit-health-archive.mjs:50` — console.log(JSON.stringify({tables:rows.length,consents:2,sourceHits:hits.length,sqlFunctions:dependentSql.map(f=>f.proname)}));
- `beauty-booking-api-main/scripts/health-archive-manifest.mjs:3` — SensitiveConsent: 'sensitive_consents',
- `beauty-booking-api-main/scripts/health-archive-manifest.mjs:4` — BookingHealthRecord: 'booking_health_records',
- `beauty-booking-api-main/scripts/health-archive-manifest.mjs:5` — HealthRecordAccessLog: 'health_record_access_logs',
- `beauty-booking-api-main/scripts/health-archive-manifest.mjs:6` — ConsultationFormTemplate: 'consultation_form_templates',
- `beauty-booking-api-main/scripts/health-archive-manifest.mjs:7` — ConsultationFormVersion: 'consultation_form_versions',
- `beauty-booking-api-main/scripts/health-archive-manifest.mjs:8` — ConsultationFormField: 'consultation_form_fields',
- `beauty-booking-api-main/scripts/health-archive-manifest.mjs:9` — ServiceConsultationRequirement: 'service_consultation_requirements',
- `beauty-booking-api-main/scripts/health-archive-manifest.mjs:10` — ConsultationSubmission: 'consultation_submissions',
- `beauty-booking-api-main/scripts/health-archive-manifest.mjs:11` — SensitiveAnswer: 'sensitive_answers',
- `beauty-booking-api-main/scripts/health-archive-manifest.mjs:12` — ConsentEvent: 'consent_events',
- `beauty-booking-api-main/scripts/health-archive-manifest.mjs:13` — SensitiveDataAccessEvent: 'sensitive_data_access_events',
- `beauty-booking-api-main/scripts/health-archive-manifest.mjs:14` — SensitiveBreakGlassGrant: 'sensitive_break_glass_grants',
- `beauty-booking-api-main/scripts/health-archive-manifest.mjs:16` — export const retiredEnums = ['ConsentScope', 'SensitiveDataField', 'ConsultationTemplateStatus',
- `beauty-booking-api-main/scripts/health-archive-manifest.mjs:17` — 'ConsultationFieldType', 'ConsultationCompletionTiming', 'ConsultationSubmissionStatus',
- `beauty-booking-api-main/scripts/health-archive-manifest.mjs:18` — 'SensitiveAnswerValueType', 'ConsentEventAction', 'ConsentRecipientType', 'SensitiveAccessResult'];
- `beauty-booking-api-main/scripts/render-schema-cleanup-plan.mjs:11` — '- SensitiveConsent còn 2 dòng; các bảng khác trong nhóm đang rỗng trên DB được đọc. Không suy rộng số liệu này sang môi trường khác.',
- `beauty-booking-api-main/scripts/render-schema-cleanup-plan.mjs:41` — '3. Backup native PostgreSQL, kiểm tra restore trên fresh copy; lưu counts/fingerprint cả graph và 4.000 booking trước/sau. Không vô hiệu trigger bất biến của HealthRecordAccessLog để xóa dữ liệu.',

## Database stored functions mentioning the tables

### prevent_health_access_log_mutation

```sql
CREATE OR REPLACE FUNCTION public.prevent_health_access_log_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'health_record_access_logs is append-only';
END;
$function$

```
