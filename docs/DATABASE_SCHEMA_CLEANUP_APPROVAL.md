# BeautyBook — Đề xuất cleanup schema cần duyệt

Đối chiếu tăng dần ngày 19/09/2026; bằng chứng DB READ ONLY: 2026-09-19T03:16:53.750Z. Không có lệnh drop/delete trong tài liệu hoặc script sinh tài liệu.

## Quyết định cần người dùng xác nhận

- Đề xuất giai đoạn kế tiếp: archive nguyên graph 12 model sức khỏe/consultation đã retired, rồi bỏ chúng khỏi active Prisma schema. KHÔNG xóa cứng; chưa thực hiện.
- SensitiveConsent còn 2 dòng; các bảng khác trong nhóm đang rỗng trên DB được đọc. Không suy rộng số liệu này sang môi trường khác.
- SalonMember: giữ compatibility hiện tại, chưa gộp. CancellationPolicy: chuyển MERGE_CANDIDATE sang REFACTOR vì cancellation 4h cố định nhưng reschedule vẫn dùng resolver.
- 25 REFACTOR là danh sách cần thiết kế/test riêng, không phải cho phép sửa hàng loạt. PlatformSetting và PayoutAccountVersion vẫn cần quyết định nghiệp vụ.
- Ba migration additive account separation/event/restriction chưa áp dụng DB chính. Cần phê duyệt triển khai riêng; không gộp chúng với destructive cleanup.

## Bảng đề xuất theo model

Số dòng/FK là hiện trạng DB chính. Runtime dependency tái sử dụng bằng chứng đã kiểm tra ngày 15/09, kết hợp delta policy ngày 19/09; trước migration phải kiểm tra lại caller liên quan, không coi direct usage bằng 0 là dead code.

