# Đơn giản hóa cấu hình dịch vụ — 14/10/2026

## Phạm vi

Hai màn hình web: quản lý dịch vụ của chủ doanh nghiệp và bước địa chỉ/khu vực trong trình thiết lập chi nhánh.

## Thay đổi

- Dịch vụ tại nhà chỉ cần nhập khu vực phục vụ. Có thể nhập mỗi khu vực một dòng hoặc tiếp tục dùng dấu phẩy. Gỡ ô bán kính, phí di chuyển và khu vực không hỗ trợ vì hiện chưa có luồng đặt lịch/tính giá sử dụng các giá trị này. Payload lưu nháp bỏ các trường đó để giữ dữ liệu đã lưu.
- Thêm lựa chọn dịch vụ bằng tên, giá cố định và thời lượng. Giá/thời lượng điền sẵn từ dịch vụ tại chi nhánh. Mã tự sinh và giữ nguyên khi gửi lại sau lỗi.
- Gỡ các ô mã, kiểu giá, giá tối đa và thời lượng tối đa khỏi form tạo lựa chọn mới. Các lựa chọn cũ giữ nguyên thuộc tính và ID.
- Thời gian chuẩn bị/nghỉ là phần tùy chọn có thể mở thêm. Giá trị sai có lỗi tại ô nhập; phần này giữ mở trong lúc sửa lỗi.
- Danh sách lựa chọn cũ thu gọn trong lúc thêm mới. Lựa chọn đã tạm ngưng vẫn xuất hiện và có thể kích hoạt lại.
- Gỡ form tạo quan hệ đi kèm và phụ thu mới khỏi màn hình chi tiết. Nếu đã có quy định cũ, chủ cơ sở có thể mở xem, xác nhận gỡ quan hệ đi kèm hoặc tắt/bật điều chỉnh giá. Các thay đổi này tác động đến lần đặt/tính giá mới; dữ liệu giá trong lịch đã đặt vẫn dùng snapshot hiện có.

## API quản lý

- `GET /services/:id/options/manage`: lựa chọn hoạt động/tạm ngưng, quan hệ đi kèm có tên dịch vụ, các quy tắc giá có trạng thái và điều kiện.
- `PATCH /services/price-rules/:ruleId`: chỉ nhận `{ active: boolean }`, giữ các thuộc tính khác.
- `DELETE /services/:id/dependencies/:dependencyId`: gỡ đúng quan hệ của dịch vụ được chọn.

Các API dùng role Owner, permission tương ứng và kiểm tra quyền truy cập chi nhánh. Thao tác cập nhật/gỡ có audit.

## Kiểm chứng

- 281 test web hiện có đạt.
- 67 test trong module services đạt, bao gồm 35 test tập trung vào API mới; test dùng Prisma giả lập.
- Build web và backend đạt.
- Kiểm tra các trang thật bằng Edge headless ở 320, 375, 414, 768 và 1440 px: form cơ bản, validation, gửi hai lần, giữ nội dung/mã khi retry, kích hoạt lựa chọn đã ngưng, hủy/xác nhận thay đổi quy tắc, đọc lỗi và tải lại, lưu khu vực không ghi đè các trường đã gỡ, kiểm tra tràn ngang.
- Kiểm tra bổ sung tại 375 px: dịch vụ chưa có lựa chọn/quy tắc, thời gian chuẩn bị âm bị chặn, sửa lỗi không đóng phần nhập, gửi đúng thời gian chuẩn bị/nghỉ.

Browser dùng API được chặn và giả lập, không ghi vào cơ sở dữ liệu thật. Chưa nghiệm thu những API mới với database đang chạy.

Ảnh và kết quả: `report-output/service-simplification-20261014/`. Script chạy lại: `scripts/qa/service-simplification.cjs` trong project web; cần server web tại `http://127.0.0.1:5176`.
