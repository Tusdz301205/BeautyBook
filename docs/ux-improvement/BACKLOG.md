# Backlog UX có bằng chứng

| ID | Vấn đề và tác vụ ảnh hưởng | Trạng thái | Bằng chứng / bước tiếp |
| --- | --- | --- | --- |
| B1 | Màn xác nhận web thiếu chi nhánh/chuyên viên và đẩy thời gian xuống xa. | Đã sửa, fixture QA qua | `BookingConfirm.jsx`, store, Step1/2; ảnh `booking-confirm-390.png`. |
| B2 | Tên lựa chọn cũ có thể còn khi thay dịch vụ; màn cuối sẽ sai. | Đã sửa, unit test qua | `bookingStore.test.js` kiểm tra invalidation và deep-link label. |
| B3 | Native báo “Đặt lịch thành công” cho cả PENDING. | Đã sửa code, chờ native visual QA | `BookingSuccessScreen.tsx`, `AppointmentCard.tsx`, `LichHenScreen.tsx`, `AppointmentDetailScreen.tsx`. |
| B4 | Native coi mọi HTTP 409 là hết giờ trống, làm mất lựa chọn khi là xung đột khác. | Đã sửa code, chờ API integration | `BookingScreen.tsx`; backend trả 409 cho cả combo, điều kiện biến thể, customer overlap. |
| B5 | Native lỗi mạng lộ API URL/tên biến môi trường. | Đã sửa code, typecheck qua | `mobile/src/api/client.ts`. |
| B6 | Copy nội bộ trong Home, trang doanh nghiệp, salon combo và tổng quan. | Đã sửa bản rõ nghĩa; lịch salon đã visual QA | Các màn khác chưa được duyệt trực quan đủ vai trò. |
| B7 | `AdminViolations` còn mã raw nhưng route đã redirect. | Không sửa component cũ | `/admin/salons` đã visual QA với fixture; các route admin còn lại vẫn cần kiểm tra. |
| B8 | Native success/list/detail và booking conflict chưa kiểm tra trên thiết bị thật. | Chờ môi trường | `mobile/AGENTS.md` không cho tự chạy emulator/Metro/ADB. |
| B9 | API thật, đồng bộ giữa tài khoản, booking PENDING/CONFIRMED và cập nhật ảnh entity chưa kiểm chứng. | Chờ staging cô lập | Backend cổng 3000 không chạy; không tạo lịch/hủy/thanh toán thật. |
| B10 | Vấn đề logic tài chính phát hiện sau này. | DEFERRED_PAYMENT | Task hiện tại chỉ rà copy/hiển thị, không đổi thanh toán/hoàn tiền. |
| B11 | Native mở màn kết quả khi booking không còn trong bộ nhớ chỉ hiện lỗi, không có đường phục hồi. | Đã sửa code, chờ native visual QA | Nút đi tới danh sách lịch hẹn trong `BookingSuccessScreen.tsx`. |
| B12 | Bảng danh bạ admin dựng placeholder ảnh dù API directory không cấp media; ảnh co giãn lấn hết cột. | Đã sửa, fixture QA qua | Bỏ ảnh ở bảng desktop; card mobile chỉ hiện ảnh tải lên hoặc mapping đúng ID. Ảnh `admin-1440.png`, `admin-media-business-375.png`, `admin-media-branch-375.png`. |
| B13 | Lịch ngày cắt tên chuyên viên dài ở cột 220px. | Đã sửa, fixture QA qua | Cột 260px, header cao hơn và tên xuống dòng. Ảnh `receptionist-375.png`. |
| B14 | Tab “Hàng chờ & yêu cầu” dễ bị hiểu là danh sách chờ đã gỡ; nội dung dùng enum `CANCELLED`. | Đã sửa nhãn, fixture QA qua | Tab nay là “Việc cần xử lý”; dialog diễn đạt “được hủy”. Không thay hành vi xác nhận lịch/đổi lịch. |
| B15 | Sidebar, tiêu đề workspace, tên chi nhánh và nhãn trạng thái bị cắt chữ khi mobile hoặc tăng cỡ chữ. | Đã sửa, fixture QA 150% qua | Điều hướng, bộ lọc và nhãn tự xuống dòng; tab hẹp xếp hàng. Ảnh `admin-text-150-375.png`, `receptionist-text-150-375.png`. |
| B16 | Tổng quan salon không có hoạt động vẫn dựng nhiều card biểu đồ rỗng, làm màn mobile dài vô ích. | Đã sửa, fixture QA qua | Một trạng thái rỗng cho toàn vùng; khi chỉ có một phần dữ liệu thì chỉ hiện biểu đồ tương ứng. Ảnh `owner-overview-375.png`, `owner-overview-data-1440.png`. |
| B17 | Lỗi tải một phần tổng quan lộ khóa kỹ thuật `dashboard`. | Đã sửa, fixture QA qua | Nhãn tiếng Việt và giữ dữ liệu tải được. Ảnh `owner-overview-error-1440.png`. |
| B18 | Một số nội dung vận hành vẫn dùng từ nội bộ hoặc dễ hiểu nhầm là chức năng danh sách chờ đã bỏ. | Đã sửa các vị trí tìm được, chưa QA toàn bộ màn | Sửa copy ở promotion/profile/appointments/booking success/admin compliance/review moderation; chưa tuyên bố hết mọi nội dung cũ. |
| B19 | Trục doanh thu làm tròn khoản 450.000đ thành `0tr`. | Đã sửa, fixture QA qua | Định dạng trục theo nghìn/triệu; ảnh `owner-overview-data-1440.png` hiện 450k thay cho 0tr. |

Chỉ đóng mục khi có bằng chứng tương ứng. Không coi việc chưa phát hiện lỗi là đã kiểm tra xong toàn bộ màn hình.
