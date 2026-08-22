# PHÂN HỆ 2: WEB PORTAL — DÀNH CHO CƠ SỞ LÀM ĐẸP
### 7 module — UR-B-001 → UR-B-061

> Ghi chú đối chiếu: các phát hiện có tiền tố "*(Đối chiếu GlowBook.jsx)*" nghĩa là quan sát được xác nhận trực tiếp trong bản mock giao diện đã upload, không chỉ suy luận từ URD.

---

## MODULE W1: Đăng ký & Quản lý Cơ sở (Business Registration)
**UR liên quan**: UR-B-001 → UR-B-002
**Phạm vi theo URD**: Đăng ký tài khoản kinh doanh (chờ duyệt → Admin phê duyệt → hoạt động), cập nhật thông tin cơ sở (địa chỉ, vị trí bản đồ, ngày nghỉ/lịch đặc biệt).

### 1. Business cases
- Chủ cơ sở đăng ký: tên/loại hình (Salon/Spa/TMV/Nail)/địa chỉ/SĐT/email/giấy phép kinh doanh, upload logo/ảnh bìa/ảnh không gian, mô tả, trạng thái Chờ duyệt (UR-B-001).
- Admin phê duyệt → cơ sở chuyển trạng thái Hoạt động, nhận email "Tài khoản đã được kích hoạt" (theo sequence diagram §5.2).
- Chủ cơ sở cập nhật tên/địa chỉ/SĐT/giờ hoạt động/mô tả/ảnh, cập nhật vị trí bản đồ (lat/long), quản lý ngày nghỉ/lịch hoạt động đặc biệt (UR-B-002).

### 2. Edge cases
- Cơ sở nộp hồ sơ đăng ký nhưng **giấy phép kinh doanh giả/đã hết hạn** — URD chỉ nói Admin "xem hồ sơ đăng ký" (UR-A-011②) mà không có bước xác minh chéo với cơ quan cấp phép nào; toàn bộ việc duyệt chỉ dựa vào xem-bằng-mắt của Admin.
- Cơ sở nộp lại hồ sơ sau khi bị từ chối — có được đăng ký lại bằng đúng SĐT/email cũ không, hay phải tạo hồ sơ hoàn toàn mới? URD không nói rõ số lần được nộp lại.
- Cơ sở cập nhật vị trí bản đồ (lat/long) sang tọa độ không hợp lệ (ngoài lãnh thổ VN, hoặc giữa biển) — không thấy validate phạm vi tọa độ hợp lệ.
- Cơ sở khai địa chỉ theo đơn vị **quận/huyện đã không còn tồn tại về mặt hành chính** từ 01/07/2025 (→ 0.4.D) — trường `address` (string tự do trên BUSINESS) có thể vẫn nhận được, nhưng nếu hệ thống có bước chọn quận/huyện từ danh mục (liên hệ Category Management A5) thì danh mục đó đã lỗi thời.
- Cơ sở đang "Hoạt động" đột ngột đổi loại hình kinh doanh (VD: từ Nail sang thêm cả Spa) — có cần duyệt lại từ Admin không, hay tự do đổi `type` mà không qua kiểm duyệt?
- "Quản lý ngày nghỉ/lịch hoạt động đặc biệt" (UR-B-002③) — nhắc lại lỗ hổng đã nêu ở Module 4 (Mobile): BUSINESS entity không có trường lưu dữ liệu này (→ 0.4.B).

### 3. Exception cases
- Upload giấy phép kinh doanh/logo/ảnh bìa lỗi giữa lúc nộp hồ sơ — cho lưu draft để hoàn thiện sau, hay phải nộp lại từ đầu?
- Email/SMS thông báo kết quả duyệt (theo sequence diagram §5.2) gửi thất bại — cơ sở không biết được duyệt hay từ chối, chỉ biết khi tự đăng nhập kiểm tra trạng thái.
- Database lỗi giữa lúc Admin bấm "Phê duyệt" — trạng thái có thể bị "kẹt" giữa Chờ duyệt và Hoạt động.

### 4. Validation cases còn thiếu
- Định dạng SĐT/email cơ sở (giống Module Authentication phía khách).
- Số giấy phép kinh doanh: định dạng, có bị trùng với cơ sở khác đã đăng ký (2 cơ sở dùng chung 1 giấy phép — công ty có nhiều chi nhánh) không?
- Địa chỉ: bắt buộc phải chọn đúng từ danh mục hành chính, hay cho nhập tự do (dễ sai lệch dữ liệu địa lý)?
- Tên cơ sở: giới hạn độ dài, trùng tên với cơ sở khác có được phép không?

### 5. Business Rule còn thiếu
- Một chủ (1 SĐT/email) được đăng ký bao nhiêu cơ sở? *Thiếu đặc tả (→ 0.4.J).*
- Hồ sơ bị từ chối được nộp lại tối đa mấy lần? *Thiếu đặc tả.*
- Đổi loại hình kinh doanh sau khi đã hoạt động có cần duyệt lại không? *Thiếu đặc tả.*
- Cơ sở có thể tự "tạm ngưng hoạt động" (khác với bị Admin khóa) trong 1 khoảng thời gian (VD: sửa chữa mặt bằng) không? *Thiếu đặc tả — nếu không có, cơ sở tạm ngưng vẫn hiện trên app và nhận booking mới.*

### 6. Permission Cases
- Cơ sở B sửa thông tin cơ sở A qua gọi API trực tiếp với `business_id` không thuộc quyền sở hữu.
- Tài khoản cơ sở đang ở trạng thái "Chờ duyệt" có đăng nhập được vào Web Portal để chuẩn bị dữ liệu trước (thêm dịch vụ/nhân viên) hay bị chặn hoàn toàn cho tới khi duyệt xong?

### 7. Concurrency Cases
- Hai Admin cùng xem và duyệt/từ chối cùng 1 hồ sơ cơ sở gần như đồng thời (ví dụ gốc trong yêu cầu: "Hai admin duyệt cùng salon") — nếu không có lock, có thể ghi đè trạng thái lẫn nhau hoặc gửi 2 email kết quả khác nhau cho cùng 1 cơ sở.
- Cơ sở đang tự sửa thông tin đúng lúc Admin đang xem hồ sơ để duyệt (dữ liệu Admin nhìn thấy có phải bản mới nhất không).

### 8. Data Integrity
- Không có trường lưu "ngày nghỉ/lịch hoạt động đặc biệt" trên BUSINESS (đã nêu ở Edge case).
- Không rõ khi cơ sở bị Admin "Xóa" (UR-A-010① liệt kê hành động Xóa, khác Khóa) thì toàn bộ SERVICE/STAFF/BOOKING/REVIEW liên quan xử lý ra sao — xóa cứng theo tầng (cascade delete) sẽ mất lịch sử booking/review của khách; giữ lại (soft-delete) thì cần cột `deleted_at`/`status` phù hợp mà §6.2 không thấy đề cập rõ cho toàn bộ các entity liên quan.

### 9. Security Risks
- Giấy phép kinh doanh/CCCD (nếu có) là dữ liệu nhạy cảm — cần mã hóa lưu trữ và giới hạn quyền xem chỉ Admin, không thấy đề cập riêng (khác với mã hóa mật khẩu NFR-011 áp dụng cho USER).
- Giả mạo hồ sơ đăng ký (ảnh giấy phép chỉnh sửa/lấy từ nguồn khác) — không có bước xác minh tự động (OCR đối chiếu, tra cứu mã số thuế) nào được đề cập.

### 10. Performance Risks
- Không đáng kể ở mức tải — quy mô đăng ký cơ sở mới không lớn so với lưu lượng Booking.

### 11. UI/UX Traps
- Form đăng ký dài (nhiều trường + nhiều ảnh) không có lưu draft — mất mạng/refresh giữa lúc điền phải làm lại từ đầu.
- Cập nhật vị trí trên bản đồ (kéo pin) dễ thao tác nhầm lệch vài trăm mét mà không có bước xác nhận lại địa chỉ text tương ứng.

### 12. Tester Checklist
☐ Đăng ký hồ sơ đầy đủ hợp lệ → trạng thái Chờ duyệt
☐ Admin duyệt → cơ sở chuyển Hoạt động, nhận email/SMS
☐ Admin từ chối kèm lý do → cơ sở nhận thông báo lý do
☐ Đăng ký thiếu trường bắt buộc
☐ Đăng ký với giấy phép kinh doanh trùng cơ sở khác
☐ Cập nhật thông tin cơ sở: địa chỉ/giờ hoạt động/mô tả/ảnh
☐ Cập nhật vị trí bản đồ ra ngoài lãnh thổ hợp lệ
☐ Khai báo ngày nghỉ/lịch hoạt động đặc biệt — kiểm tra có được lưu và phản ánh đúng ở Mobile App không
☐ Hai Admin duyệt/từ chối cùng lúc 1 hồ sơ
☐ Sửa thông tin cơ sở khác qua gọi API trực tiếp

### 13. Giảng viên có thể hỏi gì?
- Hệ thống xác minh giấy phép kinh doanh thật/giả bằng cách nào, hay hoàn toàn dựa vào Admin xem bằng mắt?
- Nếu 2 Admin duyệt cùng lúc 1 hồ sơ, kết quả cuối cùng là gì?
- "Ngày nghỉ/lịch hoạt động đặc biệt" được lưu ở đâu trong data model, và Mobile App đọc dữ liệu này từ đâu để cảnh báo khách?
- Một cá nhân có thể đứng tên bao nhiêu cơ sở trên hệ thống?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟠 High — là cổng vào của toàn bộ dữ liệu Cơ sở; lỗi duyệt sai/thiếu xác minh ảnh hưởng uy tín toàn nền tảng.

---

## MODULE W2: Quản lý Dịch vụ & Giá (Service Management)
**UR liên quan**: UR-B-010 → UR-B-012
**Phạm vi theo URD**: CRUD dịch vụ (ảnh, trạng thái hiển thị/ẩn/ngưng), bảng giá (giá gốc/phân loại/khoảng giá), combo dịch vụ.

### 1. Business cases
- CRUD dịch vụ: tên/nhóm/mô tả/thời gian ước tính, upload ≤10 ảnh/dịch vụ, đặt trạng thái Hiển thị/Ẩn/Ngưng hoạt động, thay đổi phản ánh realtime trên app (UR-B-010).
- Quản lý giá: giá gốc, giá theo phân loại (tóc ngắn/dài, nam/nữ), khoảng giá (từ-đến), cập nhật tức thì (UR-B-011).
- Tạo combo: chọn nhiều dịch vụ, đặt giá combo thấp hơn tổng lẻ, tự tính thời gian tổng, hiển thị tag "COMBO" (UR-B-012).

### 2. Edge cases
- *(Đối chiếu GlowBook.jsx)* Trong `ServiceModal`, trường **"Khuyến mãi (%)"** là `<input type="number">` không có `min`/`max` — có thể nhập giá trị âm hoặc lớn hơn 100%. Đây đúng là ví dụ "Giảm giá >100%" mà đề bài gốc liệt kê như một validation case điển hình, và ở đây nó không chỉ là giả định lý thuyết mà **đã tồn tại thật trong bản mock đã upload**.
- Xóa 1 dịch vụ **đang có booking tương lai chưa hoàn thành** (ví dụ gốc trong yêu cầu: "Salon xóa service đang có booking") — UR-B-010 chỉ nói "CRUD dịch vụ" chung, không phân biệt Xóa cứng (hard delete) và Ẩn (soft — đã có trạng thái "Ngưng hoạt động" riêng, gợi ý rằng có Ẩn/Ngưng là đủ, nhưng nút Xóa trong bản mock jsx (`Trash2` icon, hàm `remove()`) xóa thẳng khỏi state, không phân biệt đang có booking hay không) — nếu Xóa cứng thực sự xóa khỏi DB, các Booking/BOOKING_ITEM tham chiếu `service_id` đó sẽ mất ngữ cảnh hiển thị (tên dịch vụ) vĩnh viễn.
- Đổi giá dịch vụ đang được 1 khách khác xem/đặt cùng lúc (→ 0.4.G, đã nêu ở Module Booking).
- Combo có giá **cao hơn** tổng giá lẻ do chủ cơ sở nhập nhầm — UR-B-012② chỉ mô tả kỳ vọng ("thấp hơn tổng giá lẻ") nhưng không có validate cưỡng chế giá combo phải nhỏ hơn tổng.
- Dịch vụ đang ở trạng thái "Ẩn" nhưng đã có trong 1 combo "Hiển thị" — combo có tự ẩn theo, hay vẫn hiển thị với 1 dịch vụ con không tồn tại?
- Giá theo phân loại (tóc ngắn/dài, nam/nữ — UR-B-011②) là ví dụ minh họa, nhưng schema SERVICE chỉ có 1 cặp `price_from`/`price_to` — không có cấu trúc lưu nhiều mức giá theo phân loại; đây là **mâu thuẫn cụ thể giữa Acceptance Criteria và Data Model**, tương tự lỗ hổng combo/staff đã nêu ở Module Booking.

### 3. Exception cases
- Upload ảnh dịch vụ (≤10 ảnh) lỗi giữa chừng — lưu được bao nhiêu ảnh đã tải xong hay hủy toàn bộ?
- Thay đổi giá "phản ánh realtime trên app" (UR-B-010④) nhưng kênh đồng bộ (WebSocket/cache invalidation) lỗi — khách vẫn thấy giá cũ trên app đã cache trong khi Web Portal đã hiển thị giá mới.

### 4. Validation cases còn thiếu
- `duration_minutes` = 0 hoặc âm (ví dụ gốc trong yêu cầu: "Thời lượng =0").
- `price_from` > `price_to`.
- Giá âm.
- Giảm giá >100% *(đã xác nhận là bug thật trong GlowBook.jsx, xem Edge case).*
- Số ảnh minh họa >10.
- Tên dịch vụ trùng lặp trong cùng 1 cơ sở.

### 5. Business Rule còn thiếu
- Xóa dịch vụ đang có booking tương lai: chặn xóa, hay cho xóa nhưng giữ nguyên các booking cũ (soft-delete)? *Cần bổ sung — nghiêm trọng.*
- Giá combo có bị cưỡng chế phải nhỏ hơn tổng giá lẻ không, hay chỉ là gợi ý UX? *Cần bổ sung.*
- Giá theo phân loại (nam/nữ, tóc ngắn/dài) được mô hình hóa dữ liệu như thế nào khi SERVICE chỉ có 1 khoảng giá? *Cần bổ sung — mâu thuẫn Data Model.*
- Đổi giá có áp dụng ngay cho các booking "Chờ xác nhận" đã tồn tại trước đó không (→ 0.4.G)? *Cần bổ sung.*

