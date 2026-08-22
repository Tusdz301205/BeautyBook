# TỔNG HỢP: TOP 100 LỖI · TOP 50 CÂU HỎI PHẢN BIỆN · ĐỐI CHIẾU IMPLEMENTATION

## Cách dùng file này
Đây là bản tổng hợp rút gọn từ toàn bộ phân tích chi tiết ở file `01_MobileApp_KhachHang.md` và `02_WebPortal_Admin_API.md`. Mỗi dòng trong 2 bảng TOP 100/TOP 50 đều có thể tra cứu lại phần giải thích đầy đủ trong 2 file đó theo tên module ghi kèm. Dùng file này để **ôn nhanh trước buổi bảo vệ**; dùng 2 file kia để **hiểu sâu và trả lời chi tiết** khi bị hỏi xoáy.

---

# PHẦN 1: TOP 100 TRƯỜNG HỢP DỄ GÂY LỖI NHẤT CỦA HỆ THỐNG

Sắp xếp theo nhóm chủ đề (không theo module) để thấy rõ các lỗi cùng bản chất kỹ thuật, dù nằm ở module khác nhau, thường có cùng 1 nguyên nhân gốc.

## Nhóm A — Lỗ hổng kiến trúc/nền tảng (ảnh hưởng nhiều module cùng lúc)

| # | Trường hợp | Module liên quan | Mức độ |
|---|---|---|---|
| 1 | Phí hủy lịch (<2 giờ) không có cơ chế thu khi Phase 1 chưa có thanh toán online | Booking, W6 | 🔴 |
| 2 | 8/13 thực thể (STAFF, PROMOTION, MEDIA, CATEGORY, DISTRICT, BOOKING_ITEM, SCHEDULE, FAVORITE, MESSAGE) không có attribute trong Data Model | Toàn hệ thống | 🔴 |
| 3 | Booking Status Flow chỉ có hình vẽ, không có bảng quy tắc chuyển trạng thái bằng văn bản (ai được trigger, có timeout không) | Booking, My Bookings, W6 | 🟠 |
| 4 | Bộ lọc "Quận/Huyện" dựa trên đơn vị hành chính đã bị bãi bỏ toàn quốc từ 01/07/2025; TP.HCM sau sáp nhập còn 168 phường/xã, không còn quận/huyện | Home&Discovery, Search, Category Mgmt (A5) | 🔴 |
| 5 | NFR-015 ghi sai tên luật ("PDPA Vietnam") — luật áp dụng là Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực 01/01/2026); thiếu nghĩa vụ về dữ liệu nhạy cảm, dữ liệu trẻ em, quyền xóa dữ liệu | NFR, Authentication, Media | 🟠 |
| 6 | Quan hệ giữa tài khoản Khách (SĐT+OTP) và tài khoản Cơ sở (email+password) không rõ có chung bảng USER hay tách biệt | Authentication, W1 | 🟠 |
| 7 | Không có snapshot giá dịch vụ tại thời điểm đặt lịch — đổi giá sau khi khách đặt sẽ gây tranh chấp | Booking, Business Detail, W2 | 🟠 |
| 8 | Không có khái niệm buffer time giữa 2 lịch hẹn liên tiếp của cùng 1 nhân viên | Booking, W4 | 🟡 |
| 9 | Không có bất kỳ rule nào xử lý hệ quả sau khi Booking bị đánh dấu "No-show" (phạt, giới hạn, ảnh hưởng ranking) | Booking, My Bookings, W6 | 🔴 |
| 10 | Không rõ 1 người có thể vừa là khách vừa đứng tên cơ sở, hay 1 người sở hữu nhiều cơ sở | Authentication, W1 | 🟡 |

## Nhóm B — Race Condition & Concurrency

| # | Trường hợp | Module liên quan | Mức độ |
|---|---|---|---|
| 11 | Hai khách đặt cùng slot (cùng nhân viên, cùng giờ) — không có lock/transaction/unique constraint nào được đặc tả | Booking | 🔴 |
| 12 | Khách đổi lịch đúng lúc cơ sở hủy lịch đó — không rõ ai thắng | Booking, W6 | 🟠 |
| 13 | Cơ sở đổi giá dịch vụ đúng lúc khách đang ở bước checkout | Booking, W2 | 🟠 |
| 14 | Nhiều khách cùng dùng 1 voucher khi chỉ còn 1 lượt — race condition đọc-kiểm tra-trừ lượt (overselling voucher) | W3 (Promotion) | 🔴 |
| 15 | Hai Admin cùng duyệt/từ chối cùng 1 hồ sơ cơ sở đồng thời | W1, A2 | 🟠 |
| 16 | Double-click nút "Xác nhận đặt lịch" — không có debounce/idempotency key | Booking | 🟠 |
| 17 | Đặt lịch định kỳ tạo N booking trong 1 transaction — 1 lần trùng slot thì rollback toàn bộ hay giữ các lần hợp lệ? | Booking | 🟡 |
| 18 | Hai request đăng ký cùng 1 SĐT gửi đồng thời (double-submit) | Authentication | 🟠 |
| 19 | Đọc "khung giờ trống" từ read replica (nếu có) có độ trễ, làm trầm trọng thêm race condition đặt trùng slot | Booking, NFR (Scalability) | 🟠 |
| 20 | Chủ cơ sở xóa dịch vụ đúng lúc khách đang hoàn tất bước cuối luồng đặt lịch chọn đúng dịch vụ đó | Booking, W2 | 🟠 |
| 21 | Admin đang khóa 1 cơ sở đúng lúc app đang render section "nổi bật" chứa cơ sở đó | Home&Discovery, A2 | 🟡 |
| 22 | Kéo-thả đổi ca làm việc nhân viên đúng lúc khách đang xem lịch trống của nhân viên đó | W4, Booking | 🟠 |

