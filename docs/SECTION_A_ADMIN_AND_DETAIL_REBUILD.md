# Section A — Admin, detail và booking operations

## Mục tiêu và nguyên tắc

Section A tách rõ hai lớp trách nhiệm:

- Platform quản trị identity, compliance, trust & safety, audit và các ngoại lệ có kiểm soát.
- Salon vận hành booking, nhân sự, dịch vụ và thanh toán tại quầy trong đúng Business/Branch scope.

Platform không được confirm, check-in, start, complete, assign staff, move/resize booking hoặc collect payment thay salon. Kiểm tra này tồn tại ở cả giao diện và `BookingsAccessService`, vì vậy gọi API trực tiếp cũng bị từ chối.

## Detail đã chuẩn hóa

### Platform

- `/admin/users/:userId`: thông tin tài khoản, xác minh, role/scope bằng tên dễ hiểu, workspace session, booking liên quan và audit.
- `/admin/businesses/:businessId`: owner, onboarding, restriction, branch, tài liệu/version, trust signal và audit.
- `/admin/branches/:branchId`: Business cha, địa chỉ, trạng thái, readiness, giờ làm, dịch vụ, nhân sự bookable, tài liệu và review timeline.
- Booking drawer dùng cùng dữ liệu booking hiện có, hiển thị dịch vụ, nhân viên, giá, ghi chú và status history.
- `/salon/staff/:staffId`: detail nhân sự thống nhất; xem tài liệu onboarding/offboarding riêng để biết lifecycle.

Không đưa health record vào User Detail. Các ID nội bộ không còn được dùng làm dữ liệu nhập ở luồng thu tiền và cấp voucher; người vận hành dùng booking code, email hoặc số điện thoại.

## Booking Admin

Platform booking drawer là read-only. Ngoại lệ duy nhất là `booking:cancel:platform`:

1. Gọi `GET /bookings/:id/force-cancel-preview`.
2. Hiển thị số service slot được giải phóng và tình trạng payment.
3. Bắt buộc nhập lý do.
4. Gọi state transition sang `CANCELLED`; backend audit transition.
5. Không tự hoàn tiền. Nếu đã thu tiền, mở refund workflow riêng.

Backend từ chối mọi write thông thường khi session workspace là `PLATFORM`, kể cả khi client cũ còn gửi request.

## Review hậu kiểm

Flow mới:

`COMPLETED booking → customer review → APPROVED/public → report → REPORTED/public → Platform keep hoặc hide`

- Owner/Manager: reply và report.
- Owner/Manager không được moderate hoặc hide.
- Platform moderation chỉ nhận `review:moderate:platform`.
- Report không tự ẩn review.
- Business reply được gắn trực tiếp vào đúng `Review` qua `BusinessComment.reviewId`, không còn là comment rời.

## Navigation và deep-link

- Admin sidebar không còn voucher/campaign salon, profile cá nhân, security cá nhân và settings thường.
- Profile/security vẫn truy cập từ avatar; advanced settings vẫn permission-gated và không nằm trong sidebar chính.
- Notification có `targetId` mở đúng User, Branch hoặc Business Detail. Compliance target mở đúng resource kèm `?tab=compliance`.
- KPI/report vẫn dùng dữ liệu API hiện tại; không thêm số liệu giả.

## API chính thay đổi

- `GET /business/:businessId/detail`
- `GET /bookings/:id/force-cancel-preview`
- `POST /reviews/:id/report`
- `POST /reviews/:id/reply` không còn tin `businessId` từ client; backend tự suy ra và kiểm tra scope.
- `PATCH /reviews/:id/moderate` chỉ dành cho Platform moderation.
- Payment collect chấp nhận mã nghiệp vụ `BB-...` và resolve sang internal ID ở backend.
- Voucher grant chấp nhận email/số điện thoại/tên duy nhất rồi resolve CustomerProfile; tenant relationship vẫn được kiểm tra.

## Trạng thái chưa mở rộng trong Section A

- Dispute/flag/support-note riêng của booking chưa có model đầy đủ trong schema, nên không tạo nút giả.
- Compliance hiện dùng Business/Branch detail và review timeline; chưa tạo một aggregate `ComplianceApplication` mới khi source chưa có model tương đương.
- Payment/ledger drill-down giữ module hiện có; Section A chỉ loại bỏ input UUID và giữ nguyên state machine tài chính.