### 6. Permission Cases
- Cơ sở B sửa/xóa dịch vụ của cơ sở A qua gọi API trực tiếp với `service_id` không thuộc quyền sở hữu.
- Theo Permission Matrix, Admin chỉ "✅ (xem)" với "Quản lý dịch vụ & giá" — Admin **không có quyền chỉnh sửa/ẩn trực tiếp** một dịch vụ có nội dung vi phạm (VD: dịch vụ thẩm mỹ quảng cáo sai sự thật, giá ảo câu khách) — Admin phải làm gì trong trường hợp này nếu không có quyền sửa/ẩn?

### 7. Concurrency Cases
- Hai nhân viên vận hành của cùng 1 cơ sở (nếu Web Portal cho nhiều người dùng quản lý — liên hệ 0.4.J) sửa cùng 1 dịch vụ cùng lúc — ai thắng, có cảnh báo "dữ liệu đã bị người khác cập nhật" (optimistic locking) không?
- Chủ cơ sở xóa dịch vụ đúng lúc khách đang hoàn tất bước cuối của luồng đặt lịch chọn đúng dịch vụ đó (liên hệ trực tiếp Module Booking, mục 2 và mục 7).

### 8. Data Integrity
- Đã nêu: giá theo phân loại không có chỗ lưu trong schema SERVICE; combo (BOOKING_ITEM) không rõ cấu trúc lưu (→ 0.4.B).
- `promo_price` trên SERVICE là 1 trường tĩnh — không có `promo_start_date`/`promo_end_date` riêng (khác với PROMOTION ở module W3 có "thời hạn bắt đầu-kết thúc") — 2 khái niệm khuyến mãi (giá KM trên Service vs Promotion/Voucher) chồng lấn nhưng không rule nào nói rõ quan hệ giữa chúng (đã nêu ở Module 4 Mobile).

### 9. Security Risks
- Chủ cơ sở chèn nội dung độc hại (XSS) vào mô tả dịch vụ nếu không sanitize khi hiển thị trên app khách.
- Business tự thao túng giá để lách phí hoa hồng (nếu về sau hệ thống có tính phí theo % giao dịch) — hiện Phase 1 chưa có nên chưa phát sinh, nhưng nên lưu ý cho roadmap.

### 10. Performance Risks
- "Thay đổi phản ánh realtime" (UR-B-010④, NFR-005 ≤2s) cho hàng nghìn cơ sở cùng cập nhật giờ cao điểm — cần cơ chế invalidate cache/push update hiệu quả, không thấy đề cập kiến trúc cụ thể (cache layer, CDC — Change Data Capture, hay polling định kỳ từ app).

### 11. UI/UX Traps
- *(Đối chiếu GlowBook.jsx)* Modal thêm/sửa dịch vụ không có validate phía client trước khi bấm "Lưu dịch vụ" — dễ lưu dữ liệu rác (giá 0, tên rỗng) nếu người dùng bấm nhanh.
- Danh sách dịch vụ dạng thẻ (card) khi có nhiều dịch vụ (>20) không thấy phân trang/tìm kiếm trong mô tả UR-B-010 — dễ khó quản lý với cơ sở lớn.

### 12. Tester Checklist
☐ Thêm dịch vụ hợp lệ, hiển thị ngay trên app
☐ Sửa giá dịch vụ, kiểm tra đồng bộ realtime tới app khách
☐ Xóa dịch vụ chưa có booking nào
☐ Xóa dịch vụ đang có booking tương lai (kỳ vọng chặn hoặc xử lý rõ ràng)
☐ Nhập giá âm / duration=0 / giảm giá >100%
☐ Tạo combo có giá cao hơn tổng giá lẻ
☐ Ẩn 1 dịch vụ đang thuộc 1 combo đang hiển thị
☐ Upload >10 ảnh cho 1 dịch vụ
☐ Đặt trạng thái Hiển thị/Ẩn/Ngưng hoạt động, kiểm tra tác động lên app khách và lên khả năng đặt lịch
☐ Sửa dịch vụ của cơ sở khác qua gọi API trực tiếp

### 13. Giảng viên có thể hỏi gì?
- Nếu một dịch vụ bị xóa khi đang có 5 booking tương lai sử dụng dịch vụ đó, hệ thống xử lý 5 booking đó ra sao?
- "Giá theo phân loại" (nam/nữ, tóc ngắn/dài) được lưu ở đâu trong database khi SERVICE chỉ có 1 khoảng giá?
- Giá khuyến mãi trên Service (`promo_price`) và mã khuyến mãi ở module Promotion khác nhau ở điểm nào, và nếu áp dụng cùng lúc thì tính thế nào?
- Vì sao trường giảm giá trong form không có giới hạn 0–100%?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟠 High — dữ liệu ở đây là nguồn của mọi phép tính tiền trong Booking; lỗi validate giá/giảm giá lan thẳng ra trải nghiệm đặt lịch và doanh thu.

---

## MODULE W3: Quản lý Khuyến mãi (Promotion Management)
**UR liên quan**: UR-B-020
**Phạm vi theo URD**: Tạo chương trình khuyến mãi (giảm %/tiền/tặng dịch vụ/mua X tặng Y), thời hạn, điều kiện áp dụng, mã voucher tự động/tùy chỉnh.

### 1. Business cases
- Chủ cơ sở tạo khuyến mãi: chọn loại (giảm %/giảm tiền/tặng dịch vụ/mua X tặng Y), đặt thời hạn bắt đầu-kết thúc, điều kiện (dịch vụ áp dụng/đơn tối thiểu/giới hạn lượt dùng), tạo mã voucher tự động hoặc tùy chỉnh, hiển thị trên app (UR-B-020).

### 2. Edge cases
- Voucher hết hạn **đúng lúc** khách đang ở bước thanh toán (ví dụ gốc trong yêu cầu) — giờ hết hạn tính theo giờ server hay giờ tạo mã, và có buffer nào không?
- Loại khuyến mãi "Mua X tặng Y" — X và Y có phải cùng 1 dịch vụ không, hay khác dịch vụ? Nếu khác dịch vụ, Y có bắt buộc cùng 1 cơ sở/cùng nhóm giá trị tương đương không? URD chỉ nêu tên loại KM mà không có acceptance criteria chi tiết cho riêng loại phức tạp này.
- "Giới hạn số lượt sử dụng" (UR-B-020③) — giới hạn theo tổng lượt toàn hệ thống, hay giới hạn theo từng khách (1 khách chỉ dùng 1 lần)? Không phân biệt 2 loại giới hạn này (ví dụ gốc: "Voucher dùng nhiều lần được không?").
- Khuyến mãi áp dụng cho "dịch vụ áp dụng" cụ thể nhưng dịch vụ đó sau bị xóa/ẩn — voucher liên quan có tự vô hiệu không (liên hệ Data Integrity ví dụ gốc: "Voucher bị xóa nhưng booking đang dùng" — ở đây là chiều ngược: Service bị xóa nhưng Voucher đang trỏ tới).
- Mã voucher tùy chỉnh (chủ cơ sở tự đặt tên mã) trùng với mã của cơ sở khác — mã voucher có unique toàn hệ thống hay chỉ unique trong phạm vi 1 cơ sở? Nếu unique toàn hệ thống, cơ sở nhỏ đăng ký sau dễ bị "hết mã đẹp".
- Khuyến mãi có "đơn hàng tối thiểu" nhưng hệ thống Phase 1 chưa có thanh toán online để biết chính xác "đơn hàng" là gì trước khi khách trả tiền tại cơ sở (liên hệ 0.4.A) — "đơn tối thiểu" tính trên tổng giá dự kiến của Booking hay trên số tiền thực trả (mà hệ thống không theo dõi được vì trả tại chỗ)?

### 3. Exception cases
- Tạo khuyến mãi với ngày kết thúc trước ngày bắt đầu.
- Sinh mã voucher tự động bị trùng (race condition sinh mã ngẫu nhiên) khi nhiều cơ sở tạo voucher cùng lúc.

### 4. Validation cases còn thiếu
- Giảm % ngoài khoảng 0–100 (nhắc lại, đã xác nhận bug thật ở Module W2 nhưng logic này áp dụng tương tự cho Promotion nếu loại KM là "Giảm %").
- Số tiền giảm ("Giảm số tiền") lớn hơn giá dịch vụ áp dụng — có thể khiến giá cuối âm nếu không chặn.
- Giới hạn số lượt sử dụng: giá trị 0 hoặc âm.
- Độ dài/ký tự hợp lệ cho mã voucher tùy chỉnh.

### 5. Business Rule còn thiếu
- Voucher dùng được nhiều lần trên 1 tài khoản không, hay chỉ 1 lần/user/toàn thời hạn? *(Câu hỏi gốc trong yêu cầu — xác nhận: URD chưa trả lời.)*
- 1 Booking được áp tối đa mấy voucher (ER diagram ngụ ý tối đa 1 nhưng FR không phát biểu rõ, → đã nêu ở Module Booking mục 5)? *Cần bổ sung.*
- Khuyến mãi "Tặng dịch vụ"/"Mua X tặng Y" tương tác thế nào với luồng đặt lịch — dịch vụ tặng có tự thêm vào combo booking không, ai chọn nhân viên/giờ cho dịch vụ được tặng? *Thiếu đặc tả nghiêm trọng vì đụng trực tiếp luồng core Booking.*
- Voucher có được rút lại/hủy giữa thời hạn bởi chủ cơ sở không? Nếu khách đã lưu vào "Voucher của tôi" nhưng cơ sở hủy giữa đường, khách có được báo trước không? *Thiếu đặc tả.*

### 6. Permission Cases
- Cơ sở B tạo/sửa voucher gán nhầm cho cơ sở A (nếu API không kiểm tra `business_id` khi tạo).
- Theo Permission Matrix, Admin chỉ "✅ (xem)" khuyến mãi — Admin không có quyền gỡ 1 chương trình khuyến mãi lừa đảo/sai sự thật (VD: quảng cáo giảm 90% nhưng đk áp dụng gây hiểu lầm) mà chỉ có thể xem.

### 7. Concurrency Cases
- Nhiều khách cùng dùng 1 voucher có giới hạn lượt (VD: giới hạn 100 lượt) khi số lượt còn lại chỉ còn 1 — race condition đọc-kiểm tra-trừ lượt cần transaction/lock đúng, nếu không có thể vượt quá giới hạn đã đặt (ví dụ gốc trong yêu cầu, dạng "overselling" áp dụng cho voucher).
- Chủ cơ sở sửa điều kiện voucher (VD: thu hẹp phạm vi dịch vụ áp dụng) đúng lúc khách đang áp mã đó ở bước checkout.

### 8. Data Integrity
- PROMOTION không có attribute nào định nghĩa (→ 0.4.B) — không rõ có trường đếm `used_count` để đối chiếu với giới hạn lượt dùng, không rõ có `per_user_limit` riêng biệt với `total_limit`.
- Không rõ khi Booking dùng voucher rồi bị hủy, lượt dùng của voucher đó có được "trả lại" (rollback) hay bị trừ vĩnh viễn — ảnh hưởng trực tiếp tới các khách khác đang chờ dùng voucher có giới hạn lượt.

### 9. Security Risks
- Brute-force mã voucher ngắn/dễ đoán (nếu mã tự động sinh theo pattern dự đoán được, VD: tăng dần số thứ tự) để dò mã hợp lệ của người khác.
- Business tạo khuyến mãi ảo (giảm giá trên giá đã bị nâng khống trước đó) để tạo cảm giác giảm sâu — thuộc phạm trù gian lận thương mại, Admin chỉ xem chứ không kiểm duyệt nội dung khuyến mãi trước khi hiển thị công khai trên app (khác với Review có kiểm duyệt).

### 10. Performance Risks
- Kiểm tra điều kiện voucher (hạn dùng + điều kiện áp dụng + số lượt còn lại) diễn ra ngay trong luồng tạo Booking (UR-C-046②) — nếu không tối ưu, đây là 1 điểm cộng thêm latency vào bước vốn đã nặng nhất của hệ thống (đặt lịch).

### 11. UI/UX Traps
- Tạo khuyến mãi nhiều điều kiện phức tạp (loại KM + thời hạn + điều kiện áp dụng + giới hạn lượt) trong 1 form dài, dễ bấm Lưu khi chưa điền đủ điều kiện logic (VD: chọn "Mua X tặng Y" nhưng quên chọn dịch vụ Y).

### 12. Tester Checklist
☐ Tạo khuyến mãi từng loại: Giảm %/Giảm tiền/Tặng dịch vụ/Mua X tặng Y
☐ Đặt ngày kết thúc trước ngày bắt đầu
☐ Áp voucher hợp lệ vào booking, kiểm tra số tiền giảm đúng
☐ Áp voucher hết hạn / chưa tới ngày bắt đầu
☐ Áp voucher khi đã đạt giới hạn lượt dùng (tổng và theo từng user)
☐ Áp 2 voucher cùng lúc cho 1 booking (kỳ vọng bị chặn nếu rule là tối đa 1)
☐ Hủy booking đã dùng voucher có giới hạn lượt — kiểm tra lượt có được trả lại
☐ Nhiều khách cùng dùng voucher khi chỉ còn 1 lượt (test đồng thời)
☐ Xóa dịch vụ đang được gán trong 1 chương trình khuyến mãi đang chạy
☐ Mã voucher tùy chỉnh trùng với mã cơ sở khác

### 13. Giảng viên có thể hỏi gì?
- Nếu voucher chỉ còn 1 lượt và 2 khách cùng bấm áp dụng trong tích tắc, ai được dùng?
- Một booking có được áp nhiều voucher cùng lúc không? Vì sao?
- Khuyến mãi "Mua X tặng Y" tương tác với luồng đặt lịch (chọn giờ, chọn nhân viên cho dịch vụ được tặng) như thế nào?
- Nếu booking dùng voucher bị hủy, lượt dùng của voucher đó xử lý ra sao?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟠 High — lỗi ở đây trực tiếp gây thất thoát doanh thu (overselling voucher, giảm giá âm) hoặc tranh chấp tiền bạc với khách.
---

## MODULE W4: Quản lý Nhân viên/Thợ (Staff Management)
**UR liên quan**: UR-B-030 → UR-B-031
**Phạm vi theo URD**: CRUD nhân viên (thông tin, chuyên môn, portfolio, trạng thái làm việc), quản lý lịch làm việc (ca, ngày nghỉ, calendar, kéo-thả).

### 1. Business cases
- CRUD nhân viên: tên/ảnh/SĐT/chức vụ/kinh nghiệm/chuyên môn, gán dịch vụ có thể thực hiện, upload portfolio, đặt trạng thái Đang làm việc/Nghỉ phép/Nghỉ việc (UR-B-030).
- Thiết lập ca làm việc (giờ bắt đầu-kết thúc, ngày nghỉ), xem lịch dạng calendar tuần/tháng, đánh dấu slot đã đặt/trống, kéo-thả điều chỉnh lịch (UR-B-031).

