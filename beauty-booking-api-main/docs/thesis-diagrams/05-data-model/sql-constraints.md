# Ràng buộc SQL ngoài mô hình Prisma

Đây là lịch sử DDL trong repository, không phải catalog DB đang chạy. Một migration sau có thể thay thế đối tượng ở migration trước. Các trích đoạn giữ thứ tự thư mục; cần đối chiếu trạng thái triển khai trước khi khẳng định hiệu lực.

Đáng chú ý: partial unique một vi phạm hợp lệ/booking; unique customer–business policy; kiểm tra nguồn/scope vi phạm; trigger tách tài khoản; slot advisory lock không chặn + kiểm tra overlap. Không gọi các ràng buộc sau là đã áp dụng trên DB.

## 20260708053438_init

[Migration](../../../prisma/migrations/20260708053438_init/migration.sql)

- Dòng 566: `CREATE UNIQUE INDEX "users_email_key" ON "users"("email");`
- Dòng 569: `CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");`
- Dòng 578: `CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");`
- Dòng 584: `CREATE UNIQUE INDEX "customer_profiles_user_id_key" ON "customer_profiles"("user_id");`
- Dòng 587: `CREATE UNIQUE INDEX "business_owner_profiles_user_id_key" ON "business_owner_profiles"("user_id");`
- Dòng 590: `CREATE UNIQUE INDEX "business_owner_profiles_tax_code_key" ON "business_owner_profiles"("tax_code");`
- Dòng 593: `CREATE UNIQUE INDEX "staff_profiles_user_id_key" ON "staff_profiles"("user_id");`
- Dòng 602: `CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");`
- Dòng 608: `CREATE UNIQUE INDEX "provinces_name_key" ON "provinces"("name");`
- Dòng 611: `CREATE UNIQUE INDEX "provinces_code_key" ON "provinces"("code");`
- Dòng 617: `CREATE UNIQUE INDEX "districts_province_id_name_key" ON "districts"("province_id", "name");`
- Dòng 620: `CREATE UNIQUE INDEX "businesses_slug_key" ON "businesses"("slug");`
- Dòng 644: `CREATE UNIQUE INDEX "branch_working_hours_branch_id_day_of_week_key" ON "branch_working_hours"("branch_id", "day_of_week");`
- Dòng 647: `CREATE UNIQUE INDEX "staff_working_hours_staff_id_day_of_week_key" ON "staff_working_hours"("staff_id", "day_of_week");`
- Dòng 668: `CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");`
- Dòng 716: `CREATE UNIQUE INDEX "bookings_booking_code_key" ON "bookings"("booking_code");`
- Dòng 752: `CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");`
- Dòng 761: `CREATE UNIQUE INDEX "review_service_ratings_booking_service_id_key" ON "review_service_ratings"("booking_service_id");`

## 20260712_add_account_tokens

[Migration](../../../prisma/migrations/20260712_add_account_tokens/migration.sql)

- Dòng 14: `CREATE UNIQUE INDEX "account_tokens_token_hash_key" ON "account_tokens"("token_hash");`

## 20260713_add_health_records

[Migration](../../../prisma/migrations/20260713_add_health_records/migration.sql)

- Dòng 37: `CREATE UNIQUE INDEX "sensitive_consents_customer_id_scope_key" ON "sensitive_consents"("customer_id", "scope");`
- Dòng 43: `CREATE UNIQUE INDEX "booking_health_records_booking_id_field_key" ON "booking_health_records"("booking_id", "field");`

## 20260713_add_platform_settings

[Migration](../../../prisma/migrations/20260713_add_platform_settings/migration.sql)

- Dòng 11: `CREATE UNIQUE INDEX "platform_settings_key_key" ON "platform_settings"("key");`

## 20260713_add_schedule_exceptions

[Migration](../../../prisma/migrations/20260713_add_schedule_exceptions/migration.sql)

- Dòng 9: `CREATE UNIQUE INDEX "branch_holidays_branch_id_date_key" ON "branch_holidays"("branch_id", "date");`

## 20260713_add_staff_invitations

[Migration](../../../prisma/migrations/20260713_add_staff_invitations/migration.sql)

