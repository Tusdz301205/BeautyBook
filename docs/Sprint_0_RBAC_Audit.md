# Sprint 0 — RBAC audit

Ngày audit: 2026-07-12

## Phạm vi

- Backend: `beauty-booking-api-main/`
- Frontend: `beauty-booking-web-main/beauty-booking-web-main/`
- Nguồn permission duy nhất: `src/common/permissions/permission-catalog.ts`

## Baseline

| Hạng mục | Trước sửa | Sau batch 1 |
|---|---:|---:|
| Permission trong catalog | 67 | 73 |
| Unknown permission được controller sử dụng | 18 | 0 |
| Backend tests | Nhiều suite lỗi/không compile | 68/68 pass |
| Backend build | Pass | Pass |
| Frontend permission matrix viết tay | Có | Đã xóa |
| Frontend production build | Chưa xác nhận | Pass |

## P0 đã xử lý

- Đồng bộ permission của branch approval, audit, check-in, change request,
  refund, consent và report với catalog.
- Cho phép Customer đi qua guard khi tạo booking bằng
  `booking:create:self`; ownership vẫn được kiểm tra ở service.
- Sửa policy guard để phân biệt kiểm tra permission thô và kiểm tra scope
  trên resource đã tải.
- Sửa `ScopeGuard` cho metadata `RequireScope` kiểu cũ và từ chối scope hết hạn.
- Tách quyền refund của SUPPORT khỏi quyền force-cancel.
- Siết `assertBranchAccess` để branch-scoped role không truy cập branch khác
  trong cùng tenant.
- Ngăn mọi platform role tự động đọc health record; chỉ role có permission
  health-record tương ứng mới được đọc.
- Backend trả `user.permissions`; frontend sử dụng danh sách này thay cho
  `CLIENT_ROLE_PERMISSIONS` tự viết tay.
- Thêm test contract tự động fail nếu controller dùng permission ngoài catalog.
- Tạm giới hạn các report query chưa có tenant filter ở platform scope để
  tránh rò rỉ dữ liệu chéo tenant.

## Việc tiếp theo

1. Lập inventory đầy đủ method/route/role/permission/scope/frontend usage.
2. Viết report query có `businessId`/`branchId` filter rồi mở lại cho
   BUSINESS_OWNER và BRANCH_MANAGER.
3. Kiểm tra state transition booking theo actor, đặc biệt endpoint status.
4. Hoàn thiện role-assignment API và test cross-tenant.
5. Bổ sung health-record create flow cho STAFF sau consent.