## Nhóm C — Business Rule còn thiếu (chưa được URD định nghĩa)

| # | Trường hợp | Module liên quan | Mức độ |
|---|---|---|---|
| 23 | Khách được đổi lịch tối đa bao nhiêu lần? (Hiện tại: không giới hạn) | Booking | 🟠 |
| 24 | Khách được hủy lịch tối đa bao nhiêu lần/tháng trước khi bị hạn chế? | Booking | 🟡 |
| 25 | Voucher dùng được nhiều lần trên 1 tài khoản không, hay chỉ 1 lần? | W3 | 🟠 |
| 26 | Một Booking được áp tối đa mấy voucher — ER diagram ngụ ý 1 nhưng FR không phát biểu rõ | Booking, W3 | 🟡 |
| 27 | Thuật toán phân bổ nhân viên khi khách chọn "Bất kỳ" hoàn toàn chưa được đặc tả | Booking | 🟠 |
| 28 | Timeout cho trạng thái "Chờ xác nhận" nếu cơ sở không phản hồi | Booking, W6 | 🟠 |
| 29 | Khi nhân viên nghỉ đột xuất, các booking tương lai đã gán nhân viên đó xử lý ra sao (tự động hay chủ cơ sở xử lý tay)? | W4 | 🔴 |
| 30 | Khóa 1 cơ sở đang có booking tương lai — các booking đó xử lý thế nào? | A2 | 🔴 |
| 31 | Review có sửa được không? API có `PUT /reviews/:id` nhưng FR không đề cập | Review, API | 🟠 |
| 32 | Giá combo có bị cưỡng chế nhỏ hơn tổng giá lẻ không, hay chỉ là gợi ý? | W2 | 🟡 |
| 33 | Xóa dịch vụ đang có booking tương lai: chặn hay cho xóa (soft-delete)? | W2 | 🟠 |
| 34 | 1 khách viết được bao nhiêu review cho cùng 1 dịch vụ? | Review | 🟡 |
| 35 | Cơ sở có được phản hồi (reply) lại review của khách không — hoàn toàn vắng mặt trong URD | Review | 🟡 |
| 36 | "Đề xuất lịch mới" qua chat có tự tạo booking mới ở trạng thái chờ hay chỉ là tin nhắn tự do? | Notification&Messaging, W6 | 🟠 |
| 37 | Admin không có quyền sửa booking để giải quyết tranh chấp khách–cơ sở — vậy cơ chế dispute-resolution nằm ở đâu? | A4 | 🟠 |

## Nhóm D — Data Integrity

| # | Trường hợp | Module liên quan | Mức độ |
|---|---|---|---|
| 38 | REVIEW không có `booking_id` — không thể xác nhận khách đã thực sự dùng dịch vụ trước khi review (review khống) | Review | 🔴 |
| 39 | BOOKING chỉ có 1 `staff_id` nhưng combo yêu cầu chọn nhân viên riêng cho từng dịch vụ (UR-C-043) | Booking | 🔴 |
| 40 | BOOKING không có `end_datetime`/`duration_minutes` — không đủ dữ liệu kiểm tra chồng chéo lịch | Booking | 🟠 |
| 41 | BOOKING_ITEM không có attribute — không rõ có lưu snapshot giá/thời lượng/nhân viên tại thời điểm đặt | Booking | 🟠 |
| 42 | Booking định kỳ không có `recurrence_id`/`parent_booking_id` để nhóm "toàn bộ chuỗi" khi sửa/hủy | Booking | 🟠 |
| 43 | `USER.email` không có Unique Key trong khi `USER.phone` có — 2 tài khoản có thể trùng email | Authentication | 🟡 |
| 44 | BUSINESS không có trường lưu "ngày nghỉ/lịch hoạt động đặc biệt" dù UR-B-002③ yêu cầu tính năng này | Business Detail, W1 | 🟠 |
| 45 | Giá theo phân loại (nam/nữ, tóc ngắn/dài — UR-B-011②) không có cấu trúc lưu trong SERVICE (chỉ có 1 khoảng giá) | W2 | 🟠 |
| 46 | 2 nguồn giá khuyến mãi (`SERVICE.promo_price` và PROMOTION) chồng lấn, không rule nào nói nguồn nào ưu tiên | Business Detail, W2, W3 | 🟡 |
| 47 | Xóa cơ sở (hard-delete) làm mất lịch sử SERVICE/STAFF/BOOKING/REVIEW liên quan nếu không cascade đúng | W1, A2 | 🟠 |
| 48 | Không rõ trạng thái nhân viên (Nghỉ phép) có mốc thời gian tự động hết hạn hay phải đổi tay 2 lần | W4 | 🟡 |
| 49 | Không rõ lượt dùng voucher có được hoàn lại khi booking dùng voucher đó bị hủy/từ chối | W3, W6 | 🟠 |

