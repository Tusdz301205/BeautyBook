# Tài liệu Sơ đồ Kiến trúc Hệ thống BeautyBook (GlowBook)

Tập tài liệu này chứa toàn bộ các sơ đồ PlantUML mô tả hiện trạng kiến trúc và luồng nghiệp vụ thực tế của nền tảng **BeautyBook**, được trích xuất và đối soát trực tiếp từ mã nguồn triển khai (`beauty-booking-api-main` và `beauty-booking-web-main`).

Tất cả sơ đồ tuân thủ nguyên tắc: **Chỉ mô tả những gì đã được hiện thực hóa trong mã nguồn**, không tự tạo hay suy diễn các tính năng chưa có.

---

## Ma trận Truy vết Sơ đồ và Mã nguồn (Traceability Matrix)

| Tên tệp Sơ đồ | Phân loại | Mục đích & Nghiệp vụ mô tả | Bằng chứng Mã nguồn (Code Evidence) |
| :--- | :--- | :--- | :--- |
| [`use-case.puml`](./use-case.puml) | Use Case | Tổng quan ca sử dụng toàn hệ thống phân theo 8 nhóm nghiệp vụ và 7 tác nhân. | `src/common/permissions/permission-catalog.ts`, `src/app.module.ts`, `prisma/schema.prisma` |
| [`use-case-customer.puml`](./use-case-customer.puml) | Use Case | Chi tiết ca sử dụng của Khách hàng thành viên (Customer) và Khách vãng lai (Guest). | `src/bookings/bookings.controller.ts`, `src/reviews/reviews.controller.ts`, `src/privacy/privacy.controller.ts` |
| [`use-case-salon.puml`](./use-case-salon.puml) | Use Case | Chi tiết ca sử dụng của 4 vai trò salon: Chủ salon, Quản lý chi nhánh, Lễ tân, Thợ kỹ thuật. | `src/staff/staff.controller.ts`, `src/branches/branches.controller.ts`, `src/services/services.controller.ts`, `src/payments/payments.controller.ts` |
| [`use-case-admin.puml`](./use-case-admin.puml) | Use Case | Chi tiết ca sử dụng của Quản trị viên Nền tảng (Platform Admin): Thẩm định, kiểm duyệt, kiểm toán. | `src/admin/admin.controller.ts`, `src/platform-settings/platform-settings.controller.ts`, `src/finance/finance.controller.ts` |
| [`sequence-login.puml`](./sequence-login.puml) | Sequence | Luồng xác thực đăng nhập đa workspace, cấp phát JWT Access Token & HttpOnly Refresh Cookie. | `src/auth/auth.controller.ts#L71-L94`, `src/auth/auth.service.ts#L80-L150`, `src/auth/jwt.strategy.ts` |
| [`sequence-create-booking.puml`](./sequence-create-booking.puml) | Sequence | Luồng đặt lịch dịch vụ thành viên, tính giá, kiểm tra slot và giao dịch Serializable chống race condition. | `src/bookings/bookings.controller.ts#L197`, `src/bookings/bookings.service.ts#L735-L1220`, `src/common/utils/serializable-transaction.ts` |
| [`sequence-guest-booking.puml`](./sequence-guest-booking.puml) | Sequence | Luồng đặt lịch công khai cho khách vãng lai không cần đăng nhập qua endpoint `/bookings/guest`. | `src/bookings/bookings.controller.ts#L161-L195`, `src/bookings/dto/bookings.dto.ts#L176-L210` |
| [`sequence-update-booking-status.puml`](./sequence-update-booking-status.puml) | Sequence | Luồng cập nhật trạng thái lịch hẹn: Lễ tân check-in, thợ bắt đầu làm (In-progress) và hoàn tất dịch vụ. | `src/bookings/bookings.controller.ts#L949-L960`, `src/bookings/bookings.controller.ts#L1235`, `src/bookings/bookings.validation.ts#L14-L69` |
| [`sequence-cancel-booking.puml`](./sequence-cancel-booking.puml) | Sequence | Luồng hủy lịch hẹn, áp dụng quy tắc lead time, giải phóng slot nhân sự, hoàn voucher & điểm thưởng. | `src/bookings/bookings.service.ts#L1540-L1620`, `src/bookings/bookings.validation.ts#L117-L126`, `src/loyalty/loyalty.service.ts` |
| [`sequence-salon-onboarding.puml`](./sequence-salon-onboarding.puml) | Sequence | Luồng đăng ký doanh nghiệp, tải lên hồ sơ pháp lý, nộp xét duyệt và admin phê duyệt kích hoạt. | `src/business/business-onboarding.service.ts#L1-L280`, `src/admin/admin.controller.ts#L40-L90`, `src/media/media.controller.ts` |
| [`sequence-submit-review.puml`](./sequence-submit-review.puml) | Sequence | Luồng gửi đánh giá sau khi dịch vụ hoàn thành (COMPLETED), chấm điểm từng thợ và salon phản hồi. | `src/reviews/reviews.controller.ts#L30-L70`, `src/reviews/reviews.service.ts#L277-L360` |
| [`sequence-payment-process.puml`](./sequence-payment-process.puml) | Sequence | Luồng thu tiền tại quầy (tiền mặt / chuyển khoản), xác minh giao dịch và ghi sổ cái tài chính. | `src/payments/payments.controller.ts#L40-L95`, `src/payments/payments.service.ts#L180-L380`, `src/payments/providers/payment-provider.registry.ts` |
| [`activity-booking.puml`](./activity-booking.puml) | Activity | Sơ đồ hoạt động rẽ nhánh nghiệp vụ khi đặt lịch: dịch vụ tương thích, giờ mở cửa, lead time, slot lock. | `src/bookings/bookings.validation.ts`, `src/bookings/bookings.service.ts#L735-L1190` |
| [`activity-cancel-booking.puml`](./activity-cancel-booking.puml) | Activity | Sơ đồ hoạt động kiểm tra quyền hạn và khoảng cách thời gian khi xử lý yêu cầu hủy lịch. | `src/bookings/bookings.validation.ts#L117-L126`, `src/bookings/bookings.service.ts#L1540-L1615` |
| [`activity-registration.puml`](./activity-registration.puml) | Activity | Sơ đồ hoạt động đăng ký tài khoản mới, mã hóa mật khẩu và gửi email kích hoạt. | `src/auth/auth.service.ts#L155-L220`, `src/mail/mail.service.ts` |
| [`activity-review.puml`](./activity-review.puml) | Activity | Sơ đồ hoạt động gửi đánh giá, salon phản hồi, báo cáo vi phạm và admin kiểm duyệt. | `src/reviews/reviews.service.ts#L277-L450` |
| [`class-domain.puml`](./class-domain.puml) | Class / Domain | Mô hình thực thể miền nghiệp vụ, thuộc tính cốt lõi, mối quan hệ và bản số (cardinality). | `prisma/schema.prisma#L9-L3815` |
| [`erd.puml`](./erd.puml) | ERD | Sơ đồ quan hệ thực thể cơ sở dữ liệu vật lý (PostgreSQL), khóa chính/ngoại và ràng buộc loại trừ. | `prisma/schema.prisma`, `prisma/migrations/20260729_use_nonblocking_booking_slot_locks/migration.sql` |
| [`component-diagram.puml`](./component-diagram.puml) | Component | Kiến trúc thành phần hệ thống: Web SPA, NestJS Core, Modules nghiệp vụ, Prisma ORM, Redis & DB. | `src/app.module.ts`, `src/main.ts`, `beauty-booking-web-main/src/App.jsx` |
| [`deployment-diagram.puml`](./deployment-diagram.puml) | Deployment | Cấu trúc triển khai hạ tầng container thực tế với Docker Compose, cổng dịch vụ và ổ đĩa lưu trữ. | `docker-compose.yml`, `beauty-booking-api-main/Dockerfile`, `beauty-booking-web-main/Dockerfile` |
| [`state-booking.puml`](./state-booking.puml) | State Machine | Vòng đời 9 trạng thái của lịch hẹn và ma trận điều kiện chuyển trạng thái theo từng vai trò. | `prisma/schema.prisma#L3436-L3446`, `src/bookings/bookings.validation.ts#L14-L69` |
| [`state-business.puml`](./state-business.puml) | State Machine | Vòng đời thẩm định và hoạt động của Doanh nghiệp Salon từ bản nháp đến phê duyệt/đình chỉ. | `prisma/schema.prisma#L3294-L3303`, `src/business/business-onboarding.service.ts` |
| [`c4-context.puml`](./c4-context.puml) | C4 Context | Mô hình C4 cấp độ 1: Ranh giới hệ thống BeautyBook, các nhóm tác nhân và hệ thống email bên ngoài. | `README.md`, `src/app.module.ts` |
| [`c4-container.puml`](./c4-container.puml) | C4 Container | Mô hình C4 cấp độ 2: Chi tiết các container runtime (Web SPA, API Server, PostgreSQL, Redis, Volumes). | `docker-compose.yml`, `src/main.ts` |

---

## Hướng dẫn Biên dịch và Render Sơ đồ

Tất cả tệp sơ đồ được viết theo chuẩn **PlantUML độc lập** (không phụ thuộc URL mạng bên ngoài):

1. Cài đặt extension **PlantUML** trong IDE (VS Code / Antigravity IDE) hoặc sử dụng CLI PlantUML:
   ```bash
   java -jar plantuml.jar docs/diagrams/*.puml
   ```
2. Để xuất định dạng SVG:
   ```bash
   java -jar plantuml.jar -tsvg docs/diagrams/*.puml
   ```
3. Xem trực tiếp trong VS Code bằng tổ hợp phím `Alt + D`.
