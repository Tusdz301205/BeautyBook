# Catalogue FK đầy đủ

Mỗi dòng là relation có fields/references trong Prisma. Ký pháp: mỗi bản ghi nguồn trỏ tới bao nhiêu bản ghi đích; mỗi bản ghi đích có bao nhiêu bản ghi nguồn. Collection không ép tối thiểu 1. Unique có điều kiện trong SQL xem sql-constraints.md.

| Nguồn.FK | Đích | Nguồn → đích | Đích → nguồn | onDelete khai báo |
|---|---|---|---|---|
| User.avatarMediaId | MediaFile.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| AccountToken.userId | User.id | 1 | 0..* | Cascade |
| UserSession.userId | User.id | 1 | 0..* | Cascade |
| StaffInvitation.staffProfileId | StaffProfile.id | 0..1 | 0..* | Restrict |
| RolePermission.permissionId | Permission.id | 1 | 0..* | Cascade |
| RolePermission.roleId | Role.id | 1 | 0..* | Cascade |
| UserPermission.userId | User.id | 1 | 0..* | Cascade |
| UserPermission.permissionId | Permission.id | 1 | 0..* | Cascade |
| UserRole.branchId | Branch.id | 0..1 | 0..* | Cascade |
| UserRole.businessId | Business.id | 0..1 | 0..* | Cascade |
| UserRole.grantedBy | User.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| UserRole.roleId | Role.id | 1 | 0..* | Cascade |
| UserRole.userId | User.id | 1 | 0..* | Cascade |
| CustomerProfile.userId | User.id | 1 | 0..1 | Restrict |
| BookingContact.bookingId | Booking.id | 1 | 0..1 | Cascade |
| BusinessOwnerProfile.userId | User.id | 1 | 0..1 | Restrict |
| StaffProfile.branchId | Branch.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| StaffProfile.userId | User.id | 0..1 | 0..1 | mặc định Prisma (không ghi trong schema) |
| DeviceToken.userId | User.id | 1 | 0..* | Cascade |
| District.provinceId | Province.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| Business.logoMediaId | MediaFile.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| Business.ownerId | BusinessOwnerProfile.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| Branch.businessId | Business.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| Branch.districtId | District.id | 0..1 | 0..* | Restrict |
| BranchWorkingHour.branchId | Branch.id | 1 | 0..* | Cascade |
| BranchOnboardingProgress.branchId | Branch.id | 1 | 0..1 | Cascade |
| BranchBookingPolicy.branchId | Branch.id | 1 | 0..1 | Cascade |
| OverbookingOverride.bookingId | Booking.id | 1 | 0..1 | Restrict |
| BranchHoliday.branchId | Branch.id | 1 | 0..* | Cascade |
| SpecialWorkingDay.branchId | Branch.id | 1 | 0..* | Cascade |
| StaffBranchAssignment.staffId | StaffProfile.id | 1 | 0..* | Cascade |
| StaffBranchAssignment.branchId | Branch.id | 1 | 0..* | Cascade |
| MediaFile.uploadedBy | User.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| BusinessImage.businessId | Business.id | 1 | 0..* | Cascade |
| BusinessImage.mediaId | MediaFile.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| BranchImage.branchId | Branch.id | 1 | 0..* | Cascade |
| BranchImage.mediaId | MediaFile.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| ServiceImage.mediaId | MediaFile.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| ServiceImage.serviceId | BranchServiceOffering.id | 1 | 0..* | Cascade |
| ComboImage.comboId | Combo.id | 1 | 0..* | Cascade |
| ComboImage.mediaId | MediaFile.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| StaffImage.mediaId | MediaFile.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| StaffImage.staffId | StaffProfile.id | 1 | 0..* | Cascade |
| ServiceCategory.businessId | Business.id | 1 | 0..* | Cascade |
| ServiceCategory.parentId | ServiceCategory.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| CanonicalService.parentId | CanonicalService.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| CanonicalService.replacementCanonicalId | CanonicalService.id | 0..1 | 0..* | Restrict |
| BusinessService.businessId | Business.id | 1 | 0..* | Cascade |
| BusinessService.categoryId | ServiceCategory.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| BusinessService.canonicalServiceId | CanonicalService.id | 0..1 | 0..* | Restrict |
| BranchServiceOffering.branchId | Branch.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| BranchServiceOffering.businessServiceId | BusinessService.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| BranchServiceOffering.categoryId | ServiceCategory.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| StaffService.serviceId | BranchServiceOffering.id | 1 | 0..* | Cascade |
| StaffService.staffId | StaffProfile.id | 1 | 0..* | Cascade |
| Combo.businessId | Business.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| Combo.branchId | Branch.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| ComboService.comboId | Combo.id | 1 | 0..* | Cascade |
| ComboService.serviceId | BranchServiceOffering.id | 1 | 0..* | Cascade |
| Promotion.businessId | Business.id | 0..1 | 0..* | Cascade |
| PromotionBusiness.businessId | Business.id | 1 | 0..* | Cascade |
| PromotionBusiness.promotionId | Promotion.id | 1 | 0..* | Cascade |
| PromotionBranch.branchId | Branch.id | 1 | 0..* | Cascade |
| PromotionBranch.promotionId | Promotion.id | 1 | 0..* | Cascade |
| PromotionService.promotionId | Promotion.id | 1 | 0..* | Cascade |
| PromotionService.serviceId | BranchServiceOffering.id | 1 | 0..* | Cascade |
| PromotionCombo.comboId | Combo.id | 1 | 0..* | Cascade |
| PromotionCombo.promotionId | Promotion.id | 1 | 0..* | Cascade |
| Booking.branchId | Branch.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| Booking.cancelledBy | User.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| Booking.customerId | CustomerProfile.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| Booking.recurringPlanId | RecurringBookingPlan.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| Booking.voucherId | Voucher.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| BookingService.bookingId | Booking.id | 1 | 0..* | Cascade |
| BookingService.comboId | Combo.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| BookingService.serviceId | BranchServiceOffering.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| BookingService.businessServiceId | BusinessService.id | 1 | 0..* | Restrict |
| BookingService.canonicalServiceId | CanonicalService.id | 0..1 | 0..* | Restrict |
| BookingService.staffId | StaffProfile.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| BookingStatusHistory.bookingId | Booking.id | 1 | 0..* | Cascade |
| BookingStatusHistory.changedBy | User.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| RecurringBookingPlan.branchId | Branch.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| RecurringBookingPlan.customerId | CustomerProfile.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| RecurringBookingPlan.comboId | Combo.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| RecurringBookingPlan.staffId | StaffProfile.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| Payment.bookingId | Booking.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| RefundRequest.paymentId | Payment.id | 1 | 0..* | Cascade |
| PricingSnapshot.bookingId | Booking.id | 1 | 0..1 | Restrict |
| PricingSnapshot.businessId | Business.id | 1 | 0..* | Restrict |
| PricingSnapshot.branchId | Branch.id | 1 | 0..* | Restrict |
| PaymentPolicy.businessId | Business.id | 1 | 0..* | Cascade |
| PaymentPolicy.branchId | Branch.id | 0..1 | 0..* | Cascade |
| PaymentPolicy.serviceId | BranchServiceOffering.id | 0..1 | 0..* | Cascade |
| PaymentPolicySnapshot.bookingId | Booking.id | 1 | 0..1 | Restrict |
| PaymentPolicySnapshot.businessId | Business.id | 1 | 0..* | Restrict |
| PaymentPolicySnapshot.branchId | Branch.id | 1 | 0..* | Restrict |
| PaymentPolicySnapshot.paymentPolicyId | PaymentPolicy.id | 0..1 | 0..* | SetNull |
| PaymentIntent.bookingId | Booking.id | 0..1 | 0..* | Restrict |
| PaymentIntent.packagePurchaseId | PackagePurchase.id | 0..1 | 0..* | Restrict |
| PaymentIntent.packageInstallmentId | PackageInstallment.id | 0..1 | 0..* | Restrict |
| PaymentIntent.businessId | Business.id | 1 | 0..* | Restrict |
| PaymentIntent.branchId | Branch.id | 1 | 0..* | Restrict |
| PaymentTransaction.intentId | PaymentIntent.id | 0..1 | 0..* | SetNull |
| PaymentTransaction.paymentId | Payment.id | 0..1 | 0..* | SetNull |
| PaymentTransaction.bookingId | Booking.id | 0..1 | 0..* | Restrict |
| PaymentTransaction.packagePurchaseId | PackagePurchase.id | 0..1 | 0..* | Restrict |
| PaymentTransaction.packageInstallmentId | PackageInstallment.id | 0..1 | 0..* | Restrict |
| PaymentTransaction.businessId | Business.id | 1 | 0..* | Restrict |
| PaymentTransaction.branchId | Branch.id | 1 | 0..* | Restrict |
| PaymentTransaction.reversalOfId | PaymentTransaction.id | 0..1 | 0..1 | Restrict |
| FinancialLedgerEntry.businessId | Business.id | 1 | 0..* | Restrict |
| FinancialLedgerEntry.branchId | Branch.id | 1 | 0..* | Restrict |
| FinancialLedgerEntry.bookingId | Booking.id | 0..1 | 0..* | Restrict |
| FinancialLedgerEntry.paymentId | Payment.id | 0..1 | 0..* | Restrict |
| FinancialLedgerEntry.paymentTransactionId | PaymentTransaction.id | 0..1 | 0..* | Restrict |
| FinancialLedgerEntry.refundId | RefundRequest.id | 0..1 | 0..* | Restrict |
| RefundAllocation.refundId | RefundRequest.id | 1 | 0..* | Cascade |
| RefundAllocation.bookingServiceId | BookingService.id | 0..1 | 0..* | Restrict |
| PlatformFeeEntry.businessId | Business.id | 1 | 0..* | Restrict |
| PlatformFeeEntry.branchId | Branch.id | 1 | 0..* | Restrict |
| PlatformFeeEntry.bookingId | Booking.id | 1 | 0..1 | Restrict |
| PlatformFeeAdjustment.platformFeeId | PlatformFeeEntry.id | 1 | 0..* | Restrict |
| PlatformFeeAdjustment.businessId | Business.id | 1 | 0..* | Restrict |
| PlatformFeeAdjustment.branchId | Branch.id | 1 | 0..* | Restrict |
| PlatformFeeAdjustment.refundId | RefundRequest.id | 0..1 | 0..* | Restrict |
| PlatformStatement.businessId | Business.id | 1 | 0..* | Restrict |
| PlatformStatementLine.statementId | PlatformStatement.id | 1 | 0..* | Cascade |
| PlatformStatementLine.platformFeeId | PlatformFeeEntry.id | 0..1 | 0..* | Restrict |
| PlatformStatementLine.feeAdjustmentId | PlatformFeeAdjustment.id | 0..1 | 0..* | Restrict |
| TreatmentPackage.businessId | Business.id | 1 | 0..* | Cascade |
| TreatmentPackage.branchId | Branch.id | 0..1 | 0..* | Cascade |
| PackagePurchase.packageId | TreatmentPackage.id | 1 | 0..* | Restrict |
| PackagePurchase.customerId | CustomerProfile.id | 1 | 0..* | Restrict |
| PackagePurchase.businessId | Business.id | 1 | 0..* | Restrict |
| PackagePurchase.branchId | Branch.id | 0..1 | 0..* | Restrict |
| PackageInstallment.purchaseId | PackagePurchase.id | 1 | 0..* | Cascade |
| PackageSessionEntitlement.purchaseId | PackagePurchase.id | 1 | 0..* | Cascade |
| PackageSessionEntitlement.bookingId | Booking.id | 0..1 | 0..* | SetNull |
| PackageSessionEntitlement.redeemedBookingServiceId | BookingService.id | 0..1 | 0..1 | Restrict |
| Review.bookingId | Booking.id | 1 | 0..1 | mặc định Prisma (không ghi trong schema) |
| Review.customerId | CustomerProfile.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| ReviewServiceRating.bookingServiceId | BookingService.id | 1 | 0..1 | mặc định Prisma (không ghi trong schema) |
| ReviewServiceRating.reviewId | Review.id | 1 | 0..* | Cascade |
| ReviewServiceRating.staffId | StaffProfile.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| BusinessComment.businessId | Business.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| BusinessComment.customerId | CustomerProfile.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| BusinessComment.parentCommentId | BusinessComment.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| BusinessComment.reviewId | Review.id | 0..1 | 0..1 | mặc định Prisma (không ghi trong schema) |
| Notification.relatedBookingId | Booking.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| Notification.userId | User.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| NotificationOutbox.userId | User.id | 1 | 0..* | Restrict |
| NotificationOutbox.relatedBookingId | Booking.id | 0..1 | 0..* | Restrict |
| NotificationOutbox.notificationId | Notification.id | 0..1 | 0..1 | Restrict |
| AuditLog.userId | User.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| SalonMember.branchId | Branch.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| SalonMember.businessId | Business.id | 1 | 0..* | Cascade |
| SalonMember.userId | User.id | 1 | 0..* | Cascade |
| CancellationPolicy.businessId | Business.id | 1 | 0..1 | Cascade |
| Voucher.businessId | Business.id | 0..1 | 0..* | Cascade |
| CustomerVoucher.customerId | CustomerProfile.id | 1 | 0..* | Cascade |
| CustomerVoucher.voucherId | Voucher.id | 1 | 0..* | Cascade |
| AppointmentChangeRequest.bookingId | Booking.id | 1 | 0..* | Cascade |
| AppointmentChangeRequest.proposedStaffId | StaffProfile.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| AppointmentChangeRequest.requestedBy | User.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| AppointmentChangeRequest.reviewedBy | User.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| BookingViolationEvent.bookingId | Booking.id | 1 | 0..* | Restrict |
| BookingViolationEvent.customerId | CustomerProfile.id | 1 | 0..* | Restrict |
| BookingViolationEvent.businessId | Business.id | 1 | 0..* | Restrict |
| BookingViolationEvent.sourceRequestId | AppointmentChangeRequest.id | 0..1 | 0..1 | Restrict |
| BookingViolationEvent.recordedById | User.id | 1 | 0..* | Restrict |
| BookingViolationEvent.voidedById | User.id | 0..1 | 0..* | Restrict |
| CustomerBookingPolicy.customerId | CustomerProfile.id | 1 | 0..* | Restrict |
| CustomerBookingPolicy.businessId | Business.id | 1 | 0..* | Restrict |
| CustomerBookingPolicy.triggeredByViolationEventId | BookingViolationEvent.id | 0..1 | 0..1 | Restrict |
| SalonTrustSnapshot.businessId | Business.id | 1 | 0..1 | Cascade |
| TrustAction.businessId | Business.id | 1 | 0..* | Cascade |
| TrustAction.branchId | Branch.id | 0..1 | 0..* | SetNull |
| TrustAction.actorId | User.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| TrustAction.restoreOfActionId | TrustAction.id | 0..1 | 0..1 | SetNull |
| BusinessReviewEvent.businessId | Business.id | 1 | 0..* | Cascade |
| BusinessReviewEvent.actorId | User.id | 0..1 | 0..* | mặc định Prisma (không ghi trong schema) |
| BusinessDocument.businessId | Business.id | 1 | 0..* | Cascade |
| BusinessDocumentVersion.documentId | BusinessDocument.id | 1 | 0..* | Cascade |
| BusinessDocumentVersion.mediaId | MediaFile.id | 1 | 0..* | Restrict |
| BusinessDocumentVersion.createdBy | User.id | 1 | 0..* | Restrict |
| BranchDocument.branchId | Branch.id | 1 | 0..* | Cascade |
| BranchDocumentVersion.documentId | BranchDocument.id | 1 | 0..* | Cascade |
| BranchDocumentVersion.mediaId | MediaFile.id | 1 | 0..* | Restrict |
| BranchDocumentVersion.createdBy | User.id | 1 | 0..* | Restrict |
| BranchReviewRequest.branchId | Branch.id | 1 | 0..* | Cascade |
| BranchReviewRequest.requestedBy | User.id | 1 | 0..* | Restrict |
| BranchReviewRequest.assignedTo | User.id | 0..1 | 0..* | SetNull |
| BranchReviewEvent.branchId | Branch.id | 1 | 0..* | Cascade |
| BranchReviewEvent.actorId | User.id | 0..1 | 0..* | SetNull |
| DocumentReviewEvent.documentId | BusinessDocument.id | 1 | 0..* | Cascade |
| DocumentReviewEvent.actorId | User.id | 0..1 | 0..* | SetNull |
| ReviewReport.reviewId | Review.id | 1 | 0..* | Cascade |
| ReviewReport.reporterId | User.id | 1 | 0..* | mặc định Prisma (không ghi trong schema) |
| DataSubjectRequest.customerId | CustomerProfile.id | 1 | 0..* | Restrict |
| BranchStateTransition.branchId | Branch.id | 1 | 0..* | Restrict |
| BranchStateTransition.actorId | User.id | 1 | 0..* | Restrict |
| PriceAdjustment.bookingId | Booking.id | 0..1 | 0..* | Restrict |
| PriceAdjustment.branchId | Branch.id | 1 | 0..* | Restrict |
| PriceAdjustment.customerId | CustomerProfile.id | 0..1 | 0..* | Restrict |
| PromotionRedemption.promotionId | Promotion.id | 1 | 0..* | Restrict |
| PromotionRedemption.bookingId | Booking.id | 1 | 0..* | Restrict |
| PromotionRedemption.customerId | CustomerProfile.id | 1 | 0..* | Restrict |
| PromotionRedemption.branchId | Branch.id | 1 | 0..* | Restrict |
| VoucherRedemption.voucherId | Voucher.id | 1 | 0..* | Restrict |
| VoucherRedemption.customerVoucherId | CustomerVoucher.id | 0..1 | 0..* | Restrict |
| VoucherRedemption.customerId | CustomerProfile.id | 1 | 0..* | Restrict |
| VoucherRedemption.bookingId | Booking.id | 1 | 0..* | Restrict |
| VoucherRedemption.branchId | Branch.id | 1 | 0..* | Restrict |
| ServiceVariant.serviceId | BranchServiceOffering.id | 1 | 0..* | Restrict |
| ServicePriceRule.serviceId | BranchServiceOffering.id | 1 | 0..* | Restrict |
| ServicePriceRule.variantId | ServiceVariant.id | 0..1 | 0..* | Restrict |
| ServiceDependency.serviceId | BranchServiceOffering.id | 1 | 0..* | Restrict |
| ServiceDependency.requiredServiceId | BranchServiceOffering.id | 1 | 0..* | Restrict |
| BookingServiceAdjustment.bookingServiceId | BookingService.id | 1 | 0..* | Restrict |
| BookingServiceAdjustment.bookingId | Booking.id | 1 | 0..* | Restrict |
| BookingServiceAdjustment.actorId | User.id | 1 | 0..* | Restrict |
| OperationalImpactCase.businessId | Business.id | 1 | 0..* | Restrict |
| OperationalImpactCase.branchId | Branch.id | 0..1 | 0..* | Restrict |
| OperationalImpactCase.ownerId | User.id | 1 | 0..* | Restrict |
| OperationalImpactCase.createdBy | User.id | 1 | 0..* | Restrict |
| OperationalImpactItem.caseId | OperationalImpactCase.id | 1 | 0..* | Restrict |
| OperationalImpactItem.bookingId | Booking.id | 1 | 0..* | Restrict |
| OperationalImpactItem.replacementStaffId | StaffProfile.id | 0..1 | 0..* | Restrict |
| OperationalImpactItem.replacementBranchId | Branch.id | 0..1 | 0..* | Restrict |
| OperationalImpactItem.resolvedBy | User.id | 0..1 | 0..* | Restrict |
| WaitlistEntry.customerId | CustomerProfile.id | 1 | 0..* | Restrict |
| WaitlistEntry.businessId | Business.id | 1 | 0..* | Restrict |
| WaitlistEntry.branchId | Branch.id | 1 | 0..* | Restrict |
| WaitlistEntry.serviceId | BranchServiceOffering.id | 1 | 0..* | Restrict |
| WaitlistEntry.staffId | StaffProfile.id | 0..1 | 0..* | Restrict |
| WaitlistEntry.bookingId | Booking.id | 0..1 | 0..1 | Restrict |
| ReviewModerationEvent.reviewId | Review.id | 1 | 0..* | Restrict |
| ReviewModerationEvent.actorId | User.id | 1 | 0..* | Restrict |
| ReviewAppeal.reviewId | Review.id | 1 | 0..* | Restrict |
| ReviewAppeal.appellantId | User.id | 1 | 0..* | Restrict |
| ReviewAppeal.reviewedBy | User.id | 0..1 | 0..* | Restrict |
| LoyaltyRule.businessId | Business.id | 1 | 0..* | Restrict |
| LoyaltyRule.branchId | Branch.id | 0..1 | 0..* | Restrict |
| LoyaltyRule.createdBy | User.id | 1 | 0..* | Restrict |
| LoyaltyAccount.businessId | Business.id | 1 | 0..* | Restrict |
| LoyaltyAccount.customerId | CustomerProfile.id | 1 | 0..* | Restrict |
| LoyaltyTransaction.accountId | LoyaltyAccount.id | 1 | 0..* | Restrict |
| LoyaltyTransaction.businessId | Business.id | 1 | 0..* | Restrict |
| LoyaltyTransaction.customerId | CustomerProfile.id | 1 | 0..* | Restrict |
| LoyaltyTransaction.bookingId | Booking.id | 0..1 | 0..* | Restrict |
| LoyaltyTransaction.refundRequestId | RefundRequest.id | 0..1 | 0..* | Restrict |
| LoyaltyTransaction.reversalOfId | LoyaltyTransaction.id | 0..1 | 0..* | Restrict |
| LoyaltyTransaction.createdBy | User.id | 0..1 | 0..* | Restrict |
| Invoice.replacesInvoiceId | Invoice.id | 0..1 | 0..1 | Restrict |
| Invoice.businessId | Business.id | 1 | 0..* | Restrict |
| Invoice.branchId | Branch.id | 1 | 0..* | Restrict |
| Invoice.bookingId | Booking.id | 0..1 | 0..* | Restrict |
| Invoice.paymentId | Payment.id | 0..1 | 0..* | Restrict |
| Invoice.createdBy | User.id | 1 | 0..* | Restrict |
| InvoiceInformationRequest.bookingId | Booking.id | 1 | 0..* | Restrict |
| InvoiceInformationRequest.customerId | CustomerProfile.id | 1 | 0..* | Restrict |
| InvoiceInformationRequest.businessId | Business.id | 1 | 0..* | Restrict |
| InvoiceInformationRequest.branchId | Branch.id | 1 | 0..* | Restrict |
| InvoiceInformationRequest.invoiceId | Invoice.id | 0..1 | 0..1 | Restrict |
| InvoiceLine.invoiceId | Invoice.id | 1 | 0..* | Restrict |
| InvoiceLine.bookingServiceId | BookingService.id | 0..1 | 0..* | Restrict |
| InvoiceEvent.invoiceId | Invoice.id | 1 | 0..* | Restrict |
| InvoiceEvent.actorId | User.id | 1 | 0..* | Restrict |
| OwnershipTransfer.businessId | Business.id | 1 | 0..* | Restrict |
| OwnershipTransfer.oldOwnerId | BusinessOwnerProfile.id | 1 | 0..* | Restrict |
| OwnershipTransfer.newOwnerUserId | User.id | 1 | 0..* | Restrict |
| OwnershipTransfer.legalEntityVersionId | LegalEntityVersion.id | 0..1 | 0..* | Restrict |
| OwnershipTransfer.payoutAccountVersionId | PayoutAccountVersion.id | 0..1 | 0..* | Restrict |
| OwnershipTransfer.requestedBy | User.id | 1 | 0..* | Restrict |
| OwnershipTransfer.approvedBy | User.id | 0..1 | 0..* | Restrict |
| OwnershipHistory.businessId | Business.id | 1 | 0..* | Restrict |
| OwnershipHistory.ownerId | BusinessOwnerProfile.id | 1 | 0..* | Restrict |
| OwnershipHistory.transferId | OwnershipTransfer.id | 0..1 | 0..* | Restrict |
| LegalEntityVersion.businessId | Business.id | 1 | 0..* | Restrict |
| LegalEntityVersion.createdBy | User.id | 1 | 0..* | Restrict |
| PayoutAccountVersion.businessId | Business.id | 1 | 0..* | Restrict |
| PayoutAccountVersion.createdBy | User.id | 1 | 0..* | Restrict |
| CustomerSavedService.customerId | CustomerProfile.id | 1 | 0..* | Restrict |
| CustomerSavedService.branchServiceOfferingId | BranchServiceOffering.id | 1 | 0..* | Restrict |
| VoucherBranchScope.voucherId | Voucher.id | 1 | 0..* | Restrict |
| VoucherBranchScope.branchId | Branch.id | 1 | 0..* | Restrict |
| VoucherServiceScope.voucherId | Voucher.id | 1 | 0..* | Restrict |
| VoucherServiceScope.serviceId | BranchServiceOffering.id | 1 | 0..* | Restrict |
| VoucherComboScope.voucherId | Voucher.id | 1 | 0..* | Restrict |
| VoucherComboScope.comboId | Combo.id | 1 | 0..* | Restrict |
| CustomerBusinessSegment.businessId | Business.id | 1 | 0..* | Restrict |
| CustomerBusinessSegment.customerId | CustomerProfile.id | 1 | 0..* | Restrict |
| CustomerBusinessSegment.assignedBy | User.id | 0..1 | 0..* | Restrict |
| MarketingPreference.customerId | CustomerProfile.id | 1 | 0..1 | Cascade |
| PrivacyExportPackage.customerId | CustomerProfile.id | 1 | 0..* | Restrict |
| PrivacyExportPackage.requestId | DataSubjectRequest.id | 1 | 0..1 | Restrict |