## Nhóm E — Security Risks

| # | Trường hợp | Module liên quan | Mức độ |
|---|---|---|---|
| 50 | OTP brute-force — không thấy rate-limit riêng cho endpoint verify-otp | Authentication | 🟠 |
| 51 | Token replay: Access/Refresh Token bị đánh cắp, không có cơ chế revoke theo thiết bị | Authentication | 🟠 |
| 52 | IDOR trên `booking_id` — khách A xem/sửa/hủy booking của khách B qua đoán ID | My Bookings, Booking | 🔴 |
| 53 | IDOR trên hồ sơ/báo cáo cơ sở — cơ sở B xem dashboard/doanh thu của cơ sở A | W7, W1, W2 | 🟠 |
| 54 | Upload file giả dạng ảnh (chỉ kiểm tra đuôi file, không kiểm tra magic bytes) — nguy cơ upload shell | Media Management (W5) | 🟠 |
| 55 | XSS qua mô tả dịch vụ/cơ sở do chủ cơ sở tự nhập, không thấy sanitize | Business Detail, W2 | 🟡 |
| 56 | Rò rỉ EXIF/GPS trong ảnh before/after upload từ điện thoại khách/cơ sở | Media Management (W5) | 🟡 |
| 57 | Không phân cấp quyền Admin nội bộ (Super Admin vs vận hành) — 1 tài khoản Admin có toàn quyền Xóa/Khóa | A2, A3 | 🟠 |
| 58 | Khóa tài khoản người dùng không kick session ngay — token cũ còn hiệu lực tối đa 15 phút sau khi bị khóa | A3 | 🟠 |
| 59 | Không có audit log khi Admin xem/tìm kiếm dữ liệu nhạy cảm của người dùng/cơ sở | A4 | 🟠 |
| 60 | Không kiểm duyệt nội dung chat — kênh có thể bị lợi dụng lừa đảo/dụ giao dịch ngoài hệ thống | Notification&Messaging | 🟠 |
| 61 | Admin không có quyền xem chat để can thiệp khi có tranh chấp/lừa đảo qua tin nhắn | Notification&Messaging | 🟡 |
| 62 | Giả mạo hồ sơ đăng ký kinh doanh (giấy phép chỉnh sửa) — không có xác minh tự động | W1 | 🟠 |
| 63 | Client có thể gửi thẳng `total_amount` lên server thay vì để server tự tính lại giá | Booking | 🔴 |
| 64 | Brute-force mã voucher ngắn/dễ đoán nếu sinh theo pattern dự đoán được | W3 | 🟡 |

## Nhóm F — Permission Cases

| # | Trường hợp | Module liên quan | Mức độ |
|---|---|---|---|
| 65 | Permission Matrix: Admin chỉ "xem" dịch vụ/giá, không có quyền ẩn/sửa dịch vụ vi phạm | W2 | 🟠 |
| 66 | Permission Matrix: Admin chỉ "xem" khuyến mãi, không gỡ được chương trình khuyến mãi sai sự thật | W3 | 🟡 |
| 67 | Permission Matrix: Admin hoàn toàn không có quyền với Chat/Nhắn tin | Notification&Messaging | 🟡 |
| 68 | Cơ sở B thao tác (sửa/xóa/xem) dữ liệu (dịch vụ, nhân viên, booking, báo cáo) của cơ sở A qua gọi API trực tiếp — lặp lại ở hầu hết module Web Portal | W1–W7 | 🔴 |
| 69 | Guest (chưa đăng nhập) xem trang chủ/chi tiết cơ sở — chưa rõ có bắt buộc đăng nhập hay không | Home&Discovery, Business Detail | 🟢 |
| 70 | Nhân viên/Thợ không có tài khoản đăng nhập riêng — không có khái niệm "quyền của nhân viên với lịch của chính mình" | W4 | 🟡 |

## Nhóm G — Validation Cases còn thiếu

