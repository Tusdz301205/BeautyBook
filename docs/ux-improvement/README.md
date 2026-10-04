# BeautyBook UX improvement — 28/09/2026

Mục tiêu: làm rõ tác vụ và trạng thái ở web, app native, nội dung theo vai trò. Yêu cầu hiện tại: **giữ cấu trúc trang chủ web**; các khu vực khác có thể tổ chức lại khi có vấn đề được xác minh. Giao diện app mobile được thiết kế theo nhu cầu và quy ước native, không cần giống bản web. Không thay API, chính sách đặt lịch, dữ liệu, quyền, thanh toán hay tính năng đã nghỉ dùng.

Baseline: working tree đã có nhiều thay đổi chưa commit. Đã đọc `docs/mobile-fe-review/README.md`, `docs/mobile-web-redesign/README.md` và triển khai tiếp trên các file hiện tại. Không khôi phục bản HEAD. `docs/ui-content-review/` chưa tồn tại.

Đợt đã triển khai:

- Web booking: tên chi nhánh, địa chỉ và tên chuyên viên đi theo lựa chọn; màn xác nhận hiển thị cùng ngày giờ, người đặt và giá trong cấu trúc gọn. Đổi dịch vụ/biến thể/chi nhánh xóa tên chuyên viên cùng lựa chọn phụ thuộc. Deep link vẫn dùng ID cũ.
- Web content: bỏ một số từ nội bộ (`API`, `snapshot`, `BookingService`, `KPI`, `slot`) khỏi nội dung công khai và salon, gồm cả hộp tạo lịch tại quầy. Giữ ý nghĩa lịch sử giá và quyền truy cập. Màn `AdminViolations` đã xác minh không còn route hoạt động nên không sửa.
- Native: kết quả đặt lịch và danh sách/chi tiết lịch phân biệt `PENDING` với `CONFIRMED`; chỉ gợi ý đến cơ sở sau khi lịch không còn chờ xác nhận. Màn kết quả cuộn được khi nội dung dài và có đường về danh sách nếu thông tin không tải được. Xung đột HTTP 409 chỉ làm mới giờ khi thông điệp thực sự liên quan giờ/nhân viên; lỗi 409 khác giữ lựa chọn và hiển thị lý do. Lỗi kết nối không lộ URL máy chủ.
- Web vận hành: bảng doanh nghiệp/chi nhánh bỏ vùng ảnh để tên, cột và nút chi tiết không bị ép hẹp. Card mobile chỉ hiện ảnh đã tải lên hoặc ảnh minh họa có mapping theo đúng ID; không dựng placeholder cho thực thể thiếu ảnh. Trang tổng quan salon gộp trạng thái trống của biểu đồ và chỉ vẽ biểu đồ thật sự có dữ liệu. Lịch ngày dành thêm chiều rộng cho tên chuyên viên dài. Nhãn tab xử lý lịch nói rõ tác vụ, không gợi lại tính năng danh sách chờ đã nghỉ dùng. Điều hướng và tiêu đề khu vực được xuống dòng trên màn hẹp.

Skill đã áp dụng: `skills/SKILL.md` cho thứ tự thông tin và trạng thái; `skills/mobile-app-design/SKILL.md` cùng `references/common-mistakes.md`, `references/accessibility-checklist.md` cho độ đọc/tương tác native. `skills/ux-pattern-research/SKILL.md` và danh mục `skills/awesome-ux/README.md` được dùng để định khung câu hỏi về flow, không sao chép pattern bên ngoài. Không dùng Galaxy vì các component hiện tại giải quyết được vấn đề.

Chi tiết tại `COVERAGE.md`, `BACKLOG.md`, `DECISIONS.md`, `VERIFICATION.md`, `HANDOFF.md`.