### 2. Edge cases
- Nhân viên nghỉ đột xuất (ốm, việc gia đình) **sau khi** đã có khách đặt lịch với nhân viên đó cho ngày sắp tới (ví dụ gốc trong yêu cầu) — chủ cơ sở đổi trạng thái sang "Nghỉ phép", nhưng URD không mô tả bước tiếp theo: các booking đã có với nhân viên đó có tự động được đề xuất đổi nhân viên khác/đổi lịch, hay chủ cơ sở phải tự xử lý tay từng booking một? Đây là một trong những gap nghiêm trọng nhất về trải nghiệm thực tế.
- Nhân viên "Nghỉ việc" (khác Nghỉ phép — nghỉ việc là vĩnh viễn) nhưng vẫn còn review/portfolio/lịch sử booking gắn với `staff_id` đó (ví dụ gốc trong yêu cầu: "Staff nghỉ việc nhưng còn lịch") — dữ liệu lịch sử có giữ nguyên (đúng, nên giữ để không mất lịch sử) nhưng nhân viên đó có bị ẩn hoàn toàn khỏi danh sách chọn khi đặt lịch mới không? UR-B-030④ chỉ nói "đặt trạng thái" mà không nói rõ hệ quả từng trạng thái lên các module khác.
- Kéo-thả điều chỉnh lịch làm việc (UR-B-031④) của nhân viên **sau khi** khách đã đặt lịch dựa trên ca làm việc cũ — kéo-thả có kiểm tra xung đột với booking đã tồn tại trước khi cho phép đổi không, hay cho đổi tự do rồi để lại booking "treo" ngoài giờ làm mới?
- Gán 1 nhân viên có thể thực hiện dịch vụ (UR-B-030②) nhưng nhân viên đó chưa từng có ca làm việc nào được thiết lập (UR-B-031①) — khách có thấy nhân viên này xuất hiện trong danh sách chọn khi đặt lịch không, và "lịch trống" của họ hiển thị ra sao khi hoàn toàn chưa có ca?
- Cùng 1 người vừa là nhân viên của cơ sở A, cũng đi làm thêm cho cơ sở B (thợ tự do/freelance phổ biến trong ngành làm đẹp) — STAFF không có attribute nào được định nghĩa (→ 0.4.B) nên không rõ 1 STAFF record có gắn cứng 1-1 với `business_id` hay có thể multi-business; nếu gắn cứng, hệ thống buộc phải tạo 2 hồ sơ nhân viên trùng thông tin cho cùng 1 người thật ở 2 cơ sở.

### 3. Exception cases
- Upload ảnh/portfolio nhân viên lỗi.
- Đổi trạng thái nhân viên đúng lúc có booking đang ở bước cuối cùng chọn giờ với chính nhân viên đó (race condition, liên hệ mục 7).

### 4. Validation cases còn thiếu
- SĐT nhân viên: định dạng, có bắt buộc unique trong hệ thống không (2 nhân viên khác nhau dùng chung SĐT liên hệ)?
- Giới hạn số dịch vụ tối đa 1 nhân viên có thể được gán.
- Ca làm việc: giờ bắt đầu phải trước giờ kết thúc; ca có được qua đêm không (VD: 22h-2h sáng)?

### 5. Business Rule còn thiếu
- Khi nhân viên chuyển "Nghỉ phép"/"Nghỉ việc", các booking tương lai đã gán nhân viên đó được xử lý tự động ra sao (thông báo khách, gợi ý đổi nhân viên, hủy tự động)? *Cần bổ sung — nghiêm trọng, đây chính là ví dụ "Nhân viên nghỉ đột xuất" trong đề bài gốc.*
- 1 nhân viên có thể gắn với nhiều cơ sở không (thợ tự do)? *Thiếu đặc tả.*
- Nhân viên có tài khoản đăng nhập riêng để tự xem/cập nhật lịch của mình không, hay 100% qua chủ cơ sở (→ 0.4.J)? *Thiếu đặc tả — ảnh hưởng quy trình vận hành thực tế khi cơ sở có nhiều nhân viên.*
- Giới hạn tối thiểu/tối đa số giờ làm việc/ngày theo luật lao động (tham khảo) — không bắt buộc hệ thống phải kiểm tra, nhưng nên được ghi "không nằm trong phạm vi hệ thống" một cách rõ ràng thay vì im lặng.

### 6. Permission Cases
- Cơ sở B xem/sửa hồ sơ nhân viên của cơ sở A qua gọi API trực tiếp.
- Nếu nhân viên có tài khoản riêng (giả định), nhân viên đó có xem được thông tin lương/doanh thu cơ sở không, hay chỉ xem lịch của chính mình? *Không áp dụng được vì URD chưa xác nhận nhân viên có tài khoản — chính là điều cần hỏi rõ.*

### 7. Concurrency Cases
- Hai người vận hành Web Portal của cùng 1 cơ sở sửa cùng lúc hồ sơ 1 nhân viên (ví dụ gốc trong yêu cầu: "Hai nhân viên sửa cùng hồ sơ" — ở đây hiểu là 2 người phía cơ sở cùng sửa 1 hồ sơ nhân viên).
- Chủ cơ sở kéo-thả đổi ca làm việc đúng lúc khách đang xem "lịch trống của nhân viên đó" ở Mobile App (Module Booking, UR-C-043③) — khách thấy slot trống nhưng ca đã bị đổi ngay sau đó, dẫn tới đặt lịch vào giờ nhân viên không còn làm.

### 8. Data Integrity
- STAFF và SCHEDULE không có attribute nào (→ 0.4.B) — đây là 2 thực thể nền tảng nhất của module này mà lại hoàn toàn thiếu đặc tả dữ liệu, ảnh hưởng trực tiếp tới tính đúng của "khung giờ trống" ở Module Booking.
- Không rõ trạng thái nhân viên (Đang làm việc/Nghỉ phép/Nghỉ việc) có mốc thời gian (từ ngày–đến ngày, đặc biệt với "Nghỉ phép" là tạm thời) hay chỉ là 1 giá trị tĩnh phải đổi tay 2 lần (đổi sang Nghỉ phép, rồi đổi lại Đang làm việc khi hết nghỉ) — nếu chủ cơ sở quên đổi lại, nhân viên "kẹt" ở trạng thái Nghỉ phép vô thời hạn.

### 9. Security Risks
- Thông tin cá nhân nhân viên (SĐT, ảnh) do chủ cơ sở nhập — nhân viên có được thông báo/đồng ý việc thông tin của mình được hiển thị công khai trên app (ảnh, tên, đánh giá) không? Liên quan quyền dữ liệu cá nhân của bên thứ ba (nhân viên) mà chính họ không phải là "chủ tài khoản" trực tiếp trên hệ thống.

### 10. Performance Risks
- Xem lịch calendar tuần/tháng của nhân viên có booking dày đặc (cơ sở lớn, nhiều nhân viên) — truy vấn tổng hợp nhiều nhân viên x nhiều ngày cần tối ưu, không thấy đề cập.

### 11. UI/UX Traps
- Kéo-thả (drag & drop) điều chỉnh lịch làm việc trên thiết bị màn hình nhỏ (nếu Web Portal được xem trên tablet) dễ thao tác sai, thả nhầm slot liền kề.
- Đổi trạng thái nhân viên bằng 1 dropdown đơn giản không có xác nhận phụ — dễ đổi nhầm "Nghỉ việc" thay vì "Nghỉ phép" (hậu quả khác nhau rất lớn: 1 cái là tạm thời, 1 cái gần như vĩnh viễn).

### 12. Tester Checklist
☐ CRUD nhân viên đầy đủ thông tin
☐ Gán/bỏ gán dịch vụ nhân viên có thể thực hiện
☐ Đổi trạng thái Đang làm việc → Nghỉ phép → Đang làm việc
☐ Đổi trạng thái sang Nghỉ việc khi đang có booking tương lai (kỳ vọng có luồng xử lý booking liên quan)
☐ Thiết lập ca làm việc, kiểm tra hiển thị đúng trên calendar
☐ Kéo-thả đổi ca khi đang có booking trong ca cũ
☐ Xem lịch trống nhân viên khi nhân viên chưa từng có ca làm việc nào
☐ Một người được gán là nhân viên ở 2 cơ sở khác nhau (kiểm tra hệ thống có cho phép/ đúng như kỳ vọng)
☐ Sửa hồ sơ nhân viên của cơ sở khác qua gọi API trực tiếp

### 13. Giảng viên có thể hỏi gì?
- Khi một nhân viên nghỉ đột xuất, các lịch hẹn đã đặt với nhân viên đó được xử lý như thế nào — tự động hay chủ cơ sở phải xử lý tay từng lịch?
- Nhân viên/thợ có tài khoản đăng nhập riêng không? Nếu không, làm sao họ biết lịch làm việc của mình mà không cần hỏi chủ cơ sở?
- Một thợ làm việc cho nhiều salon (rất phổ biến trong ngành) được mô hình hóa trong hệ thống như thế nào?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟠 High — trực tiếp quyết định tính đúng của "khung giờ trống" ở Booking; lỗi ở đây lan thẳng thành trải nghiệm khách hàng tồi tệ nhất (đặt được lịch với nhân viên không có mặt).

---

## MODULE W5: Quản lý Gallery & Hình ảnh (Media Management)
**UR liên quan**: UR-B-040
**Phạm vi theo URD**: Upload ảnh before/after, ảnh tác phẩm, ảnh không gian; phân loại album; gắn tag dịch vụ/nhân viên; consent khách hàng; giới hạn JPG/PNG/HEIC ≤10MB.

### 1. Business cases
- Chủ cơ sở upload ảnh before/after, ảnh tác phẩm, ảnh không gian, phân loại theo album, gắn tag dịch vụ/nhân viên thực hiện, xin đồng ý hiển thị từ khách, giới hạn định dạng/kích thước (UR-B-040).

### 2. Edge cases
- Ảnh before/after gắn tag 1 khách hàng cụ thể — nếu khách đó **rút lại đồng ý** (consent) sau khi ảnh đã lên app và được nhiều người xem/lưu — hệ thống có cơ chế gỡ ảnh theo yêu cầu và xóa khỏi CDN/cache không? Đây trực tiếp liên quan tới quyền của chủ thể dữ liệu theo Luật Bảo vệ dữ liệu cá nhân 2025 (→ 0.4.E), và ảnh before/after của dịch vụ thẩm mỹ viện (tiêm filler/botox) có thể được xem là dữ liệu liên quan sức khỏe — mức bảo vệ cần cao hơn ảnh thông thường.
- "Cho phép khách hàng đồng ý hiển thị" (UR-B-040④) — nhưng cơ chế lấy đồng ý là gì? Khách có thực sự bấm "Đồng ý" trên 1 giao diện nào đó (Mobile App) hay chủ cơ sở tự tick "khách đã đồng ý" thay khách (rất dễ xảy ra trong thực tế salon, và nếu vậy, "đồng ý" này không có giá trị pháp lý thực sự vì không phải do chính chủ thể dữ liệu xác nhận). *Đây là gap rất tinh tế nhưng quan trọng để hỏi trong buổi bảo vệ.*
- Ảnh upload có gắn định vị GPS trong metadata (EXIF) của ảnh gốc từ điện thoại — có bị lộ vị trí nhà khách hàng (nơi chụp ảnh before ở nhà) nếu hệ thống không strip EXIF trước khi lưu/hiển thị?
- Album không có giới hạn số ảnh — cơ sở upload hàng nghìn ảnh vào 1 album gây khó duyệt/tải.

### 3. Exception cases
- Upload file vượt 10MB hoặc sai định dạng (không phải JPG/PNG/HEIC) — validate ở FE hay chỉ BE (nếu chỉ FE, dễ bypass qua gọi API trực tiếp).
- Ảnh HEIC (định dạng của iPhone) không hiển thị đúng trên các thiết bị Android không hỗ trợ HEIC — cần convert sang JPEG khi lưu, không thấy đề cập.

### 4. Validation cases còn thiếu
- Kích thước tối thiểu (chặn ảnh quá nhỏ/mờ không rõ nội dung).
- Kiểm tra loại file thực (magic bytes) thay vì chỉ tin đuôi file `.jpg`/`.png` (liên quan Security).

### 5. Business Rule còn thiếu
- Quy trình lấy "đồng ý hiển thị" từ khách cụ thể là gì (khách tự bấm đồng ý qua app, hay chủ cơ sở xác nhận thay)? *Cần bổ sung — nghiêm trọng về mặt pháp lý.*
- Khách rút lại đồng ý sau khi ảnh đã public — quy trình gỡ ảnh trong bao lâu? *Cần bổ sung.*
- Giới hạn số ảnh/album, số album/cơ sở. *Thiếu đặc tả.*

### 6. Permission Cases
- Cơ sở B xem/xóa ảnh gallery của cơ sở A qua gọi API trực tiếp.
- Khách hàng có quyền tự yêu cầu gỡ ảnh before/after của chính mình trực tiếp (không cần qua chủ cơ sở) không? Permission Matrix không đề cập quyền này cho khách ở mục nào cả.

### 7. Concurrency Cases
- Không đáng kể — module ít xung đột ghi/đọc đồng thời so với Booking/Promotion.

### 8. Data Integrity
- MEDIA không có attribute (→ 0.4.B) — không rõ có trường lưu trạng thái `consent_status`/`consent_by`/`consent_at` để làm chứng cứ tuân thủ pháp luật khi bị kiểm tra, hay chỉ là 1 checkbox không lưu vết (audit trail).

### 9. Security Risks
- Upload file giả dạng ảnh (thực chất là file thực thi) nếu chỉ kiểm tra đuôi file — nguy cơ "Upload shell" (đúng ví dụ Security Risk mà đề bài gốc liệt kê).
- Rò rỉ vị trí qua EXIF GPS (đã nêu ở Edge case).
- Ảnh before/after nhạy cảm bị truy cập trái phép nếu URL ảnh trên CDN không có kiểm soát truy cập (chỉ dựa vào "URL khó đoán" — security through obscurity — thay vì access control thực sự).

### 10. Performance Risks
- Ảnh gallery độ phân giải cao không resize/tạo nhiều size (thumbnail/medium/full) — tải chậm trên Mobile App, đặc biệt ảnh hưởng NFR-002/003 (thời gian tải trang/app).

### 11. UI/UX Traps
- Upload nhiều ảnh cùng lúc trên mạng yếu — không có tiến trình riêng từng ảnh, khách/cơ sở không biết ảnh nào thành công/thất bại.

