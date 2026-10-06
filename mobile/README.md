# Beauty Book mobile

Ứng dụng mobile chính, package Android `com.beautybook.mobile`, deep link `beautybook://`. Customer giữ khám phá/tìm kiếm/đặt lịch/lịch hẹn/tài khoản. Staff có Hôm nay/Lịch/Thông báo/Tài khoản; Owner có Tổng quan/Vận hành/Thông báo/Tài khoản. Role và scope lấy từ máy chủ sau login SALON; receptionist/platform-only sử dụng web. Các giao diện dùng API thật, không có dữ liệu mẫu khi lỗi. Thanh toán, hoàn tiền và quản trị sâu không thuộc mobile V1.

Chọn “Nhân viên / Chủ doanh nghiệp” khi đăng nhập bằng tài khoản vận hành. Với nhiều doanh nghiệp, chọn doanh nghiệp do máy chủ trả sau xác thực. Đổi doanh nghiệp cần đăng nhập lại. Owner chỉ chuyển sang Công việc của tôi khi có hồ sơ nhân viên ACTIVE thuộc ngữ cảnh được phép. `EXPO_PUBLIC_WEB_URL` là origin web tin cậy tùy chọn cho thao tác desktop-only; ứng dụng không gắn token vào link. Kết quả native/permission và giới hạn hiện tại: [docs/mobile-staff-owner](../docs/mobile-staff-owner/TESTS.md).

## Cấu hình

1. Chạy API của dự án ở cổng 3000.
2. Sao chép `.env.example` thành `.env` và đặt `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/v1` cho Android emulator. Thiết bị thật dùng IP mạng nội bộ của máy chạy API, và cần build lại sau khi đổi URL.
3. Trong thư mục `mobile`, chạy `npm ci`, mở Android Studio Device Manager và bật emulator, rồi chạy `npm run android`. Lệnh này build ứng dụng chính và khởi động Metro cho bản debug.

Có thể mở `mobile/android/` trong Android Studio sau `npx expo prebuild --platform android --no-install`. Nếu Gradle/CMake lỗi vì đường dẫn quá dài trên Windows, tạo junction ngắn trỏ tới thư mục `mobile/` (ví dụ `C:\BBMain`) rồi build qua junction. Chỉ dùng HTTP trong môi trường nội bộ; bản phát hành cần API HTTPS.

Kiểm tra kiểu: `npm run typecheck`. Kiểm tra bundle Android: `npm run export:android`. Xuất demo web bằng `npx expo export --platform web`, sau đó `npx expo serve --port 8086`; khi xuất web, đặt `EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1` và cho phép `http://localhost:8086` trong `CORS_ORIGINS` của backend. Lệnh export Android cũng ghi vào `dist/`, nên nếu vừa export Android, cần export web lại trước khi mở URL demo. Chạy `npm run test:live:catalog` để kiểm tra danh mục, ảnh, tìm kiếm, cơ sở và slot mà không tạo lịch; mặc định bài test mở ứng dụng chính ở cổng 8086, có thể đổi bằng `MOBILE_WEB_URL`. Các bài `tests/live-*.mjs` khác có thể tạo dữ liệu QA trong database local.

API hỗ trợ `refreshTokenTransport: 'BODY'` cho phiên native và giữ cookie HttpOnly mặc định cho web. Mobile lưu refresh token bằng Expo Secure Store. Lịch đặt từ mobile gửi `source: 'ONLINE_APP'`.

Ảnh minh họa và nguồn gốc được ghi ở [assets/illustrations/manifest.md](assets/illustrations/manifest.md). Xem [trạng thái triển khai](docs/IMPLEMENTATION-STATUS.md) trước khi phát hành.
