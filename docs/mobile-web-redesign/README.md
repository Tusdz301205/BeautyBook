# BeautyBook mobile web — triển khai và kiểm chứng

Ngày kiểm tra: 27/09/2026. Frontend: `beauty-booking-web-main/beauty-booking-web-main`. Đây là thay đổi giao diện React/Vite; không thay đổi backend, database, policy hoặc app Expo.

## Phạm vi đã sửa

| Khu vực | Thay đổi |
| --- | --- |
| `/book` đến `/book/confirm` | Tiến trình 5 bước vừa màn hình nhỏ; header không che tiến trình; thanh hành động cố định trên điện thoại và chừa safe area; quay lên đầu khi đổi bước. |
| Chọn chi nhánh/dịch vụ | Tên, giá và thời lượng xuống dòng tự nhiên; danh sách lớn có tìm kiếm cục bộ; trạng thái chọn và lý do chưa thể tiếp tục rõ hơn. URL `branchId`/`serviceId` chọn sẵn đúng mục; `staffId` từ trang chuyên viên được áp dụng sau khi khách chọn dịch vụ để không bị store xóa. |
| Chọn chuyên viên | Thẻ một cột trên điện thoại, đủ chỗ cho tên/chuyên môn/đánh giá; tự phân công có mô tả ngắn; lỗi tải có nút thử lại tại chỗ. |
| Chọn ngày giờ | Lưới ngày vừa điện thoại, slot chạm được; khi hết slot có lối đổi chuyên viên. Vẫn giữ giới hạn 7 ngày và kiểm tra từ API hiện tại. |
| Thông tin và xác nhận | Form giữ validation và consent; nút xác nhận luôn tiếp cận được; giá tóm tắt từ preview API. Chỉ chuyển về chọn giờ với thông báo API về thiếu nhân viên trong khung giờ, không đánh đồng mọi lỗi 409. |
| Menu công khai | Vòng focus bằng Tab/Shift+Tab, Escape và trả focus cho nút mở. |
| Trang chi tiết công khai | Tiêu đề dài trên điện thoại xuống dòng giữa các từ, không vỡ giữa chữ; giữ CTA deep link. |
| Explore | Bộ lọc chi tiết hiển thị số điều kiện đang chọn. |
| Giới thiệu doanh nghiệp | Header không che phần mở đầu trên điện thoại; tiêu đề co theo chiều rộng và giữ ảnh minh họa sẵn có. |
| Hộp đổi lịch | Ghép ngày/giờ lịch cũ bằng adapter sẵn có; mở hộp không parse sai chuỗi giờ. Yêu cầu chọn ngày mới trước khi tải slot, tránh tải lại ngày cũ; copy giải thích cơ sở phải chấp nhận yêu cầu. Không thay đổi API gửi yêu cầu. |

Các file giao diện chính: `src/components/customer/BookingLayout.jsx`, `src/components/customer/RescheduleModal.jsx`, `src/pages/Customer/BookingStep1.jsx` đến `BookingStep4.jsx`, `BookingConfirm.jsx`, `src/components/public/PublicChrome.jsx`, `src/pages/Public/PublicHome.jsx`, `src/styles/mobile-booking.css`, `src/styles/mobile-public.css`.

## Skill đã áp dụng

- `skills/SKILL.md` (`uxui-product-design`): thứ tự tác vụ, trạng thái loading/error/empty, hierarchy và form. Các tệp `references/` được nhắc trong skill không tìm thấy trong repository, nên chỉ dùng nội dung đọc được từ SKILL.md.
- `skills/ui-ux-pro-max-skill-main/.../ui-ux-pro-max/SKILL.md`: chạy script tìm pattern mobile booking, form, accessibility, React. Giữ token berry/rose sẵn có thay vì thay palette theo gợi ý mặc định.
- `skills/hallmark-main/skills/hallmark/SKILL.md`: audit/redesign theo bố cục đang có, typography tiếng Việt và responsive; không thay theme cho wizard.
- `skills/web-design-guidelines/SKILL.md`: điều khiển semantic, focus containment, kích thước chạm và phản hồi lỗi.
- `skills/taste-skill/SKILL.md`: chỉ dùng để đánh giá độ tiết chế của Home/Explore, không áp vào các bước đặt lịch.

## Kiểm chứng đã chạy

- `npm test`: 57/57 test frontend qua.
- `npm run build`: qua; build nhắc chưa có `VITE_SITE_URL` production nên không tạo sitemap. Đây là giới hạn cấu hình hiện có, không phải xác nhận SEO.
- `node tests/e2e/mobile-web-redesign.mjs`: Playwright với Chrome hệ thống và API interception. Đi qua chọn chi nhánh → dịch vụ → chuyên viên → ngày → giờ → form/consent → màn xác nhận ở 320×800, 360×800, 390×844, 430×932, 768×1024 và 1440×900. Kiểm tra tên dài, không tràn ngang, không page error, CTA xác nhận bật khi preview/policy hợp lệ; không nhấn tạo lịch. Kiểm tra Home, Explore, đăng nhập/đăng ký chưa xác thực, lịch hẹn trống, ba loại trang chi tiết, menu keyboard và deep link dịch vụ/chuyên viên. Ở 390/1440px còn kiểm tra chi tiết lịch, dịch vụ đã lưu, voucher, đánh giá, thông báo, hồ sơ, quyền riêng tư, bảo mật và trang doanh nghiệp. Ở 390px kiểm tra lỗi số điện thoại, consent chưa chọn, dữ liệu form được giữ, ngày hết slot, lối đổi chuyên viên, mở hộp đổi lịch, chọn ngày/giờ và nhập lý do rồi đóng hộp. Không gửi yêu cầu đổi lịch. Test chuyên viên ban đầu thất bại và đã qua sau khi sửa logic áp dụng `staffId`; hộp đổi lịch ban đầu lỗi parse ngày/giờ và đã mở thành công sau sửa.
- Ảnh sau sửa: `report-output/mobile-web-redesign/booking-staff-390.png`, `booking-confirm-390.png`, `service-detail-390.png`, `branch-detail-390.png`, `staff-detail-390.png`, `home-390.png`, `explore-390.png`, `appointments-390.png`, `appointment-detail-390.png`, `reschedule-390.png`, `login-390.png`, `register-390.png`, `business-390.png`. Cùng mẫu tên có ảnh cho 320, 360, 430, 768 và 1440 ở các route trọng tâm. Ảnh trước sửa có `before-home-390.png`.

## Giới hạn còn lại

Môi trường này không có backend/tài khoản thử tích hợp đang chạy. Test trên dùng fixture API chỉ ở Playwright; chưa xác thực tạo lịch, đổi/hủy lịch, recurring, biến thể/combo, session hết hạn hoặc đồng bộ giữa tài khoản với backend thật. Fixture chi tiết không có ảnh entity nên kết quả `naturalWidth` của ảnh entity chưa được xác nhận; chỉ kiểm tra ảnh nào thực sự xuất hiện trong DOM và không có ảnh hỏng. Chưa kiểm thử bàn phím iOS/Android thật hay toàn bộ route salon/admin. Không có thay đổi nghiệp vụ thanh toán/hoàn tiền.

Demo local: `http://127.0.0.1:5173/` khi dev server còn chạy. Để lặp lại visual QA, khởi chạy frontend trên cổng 5173 rồi chạy script Playwright trên; script không gửi request tạo lịch.