### 12. Tester Checklist
☐ Upload ảnh hợp lệ (JPG/PNG/HEIC) đúng ≤10MB
☐ Upload ảnh sai định dạng / vượt 10MB
☐ Upload file thực thi đổi tên đuôi thành .jpg
☐ Phân loại ảnh vào album, gắn tag dịch vụ/nhân viên
☐ Đánh dấu consent khách hàng, kiểm tra ảnh chỉ hiển thị khi có consent
☐ Rút lại consent, kiểm tra ảnh bị gỡ khỏi app và CDN
☐ Kiểm tra ảnh upload có bị strip EXIF/GPS không
☐ Xóa/xem ảnh của cơ sở khác qua gọi API trực tiếp

### 13. Giảng viên có thể hỏi gì?
- "Đồng ý hiển thị" của khách hàng được thu thập bằng cơ chế nào — khách tự xác nhận hay chủ cơ sở xác nhận thay? Điều này có giá trị pháp lý không theo luật hiện hành?
- Nếu khách yêu cầu gỡ ảnh before/after của mình, hệ thống xử lý trong bao lâu và xóa khỏi những tầng nào (DB, CDN, cache)?
- Hệ thống có kiểm tra file upload thực sự là ảnh hay chỉ tin theo đuôi file không?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟠 High — liên quan trực tiếp tới dữ liệu nhạy cảm (hình ảnh cá nhân/tình trạng thẩm mỹ) và nghĩa vụ pháp lý về bảo vệ dữ liệu cá nhân.

---

## MODULE W6: Quản lý Lịch hẹn — phía Cơ sở (Booking Management)
**UR liên quan**: UR-B-050 → UR-B-052
**Phạm vi theo URD**: Nhận thông báo lịch mới + xác nhận/từ chối + auto-accept; xem/quản lý lịch trên dashboard (calendar/list, lọc, drag&drop); chat/thông báo thay đổi lịch với khách.

### 1. Business cases
- Nhận thông báo realtime (web + email + âm thanh) khi có lịch mới, xem chi tiết, Xác nhận/Từ chối kèm lý do, hoặc bật Auto-accept (UR-B-050).
- Xem lịch dạng Calendar/List, lọc theo nhân viên/dịch vụ/trạng thái/ngày, 6 trạng thái lịch, kéo-thả đổi lịch kèm thông báo khách (UR-B-051).
- Chat trực tiếp với khách, gửi thông báo đổi lịch kèm lý do, đề xuất lịch mới → khách xác nhận/từ chối, gọi điện qua SĐT (UR-B-052).

### 2. Edge cases
- *(Đối chiếu GlowBook.jsx)* Đây là phát hiện quan trọng nhất khi đối chiếu code với URD: hàm xử lý yêu cầu đổi lịch trong bản mock —
  ```js
  const resolveChange = (id, accept) => setAppointments(appointments.map(a =>
    a.id === id ? { ...a, changeRequest: null, status: accept ? a.status : a.status } : a));
  ```
  — cả 2 nhánh `accept ? a.status : a.status` đều trả về **chính giá trị `a.status` không đổi**. Nghĩa là dù chủ cơ sở bấm "Chấp nhận" hay "Từ chối" yêu cầu đổi giờ của khách, hàm này chỉ xóa `changeRequest` (ẩn banner cảnh báo) mà **không hề cập nhật giờ hẹn mới** vào dữ liệu lịch. Đây là một lỗi logic thật, cụ thể, có thể tái hiện ngay trong bản demo — đúng chính xác dạng lỗi mà URD (UR-C-045, UR-B-052③) mô tả bằng lời nhưng chưa được hiện thực đúng: "chấp nhận đổi lịch" phải ghi đè `time` mới, không chỉ tắt cảnh báo.
- Cơ sở bấm "Auto-accept" (UR-B-050④) nhưng sau đó phát hiện 1 lịch tự-xác-nhận bị trùng nhân viên với 1 lịch khác cũng tự-xác-nhận (vì auto-accept bỏ qua bước kiểm tra thủ công của con người, nhưng URD không nói auto-accept có tự kiểm tra trùng lịch bằng hệ thống hay không) — nếu không, Auto-accept làm tăng nguy cơ double-booking đã nêu ở Module Booking.
- Kéo-thả đổi lịch (UR-B-051④) sang 1 khung giờ đã có booking khác của cùng nhân viên — UI có chặn thả vào ô đã có người không, hay cho thả rồi báo lỗi sau?
- "Đề xuất lịch mới → Khách xác nhận/từ chối" (UR-B-052③) — nếu khách không phản hồi trong thời gian dài (không mở app), booking cũ vẫn ở trạng thái nào trong lúc chờ? Không có time-out rule (liên hệ 0.4.C).
- Cơ sở từ chối 1 booking (UR-B-050③) — khách đã áp voucher cho booking đó, lượt dùng voucher có được hoàn lại tự động không (liên hệ Module W3)?

### 3. Exception cases
- Thông báo realtime (web+email+âm thanh) gửi thất bại 1 trong 3 kênh — cơ sở có bỏ lỡ lịch mới nếu không mở tab Web Portal đúng lúc và email cũng lỗi?
- Drag & drop đổi lịch nhưng API cập nhật thất bại giữa chừng — UI đã di chuyển thẻ lịch (optimistic update) nhưng dữ liệu thật chưa đổi, cần rollback UI đúng khi lỗi.

### 4. Validation cases còn thiếu
- Lý do từ chối lịch: bắt buộc nhập hay có thể để trống? Giới hạn độ dài?
- Lý do đổi lịch (UR-B-052②): tương tự.

### 5. Business Rule còn thiếu
- Chấp nhận yêu cầu đổi giờ từ khách có tự động cập nhật giờ hẹn không *(đã xác nhận là lỗi thật trong code mock — cần đặc tả rõ ràng bằng văn bản để tránh lặp lại lỗi này khi code thật)*? *Cần bổ sung.*
- Auto-accept có tự kiểm tra trùng lịch trước khi xác nhận không? *Cần bổ sung — nghiêm trọng.*
- Cơ sở từ chối/hủy 1 booking đã dùng voucher — lượt dùng voucher được hoàn lại như thế nào? *Cần bổ sung.*
- Timeout cho booking "Chờ xác nhận" nếu cơ sở không phản hồi? *(→ 0.4.C, cần bổ sung ở đây với vai trò module trực tiếp chịu trách nhiệm xác nhận.)*

### 6. Permission Cases
- Cơ sở B xác nhận/từ chối booking của cơ sở A qua gọi API trực tiếp.
- Nếu Web Portal cho nhiều người vận hành cùng 1 cơ sở (→ 0.4.J), có phân quyền con nào (chỉ chủ mới được từ chối, nhân viên lễ tân chỉ được xem) không? Permission Matrix hiện tại chỉ có 1 mức "Cơ sở (Web)" duy nhất, không chia nhỏ vai trò nội bộ.

### 7. Concurrency Cases
- Khách đổi lịch đúng lúc cơ sở hủy lịch đó — đã nêu ở Module Booking mục 7, module này là nơi thực thi hành động "hủy" phía cơ sở nên cần nhấn mạnh lại: 2 thao tác trái chiều cần cơ chế xác định "ai thắng" rõ ràng (thường là: thao tác đến DB trước sẽ thắng, thao tác sau nhận lỗi "dữ liệu đã thay đổi").
- Hai nhân viên vận hành Web Portal của cùng 1 cơ sở cùng bấm "Xác nhận" cho 1 booking cùng lúc — vô hại về nghiệp vụ (kết quả cuối giống nhau) nhưng vẫn nên tránh gửi trùng 2 thông báo xác nhận tới khách.

### 8. Data Integrity
- Đã nêu: chấp nhận đổi lịch không thực sự ghi lại giờ mới (xác nhận thực nghiệm qua code mock).
- Không rõ hành động "Từ chối" (kèm lý do) có lưu vết `rejection_reason` trên BOOKING hay chỉ hiển thị tạm trên UI rồi mất (BOOKING entity ở §6.2 không có trường lưu lý do từ chối/hủy).

### 9. Security Risks
- Không có gì đặc biệt hơn các rủi ro IDOR/injection đã nêu ở các module khác, áp dụng tương tự cho endpoint `PUT /bookings/:id`.

### 10. Performance Risks
- Dashboard Calendar tổng hợp lịch của toàn bộ nhân viên 1 cơ sở lớn theo tháng — truy vấn cần tối ưu index theo `business_id` + khoảng ngày.

### 11. UI/UX Traps
- *(Đối chiếu GlowBook.jsx)* Banner cảnh báo "yêu cầu đổi lịch" biến mất ngay sau khi bấm Chấp nhận/Từ chối (đúng theo state `changeRequest: null`) — về mặt UX điều này trông như đã xử lý xong, dễ khiến người kiểm thử (và cả chủ cơ sở thật) tin lầm là giờ hẹn đã được cập nhật, che lấp mất lỗi logic đã nêu ở mục 2 — đây là một minh chứng cụ thể cho việc UI "trông có vẻ đúng" có thể ẩn giấu lỗi dữ liệu nghiêm trọng phía dưới, nên tester phải luôn kiểm tra dữ liệu thật (giờ hẹn) sau hành động, không chỉ kiểm tra banner có biến mất hay không.
- Kéo-thả lịch trên calendar dày đặc (nhiều nhân viên, nhiều booking/ngày) dễ thả nhầm sang ô liền kề.

### 12. Tester Checklist
☐ Nhận thông báo lịch mới qua đủ 3 kênh (web/email/âm thanh)
☐ Xác nhận / Từ chối kèm lý do
☐ Bật Auto-accept, kiểm tra có tự kiểm tra trùng lịch không
☐ Kéo-thả đổi lịch tới khung giờ trống hợp lệ
☐ Kéo-thả đổi lịch tới khung giờ đã có booking khác (kỳ vọng bị chặn)
☐ **Chấp nhận yêu cầu đổi giờ từ khách → xác minh giờ hẹn trong dữ liệu đã thực sự đổi (không chỉ banner biến mất)**
☐ Từ chối yêu cầu đổi giờ từ khách → xác minh giờ hẹn giữ nguyên như cũ
☐ Từ chối/hủy booking đã dùng voucher → kiểm tra lượt voucher được hoàn lại
☐ Lọc lịch theo nhân viên/dịch vụ/trạng thái/ngày
☐ Chat và gọi điện với khách từ màn quản lý lịch
☐ Xác nhận booking của cơ sở khác qua gọi API trực tiếp

### 13. Giảng viên có thể hỏi gì?
- Khi chủ cơ sở "chấp nhận" yêu cầu đổi giờ của khách, dữ liệu nào thực sự được cập nhật? (Câu hỏi này nên được hỏi trực tiếp dựa trên lỗi đã tìm thấy trong code mock.)
- Auto-accept có an toàn không nếu nó bỏ qua sự kiểm tra của con người đối với xung đột lịch?
- Nếu cơ sở từ chối một booking đã dùng voucher giới hạn lượt, hệ thống có hoàn lại lượt dùng cho khách không?

### 14. Mức độ nghiêm trọng tổng thể của module: 🔴 Critical — lỗi "chấp nhận đổi lịch không đổi giờ" đã được xác nhận tồn tại thật trong bản hiện thực hoá, thuộc nhóm lỗi nguy hiểm nhất (âm thầm sai dữ liệu mà giao diện trông như đã đúng).

---

## MODULE W7: Thống kê & Báo cáo cho Cơ sở (Business Analytics)
**UR liên quan**: UR-B-060 → UR-B-061
**Phạm vi theo URD**: Dashboard tổng quan (lịch hẹn, doanh thu, tỷ lệ hủy/no-show, rating, top dịch vụ, biểu đồ xu hướng); báo cáo chi tiết đa chiều + xuất PDF/Excel.

### 1. Business cases
- Xem dashboard: số lịch hẹn hôm nay/tuần/tháng, doanh thu ước tính, tỷ lệ xác nhận/hủy/no-show, đánh giá trung bình, top dịch vụ, biểu đồ xu hướng (UR-B-060).
- Xem báo cáo theo dịch vụ/nhân viên/thời gian/khách hàng, xuất PDF/Excel (UR-B-061).

### 2. Edge cases
- "Doanh thu ước tính" (UR-B-060②) — vì Phase 1 không có thanh toán online (→ 0.4.A), số này hoàn toàn là **ước tính dựa trên `total_amount` của booking "Hoàn thành"**, không phải doanh thu thực đã thu tiền. Từ "ước tính" trong URD thực ra đang che giấu một khoảng trống lớn: không có cách nào xác nhận cơ sở đã thực sự thu đúng số tiền đó tại chỗ (khách có thể trả giá khác ngoài hệ thống, hoặc no-show không bị trừ đúng).
- Tỷ lệ hủy/no-show — công thức tính là gì (số lượng/tổng số booking trong kỳ, hay số lượng/số booking đã đến hạn)? Không có định nghĩa công thức trong URD, dễ mỗi module tính khác nhau (đối chiếu: `GlowBook.jsx` có sẵn KPI card "Tỉ lệ huỷ lịch: 4.2%" ở màn SalonStats — con số này đang được hard-code trong mock, không có công thức nguồn để kiểm tra tính đúng).
- Top dịch vụ được đặt nhiều nhất — tính theo số lượt đặt (kể cả bị hủy) hay chỉ tính lượt hoàn thành?
- Báo cáo "Khách mới/Khách quay lại" (UR-B-061④) — "khách quay lại" định nghĩa là quay lại đúng cơ sở này, hay quay lại hệ thống nói chung (có thể ở cơ sở khác)? Không rõ.
- Xuất báo cáo PDF/Excel cho khoảng thời gian rất dài (nhiều năm) — không thấy giới hạn khoảng thời gian tối đa cho phép xuất trong 1 lần.

### 3. Exception cases
- API tổng hợp dashboard timeout khi dữ liệu lớn (cơ sở hoạt động lâu năm, nhiều booking).
- Xuất báo cáo PDF/Excel lỗi giữa chừng (file hỏng/thiếu trang).

### 4. Validation cases còn thiếu
- Khoảng thời gian lọc báo cáo: ngày bắt đầu sau ngày kết thúc.

### 5. Business Rule còn thiếu
- Công thức tính "tỷ lệ hủy/no-show" và "doanh thu ước tính" cần được phát biểu rõ bằng văn bản (mẫu số/tử số cụ thể). *Cần bổ sung.*
- "Khách quay lại" định nghĩa theo phạm vi cơ sở hay toàn hệ thống? *Thiếu đặc tả.*

### 6. Permission Cases
- Cơ sở B xem được báo cáo/dashboard của cơ sở A qua gọi API trực tiếp (đặc biệt nguy hiểm vì đây là dữ liệu kinh doanh nhạy cảm — doanh thu, khách hàng — của đối thủ cùng ngành).

