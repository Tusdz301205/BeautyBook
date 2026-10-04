# Quy ước lớp thiết kế

Trích TypeScript AST từ working tree. Tên lớp, constructor dependencies, visibility, tham số và kiểu explicit được lưu đầy đủ tại source-inventory.json. Hình chỉ chọn tối đa ba operation public mỗi lớp. Dấu ... là lược chữ ký dài, không phải kiểu được định nghĩa trong code. Kiểu tham số/return bị lược nếu code để TypeScript suy luận; generic giữ tên type parameter, ràng buộc đầy đủ trong inventory; không tự bịa kiểu trả về. Dependency DI không hàm ý quản lý vòng đời. PrismaService kế thừa PrismaClient của thư viện; hình chỉ giữ lớp dự án và liên kết thư viện được nêu tại đây. BookingService là model Prisma; BookingsService là lớp ứng dụng. React pages là function/component, chỉ được truy vết ở đặc tả, không giả làm class.

## DC-overview — Phối hợp nghiệp vụ

- [BookingsService](../../../src/bookings/bookings.service.ts), dòng 80; không khai báo kế thừa/realization.
- [PricingEngineService](../../../src/promotions/pricing-engine.service.ts), dòng 24; không khai báo kế thừa/realization.
- [PaymentsService](../../../src/payments/payments.service.ts), dòng 40; không khai báo kế thừa/realization.
- [SchedulerGateway](../../../src/scheduler/scheduler.gateway.ts), dòng 148; implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-auth — Xác thực và phiên

- [AuthController](../../../src/auth/auth.controller.ts), dòng 31; không khai báo kế thừa/realization.
- [AuthService](../../../src/auth/auth.service.ts), dòng 23; không khai báo kế thừa/realization.
- [TokenBlacklistService](../../../src/auth/token-blacklist.service.ts), dòng 18; implements OnModuleDestroy.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-access — Kiểm tra quyền lịch

- [BookingsController](../../../src/bookings/bookings.controller.ts), dòng 64; không khai báo kế thừa/realization.
- [BookingsAccessService](../../../src/bookings/bookings-access.service.ts), dòng 37; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-booking — Tạo và điều phối lịch

- [BookingsController](../../../src/bookings/bookings.controller.ts), dòng 64; không khai báo kế thừa/realization.
- [BookingsService](../../../src/bookings/bookings.service.ts), dòng 80; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-change — Yêu cầu thay đổi

- [ChangeRequestsService](../../../src/bookings/change-requests.service.ts), dòng 28; không khai báo kế thừa/realization.
- [BookingsService](../../../src/bookings/bookings.service.ts), dòng 80; không khai báo kế thừa/realization.
- [PlatformSettingsService](../../../src/platform-settings/platform-settings.service.ts), dòng 65; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-items — Tiến độ dịch vụ

- [BookingItemsService](../../../src/bookings/booking-items.service.ts), dòng 11; không khai báo kế thừa/realization.
- [BookingsService](../../../src/bookings/bookings.service.ts), dòng 80; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-recurring — Chuỗi lịch

- [RecurringController](../../../src/recurring/recurring.controller.ts), dòng 11; không khai báo kế thừa/realization.
- [RecurringService](../../../src/recurring/recurring.service.ts), dòng 9; không khai báo kế thừa/realization.
- [BookingsService](../../../src/bookings/bookings.service.ts), dòng 80; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-payment — Thu và hoàn tiền

- [PaymentsController](../../../src/payments/payments.controller.ts), dòng 25; không khai báo kế thừa/realization.
- [PaymentsService](../../../src/payments/payments.service.ts), dòng 40; không khai báo kế thừa/realization.
- [PaymentProviderRegistry](../../../src/payments/providers/payment-provider.registry.ts), dòng 7; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-providers — Hợp đồng adapter thanh toán

- [PaymentProvider](../../../src/payments/providers/payment-provider.port.ts), dòng 9; không khai báo kế thừa/realization.
- [CashPaymentAdapter](../../../src/payments/providers/cash.adapter.ts), dòng 3; implements PaymentProvider.
- [ManualBankTransferAdapter](../../../src/payments/providers/manual-bank.adapter.ts), dòng 3; implements PaymentProvider.
- [PaymentProviderRegistry](../../../src/payments/providers/payment-provider.registry.ts), dòng 7; không khai báo kế thừa/realization.

