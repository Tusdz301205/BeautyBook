-- Recovery recipe, NOT an automatic deploy migration. Application must be stopped.
-- Move the same objects back. DROP below affects only newly added guard/empty schema.
BEGIN;
DO $$ BEGIN
  IF current_database() !~ '^beautybook_test_restriction_20260919[0-9]+$' THEN
    RAISE EXCEPTION 'Recovery rehearsal is restricted to a dedicated copy; live recovery needs a separately approved compensating migration';
  END IF;
END $$;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sensitive_consents','booking_health_records','health_record_access_logs',
    'consultation_form_templates','consultation_form_versions','consultation_form_fields',
    'service_consultation_requirements','consultation_submissions','sensitive_answers',
    'consent_events','sensitive_data_access_events','sensitive_break_glass_grants']
  LOOP
    EXECUTE format('LOCK TABLE archive_health_20260919.%I IN ACCESS EXCLUSIVE MODE', t);
    EXECUTE format('DROP TRIGGER retired_health_archive_read_only ON archive_health_20260919.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS retired_health_archive_no_truncate ON archive_health_20260919.%I', t);
    EXECUTE format('ALTER TABLE archive_health_20260919.%I SET SCHEMA public', t);
  END LOOP;
END $$;
ALTER TYPE archive_health_20260919."ConsentScope" SET SCHEMA public;
ALTER TYPE archive_health_20260919."SensitiveDataField" SET SCHEMA public;
ALTER TYPE archive_health_20260919."ConsultationTemplateStatus" SET SCHEMA public;
ALTER TYPE archive_health_20260919."ConsultationFieldType" SET SCHEMA public;
ALTER TYPE archive_health_20260919."ConsultationCompletionTiming" SET SCHEMA public;
ALTER TYPE archive_health_20260919."ConsultationSubmissionStatus" SET SCHEMA public;
ALTER TYPE archive_health_20260919."SensitiveAnswerValueType" SET SCHEMA public;
ALTER TYPE archive_health_20260919."ConsentEventAction" SET SCHEMA public;
ALTER TYPE archive_health_20260919."ConsentRecipientType" SET SCHEMA public;
ALTER TYPE archive_health_20260919."SensitiveAccessResult" SET SCHEMA public;
ALTER FUNCTION archive_health_20260919.prevent_health_access_log_mutation() SET SCHEMA public;
DROP FUNCTION archive_health_20260919.reject_archive_mutation();
DROP SCHEMA archive_health_20260919 RESTRICT;
COMMIT;
