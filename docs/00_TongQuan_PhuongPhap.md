# PHẢN BIỆN ĐỒ ÁN & QA REVIEW — HỆ THỐNG "BeautyBook"
### Vai trò: Senior BA + Senior SA + QA Lead (góc nhìn phản biện đồ án)
### Đối tượng phân tích: `BeautyBook_URD.docx` (v1.0, 02/07/2026) + `GlowBook.jsx` (bản mock Web Portal/Admin)
### Nguyên tắc làm việc: KHÔNG sửa tài liệu — chỉ tìm lỗi, thiếu sót, logic chưa chặt, business rule chưa định nghĩa. KHÔNG thêm chức năng ngoài phạm vi URD.

---

## 0.1. Bộ tài liệu này gồm 4 phần

| File | Nội dung |
|---|---|
| **00_TongQuan_PhuongPhap.md** (file này) | Cách đọc bộ tài liệu, bức tranh hệ thống, và **10 lỗ hổng liên-module** (ảnh hưởng nhiều module cùng lúc — đọc trước để không bị lặp lại 24 lần) |
| **01_MobileApp_KhachHang.md** | Phân tích đầy đủ 9 module Mobile App (khách hàng) — Authentication → Favorites & Share |
| **02_WebPortal_Admin_API.md** | Phân tích đầy đủ 7 module Web Portal (cơ sở) + 7 module Web Admin + module API + module NFR |
| **03_TongHop_Top100_Top50.md** | TOP 100 trường hợp dễ gây lỗi nhất · TOP 50 câu hỏi phản biện · đối chiếu `GlowBook.jsx` với URD (phần mở rộng) |

Tổng cộng bộ tài liệu bao quát **24 module** trong URD (không tính các mục kiến trúc như Data Model, Booking Status Flow, Permission Matrix — các mục này được xử lý riêng ở mục 0.4 vì chúng là nền tảng xuyên suốt, không phải "module" theo nghĩa User Story).

## 0.2. Quy ước mức độ nghiêm trọng

Khác với cách gắn màu cảm tính, mức độ dưới đây được gán theo **tác động thực tế nếu lỗi xảy ra trong production**:

| Ký hiệu | Mức | Tiêu chí gán |
|---|---|---|
| 🔴 **Critical** | Sai dữ liệu tiền/lịch, mất tiền, lộ dữ liệu cá nhân, một người dùng thao túng được dữ liệu người khác, hệ thống crash/deadlock | 
| 🟠 **High** | Sai lệch trải nghiệm cốt lõi (đặt lịch, thanh toán, xác nhận), khách/cơ sở bị chặn không thao tác được, vi phạm pháp luật hiện hành |
| 🟡 **Medium** | Trải nghiệm xấu nhưng có đường lui (retry, refresh), sai UI/UX, thiếu thông báo rõ ràng |
| 🟢 **Low** | Hiếm gặp, ảnh hưởng nhỏ, hoặc chỉ là thiếu tối ưu |

## 0.3. Bức tranh hệ thống (tóm tắt để đối chiếu nhanh)