| Model | Current decision | New evidence | Runtime dependency | DB rows | FK/history impact | Final proposal |
|---|---|---|---|---:|---|---|
| UserSession | REFACTOR | Giữ quản lý phiên/thu hồi. businessId và branchId là scalar không FK; cần xác nhận snapshot scope hay tham chiếu sống trước khi thêm FK. | `src/auth/auth.service.ts`; `src/auth/jwt.strategy.ts`; `src/ownership/ownership.service.ts`; `src/staff/staff.service.ts` | 76 | 0 FK vào; 1 FK ra. Không có FK vào không đồng nghĩa được xóa lịch sử. | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| PlatformSetting | NEEDS_REVIEW | Key/value JSON đang dùng qua PlatformSettingsService. Kiểm kê từng key và quyền sửa; updatedBy chưa là FK, không thêm schema theo suy đoán. | `src/platform-settings/platform-settings.service.ts` | 0 | 0 FK vào; 0 FK ra. Không có FK vào không đồng nghĩa được xóa lịch sử. | Chờ xác nhận nghiệp vụ; chưa sửa schema. |
| StaffInvitation | REFACTOR | Giữ invitation chỉ Receptionist/Staff; businessId, branchId, invitedBy, acceptedBy chưa có FK trong Prisma. | `src/staff/staff-invitations.service.ts`; `src/staff/staff.controller.ts`; `src/staff/staff.service.ts` | 0 | 0 FK vào; 1 FK ra. Không có FK vào không đồng nghĩa được xóa lịch sử. | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| Role | REFACTOR | Manager đã loại; GUEST còn definition nhưng 0 assignment. Public access không tự chứng minh cần persisted GUEST. | `src/auth/auth.service.ts`; `src/common/utils/policy.ts`; `src/ownership/ownership.service.ts`; `src/staff/staff-invitations.service.ts` | 6 | 2 FK vào; 0 FK ra. Bảng tham chiếu: role_permissions, user_roles | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| Permission | REFACTOR | 113 code runtime nhưng DB có 137 definitions: 24 code ngoài catalog cần archive/dọn riêng sau kiểm tra grant. | `src/users/users.service.ts` | 137 | 2 FK vào; 0 FK ra. Bảng tham chiếu: role_permissions, user_permissions | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| UserPermission | REFACTOR | Có 69 bản ghi; 8 grant trỏ code ngoài catalog. Runtime fail closed với code lạ, cần lưu lịch sử trước khi dọn. | `src/users/users.service.ts` | 69 | 0 FK vào; 2 FK ra. Không có FK vào không đồng nghĩa được xóa lịch sử. | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| CustomerProfile | REFACTOR | Giữ định danh khách cho booking. address có ở cả User và CustomerProfile; cần chốt nguồn chuẩn và ý nghĩa note. | `src/auth/auth.service.ts`; `src/bookings/bookings-access.service.ts`; `src/bookings/bookings.controller.ts`; `src/bookings/bookings.service.ts` | 1000 | 22 FK vào; 1 FK ra. Bảng tham chiếu: booking_health_records, bookings, business_comments, consent_events, consultation_submissions, customer_business_segments, customer_saved_services, customer_vouchers, data_subject_requests, invoice_information_requests, loyalty_accounts, loyalty_transactions, marketing_preferences, package_purchases, price_adjustments, privacy_export_packages, promotion_redemptions, recurring_booking_plans, reviews, sensitive_consents, voucher_redemptions, waitlist_entries | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| StaffProfile | REFACTOR | Giữ nhân sự cung cấp dịch vụ và lịch sử booking. branchId là chi nhánh gốc, StaffBranchAssignment là phân công có thời hạn; cần chốt primary branch khi đa chi nhánh. | `src/bookings/booking-items.service.ts`; `src/bookings/bookings-access.service.ts`; `src/bookings/bookings.controller.ts`; `src/bookings/bookings.service.ts` | 29 | 24 FK vào; 2 FK ra. Bảng tham chiếu: appointment_change_requests, archive_20260829_attendance_events, archive_20260829_attendance_exception_requests, archive_20260829_attendance_qr_uses, booking_services, archive_20260829_compensation_assignments, archive_20260829_compensation_entries, operational_impact_items, archive_20260829_pay_run_items, recurring_booking_plans, review_service_ratings, archive_20260829_staff_attendances, archive_20260829_staff_availabilities, staff_branch_assignments, archive_20260829_staff_breaks, staff_images, staff_invitations, archive_20260829_staff_leaves, archive_20260829_staff_schedule_change_requests, archive_20260829_staff_schedule_versions, staff_services, archive_20260829_staff_working_hours, archive_20260829_timesheets, waitlist_entries | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| Business | REFACTOR | Giữ entity tenant. legalDocuments/onboardingData JSON có thể chồng với Document/Version; cần xác định canonical fields và compatibility. | `src/admin/admin.controller.ts`; `src/admin/trust-snapshot.service.ts`; `src/auth/auth.service.ts`; `src/branches/branches.service.ts` | 5 | 53 FK vào; 2 FK ra. Bảng tham chiếu: archive_20260829_attendance_events, archive_20260829_attendance_exception_requests, archive_20260829_attendance_qr_tokens, branches, business_comments, business_documents, business_images, business_review_events, business_services, cancellation_policies, combos, archive_20260829_compensation_entries, archive_20260829_compensation_rules, consent_events, consultation_form_templates, consultation_submissions, customer_business_segments, financial_ledger_entries, invoice_information_requests, invoices, legal_entity_versions, loyalty_accounts, loyalty_rules, loyalty_transactions, operational_impact_cases, ownership_history, ownership_transfers, package_purchases, archive_20260829_pay_runs, payment_intents, payment_policies, payment_policy_snapshots, payment_transactions, payout_account_versions, platform_fee_adjustments, platform_fee_entries, platform_statements, pricing_snapshots, promotion_businesses, promotions, salon_members, salon_trust_snapshots, sensitive_break_glass_grants, sensitive_data_access_events, service_categories, archive_20260829_staff_attendances, archive_20260829_staff_availabilities, archive_20260829_timesheets, treatment_packages, trust_actions, user_roles, vouchers, waitlist_entries | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| Branch | REFACTOR | Giữ scope. status/reviewStatus/operationalStatus biểu diễn ba khía cạnh; cần chốt state matrix, không gộp thành một status. managerName chỉ là người liên hệ. | `src/admin/admin.controller.ts`; `src/admin/trust-snapshot.service.ts`; `src/bookings/bookings.controller.ts`; `src/bookings/bookings.service.ts` | 11 | 57 FK vào; 2 FK ra. Bảng tham chiếu: archive_20260829_attendance_events, archive_20260829_attendance_exception_requests, archive_20260829_attendance_qr_tokens, bookings, archive_20260829_branch_attendance_policies, branch_booking_policies, branch_documents, branch_holidays, branch_images, branch_onboarding_progress, branch_review_events, branch_review_requests, branch_state_transitions, branch_working_hours, combos, archive_20260829_compensation_assignments, archive_20260829_compensation_entries, archive_20260829_compensation_rules, consent_events, consultation_form_templates, consultation_submissions, financial_ledger_entries, invoice_information_requests, invoices, loyalty_rules, operational_impact_cases, operational_impact_items, package_purchases, payment_intents, payment_policies, payment_policy_snapshots, payment_transactions, platform_fee_adjustments, platform_fee_entries, price_adjustments, pricing_snapshots, promotion_branches, promotion_redemptions, recurring_booking_plans, salon_members, sensitive_break_glass_grants, sensitive_data_access_events, services, special_working_days, archive_20260829_staff_attendances, archive_20260829_staff_availabilities, staff_branch_assignments, staff_profiles, archive_20260829_staff_schedule_change_requests, archive_20260829_staff_schedule_versions, archive_20260829_timesheets, treatment_packages, trust_actions, user_roles, voucher_branch_scopes, voucher_redemptions, waitlist_entries | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| BranchBookingPolicy | REFACTOR | Giữ lead time, horizon, buffer, walk-in và cutoff cấp branch. depositPolicy là JSON legacy cần tách khỏi phạm vi online đã bỏ. | `src/bookings/bookings.controller.ts`; `src/branches/branches.service.ts` | 11 | 0 FK vào; 1 FK ra. Không có FK vào không đồng nghĩa được xóa lịch sử. | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| OverbookingOverride | REFACTOR | Bằng chứng override có lý do/actor; không xóa bảo vệ concurrency. branchId/actorId hiện chưa FK. | `src/bookings/bookings.service.ts` | 0 | 0 FK vào; 1 FK ra. Không có FK vào không đồng nghĩa được xóa lịch sử. | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| MediaFile | REFACTOR | Giữ tệp/visibility. entityType/entityId là polymorphic; businessId/branchId chưa FK. Không thêm FK entityId cố định; kiểm tra scope tại service. | `src/branches/branches.service.ts`; `src/business/business-onboarding.service.ts`; `src/media/media.service.ts`; `src/users/users.service.ts` | 0 | 9 FK vào; 1 FK ra. Bảng tham chiếu: branch_document_versions, branch_images, business_document_versions, business_images, businesses, combo_images, service_images, staff_images, users | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| Booking | REFACTOR | Giữ aggregate, ngày/giờ wall-clock, nguồn, hold và status. cancellationFeeAmount/sensitiveDataConsent là cột legacy cần archive hoặc compatibility có chủ đích. | `src/admin/admin.controller.ts`; `src/admin/trust-snapshot.service.ts`; `src/bookings/booking-items.service.ts`; `src/bookings/bookings-access.service.ts` | 4000 | 30 FK vào; 5 FK ra. Bảng tham chiếu: appointment_change_requests, booking_contacts, booking_health_records, booking_service_adjustments, booking_services, booking_status_histories, consent_events, consultation_submissions, financial_ledger_entries, invoice_information_requests, invoices, loyalty_transactions, notification_outbox, notifications, operational_impact_items, overbooking_overrides, package_session_entitlements, payment_intents, payment_policy_snapshots, payment_transactions, payments, platform_fee_entries, price_adjustments, pricing_snapshots, promotion_redemptions, reviews, sensitive_break_glass_grants, sensitive_data_access_events, voucher_redemptions, waitlist_entries | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| BookingService | REFACTOR | Giữ từng dịch vụ, giá/tên/thời lượng snapshot, assignment và slot. variantId hiện chưa FK; cần kiểm tra orphan trước khi ràng buộc. | `src/bookings/booking-item-lifecycle.ts`; `src/bookings/booking-items.service.ts`; `src/bookings/bookings.service.ts`; `src/bookings/bookings.validation.ts` | 4000 | 6 FK vào; 6 FK ra. Bảng tham chiếu: booking_service_adjustments, archive_20260829_compensation_entries, invoice_lines, package_session_entitlements, refund_allocations, review_service_ratings | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| RecurringBookingPlan | REFACTOR | Luồng định kỳ có recovery worker. serviceIds JSON cần validation và snapshot/version rõ; không coi là join table tự do. | `src/bookings/bookings.service.ts`; `src/recurring/recurring-creation-fence.ts`; `src/recurring/recurring-plan-recovery.worker.ts`; `src/recurring/recurring.service.ts` | 0 | 1 FK vào; 4 FK ra. Bảng tham chiếu: bookings | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| RefundRequest | REFACTOR | Luồng hoàn thủ công còn hoạt động; requestedBy/reviewedBy/processedBy chưa FK, cần bảo toàn bằng chứng cũ. | `src/ownership/ownership.service.ts`; `src/payments/financial-metrics.service.ts`; `src/payments/payments.service.ts`; `src/reports/reports.service.ts` | 0 | 5 FK vào; 1 FK ra. Bảng tham chiếu: archive_20260829_compensation_adjustments, financial_ledger_entries, loyalty_transactions, platform_fee_adjustments, refund_allocations | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| PaymentPolicy | REFACTOR | Chính sách deposit/split/installment còn API nhưng phạm vi online đã bỏ; cần phân biệt chính sách thu tại quầy và cấu hình cũ. | `src/payments/payments.service.ts` | 0 | 1 FK vào; 3 FK ra. Bảng tham chiếu: payment_policy_snapshots | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| PaymentPolicySnapshot | REFACTOR | 4.000 snapshot lịch sử phải giữ kể cả policy online ngừng sử dụng. | `src/payments/payments.service.ts` | 4000 | 0 FK vào; 4 FK ra. Không có FK vào không đồng nghĩa được xóa lịch sử. | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| PaymentIntent | REFACTOR | Không chỉ online: đang tạo qua luồng quầy và có 4.000 dòng. provider/metadata/expiry cần phân loại legacy, không drop. | `src/payments/payments.service.ts` | 4000 | 1 FK vào; 5 FK ra. Bảng tham chiếu: payment_transactions | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| PaymentTransaction | REFACTOR | Giao dịch kiểm chứng, có trigger immutable; verifiedBy/createdBy-related metadata cần ràng buộc actor rõ. | `src/ownership/ownership.service.ts`; `src/payments/financial-metrics.service.ts`; `src/payments/payments.service.ts`; `src/reports/reports.service.ts` | 4000 | 2 FK vào; 8 FK ra. Bảng tham chiếu: financial_ledger_entries, payment_transactions | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| PackageInstallment | REFACTOR | Trả góp gói tại quầy vẫn có service; paymentIntentId chưa FK dù tồn tại PaymentIntent.packageInstallmentId. | `src/payments/payments.service.ts` | 0 | 2 FK vào; 1 FK ra. Bảng tham chiếu: payment_intents, payment_transactions | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| SalonMember | MERGE_CANDIDATE | Metadata membership cũ, không còn là nguồn phân quyền. Sau refactor thông báo, chỉ còn service compatibility; cần rà route/caller trước khi hợp nhất vào UserRole. | `src/admin/trust-snapshot.service.ts`; `src/business/salon-members.service.ts`; `src/reviews/reviews.service.ts` | 0 | 0 FK vào; 3 FK ra. Không có FK vào không đồng nghĩa được xóa lịch sử. | Giữ nguyên; cần mapping compatibility trước đề xuất migration. |
| CancellationPolicy | REFACTOR | Dừng đề xuất gộp: cancellation cố định 4h, reschedule vẫn có resolver riêng; tách field legacy khỏi policy đang hoạt động trước khi quyết định merge. Không dùng bảng này để cấu hình điểm hoặc thời hạn hạn chế mới. | `src/business/cancellation-policies.service.ts`; `src/common/utils/policy.ts` | 0 | 0 FK vào; 1 FK ra. Không có FK vào không đồng nghĩa được xóa lịch sử. | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| CustomerVoucher | REFACTOR | Quyền sở hữu voucher của khách, có reserve/use; usedBookingId chưa FK. Cần kiểm tra state/expiry riêng với trạng thái voucher định nghĩa. | `src/bookings/vouchers.service.ts`; `src/common/utils/voucher.ts`; `src/promotions/pricing-engine.service.ts`; `src/promotions/vouchers-admin.service.ts` | 0 | 1 FK vào; 2 FK ra. Bảng tham chiếu: voucher_redemptions | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| SensitiveConsent | REMOVE_CANDIDATE | Feature đã bỏ; hiện còn 2 dòng consent. Chỉ đề xuất chuyển archive bảo toàn dữ liệu, không xóa cứng. | Nested/history/schema dependency; xem audit gốc, không kết luận không dùng | 2 | 1 FK vào; 1 FK ra. Bảng tham chiếu: booking_health_records | Archive nguyên graph sau duyệt; giữ ID/FK/trigger; chưa drop. |
| BookingHealthRecord | REMOVE_CANDIDATE | Không có runtime delegate hoặc API nghiệp vụ sức khỏe, hiện 0 dòng; kiểm tra quan hệ trước archive. | Nested/history/schema dependency; xem audit gốc, không kết luận không dùng | 0 | 0 FK vào; 3 FK ra. Không có FK vào không đồng nghĩa được xóa lịch sử. | Archive nguyên graph sau duyệt; giữ ID/FK/trigger; chưa drop. |
| HealthRecordAccessLog | REMOVE_CANDIDATE | 0 dòng nhưng có trigger cấm UPDATE/DELETE; archive nguyên bảng/trigger, không vô hiệu bảo vệ để dọn. | Nested/history/schema dependency; xem audit gốc, không kết luận không dùng | 0 | 0 FK vào; 0 FK ra. Không có FK vào không đồng nghĩa được xóa lịch sử. | Archive nguyên graph sau duyệt; giữ ID/FK/trigger; chưa drop. |
| ConsultationFormTemplate | REMOVE_CANDIDATE | 0 dòng; domain consultation đã retired. Archive cùng graph, không đụng core booking. | Nested/history/schema dependency; xem audit gốc, không kết luận không dùng | 0 | 2 FK vào; 2 FK ra. Bảng tham chiếu: consultation_form_versions, service_consultation_requirements | Archive nguyên graph sau duyệt; giữ ID/FK/trigger; chưa drop. |
| ConsultationFormVersion | REMOVE_CANDIDATE | 0 dòng; phiên bản form retired, giữ quan hệ nội bộ khi archive. | Nested/history/schema dependency; xem audit gốc, không kết luận không dùng | 0 | 2 FK vào; 1 FK ra. Bảng tham chiếu: consultation_form_fields, consultation_submissions | Archive nguyên graph sau duyệt; giữ ID/FK/trigger; chưa drop. |
| ConsultationFormField | REMOVE_CANDIDATE | 0 dòng; field definition consultation retired. | Nested/history/schema dependency; xem audit gốc, không kết luận không dùng | 0 | 2 FK vào; 1 FK ra. Bảng tham chiếu: consent_events, sensitive_answers | Archive nguyên graph sau duyệt; giữ ID/FK/trigger; chưa drop. |
| ServiceConsultationRequirement | REMOVE_CANDIDATE | 0 dòng; yêu cầu consultation không còn gate booking; bỏ khỏi active schema sau kiểm chứng nested refs. | Nested/history/schema dependency; xem audit gốc, không kết luận không dùng | 0 | 0 FK vào; 2 FK ra. Không có FK vào không đồng nghĩa được xóa lịch sử. | Archive nguyên graph sau duyệt; giữ ID/FK/trigger; chưa drop. |
| ConsultationSubmission | REMOVE_CANDIDATE | 0 dòng; có retention/legalHold nên không áp dụng xóa payload tự động trên DB khác. | Nested/history/schema dependency; xem audit gốc, không kết luận không dùng | 0 | 3 FK vào; 6 FK ra. Bảng tham chiếu: consent_events, sensitive_answers, sensitive_data_access_events | Archive nguyên graph sau duyệt; giữ ID/FK/trigger; chưa drop. |
| SensitiveAnswer | REMOVE_CANDIDATE | 0 dòng; cấu trúc mã hóa/phiên bản key phải giữ nguyên nếu archive có dữ liệu. | Nested/history/schema dependency; xem audit gốc, không kết luận không dùng | 0 | 1 FK vào; 2 FK ra. Bảng tham chiếu: sensitive_data_access_events | Archive nguyên graph sau duyệt; giữ ID/FK/trigger; chưa drop. |
| ConsentEvent | REMOVE_CANDIDATE | 0 dòng; consent append/history của feature retired, không gộp với marketing. | Nested/history/schema dependency; xem audit gốc, không kết luận không dùng | 0 | 1 FK vào; 8 FK ra. Bảng tham chiếu: consent_events | Archive nguyên graph sau duyệt; giữ ID/FK/trigger; chưa drop. |
| SensitiveDataAccessEvent | REMOVE_CANDIDATE | 0 dòng; lịch sử truy cập consultation retired. | Nested/history/schema dependency; xem audit gốc, không kết luận không dùng | 0 | 0 FK vào; 6 FK ra. Không có FK vào không đồng nghĩa được xóa lịch sử. | Archive nguyên graph sau duyệt; giữ ID/FK/trigger; chưa drop. |
| SensitiveBreakGlassGrant | REMOVE_CANDIDATE | 0 dòng; quyền truy cập khẩn cấp health đã bỏ, không còn cấp runtime. | Nested/history/schema dependency; xem audit gốc, không kết luận không dùng | 0 | 1 FK vào; 3 FK ra. Bảng tham chiếu: sensitive_data_access_events | Archive nguyên graph sau duyệt; giữ ID/FK/trigger; chưa drop. |
| ServiceVariant | REFACTOR | Biến thể giá/thời lượng/buffer có backend. consultationRequired đang bị ép false; eligibilityRules cần phân biệt với sức khỏe đã bỏ. | `src/bookings/booking-items.service.ts`; `src/bookings/bookings.controller.ts`; `src/bookings/bookings.service.ts`; `src/services/services.controller.ts` | 0 | 1 FK vào; 1 FK ra. Bảng tham chiếu: service_price_rules | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| InvoiceInformationRequest | REFACTOR | Yêu cầu thông tin hóa đơn có openKey/idempotency; resolvedBy chưa FK. | `src/finance/finance.controller.ts`; `src/finance/finance.service.ts` | 0 | 0 FK vào; 5 FK ra. Không có FK vào không đồng nghĩa được xóa lịch sử. | Giữ dữ liệu; thiết kế migration riêng theo lý do, chưa destructive change. |
| PayoutAccountVersion | NEEDS_REVIEW | Tài khoản nhận tiền mã hóa còn dùng trong ownership. Bỏ online không tự động đồng nghĩa bỏ thông tin đối soát; chưa drop. | `src/ownership/ownership.service.ts` | 0 | 1 FK vào; 2 FK ra. Bảng tham chiếu: ownership_transfers | Chờ xác nhận nghiệp vụ; chưa sửa schema. |

