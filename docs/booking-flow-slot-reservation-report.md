# Báo cáo Booking Flow và Slot Reservation

Ngày thực hiện: 16/07/2026

## Quy tắc đã triển khai

- Khách có thể chọn nhân viên cụ thể hoặc “Bất kỳ nhân viên phù hợp”.
- Danh sách staff công khai lọc theo branch, ACTIVE và đủ kỹ năng cho toàn bộ service đã chọn.
- Khi chọn “bất kỳ”, backend luôn chọn một staff cụ thể; không tạo online booking với `staffId = null`.
- Create booking chạy trong Serializable transaction, khóa advisory theo branch/staff/ngày, kiểm tra overlap lại trong transaction và trả 409 khi slot vừa bị đặt.
- Blocking statuses là `PENDING`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`. `CANCELLED`, `REJECTED`, `EXPIRED`, `NO_SHOW` giải phóng slot.
- Branch có cấu hình `bookingConfirmationMode`, `staffAssignmentMode`, `pendingHoldMinutes`; UI cấu hình nằm tại Hồ sơ chi nhánh.
- Manual confirmation tạo `PENDING`; auto confirmation tạo `CONFIRMED`.
- PENDING có `pendingExpiresAt`; backend lazy-expire sang `EXPIRED` trước list/create/available-slots và ghi status history.
- Booking có `source` (`ONLINE_WEB`, `ONLINE_APP`, `WALK_IN`, `PHONE`, `STAFF_CREATED`, `ADMIN_CREATED`). Public web gửi `ONLINE_WEB`.
- `/salon/appointments` có form “Tạo lịch tại quầy”; lễ tân/owner có thể nhập khách vãng lai, chọn dịch vụ, staff hoặc “bất kỳ”, và backend tạo customer nội bộ bị vô hiệu hóa đăng nhập thay vì dữ liệu giả.
- UI chống double-click, giữ lựa chọn hiện tại và quay lại tải slot mới khi nhận 409.

## Time-based status guard

- `CONFIRMED -> CHECKED_IN`: chỉ từ 30 phút trước giờ bắt đầu.
- `CHECKED_IN -> IN_PROGRESS`: chỉ khi đến giờ bắt đầu (grace mặc định 0).
- `IN_PROGRESS -> COMPLETED`: chỉ khi đã đến giờ kết thúc.
- `CONFIRMED -> NO_SHOW`: chỉ sau giờ bắt đầu cộng 15 phút.
- Backend là nguồn sự thật; drawer dùng `transitionAvailability` do backend tính để ẩn action và hiện lý do.
- Sau mutation, drawer refetch booking từ API; không fake status local.
- Receptionist vẫn không được complete; Staff chỉ complete khi đúng state, permission và thời gian.

## Xác minh

- Time guard unit/service tests: pass, gồm direct service call không thể complete booking tương lai và `finalAmount` vẫn được set cho booking quá khứ.
- Booking validation + permission catalog: pass.
- Backend build và frontend production build: pass.
- PostgreSQL integration: 4/4 tests pass, gồm cạnh tranh thanh toán, hai request đặt cùng staff/slot chỉ một request thành công, và chống vượt số tiền hoàn.
- Kiểm thử đồng thời đã phát hiện và sửa hai lỗi runtime: Prisma giải mã kiểu `void` của advisory lock, và fallback `changedBy` dùng nhầm `customerProfile.id` thay vì `user.id`.
- Docker cuối: API/PostgreSQL/Redis healthy; web phục vụ tại `http://localhost:8080`.

- PENDING expiration chạy cả cron mỗi phút và lazy-expire trước list/create/query slot, nên slot không bị giữ vô hạn nếu một cơ chế tạm thời chậm.