| # | Trường hợp | Module liên quan | Mức độ |
|---|---|---|---|
| 71 | Giảm giá dịch vụ >100% hoặc âm — **xác nhận là bug thật trong `GlowBook.jsx`** (input không có min/max) | W2 | 🔴 |
| 72 | `price_from` > `price_to` không được validate | W2, Business Detail | 🟡 |
| 73 | `duration_minutes` = 0 hoặc âm | W2, Booking | 🟠 |
| 74 | Định dạng SĐT Việt Nam không được quy định rõ | Authentication | 🟢 |
| 75 | Độ mạnh mật khẩu không có tiêu chí | Authentication | 🟡 |
| 76 | Ngày sinh trong tương lai hoặc tuổi phi thực tế | Authentication | 🟢 |
| 77 | Giới hạn số dịch vụ tối đa trong 1 combo (hiện không giới hạn) | Booking | 🟡 |
| 78 | Số lần lặp tối đa cho đặt lịch định kỳ (hiện không giới hạn — "cho đến khi hủy" vô thời hạn) | Booking | 🟡 |
| 79 | Giới hạn số lượt sử dụng voucher = 0 hoặc âm không được chặn | W3 | 🟢 |
| 80 | Bình luận review vượt quá 500 ký tự — chỉ validate FE hay cả BE? | Review | 🟡 |

## Nhóm H — Performance Risks

| # | Trường hợp | Module liên quan | Mức độ |
|---|---|---|---|
| 81 | Truy vấn "khung giờ trống" cần geospatial/index tối ưu trên (`staff_id`, thời gian) — điểm nghẽn lớn nhất hệ thống ở giờ cao điểm | Booking | 🔴 |
| 82 | Truy vấn "cơ sở trong bán kính Xkm" trên địa giới đã mở rộng rất nhiều sau sáp nhập hành chính | Home&Discovery | 🟠 |
| 83 | Autocomplete gọi API mỗi keystroke nếu không debounce — dễ chạm rate-limit 100 req/phút | Search | 🟡 |
| 84 | Gửi push notification hàng loạt (toàn hệ thống) không có kiến trúc hàng đợi (queue) rõ ràng | Notification&Messaging, A7 | 🟠 |
| 85 | Tính `avg_rating` real-time trên cơ sở có hàng nghìn review không có chiến lược cache/pre-aggregate | Review, Business Detail | 🟡 |
| 86 | Dashboard/Analytics tính aggregate nhiều chiều trực tiếp trên bảng giao dịch chính (OLTP), không có data warehouse riêng | W7, A1, A6 | 🟡 |
| 87 | Kết nối WebSocket đồng thời cho ≥5.000 user — chưa có kiến trúc scale-out được đặc tả | Notification&Messaging, NFR | 🟠 |
| 88 | Không có kế hoạch load-test/công cụ cụ thể để xác nhận các chỉ số NFR khả thi trong thực tế | NFR | 🟡 |

## Nhóm I — UI/UX Traps

| # | Trường hợp | Module liên quan | Mức độ |
|---|---|---|---|
| 89 | Double-click nút Confirm/Xác nhận ở nhiều luồng (đặt lịch, đăng ký) không có debounce | Authentication, Booking | 🟠 |
| 90 | Refresh/mất mạng giữa lúc đang ở bước cuối đặt lịch — mất toàn bộ lựa chọn | Booking | 🟡 |
| 91 | Banner "yêu cầu đổi lịch" biến mất sau khi bấm Chấp nhận/Từ chối, tạo cảm giác đã xử lý xong dù dữ liệu giờ hẹn chưa thực sự đổi | W6 | 🔴 |
| 92 | Date picker chọn ngày sinh mặc định hiển thị năm hiện tại — khách phải cuộn rất xa để về đúng năm sinh | Authentication | 🟢 |
| 93 | Danh sách "gần bạn" đổi thứ tự liên tục khi khách đang cuộn (do GPS refresh) gây bấm nhầm | Home&Discovery | 🟡 |
| 94 | Icon "yêu thích" đổi trạng thái tức thời trên UI (optimistic update) trước khi API xác nhận — không rollback khi lỗi | Favorites&Share | 🟢 |
| 95 | Không thấy slot trống nào hiển thị — không có gợi ý ngày/nhân viên khác gần nhất còn trống | Booking | 🟡 |

## Nhóm J — Lỗi xác nhận trực tiếp trong bản mock `GlowBook.jsx` (không phải suy luận — đã kiểm chứng trong code)

| # | Trường hợp | Vị trí trong code | Mức độ |
|---|---|---|---|
| 96 | Hàm `resolveChange` chấp nhận yêu cầu đổi lịch nhưng không cập nhật giờ hẹn mới (`status: accept ? a.status : a.status` — cả 2 nhánh giống hệt nhau) | Component quản lý lịch hẹn cơ sở | 🔴 |
| 97 | `AdminSalons` chỉ có hàm `approve()`, hoàn toàn thiếu chức năng "Từ chối" dù UR-A-011③ yêu cầu bắt buộc | Component Admin — Salons | 🟠 |
| 98 | `AdminUsers` chỉ hiển thị danh sách (read-only) — thiếu nút Khóa/Mở khóa tài khoản dù UR-A-020④ yêu cầu | Component Admin — Users | 🟠 |
| 99 | `ServiceModal` — trường "Khuyến mãi (%)" là input số không giới hạn min/max, cho phép nhập âm hoặc >100% | Component Web Portal — Services | 🟠 |
| 100 | Toàn bộ `GlowBook.jsx` chỉ là mock front-end (state cục bộ `useState`), chưa có API/database thật — mọi rule về concurrency, transaction, validation phía server (đã liệt kê ở 99 mục trên) đều **chưa được kiểm chứng bằng code thật** và cần triển khai đầy đủ ở tầng backend trước khi bảo vệ đồ án như một hệ thống hoàn chỉnh | Toàn bộ file | 🟠 |