### 7. Concurrency Cases
- Không đáng kể — đây là module đọc dữ liệu (read-heavy), ít xung đột ghi.

### 8. Data Integrity
- Vì "doanh thu ước tính" dựa trên dữ liệu không được xác minh thực tế (đã nêu ở Edge case), toàn bộ báo cáo tài chính ở module này chỉ mang tính tham khảo — cần ghi rõ giới hạn này trong tài liệu để tránh chủ cơ sở hiểu lầm đây là số liệu kế toán chính xác.

### 9. Security Risks
- Rò rỉ dữ liệu kinh doanh (doanh thu, danh sách khách hàng, hiệu suất nhân viên) qua IDOR đã nêu ở Permission — hậu quả cạnh tranh không lành mạnh nếu lộ ra đối thủ.

### 10. Performance Risks
- Tính toán tổng hợp (aggregate) nhiều chiều (dịch vụ × nhân viên × thời gian × khách hàng) trên dữ liệu lớn theo thời gian thực — nên cân nhắc pre-aggregate/data warehouse riêng thay vì query trực tiếp trên bảng giao dịch (OLTP) chính, không thấy đề cập kiến trúc.

### 11. UI/UX Traps
- Biểu đồ xu hướng (line/bar chart) với khoảng thời gian ngắn (cơ sở mới mở, ít dữ liệu) hiển thị biểu đồ trống/gây hiểu lầm là lỗi.

### 12. Tester Checklist
☐ Dashboard hiển thị đủ 6 chỉ số theo UR-B-060①–⑥
☐ Đối chiếu số liệu dashboard với dữ liệu booking thực tế (kiểm tra công thức tính)
☐ Báo cáo theo dịch vụ/nhân viên/thời gian/khách hàng
☐ Xuất báo cáo PDF/Excel, mở lại kiểm tra đúng dữ liệu đã lọc
☐ Xem báo cáo/dashboard của cơ sở khác qua gọi API trực tiếp
☐ Xem dashboard khi cơ sở chưa có booking nào (mới mở)

### 13. Giảng viên có thể hỏi gì?
- "Doanh thu ước tính" có phản ánh đúng doanh thu thực tế cơ sở nhận được không, khi hệ thống chưa quản lý thanh toán?
- Công thức tính tỷ lệ hủy/no-show là gì?
- "Khách quay lại" được định nghĩa trong phạm vi 1 cơ sở hay toàn hệ thống?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟡 Medium — sai số liệu ảnh hưởng quyết định kinh doanh của cơ sở nhưng không trực tiếp gây lỗi giao dịch.

---
---

# PHÂN HỆ 3: WEB ADMIN PANEL — DÀNH CHO QUẢN TRỊ VIÊN
### 7 module — UR-A-001 → UR-A-062

## MODULE A1: Dashboard Tổng quan (Admin Dashboard)
**UR liên quan**: UR-A-001
**Phạm vi theo URD**: Tổng số cơ sở hoạt động, tổng người dùng, tổng lịch hẹn (hôm nay/tuần/tháng), tỷ lệ tăng trưởng, biểu đồ realtime.

### 1. Business cases
- Admin xem tổng số cơ sở đang hoạt động, tổng người dùng đã đăng ký, tổng lịch hẹn theo 3 khung thời gian, tỷ lệ tăng trưởng so với kỳ trước, biểu đồ realtime (lịch hẹn theo giờ, người dùng mới, top cơ sở) (UR-A-001).

### 2. Edge cases
- "Tổng số cơ sở đang hoạt động" — có tính cả cơ sở đang "Chờ duyệt" hay chỉ tính "Hoạt động" (khác trạng thái "Bị khóa")? Không có định nghĩa rõ ràng cho từng chỉ số tổng hợp.
- Biểu đồ "realtime" (①⑤) trong khi NFR-005 chỉ yêu cầu đồng bộ dữ liệu chung ≤2 giây — dashboard có tự refresh theo chu kỳ hay đẩy qua WebSocket thật? Nếu là polling định kỳ, "realtime" chỉ mang tính marketing hơn là kỹ thuật.
- Tỷ lệ tăng trưởng "so với kỳ trước" — kỳ trước là cùng kỳ tháng trước, hay 30 ngày liền trước? Ảnh hưởng trực tiếp tới số % hiển thị.

### 3. Exception cases
- Truy vấn tổng hợp toàn hệ thống (tổng cơ sở, tổng user, tổng booking) timeout khi dữ liệu đã lớn theo thời gian.

### 4. Validation cases còn thiếu
- Không áp dụng nhiều (module hiển thị, không có input đáng kể).

### 5. Business Rule còn thiếu
- Định nghĩa chính xác "kỳ trước" khi tính tỷ lệ tăng trưởng. *Thiếu đặc tả.*
- "Cơ sở đang hoạt động" trong chỉ số tổng có loại trừ cơ sở tạm ngưng không (nếu tính năng tạm ngưng được bổ sung — liên hệ Module W1 mục 5)? *Thiếu đặc tả.*

### 6. Permission Cases
- Chỉ Admin được xem — cần đảm bảo endpoint dashboard admin có kiểm tra `role = admin` chặt chẽ, không chỉ ẩn menu ở UI.

### 7. Concurrency Cases
- Không đáng kể.

### 8. Data Integrity
- Các số liệu tổng hợp phụ thuộc hoàn toàn vào tính đúng của dữ liệu từ các module khác (booking, user, business) — nếu các module đó có lỗi đếm (VD: no-show tính nhầm vào "hoàn thành"), dashboard admin sẽ phản ánh sai mà không có cách tự phát hiện.

### 9. Security Risks
- Đây là màn hình chứa số liệu tổng thể nhạy cảm nhất của toàn doanh nghiệp — cần áp dụng NFR-013 (RBAC) nghiêm ngặt nhất trong toàn hệ thống.

### 10. Performance Risks
- Tính tổng số liệu toàn hệ thống (không lọc theo cơ sở như Module W7) trên dữ liệu production lớn — cần cân nhắc cache/pre-aggregate, tương tự đã nêu ở Module W7.

### 11. UI/UX Traps
- Không đáng kể.

### 12. Tester Checklist
☐ Hiển thị đúng 5 chỉ số theo UR-A-001①–⑤
☐ Đối chiếu số liệu dashboard với dữ liệu thô (query trực tiếp DB) để xác minh công thức đúng
☐ Truy cập dashboard admin bằng token role khách/cơ sở (kỳ vọng bị từ chối)
☐ Tải dashboard khi hệ thống có dữ liệu rất lớn (kiểm tra thời gian phản hồi)

### 13. Giảng viên có thể hỏi gì?
- "Realtime" trong dashboard admin nghĩa là gì về mặt kỹ thuật — polling hay push thực sự?
- Nếu một chỉ số ở dashboard sai (VD: đếm nhầm no-show là hoàn thành), làm sao phát hiện được sự sai lệch đó?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟡 Medium — sai số liệu ảnh hưởng quyết định vận hành nhưng không gây lỗi giao dịch trực tiếp.

---

## MODULE A2: Quản lý Cơ sở làm đẹp — phía Admin (Business Management)
**UR liên quan**: UR-A-010 → UR-A-012
**Phạm vi theo URD**: CRUD toàn quyền (Xem/Duyệt/Sửa/Khóa/Xóa), phê duyệt cơ sở mới, xem theo nhóm dịch vụ + xuất báo cáo.

### 1. Business cases
- Admin xem/duyệt/sửa/khóa/xóa cơ sở, lọc theo nhóm/khu vực/trạng thái, tìm kiếm, xem chi tiết đầy đủ (UR-A-010).
- Admin duyệt hồ sơ mới: xem giấy phép/thông tin/ảnh, Duyệt/Từ chối kèm lý do, gửi email/SMS (UR-A-011).
- Admin xem theo nhóm dịch vụ, thống kê số lượng, xuất Excel/PDF (UR-A-012).

### 2. Edge cases
- *(Đối chiếu GlowBook.jsx)* Component `AdminSalons` trong bản mock **chỉ hiện thực hàm `approve()`** — hoàn toàn không có nút/hàm "Từ chối" nào, dù UR-A-011③ yêu cầu rõ "Duyệt / Từ chối (kèm lý do)". Nút hành động trong bảng chỉ hiển thị: `{s.status === "Chờ duyệt" && <button onClick={() => approve(s.id)}>Duyệt</button>}` — không có nhánh else cho Từ chối. Đây là một tính năng bắt buộc theo URD nhưng vắng mặt hoàn toàn trong bản hiện thực hoá đã upload.
- Admin "Khóa" một cơ sở đang có **booking tương lai chưa hoàn thành** — các booking đó tự động bị hủy, hay vẫn giữ nguyên và khách vẫn đến đúng giờ nhưng cơ sở đã "biến mất" khỏi hệ thống? UR-A-010① chỉ liệt kê hành động "Khóa" mà không mô tả hệ quả dây chuyền — đây chính là câu hỏi ví dụ gốc "Salon bị khóa thì booking xử lý thế nào?" mà đề bài đã gợi ý, và URD thực sự chưa trả lời.
- Admin "Xóa" cơ sở (khác Khóa) — theo Data Integrity đã nêu ở Module W1 mục 8, nếu là xóa cứng sẽ mất toàn bộ lịch sử SERVICE/STAFF/BOOKING/REVIEW liên quan.
- Tìm kiếm cơ sở theo "quận/huyện" (UR-A-010②) lại vướng lỗ hổng 0.4.D.
- Từ chối hồ sơ kèm lý do (UR-A-011③) — lý do này có được lưu vết để tra soát sau (audit log), hay chỉ gửi 1 lần qua email rồi mất?

### 3. Exception cases
- Gửi email/SMS kết quả duyệt thất bại (đã nêu tương tự ở Module W1).
- Xuất Excel/PDF danh sách cơ sở khi số lượng rất lớn — timeout/file quá nặng.

### 4. Validation cases còn thiếu
- Không áp dụng nhiều thêm ngoài các mục đã nêu ở Module W1 (góc nhìn Admin chủ yếu là thao tác trên dữ liệu cơ sở đã tồn tại).

### 5. Business Rule còn thiếu
- Khóa cơ sở đang có booking tương lai: các booking đó xử lý ra sao (tự hủy + hoàn tiền/voucher, hay giữ nguyên)? *Cần bổ sung — nghiêm trọng, đúng ví dụ gốc trong đề bài.*
- Xóa cơ sở: xóa cứng hay soft-delete? *Cần bổ sung.*
- Từ chối hồ sơ có được lưu log/audit trail không? *Thiếu đặc tả.*

### 6. Permission Cases
- Bản mock hiện tại (không phân vai trong nội bộ Admin) — có nhiều cấp Admin (Super Admin vs Admin vận hành) không, hay chỉ 1 vai trò "Admin" duy nhất có toàn quyền Xóa/Khóa? Permission Matrix (§8) chỉ có 1 cột "Admin (Web)" chung, không phân cấp — rủi ro nếu có nhiều nhân sự Admin nhưng chỉ 1 mức quyền, 1 tài khoản Admin cấp thấp cũng Xóa được cơ sở.

### 7. Concurrency Cases
- Hai Admin cùng duyệt/khóa 1 cơ sở gần như đồng thời (đã nêu ở Module W1 mục 7, nhắc lại đầy đủ hơn ở góc nhìn Admin thao tác trực tiếp).

### 8. Data Integrity
- Đã nêu ở mục 2/5: hệ quả của Khóa/Xóa lên các entity liên quan chưa được đặc tả.

### 9. Security Risks
- Không phân cấp quyền Admin nội bộ (đã nêu ở mục 6) — vi phạm nguyên tắc "least privilege"; 1 tài khoản Admin bị chiếm đoạt có thể xóa toàn bộ cơ sở trên hệ thống.

### 10. Performance Risks
- Xuất báo cáo Excel/PDF danh sách toàn bộ cơ sở khi hệ thống có hàng chục nghìn cơ sở (kỳ vọng tăng trưởng theo NFR-041 scalability).

### 11. UI/UX Traps
- Nút "Khóa"/"Xóa" đặt cạnh nhau trong 1 bảng dữ liệu dày đặc — dễ bấm nhầm hành động không thể hoàn tác (Xóa) thay vì hành động có thể hoàn tác (Khóa) nếu không có bước xác nhận rõ ràng riêng cho hành động phá hủy dữ liệu.

### 12. Tester Checklist
☐ Duyệt hồ sơ cơ sở mới → chuyển Hoạt động, gửi email/SMS
☐ **Từ chối hồ sơ kèm lý do → xác minh tính năng có thực sự tồn tại trong hệ thống (bản mock hiện chưa có)**
☐ Khóa cơ sở đang có booking tương lai → kiểm tra hệ quả lên các booking đó
☐ Xóa cơ sở đã có lịch sử booking/review → kiểm tra dữ liệu liên quan
☐ Lọc/tìm kiếm cơ sở theo nhóm dịch vụ/khu vực/trạng thái
☐ Xuất Excel/PDF danh sách cơ sở
☐ Hai Admin duyệt/khóa cùng 1 cơ sở đồng thời

### 13. Giảng viên có thể hỏi gì?
- Khi khóa một cơ sở đang có 50 lịch hẹn tương lai, 50 khách hàng đó được xử lý ra sao?
- Vì sao chức năng "Từ chối hồ sơ" có trong URD nhưng không thấy trong bản mock giao diện đã nộp?
- Hệ thống có phân cấp quyền Admin (Super Admin vs Admin vận hành) không?

### 14. Mức độ nghiêm trọng tổng thể của module: 🔴 Critical — hành động Khóa/Xóa cơ sở có thể gây mất trải nghiệm hàng loạt cho nhiều khách hàng cùng lúc nếu không có luồng xử lý hệ quả rõ ràng.

---

## MODULE A3: Quản lý Người dùng (User Management)
**UR liên quan**: UR-A-020 → UR-A-021
**Phạm vi theo URD**: Danh sách người dùng + lọc/tìm kiếm + khóa/mở khóa; chi tiết người dùng (lịch sử, chi tiêu, đánh giá, tần suất).

### 1. Business cases
- Admin xem danh sách người dùng, lọc theo ngày đăng ký/trạng thái/số lần đặt, tìm kiếm, xem chi tiết, khóa/mở khóa tài khoản (UR-A-020).
- Admin xem chi tiết 1 người dùng: thông tin cá nhân, lịch sử đặt lịch, tổng chi tiêu, đánh giá đã viết, tần suất sử dụng (UR-A-021).

