# Current Project Status

Cập nhật: 16/07/2026

## Website cơ sở làm đẹp

- Một Salon Portal dùng chung nhưng shell, navigation, wording, action và dữ liệu được phân theo `BUSINESS_OWNER`, `BRANCH_MANAGER`, `RECEPTIONIST`, `STAFF`.
- Quản lý dịch vụ cấp doanh nghiệp/chi nhánh, coverage, nhân sự, lịch làm, lịch hẹn, hàng chờ, thanh toán, promotion, review, báo cáo và booking settings.
- Staff chỉ xem/thao tác booking được assign; Receptionist tập trung vận hành quầy; Manager bị giới hạn branch; Owner xem toàn business.
- Deactivate nhân viên giữ hồ sơ/lịch sử. Archive dịch vụ bị chặn khi còn booking tương lai.

## Admin hệ thống

- Admin Portal vẫn là một portal duy nhất.
- Landing/navigation theo `PLATFORM_ADMIN`, `COMPLIANCE`, `SUPPORT`, `MARKETING`, `FINANCE`.
- Quản trị cơ sở, users/role scope, appointments, payments/refunds, promotion, compliance, violations, reviews, reports và settings theo permission.
- Appointments hỗ trợ lọc ngày, trạng thái, nhóm/dịch vụ, business/branch, customer, staff và nguồn đặt.
- Salons hỗ trợ lọc theo nhóm dịch vụ và dùng enum backend cho trạng thái.

## Customer web / Public

- Discovery theo tên cơ sở, tên/nhóm dịch vụ, khu vực, khoảng giá; sắp xếp theo rating, lượt đặt hoặc giá.
- Trang chi tiết cơ sở, dịch vụ và nhân viên dùng dữ liệu API thật; section media có empty state khi chưa có ảnh.
- Booking wizard, slot availability, voucher, PENDING/CONFIRMED success copy và trang lịch hẹn khách hàng.
- Review sau COMPLETED gồm rating tổng quan và rating riêng từng booking service/nhân viên.

## Backend API

- NestJS + Prisma + PostgreSQL + Redis, RBAC/permission/scope, audit log và session revocation.
- Booking lifecycle, pending expiry, scheduler, change request, payment/refund, promotion/voucher, review moderation và reports.
- Public APIs chỉ trả branch/service/staff đang active.
- Docker Compose giữ PostgreSQL/Redis bằng named volume.

