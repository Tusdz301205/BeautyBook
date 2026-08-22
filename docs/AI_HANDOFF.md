# BeautyBook — AI Handoff Context

> **Mục đích:** gửi nguyên file này cho AI/agent khác trước khi giao việc. File mô tả bối cảnh sản phẩm, cấu trúc code, quy tắc nghiệp vụ và các ràng buộc cần giữ nguyên.

## 1. Sản phẩm là gì?

BeautyBook là marketplace đặt lịch dịch vụ làm đẹp. Một hệ thống phục vụ đồng thời:

1. **Guest/Customer** tìm salon, xem dịch vụ/nhân sự, đặt lịch, thanh toán, đánh giá và quản lý dữ liệu cá nhân.
2. **Salon/Business** vận hành nhiều chi nhánh: dịch vụ, nhân sự, ca làm, lịch hẹn, chấm công, doanh thu, khuyến mãi và thanh toán.
3. **Platform** quản lý người dùng, tuân thủ, tài chính/hoàn tiền, chiến dịch, báo cáo, audit và Trust & Safety.

Ngôn ngữ hiển thị chính là **tiếng Việt**. Thời gian vận hành mặc định dùng `Asia/Ho_Chi_Minh`.

## 2. Cấu trúc repository

```text
beauty-booking-api-main/                    # Root Docker Compose
├── beauty-booking-api-main/                # Backend NestJS + Prisma
│   ├── src/                                 # Modules, guards, services, controllers
│   ├── prisma/schema.prisma                 # Source of truth cho data model
│   ├── prisma/migrations/                   # Migration phải được giữ lịch sử
│   └── prisma/seed.ts                       # Seed local/demo
├── beauty-booking-web-main/
│   └── beauty-booking-web-main/             # Frontend React + Vite
│       └── src/pages/                       # Public, Customer, Salon, Admin workspaces
├── docs/                                    # Tài liệu, gồm file handoff này
├── skills/                                  # Bộ skill tham khảo; không phải runtime app
├── tools/                                   # Công cụ phụ trợ; không phải runtime app
└── docker-compose.yml                       # Web + API + PostgreSQL + Redis
```

Không nhầm `skills/` hoặc `tools/` với mã nguồn chạy của BeautyBook.

## 3. Kiến trúc kỹ thuật

| Lớp | Công nghệ | Ghi chú |
| --- | --- | --- |
| Frontend | React 18, Vite, React Router, Zustand, Tailwind, Recharts | SPA theo role, gọi `/api/v1` |
| Backend | NestJS 11, TypeScript | REST API, Socket.IO, guards/interceptors toàn cục |
| ORM/database | Prisma 7 + PostgreSQL 16 | Schema và migration trong backend |
| Cache/coordination | Redis 7 | Idempotency, cache/realtime support |
| Runtime local | Docker Compose + Nginx | Web public tại port `8080` |

API prefix chuẩn: `/api/v1`.

## 4. Cách chạy và kiểm tra

Tại root:

```powershell
docker compose up -d
```

- Web: `http://localhost:8080`
- API health: `http://localhost:8080/api/v1/health`
- Xem container: `docker compose ps`
- Dừng nhưng giữ dữ liệu: `docker compose down`

**Không dùng `docker compose down -v`** nếu muốn giữ PostgreSQL/Redis local.

Kiểm tra code:

```powershell
cd beauty-booking-api-main
npm.cmd run build
npm.cmd test -- --runInBand

cd ..\beauty-booking-web-main\beauty-booking-web-main
npm.cmd run build
```

## 5. Vai trò và RBAC

Quyền có scope theo thứ tự: `PLATFORM → TENANT (business) → BRANCH → SELF → PUBLIC`.

Các role:

| Nhóm | Role | Phạm vi chính |
| --- | --- | --- |
| Public | `GUEST` | Xem dữ liệu public, bắt đầu booking |
| Customer | `CUSTOMER` | Chỉ tài nguyên do chính mình sở hữu |
| Salon | `STAFF` | Booking/lịch làm việc được phân công |
| Salon | `RECEPTIONIST` | Quầy: booking, check-in, thu tiền tại branch |
| Salon | `BRANCH_MANAGER` | Vận hành một branch |
| Salon | `BUSINESS_OWNER` | Toàn bộ business/tenant và các branch của mình |
| Platform | `SUPPORT` | Hỗ trợ theo permission, không tự mở rộng quyền |
| Platform | `COMPLIANCE` | Duyệt hồ sơ, tuân thủ |
| Platform | `MARKETING` | Campaign/voucher platform |
| Platform | `FINANCE` | Tài chính, refund approval/processing |
| Platform | `PLATFORM_ADMIN` | Quản trị nền tảng, Trust & Safety, cấu hình |