### 2. Edge cases
- *(Đối chiếu GlowBook.jsx)* Component `AdminUsers` trong bản mock **chỉ hiển thị bảng dữ liệu (read-only)** — hoàn toàn không có nút "Khóa tài khoản"/"Mở khóa" nào được hiện thực, dù đây là hành động được yêu cầu rõ ràng ở UR-A-020④ ("Thao tác: Xem chi tiết, Khóa tài khoản, Mở khóa"). Cùng dạng gap với module A2 — tính năng có trong URD nhưng thiếu trong bản hiện thực hoá giao diện.
- Khóa 1 tài khoản khách đang có **booking "Chờ xác nhận"/"Đã xác nhận" sắp tới** — cơ sở có còn thấy được thông tin khách đó để liên hệ không (nếu tài khoản bị khóa có thể kéo theo ẩn luôn dữ liệu liên hệ)? Booking đó tự hủy hay vẫn giữ?
- Admin khóa tài khoản vì lý do gì — có cần lý do bắt buộc (giống việc Admin từ chối cơ sở cần lý do ở UR-A-011③) không? UR-A-020④ không yêu cầu nhập lý do khi khóa tài khoản khách, không đồng nhất với cách xử lý cơ sở.
- Tìm kiếm người dùng theo SĐT/Email — nếu khách đã đổi SĐT/email trong hồ sơ, lịch sử tìm kiếm bằng thông tin cũ có tìm ra được không (tùy vào việc hệ thống có lưu vết SĐT/email lịch sử hay ghi đè trực tiếp)?

### 3. Exception cases
- Tương tự các module danh sách khác — API lỗi/timeout khi dữ liệu người dùng lớn.

### 4. Validation cases còn thiếu
- Không đáng kể thêm.

### 5. Business Rule còn thiếu
- Khóa tài khoản khách có bắt buộc nêu lý do và có thông báo cho khách biết lý do không (đối xử công bằng như khi từ chối cơ sở)? *Thiếu đặc tả — nên nhất quán giữa 2 luồng.*
- Khóa tài khoản có ảnh hưởng gì tới booking đang tồn tại của khách đó? *Thiếu đặc tả.*

### 6. Permission Cases
- Tương tự module A2 — không phân cấp quyền Admin nội bộ cho hành động khóa tài khoản người dùng (hành động nhạy cảm, ảnh hưởng quyền truy cập của người khác).

### 7. Concurrency Cases
- Admin khóa tài khoản đúng lúc khách đang thao tác trong app (đặt lịch/thanh toán) — session hiện tại của khách có bị buộc đăng xuất ngay (kick session) hay phải chờ token hết hạn tự nhiên (tới 15 phút theo NFR-012)?

### 8. Data Integrity
- Không có gì mới ngoài các vấn đề chung đã nêu ở Module Authentication.

### 9. Security Risks
- Nếu khóa tài khoản không kick session ngay, khách bị khóa vẫn có thể tiếp tục hành động trong tối đa 15 phút bằng access token cũ còn hiệu lực — cần cơ chế blacklist token/kiểm tra trạng thái tài khoản ở mọi request, không chỉ tin vào JWT còn hạn.

### 10. Performance Risks
- Không đáng kể.

### 11. UI/UX Traps
- Không đáng kể ngoài rủi ro thiếu tính năng đã nêu ở mục 2.

### 12. Tester Checklist
☐ **Khóa/Mở khóa tài khoản người dùng → xác minh tính năng có thực sự tồn tại (bản mock hiện chưa có)**
☐ Tài khoản bị khóa có bị buộc đăng xuất ngay không (kick session)
☐ Khóa tài khoản đang có booking sắp tới → kiểm tra hệ quả
☐ Lọc/tìm kiếm người dùng theo các tiêu chí
☐ Xem chi tiết người dùng, đối chiếu số liệu (tổng chi tiêu, tần suất) với dữ liệu booking thật

### 13. Giảng viên có thể hỏi gì?
- Khi Admin khóa 1 tài khoản khách, phiên đăng nhập hiện tại của khách trên điện thoại bị vô hiệu ngay hay vẫn dùng được tới khi token hết hạn?
- Khóa tài khoản khách có cần lý do không, và khách có được thông báo lý do không?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟠 High — thiếu cơ chế vô hiệu hóa session ngay lập tức là một lỗ hổng bảo mật thực sự nếu khóa tài khoản vì lý do gian lận/vi phạm.

---

## MODULE A4: Quản lý Lịch hẹn toàn hệ thống (System Booking Management)
**UR liên quan**: UR-A-030 → UR-A-033
**Phạm vi theo URD**: Danh sách toàn hệ thống + lọc/tìm/sắp xếp; theo nhóm dịch vụ + thống kê; theo cơ sở + so sánh ngành; theo người dùng + thống kê cá nhân.

### 1. Business cases
- Admin xem toàn bộ lịch hẹn hệ thống, lọc theo nhiều chiều, tìm theo mã/tên khách/tên cơ sở, sắp xếp mới/cũ nhất (UR-A-030).
- Xem theo nhóm dịch vụ kèm thống kê + biểu đồ phân bổ (UR-A-031).
- Xem theo cơ sở kèm tỷ lệ hoàn thành/hủy/no-show + so sánh trung bình ngành (UR-A-032).
- Xem theo người dùng kèm thống kê cá nhân (UR-A-033).

### 2. Edge cases
- "So sánh với trung bình ngành" (UR-A-032③) — "ngành" ở đây là trung bình toàn hệ thống, hay trung bình theo từng nhóm dịch vụ riêng (spa so với spa, không so với nail)? Không định nghĩa rõ, dễ so sánh sai lệch (1 cơ sở Nail nhỏ so với trung bình gồm cả TMV lớn sẽ luôn có vẻ "kém" một cách không công bằng).
- Admin có quyền **sửa** trực tiếp 1 booking (đổi giờ/đổi trạng thái) từ màn quản lý toàn hệ thống không? Theo Permission Matrix §8, "Đặt/hủy/đổi lịch hẹn" ghi Admin = ❌ — tức Admin **chỉ xem**, không có quyền chỉnh sửa booking trực tiếp dù đang ở vai trò giám sát toàn hệ thống. Nếu có tranh chấp giữa khách và cơ sở cần Admin phân xử/chỉnh tay 1 booking, Admin sẽ không có công cụ nào để làm điều đó theo đúng URD hiện tại.
- Tìm kiếm theo "mã đặt lịch" — mã này (`booking_code`, có UK theo §6.2) có phân biệt hoa/thường, có bao gồm ký tự dễ nhầm (0/O, 1/I) không?

### 3. Exception cases
- Truy vấn/thống kê trên dữ liệu booking toàn hệ thống (rất lớn theo thời gian) timeout nếu không có index/phân trang tốt.

### 4. Validation cases còn thiếu
- Khoảng thời gian lọc: ngày bắt đầu sau ngày kết thúc (lặp lại nhưng cần nhấn mạnh vì đây là màn Admin dùng thường xuyên nhất).

### 5. Business Rule còn thiếu
- Công thức "trung bình ngành" dùng để so sánh — tính trên toàn hệ thống hay theo từng nhóm dịch vụ? *Cần bổ sung.*
- Admin có được quyền chỉnh sửa booking thay cho cơ sở/khách trong trường hợp tranh chấp không? Nếu theo đúng Permission Matrix là không, cơ chế giải quyết tranh chấp (dispute resolution) nằm ở đâu trong toàn bộ hệ thống? *Thiếu đặc tả nghiêm trọng cho một hệ thống vận hành thật — hầu hết nền tảng booking thực tế đều cần một cơ chế can thiệp thủ công cho Admin/CSKH.*

### 6. Permission Cases
- Đã nêu ở mục 2/5 — đây là module mà Permission Matrix tự mâu thuẫn với kỳ vọng thực tế về vai trò giám sát của Admin.

### 7. Concurrency Cases
- Không đáng kể hơn (module chủ yếu đọc dữ liệu).

### 8. Data Integrity
- Phụ thuộc hoàn toàn vào tính đúng của dữ liệu Booking gốc — không phát sinh vấn đề riêng.

### 9. Security Risks
- Đây là màn hình có quyền truy cập rộng nhất (xem toàn bộ booking mọi khách, mọi cơ sở) — rủi ro rò rỉ dữ liệu cực lớn nếu bị chiếm quyền Admin; cần audit log ghi nhận Admin nào đã xem/tìm kiếm gì (không thấy đề cập audit logging ở bất kỳ đâu trong toàn bộ URD).

### 10. Performance Risks
- Đã nêu ở mục 3 — đây là bảng dữ liệu lớn nhất trong toàn hệ thống, cần chiến lược phân trang/index/cache nghiêm ngặt nhất.

### 11. UI/UX Traps
- Bảng dữ liệu nhiều cột lọc (5 chiều theo UR-A-030②) dễ gây rối mắt nếu không thiết kế tốt UI bộ lọc.

### 12. Tester Checklist
☐ Xem/lọc/tìm/sắp xếp danh sách booking toàn hệ thống
☐ Xem theo nhóm dịch vụ, đối chiếu thống kê với dữ liệu thô
☐ Xem theo cơ sở, kiểm tra "so sánh trung bình ngành" tính đúng công thức
☐ Xem theo người dùng, đối chiếu thống kê cá nhân
☐ Thử sửa/hủy 1 booking từ màn Admin (kỳ vọng theo Permission Matrix: không có quyền)
☐ Kiểm tra có audit log khi Admin xem/tìm kiếm dữ liệu nhạy cảm không

### 13. Giảng viên có thể hỏi gì?
- Nếu có tranh chấp giữa khách và cơ sở về 1 lịch hẹn, Admin có công cụ nào để can thiệp/chỉnh sửa trực tiếp không? Nếu không, quy trình giải quyết tranh chấp nằm ở đâu?
- "So sánh trung bình ngành" được tính như thế nào — có công bằng giữa các nhóm dịch vụ khác nhau không?
- Hệ thống có ghi log (audit trail) khi Admin truy cập dữ liệu nhạy cảm của người dùng/cơ sở không?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟠 High — thiếu cơ chế can thiệp/dispute-resolution cho Admin là một khoảng trống vận hành lớn cho hệ thống thật.

---

## MODULE A5: Quản lý Danh mục (Category Management)
**UR liên quan**: UR-A-040 → UR-A-041
**Phạm vi theo URD**: CRUD nhóm dịch vụ (tên/icon/mô tả/thứ tự + bật/tắt); danh mục Quận/Huyện (21 quận + 5 huyện TP.HCM + bật/tắt).

### 1. Business cases
- Admin CRUD nhóm dịch vụ: tên/icon/mô tả/thứ tự hiển thị, bật/tắt hiển thị trên app (UR-A-040).
- Admin quản lý danh mục Quận/Huyện, bật/tắt khu vực (UR-A-041).

### 2. Edge cases — đây là module thể hiện rõ nhất lỗ hổng 0.4.D
- **UR-A-041① ghi cứng "Danh sách 21 quận + 5 huyện TP.HCM (có thể mở rộng)"** — nhưng đơn vị hành chính quận/huyện đã bị bãi bỏ trên toàn quốc từ 01/07/2025, và TP.HCM (sau sáp nhập với Bình Dương, Bà Rịa – Vũng Tàu) hiện có 168 đơn vị hành chính cấp xã (phường/xã), không còn quận/huyện nào. Toàn bộ module này — vốn được thiết kế để làm nguồn danh mục cho các bộ lọc "khu vực" ở Module 2/3 (Mobile App) và Module A2 (Admin lọc cơ sở) — đang xây trên một mô hình dữ liệu **sai từ gốc với thực tế hành chính hiện tại**, không phải một edge case hiếm mà là sai lệch nền tảng.
- Nếu Admin cố "mở rộng" danh mục này (theo gợi ý "có thể mở rộng" trong URD) bằng cách thêm phường/xã mới, cấu trúc dữ liệu (nếu DISTRICT chỉ có 1 cấp "quận/huyện") không phản ánh đúng việc phường/xã hiện là cấp duy nhất dưới Thành phố — không có "quận/huyện" trung gian nữa. Đây không phải là việc "thêm dữ liệu mới vào bảng cũ" mà cần thiết kế lại cấu trúc bảng.
- Icon nhóm dịch vụ (UR-A-040①) — định dạng nào (emoji, SVG, URL ảnh)? Không có ví dụ.
- Tắt hiển thị 1 nhóm dịch vụ đang có nhiều cơ sở/dịch vụ thuộc nhóm đó — các cơ sở/dịch vụ này biến mất khỏi mọi bộ lọc/trang chủ ngay lập tức, có cảnh báo trước cho Admin số lượng bị ảnh hưởng không?

### 3. Exception cases
- Không đáng kể — module CRUD đơn giản, ít exception ngoài lỗi API/DB chung.

### 4. Validation cases còn thiếu
- Tên nhóm dịch vụ trùng lặp.
- Thứ tự hiển thị: số âm/trùng thứ tự giữa 2 nhóm.

### 5. Business Rule còn thiếu
- **Danh mục khu vực cần được thiết kế lại theo đơn vị hành chính hiện hành (Phường/Xã, 2 cấp) thay vì Quận/Huyện đã bị bãi bỏ.** *Cần bổ sung — đây là rule quan trọng nhất của cả module, không phải một chi tiết nhỏ.*
- Tắt 1 nhóm dịch vụ đang có cơ sở/dịch vụ hoạt động — có chặn tắt (giống logic "không xóa được service đang có booking") hay cho tắt tự do? *Thiếu đặc tả.*

### 6. Permission Cases
- Chỉ Admin có quyền (đúng theo Permission Matrix, không có mâu thuẫn ở module này).

### 7. Concurrency Cases
- Hai Admin cùng sửa thứ tự hiển thị của các nhóm dịch vụ cùng lúc — dễ tạo trùng số thứ tự nếu không có transaction.

### 8. Data Integrity
- CATEGORY và DISTRICT không có attribute nào được định nghĩa (→ 0.4.B) — module này chính là nơi chịu ảnh hưởng trực tiếp và rõ nhất của lỗ hổng đó, vì nó là module CRUD *cho chính 2 bảng danh mục này*.

### 9. Security Risks
- Không đáng kể.

### 10. Performance Risks
- Không đáng kể — dữ liệu danh mục nhỏ, ít thay đổi.

### 11. UI/UX Traps
- Không đáng kể.

### 12. Tester Checklist
☐ CRUD nhóm dịch vụ, kiểm tra hiển thị đúng thứ tự trên app
☐ Bật/tắt nhóm dịch vụ, kiểm tra tác động lên Mobile App
☐ Tắt 1 nhóm đang có cơ sở/dịch vụ thuộc nhóm
☐ CRUD danh mục khu vực — **đối chiếu với đơn vị hành chính Phường/Xã hiện hành, không phải Quận/Huyện**
☐ Trùng thứ tự hiển thị giữa 2 nhóm dịch vụ

