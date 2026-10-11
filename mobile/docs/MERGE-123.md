# Merge mobile Berry Clarity vào ứng dụng chính

Ngày thực hiện: 11/10/2026.

Nguồn: `123/BeautyBook`, HEAD `09a439e4365700fa18bda8ef2744d84cbda19b1e`. Commit chung với project chính: `38c5fb68859135c9a8c458eb053d894a92eb97be`. Đã áp dụng 94 đường dẫn thay đổi từ ba commit thiết kế, gồm giao diện Customer/Staff/Owner, bộ token/theme, component dùng chung và tài liệu thiết kế. Không thay backend/web, biến môi trường, package ID, lockfile hoặc dependency bằng bản sao trong `123`.

## Các phần giao nhau được ghép có chủ đích

- Giữ giao diện Berry Clarity cho thông báo nhưng dùng `useNotificationRequests` của bản chính: chặn phản hồi phiên cũ, bấm trùng, phân trang đồng thời và phản hồi đánh dấu đã đọc sau logout/unmount.
- Giữ đọc lịch từ thông báo trong đúng doanh nghiệp; mọi thao tác và hiệu chỉnh giờ được ghim vào chi nhánh của lịch đã được API cho phép đọc.
- Không đưa lại API client, nút hay luồng yêu cầu xử lý dữ liệu/xóa tài khoản đã được gỡ theo quyết định sản phẩm.
- Giữ các test chống race và kiểm tra phạm vi đã thêm ở bản chính; cập nhật mock/locator cho component mới, không bỏ assertion nghiệp vụ.
- Giữ logic idempotency, kết quả đặt lịch chưa rõ, START/COMPLETE, scheduled/actual time và permission; review độc lập mã nguồn không xác nhận regression trong những luồng này.

## Kiểm tra thực tế

- `npm run typecheck`: đạt.
- `node --test tests/*.test.cjs`: 197/197 đạt.
- `node scripts/audit-reachable.mjs`: 131/131 module nguồn truy cập được từ entrypoint.
- Expo export Android Hermes: đạt, 1.078 module, có bundle `.hbc` và metadata.
- Đối chiếu trước/sau: 80 file trong bản lưu mobile ngoài phạm vi cập nhật giữ nguyên từng byte; không có thay đổi bất ngờ. Archive nguồn đã kiểm tra CRC; Git bundle có lịch sử đầy đủ và verify đạt.

Lượt đầu có 4 test lỗi do mock component giao diện chưa cập nhật; đã sửa mock và chạy lại toàn bộ. Lượt test/export trong sandbox gặp `spawn EPERM`; lượt được cấp quyền chạy compiler/tiến trình Node đã đạt. Các log ban đầu được giữ lại, không coi lỗi môi trường này là lỗi sản phẩm.

Chưa chạy ứng dụng trên Android/iOS hoặc kiểm tra layout/bàn phím/trợ năng trên thiết bị. Export và test Node không thay thế nghiệm thu native. Không chạy ADB, emulator hoặc Metro trong lượt merge này.

## Bản lưu và dọn dẹp

Các bản lưu nằm trong thư mục được Git ignore `report-output/mobile-123-merge/`: `before-mobile.zip`, `incoming-tracked.zip`, `incoming-history.bundle`. Manifest, kiểm tra bảo toàn, log test/export và kết quả dọn thư mục cũng nằm ở đó. Không đưa `node_modules`, cache hay một repo Git lồng nhau vào project chính.

Thư mục nhập `123` được xóa sau khi merge, kiểm tra và xác minh bản lưu; không xóa dữ liệu database hoặc lịch sử ứng dụng.