## FK cụ thể để duyệt migration

### UserSession / user_sessions

76 dòng tại thời điểm snapshot.

- `user_sessions_user_id_fkey`: `user_sessions` → `users`; `FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE`.

### PlatformSetting / platform_settings

0 dòng tại thời điểm snapshot.

Không có FK vật lý liên quan trong snapshot; vẫn kiểm tra JSON/scalar ID và query raw SQL.

### StaffInvitation / staff_invitations

0 dòng tại thời điểm snapshot.

- `staff_invitations_staff_profile_id_fkey`: `staff_invitations` → `staff_profiles`; `FOREIGN KEY (staff_profile_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### Role / roles

6 dòng tại thời điểm snapshot.

- `role_permissions_role_id_fkey`: `role_permissions` → `roles`; `FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `user_roles_role_id_fkey`: `user_roles` → `roles`; `FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE CASCADE ON DELETE CASCADE`.

### Permission / permissions

137 dòng tại thời điểm snapshot.

- `role_permissions_permission_id_fkey`: `role_permissions` → `permissions`; `FOREIGN KEY (permission_id) REFERENCES permissions(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `user_permissions_permission_id_fkey`: `user_permissions` → `permissions`; `FOREIGN KEY (permission_id) REFERENCES permissions(id) ON UPDATE CASCADE ON DELETE CASCADE`.

### UserPermission / user_permissions

69 dòng tại thời điểm snapshot.

- `user_permissions_permission_id_fkey`: `user_permissions` → `permissions`; `FOREIGN KEY (permission_id) REFERENCES permissions(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `user_permissions_user_id_fkey`: `user_permissions` → `users`; `FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE`.

### CustomerProfile / customer_profiles

1000 dòng tại thời điểm snapshot.

- `booking_health_records_customer_id_fkey`: `booking_health_records` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `bookings_customer_id_fkey`: `bookings` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `business_comments_customer_id_fkey`: `business_comments` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `consent_events_customer_id_fkey`: `consent_events` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `consultation_submissions_customer_id_fkey`: `consultation_submissions` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `customer_business_segments_customer_id_fkey`: `customer_business_segments` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `customer_profiles_user_id_fkey`: `customer_profiles` → `users`; `FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `customer_saved_services_customer_id_fkey`: `customer_saved_services` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `customer_vouchers_customer_id_fkey`: `customer_vouchers` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `data_subject_requests_customer_id_fkey`: `data_subject_requests` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `invoice_information_requests_customer_id_fkey`: `invoice_information_requests` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `loyalty_accounts_customer_id_fkey`: `loyalty_accounts` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `loyalty_transactions_customer_id_fkey`: `loyalty_transactions` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `marketing_preferences_customer_id_fkey`: `marketing_preferences` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `package_purchases_customer_id_fkey`: `package_purchases` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `price_adjustments_customer_id_fkey`: `price_adjustments` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `privacy_export_packages_customer_id_fkey`: `privacy_export_packages` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `promotion_redemptions_customer_id_fkey`: `promotion_redemptions` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `recurring_booking_plans_customer_id_fkey`: `recurring_booking_plans` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `reviews_customer_id_fkey`: `reviews` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `sensitive_consents_customer_id_fkey`: `sensitive_consents` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `voucher_redemptions_customer_id_fkey`: `voucher_redemptions` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `waitlist_entries_customer_id_fkey`: `waitlist_entries` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### StaffProfile / staff_profiles

29 dòng tại thời điểm snapshot.

- `appointment_change_requests_proposed_staff_id_fkey`: `appointment_change_requests` → `staff_profiles`; `FOREIGN KEY (proposed_staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `attendance_events_staff_id_fkey`: `archive_20260829_attendance_events` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `attendance_exception_requests_staff_id_fkey`: `archive_20260829_attendance_exception_requests` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `attendance_qr_uses_staff_id_fkey`: `archive_20260829_attendance_qr_uses` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `booking_services_staff_id_fkey`: `booking_services` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `compensation_assignments_staff_id_fkey`: `archive_20260829_compensation_assignments` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `compensation_entries_staff_id_fkey`: `archive_20260829_compensation_entries` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `operational_impact_items_replacement_staff_id_fkey`: `operational_impact_items` → `staff_profiles`; `FOREIGN KEY (replacement_staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `pay_run_items_staff_id_fkey`: `archive_20260829_pay_run_items` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `recurring_booking_plans_staff_id_fkey`: `recurring_booking_plans` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `review_service_ratings_staff_id_fkey`: `review_service_ratings` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `staff_attendances_staff_id_fkey`: `archive_20260829_staff_attendances` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_availabilities_staff_id_fkey`: `archive_20260829_staff_availabilities` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_branch_assignments_staff_id_fkey`: `staff_branch_assignments` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_breaks_staff_id_fkey`: `archive_20260829_staff_breaks` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_images_staff_id_fkey`: `staff_images` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_invitations_staff_profile_id_fkey`: `staff_invitations` → `staff_profiles`; `FOREIGN KEY (staff_profile_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `staff_leaves_staff_id_fkey`: `archive_20260829_staff_leaves` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_profiles_branch_id_fkey`: `staff_profiles` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `staff_profiles_user_id_fkey`: `staff_profiles` → `users`; `FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `staff_schedule_change_requests_staff_id_fkey`: `archive_20260829_staff_schedule_change_requests` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_schedule_versions_staff_id_fkey`: `archive_20260829_staff_schedule_versions` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_services_staff_id_fkey`: `staff_services` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_working_hours_staff_id_fkey`: `archive_20260829_staff_working_hours` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `timesheets_staff_id_fkey`: `archive_20260829_timesheets` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `waitlist_entries_staff_id_fkey`: `waitlist_entries` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### Business / businesses

5 dòng tại thời điểm snapshot.

- `attendance_events_business_id_fkey`: `archive_20260829_attendance_events` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `attendance_exception_requests_business_id_fkey`: `archive_20260829_attendance_exception_requests` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `attendance_qr_tokens_business_id_fkey`: `archive_20260829_attendance_qr_tokens` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `branches_business_id_fkey`: `branches` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `business_comments_business_id_fkey`: `business_comments` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `business_documents_business_id_fkey`: `business_documents` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `business_images_business_id_fkey`: `business_images` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `business_review_events_business_id_fkey`: `business_review_events` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `business_services_business_id_fkey`: `business_services` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `businesses_logo_media_id_fkey`: `businesses` → `media_files`; `FOREIGN KEY (logo_media_id) REFERENCES media_files(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `businesses_owner_id_fkey`: `businesses` → `business_owner_profiles`; `FOREIGN KEY (owner_id) REFERENCES business_owner_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `cancellation_policies_business_id_fkey`: `cancellation_policies` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `combos_business_id_fkey`: `combos` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `compensation_entries_business_id_fkey`: `archive_20260829_compensation_entries` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `compensation_rules_business_id_fkey`: `archive_20260829_compensation_rules` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `consent_events_business_id_fkey`: `consent_events` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `consultation_form_templates_business_id_fkey`: `consultation_form_templates` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `consultation_submissions_business_id_fkey`: `consultation_submissions` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `customer_business_segments_business_id_fkey`: `customer_business_segments` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `financial_ledger_entries_business_id_fkey`: `financial_ledger_entries` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `invoice_information_requests_business_id_fkey`: `invoice_information_requests` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `invoices_business_id_fkey`: `invoices` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `legal_entity_versions_business_id_fkey`: `legal_entity_versions` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `loyalty_accounts_business_id_fkey`: `loyalty_accounts` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `loyalty_rules_business_id_fkey`: `loyalty_rules` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `loyalty_transactions_business_id_fkey`: `loyalty_transactions` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `operational_impact_cases_business_id_fkey`: `operational_impact_cases` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `ownership_history_business_id_fkey`: `ownership_history` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `ownership_transfers_business_id_fkey`: `ownership_transfers` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `package_purchases_business_id_fkey`: `package_purchases` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `pay_runs_business_id_fkey`: `archive_20260829_pay_runs` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_intents_business_id_fkey`: `payment_intents` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_policies_business_id_fkey`: `payment_policies` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `payment_policy_snapshots_business_id_fkey`: `payment_policy_snapshots` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_transactions_business_id_fkey`: `payment_transactions` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payout_account_versions_business_id_fkey`: `payout_account_versions` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `platform_fee_adjustments_business_id_fkey`: `platform_fee_adjustments` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `platform_fee_entries_business_id_fkey`: `platform_fee_entries` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `platform_statements_business_id_fkey`: `platform_statements` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `pricing_snapshots_business_id_fkey`: `pricing_snapshots` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `promotion_businesses_business_id_fkey`: `promotion_businesses` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `promotions_business_id_fkey`: `promotions` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `salon_members_business_id_fkey`: `salon_members` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `salon_trust_snapshots_business_id_fkey`: `salon_trust_snapshots` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `sensitive_break_glass_grants_business_id_fkey`: `sensitive_break_glass_grants` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `sensitive_data_access_events_business_id_fkey`: `sensitive_data_access_events` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `service_categories_business_id_fkey`: `service_categories` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_attendances_business_id_fkey`: `archive_20260829_staff_attendances` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_availabilities_business_id_fkey`: `archive_20260829_staff_availabilities` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `timesheets_business_id_fkey`: `archive_20260829_timesheets` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `treatment_packages_business_id_fkey`: `treatment_packages` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `trust_actions_business_id_fkey`: `trust_actions` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `user_roles_business_id_fkey`: `user_roles` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `vouchers_business_id_fkey`: `vouchers` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `waitlist_entries_business_id_fkey`: `waitlist_entries` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### Branch / branches

11 dòng tại thời điểm snapshot.

- `attendance_events_branch_id_fkey`: `archive_20260829_attendance_events` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `attendance_exception_requests_branch_id_fkey`: `archive_20260829_attendance_exception_requests` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `attendance_qr_tokens_branch_id_fkey`: `archive_20260829_attendance_qr_tokens` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `bookings_branch_id_fkey`: `bookings` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `branch_attendance_policies_branch_id_fkey`: `archive_20260829_branch_attendance_policies` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `branch_booking_policies_branch_id_fkey`: `branch_booking_policies` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `branch_documents_branch_id_fkey`: `branch_documents` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `branch_holidays_branch_id_fkey`: `branch_holidays` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `branch_images_branch_id_fkey`: `branch_images` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `branch_onboarding_progress_branch_id_fkey`: `branch_onboarding_progress` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `branch_review_events_branch_id_fkey`: `branch_review_events` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `branch_review_requests_branch_id_fkey`: `branch_review_requests` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `branch_state_transitions_branch_id_fkey`: `branch_state_transitions` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `branch_working_hours_branch_id_fkey`: `branch_working_hours` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `branches_business_id_fkey`: `branches` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `branches_district_id_fkey`: `branches` → `districts`; `FOREIGN KEY (district_id) REFERENCES districts(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `combos_branch_id_fkey`: `combos` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `compensation_assignments_branch_id_fkey`: `archive_20260829_compensation_assignments` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `compensation_entries_branch_id_fkey`: `archive_20260829_compensation_entries` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `compensation_rules_branch_id_fkey`: `archive_20260829_compensation_rules` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `consent_events_branch_id_fkey`: `consent_events` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `consultation_form_templates_branch_id_fkey`: `consultation_form_templates` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `consultation_submissions_branch_id_fkey`: `consultation_submissions` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `financial_ledger_entries_branch_id_fkey`: `financial_ledger_entries` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `invoice_information_requests_branch_id_fkey`: `invoice_information_requests` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `invoices_branch_id_fkey`: `invoices` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `loyalty_rules_branch_id_fkey`: `loyalty_rules` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `operational_impact_cases_branch_id_fkey`: `operational_impact_cases` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `operational_impact_items_replacement_branch_id_fkey`: `operational_impact_items` → `branches`; `FOREIGN KEY (replacement_branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `package_purchases_branch_id_fkey`: `package_purchases` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_intents_branch_id_fkey`: `payment_intents` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_policies_branch_id_fkey`: `payment_policies` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `payment_policy_snapshots_branch_id_fkey`: `payment_policy_snapshots` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_transactions_branch_id_fkey`: `payment_transactions` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `platform_fee_adjustments_branch_id_fkey`: `platform_fee_adjustments` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `platform_fee_entries_branch_id_fkey`: `platform_fee_entries` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `price_adjustments_branch_id_fkey`: `price_adjustments` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `pricing_snapshots_branch_id_fkey`: `pricing_snapshots` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `promotion_branches_branch_id_fkey`: `promotion_branches` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `promotion_redemptions_branch_id_fkey`: `promotion_redemptions` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `recurring_booking_plans_branch_id_fkey`: `recurring_booking_plans` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `salon_members_branch_id_fkey`: `salon_members` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `sensitive_break_glass_grants_branch_id_fkey`: `sensitive_break_glass_grants` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `sensitive_data_access_events_branch_id_fkey`: `sensitive_data_access_events` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `services_branch_id_fkey`: `services` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `special_working_days_branch_id_fkey`: `special_working_days` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_attendances_branch_id_fkey`: `archive_20260829_staff_attendances` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_availabilities_branch_id_fkey`: `archive_20260829_staff_availabilities` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_branch_assignments_branch_id_fkey`: `staff_branch_assignments` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_profiles_branch_id_fkey`: `staff_profiles` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `staff_schedule_change_requests_branch_id_fkey`: `archive_20260829_staff_schedule_change_requests` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `staff_schedule_versions_branch_id_fkey`: `archive_20260829_staff_schedule_versions` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `timesheets_branch_id_fkey`: `archive_20260829_timesheets` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `treatment_packages_branch_id_fkey`: `treatment_packages` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `trust_actions_branch_id_fkey`: `trust_actions` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `user_roles_branch_id_fkey`: `user_roles` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `voucher_branch_scopes_branch_id_fkey`: `voucher_branch_scopes` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `voucher_redemptions_branch_id_fkey`: `voucher_redemptions` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `waitlist_entries_branch_id_fkey`: `waitlist_entries` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### BranchBookingPolicy / branch_booking_policies

11 dòng tại thời điểm snapshot.

- `branch_booking_policies_branch_id_fkey`: `branch_booking_policies` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.

### OverbookingOverride / overbooking_overrides

0 dòng tại thời điểm snapshot.

- `overbooking_overrides_booking_id_fkey`: `overbooking_overrides` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### MediaFile / media_files

0 dòng tại thời điểm snapshot.

- `branch_document_versions_media_id_fkey`: `branch_document_versions` → `media_files`; `FOREIGN KEY (media_id) REFERENCES media_files(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `branch_images_media_id_fkey`: `branch_images` → `media_files`; `FOREIGN KEY (media_id) REFERENCES media_files(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `business_document_versions_media_id_fkey`: `business_document_versions` → `media_files`; `FOREIGN KEY (media_id) REFERENCES media_files(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `business_images_media_id_fkey`: `business_images` → `media_files`; `FOREIGN KEY (media_id) REFERENCES media_files(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `businesses_logo_media_id_fkey`: `businesses` → `media_files`; `FOREIGN KEY (logo_media_id) REFERENCES media_files(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `combo_images_media_id_fkey`: `combo_images` → `media_files`; `FOREIGN KEY (media_id) REFERENCES media_files(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `media_files_uploaded_by_fkey`: `media_files` → `users`; `FOREIGN KEY (uploaded_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `service_images_media_id_fkey`: `service_images` → `media_files`; `FOREIGN KEY (media_id) REFERENCES media_files(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `staff_images_media_id_fkey`: `staff_images` → `media_files`; `FOREIGN KEY (media_id) REFERENCES media_files(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `users_avatar_media_id_fkey`: `users` → `media_files`; `FOREIGN KEY (avatar_media_id) REFERENCES media_files(id) ON UPDATE CASCADE ON DELETE SET NULL`.

### Booking / bookings

4000 dòng tại thời điểm snapshot.

- `appointment_change_requests_booking_id_fkey`: `appointment_change_requests` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `booking_contacts_booking_id_fkey`: `booking_contacts` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `booking_health_records_booking_id_fkey`: `booking_health_records` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `booking_service_adjustments_booking_id_fkey`: `booking_service_adjustments` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `booking_services_booking_id_fkey`: `booking_services` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `booking_status_histories_booking_id_fkey`: `booking_status_histories` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `bookings_branch_id_fkey`: `bookings` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `bookings_cancelled_by_fkey`: `bookings` → `users`; `FOREIGN KEY (cancelled_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `bookings_customer_id_fkey`: `bookings` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `bookings_recurring_plan_id_fkey`: `bookings` → `recurring_booking_plans`; `FOREIGN KEY (recurring_plan_id) REFERENCES recurring_booking_plans(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `bookings_voucher_id_fkey`: `bookings` → `vouchers`; `FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `consent_events_booking_id_fkey`: `consent_events` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `consultation_submissions_booking_id_fkey`: `consultation_submissions` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `financial_ledger_entries_booking_id_fkey`: `financial_ledger_entries` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `invoice_information_requests_booking_id_fkey`: `invoice_information_requests` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `invoices_booking_id_fkey`: `invoices` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `loyalty_transactions_booking_id_fkey`: `loyalty_transactions` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `notification_outbox_related_booking_id_fkey`: `notification_outbox` → `bookings`; `FOREIGN KEY (related_booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `notifications_related_booking_id_fkey`: `notifications` → `bookings`; `FOREIGN KEY (related_booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `operational_impact_items_booking_id_fkey`: `operational_impact_items` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `overbooking_overrides_booking_id_fkey`: `overbooking_overrides` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `package_session_entitlements_booking_id_fkey`: `package_session_entitlements` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `payment_intents_booking_id_fkey`: `payment_intents` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_policy_snapshots_booking_id_fkey`: `payment_policy_snapshots` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_transactions_booking_id_fkey`: `payment_transactions` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payments_booking_id_fkey`: `payments` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `platform_fee_entries_booking_id_fkey`: `platform_fee_entries` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `price_adjustments_booking_id_fkey`: `price_adjustments` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `pricing_snapshots_booking_id_fkey`: `pricing_snapshots` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `promotion_redemptions_booking_id_fkey`: `promotion_redemptions` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `reviews_booking_id_fkey`: `reviews` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `sensitive_break_glass_grants_booking_id_fkey`: `sensitive_break_glass_grants` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `sensitive_data_access_events_booking_id_fkey`: `sensitive_data_access_events` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `voucher_redemptions_booking_id_fkey`: `voucher_redemptions` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `waitlist_entries_booking_id_fkey`: `waitlist_entries` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### BookingService / booking_services

4000 dòng tại thời điểm snapshot.

- `booking_service_adjustments_booking_service_id_fkey`: `booking_service_adjustments` → `booking_services`; `FOREIGN KEY (booking_service_id) REFERENCES booking_services(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `booking_services_booking_id_fkey`: `booking_services` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `booking_services_business_service_id_fkey`: `booking_services` → `business_services`; `FOREIGN KEY (business_service_id) REFERENCES business_services(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `booking_services_canonical_service_id_fkey`: `booking_services` → `canonical_services`; `FOREIGN KEY (canonical_service_id) REFERENCES canonical_services(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `booking_services_combo_id_fkey`: `booking_services` → `combos`; `FOREIGN KEY (combo_id) REFERENCES combos(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `booking_services_service_id_fkey`: `booking_services` → `services`; `FOREIGN KEY (service_id) REFERENCES services(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `booking_services_staff_id_fkey`: `booking_services` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `compensation_entries_booking_service_id_fkey`: `archive_20260829_compensation_entries` → `booking_services`; `FOREIGN KEY (booking_service_id) REFERENCES booking_services(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `invoice_lines_booking_service_id_fkey`: `invoice_lines` → `booking_services`; `FOREIGN KEY (booking_service_id) REFERENCES booking_services(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `package_session_entitlements_redeemed_booking_service_id_fkey`: `package_session_entitlements` → `booking_services`; `FOREIGN KEY (redeemed_booking_service_id) REFERENCES booking_services(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `refund_allocations_booking_service_id_fkey`: `refund_allocations` → `booking_services`; `FOREIGN KEY (booking_service_id) REFERENCES booking_services(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `review_service_ratings_booking_service_id_fkey`: `review_service_ratings` → `booking_services`; `FOREIGN KEY (booking_service_id) REFERENCES booking_services(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### RecurringBookingPlan / recurring_booking_plans

0 dòng tại thời điểm snapshot.

- `bookings_recurring_plan_id_fkey`: `bookings` → `recurring_booking_plans`; `FOREIGN KEY (recurring_plan_id) REFERENCES recurring_booking_plans(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `recurring_booking_plans_branch_id_fkey`: `recurring_booking_plans` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `recurring_booking_plans_combo_id_fkey`: `recurring_booking_plans` → `combos`; `FOREIGN KEY (combo_id) REFERENCES combos(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `recurring_booking_plans_customer_id_fkey`: `recurring_booking_plans` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `recurring_booking_plans_staff_id_fkey`: `recurring_booking_plans` → `staff_profiles`; `FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL`.

### RefundRequest / refund_requests

0 dòng tại thời điểm snapshot.

- `compensation_adjustments_refund_id_fkey`: `archive_20260829_compensation_adjustments` → `refund_requests`; `FOREIGN KEY (refund_id) REFERENCES refund_requests(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `financial_ledger_entries_refund_id_fkey`: `financial_ledger_entries` → `refund_requests`; `FOREIGN KEY (refund_id) REFERENCES refund_requests(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `loyalty_transactions_refund_request_id_fkey`: `loyalty_transactions` → `refund_requests`; `FOREIGN KEY (refund_request_id) REFERENCES refund_requests(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `platform_fee_adjustments_refund_id_fkey`: `platform_fee_adjustments` → `refund_requests`; `FOREIGN KEY (refund_id) REFERENCES refund_requests(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `refund_allocations_refund_id_fkey`: `refund_allocations` → `refund_requests`; `FOREIGN KEY (refund_id) REFERENCES refund_requests(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `refund_requests_payment_id_fkey`: `refund_requests` → `payments`; `FOREIGN KEY (payment_id) REFERENCES payments(id) ON UPDATE CASCADE ON DELETE CASCADE`.

### PaymentPolicy / payment_policies

0 dòng tại thời điểm snapshot.

- `payment_policies_branch_id_fkey`: `payment_policies` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `payment_policies_business_id_fkey`: `payment_policies` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `payment_policies_service_id_fkey`: `payment_policies` → `services`; `FOREIGN KEY (service_id) REFERENCES services(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `payment_policy_snapshots_payment_policy_id_fkey`: `payment_policy_snapshots` → `payment_policies`; `FOREIGN KEY (payment_policy_id) REFERENCES payment_policies(id) ON UPDATE CASCADE ON DELETE SET NULL`.

### PaymentPolicySnapshot / payment_policy_snapshots

4000 dòng tại thời điểm snapshot.

- `payment_policy_snapshots_booking_id_fkey`: `payment_policy_snapshots` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_policy_snapshots_branch_id_fkey`: `payment_policy_snapshots` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_policy_snapshots_business_id_fkey`: `payment_policy_snapshots` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_policy_snapshots_payment_policy_id_fkey`: `payment_policy_snapshots` → `payment_policies`; `FOREIGN KEY (payment_policy_id) REFERENCES payment_policies(id) ON UPDATE CASCADE ON DELETE SET NULL`.

### PaymentIntent / payment_intents

4000 dòng tại thời điểm snapshot.

- `payment_intents_booking_id_fkey`: `payment_intents` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_intents_branch_id_fkey`: `payment_intents` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_intents_business_id_fkey`: `payment_intents` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_intents_package_installment_id_fkey`: `payment_intents` → `package_installments`; `FOREIGN KEY (package_installment_id) REFERENCES package_installments(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_intents_package_purchase_id_fkey`: `payment_intents` → `package_purchases`; `FOREIGN KEY (package_purchase_id) REFERENCES package_purchases(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_transactions_intent_id_fkey`: `payment_transactions` → `payment_intents`; `FOREIGN KEY (intent_id) REFERENCES payment_intents(id) ON UPDATE CASCADE ON DELETE SET NULL`.

### PaymentTransaction / payment_transactions

4000 dòng tại thời điểm snapshot.

- `financial_ledger_entries_payment_transaction_id_fkey`: `financial_ledger_entries` → `payment_transactions`; `FOREIGN KEY (payment_transaction_id) REFERENCES payment_transactions(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_transactions_booking_id_fkey`: `payment_transactions` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_transactions_branch_id_fkey`: `payment_transactions` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_transactions_business_id_fkey`: `payment_transactions` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_transactions_intent_id_fkey`: `payment_transactions` → `payment_intents`; `FOREIGN KEY (intent_id) REFERENCES payment_intents(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `payment_transactions_package_installment_id_fkey`: `payment_transactions` → `package_installments`; `FOREIGN KEY (package_installment_id) REFERENCES package_installments(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_transactions_package_purchase_id_fkey`: `payment_transactions` → `package_purchases`; `FOREIGN KEY (package_purchase_id) REFERENCES package_purchases(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_transactions_payment_id_fkey`: `payment_transactions` → `payments`; `FOREIGN KEY (payment_id) REFERENCES payments(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `payment_transactions_reversal_of_id_fkey`: `payment_transactions` → `payment_transactions`; `FOREIGN KEY (reversal_of_id) REFERENCES payment_transactions(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### PackageInstallment / package_installments

0 dòng tại thời điểm snapshot.

- `package_installments_purchase_id_fkey`: `package_installments` → `package_purchases`; `FOREIGN KEY (purchase_id) REFERENCES package_purchases(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `payment_intents_package_installment_id_fkey`: `payment_intents` → `package_installments`; `FOREIGN KEY (package_installment_id) REFERENCES package_installments(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payment_transactions_package_installment_id_fkey`: `payment_transactions` → `package_installments`; `FOREIGN KEY (package_installment_id) REFERENCES package_installments(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### SalonMember / salon_members

0 dòng tại thời điểm snapshot.

- `salon_members_branch_id_fkey`: `salon_members` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `salon_members_business_id_fkey`: `salon_members` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `salon_members_user_id_fkey`: `salon_members` → `users`; `FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE`.

### CancellationPolicy / cancellation_policies

0 dòng tại thời điểm snapshot.

- `cancellation_policies_business_id_fkey`: `cancellation_policies` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.

### CustomerVoucher / customer_vouchers

0 dòng tại thời điểm snapshot.

- `customer_vouchers_customer_id_fkey`: `customer_vouchers` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `customer_vouchers_voucher_id_fkey`: `customer_vouchers` → `vouchers`; `FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `voucher_redemptions_customer_voucher_id_fkey`: `voucher_redemptions` → `customer_vouchers`; `FOREIGN KEY (customer_voucher_id) REFERENCES customer_vouchers(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### SensitiveConsent / sensitive_consents

2 dòng tại thời điểm snapshot.

- `booking_health_records_consent_id_fkey`: `booking_health_records` → `sensitive_consents`; `FOREIGN KEY (consent_id) REFERENCES sensitive_consents(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `sensitive_consents_customer_id_fkey`: `sensitive_consents` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE`.

### BookingHealthRecord / booking_health_records

0 dòng tại thời điểm snapshot.

- `booking_health_records_booking_id_fkey`: `booking_health_records` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `booking_health_records_consent_id_fkey`: `booking_health_records` → `sensitive_consents`; `FOREIGN KEY (consent_id) REFERENCES sensitive_consents(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `booking_health_records_customer_id_fkey`: `booking_health_records` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### HealthRecordAccessLog / health_record_access_logs

0 dòng tại thời điểm snapshot.

Không có FK vật lý liên quan trong snapshot; vẫn kiểm tra JSON/scalar ID và query raw SQL.

### ConsultationFormTemplate / consultation_form_templates

0 dòng tại thời điểm snapshot.

- `consultation_form_templates_branch_id_fkey`: `consultation_form_templates` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `consultation_form_templates_business_id_fkey`: `consultation_form_templates` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `consultation_form_versions_template_id_fkey`: `consultation_form_versions` → `consultation_form_templates`; `FOREIGN KEY (template_id) REFERENCES consultation_form_templates(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `service_consultation_requirements_template_id_fkey`: `service_consultation_requirements` → `consultation_form_templates`; `FOREIGN KEY (template_id) REFERENCES consultation_form_templates(id) ON UPDATE CASCADE ON DELETE CASCADE`.

### ConsultationFormVersion / consultation_form_versions

0 dòng tại thời điểm snapshot.

- `consultation_form_fields_version_id_fkey`: `consultation_form_fields` → `consultation_form_versions`; `FOREIGN KEY (version_id) REFERENCES consultation_form_versions(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `consultation_form_versions_template_id_fkey`: `consultation_form_versions` → `consultation_form_templates`; `FOREIGN KEY (template_id) REFERENCES consultation_form_templates(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `consultation_submissions_version_id_fkey`: `consultation_submissions` → `consultation_form_versions`; `FOREIGN KEY (version_id) REFERENCES consultation_form_versions(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### ConsultationFormField / consultation_form_fields

0 dòng tại thời điểm snapshot.

- `consent_events_field_id_fkey`: `consent_events` → `consultation_form_fields`; `FOREIGN KEY (field_id) REFERENCES consultation_form_fields(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `consultation_form_fields_version_id_fkey`: `consultation_form_fields` → `consultation_form_versions`; `FOREIGN KEY (version_id) REFERENCES consultation_form_versions(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `sensitive_answers_field_id_fkey`: `sensitive_answers` → `consultation_form_fields`; `FOREIGN KEY (field_id) REFERENCES consultation_form_fields(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### ServiceConsultationRequirement / service_consultation_requirements

0 dòng tại thời điểm snapshot.

- `service_consultation_requirements_service_id_fkey`: `service_consultation_requirements` → `services`; `FOREIGN KEY (service_id) REFERENCES services(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `service_consultation_requirements_template_id_fkey`: `service_consultation_requirements` → `consultation_form_templates`; `FOREIGN KEY (template_id) REFERENCES consultation_form_templates(id) ON UPDATE CASCADE ON DELETE CASCADE`.

### ConsultationSubmission / consultation_submissions

0 dòng tại thời điểm snapshot.

- `consent_events_submission_id_fkey`: `consent_events` → `consultation_submissions`; `FOREIGN KEY (submission_id) REFERENCES consultation_submissions(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `consultation_submissions_booking_id_fkey`: `consultation_submissions` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `consultation_submissions_branch_id_fkey`: `consultation_submissions` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `consultation_submissions_business_id_fkey`: `consultation_submissions` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `consultation_submissions_customer_id_fkey`: `consultation_submissions` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `consultation_submissions_service_id_fkey`: `consultation_submissions` → `services`; `FOREIGN KEY (service_id) REFERENCES services(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `consultation_submissions_version_id_fkey`: `consultation_submissions` → `consultation_form_versions`; `FOREIGN KEY (version_id) REFERENCES consultation_form_versions(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `sensitive_answers_submission_id_fkey`: `sensitive_answers` → `consultation_submissions`; `FOREIGN KEY (submission_id) REFERENCES consultation_submissions(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `sensitive_data_access_events_submission_id_fkey`: `sensitive_data_access_events` → `consultation_submissions`; `FOREIGN KEY (submission_id) REFERENCES consultation_submissions(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### SensitiveAnswer / sensitive_answers

0 dòng tại thời điểm snapshot.

- `sensitive_answers_field_id_fkey`: `sensitive_answers` → `consultation_form_fields`; `FOREIGN KEY (field_id) REFERENCES consultation_form_fields(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `sensitive_answers_submission_id_fkey`: `sensitive_answers` → `consultation_submissions`; `FOREIGN KEY (submission_id) REFERENCES consultation_submissions(id) ON UPDATE CASCADE ON DELETE CASCADE`.
- `sensitive_data_access_events_answer_id_fkey`: `sensitive_data_access_events` → `sensitive_answers`; `FOREIGN KEY (answer_id) REFERENCES sensitive_answers(id) ON UPDATE CASCADE ON DELETE SET NULL`.

### ConsentEvent / consent_events

0 dòng tại thời điểm snapshot.

- `consent_events_booking_id_fkey`: `consent_events` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `consent_events_branch_id_fkey`: `consent_events` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `consent_events_business_id_fkey`: `consent_events` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `consent_events_customer_id_fkey`: `consent_events` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `consent_events_field_id_fkey`: `consent_events` → `consultation_form_fields`; `FOREIGN KEY (field_id) REFERENCES consultation_form_fields(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `consent_events_revoke_of_event_id_fkey`: `consent_events` → `consent_events`; `FOREIGN KEY (revoke_of_event_id) REFERENCES consent_events(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `consent_events_service_id_fkey`: `consent_events` → `services`; `FOREIGN KEY (service_id) REFERENCES services(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `consent_events_submission_id_fkey`: `consent_events` → `consultation_submissions`; `FOREIGN KEY (submission_id) REFERENCES consultation_submissions(id) ON UPDATE CASCADE ON DELETE CASCADE`.

### SensitiveDataAccessEvent / sensitive_data_access_events

0 dòng tại thời điểm snapshot.

- `sensitive_data_access_events_answer_id_fkey`: `sensitive_data_access_events` → `sensitive_answers`; `FOREIGN KEY (answer_id) REFERENCES sensitive_answers(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `sensitive_data_access_events_booking_id_fkey`: `sensitive_data_access_events` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `sensitive_data_access_events_branch_id_fkey`: `sensitive_data_access_events` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `sensitive_data_access_events_break_glass_grant_id_fkey`: `sensitive_data_access_events` → `sensitive_break_glass_grants`; `FOREIGN KEY (break_glass_grant_id) REFERENCES sensitive_break_glass_grants(id) ON UPDATE CASCADE ON DELETE SET NULL`.
- `sensitive_data_access_events_business_id_fkey`: `sensitive_data_access_events` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `sensitive_data_access_events_submission_id_fkey`: `sensitive_data_access_events` → `consultation_submissions`; `FOREIGN KEY (submission_id) REFERENCES consultation_submissions(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### SensitiveBreakGlassGrant / sensitive_break_glass_grants

0 dòng tại thời điểm snapshot.

- `sensitive_break_glass_grants_booking_id_fkey`: `sensitive_break_glass_grants` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `sensitive_break_glass_grants_branch_id_fkey`: `sensitive_break_glass_grants` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `sensitive_break_glass_grants_business_id_fkey`: `sensitive_break_glass_grants` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `sensitive_data_access_events_break_glass_grant_id_fkey`: `sensitive_data_access_events` → `sensitive_break_glass_grants`; `FOREIGN KEY (break_glass_grant_id) REFERENCES sensitive_break_glass_grants(id) ON UPDATE CASCADE ON DELETE SET NULL`.

### ServiceVariant / service_variants

0 dòng tại thời điểm snapshot.

- `service_price_rules_variant_id_fkey`: `service_price_rules` → `service_variants`; `FOREIGN KEY (variant_id) REFERENCES service_variants(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `service_variants_service_id_fkey`: `service_variants` → `services`; `FOREIGN KEY (service_id) REFERENCES services(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### InvoiceInformationRequest / invoice_information_requests

0 dòng tại thời điểm snapshot.

- `invoice_information_requests_booking_id_fkey`: `invoice_information_requests` → `bookings`; `FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `invoice_information_requests_branch_id_fkey`: `invoice_information_requests` → `branches`; `FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `invoice_information_requests_business_id_fkey`: `invoice_information_requests` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `invoice_information_requests_customer_id_fkey`: `invoice_information_requests` → `customer_profiles`; `FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `invoice_information_requests_invoice_id_fkey`: `invoice_information_requests` → `invoices`; `FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

### PayoutAccountVersion / payout_account_versions

0 dòng tại thời điểm snapshot.

- `ownership_transfers_payout_account_version_id_fkey`: `ownership_transfers` → `payout_account_versions`; `FOREIGN KEY (payout_account_version_id) REFERENCES payout_account_versions(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payout_account_versions_business_id_fkey`: `payout_account_versions` → `businesses`; `FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT`.
- `payout_account_versions_created_by_fkey`: `payout_account_versions` → `users`; `FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT`.

## Quy trình archive/recovery bắt buộc trước khi được phép triển khai

1. Chốt retention/đơn vị có quyền đọc archive, đặc biệt 2 dòng consent; không xuất nội dung cá nhân vào Git.
2. Kiểm tra lại callers, Prisma relation và SQL trigger/function tham chiếu 12 bảng; archive theo cả graph. FK ra User/Booking/Service phải giữ ID và được bảo vệ, không CASCADE xóa lịch sử.
3. Backup native PostgreSQL, kiểm tra restore trên fresh copy; lưu counts/fingerprint cả graph và 4.000 booking trước/sau. Không vô hiệu trigger bất biến của HealthRecordAccessLog để xóa dữ liệu.
4. Chuẩn bị forward migration archive/rename và reverse migration tương ứng. Chưa có SQL migration cleanup được phê duyệt; không gọi đây là rollback đã được kiểm chứng.
5. Sau chỉnh Prisma, regenerate client, sửa code còn tham chiếu retired model, chạy build/unit/DB/API/browser; kiểm tra hủy/no-show/điểm/giới hạn/role/public-preview/counter payment và concurrency.
6. Nếu rehearsal lỗi hoặc fingerprint đổi ngoài phạm vi: dừng. Recovery dùng bản backup đã restore thử hoặc reverse migration trong cửa sổ bảo trì; không reset database.
7. Chỉ triển khai DB chính sau người dùng phê duyệt phạm vi và bằng chứng rehearsal. Chưa vẽ 5 sơ đồ khóa luận cuối cùng trước khi chốt schema.