- Dòng 10: `CREATE UNIQUE INDEX "staff_invitations_token_hash_key" ON "staff_invitations"("token_hash");`

## 20260715_add_health_access_logs

[Migration](../../../prisma/migrations/20260715_add_health_access_logs/migration.sql)

- Dòng 31: `CREATE OR REPLACE FUNCTION prevent_health_access_log_mutation()`
- Dòng 38: `DROP TRIGGER IF EXISTS health_access_logs_no_update ON "health_record_access_logs";`
- Dòng 39: `CREATE TRIGGER health_access_logs_no_update`
- Dòng 43: `DROP TRIGGER IF EXISTS health_access_logs_no_delete ON "health_record_access_logs";`
- Dòng 44: `CREATE TRIGGER health_access_logs_no_delete`

## 20260715_harden_payment_concurrency

[Migration](../../../prisma/migrations/20260715_harden_payment_concurrency/migration.sql)

- Dòng 3: `CREATE UNIQUE INDEX IF NOT EXISTS "payments_one_settled_per_booking"`

## 20260717_platform_trust_onboarding_attendance

[Migration](../../../prisma/migrations/20260717_platform_trust_onboarding_attendance/migration.sql)

- Dòng 63: `CREATE UNIQUE INDEX "review_reports_review_id_reporter_id_key" ON "review_reports"("review_id", "reporter_id");`
- Dòng 99: `CREATE UNIQUE INDEX "staff_attendances_staff_id_branch_id_work_date_key" ON "staff_attendances"("staff_id", "branch_id", "work_date");`

## 20260718_segment_a_b_completion

[Migration](../../../prisma/migrations/20260718_segment_a_b_completion/migration.sql)

- Dòng 9: `CREATE UNIQUE INDEX IF NOT EXISTS "staff_profiles_branch_id_employee_code_key"`
- Dòng 28: `CREATE UNIQUE INDEX IF NOT EXISTS "media_files_storage_key_key" ON "media_files"("storage_key");`

## 20260720_harden_user_role_scope

[Migration](../../../prisma/migrations/20260720_harden_user_role_scope/migration.sql)

- Dòng 56: `CREATE UNIQUE INDEX IF NOT EXISTS "permissions_code_key"`
- Dòng 211: `CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_user_id_role_id_business_id_branch_id_key"`

## 20260726_p0_tenant_guest_security

[Migration](../../../prisma/migrations/20260726_p0_tenant_guest_security/migration.sql)

- Dòng 46: `CREATE UNIQUE INDEX "booking_contacts_booking_id_key"`
- Dòng 52: `CREATE UNIQUE INDEX "refund_requests_settlement_reference_key"`
- Dòng 55: `CREATE UNIQUE INDEX "trust_actions_restore_of_action_id_key"`
- Dòng 69: `CREATE OR REPLACE FUNCTION validate_user_role_scope()`
- Dòng 94: `DROP TRIGGER IF EXISTS "user_roles_scope_guard" ON "user_roles";`
- Dòng 95: `CREATE TRIGGER "user_roles_scope_guard"`
- Dòng 288: `CREATE UNIQUE INDEX "consultation_form_versions_template_id_version_key"`
- Dòng 290: `CREATE UNIQUE INDEX "consultation_form_fields_version_id_field_key_key"`
- Dòng 292: `CREATE UNIQUE INDEX "service_consultation_requirements_service_id_key"`
- Dòng 294: `CREATE UNIQUE INDEX "consultation_submissions_booking_id_service_id_key"`
- Dòng 296: `CREATE UNIQUE INDEX "sensitive_answers_submission_id_field_id_key"`
- Dòng 298: `CREATE UNIQUE INDEX "consent_events_revoke_of_event_id_key"`
- Dòng 300: `CREATE UNIQUE INDEX "marketing_preferences_customer_id_key"`
- Dòng 302: `CREATE UNIQUE INDEX "privacy_export_packages_request_id_key"`
- Dòng 304: `CREATE UNIQUE INDEX "privacy_export_packages_download_token_hash_key"`

## 20260726_phase4_onboarding_combo_attendance

