-- Rehearsal first. Namespace relocation, never copy/delete historical rows.
BEGIN;
CREATE SCHEMA archive_health_20260919;
REVOKE ALL ON SCHEMA archive_health_20260919 FROM PUBLIC;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sensitive_consents','booking_health_records','health_record_access_logs',
    'consultation_form_templates','consultation_form_versions','consultation_form_fields',
    'service_consultation_requirements','consultation_submissions','sensitive_answers',
    'consent_events','sensitive_data_access_events','sensitive_break_glass_grants']
  LOOP
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', t);
    EXECUTE format('ALTER TABLE public.%I SET SCHEMA archive_health_20260919', t);
  END LOOP;
END $$;

ALTER TYPE public."ConsentScope" SET SCHEMA archive_health_20260919;
ALTER TYPE public."SensitiveDataField" SET SCHEMA archive_health_20260919;
ALTER TYPE public."ConsultationTemplateStatus" SET SCHEMA archive_health_20260919;
ALTER TYPE public."ConsultationFieldType" SET SCHEMA archive_health_20260919;
ALTER TYPE public."ConsultationCompletionTiming" SET SCHEMA archive_health_20260919;
ALTER TYPE public."ConsultationSubmissionStatus" SET SCHEMA archive_health_20260919;
ALTER TYPE public."SensitiveAnswerValueType" SET SCHEMA archive_health_20260919;
ALTER TYPE public."ConsentEventAction" SET SCHEMA archive_health_20260919;
ALTER TYPE public."ConsentRecipientType" SET SCHEMA archive_health_20260919;
ALTER TYPE public."SensitiveAccessResult" SET SCHEMA archive_health_20260919;
-- Preserve the existing append-only function and both triggers by OID.
ALTER FUNCTION public.prevent_health_access_log_mutation() SET SCHEMA archive_health_20260919;

CREATE FUNCTION archive_health_20260919.reject_archive_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Retired health archive is immutable; use reviewed recovery procedure' USING ERRCODE='55000';
END $$;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sensitive_consents','booking_health_records','health_record_access_logs',
    'consultation_form_templates','consultation_form_versions','consultation_form_fields',
    'service_consultation_requirements','consultation_submissions','sensitive_answers',
    'consent_events','sensitive_data_access_events','sensitive_break_glass_grants']
  LOOP
    EXECUTE format('CREATE TRIGGER retired_health_archive_read_only BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON archive_health_20260919.%I FOR EACH STATEMENT EXECUTE FUNCTION archive_health_20260919.reject_archive_mutation()',t);
  END LOOP;
END $$;
COMMIT;