---

# PHẦN 2: TOP 50 CÂU HỎI PHẢN BIỆN CÓ KHẢ NĂNG BỊ HỎI NHẤT

> Nhóm theo chủ đề để dễ chuẩn bị. Câu trả lời chi tiết cho từng câu nằm rải rác trong phần phân tích ở file 01/02 (tra theo module được nhắc trong ngoặc).

### A. Business Logic & Luồng đặt lịch (module core — nhóm câu hỏi nhiều khả năng bị hỏi nhất)
1. Nếu hai khách đặt cùng lúc một khung giờ với cùng một nhân viên, hệ thống xử lý ở tầng nào và bằng cơ chế gì? *(Booking)*
2. Nếu cơ sở đổi giá dịch vụ giữa lúc khách đang đặt lịch, khách trả theo giá nào? *(Booking, W2)*
3. Khách được đổi lịch tối đa bao nhiêu lần? Vì sao chọn con số đó (nếu có)? *(Booking)*
4. Phí hủy lịch (<2 giờ) được thu bằng cách nào khi hệ thống chưa tích hợp thanh toán online? *(Booking)*
5. Thuật toán chọn nhân viên "Bất kỳ" hoạt động theo cơ chế gì (round-robin, ít lịch nhất, ngẫu nhiên)? *(Booking)*
6. Nếu khách mất mạng đúng lúc bấm xác nhận đặt lịch, làm sao đảm bảo không tạo booking trùng khi thử lại? *(Booking)*
7. Buffer time giữa 2 lịch hẹn liên tiếp của 1 nhân viên được xử lý ở đâu? *(Booking, W4)*
8. Khi một nhân viên nghỉ đột xuất, các lịch hẹn đã đặt với nhân viên đó được xử lý tự động hay chủ cơ sở phải tự làm tay? *(W4)*
9. Đặt lịch định kỳ "cho đến khi hủy" — hệ thống tạo trước bao nhiêu lịch tương lai một lúc? *(Booking)*
10. Vì sao BOOKING chỉ có 1 `staff_id` nhưng đặt combo lại yêu cầu chọn nhân viên riêng cho từng dịch vụ?

### B. Concurrency & Race Condition
11. Khóa (lock) nào được dùng để chống 2 khách đặt trùng slot — pessimistic hay optimistic? Vì sao chọn loại đó?
12. Nếu voucher chỉ còn 1 lượt và 2 khách cùng áp dụng trong tích tắc, ai được dùng? *(W3)*
13. Nếu 2 Admin cùng duyệt/từ chối 1 hồ sơ cơ sở đồng thời, kết quả cuối cùng là gì? *(W1, A2)*
14. Hệ thống có dùng idempotency key để chống tạo booking trùng khi khách bấm gửi 2 lần không? *(API)*
15. Nếu dùng read replica cho database, việc đọc "khung giờ trống" có nguy cơ đọc dữ liệu cũ không? Ảnh hưởng gì tới race condition đặt lịch? *(NFR)*
16. Khách đổi lịch đúng lúc cơ sở hủy lịch đó (2 thao tác trái chiều gần như đồng thời) — ai thắng? *(Booking, W6)*

### C. Data Model & Database
17. Vì sao 8/13 thực thể trong Data Model (STAFF, PROMOTION, MEDIA, CATEGORY, DISTRICT, BOOKING_ITEM, SCHEDULE, FAVORITE, MESSAGE) không có bảng thuộc tính chi tiết?
18. Hệ thống đảm bảo review chỉ được viết bởi khách đã thực sự dùng dịch vụ bằng cách nào, khi REVIEW không liên kết tới BOOKING? *(Review)*
19. "Giá theo phân loại" (nam/nữ, tóc ngắn/dài) được lưu ở đâu khi SERVICE chỉ có 1 khoảng giá `price_from`–`price_to`? *(W2)*
20. Nếu một dịch vụ bị xóa khi đang có booking tương lai sử dụng, các booking đó được xử lý ra sao? *(W2)*
21. Khi khóa một cơ sở đang có hàng chục lịch hẹn tương lai, các khách hàng đó được xử lý thế nào? *(A2)*
22. Chuỗi booking định kỳ được nhận diện bằng cách nào để "sửa/hủy toàn bộ chuỗi" hoạt động đúng, khi BOOKING không có trường liên kết chuỗi? *(Booking)*
23. Giá khuyến mãi hiển thị lấy từ `SERVICE.promo_price` hay từ bảng PROMOTION? Nếu cả 2 cùng áp dụng, giá nào thắng? *(W2, W3)*
24. Chủ cơ sở (Business Owner) có phải là 1 dòng trong bảng USER không? Nếu có, `role` đó được gán ở bước nào? *(Authentication, W1)*