[Migration](../../../prisma/migrations/20260726_phase4_onboarding_combo_attendance/migration.sql)

- Dòng 176: `CREATE UNIQUE INDEX "business_document_versions_document_id_version_key"`
- Dòng 257: `CREATE UNIQUE INDEX "attendance_qr_uses_qr_nonce_staff_id_action_key"`
- Dòng 286: `CREATE UNIQUE INDEX "user_permissions_user_id_permission_id_key"`

## 20260727_harden_booking_service_overlap

[Migration](../../../prisma/migrations/20260727_harden_booking_service_overlap/migration.sql)

- Dòng 5: `CREATE OR REPLACE FUNCTION "enforce_booking_service_staff_slot"()`
- Dòng 67: `DROP TRIGGER IF EXISTS "booking_services_staff_slot_guard"`
- Dòng 70: `CREATE TRIGGER "booking_services_staff_slot_guard"`

## 20260728_harden_booking_customer_overlap

[Migration](../../../prisma/migrations/20260728_harden_booking_customer_overlap/migration.sql)

- Dòng 4: `CREATE OR REPLACE FUNCTION "enforce_booking_customer_slot"()`
- Dòng 45: `DROP TRIGGER IF EXISTS "bookings_customer_slot_guard"`
- Dòng 48: `CREATE TRIGGER "bookings_customer_slot_guard"`

## 20260729_use_nonblocking_booking_slot_locks

[Migration](../../../prisma/migrations/20260729_use_nonblocking_booking_slot_locks/migration.sql)

- Dòng 4: `CREATE OR REPLACE FUNCTION "enforce_booking_service_staff_slot"()`
- Dòng 68: `CREATE OR REPLACE FUNCTION "enforce_booking_customer_slot"()`

## 20260730_branch_schedule_dashboard_refinement

[Migration](../../../prisma/migrations/20260730_branch_schedule_dashboard_refinement/migration.sql)

- Dòng 103: `CREATE UNIQUE INDEX "branch_onboarding_progress_branch_id_key"`
- Dòng 143: `CREATE UNIQUE INDEX "branch_booking_policies_branch_id_key"`
- Dòng 170: `CREATE UNIQUE INDEX "branch_attendance_policies_branch_id_key"`
- Dòng 212: `CREATE UNIQUE INDEX "branch_document_versions_document_id_version_key"`
- Dòng 290: `CREATE UNIQUE INDEX "staff_branch_assignments_staff_id_branch_id_start_date_key"`
- Dòng 336: `CREATE UNIQUE INDEX "staff_schedule_versions_staff_id_branch_id_version_key"`
- Dòng 359: `CREATE UNIQUE INDEX "staff_schedule_segments_version_id_day_of_week_sort_order_key"`

## 20260731_workforce_payment_core

[Migration](../../../prisma/migrations/20260731_workforce_payment_core/migration.sql)

