# Lớp phân tích và ánh xạ thiết kế

Các lớp BCE là khái niệm/trách nhiệm phân tích. Dependency nét đứt biểu diễn sử dụng; không suy composition từ dữ liệu. Lớp entity có trạng thái và hành vi khái niệm, không phải bản sao bảng.

## AC-booking — Đặt lịch

- SUC: SUC-05, SUC-06, SUC-07, SUC-13.
- Boundary: KenhTiepNhan tiếp nhận/trả thông tin qua web/mobile đã có.
- Control: DieuPhoiDatLich điều phối điều kiện và quyết định.
- Entity: LichHen, PhanDichVu, NangLucPhucVu giữ ý nghĩa nghiệp vụ.
- Thiết kế: [BookingsController](../../../src/bookings/bookings.controller.ts), [BookingsService](../../../src/bookings/bookings.service.ts), [PricingEngineService](../../../src/promotions/pricing-engine.service.ts).
- Mô hình dữ liệu: Booking, BookingService, StaffService.

## AC-change — Thay đổi cam kết

- SUC: SUC-08, SUC-09, SUC-10, SUC-15, SUC-16.
- Boundary: KenhYeuCau tiếp nhận/trả thông tin qua web/mobile đã có.
- Control: XuLyThayDoi điều phối điều kiện và quyết định.
- Entity: YeuCauThayDoi, LichHen, LichSuViPham giữ ý nghĩa nghiệp vụ.
- Thiết kế: [ChangeRequestsService](../../../src/bookings/change-requests.service.ts), [BookingsService](../../../src/bookings/bookings.service.ts).
- Mô hình dữ liệu: AppointmentChangeRequest, BookingViolationEvent, CustomerBookingPolicy.

## AC-delivery — Thực hiện tại cơ sở

- SUC: SUC-14, SUC-16, SUC-17, SUC-33.
- Boundary: BangDieuPhoi tiếp nhận/trả thông tin qua web/mobile đã có.
- Control: DieuPhoiThucHien điều phối điều kiện và quyết định.
- Entity: PhanDichVu, ChuyenVien, HoSoTacDong giữ ý nghĩa nghiệp vụ.
- Thiết kế: [BookingItemsService](../../../src/bookings/booking-items.service.ts), [BookingsService](../../../src/bookings/bookings.service.ts), [ImpactService](../../../src/operations/impact.service.ts).
- Mô hình dữ liệu: BookingService, StaffProfile, OperationalImpactCase.

## AC-finance — Khoản thu và hoàn trả

- SUC: SUC-18, SUC-19, SUC-20, SUC-21, SUC-36.
- Boundary: KenhQuyetToan tiếp nhận/trả thông tin qua web/mobile đã có.
- Control: KiemSoatSoDu điều phối điều kiện và quyết định.
- Entity: KhoanThu, YeuCauHoan, QuyenDungBuoi giữ ý nghĩa nghiệp vụ.
- Thiết kế: [PaymentsService](../../../src/payments/payments.service.ts), [FinancialMetricsService](../../../src/payments/financial-metrics.service.ts).
- Mô hình dữ liệu: Payment, RefundRequest, PackageSessionEntitlement.

## AC-onboarding — Thẩm định cơ sở

- SUC: SUC-22, SUC-23, SUC-24, SUC-40.
- Boundary: KenhHoSo tiếp nhận/trả thông tin qua web/mobile đã có.
- Control: ThamDinhCoSo điều phối điều kiện và quyết định.
- Entity: HoSoDoanhNghiep, ChiNhanh, BangChungPhapLy giữ ý nghĩa nghiệp vụ.
- Thiết kế: [BusinessOnboardingService](../../../src/business/business-onboarding.service.ts), [BranchesService](../../../src/branches/branches.service.ts), [MediaService](../../../src/media/media.service.ts).
- Mô hình dữ liệu: Business, Branch, BusinessDocument.

## AC-capacity — Danh mục và năng lực

- SUC: SUC-25, SUC-26, SUC-27, SUC-38.
- Boundary: KenhQuanLyCoSo tiếp nhận/trả thông tin qua web/mobile đã có.
- Control: QuanLyNangLuc điều phối điều kiện và quyết định.
- Entity: DichVuCungCap, ChuyenVien, GoiDichVu giữ ý nghĩa nghiệp vụ.
- Thiết kế: [ServicesService](../../../src/services/services.service.ts), [StaffService](../../../src/staff/staff.service.ts), [StaffInvitationsService](../../../src/staff/staff-invitations.service.ts), [CombosService](../../../src/combos/combos.service.ts).
- Mô hình dữ liệu: BusinessService, BranchServiceOffering, StaffProfile, Combo.

## AC-relations — Quan hệ khách hàng

- SUC: SUC-01, SUC-12, SUC-28, SUC-29, SUC-30, SUC-31.
- Boundary: KenhTuongTac tiếp nhận/trả thông tin qua web/mobile đã có.
- Control: ChamSocKhach điều phối điều kiện và quyết định.
- Entity: DanhGia, UuDai, DichVuQuanTam giữ ý nghĩa nghiệp vụ.
- Thiết kế: [ReviewsService](../../../src/reviews/reviews.service.ts), [PromotionsService](../../../src/promotions/promotions.service.ts), [VouchersAdminService](../../../src/promotions/vouchers-admin.service.ts), [SavedServicesService](../../../src/saved-services/saved-services.service.ts), [NotificationsService](../../../src/notifications/notifications.service.ts).
- Mô hình dữ liệu: Review, Voucher, CustomerSavedService, Notification.

## AC-governance — Quản trị và chuyển giao

- SUC: SUC-34, SUC-35, SUC-37, SUC-39.
- Boundary: KenhQuanTri tiếp nhận/trả thông tin qua web/mobile đã có.
- Control: KiemSoatTrachNhiem điều phối điều kiện và quyết định.
- Entity: HoSoChuyenChu, QuyetDinhQuanTri, DauVet giữ ý nghĩa nghiệp vụ.
- Thiết kế: [OwnershipService](../../../src/ownership/ownership.service.ts), [UsersService](../../../src/users/users.service.ts), [TrustSnapshotService](../../../src/admin/trust-snapshot.service.ts).
- Mô hình dữ liệu: OwnershipTransfer, TrustAction, AuditLog.

## AC-identity — Tài khoản và dữ liệu

- SUC: SUC-02, SUC-03, SUC-04, SUC-32.
- Boundary: KenhTaiKhoan tiếp nhận/trả thông tin qua web/mobile đã có.
- Control: BaoVeDanhTinh điều phối điều kiện và quyết định.
- Entity: TaiKhoan, PhienTruyCap, YeuCauDuLieu giữ ý nghĩa nghiệp vụ.
- Thiết kế: [AuthService](../../../src/auth/auth.service.ts), [UsersService](../../../src/users/users.service.ts), [PrivacyCenterService](../../../src/privacy/privacy-center.service.ts).
- Mô hình dữ liệu: User, UserSession, DataSubjectRequest.

## AC-recurring — Lịch định kỳ

- SUC: SUC-11.
- Boundary: KenhLichDinhKy tiếp nhận/trả thông tin qua web/mobile đã có.
- Control: SapXepChuoi điều phối điều kiện và quyết định.
- Entity: ChuoiLich, KyHen, NangLucPhucVu giữ ý nghĩa nghiệp vụ.
- Thiết kế: [RecurringService](../../../src/recurring/recurring.service.ts), [BookingsService](../../../src/bookings/bookings.service.ts).
- Mô hình dữ liệu: RecurringBookingPlan, Booking, StaffService.