## DC-business — Hồ sơ doanh nghiệp

- [BusinessController](../../../src/business/business.controller.ts), dòng 17; không khai báo kế thừa/realization.
- [BusinessOnboardingService](../../../src/business/business-onboarding.service.ts), dòng 92; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-branch — Chi nhánh và trạng thái

- [BranchesController](../../../src/branches/branches.controller.ts), dòng 46; không khai báo kế thừa/realization.
- [BranchesService](../../../src/branches/branches.service.ts), dòng 35; không khai báo kế thừa/realization.
- [BranchStateService](../../../src/branches/branch-state.service.ts), dòng 10; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-catalog — Catalog và combo

- [ServicesController](../../../src/services/services.controller.ts), dòng 45; không khai báo kế thừa/realization.
- [ServicesService](../../../src/services/services.service.ts), dòng 15; không khai báo kế thừa/realization.
- [CombosService](../../../src/combos/combos.service.ts), dòng 16; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-staff — Nhân sự và lời mời

- [StaffController](../../../src/staff/staff.controller.ts), dòng 40; không khai báo kế thừa/realization.
- [StaffService](../../../src/staff/staff.service.ts), dòng 19; không khai báo kế thừa/realization.
- [StaffInvitationsService](../../../src/staff/staff-invitations.service.ts), dòng 24; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-marketing — Ưu đãi và định giá

- [PromotionsService](../../../src/promotions/promotions.service.ts), dòng 14; không khai báo kế thừa/realization.
- [VouchersAdminService](../../../src/promotions/vouchers-admin.service.ts), dòng 8; không khai báo kế thừa/realization.
- [PricingEngineService](../../../src/promotions/pricing-engine.service.ts), dòng 24; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-review — Đánh giá và kiểm duyệt

- [ReviewsController](../../../src/reviews/reviews.controller.ts), dòng 28; không khai báo kế thừa/realization.
- [ReviewsService](../../../src/reviews/reviews.service.ts), dòng 36; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-privacy — Quyền dữ liệu

- [PrivacyController](../../../src/privacy/privacy.controller.ts), dòng 19; không khai báo kế thừa/realization.
- [PrivacyCenterService](../../../src/privacy/privacy-center.service.ts), dòng 22; không khai báo kế thừa/realization.
- [SensitiveDataCipherService](../../../src/privacy/sensitive-data-cipher.service.ts), dòng 20; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-ownership — Chuyển giao trách nhiệm

- [OwnershipController](../../../src/ownership/ownership.controller.ts), dòng 10; không khai báo kế thừa/realization.
- [OwnershipService](../../../src/ownership/ownership.service.ts), dòng 9; không khai báo kế thừa/realization.
- [SensitiveDataCipherService](../../../src/privacy/sensitive-data-cipher.service.ts), dòng 20; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-impact — Tác động vận hành

- [ImpactController](../../../src/operations/impact.controller.ts), dòng 10; không khai báo kế thừa/realization.
- [ImpactService](../../../src/operations/impact.service.ts), dòng 13; không khai báo kế thừa/realization.
- [BookingsService](../../../src/bookings/bookings.service.ts), dòng 80; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-governance — Quản trị và báo cáo

- [AdminController](../../../src/admin/admin.controller.ts), dòng 21; không khai báo kế thừa/realization.
- [TrustSnapshotService](../../../src/admin/trust-snapshot.service.ts), dòng 31; không khai báo kế thừa/realization.
- [ReportsService](../../../src/reports/reports.service.ts), dòng 17; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-self — Hồ sơ và dịch vụ đã lưu

- [UsersService](../../../src/users/users.service.ts), dòng 35; không khai báo kế thừa/realization.
- [SavedServicesService](../../../src/saved-services/saved-services.service.ts), dòng 6; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

## DC-communication — Thông báo và media

- [NotificationsService](../../../src/notifications/notifications.service.ts), dòng 5; không khai báo kế thừa/realization.
- [MediaService](../../../src/media/media.service.ts), dòng 28; không khai báo kế thừa/realization.
- [PrismaService](../../../src/prisma/prisma.service.ts), dòng 13; extends PrismaClient; implements OnModuleInit, OnModuleDestroy.