- Dòng 543: `CREATE UNIQUE INDEX "pricing_snapshots_booking_id_key" ON "pricing_snapshots"("booking_id");`
- Dòng 558: `CREATE UNIQUE INDEX "payment_policies_business_id_branch_id_service_id_version_key" ON "payment_policies"("business_id", "branch_id", "service_id", "version");`
- Dòng 561: `CREATE UNIQUE INDEX "payment_policy_snapshots_booking_id_key" ON "payment_policy_snapshots"("booking_id");`
- Dòng 567: `CREATE UNIQUE INDEX "payment_intents_idempotency_key_key" ON "payment_intents"("idempotency_key");`
- Dòng 582: `CREATE UNIQUE INDEX "payment_transactions_idempotency_key_key" ON "payment_transactions"("idempotency_key");`
- Dòng 585: `CREATE UNIQUE INDEX "payment_transactions_provider_event_id_key" ON "payment_transactions"("provider_event_id");`
- Dòng 588: `CREATE UNIQUE INDEX "payment_transactions_reversal_of_id_key" ON "payment_transactions"("reversal_of_id");`
- Dòng 603: `CREATE UNIQUE INDEX "financial_ledger_entries_idempotency_key_key" ON "financial_ledger_entries"("idempotency_key");`
- Dòng 624: `CREATE UNIQUE INDEX "platform_fee_entries_booking_id_key" ON "platform_fee_entries"("booking_id");`
- Dòng 642: `CREATE UNIQUE INDEX "platform_statements_business_id_period_start_period_end_ver_key" ON "platform_statements"("business_id", "period_start", "period_end", "version");`
- Dòng 648: `CREATE UNIQUE INDEX "platform_statement_lines_statement_id_platform_fee_id_fee_a_key" ON "platform_statement_lines"("statement_id", "platform_fee_id", "fee_adjustment_id");`
- Dòng 666: `CREATE UNIQUE INDEX "package_installments_purchase_id_sequence_key" ON "package_installments"("purchase_id", "sequence");`
- Dòng 669: `CREATE UNIQUE INDEX "package_session_entitlements_redeemed_booking_service_id_key" ON "package_session_entitlements"("redeemed_booking_service_id");`
- Dòng 675: `CREATE UNIQUE INDEX "package_session_entitlements_purchase_id_sequence_key" ON "package_session_entitlements"("purchase_id", "sequence");`
- Dòng 684: `CREATE UNIQUE INDEX "timesheets_attendance_id_key" ON "timesheets"("attendance_id");`
- Dòng 693: `CREATE UNIQUE INDEX "timesheets_staff_id_branch_id_work_date_key" ON "timesheets"("staff_id", "branch_id", "work_date");`
- Dòng 702: `CREATE UNIQUE INDEX "compensation_rules_business_id_branch_id_name_version_key" ON "compensation_rules"("business_id", "branch_id", "name", "version");`
- Dòng 708: `CREATE UNIQUE INDEX "compensation_assignments_rule_id_staff_id_branch_id_role_co_key" ON "compensation_assignments"("rule_id", "staff_id", "branch_id", "role_code", "effective_from");`
- Dòng 711: `CREATE UNIQUE INDEX "compensation_entries_dedupe_key_key" ON "compensation_entries"("dedupe_key");`
- Dòng 726: `CREATE UNIQUE INDEX "compensation_adjustments_resulting_entry_id_key" ON "compensation_adjustments"("resulting_entry_id");`
- Dòng 735: `CREATE UNIQUE INDEX "pay_runs_business_id_period_start_period_end_key" ON "pay_runs"("business_id", "period_start", "period_end");`
- Dòng 741: `CREATE UNIQUE INDEX "pay_run_items_pay_run_id_staff_id_key" ON "pay_run_items"("pay_run_id", "staff_id");`
- Dòng 1196: `CREATE OR REPLACE FUNCTION beautybook_reject_mutation()`
- Dòng 1203: `CREATE TRIGGER financial_ledger_entries_append_only`
- Dòng 1207: `CREATE OR REPLACE FUNCTION beautybook_protect_verified_transaction()`
- Dòng 1220: `CREATE TRIGGER payment_transactions_immutable_after_verification`
- Dòng 1224: `CREATE OR REPLACE FUNCTION beautybook_protect_locked_compensation()`
- Dòng 1237: `CREATE TRIGGER compensation_entries_immutable_when_locked`
- Dòng 1241: `CREATE OR REPLACE FUNCTION beautybook_protect_issued_statement()`
- Dòng 1264: `CREATE TRIGGER platform_statements_immutable_after_issue`

## 20260806_section_a_identity_workspace

[Migration](../../../prisma/migrations/20260806_section_a_identity_workspace/migration.sql)

- Dòng 58: `CREATE UNIQUE INDEX "business_comments_review_id_key"`
- Dòng 69: `CREATE UNIQUE INDEX "user_roles_platform_scope_key"`
- Dòng 73: `CREATE UNIQUE INDEX "user_roles_business_scope_key"`
- Dòng 77: `CREATE UNIQUE INDEX "user_roles_branch_scope_key"`

## 20260810_service_taxonomy_role_cleanup

[Migration](../../../prisma/migrations/20260810_service_taxonomy_role_cleanup/migration.sql)

