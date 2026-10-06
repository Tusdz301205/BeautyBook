# Chạy và kiểm tra

Ứng dụng chính `mobile/`, Android package `com.beautybook.mobile`, scheme `beautybook://`, Expo57. Giữ framework/dependencies lớn và Secure Store key cũ.

1. Chạy backend theo cấu hình môi trường của bạn. QA được dùng trong báo cáo là cổng3012, prefix `/api/v1`, database test riêng. `beauty-booking-api-main/scripts/full-qa-server.mjs` chỉ dùng ignored QA runtime đã guard; không tự thay database production.
2. Trước khi mở Metro, cấu hình `EXPO_PUBLIC_API_URL`. Emulator Android dùng `http://10.0.2.2:3012/api/v1` với QA này. Thiết bị thật dùng IP LAN của máy chạy API; 10.0.2.2 không dành cho điện thoại thật. Web release dùng origin HTTPS đã cấu hình thực tế.
3. `EXPO_PUBLIC_WEB_URL` tùy chọn cho link desktop, không chứa token. QA emulator trỏ `http://10.0.2.2:5176`; đổi theo môi trường thực tế.
4. Trong `mobile`, chạy `npm run typecheck`, `npm run export:android`, hoặc `npm run android` để build ứng dụng chính. Metro của lần QA đang ở8081; Windows localhost cần IPv4 (`NODE_OPTIONS=--dns-result-order=ipv4first`). Không restart/reboot lặp lại từng edit.
5. Login chọn Khách hàng hoặc Nhân viên/Chủ doanh nghiệp. SALON role lấy từ server; doanh nghiệp nhiều lựa chọn cần chọn sau credential challenge. Đổi business đăng nhập lại, không sửa client ID để dùng token ngữ cảnh cũ.

QA helper labels staffA/staffB/owner/customer lấy từ manifest runtime ignored. Không đưa email/password/token/connection string vào tài liệu/commit. API runner đã dùng lifecycle fixture nên không được blind rerun/reset; đọc evidence và tạo case additive mới khi cần.

Tests mobile: `node --test tests/operations-provider.test.cjs tests/operation-session.test.cjs tests/staff-work.test.cjs tests/owner-operations.test.cjs tests/booking-feedback.test.cjs tests/booking-sync.test.cjs`.

Xem [TESTS.md](TESTS.md), [AUTHORIZATION.md](AUTHORIZATION.md), [BACKEND.md](BACKEND.md), [UX-ARCHITECTURE.md](UX-ARCHITECTURE.md), [STAFF.md](STAFF.md), [OWNER.md](OWNER.md). Không coi build/export là native acceptance.
