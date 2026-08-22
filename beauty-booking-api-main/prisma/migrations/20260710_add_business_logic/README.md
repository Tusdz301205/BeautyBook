# Migration nghiệp vụ BeautyBook (2026-07-10)

Bộ schema mới thêm vào `prisma/schema.prisma` đã có migration SQL an toàn tại:
`prisma/migrations/20260710_add_business_logic/migration.sql`.

## Cách apply (Windows)

Mở terminal tại thư mục `beauty-booking-api-main/beauty-booking-api-main` rồi chạy 1 trong 2 cách:

### Cách 1 — Tự động (khuyến nghị)

```powershell
cd C:\Users\Admin\Downloads\beauty-booking-api-main\beauty-booking-api-main
npm install
node scripts\apply-business-logic-migration.js
npx prisma generate
```

Nếu muốn nhanh hơn, chạy file .bat đã chuẩn bị:

```powershell
cd C:\Users\Admin\Downloads\beauty-booking-api-main\beauty-booking-api-main
scripts\apply-business-logic-migration.bat
```

### Cách 2 — Qua Prisma migrate resolve (nếu script trên lỗi)

```powershell
# Sau khi apply xong SQL, dán lệnh này để Prisma tin rằng migration đã áp dụng
npx prisma migrate resolve --applied 20260710_add_business_logic
npx prisma generate
```

## Migration này thêm gì?

### Enums mới
- `SalonMemberRole` — OWNER / MANAGER / RECEPTIONIST
- `CancelledByType` — CUSTOMER / SALON / ADMIN / SYSTEM
- `ChangeRequestType` — RESCHEDULE / STAFF_CHANGE / CANCEL
- `ChangeRequestStatus` — PENDING / APPROVED / REJECTED / EXPIRED
- `VoucherStatus` — ACTIVE / USED / EXPIRED / REVOKED

### Bảng mới
- **salon_members** — multi-tenancy (account nào thuộc salon nào)
- **cancellation_policies** — cấu hình chính sách cấp salon (free_cancel_hours, late_cancel_fee_percent, no_show_fee_percent, reschedule_allowed_hours)
- **vouchers** — quản lý voucher
- **customer_vouchers** — voucher khách đã sở hữu
- **appointment_change_requests** — yêu cầu đổi lịch (qua luồng duyệt)
- **salon_trust_snapshots** — điểm uy tín salon (cho Admin dashboard)

### Cột thêm vào bảng cũ
- `bookings.cancelledByType`, `cancellationFeeAmount`, `finalAmount`, `voucherId`, `voucherDiscountAmount`
- `audit_logs.reason` — lý do can thiệp Admin

## Sau khi migration xong

Khởi động lại cả 2 project:

```powershell
# Backend
cd C:\Users\Admin\Downloads\beauty-booking-api-main\beauty-booking-api-main
npm run start:dev

# Frontend (terminal khác)
cd C:\Users\Admin\Downloads\beauty-booking-web-main\beauty-booking-web-main
npm run dev
```

## Module nghiệp vụ mới (đã build)

| Module | Endpoint chính | Mô tả |
|--------|-----------------|--------|
| Bookings | `/api/bookings/*` | Transaction Serializable chống double-book; policy cấp salon; snapshot giá |
| ChangeRequests | `/api/bookings/:id/change-requests` | Khách gửi → Salon duyệt → không update trực tiếp booking |
| Vouchers | `/api/bookings/preview-price` | Preview giá + áp voucher (verify ownership) |
| SalonMembers | `/api/business/:id/members` | Multi-tenancy cứng theo salon_members |
| CancellationPolicies | `/api/business/:id/cancellation-policy` | Cấu hình policy cấp salon (audit khi sửa) |
| TrustSnapshot | `/api/admin/trust-snapshots` | Cron daily 02:00 rebuild trust score |

## Vai trò theo nghiệp vụ URD

| Tính năng | Customer | Salon Owner | Admin |
|-----------|----------|-------------|-------|
| Xem lịch trống & đặt lịch | ✅ | ❌ | ❌ |
| Xác nhận / từ chối lịch | ❌ | ✅ Full | ⚠️ Chỉ khi escalation |
| Hủy lịch | ✅ Theo policy | ✅ Có lý do | ⚠️ Ép buộc, có audit |
| Đổi lịch | ✅ Gửi yêu cầu | ✅ Duyệt/từ chối | ⚠️ Khi salon không xử lý |
| Trust score | ❌ | ❌ | ✅ Dashboard cảnh báo |