- Dòng 139: `DROP INDEX IF EXISTS "service_categories_slug_key";`
- Dòng 229: `CREATE UNIQUE INDEX "service_categories_business_id_slug_key"`
- Dòng 261: `CONSTRAINT "canonical_services_merge_state_check" CHECK (`
- Dòng 333: `ADD CONSTRAINT "business_services_mapping_state_check" CHECK (`
- Dòng 348: `CREATE UNIQUE INDEX "services_branch_id_business_service_id_key"`
- Dòng 354: `CREATE OR REPLACE FUNCTION "enforce_branch_offering_business_scope"()`

## 20260822_business_completion

[Migration](../../../prisma/migrations/20260822_business_completion/migration.sql)

- Dòng 627: `CREATE UNIQUE INDEX "branch_state_transitions_branch_id_version_key" ON "branch_state_transitions"("branch_id", "version");`
- Dòng 645: `CREATE UNIQUE INDEX "promotion_redemptions_promotion_id_booking_id_key" ON "promotion_redemptions"("promotion_id", "booking_id");`
- Dòng 654: `CREATE UNIQUE INDEX "voucher_redemptions_voucher_id_booking_id_key" ON "voucher_redemptions"("voucher_id", "booking_id");`
- Dòng 660: `CREATE UNIQUE INDEX "service_variants_service_id_code_key" ON "service_variants"("service_id", "code");`
- Dòng 666: `CREATE UNIQUE INDEX "service_dependencies_service_id_required_service_id_depende_key" ON "service_dependencies"("service_id", "required_service_id", "dependency_type");`
- Dòng 672: `CREATE UNIQUE INDEX "booking_service_adjustments_booking_service_id_version_key" ON "booking_service_adjustments"("booking_service_id", "version");`
- Dòng 687: `CREATE UNIQUE INDEX "operational_impact_items_case_id_booking_id_key" ON "operational_impact_items"("case_id", "booking_id");`
- Dòng 690: `CREATE UNIQUE INDEX "waitlist_entries_offer_token_hash_key" ON "waitlist_entries"("offer_token_hash");`
- Dòng 693: `CREATE UNIQUE INDEX "waitlist_entries_offer_slot_key_key" ON "waitlist_entries"("offer_slot_key");`
- Dòng 696: `CREATE UNIQUE INDEX "waitlist_entries_booking_id_key" ON "waitlist_entries"("booking_id");`
- Dòng 720: `CREATE UNIQUE INDEX "loyalty_rules_business_id_branch_id_version_key" ON "loyalty_rules"("business_id", "branch_id", "version");`
- Dòng 726: `CREATE UNIQUE INDEX "loyalty_accounts_business_id_customer_id_key" ON "loyalty_accounts"("business_id", "customer_id");`
- Dòng 729: `CREATE UNIQUE INDEX "loyalty_transactions_idempotency_key_key" ON "loyalty_transactions"("idempotency_key");`
- Dòng 747: `CREATE UNIQUE INDEX "invoices_business_id_invoice_number_key" ON "invoices"("business_id", "invoice_number");`
- Dòng 756: `CREATE UNIQUE INDEX "cash_shifts_open_key_key" ON "cash_shifts"("open_key");`
- Dòng 762: `CREATE UNIQUE INDEX "cash_movements_idempotency_key_key" ON "cash_movements"("idempotency_key");`
- Dòng 783: `CREATE UNIQUE INDEX "legal_entity_versions_business_id_version_key" ON "legal_entity_versions"("business_id", "version");`
- Dòng 789: `CREATE UNIQUE INDEX "payout_account_versions_business_id_version_key" ON "payout_account_versions"("business_id", "version");`
- Dòng 795: `CREATE UNIQUE INDEX "customer_saved_services_customer_id_branch_service_offering_key" ON "customer_saved_services"("customer_id", "branch_service_offering_id");`
- Dòng 810: `CREATE UNIQUE INDEX "customer_business_segments_business_id_customer_id_segment_key" ON "customer_business_segments"("business_id", "customer_id", "segment");`
- Dòng 870: `CREATE UNIQUE INDEX "overbooking_overrides_booking_id_key" ON "overbooking_overrides"("booking_id");`
- Dòng 872: `CREATE UNIQUE INDEX "invoices_replaces_invoice_id_key" ON "invoices"("replaces_invoice_id");`
- Dòng 873: `CREATE UNIQUE INDEX "invoice_information_requests_invoice_id_key" ON "invoice_information_requests"("invoice_id");`
- Dòng 874: `CREATE UNIQUE INDEX "invoice_information_requests_open_key_key" ON "invoice_information_requests"("open_key");`
- Dòng 875: `CREATE UNIQUE INDEX "invoice_information_requests_idempotency_key_key" ON "invoice_information_requests"("idempotency_key");`

