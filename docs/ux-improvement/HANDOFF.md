# Handoff cho đợt kế tiếp

Ưu tiên đầu tiên: kiểm tra API staging cô lập cho booking PENDING/CONFIRMED, các nhóm 409 (slot, combo, điều kiện biến thể, trùng lịch khách), rồi QA native trên thiết bị khi được yêu cầu. Không tạo/hủy lịch thật trong môi trường người dùng hoặc gửi thông báo.

Tiếp theo: mở rộng fixture đã có ở `tests/e2e/ux-role-smoke.mjs` sang các route salon/admin khác, kiểm tra thao tác theo quyền, trạng thái lỗi và raw enum. Với ảnh, dùng `IMAGE-SYSTEM.md` và ảnh entity thực tế, không dùng fixture trống để kết luận production. API danh bạ admin hiện không cấp media; card mobile chỉ vẽ ảnh tải lên hoặc mapping ID, còn bảng desktop không vẽ ảnh. Kiểm tra ảnh tải lên bằng API thật khi có staging.

Không đụng cấu trúc trang chủ web. Không reset/stash working tree; nhiều thay đổi chưa commit có từ trước. Thư mục `skills/` và `mobile/` hiện bị ignore/untracked theo cấu hình repository, cần lưu ý trước khi bàn giao sang checkout khác. Task này chưa có bằng chứng đủ để tuyên bố đã hoàn thiện UX toàn dự án.
