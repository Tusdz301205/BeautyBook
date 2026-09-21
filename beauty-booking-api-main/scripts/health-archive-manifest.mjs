export const archiveSchema = 'archive_health_20260919';
export const models = {
  SensitiveConsent: 'sensitive_consents',
  BookingHealthRecord: 'booking_health_records',
  HealthRecordAccessLog: 'health_record_access_logs',
  ConsultationFormTemplate: 'consultation_form_templates',
  ConsultationFormVersion: 'consultation_form_versions',
  ConsultationFormField: 'consultation_form_fields',
  ServiceConsultationRequirement: 'service_consultation_requirements',
  ConsultationSubmission: 'consultation_submissions',
  SensitiveAnswer: 'sensitive_answers',
  ConsentEvent: 'consent_events',
  SensitiveDataAccessEvent: 'sensitive_data_access_events',
  SensitiveBreakGlassGrant: 'sensitive_break_glass_grants',
};
export const retiredEnums = ['ConsentScope', 'SensitiveDataField', 'ConsultationTemplateStatus',
  'ConsultationFieldType', 'ConsultationCompletionTiming', 'ConsultationSubmissionStatus',
  'SensitiveAnswerValueType', 'ConsentEventAction', 'ConsentRecipientType', 'SensitiveAccessResult'];