Nguồn sự thật permission: `beauty-booking-api-main/src/common/permissions/permission-catalog.ts`.

**Quy tắc bắt buộc:** kiểm tra quyền ở route là chưa đủ; service phải xác thực lại `businessId`, `branchId`, ownership và scope. Không tin ID do client gửi cho customer-owned resource.

## 6. Luồng nghiệp vụ cốt lõi

### 6.1 Booking

Luồng chuẩn:

```text
Khám phá → chọn branch/service/staff/slot → PENDING hoặc CONFIRMED
→ CHECKED_IN → IN_PROGRESS → COMPLETED
```

Nhánh khác: `CANCELLED`, `NO_SHOW`; có thể có reschedule/change request theo policy.

Điều kiện quan trọng:

- Slot phải còn trống, staff phải đủ availability và coverage dịch vụ.
- Không được tạo trùng lịch/staff conflict.
- Voucher, giá, duration, policy phải được snapshot vào booking lúc tạo; không đọc lại catalog hiện tại để làm đổi lịch sử.
- Booking/payment write nhạy cảm phải idempotent và transaction-safe.
- Chỉ booking hoàn thành mới đủ điều kiện đánh giá; nghiệp vụ payment/commission có điều kiện riêng.

### 6.2 Salon operations và workforce

- Business có nhiều branch; branch có giờ làm, holiday, booking policy, attendance policy và staff assignment.
- Staff schedule/availability khác với attendance thực tế.
- Attendance tạo timesheet; chỉ timesheet đã duyệt mới được đưa vào compensation/pay run.
- Compensation có rule, assignment theo staff/branch/role, snapshot tính toán và adjustment khi refund.
- Pay run phải khóa dữ liệu sau khi finalize; không sửa ngược entry lịch sử đã lock.

### 6.3 Payment, refund và ledger

- Tách bạch `PaymentPolicy`, `PaymentIntent`, `PaymentTransaction`, `RefundRequest`, `PaymentLedger`, phí nền tảng và package purchase.
- Customer chỉ có thể tạo phương thức tự thanh toán được hỗ trợ (ví dụ chuyển khoản chờ xác minh); cash là thao tác tại quầy bởi nhân sự có quyền.
- Không giả lập thành công gateway. MoMo/VNPay/ZaloPay/thẻ nếu chưa có gateway + callback + signature verification phải trả lỗi rõ ràng.
- Refund có reserved amount, trạng thái, audit trail và phân tách người tạo/duyệt/xử lý khi policy yêu cầu.
- Mọi số tiền/lịch sử phải đọc từ transaction/ledger snapshot, không suy đoán từ booking status.

### 6.4 Promotion, voucher, review

- Promotion/voucher có quota, điều kiện hiệu lực và kiểm tra transaction-safe.
- Review chỉ cho booking phù hợp; có moderation/response theo branch, tenant hoặc platform permission.

### 6.5 Privacy và dữ liệu nhạy cảm

- Dữ liệu sức khỏe/consultation cần consent theo loại dữ liệu.
- Khi consent bị thu hồi, không trả lại payload nhạy cảm theo luồng thông thường.
- Truy cập nhạy cảm cần audit; export dữ liệu có token, expiry và encrypted payload.
- Không đưa `passwordHash`, token, secret hoặc sensitive answer vào response public/log/frontend state.

### 6.6 Trust & Safety

Màn hình Admin “Rủi ro & vi phạm” dùng dữ liệu vận hành 90 ngày để tính trust snapshot cho business.

- Các chỉ báo gồm cancellation bởi cơ sở, hủy trễ, thời gian xác nhận và các policy signal khác.
- Customer no-show chỉ theo dõi/phân tích, không tự động phạt cơ sở.
- `Tạo snapshot ngay` là tái tính/lưu snapshot tại thời điểm hiện tại; không phải hành động phạt.
- `DANGER`, `WARN`, `WATCH/Đang theo dõi`, `OK` là trạng thái vận hành để Platform Admin xử lý có audit.

## 7. Mô hình dữ liệu quan trọng

Không cần học hết schema trước khi sửa; đọc relation liên quan trong `prisma/schema.prisma`.

