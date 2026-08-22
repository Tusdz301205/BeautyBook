# BeautyBook — Tóm tắt dự án

## Mục tiêu

BeautyBook là nền tảng đặt lịch dịch vụ làm đẹp, kết nối khách hàng với salon/spa và cung cấp hệ thống vận hành cho cơ sở kinh doanh cùng đội ngũ quản trị nền tảng.

Hệ thống hỗ trợ xuyên suốt hành trình: khám phá dịch vụ, đặt lịch, xác nhận, thực hiện, thanh toán, đánh giá và quản lý sau dịch vụ.

## Thành phần kỹ thuật

| Thành phần | Công nghệ | Vai trò |
| --- | --- | --- |
| Frontend | React, Vite, Tailwind CSS, Zustand | Website khách hàng và portal cho từng vai trò |
| Backend | NestJS, TypeScript, Prisma | REST API, nghiệp vụ, RBAC, realtime |
| Database | PostgreSQL 16 | Dữ liệu nghiệp vụ, lịch hẹn, thanh toán, audit |
| Cache/realtime | Redis, Socket.IO | Cache, sự kiện và cập nhật thời gian thực |
| Hạ tầng local | Docker Compose, Nginx | Khởi chạy Web, API, PostgreSQL và Redis |

## Cấu trúc thư mục chính

```text
beauty-booking-api-main/
├── beauty-booking-api-main/                 # Backend NestJS + Prisma
├── beauty-booking-web-main/
│   └── beauty-booking-web-main/             # Frontend React/Vite
├── docs/                                    # Tài liệu dự án
├── skills/                                  # Các bộ skill tham khảo
├── tools/                                   # Công cụ phụ trợ
└── docker-compose.yml                       # Cấu hình chạy local
```

## Nhóm chức năng

- Khách hàng: khám phá cơ sở/dịch vụ, đặt lịch, thanh toán, voucher, lịch hẹn, đánh giá, hồ sơ và quyền riêng tư.
- Cơ sở kinh doanh: quản lý chi nhánh, dịch vụ, combo, nhân sự, lịch làm việc, chấm công, bảng công, thu nhập, lịch hẹn, khuyến mãi và thanh toán.
- Nền tảng: quản lý người dùng, kiểm duyệt cơ sở/đánh giá, báo cáo, chiến dịch, tài chính/hoàn tiền, audit log, tuân thủ và Trust & Safety.
- Nghiệp vụ cốt lõi: lifecycle lịch hẹn, chống trùng lịch, thay đổi/hủy lịch, thanh toán chia đợt, hoàn tiền, ledger, gói liệu trình, consent dữ liệu sức khỏe và audit trail.

## Vai trò và phân quyền

Hệ thống dùng RBAC theo phạm vi `platform → business (tenant) → branch → self` cho 11 vai trò:

- Guest
- Customer
- Staff
- Receptionist
- Branch Manager
- Business Owner
- Support
- Compliance
- Marketing
- Finance
- Platform Admin

Quyền được kiểm tra cả ở route và service; các dữ liệu theo cơ sở/chi nhánh không tin cậy ID do client tự gửi mà được đối chiếu lại với scope của phiên đăng nhập.

## Chạy local bằng Docker

Tại thư mục gốc:

```powershell
docker compose up -d
```

- Web: http://localhost:8080
- API health: http://localhost:8080/api/v1/health
- PostgreSQL và Redis chạy trong Docker, dữ liệu được lưu bằng Docker volumes.

Để dừng:

```powershell
docker compose down
```

Không dùng `docker compose down -v` nếu muốn giữ database local.

## Tài khoản demo local

Mật khẩu chung: `Password123!`

| Vai trò | Email |
| --- | --- |
| Platform Admin | `admin@glowbook.vn` |
| Business Owner | `lananh.owner@glowbook.vn` |
| Branch Manager | `manager@glowbook.vn` |
| Receptionist | `reception@glowbook.vn` |
| Staff | `staff@glowbook.vn` |
| Customer | `khach0001@glowbook.vn` |

Các tài khoản này chỉ dùng cho môi trường local/demo.

## Lưu ý vận hành

- Migration dùng `prisma migrate deploy`; không dùng `db push` cho môi trường cần giữ dữ liệu.
- Seed dữ liệu lớn chỉ dùng cho demo/staging vì có thể xóa dữ liệu cũ.
- Trước production phải thay toàn bộ secret, mật khẩu database và cấu hình CORS/SMTP/TLS.
- Kiểm tra API health sau khi deploy và có backup database trước migration quan trọng.