## 20260822_business_completion_outbox

[Migration](../../../prisma/migrations/20260822_business_completion_outbox/migration.sql)

- Dòng 35: `CREATE UNIQUE INDEX "notification_outbox_dedupe_key_key" ON "notification_outbox"("dedupe_key");`
- Dòng 36: `CREATE UNIQUE INDEX "notification_outbox_notification_id_key" ON "notification_outbox"("notification_id");`

## 20260829_remove_attendance_workforce

[Migration](../../../prisma/migrations/20260829_remove_attendance_workforce/migration.sql)

- Dòng 66: `CREATE UNIQUE INDEX IF NOT EXISTS "special_working_days_branch_id_date_key"`
- Dòng 180: `CREATE OR REPLACE FUNCTION "enforce_booking_service_staff_slot"()`

## 20260909_audit_integrity

[Migration](../../../prisma/migrations/20260909_audit_integrity/migration.sql)

- Dòng 89: `ALTER TABLE "payments" ADD CONSTRAINT "payments_audit_amount_check" CHECK (amount >= 0) NOT VALID;`
- Dòng 90: `ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_audit_amount_check" CHECK (amount >= 0) NOT VALID;`
- Dòng 91: `ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_audit_amount_check" CHECK (amount >= 0) NOT VALID;`
- Dòng 92: `ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_audit_amount_check" CHECK (amount >= 0) NOT VALID;`
- Dòng 93: `ALTER TABLE "refund_allocations" ADD CONSTRAINT "refund_allocations_audit_amount_check" CHECK (amount >= 0) NOT VALID;`
- Dòng 94: `ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_audit_amount_check" CHECK (balance >= 0) NOT VALID;`
- Dòng 95: `ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_audit_amount_check" CHECK (balance_after >= 0) NOT VALID;`
- Dòng 96: `ALTER TABLE "loyalty_rules" ADD CONSTRAINT "loyalty_rules_audit_amount_check" CHECK (earn_points_per_amount >= 0 AND earn_amount_unit > 0 AND redemption_value_per_point > 0) NOT VALID;`
- Dòng 97: `ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_audit_amount_check" CHECK (amount >= 0) NOT VALID;`
- Dòng 98: `ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_audit_amount_check" CHECK (amount >= 0) NOT VALID;`
- Dòng 99: `ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_audit_amount_check" CHECK (subtotal_amount >= 0 AND discount_amount >= 0 AND final_amount >= 0) NOT VALID;`
- Dòng 100: `ALTER TABLE "bookings" ADD CONSTRAINT "bookings_audit_amount_check" CHECK (total_amount >= 0 AND (voucher_discount_amount IS NULL OR voucher_discount_amount >= 0) AND (final_amount IS NULL OR final_amount >= 0)) NOT VALID;`
- Dòng 101: `ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_audit_amount_check" CHECK (price_at_booking >= 0 AND duration_minutes > 0) NOT VALID;`
- Dòng 102: `ALTER TABLE "invoices" ADD CONSTRAINT "invoices_audit_amount_check" CHECK (subtotal_amount >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND total_amount >= 0 AND tax_rate >= 0 AND tax_rate <= 100) NOT VALID;`
- Dòng 103: `ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_audit_amount_check" CHECK (quantity > 0 AND unit_price >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND line_total >= 0 AND tax_rate >= 0 AND tax_rate <= 100) NOT VALID;`

## 20260915_remove_manager_role

[Migration](../../../prisma/migrations/20260915_remove_manager_role/migration.sql)