| Domain | Model/khái niệm chính |
| --- | --- |
| Identity | `User`, role, permission, scope, session, customer profile |
| Business | `Business`, `Branch`, branch settings, onboarding/documents/review |
| Catalog | business service, category, combo, staff/service coverage, media |
| Booking | `Booking`, `BookingService`, status history, contact, change request, recurring booking |
| Workforce | schedule/availability, `StaffAttendance`, `Timesheet`, compensation rule/entry, `PayRun` |
| Finance | payment policy/snapshot, intent, transaction, ledger, refund, package purchase/installment/entitlement |
| Growth | promotion, voucher, customer voucher, notification, review/rating |
| Governance | audit log, platform setting, trust snapshot/action, privacy consent/export/request |

## 8. Backend conventions

- Module thường có `*.module.ts`, controller, service, DTO và spec.
- Prisma client đi qua `PrismaService`.
- Global guards: JWT, throttling, role, scope và policy.
- Global interceptors: audit và Redis-backed idempotency.
- Dùng DTO/class-validator ở API boundary.
- Ghi audit cho thay đổi nhạy cảm; dùng error HTTP rõ ràng (`Forbidden`, `Conflict`, `BadRequest`, `NotFound`).
- Không dùng `prisma db push` cho dữ liệu cần bảo toàn. Thay đổi schema phải có migration mới, có kiểm thử migration và không reset database.

## 9. Frontend conventions

- Route/page theo khu vực: Public, Customer, Salon, Admin.
- UI phải dựa vào API thật; không hard-code dashboard data hoặc tạo nút không có handler.
- Luôn xử lý loading, empty, error, permission-denied và responsive mobile/tablet/desktop.
- Calendar/scheduler là giao diện chính của lịch hẹn vận hành; không thay toàn bộ bằng danh sách tĩnh.
- Frontend chỉ ẩn UI theo permission để cải thiện UX; backend vẫn là lớp bảo vệ bắt buộc.

## 10. Tài khoản demo local

Mật khẩu chung: `Password123!`

| Role | Email |
| --- | --- |
| Platform Admin | `admin@glowbook.vn` |
| Business Owner | `lananh.owner@glowbook.vn` |
| Branch Manager | `manager@glowbook.vn` |
| Receptionist | `reception@glowbook.vn` |
| Staff | `staff@glowbook.vn` |
| Customer | `khach0001@glowbook.vn` |

Chỉ sử dụng các credential này ở local/demo.

## 11. Những điều AI không được tự ý làm

1. Không reset/xóa database, không chạy seed lớn trên dữ liệu cần giữ.
2. Không đổi route/API/auth/RBAC/business logic chỉ để redesign UI.
3. Không bypass scope bằng `businessId`/`branchId` từ request body.
4. Không dùng fake success cho gateway thanh toán chưa tích hợp.
5. Không xóa audit/history hoặc sửa record đã locked/finalized để “sửa nhanh”.
6. Không expose password, JWT, refresh token, secret, health data hoặc PII không cần thiết.
7. Không coi việc chỉ build thành công là đã hoàn tất: cần test đúng mức rủi ro và kiểm tra luồng có liên quan.

## 12. Checklist khi giao task cho AI

Trước khi code, AI nên trả lời:

- Task thuộc role nào, page/route nào, module backend nào?
- Data ownership nằm ở platform, business, branch hay customer?
- Trạng thái/lifecycle nào được phép chuyển và actor nào chuyển được?
- Có cần snapshot, audit, idempotency, transaction hoặc migration không?
- API/permission nào đã tồn tại và có thể tái sử dụng?

Trước khi hoàn thành:

- Build backend và frontend.
- Chạy test liên quan; chạy full suite nếu sửa core/RBAC/payment/booking.
- Không reset database; migration phải deploy được trên database có dữ liệu.
- Kiểm tra một luồng UI thật với đúng role nếu task có frontend.

## 13. Nguồn tham chiếu sâu hơn

- Tổng quan ngắn: `docs/PROJECT_SUMMARY.md`
- Trạng thái chức năng: `docs/CURRENT_PROJECT_STATUS.md`
- Permission contract: `beauty-booking-api-main/src/common/permissions/permission-catalog.ts`
- Database contract: `beauty-booking-api-main/prisma/schema.prisma`
- API generated: `beauty-booking-api-main/docs/openapi.generated.json` (nếu đã generate)
- Cấu hình runtime: `docker-compose.yml`

Khi thông tin trong tài liệu và source mâu thuẫn, **ưu tiên schema, permission catalog, migration và code hiện tại**.