### D. Security & Authentication
25. Vì sao chọn ngưỡng khóa "5 lần sai/15 phút" mà không phải CAPTCHA hay progressive backoff? Cơ chế này có chống được brute-force phân tán qua nhiều IP không? *(Authentication)*
26. Access/Refresh Token bị đánh cắp thì hệ thống có cơ chế revoke theo thiết bị không? *(Authentication, API)*
27. Hệ thống có kiểm tra file upload thực sự là ảnh hay chỉ tin theo đuôi file? *(Media Management)*
28. Nếu Admin bị chiếm quyền tài khoản, kẻ tấn công có thể làm gì — có phân cấp quyền Admin (Super Admin vs vận hành) để giới hạn thiệt hại không? *(A2, A3)*
29. Khi Admin khóa 1 tài khoản khách, phiên đăng nhập hiện tại của khách có bị vô hiệu ngay không, hay vẫn dùng được tới khi token hết hạn (tối đa 15 phút)? *(A3)*
30. Hệ thống có ghi log (audit trail) khi Admin truy cập dữ liệu nhạy cảm của người dùng/cơ sở không? *(A4)*

### E. Permission & Vai trò
31. Nếu có tranh chấp giữa khách và cơ sở về 1 lịch hẹn, Admin có công cụ nào để can thiệp/chỉnh sửa trực tiếp không? Nếu không, quy trình giải quyết tranh chấp nằm ở đâu? *(A4)*
32. Vì sao Admin chỉ có quyền "xem" dịch vụ/giá và khuyến mãi, không có quyền ẩn/sửa khi phát hiện nội dung vi phạm? *(W2, W3)*
33. Vì sao Admin không có quyền xem nội dung chat giữa khách và cơ sở? Nếu có lừa đảo qua chat, ai xử lý? *(Notification & Messaging)*
34. Nhân viên/thợ có tài khoản đăng nhập riêng không? Nếu không, làm sao họ biết lịch làm việc của mình? *(W4)*
35. Một cá nhân có thể đứng tên/sở hữu bao nhiêu cơ sở trên hệ thống? *(W1)*

### F. Bối cảnh pháp lý & thực tế Việt Nam (nhóm câu hỏi thể hiện chiều sâu nghiên cứu, rất đáng chuẩn bị kỹ)
36. Việt Nam đã chính thức bỏ cấp hành chính quận/huyện từ 01/07/2025 và TP.HCM đã sáp nhập với Bình Dương, Bà Rịa – Vũng Tàu. Danh mục khu vực trong hệ thống của nhóm bạn dựa trên đơn vị hành chính nào, và xử lý sự thay đổi này ra sao?
37. NFR-015 ghi "PDPA Vietnam" — bạn có biết tên chính xác văn bản pháp luật Việt Nam áp dụng ở đây không? Luật đó có hiệu lực từ khi nào?
38. Ảnh before/after của dịch vụ thẩm mỹ (tiêm filler, botox) có thể được xem là dữ liệu nhạy cảm liên quan sức khỏe theo luật bảo vệ dữ liệu cá nhân — hệ thống xin sự đồng ý của khách bằng cơ chế nào, và cơ chế đó có đủ giá trị pháp lý không?
39. Hệ thống có tính năng nào cho phép người dùng yêu cầu xóa toàn bộ dữ liệu cá nhân của mình không (quyền được xóa dữ liệu)?
40. Nếu một khách hàng chưa đủ tuổi vị thành niên tự đăng ký tài khoản, hệ thống có cơ chế phát hiện/chặn không?

### G. NFR & Kiến trúc hệ thống
41. Khi hệ thống vượt quá 5.000 người dùng đồng thời, điều gì xảy ra — có cơ chế giảm tải ưu tiên tính năng lõi (graceful degradation) không? *(NFR)*
42. Chỉ tiêu "luồng đặt lịch hoàn thành ≤4 bước" có còn khả thi với luồng phức tạp nhất (combo nhiều dịch vụ + chọn nhân viên riêng từng dịch vụ + áp voucher) không? *(NFR)*
43. Endpoint `PUT /bookings/:id` phải xử lý nhiều loại hành động khác nhau (xác nhận, từ chối, đổi giờ, đề xuất lịch mới) — làm sao phân biệt được các ngữ cảnh này? *(API)*
44. Rate limiting 100 request/phút/user áp dụng thế nào cho các request trước khi người dùng đăng nhập (đăng ký, gửi OTP)? *(API, Authentication)*
45. Chiến lược khi phát hành `/api/v2/` mà vẫn phải hỗ trợ ứng dụng Mobile cũ chưa cập nhật là gì? *(API)*

