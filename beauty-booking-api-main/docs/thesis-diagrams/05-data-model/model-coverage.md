# Coverage model

Tất cả model hiện tại đều có miền, hình và từ điển; hình rút gọn cột/FK có công bố. Hạ tầng và di sản không bắt buộc có UC trực tiếp.

| Model | Bảng | Miền/hình | Phân loại | UC liên quan trực tiếp |
|---|---|---|---|---|
| User | users | [ERD-identity](ERD-identity.puml) | Nghiệp vụ | SUC-02, SUC-03, SUC-04, SUC-37 |
| AccountToken | account_tokens | [ERD-identity](ERD-identity.puml) | Nghiệp vụ | SUC-02, SUC-03 |
| UserSession | user_sessions | [ERD-identity](ERD-identity.puml) | Nghiệp vụ | SUC-02, SUC-03 |
| PlatformSetting | platform_settings | [ERD-notifications](ERD-notifications.puml) | Nghiệp vụ | SUC-38 |
| StaffInvitation | staff_invitations | [ERD-staff](ERD-staff.puml) | Nghiệp vụ | SUC-26 |
| Role | roles | [ERD-rbac](ERD-rbac.puml) | Nghiệp vụ | SUC-37 |
| Permission | permissions | [ERD-rbac](ERD-rbac.puml) | Nghiệp vụ | SUC-37 |
| RolePermission | role_permissions | [ERD-rbac](ERD-rbac.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Vai trò và cấp quyền |
| UserPermission | user_permissions | [ERD-rbac](ERD-rbac.puml) | Nghiệp vụ | SUC-37 |
| UserRole | user_roles | [ERD-rbac](ERD-rbac.puml) | Nghiệp vụ | SUC-26, SUC-37 |
| CustomerProfile | customer_profiles | [ERD-identity](ERD-identity.puml) | Nghiệp vụ | SUC-02, SUC-04, SUC-12, SUC-13 |
| BookingContact | booking_contacts | [ERD-booking](ERD-booking.puml) | Nghiệp vụ | SUC-05, SUC-13 |
| BusinessOwnerProfile | business_owner_profiles | [ERD-identity](ERD-identity.puml) | Nghiệp vụ | SUC-02, SUC-34 |
| StaffProfile | staff_profiles | [ERD-staff](ERD-staff.puml) | Nghiệp vụ | SUC-01, SUC-04, SUC-05, SUC-14, SUC-26 |
| DeviceToken | device_tokens | [ERD-notifications](ERD-notifications.puml) | Nghiệp vụ | SUC-31 |
| Province | provinces | [ERD-opening](ERD-opening.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Địa bàn và giờ mở cửa |
| District | districts | [ERD-opening](ERD-opening.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Địa bàn và giờ mở cửa |
| Business | businesses | [ERD-business](ERD-business.puml) | Nghiệp vụ | SUC-22, SUC-34 |
| Branch | branches | [ERD-branch](ERD-branch.puml) | Nghiệp vụ | SUC-01, SUC-24 |
| BranchWorkingHour | branch_working_hours | [ERD-opening](ERD-opening.puml) | Nghiệp vụ | SUC-06, SUC-24 |
| BranchOnboardingProgress | branch_onboarding_progress | [ERD-branch](ERD-branch.puml) | Nghiệp vụ | SUC-24 |
| BranchBookingPolicy | branch_booking_policies | [ERD-branch](ERD-branch.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Chi nhánh |
| OverbookingOverride | overbooking_overrides | [ERD-policy](ERD-policy.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Yêu cầu và chính sách khách |
| BranchHoliday | branch_holidays | [ERD-opening](ERD-opening.puml) | Nghiệp vụ | SUC-06 |
| SpecialWorkingDay | special_working_days | [ERD-opening](ERD-opening.puml) | Nghiệp vụ | SUC-06 |
| StaffBranchAssignment | staff_branch_assignments | [ERD-staff](ERD-staff.puml) | Nghiệp vụ | SUC-26 |
| MediaFile | media_files | [ERD-media](ERD-media.puml) | Nghiệp vụ | SUC-04, SUC-40 |
| BusinessImage | business_images | [ERD-media](ERD-media.puml) | Nghiệp vụ | SUC-40 |
| BranchImage | branch_images | [ERD-media](ERD-media.puml) | Nghiệp vụ | SUC-40 |
| ServiceImage | service_images | [ERD-media](ERD-media.puml) | Nghiệp vụ | SUC-40 |
| ComboImage | combo_images | [ERD-combo](ERD-combo.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Combo |
| StaffImage | staff_images | [ERD-media](ERD-media.puml) | Nghiệp vụ | SUC-40 |
| ServiceCategory | service_categories | [ERD-catalog](ERD-catalog.puml) | Nghiệp vụ | SUC-38 |
| CanonicalService | canonical_services | [ERD-catalog](ERD-catalog.puml) | Nghiệp vụ | SUC-25, SUC-38 |
| BusinessService | business_services | [ERD-catalog](ERD-catalog.puml) | Nghiệp vụ | SUC-25 |
| BranchServiceOffering | services | [ERD-catalog](ERD-catalog.puml) | Nghiệp vụ | SUC-01, SUC-05, SUC-07, SUC-12, SUC-25, SUC-27 |
| StaffService | staff_services | [ERD-staff](ERD-staff.puml) | Nghiệp vụ | SUC-06, SUC-26 |
| Combo | combos | [ERD-combo](ERD-combo.puml) | Nghiệp vụ | SUC-27 |
| ComboService | combo_services | [ERD-combo](ERD-combo.puml) | Nghiệp vụ | SUC-27 |
| Promotion | promotions | [ERD-promotion](ERD-promotion.puml) | Nghiệp vụ | SUC-07, SUC-28 |
| PromotionBusiness | promotion_businesses | [ERD-promotion](ERD-promotion.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Khuyến mãi và phạm vi |
| PromotionBranch | promotion_branches | [ERD-promotion](ERD-promotion.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Khuyến mãi và phạm vi |
| PromotionService | promotion_services | [ERD-promotion](ERD-promotion.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Khuyến mãi và phạm vi |
| PromotionCombo | promotion_combos | [ERD-promotion](ERD-promotion.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Khuyến mãi và phạm vi |
| Booking | bookings | [ERD-booking](ERD-booking.puml) | Nghiệp vụ | SUC-05, SUC-08, SUC-09, SUC-10, SUC-11, SUC-13, SUC-14, SUC-15, SUC-16, SUC-17, SUC-36 |
| BookingService | booking_services | [ERD-booking](ERD-booking.puml) | Nghiệp vụ | SUC-05, SUC-06, SUC-09, SUC-13, SUC-14, SUC-15, SUC-17, SUC-29 |
| BookingStatusHistory | booking_status_histories | [ERD-booking](ERD-booking.puml) | Nghiệp vụ | SUC-09, SUC-16 |
| RecurringBookingPlan | recurring_booking_plans | [ERD-policy](ERD-policy.puml) | Nghiệp vụ | SUC-11 |
| Payment | payments | [ERD-payment](ERD-payment.puml) | Nghiệp vụ | SUC-18, SUC-19, SUC-20, SUC-36 |
| RefundRequest | refund_requests | [ERD-refund](ERD-refund.puml) | Nghiệp vụ | SUC-19, SUC-20 |
| PricingSnapshot | pricing_snapshots | [ERD-payment](ERD-payment.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Thanh toán |
| PaymentPolicy | payment_policies | [ERD-refund](ERD-refund.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Hoàn tiền và sổ cái |
| PaymentPolicySnapshot | payment_policy_snapshots | [ERD-payment](ERD-payment.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Thanh toán |
| PaymentIntent | payment_intents | [ERD-payment](ERD-payment.puml) | Nghiệp vụ | SUC-18 |
| PaymentTransaction | payment_transactions | [ERD-payment](ERD-payment.puml) | Nghiệp vụ | SUC-18 |
| FinancialLedgerEntry | financial_ledger_entries | [ERD-refund](ERD-refund.puml) | Nghiệp vụ | SUC-18, SUC-20, SUC-36 |
| RefundAllocation | refund_allocations | [ERD-refund](ERD-refund.puml) | Nghiệp vụ | SUC-20 |
| PlatformFeeEntry | platform_fee_entries | [ERD-statement](ERD-statement.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Phí và đối soát nền tảng |
| PlatformFeeAdjustment | platform_fee_adjustments | [ERD-statement](ERD-statement.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Phí và đối soát nền tảng |
| PlatformStatement | platform_statements | [ERD-statement](ERD-statement.puml) | Nghiệp vụ | SUC-36 |
| PlatformStatementLine | platform_statement_lines | [ERD-statement](ERD-statement.puml) | Nghiệp vụ | SUC-36 |
| TreatmentPackage | treatment_packages | [ERD-package](ERD-package.puml) | Nghiệp vụ | SUC-21 |
| PackagePurchase | package_purchases | [ERD-package](ERD-package.puml) | Nghiệp vụ | SUC-21 |
| PackageInstallment | package_installments | [ERD-package](ERD-package.puml) | Nghiệp vụ | SUC-21 |
| PackageSessionEntitlement | package_session_entitlements | [ERD-package](ERD-package.puml) | Nghiệp vụ | SUC-21 |
| Review | reviews | [ERD-review](ERD-review.puml) | Nghiệp vụ | SUC-01, SUC-29 |
| ReviewServiceRating | review_service_ratings | [ERD-review](ERD-review.puml) | Nghiệp vụ | SUC-29 |
| BusinessComment | business_comments | [ERD-review](ERD-review.puml) | Nghiệp vụ | SUC-30 |
| Notification | notifications | [ERD-notifications](ERD-notifications.puml) | Nghiệp vụ | SUC-31 |
| NotificationOutbox | notification_outbox | [ERD-notifications](ERD-notifications.puml) | Nghiệp vụ | SUC-31 |
| AuditLog | audit_logs | [ERD-governance](ERD-governance.puml) | Nghiệp vụ | SUC-39 |
| SalonMember | salon_members | [ERD-business](ERD-business.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Doanh nghiệp và thành viên |
| CancellationPolicy | cancellation_policies | [ERD-business](ERD-business.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Doanh nghiệp và thành viên |
| Voucher | vouchers | [ERD-voucher](ERD-voucher.puml) | Nghiệp vụ | SUC-07, SUC-28 |
| CustomerVoucher | customer_vouchers | [ERD-voucher](ERD-voucher.puml) | Nghiệp vụ | SUC-28 |
| AppointmentChangeRequest | appointment_change_requests | [ERD-policy](ERD-policy.puml) | Nghiệp vụ | SUC-10, SUC-15 |
| BookingViolationEvent | booking_violation_events | [ERD-policy](ERD-policy.puml) | Nghiệp vụ | SUC-08, SUC-10, SUC-16 |
| CustomerBookingPolicy | customer_booking_policies | [ERD-policy](ERD-policy.puml) | Nghiệp vụ | SUC-08 |
| SalonTrustSnapshot | salon_trust_snapshots | [ERD-governance](ERD-governance.puml) | Nghiệp vụ | SUC-39 |
| TrustAction | trust_actions | [ERD-governance](ERD-governance.puml) | Nghiệp vụ | SUC-39 |
| BusinessReviewEvent | business_review_events | [ERD-business-docs](ERD-business-docs.puml) | Nghiệp vụ | SUC-22, SUC-23 |
| BusinessDocument | business_documents | [ERD-business-docs](ERD-business-docs.puml) | Nghiệp vụ | SUC-22 |
| BusinessDocumentVersion | business_document_versions | [ERD-business-docs](ERD-business-docs.puml) | Nghiệp vụ | SUC-22 |
| BranchDocument | branch_documents | [ERD-branch-docs](ERD-branch-docs.puml) | Nghiệp vụ | SUC-24 |
| BranchDocumentVersion | branch_document_versions | [ERD-branch-docs](ERD-branch-docs.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Hồ sơ chi nhánh |
| BranchReviewRequest | branch_review_requests | [ERD-branch-docs](ERD-branch-docs.puml) | Nghiệp vụ | SUC-23 |
| BranchReviewEvent | branch_review_events | [ERD-branch-docs](ERD-branch-docs.puml) | Nghiệp vụ | SUC-23 |
| DocumentReviewEvent | document_review_events | [ERD-business-docs](ERD-business-docs.puml) | Nghiệp vụ | SUC-23 |
| ReviewReport | review_reports | [ERD-review](ERD-review.puml) | Nghiệp vụ | SUC-30 |
| DataSubjectRequest | data_subject_requests | [ERD-personal](ERD-personal.puml) | Nghiệp vụ | SUC-32 |
| BranchStateTransition | branch_state_transitions | [ERD-branch](ERD-branch.puml) | Nghiệp vụ | SUC-33 |
| PriceAdjustment | price_adjustments | [ERD-redemption](ERD-redemption.puml) | Nghiệp vụ | SUC-07 |
| PromotionRedemption | promotion_redemptions | [ERD-redemption](ERD-redemption.puml) | Nghiệp vụ | SUC-28 |
| VoucherRedemption | voucher_redemptions | [ERD-redemption](ERD-redemption.puml) | Nghiệp vụ | SUC-28 |
| ServiceVariant | service_variants | [ERD-variants](ERD-variants.puml) | Nghiệp vụ | SUC-25 |
| ServicePriceRule | service_price_rules | [ERD-variants](ERD-variants.puml) | Nghiệp vụ | SUC-25 |
| ServiceDependency | service_dependencies | [ERD-variants](ERD-variants.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Biến thể và phụ thuộc |
| BookingServiceAdjustment | booking_service_adjustments | [ERD-booking](ERD-booking.puml) | Nghiệp vụ | SUC-17 |
| OperationalImpactCase | operational_impact_cases | [ERD-governance](ERD-governance.puml) | Nghiệp vụ | SUC-33 |
| OperationalImpactItem | operational_impact_items | [ERD-governance](ERD-governance.puml) | Nghiệp vụ | SUC-33 |
| WaitlistEntry | waitlist_entries | [ERD-legacy-loyalty](ERD-legacy-loyalty.puml) | Di sản | Không ánh xạ trực tiếp; hỗ trợ miền DI SẢN: điểm thưởng và danh sách chờ |
| ReviewModerationEvent | review_moderation_events | [ERD-moderation](ERD-moderation.puml) | Nghiệp vụ | SUC-30 |
| ReviewAppeal | review_appeals | [ERD-moderation](ERD-moderation.puml) | Nghiệp vụ | SUC-30 |
| LoyaltyRule | loyalty_rules | [ERD-legacy-loyalty](ERD-legacy-loyalty.puml) | Di sản | Không ánh xạ trực tiếp; hỗ trợ miền DI SẢN: điểm thưởng và danh sách chờ |
| LoyaltyAccount | loyalty_accounts | [ERD-legacy-loyalty](ERD-legacy-loyalty.puml) | Di sản | Không ánh xạ trực tiếp; hỗ trợ miền DI SẢN: điểm thưởng và danh sách chờ |
| LoyaltyTransaction | loyalty_transactions | [ERD-legacy-loyalty](ERD-legacy-loyalty.puml) | Di sản | Không ánh xạ trực tiếp; hỗ trợ miền DI SẢN: điểm thưởng và danh sách chờ |
| Invoice | invoices | [ERD-legacy-invoice](ERD-legacy-invoice.puml) | Di sản | Không ánh xạ trực tiếp; hỗ trợ miền DI SẢN: hóa đơn và phiếu thu |
| InvoiceInformationRequest | invoice_information_requests | [ERD-legacy-invoice](ERD-legacy-invoice.puml) | Di sản | Không ánh xạ trực tiếp; hỗ trợ miền DI SẢN: hóa đơn và phiếu thu |
| InvoiceLine | invoice_lines | [ERD-legacy-invoice](ERD-legacy-invoice.puml) | Di sản | Không ánh xạ trực tiếp; hỗ trợ miền DI SẢN: hóa đơn và phiếu thu |
| InvoiceEvent | invoice_events | [ERD-legacy-invoice](ERD-legacy-invoice.puml) | Di sản | Không ánh xạ trực tiếp; hỗ trợ miền DI SẢN: hóa đơn và phiếu thu |
| OwnershipTransfer | ownership_transfers | [ERD-ownership](ERD-ownership.puml) | Nghiệp vụ | SUC-34, SUC-35 |
| OwnershipHistory | ownership_history | [ERD-ownership](ERD-ownership.puml) | Nghiệp vụ | SUC-35 |
| LegalEntityVersion | legal_entity_versions | [ERD-ownership](ERD-ownership.puml) | Nghiệp vụ | SUC-35 |
| PayoutAccountVersion | payout_account_versions | [ERD-ownership](ERD-ownership.puml) | Nghiệp vụ | SUC-35 |
| CustomerSavedService | customer_saved_services | [ERD-personal](ERD-personal.puml) | Nghiệp vụ | SUC-12 |
| VoucherBranchScope | voucher_branch_scopes | [ERD-voucher](ERD-voucher.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Voucher và phạm vi |
| VoucherServiceScope | voucher_service_scopes | [ERD-voucher](ERD-voucher.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Voucher và phạm vi |
| VoucherComboScope | voucher_combo_scopes | [ERD-voucher](ERD-voucher.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Voucher và phạm vi |
| CustomerBusinessSegment | customer_business_segments | [ERD-redemption](ERD-redemption.puml) | Hỗ trợ miền / hạ tầng | Không ánh xạ trực tiếp; hỗ trợ miền Áp dụng ưu đãi |
| MarketingPreference | marketing_preferences | [ERD-personal](ERD-personal.puml) | Nghiệp vụ | SUC-32 |
| PrivacyExportPackage | privacy_export_packages | [ERD-personal](ERD-personal.puml) | Nghiệp vụ | SUC-32 |