- **4 phân hệ**: Mobile App (Khách hàng, 9 module, 27 UR) · Web Portal (Cơ sở, 7 module, 14 UR) · Web Admin Panel (7 module, 14 UR) · RESTful API (3 UR + 8 nhóm endpoint).
- **5 thực thể có attribute chi tiết**: USER, BUSINESS, SERVICE, BOOKING, REVIEW. **8 thực thể chỉ xuất hiện trong bảng quan hệ, KHÔNG có attribute**: STAFF, PROMOTION, MEDIA, CATEGORY, DISTRICT, BOOKING_ITEM, SCHEDULE, FAVORITE, MESSAGE (xem 0.4.B — đây là gốc của rất nhiều lỗi Database Logic ở các module phía sau).
- **Vòng đời Booking** (suy ra từ §7 sơ đồ + UR-B-051): `Chờ xác nhận → Đã xác nhận → Đang thực hiện → Hoàn thành`, với các nhánh `Đã hủy` và `No-show`. Sơ đồ ở §7 chỉ minh họa bằng hình, không có bảng liệt kê điều kiện chuyển trạng thái bằng văn bản — bản thân đây đã là một khoảng trống đặc tả (xem 0.4.C).
- **Thanh toán**: Phase 1 **không** có thanh toán online — khách trả tiền trực tiếp tại cơ sở (Ràng buộc #3). Điều này va vào rất nhiều rule khác (xem 0.4.A — mâu thuẫn lớn nhất của toàn bộ URD).
- **Bản mock `GlowBook.jsx`**: chỉ dựng UI cho Web Portal (cơ sở) và Web Admin, chưa đụng tới Mobile App/API; tự ghi chú "Bản demo giao diện · chỉ Front-end", toàn bộ state là mock `useState` trong bộ nhớ, không gọi API thật. Đối chiếu chi tiết ở file 03.

## 0.4. MƯỜI LỖ HỔNG LIÊN-MODULE (đọc trước, vì các module sau sẽ liên tục trỏ lại đây)

### A. 🔴 Mâu thuẫn "phí hủy" với việc chưa tích hợp thanh toán online
UR-C-044 quy định: *"Hủy lịch trước < 2 giờ: Cảnh báo, có thể bị tính phí hủy"*. Nhưng Ràng buộc #3 nói rõ Phase 1 **chưa có thanh toán online** — khách trả tiền mặt/thẻ trực tiếp tại cơ sở. Vậy hệ thống **thu phí hủy bằng cách nào** khi chưa từng giữ tiền/thẻ của khách? Đây không phải edge case nhỏ — đây là một **business rule tự mâu thuẫn ngay trong Phase 1 MVP**. Cần làm rõ: phí hủy có ý nghĩa gì nếu không thể thu (chỉ là "đánh dấu nợ" để cơ sở tự xử lý ngoài hệ thống? Hay chặn khách không cho đặt lịch tiếp?). Nếu không có cơ chế cưỡng chế, rule này vô nghĩa trong Phase 1 và các Acceptance Criteria đang mô tả một tính năng chưa thể hiện thực hoá.

### B. 🔴 Mô hình dữ liệu: 8/13 thực thể không có attribute
§6.2 chỉ mô tả chi tiết USER, BUSINESS, SERVICE, BOOKING, REVIEW. §6.3 liệt kê quan hệ có nhắc tới STAFF, PROMOTION, MEDIA, CATEGORY, DISTRICT, BOOKING_ITEM, SCHEDULE, FAVORITE, MESSAGE nhưng **không một thực thể nào trong số này có bảng attribute**. Hệ quả dây chuyền:
- Không rõ **SCHEDULE** (ca làm việc nhân viên) có trường nào để tính "khung giờ trống" — nền tảng của module Booking (core).
- Không rõ **BOOKING_ITEM** có trường `staff_id` riêng theo từng dịch vụ không — mà UR-C-043 lại yêu cầu *"chọn nhân viên cho từng dịch vụ"* trong combo. Nếu BOOKING chỉ có 1 `staff_id` (theo §6.2) mà combo cần nhiều nhân viên khác nhau cho từng dịch vụ, **schema hiện tại của BOOKING mâu thuẫn với chính UR-C-043**.
- Không rõ **PROMOTION** có trường giới hạn số lần dùng/user, ngày hết hạn giờ (hay chỉ ngày), loại giảm (%, tiền, tặng dịch vụ) được lưu như thế nào để hệ thống validate.
- Không rõ **STAFF** có trường `status` (đang làm/nghỉ phép/nghỉ việc — theo UR-B-030 ③) được dùng để tự động ẩn khỏi danh sách chọn nhân viên khi đặt lịch hay không.
→ Đây là câu hỏi phản biện cực mạnh: *"Sinh viên thiết kế database dựa trên 5 thực thể có attribute, hay tự suy diễn cho 8 thực thể còn lại?"*

### C. 🟠 Booking Status Flow: chỉ có hình vẽ, không có bảng chuyển trạng thái bằng văn bản
§7 chỉ có 1 hình sơ đồ trạng thái, không có bảng liệt kê: (1) role nào được phép trigger chuyển trạng thái nào, (2) trạng thái nào có thể quay lui (VD: "Đã xác nhận" → "Chờ xác nhận" khi đổi lịch có xảy ra không?), (3) "No-show" được set tự động (theo giờ) hay do cơ sở bấm tay, và sau bao lâu kể từ giờ hẹn thì hệ thống tự chuyển sang No-show nếu cơ sở không xác nhận trạng thái "Đang thực hiện"/"Hoàn thành". Không có time-out rule nào cho trạng thái "Chờ xác nhận" (nếu cơ sở không phản hồi bao lâu thì booking tự huỷ?).

### D. 🔴 Ranh giới "Quận/Huyện" dùng để lọc khu vực đã bị bãi bỏ trên thực tế
UR-C-011③, UR-C-012④, UR-C-021, và UR-A-041 đều dựa vào đơn vị **quận/huyện** để lọc/phân loại khu vực; UR-A-041① còn ghi cứng "*Danh sách 21 quận + 5 huyện TP.HCM*". Trên thực tế, **kể từ 01/07/2025, Việt Nam đã bỏ hoàn toàn cấp hành chính quận/huyện trên toàn quốc**, chuyển sang mô hình 2 cấp (Tỉnh/Thành phố → Phường/Xã); riêng TP.HCM còn được sáp nhập với Bình Dương và Bà Rịa – Vũng Tàu thành một "siêu đô thị" với **168 đơn vị hành chính cấp xã (phường/xã)**, không còn quận/huyện nào cả. URD này được tạo ngày 02/07/2026 — tức **hơn 1 năm sau** khi thay đổi hành chính này có hiệu lực — nhưng vẫn dựa toàn bộ bộ lọc khu vực trên một cấp hành chính không còn tồn tại. Đây là lỗi nghiêm trọng nhất về "tính đúng với thực tế" của toàn bộ URD, ảnh hưởng dây chuyền tới: Home & Discovery (lọc theo khu vực), Search (bộ lọc "Khu vực"), Business Detail (địa chỉ), Category Management admin (danh mục Quận/Huyện), và toàn bộ giả định bán kính tìm kiếm 1–10km (vì địa giới mới rộng hơn rất nhiều so với TP.HCM cũ 2.061 km²).

### E. 🟠 NFR-015 dẫn sai văn bản pháp luật & thiếu nghĩa vụ mới theo luật hiện hành
NFR-015 ghi *"Tuân thủ bảo mật dữ liệu cá nhân (PDPA Vietnam)"* — "PDPA" không phải tên văn bản pháp luật của Việt Nam (đây là thuật ngữ của Singapore/Thái Lan). Văn bản áp dụng thực tế là **Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15**, có hiệu lực từ **01/01/2026** (song song với Nghị định 13/2023/NĐ-CP trong giai đoạn chuyển tiếp) — tức đã có hiệu lực **6 tháng** trước khi URD này được viết. Ngoài việc gọi sai tên, URD hoàn toàn chưa đề cập các nghĩa vụ cụ thể mà luật mới đặt ra và rất liên quan tới BeautyBook:
- **Dữ liệu nhạy cảm**: ảnh before/after của dịch vụ thẩm mỹ viện (tiêm filler, botox, phun xăm) có thể bị coi là dữ liệu liên quan sức khỏe → cần cơ chế xin sự đồng ý **rõ ràng bằng văn bản/tại thời điểm thu thập**, không chỉ một checkbox "consent" chung như UR-B-040④.
- **Dữ liệu trẻ em**: UR-C-001① thu thập `ngày sinh` khi đăng ký nhưng không có bất kỳ rule tuổi tối thiểu hay cơ chế đồng ý của người giám hộ — trong khi luật mới có quy định bảo vệ riêng cho dữ liệu trẻ em.
- **Quyền được xóa dữ liệu / quyền được quên**: URD không có bất kỳ tính năng "xoá tài khoản" hoặc "yêu cầu xoá dữ liệu cá nhân" nào ở Mobile App hay Admin.
- **Chuyển dữ liệu xuyên biên giới**: nếu hạ tầng đặt ở nước ngoài (AWS Singapore chẳng hạn), cần đánh giá tác động chuyển dữ liệu xuyên biên giới — URD không đề cập hạ tầng lưu trữ ở đâu.
- **Nhân sự/bộ phận bảo vệ dữ liệu cá nhân**: doanh nghiệp (tùy quy mô) có thể phải chỉ định người/bộ phận phụ trách — không có trong URD.

### F. 🟠 Quan hệ giữa "tài khoản Khách hàng" (App, SĐT+OTP) và "tài khoản Cơ sở" (Web, email+password) chưa rõ
Authentication module (3.1.1) mô tả đăng ký/đăng nhập bằng **SĐT + OTP**. Nhưng bản mock `GlowBook.jsx` cho thấy Web Portal đăng nhập bằng **email + password** (`belle.hair@glowbook.vn`). USER entity (§6.2) có trường `role` (enum) dùng chung, nhưng BUSINESS lại là một entity hoàn toàn tách biệt với USER. Vậy: Chủ cơ sở có phải là một dòng trong bảng USER với `role = business` rồi sở hữu 1 BUSINESS, hay có hệ thống tài khoản Business hoàn toàn riêng (không đi qua USER)? Nếu tách riêng, 2 hệ thống auth khác nhau (SĐT/OTP vs email/password) có dùng chung JWT scheme, chung Access/Refresh Token TTL (NFR-012) không? Nếu 1 SĐT vừa là khách vừa đứng tên đăng ký kinh doanh, hệ thống xử lý ra sao? URD không trả lời câu nào trong số này.

### G. 🟠 Không có "snapshot giá" tại thời điểm đặt lịch
UR-B-011④ cho phép cơ sở "**cập nhật giá tức thì**". UR-C-040③ hiển thị "tổng chi phí dự kiến" tại thời điểm đặt. BOOKING chỉ lưu `total_amount` (một số tiền tổng, không lưu breakdown giá từng dịch vụ tại thời điểm đặt). Vậy nếu cơ sở đổi giá dịch vụ **sau khi** khách đã đặt lịch nhưng **trước khi** đến ngày hẹn, khách phải trả theo giá nào — giá lúc đặt hay giá hiện tại? URD không có rule "khóa giá tại thời điểm đặt" (price lock/snapshot), và vì không lưu breakdown, hệ thống thậm chí không có dữ liệu để biết giá ban đầu là bao nhiêu nếu cần đối soát/khiếu nại.

### H. 🟡 Không có khái niệm thời gian đệm (buffer) giữa 2 lịch hẹn liên tiếp
Không module nào (Booking, Service Management, Staff Management) đề cập thời gian nghỉ/dọn dẹp giữa 2 khách liên tiếp của cùng 1 nhân viên. Với `duration_minutes` cố định trên SERVICE và slot tối thiểu 30 phút (Giả định #5), hệ thống có thể xếp 2 lịch sát nhau 0 phút — không thực tế với ngành làm đẹp (cần thời gian dọn ghế, rửa tay, chuẩn bị dụng cụ).

### I. 🔴 Không có rule xử lý sau khi Booking bị đánh dấu "No-show"
Trạng thái "No-show" xuất hiện trong UR-B-051③ nhưng không có bất kỳ đặc tả nào về: ai/khi nào được đánh dấu No-show, khách có bị phạt/giới hạn đặt lịch trong tương lai không, cơ sở có được bù gì không, và No-show có tính vào "tỷ lệ hủy" ảnh hưởng tới ranking cơ sở trên app không (SalonStats trong `GlowBook.jsx` thậm chí có KPI "Tỉ lệ huỷ lịch" — cho thấy chỉ số này được kỳ vọng tồn tại — nhưng URD không định nghĩa công thức tính, và không rõ No-show được tính là "hủy" hay một loại riêng).

### J. 🟡 Đa-vai-trò & đa-sở-hữu chưa được xác nhận
URD không nói rõ: (1) một cơ sở có thể do nhiều tài khoản cùng quản lý không (chủ + quản lý chi nhánh)? (2) một chủ có thể sở hữu nhiều cơ sở (nhiều chi nhánh) trên cùng 1 tài khoản không? (3) Nhân viên/Thợ có tài khoản đăng nhập riêng để tự xem lịch của mình không, hay 100% do chủ cơ sở nhập liệu thủ công qua Web Portal (theo §1.3, có vẻ là "có" — nhân viên không có bất kỳ nền tảng truy cập nào được liệt kê)? Nếu đúng vậy, cơ sở có nhiều nhân viên sẽ có một điểm nghẽn (bottleneck) duy nhất là chủ cơ sở phải tự cập nhật lịch nghỉ/ca làm cho toàn bộ nhân viên.

---

Chi tiết theo từng module (bao gồm cách các lỗ hổng A–J ở trên thể hiện cụ thể trong từng module) được trình bày ở file **01_MobileApp_KhachHang.md** và **02_WebPortal_Admin_API.md**.