### H. Về quy trình làm đồ án / độ hoàn chỉnh của tài liệu (câu hỏi mang tính tổng kết, giảng viên hay hỏi cuối buổi)
46. Vì sao chức năng "Từ chối hồ sơ cơ sở" và "Khóa/Mở khóa tài khoản người dùng" có trong URD nhưng không thấy hiện thực trong bản mock giao diện đã nộp? *(A2, A3 — đối chiếu GlowBook.jsx)*
47. Khi chủ cơ sở "chấp nhận" yêu cầu đổi giờ của khách trong bản demo, dữ liệu giờ hẹn có thực sự được cập nhật không? Hãy trình bày lỗi cụ thể trong code nếu có. *(W6 — đối chiếu GlowBook.jsx)*
48. Bản mock giao diện chỉ dựng cho Web Portal và Admin Panel — vì sao chưa có Mobile App hay API thật? Nhóm có kế hoạch gì cho phần còn thiếu?
49. Nếu phải chọn 3 rủi ro nghiêm trọng nhất (🔴 Critical) trong toàn bộ hệ thống để ưu tiên khắc phục trước khi triển khai thật, nhóm sẽ chọn 3 rủi ro nào và vì sao?
50. Trong toàn bộ URD, phần nào nhóm tự đánh giá là "thiếu đặc tả" nhiều nhất, và vì sao lại thiếu (do phạm vi đồ án có giới hạn thời gian, hay do chưa nghĩ tới)?

---

# PHẦN 3: ĐỐI CHIẾU `GlowBook.jsx` VỚI URD (PHẦN MỞ RỘNG)

> URD yêu cầu không tự thêm chức năng ngoài phạm vi tài liệu — phần này **không** đề xuất thêm tính năng mới, chỉ đối chiếu những gì URD đã yêu cầu với những gì bản mock giao diện đã nộp thực sự làm được, đúng tinh thần QA (kiểm thử implementation so với spec).

## 3.1. Phạm vi bản mock so với URD

`GlowBook.jsx` tự ghi chú là **"Bản demo giao diện · chỉ Front-end"**. Đối chiếu với 4 phân hệ của URD:

| Phân hệ trong URD | Có trong `GlowBook.jsx`? |
|---|---|
| Mobile App (Khách hàng) — 9 module | ❌ Hoàn toàn không có — không có màn hình nào cho khách hàng (không có đăng ký/đăng nhập SĐT+OTP, không có luồng đặt lịch, không có tìm kiếm, không có review) |
| Web Portal (Cơ sở) | ✅ Có dựng UI: Tổng quan, Dịch vụ, Lịch hẹn, Thống kê, Hồ sơ |
| Web Admin Panel | ✅ Có dựng UI: Tổng quan, Cơ sở, Người dùng, Lịch hẹn, Báo cáo |
| API / Backend thật | ❌ Không có — toàn bộ dữ liệu là mock `useState` khởi tạo cứng trong file, mất khi tải lại trang, không có `fetch`/`axios` gọi ra ngoài nào trong toàn bộ 902 dòng code |

Vì vậy, bản mock chỉ có thể dùng để đối chiếu cho **2/4 phân hệ** (Web Portal, Web Admin) và không thể dùng để kiểm chứng bất kỳ rule nào thuộc về Mobile App, Booking (phía khách), hay tầng dữ liệu/API thật.

## 3.2. Bốn phát hiện cụ thể — xác nhận bằng chính đoạn code, không phải suy luận

### (1) 🔴 "Chấp nhận" yêu cầu đổi lịch không thực sự đổi giờ hẹn
```js
const resolveChange = (id, accept) => setAppointments(appointments.map(a =>
  a.id === id ? { ...a, changeRequest: null, status: accept ? a.status : a.status } : a));
```
Cả hai nhánh của biểu thức `accept ? a.status : a.status` đều trả về đúng `a.status` — tức dù bấm "Chấp nhận" hay "Từ chối", hàm chỉ xóa `changeRequest` (dòng cảnh báo màu vàng biến mất khỏi UI) mà **không có bất kỳ trường nào chứa giờ hẹn mới được ghi vào dữ liệu**. Đáng chú ý hơn: ngay cả nếu sửa lại điều kiện `accept` cho đúng, dữ liệu `changeRequest` trong bản mock cũng chỉ là 1 chuỗi text mô tả tự do (VD: `"Khách xin dời sang 11:00 vì bận việc"`), **không có trường cấu trúc riêng lưu ngày/giờ mới** — nghĩa là kể cả sửa logic, hệ thống vẫn không có dữ liệu có cấu trúc để biết chính xác giờ mới là gì mà không phải phân tích (parse) câu chữ tự do, vốn rất dễ sai. Đây là minh chứng rõ nhất cho lỗ hổng đã nêu ở 0.4.C (thiếu bảng quy tắc chuyển trạng thái) thể hiện thành lỗi thật trong code.

### (2) 🟠 Admin thiếu hoàn toàn chức năng "Từ chối" hồ sơ cơ sở
```js
const approve = (id) => setSalons(salons.map(s => s.id === id ? { ...s, status: "Hoạt động" } : s));
// ...
{s.status === "Chờ duyệt" && <button onClick={() => approve(s.id)}>Duyệt</button>}
```
Chỉ có 1 hàm `approve`, chỉ có 1 nút "Duyệt". UR-A-011③ yêu cầu rõ **"Duyệt / Từ chối (kèm lý do)"** — nhánh "Từ chối" hoàn toàn vắng mặt trong bản hiện thực hoá.