### 13. Giảng viên có thể hỏi gì?
- Việt Nam đã chính thức bỏ cấp hành chính quận/huyện từ 01/07/2025. Danh mục khu vực trong hệ thống của nhóm bạn dựa trên đơn vị hành chính nào, và nhóm bạn xử lý sự thay đổi này ra sao?
- Nếu tắt 1 nhóm dịch vụ đang có 500 cơ sở thuộc nhóm đó, hệ quả là gì?

### 14. Mức độ nghiêm trọng tổng thể của module: 🔴 Critical — module nền tảng cho toàn bộ tính năng lọc-theo-khu-vực của cả hệ thống, và hiện đang dựa trên dữ liệu hành chính đã lỗi thời hơn 1 năm.

---

## MODULE A6: Thống kê & Báo cáo Hệ thống (System Analytics)
**UR liên quan**: UR-A-050 → UR-A-051
**Phạm vi theo URD**: Báo cáo tổng hợp (tổng quan, tăng trưởng, top 10 cơ sở, top dịch vụ, heat map khu vực); xuất đa định dạng + báo cáo định kỳ tự động qua email.

### 1. Business cases
- Admin xem báo cáo tổng hợp: số liệu tổng quan, tăng trưởng theo thời gian, top 10 cơ sở (3 tiêu chí), top dịch vụ, heat map khu vực (UR-A-050).
- Admin xuất báo cáo PDF/Excel/CSV, lọc trước khi xuất, báo cáo định kỳ tự động gửi email (UR-A-051).

### 2. Edge cases
- "Heat map phân bổ theo khu vực" (UR-A-050⑤) — lại phụ thuộc vào danh mục khu vực đã lỗi thời (→ 0.4.D, Module A5) — bản đồ nhiệt sẽ hiển thị dữ liệu theo ranh giới quận/huyện không còn chính xác về mặt địa lý hành chính hiện tại.
- Top 10 cơ sở theo "Doanh thu cao nhất" — lại dựa trên "doanh thu ước tính" chưa được xác thực (→ liên hệ Module W7 mục 2) — bảng xếp hạng công khai nội bộ dựa trên số liệu chưa chắc chính xác 100%.
- Báo cáo định kỳ tự động gửi email (UR-A-051③) — gửi cho ai (danh sách người nhận được quản lý ở đâu), tần suất (ngày/tuần/tháng) được cấu hình thế nào? Không có acceptance criteria chi tiết cho tính năng lịch gửi tự động này.

### 3. Exception cases
- Job gửi báo cáo định kỳ tự động lỗi giữa lúc đang tạo file (email không gửi được nhưng Admin không biết đã lỗi).
- Xuất CSV với dữ liệu chứa dấu phẩy/ký tự đặc biệt trong tên cơ sở/dịch vụ (lỗi escape CSV kinh điển — tên cơ sở có dấu phẩy sẽ làm lệch cột khi mở bằng Excel).

### 4. Validation cases còn thiếu
- Khoảng thời gian lọc trước khi xuất — tương tự các module báo cáo khác.

### 5. Business Rule còn thiếu
- Danh sách người nhận báo cáo định kỳ tự động và tần suất gửi được cấu hình ở đâu? *Thiếu đặc tả.*

### 6. Permission Cases
- Chỉ Admin — không có mâu thuẫn Permission Matrix ở module này.

### 7. Concurrency Cases
- Không đáng kể.

### 8. Data Integrity
- Phụ thuộc vào 2 lỗ hổng đã nêu (danh mục khu vực lỗi thời, doanh thu ước tính chưa xác thực) — bản thân module không phát sinh vấn đề dữ liệu mới nhưng khuếch đại 2 vấn đề đã có.

### 9. Security Risks
- Báo cáo định kỳ gửi qua email — nếu địa chỉ email người nhận bị cấu hình sai/bị đổi mà không kiểm tra lại, dữ liệu kinh doanh nhạy cảm của toàn hệ thống có thể gửi nhầm người ngoài.

### 10. Performance Risks
- Tương tự Module W7/A1 — tính toán tổng hợp toàn hệ thống, khối lượng còn lớn hơn vì đây là cấp toàn hệ thống (không giới hạn theo 1 cơ sở).

### 11. UI/UX Traps
- Không đáng kể.

### 12. Tester Checklist
☐ Xem báo cáo tổng hợp đủ 5 phần theo UR-A-050①–⑤
☐ Xuất PDF/Excel/CSV, kiểm tra dữ liệu tên có dấu phẩy/ký tự đặc biệt không bị lệch cột
☐ Cấu hình báo cáo định kỳ tự động, kiểm tra gửi đúng lịch
☐ Kiểm tra heat map khu vực đối chiếu với danh mục khu vực thực tế

### 13. Giảng viên có thể hỏi gì?
- Heat map phân bổ theo khu vực dựa trên đơn vị hành chính nào?
- Nếu email nhận báo cáo định kỳ bị cấu hình sai, có cơ chế nào phát hiện/cảnh báo không?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟡 Medium.

---

## MODULE A7: Quản lý Nội dung (Content Management)
**UR liên quan**: UR-A-060 → UR-A-062
**Phạm vi theo URD**: Banner quảng cáo (CRUD + hẹn giờ + theo dõi click); push notification (tạo + đối tượng + hẹn giờ + theo dõi); kiểm duyệt review (duyệt/ẩn/xóa + auto-filter từ nhạy cảm).

### 1. Business cases
- Admin CRUD banner (hình/link/vị trí/thứ tự), hẹn thời gian hiển thị, theo dõi lượt click (UR-A-060).
- Admin tạo push notification (tiêu đề/nội dung/hình), chọn đối tượng (tất cả/nhóm/cá nhân), hẹn giờ gửi, theo dõi gửi/đọc/click (UR-A-061).
- Admin kiểm duyệt review: danh sách mới, duyệt/ẩn/xóa vi phạm, auto-filter từ ngữ nhạy cảm (UR-A-062).

### 2. Edge cases
- Banner "hẹn thời gian hiển thị" (UR-A-060②) chồng chéo thời gian với banner khác — nhiều banner cùng hiển thị đồng thời trên carousel, có giới hạn số lượng banner active cùng lúc không?
- Push notification gửi cho "Cá nhân" (UR-A-061②) — Admin chọn cá nhân bằng cách nào (tìm theo SĐT/tên)? Có giới hạn số lượng cá nhân chọn cùng lúc trong 1 lần gửi không (khác với gửi "Nhóm cụ thể")?
- Quy tắc tự động ẩn bình luận chứa "từ ngữ nhạy cảm" (UR-A-062③) — danh sách từ khóa do ai định nghĩa/cập nhật? Từ tiếng Việt có dấu/không dấu/viết tắt lách luật (VD: dùng số thay chữ) có bị lọc không? Không có chi tiết kỹ thuật nào cho bộ lọc này (blacklist đơn giản hay có NLP/AI content moderation).
- Push notification hẹn giờ gửi rơi vào thời điểm cơ sở dữ liệu đang bảo trì/hệ thống quá tải — có cơ chế retry không?

### 3. Exception cases
- Gửi push hàng loạt ("Tất cả" — có thể hàng chục nghìn user theo NFR-004) thất bại một phần — theo dõi (UR-A-061④ "Số lượt gửi") có phân biệt "đã gửi thành công" và "đã cố gửi" không?
- Upload hình ảnh banner/push lỗi.

### 4. Validation cases còn thiếu
- Link đích của banner: URL hợp lệ, có kiểm tra link không dẫn tới domain độc hại (banner do Admin tự nhập link nên rủi ro thấp hơn dữ liệu do bên thứ 3 nhập, nhưng vẫn nên validate).
- Độ dài tiêu đề/nội dung push notification (giới hạn hiển thị của OS thường ~ 40-50 ký tự tiêu đề).

### 5. Business Rule còn thiếu
- Giới hạn số banner active đồng thời. *Thiếu đặc tả.*
- Danh sách từ khóa nhạy cảm được quản lý/cập nhật ở đâu, có giao diện riêng cho Admin sửa danh sách này không? *Thiếu đặc tả.*
- Review bị auto-ẩn theo từ khóa có được đưa vào hàng đợi cho Admin xem lại (double-check) hay ẩn vĩnh viễn luôn theo máy? *Thiếu đặc tả — quan trọng để tránh false positive (ẩn nhầm review hợp lệ).*

### 6. Permission Cases
- Chỉ Admin — không mâu thuẫn Permission Matrix.

### 7. Concurrency Cases
- Hai Admin cùng kiểm duyệt (duyệt/ẩn/xóa) cùng 1 review đồng thời — ai thắng, có cảnh báo review đã được xử lý bởi Admin khác chưa?

### 8. Data Integrity
- Không phát sinh vấn đề riêng đáng kể ngoài các vấn đề đã nêu ở Module 7 (Mobile, Review).

### 9. Security Risks
- Nội dung banner/push do Admin nhập — rủi ro thấp hơn nội dung user-generated, nhưng vẫn cần kiểm tra XSS nếu render rich text.
- Bộ lọc từ ngữ nhạy cảm nếu chỉ là blacklist đơn giản, dễ bị lách bằng viết tắt/chèn ký tự đặc biệt (l0z, đ**t...) — không phải rủi ro an ninh hệ thống nhưng là rủi ro nội dung độc hại lọt qua.

### 10. Performance Risks
- Gửi push hàng loạt "Tất cả" người dùng (có thể hàng chục nghìn theo NFR-004) trong 1 lần — cần hàng đợi (queue)/gửi theo lô, không thấy đề cập kiến trúc (liên hệ Module 8 Mobile, mục 10).

### 11. UI/UX Traps
- Không đáng kể.

### 12. Tester Checklist
☐ CRUD banner, hẹn giờ hiển thị, theo dõi click
☐ Nhiều banner active cùng lúc — kiểm tra thứ tự/giới hạn hiển thị
☐ Gửi push cho Tất cả/Nhóm/Cá nhân, theo dõi số gửi/đọc/click
☐ Gửi push hàng loạt, kiểm tra tỷ lệ gửi thành công thực tế
☐ Kiểm duyệt review: Duyệt/Ẩn/Xóa, kiểm tra review biến mất khỏi app đúng thời điểm
☐ Auto-filter từ ngữ nhạy cảm — thử với từ viết tắt/chèn ký tự đặc biệt để kiểm tra độ chính xác
☐ Hai Admin kiểm duyệt cùng 1 review đồng thời

### 13. Giảng viên có thể hỏi gì?
- Bộ lọc tự động ẩn bình luận nhạy cảm hoạt động theo cơ chế nào — danh sách từ khóa cố định hay có AI/NLP hỗ trợ?
- Review bị hệ thống tự động ẩn có được con người kiểm tra lại không, để tránh ẩn nhầm review hợp lệ?
- Gửi push cho toàn bộ người dùng hệ thống (có thể hàng chục nghìn người) được xử lý theo kiến trúc nào để không nghẽn hệ thống?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟡 Medium.

---
---

# PHÂN HỆ 4 & YÊU CẦU PHI CHỨC NĂNG

## MODULE API: RESTful API & Đồng bộ dữ liệu
**UR liên quan**: UR-API-001 → UR-API-003 + cây endpoint (`/auth`, `/users`, `/businesses`, `/services`, `/bookings`, `/reviews`, `/messages`, `/analytics`, `/admin`)
**Phạm vi theo URD**: REST/JSON chuẩn, versioning `/api/v1/`, JWT, rate limit 100 req/phút/user; tài liệu Swagger/OpenAPI 3.0 + sandbox; realtime qua WebSocket/SSE latency <2s + auto-reconnect.

### 1. Business cases
- Mobile App và Web Portal đồng bộ dữ liệu qua cùng 1 bộ REST API chuẩn JSON, có versioning, xác thực JWT (UR-API-001).
- Đội ngũ phát triển/đối tác tra cứu tài liệu Swagger/OpenAPI, thử nghiệm qua sandbox (UR-API-002).
- Thông báo và chat được đẩy realtime qua WebSocket/SSE với độ trễ <2 giây, tự kết nối lại khi rớt mạng (UR-API-003).

### 2. Edge cases
- **Endpoint `PUT /reviews/:id` (sửa review) tồn tại trong cây API nhưng module chức năng 3.1.7 (Review & Rating) không hề mô tả tính năng sửa review ở phía khách** — đã nêu chi tiết ở Module 7 (Mobile), nhắc lại ở đây vì đây chính là nơi định nghĩa API, cần rà soát lại toàn bộ danh sách endpoint xem còn cặp "có API nhưng thiếu FR tương ứng" nào khác không.
- Nhóm `/api/v1/bookings` chỉ có `PUT /:id (update/reschedule)` và `DELETE /:id (cancel)` — 1 endpoint PUT duy nhất phải gánh cả 2 việc rất khác nhau về nghiệp vụ: "Cơ sở xác nhận/từ chối" (đổi trạng thái) và "Khách đổi lịch" (đổi ngày giờ) và "Cơ sở đề xuất lịch mới" (UR-B-052③). Không rõ cùng 1 endpoint có phân biệt được các ngữ cảnh này bằng trường nào trong body, hay đang gộp chung logic phức tạp vào 1 endpoint — rủi ro thiết kế API không rõ ràng.
- Không thấy endpoint riêng cho "Đổi lịch định kỳ theo toàn chuỗi" (UR-C-042⑤) hay "Áp voucher" (UR-C-046) — có thể đang gộp vào `POST /bookings` (truyền `promotion_code` trong body) nhưng URD không xác nhận rõ.
- Không thấy endpoint `DELETE /reviews/:id` dù Admin cần "Xóa đánh giá vi phạm" (UR-A-062②) — Admin xóa review bằng cách nào nếu không có endpoint xóa? (Có thể dùng chung `PUT /reviews/:id` để đổi status ẩn, nhưng "Xóa" và "Ẩn" là 2 hành động khác nhau theo đúng câu chữ URD.)
- Không thấy endpoint nào cho Favorites (`POST/DELETE /favorites`) trong cây API dù `GET /favorites` có tồn tại trong nhóm `/users` — chỉ đọc được danh sách yêu thích, không thấy chỗ để thêm/xóa yêu thích trong đặc tả API (dù chắc chắn cần có).
- Không thấy endpoint đăng ký/quản lý Staff, Promotion, Media (Gallery) trong cây API dù các module W3/W4/W5 (Web Portal) chắc chắn cần CRUD cho các entity này — cây endpoint trong URD chỉ mang tính minh họa/không đầy đủ, hay đây thực sự là toàn bộ phạm vi API của Phase 1?

