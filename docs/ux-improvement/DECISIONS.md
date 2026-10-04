# Quyết định cấu trúc

1. **Màn xác nhận web:** Trước: dịch vụ, rồi bốn card lồng nhau; ở 390px thời gian nằm dưới vùng đầu màn hình. Sau: dịch vụ và bảng chi tiết 4 dòng, thời gian trước chi nhánh/chuyên viên/người đặt. Giữ giá từ preview API, consent/policy, CTA và route. Thành công khi mọi lựa chọn đọc được và không tràn ngang.
2. **Nhãn booking trong store:** ID vẫn là nguồn gửi API; tên/địa chỉ chỉ để người dùng kiểm tra. Xóa tên chuyên viên cùng lúc với ID khi đổi dịch vụ, biến thể, combo hoặc chi nhánh. Không thêm request chỉ để vẽ summary.
3. **Native trạng thái:** Màn kết quả và lịch dùng `rawStatus` do API trả về; `PENDING` không được diễn đạt như `CONFIRMED`. Trạng thái chưa rõ dùng thông điệp trung tính, không giả định cơ sở đã xác nhận.
4. **Native 409:** Chỉ làm mới slot cho thông điệp xung đột giờ hoặc nhân viên đã xác minh từ source. Với 409 khác, giữ lựa chọn và idempotency key, để người dùng thấy lỗi thực. Không tự thử lại POST.
5. **Trang chủ web:** Giữ thứ tự/section/bố cục; chỉ bỏ một câu chứa thuật ngữ `API`. Không sử dụng mẫu ngoài chỉ vì có skill mới.
6. **Danh bạ quản trị:** API `business-directory`/`branch-directory` không cấp media. Bảng desktop không có vùng ảnh để trả chỗ cho tên và số liệu. Card mobile ưu tiên ảnh tải lên nếu có, sau đó chỉ dùng ảnh minh họa đã mapping theo ID thực thể và ghi nhãn; thiếu nguồn thì không dựng placeholder. Không dùng ảnh chung cho mọi thực thể.
7. **Lịch theo vai trò:** Tên chuyên viên trong lịch ngày cần đọc được ở 375px; tăng cột lên 260px, cho phép xuống dòng và chỉ giữ cuộn ngang bên trong lịch nếu nhiều chuyên viên. Tab xử lý lịch là hàng đợi xác nhận/yêu cầu đổi lịch, không phải danh sách chờ nhận chỗ; nhãn mới phản ánh đúng nghiệp vụ.
8. **Tổng quan salon:** Khi không có hoạt động trong khoảng ngày đã chọn, cả vùng phân tích dùng một trạng thái trống. Nếu chỉ một vài chuỗi có dữ liệu, chỉ vẽ các biểu đồ đó; lỗi tải một phần vẫn báo rõ và giữ phần đã tải.
9. **Web và app mobile:** Giữ nhất quán dữ liệu, thuật ngữ nghiệp vụ và trạng thái đặt lịch. Bố cục, điều hướng và thành phần tương tác native có thể khác web để phù hợp thiết bị; không coi viewport web 375px là bản thiết kế app mobile.