- Dòng 101: `ON CONFLICT(code) DO UPDATE SET level=EXCLUDED.level;`
- Dòng 241: `ON CONFLICT(code) DO UPDATE SET resource=EXCLUDED.resource,action=EXCLUDED.action,`
- Dòng 242: `scope=EXCLUDED.scope,description=EXCLUDED.description;`
- Dòng 407: `CREATE OR REPLACE FUNCTION validate_user_role_scope()`

## 20260916_account_separation

[Migration](../../../prisma/migrations/20260916_account_separation/migration.sql)

- Dòng 17: `CREATE FUNCTION public.validate_account_role_separation() RETURNS trigger`
- Dòng 42: `CREATE TRIGGER account_role_separation_guard`

## 20260917_booking_violation_events

[Migration](../../../prisma/migrations/20260917_booking_violation_events/migration.sql)

- Dòng 18: `CONSTRAINT "booking_violation_source_check" CHECK (`
- Dòng 22: `CONSTRAINT "booking_violation_void_check" CHECK (`
- Dòng 27: `CREATE UNIQUE INDEX "booking_violation_events_source_request_id_key" ON "booking_violation_events"("source_request_id");`
- Dòng 28: `CREATE UNIQUE INDEX "booking_violation_one_valid_event" ON "booking_violation_events"("booking_id") WHERE "voided_at" IS NULL;`
- Dòng 32: `CREATE FUNCTION validate_booking_violation_source() RETURNS trigger LANGUAGE plpgsql AS $$`
- Dòng 48: `CREATE TRIGGER booking_violation_source_valid BEFORE INSERT ON booking_violation_events`
- Dòng 51: `CREATE FUNCTION protect_booking_violation_evidence() RETURNS trigger LANGUAGE plpgsql AS $$`
- Dòng 66: `CREATE TRIGGER booking_violation_evidence_immutable BEFORE UPDATE OR DELETE ON booking_violation_events`

## 20260918_customer_booking_policy

[Migration](../../../prisma/migrations/20260918_customer_booking_policy/migration.sql)

- Dòng 6: `"revision" INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),`
- Dòng 12: `CONSTRAINT customer_booking_policy_dates CHECK (`
- Dòng 17: `CREATE UNIQUE INDEX customer_booking_policies_customer_id_business_id_key ON customer_booking_policies(customer_id,business_id);`
- Dòng 18: `CREATE UNIQUE INDEX customer_booking_policies_triggered_by_violation_event_id_key ON customer_booking_policies(triggered_by_violation_event_id);`
- Dòng 21: `CREATE FUNCTION validate_customer_booking_policy_scope() RETURNS trigger LANGUAGE plpgsql AS $$`
- Dòng 32: `CREATE TRIGGER customer_booking_policy_scope BEFORE INSERT OR UPDATE OF starts_at,ends_at,triggered_by_violation_event_id`

## 20260919_archive_retired_health

[Migration](../../../prisma/migrations/20260919_archive_retired_health/migration.sql)

- Dòng 32: `CREATE FUNCTION archive_health_20260919.reject_archive_mutation() RETURNS trigger`
- Dòng 45: `EXECUTE format('CREATE TRIGGER retired_health_archive_read_only BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON archive_health_20260919.%I FOR EACH STATEMENT EXECUTE FUNCTION archive_health_20260919.reject_archive_mutation()',t);`

## 20260919_health_archive_row_guard

[Migration](../../../prisma/migrations/20260919_health_archive_row_guard/migration.sql)

- Dòng 12: `EXECUTE format('DROP TRIGGER retired_health_archive_read_only ON archive_health_20260919.%I', t);`
- Dòng 13: `EXECUTE format('CREATE TRIGGER retired_health_archive_read_only BEFORE INSERT OR UPDATE OR DELETE ON archive_health_20260919.%I FOR EACH ROW EXECUTE FUNCTION archive_health_20260919.reject_archive_mutation()',t);`
- Dòng 14: `EXECUTE format('CREATE TRIGGER retired_health_archive_no_truncate BEFORE TRUNCATE ON archive_health_20260919.%I FOR EACH STATEMENT EXECUTE FUNCTION archive_health_20260919.reject_archive_mutation()',t);`