### 3. Exception cases
- Rate limit 100 req/phút/user áp dụng đồng đều cho mọi endpoint — 1 hành động hợp lệ nhưng cần gọi nhiều API liên tiếp trong thời gian ngắn (VD: mở trang chi tiết cơ sở gọi 5-6 API con) có dễ chạm giới hạn không, đặc biệt với khách thao tác nhanh?
- WebSocket rớt kết nối (UR-API-003③ yêu cầu auto-reconnect) — trong lúc rớt kết nối, các sự kiện (tin nhắn mới, thông báo xác nhận lịch) có bị mất vĩnh viễn hay được lưu hàng đợi và đẩy lại khi kết nối lại?
- Versioning `/api/v1/` — khi có `/api/v2/` trong tương lai, chiến lược hỗ trợ song song 2 phiên bản (để Mobile App cũ chưa cập nhật vẫn hoạt động) là gì? Không đề cập.

### 4. Validation cases còn thiếu
- Không áp dụng trực tiếp ở tầng "API" như 1 module riêng — validation cụ thể theo từng endpoint đã được liệt kê ở module chức năng tương ứng.

### 5. Business Rule còn thiếu
- Cần làm rõ endpoint `PUT /bookings/:id` phân biệt các ngữ cảnh (xác nhận/từ chối/đổi giờ/đề xuất lịch mới) bằng cơ chế nào. *Cần bổ sung.*
- Cần bổ sung endpoint quản lý Favorites, Staff, Promotion, Media nếu cây API hiện tại chưa đầy đủ (hoặc xác nhận rõ đây có phải toàn bộ phạm vi Phase 1). *Cần bổ sung.*
- Chiến lược versioning khi lên `/api/v2/`. *Thiếu đặc tả.*

### 6. Permission Cases
- Mọi endpoint cần enforce RBAC (NFR-013: Admin/Business Owner/Customer) ở tầng backend — URD chỉ nói "Authentication: JWT" (UR-API-001③) mà không xác nhận rõ **Authorization** (phân quyền theo role trong token) được thực thi tập trung (middleware chung) hay rải rác từng endpoint (dễ sót).
- Endpoint `/api/v1/admin/*` — cần đảm bảo tách bạch hoàn toàn khỏi middleware của `/users` hay `/businesses` để tránh 1 lỗi cấu hình route vô tình để lộ endpoint admin cho role thường.

### 7. Concurrency Cases
- Idempotency: các endpoint `POST` (tạo booking, tạo review...) có hỗ trợ idempotency key để chống double-submit/double-click (đã nêu nhiều lần ở các module trước) không? URD không đề cập khái niệm idempotency ở bất kỳ đâu trong toàn bộ tài liệu.

### 8. Data Integrity
- API là tầng thực thi mọi ràng buộc dữ liệu đã nêu ở các module trước (unique constraint, transaction, snapshot giá...) — nếu tài liệu API (Swagger) không đặc tả rõ response error code cho từng trường hợp vi phạm ràng buộc, FE khó xử lý đúng (VD: lỗi trùng slot nên trả `409 Conflict` cụ thể, không phải `400`/`500` chung chung) — không thấy ví dụ mã lỗi cụ thể nào trong URD.

### 9. Security Risks
- Rate limiting 100 req/phút/user (UR-API-001④, NFR-014) tính theo `user_id` — vậy trước khi đăng nhập (đăng ký/OTP) thì giới hạn theo IP hay không giới hạn (rủi ro brute-force OTP/đăng ký hàng loạt đã nêu ở Module Authentication)?
- CORS (NFR-014) — domain nào được whitelist cho Web Portal/Admin Panel? Không đề cập.
- Không thấy đề cập cơ chế chống replay attack cho JWT (VD: `jti` claim + blacklist) ngoài thời hạn tự nhiên của token.

### 10. Performance Risks
- NFR-001 (≤500ms cho 95% request) áp dụng chung cho mọi endpoint — nhưng endpoint tổng hợp nặng (dashboard analytics, danh sách booking toàn hệ thống) có khả năng khó đạt mốc này nếu không có cache/pre-aggregate riêng (đã nêu ở nhiều module Admin/Analytics) — nên có SLA riêng cho nhóm "read-heavy analytics" thay vì áp 1 chỉ số chung cho toàn bộ API.

### 11. UI/UX Traps
- Không áp dụng trực tiếp (tầng API không có UI) — nhưng lỗi API thiết kế không rõ ràng (mục 2) sẽ gián tiếp gây ra UI Trap ở tầng ứng dụng (VD: FE không biết chắc gọi đúng endpoint cho đúng hành động).

### 12. Tester Checklist
☐ Toàn bộ endpoint tuân thủ REST + JSON + versioning `/api/v1/`
☐ Rate limit 100 req/phút/user — kiểm tra chặn đúng ở request thứ 101
☐ Rate limit cho endpoint chưa đăng nhập (đăng ký/OTP) — kiểm tra có giới hạn theo IP không
☐ Test toàn bộ endpoint qua Swagger sandbox
☐ WebSocket auto-reconnect sau khi rớt mạng, kiểm tra không mất sự kiện
☐ Gọi `PUT /bookings/:id` với các payload khác nhau (xác nhận/từ chối/đổi giờ) — kiểm tra logic phân nhánh đúng
☐ Gọi endpoint admin bằng token role thường (kỳ vọng 403)
☐ Double-submit `POST /bookings` với cùng dữ liệu (kiểm tra idempotency)
☐ Đối chiếu response error code với từng loại lỗi nghiệp vụ (trùng slot, hết voucher...)

### 13. Giảng viên có thể hỏi gì?
- Endpoint `PUT /bookings/:id` xử lý bao nhiêu loại hành động khác nhau (xác nhận, từ chối, đổi giờ, đề xuất lịch mới)? Làm sao phân biệt?
- Hệ thống có dùng idempotency key để chống tạo booking trùng khi khách bấm gửi 2 lần không?
- Rate limiting áp dụng thế nào cho các request trước khi người dùng đăng nhập?
- Chiến lược khi phát hành `/api/v2/` mà vẫn phải hỗ trợ app cũ là gì?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟠 High — là xương sống kết nối Mobile App và Web Portal; thiết kế endpoint không rõ ràng (đặc biệt `PUT /bookings/:id` đa nhiệm) là rủi ro kỹ thuật âm thầm nhưng lan rộng.

---

## MODULE NFR: Yêu cầu Phi chức năng (Non-Functional Requirements)
**UR liên quan**: NFR-001 → NFR-052 (§4.1–4.6: Performance, Security, Usability, Reliability, Scalability, Compatibility)

> Module này được xử lý theo cùng khung 14 phần như các module khác để không bỏ sót, dù bản chất là yêu cầu chất lượng xuyên suốt thay vì 1 tính năng đơn lẻ.

### 1. Business cases (hệ thống đạt NFR trong vận hành bình thường)
- API phản hồi ≤500ms cho 95% request (NFR-001); trang Web tải ≤3s (NFR-002); App khởi động lạnh ≤2s (NFR-003).
- Hệ thống phục vụ ≥5.000 người dùng đồng thời (NFR-004) mà không suy giảm hiệu năng.
- Dữ liệu đồng bộ realtime ≤2s giữa các client (NFR-005).
- Toàn bộ kênh truyền mã hóa TLS 1.3 (NFR-010), mật khẩu bcrypt cost≥12 (NFR-011), JWT chuẩn (NFR-012), RBAC 3 vai trò (NFR-013).
- Uptime ≥99.5% (NFR-030), backup hàng ngày giữ 30 ngày (NFR-031), RTO≤4h/RPO≤1h (NFR-032/033).

### 2. Edge cases
- NFR-004 (≥5.000 concurrent users) là **tổng toàn hệ thống hay đồng thời tại giờ cao điểm của riêng module Booking** (nơi tải nặng nhất)? Không phân biệt read-heavy (xem trang chủ, tìm kiếm) và write-heavy (đặt lịch, thanh toán) trong cùng 1 con số — 2 loại tải này cần chiến lược hạ tầng khác nhau hoàn toàn.
- NFR-030 (uptime ≥99.5%, ≈44 giờ downtime/năm) — 44 giờ downtime nếu rơi đúng vào 1 đợt (VD: 2 ngày liên tục do sự cố lớn) so với rải đều 5 phút/ngày có ý nghĩa vận hành rất khác nhau, nhưng chỉ số uptime trung bình năm không phân biệt được 2 kịch bản này.
- NFR-022 ("luồng đặt lịch hoàn thành ≤4 bước/tap") — con số này có tính cả luồng phức tạp nhất (đặt combo + chọn nhân viên riêng từng dịch vụ + áp voucher) hay chỉ luồng đơn giản nhất (1 dịch vụ, không voucher)? Nếu áp dụng cho mọi luồng kể cả combo, đây là mục tiêu rất khó khả thi và có thể mâu thuẫn với sự đầy đủ thông tin cần thiết trước khi khách xác nhận.
- NFR-023 (WCAG 2.1 Level A — mức tối thiểu) — ngành làm đẹp có tệp khách hàng đa dạng độ tuổi (bao gồm trung niên/cao tuổi), mức "A" là mức thấp nhất trong 3 mức (A/AA/AAA); có nên cân nhắc mức AA cho 1 app hướng tới người dùng phổ thông không? (Câu hỏi mở, không phải lỗi, nhưng đáng đặt ra khi phản biện.)

### 3. Exception cases (khi không đạt NFR thì sao)
- Không có bất kỳ NFR nào mô tả **hành vi khi hệ thống không đạt được chỉ số cam kết** — VD: khi vượt 5.000 concurrent users (NFR-004), hệ thống có cơ chế graceful degradation (tắt bớt tính năng phụ, giữ tính năng lõi) hay sập hoàn toàn?
- RTO≤4h/RPO≤1h (NFR-032/033) giả định có kế hoạch Disaster Recovery đã được diễn tập — URD không đề cập tần suất diễn tập DR (drill) để đảm bảo con số 4h là khả thi trong thực tế, không chỉ trên giấy.

### 4. Validation cases còn thiếu
- Không áp dụng theo nghĩa input-validation — nhưng các "chỉ số" NFR bản thân cần được validate bằng kiểm thử hiệu năng (load test) thực tế trước khi công bố đạt chuẩn, và URD không đề cập kế hoạch/công cụ load-test (JMeter, k6, Locust...) nào.

### 5. Business Rule còn thiếu
- Định nghĩa "graceful degradation" khi vượt tải. *Cần bổ sung.*
- Tần suất diễn tập Disaster Recovery. *Thiếu đặc tả.*
- NFR-022 (≤4 bước đặt lịch) cần làm rõ áp dụng cho luồng nào (đơn giản nhất hay mọi luồng kể cả combo+voucher+chọn nhân viên riêng lẻ). *Thiếu đặc tả — có thể mâu thuẫn nội tại với độ phức tạp của chính UR-C-041/043/046.*

### 6. Permission Cases
- Không áp dụng trực tiếp.

### 7. Concurrency Cases
- NFR-004 (5.000 concurrent users) chính là bối cảnh nền cho **mọi** race condition đã liệt kê xuyên suốt các module (đặt trùng slot, overselling voucher...) — các lỗ hổng concurrency ở từng module sẽ bộc lộ rõ nhất chính xác ở ngưỡng tải này; NFR nên yêu cầu kèm theo test plan concurrency cụ thể, không chỉ là 1 con số tải thuần túy.

### 8. Data Integrity
- NFR-042 ("Database hỗ trợ sharding/replication khi cần") — nếu áp dụng replication, cần làm rõ chiến lược đọc/ghi (read replica có độ trễ, đọc dữ liệu "khung giờ trống" từ replica có nguy cơ đọc dữ liệu cũ hơn vài trăm ms, làm trầm trọng thêm race condition đặt trùng slot đã nêu ở Module Booking) — đây là 1 điểm giao thoa quan trọng giữa NFR Scalability và lỗ hổng Concurrency ở module core.

### 9. Security Risks
- NFR-015 dẫn sai tên văn bản pháp luật và thiếu nhiều nghĩa vụ mới — đã phân tích đầy đủ ở file `00_TongQuan_PhuongPhap.md` mục 0.4.E, đây là phát hiện quan trọng nhất của toàn bộ nhóm NFR.
- NFR-013 (RBAC 3 vai trò: Admin/Business Owner/Customer) — không có vai trò "Staff" trong danh sách này dù URD có nhắc "Nhân viên/Thợ" như 1 stakeholder ở §1.3 — củng cố thêm cho lỗ hổng 0.4.J (Staff không có tài khoản/vai trò hệ thống riêng).

### 10. Performance Risks
- Đã nêu ở mục 2 — thiếu phân tách read-heavy/write-heavy trong định nghĩa tải hệ thống.

### 11. UI/UX Traps
- Không áp dụng trực tiếp.

### 12. Tester Checklist
☐ Load test đạt ≥5.000 concurrent users, đo % request ≤500ms
☐ Đo thời gian tải trang Web (FCP) và cold-start App trên thiết bị tầm trung (không chỉ máy cấu hình cao)
☐ Kiểm tra hành vi hệ thống khi vượt ngưỡng tải thiết kế (graceful degradation hay sập)
☐ Diễn tập khôi phục sự cố, đo RTO/RPO thực tế so với cam kết
☐ Kiểm tra luồng đặt lịch phức tạp nhất (combo+nhân viên riêng+voucher) có thực sự ≤4 bước
☐ Audit kênh mã hóa TLS 1.3 trên mọi endpoint, không có endpoint nào rơi về HTTP
☐ Kiểm tra accessibility ở mức WCAG 2.1 A (contrast, alt-text, keyboard navigation)
☐ Kiểm tra tài liệu/thực hành tuân thủ Luật Bảo vệ dữ liệu cá nhân 2025 thay vì chỉ "PDPA"

### 13. Giảng viên có thể hỏi gì?
- Khi hệ thống vượt quá 5.000 người dùng đồng thời, điều gì xảy ra — có cơ chế giảm tải ưu tiên tính năng lõi không?
- NFR-015 ghi "PDPA Vietnam" — bạn có biết tên chính xác của văn bản pháp luật Việt Nam áp dụng ở đây là gì không, và luật đó có những nghĩa vụ nào chưa được phản ánh trong thiết kế?
- Chỉ tiêu "đặt lịch ≤4 bước" có còn khả thi với luồng đặt combo nhiều dịch vụ, chọn nhân viên riêng từng dịch vụ, và áp voucher không?
- Nếu dùng read replica cho database, việc đọc "khung giờ trống" có nguy cơ đọc phải dữ liệu cũ không, và điều đó ảnh hưởng gì đến race condition đặt trùng lịch?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟠 High — riêng phát hiện NFR-015 (pháp lý) và thiếu graceful-degradation là 🔴 Critical về rủi ro pháp lý/vận hành khi lên production thật.
