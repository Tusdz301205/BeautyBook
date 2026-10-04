# BeautyBook mobile web review — 28/09/2026

## Phạm vi và môi trường

Đã đọc `skills/SKILL.md`, rà trạng thái Git, routing, thành phần công khai/đặt lịch, store, API client, ảnh và script kiểm thử. Giữ nguyên các thay đổi chưa commit. Chỉ sửa React frontend; không sửa Expo, backend, dữ liệu hay chính sách đặt lịch. Không dùng Galaxy: lỗi được giải quyết gọn tại component và CSS hiện có.

Backend tại `127.0.0.1:3000` không chạy trong phiên này. Frontend dev chạy tại `http://127.0.0.1:5173/`; Playwright chặn toàn bộ `/api/v1/**` và cung cấp fixture chỉ trong test. Không có lịch hẹn, thanh toán, email hay SMS thật được tạo.

## Lỗi đã xác minh và thay đổi

1. Tại chi tiết cơ sở, nút **Lưu dịch vụ** nằm bên trong thẻ link của cả hàng dịch vụ. Đây là phần tử tương tác lồng nhau, gây hành vi nhấp/bàn phím khó dự đoán. Tách nút thành phần tử cùng cấp với link, giữ kích thước chạm 44px, tên dịch vụ được xuống dòng và trạng thái focus rõ.
2. Kết quả `/explore` có query lọc nhưng các link mở chi tiết không mang thông tin quay lại; nút **Quay lại khám phá** xóa toàn bộ bộ lọc. Các link chi tiết nay chuyển `returnTo` trong router state và BackLink chỉ chấp nhận URL `/explore` nội bộ.
3. Luồng đặt lịch hiển thị từ kỹ thuật “snapshot” cho lựa chọn biến thể/lịch lặp. Thay bằng câu tiếng Việt hướng dẫn hành động. Không đổi điều kiện nghiệp vụ.

Giữ nguyên cấu trúc card, BookingDock, wizard, menu và hệ token hiện có vì kiểm tra viewport không phát hiện lỗi cần thiết kế lại. Bộ cải tiến mobile của lượt trước vẫn được giữ và chạy hồi quy, gồm tên chuyên viên dài, CTA đặt lịch, validation, menu focus, đổi lịch, trang khách hàng.

## Kiểm tra

- `node tests/e2e/mobile-fe-review.mjs`: 15 lượt xem trang Explore có lọc, chi tiết dịch vụ và chi tiết cơ sở ở 360, 390, 430, 768, 1440px. Không tràn ngang, không ảnh hỏng trong fixture, không có nút lồng link, bộ lọc được giữ, nút Lưu chuyển tới đăng nhập khi chưa có phiên.
- `node tests/e2e/mobile-web-redesign.mjs`: hồi quy 320, 360, 390, 430, 768, 1440px cho đặt lịch tới bước xác nhận, trang công khai và khu vực khách hàng; không nhấn nút tạo lịch. Bao gồm kiểm tra tên dài, deep link dịch vụ/chuyên viên, thời gian trống, validation, menu focus và biểu mẫu đổi lịch. Pass.
- `npm test`: 57/57 pass. `npm run build`: pass. Build báo chưa tạo sitemap vì không có `VITE_SITE_URL` production hợp lệ trong môi trường hiện tại; không đặt domain giả.
- Đã xem ảnh chụp Explore và chi tiết cơ sở 390px. Tên dài xuống dòng và nút hành động đọc được. Fixture `qa-service` không có ảnh entity đã map nên placeholder minh họa xuất hiện; điều này không đại diện cho dữ liệu production.

Ảnh sau sửa: `report-output/mobile-fe-review/explore-filtered-390.png`, `service-detail-390.png`, `branch-detail-390.png`, cùng biến thể 360/430/768/1440px. Kết quả máy đọc: `report-output/mobile-fe-review/results.json`. Bộ ảnh hồi quy rộng hơn: `report-output/mobile-web-redesign/`.

## Giới hạn và việc tiếp theo

Không có backend/test account cô lập nên chưa xác minh API thực, slot conflict và kết quả tạo lịch PENDING/CONFIRMED, đồng bộ giữa tài khoản, hủy/hoàn tiền, ảnh thật từng entity hoặc thao tác bàn phím trên thiết bị vật lý. Chưa có ảnh “trước” riêng của lượt review này; các ảnh trên là sau sửa. Không coi fixture là bằng chứng nghiệp vụ production.

Năm hướng cải thiện tác động cao được ưu tiên theo bằng chứng hiện có: (1) giữ bộ lọc khi quay lại — đã sửa; (2) tách nút lưu khỏi link — đã sửa; (3) bỏ thuật ngữ kỹ thuật trong booking — đã sửa; (4) QA end-to-end với backend staging cô lập — còn cần môi trường; (5) kiểm thử bàn phím và ảnh thực trên thiết bị thật — còn cần môi trường.
