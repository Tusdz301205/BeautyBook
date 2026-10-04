# Coverage theo role và tác vụ

| Platform / vai trò | Tác vụ → màn hình → hành động → kết quả | Trạng thái kiểm tra |
| --- | --- | --- |
| Web / khách chưa đăng nhập | Home/Explore → tìm dịch vụ → chi tiết → đăng nhập | Home giữ cấu trúc; fixture browser từ review trước qua. Không kiểm tra API thật. |
| Web / khách hàng | Chi tiết → 5 bước booking → xác nhận → màn kết quả; lịch hẹn, đổi lịch, dịch vụ lưu, voucher, hồ sơ | 5 bước qua fixture ở 320–1440px; đợt này sửa thông tin màn xác nhận. Không gửi booking thật. |
| Web / nhân viên, lễ tân, chủ | Lịch hẹn → thao tác theo quyền; dịch vụ/combo, tổng quan, thông báo | `/salon/appointments` xem bằng fixture từng vai trò tại 375/768/1024/1440px; lễ tân mở tab việc cần xử lý. `/salon` của chủ đã kiểm tra trạng thái rỗng, có một phần dữ liệu và lỗi tải một phần. Chưa kiểm tra tất cả màn hoặc thao tác ghi dữ liệu. |
| Web / quản trị | Tổng quan, quản lý lịch, duyệt cơ sở → xử lý đúng scope | `/admin/salons` xem danh sách doanh nghiệp và chi nhánh bằng fixture tại 375/768/1024/1440px; ảnh theo ID trên card mobile tải được. `/admin` xem tại 375/1440px; `/admin/violations` redirect sang route danh bạ. Chưa kiểm tra các màn admin khác. |
| Native / khách hàng | Tìm cơ sở → đặt lịch → xem kết quả → danh sách/chi tiết lịch | Đọc stack/tab/mappers/API; sửa PENDING, 409, tên dài và copy lỗi. TypeScript qua; chưa chạy emulator/device. |
| Backend | Thông điệp lỗi booking và các mã trạng thái | Đối chiếu source để phân biệt slot conflict với các 409 khác; không sửa backend. Runtime cổng 3000 không hoạt động. |

Web và native có bằng chứng riêng. Test viewport trình duyệt không thay cho test iOS/Android. Các nhóm role chỉ có static code review được ghi đúng như vậy.