### (3) 🟠 Admin không thể Khóa/Mở khóa tài khoản người dùng
```js
function AdminUsers({ users }) {
  return (<table>...</table>); // chỉ render dữ liệu, không có onClick nào
}
```
Component chỉ nhận prop `users` (không có `setUsers`) — về mặt cấu trúc, component này **không thể** thực hiện bất kỳ hành động ghi/sửa nào, dù UR-A-020④ yêu cầu "Thao tác: Xem chi tiết, Khóa tài khoản, Mở khóa".

### (4) 🟠 Trường giảm giá dịch vụ không giới hạn 0–100%
```js
<input type="number" className="gb-input mt-1" value={form.discount}
  onChange={e => setForm({ ...form, discount: Number(e.target.value) })} />
```
Không có thuộc tính `min`/`max`, không có validate trước khi lưu — trùng khớp chính xác với ví dụ "Giảm giá >100%" mà yêu cầu gốc liệt kê như 1 validation case kinh điển cần kiểm tra. Tương tự, 2 input `price` và `duration` ngay phía trên cũng không có `min={0}`.

## 3.3. Nhận xét kiến trúc chung của bản mock
- Toàn bộ state (`salons`, `services`, `appointments`, `users`) khởi tạo cứng (hardcoded) ngay trong file và chỉ tồn tại trong bộ nhớ trình duyệt — tải lại trang sẽ mất mọi thay đổi. Điều này phù hợp với mục đích demo UI, nhưng cũng có nghĩa **không một rule nào trong 100 mục ở Phần 1 (transaction, unique constraint, race condition, validate phía server...) từng được kiểm chứng thực sự** — toàn bộ mới dừng ở lớp giao diện.
- Trường thời gian lịch hẹn (`time`) là chuỗi text tự do (`"Hôm nay, 09:30"`, `"20/07, 07:00"`) thay vì kiểu ngày giờ chuẩn (ISO datetime) — nếu logic thật được xây dựng tiếp trên nền này, mọi phép so sánh/sắp xếp/kiểm tra trùng giờ sẽ phải tự phân tích chuỗi, dễ sai hơn nhiều so với dùng kiểu dữ liệu ngày giờ chuẩn.
- Không có bất kỳ xử lý lỗi (try/catch), loading state, hay empty state nào trong toàn bộ file — dễ hiểu vì đây là bản demo tĩnh, nhưng cũng đồng nghĩa toàn bộ nhóm "Exception Cases" đã liệt kê ở Phần 1 (API timeout, mất kết nối...) chưa có bất kỳ cơ sở nào để đối chiếu ở giai đoạn hiện tại của dự án.

## 3.4. Kết luận phần đối chiếu
Bản mock `GlowBook.jsx` là một giao diện demo hợp lý cho mục đích trình bày trực quan, nhưng **4 phát hiện ở mục 3.2 là các lỗi/tính năng thiếu có thể tái hiện ngay lập tức trước hội đồng** nếu được yêu cầu demo trực tiếp ("Bạn thử chấp nhận yêu cầu đổi giờ này xem giờ hẹn có đổi không?", "Bạn thử từ chối 1 hồ sơ cơ sở xem?", "Bạn thử khóa tài khoản 1 khách hàng xem?") — nên được ưu tiên khắc phục trước buổi bảo vệ nếu bản mock này sẽ được dùng để demo trực tiếp, vì đây là những chỗ hội đồng có thể phát hiện lỗi ngay tại chỗ chỉ bằng cách bấm thử.

---

# PHẦN 4: GHI CHÚ CUỐI

- Bộ 4 file này bao phủ đầy đủ **24/24 module chức năng** trong URD (9 Mobile App + 7 Web Portal + 7 Web Admin + 1 API) cộng thêm module Non-Functional Requirements, không bỏ sót module nào theo đúng yêu cầu ban đầu.
- Các câu hỏi/mục còn ghi "Thiếu đặc tả" hoặc "Cần bổ sung" xuyên suốt 4 file là những chỗ URD **chưa trả lời**, không phải lỗi sai — đây chính là "khoảng trống" mà một buổi phản biện đồ án thường khai thác nhiều nhất, vì nó cho thấy mức độ suy nghĩ thấu đáo của người thiết kế hơn là chỉ lỗi chính tả/kỹ thuật.
- Toàn bộ phân tích tuân thủ đúng yêu cầu ban đầu: không sửa nội dung URD, không tự thêm chức năng ngoài phạm vi tài liệu (các quan sát về "tính năng thường thấy ở app cùng loại nhưng vắng mặt trong URD", như phản hồi review, đều được nêu dưới dạng câu hỏi/nhận xét phản biện, không phải đề xuất thiết kế).

Nếu bạn muốn, mình có thể:
- Gộp 4 file này thành 1 file Word (.docx) có mục lục, định dạng tiêu đề/heading để in ra mang theo buổi bảo vệ.
- Trích riêng 1 bản "cheat-sheet" 1-2 trang chỉ gồm TOP 20 lỗi nghiêm trọng nhất + TOP 15 câu hỏi khó nhất để học thuộc nhanh trước giờ bảo vệ.
