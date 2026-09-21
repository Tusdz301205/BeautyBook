-- Preserve actual archive rows without blocking unrelated FK cascades that
-- affect zero archived rows. TRUNCATE still needs statement-level protection.
BEGIN;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sensitive_consents','booking_health_records','health_record_access_logs',
    'consultation_form_templates','consultation_form_versions','consultation_form_fields',
    'service_consultation_requirements','consultation_submissions','sensitive_answers',
    'consent_events','sensitive_data_access_events','sensitive_break_glass_grants']
  LOOP
    EXECUTE format('DROP TRIGGER retired_health_archive_read_only ON archive_health_20260919.%I', t);
    EXECUTE format('CREATE TRIGGER retired_health_archive_read_only BEFORE INSERT OR UPDATE OR DELETE ON archive_health_20260919.%I FOR EACH ROW EXECUTE FUNCTION archive_health_20260919.reject_archive_mutation()',t);
    EXECUTE format('CREATE TRIGGER retired_health_archive_no_truncate BEFORE TRUNCATE ON archive_health_20260919.%I FOR EACH STATEMENT EXECUTE FUNCTION archive_health_20260919.reject_archive_mutation()',t);
  END LOOP;
END $$;
COMMIT;
