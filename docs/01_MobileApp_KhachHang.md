# PHÂN HỆ 1: MOBILE APP — DÀNH CHO KHÁCH HÀNG
### 9 module — UR-C-001 → UR-C-081

> Ký hiệu mức độ: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low (định nghĩa chi tiết ở file `00_TongQuan_PhuongPhap.md`, mục 0.2). Các tham chiếu "(→ 0.4.X)" trỏ tới 10 lỗ hổng liên-module ở file 00.

---

## MODULE 1: Đăng ký & Đăng nhập (Authentication)
**UR liên quan**: UR-C-001 → UR-C-005
**Phạm vi theo URD**: Đăng ký/đăng nhập bằng SĐT+OTP hoặc MXH (Google/Facebook/Apple ID), quên mật khẩu, quản lý hồ sơ cá nhân.

### 1. Business cases
- Đăng ký bằng SĐT thành công: nhập họ tên/SĐT/mật khẩu/giới tính/ngày sinh → OTP đúng → tạo tài khoản → chuyển trang chủ (UR-C-001).
- Đăng ký bằng MXH (Google/Facebook/Apple ID) lần đầu, hệ thống tự tạo tài khoản (UR-C-002).
- Đăng nhập bằng SĐT + mật khẩu thành công (UR-C-003①).
- Đăng nhập bằng MXH đã từng liên kết (UR-C-003②).
- Phiên đăng nhập được ghi nhớ bằng token (UR-C-003③).
- Quên mật khẩu → OTP → đặt mật khẩu mới → đăng nhập lại (UR-C-004).
- Xem/sửa hồ sơ cá nhân, đổi mật khẩu, quản lý địa chỉ mặc định, cấu hình loại thông báo (UR-C-005).

### 2. Edge cases
- Khách đăng ký bằng SĐT, sau đó đăng nhập MXH mà nhà cung cấp MXH trả về **cùng email/SĐT** đã có trong hệ thống dưới tài khoản khác → có tự động merge 2 tài khoản không, hay tạo trùng?
- Facebook cho phép người dùng **ẩn email** khi cấp quyền — nếu khách chọn ẩn, hệ thống thiếu trường email bắt buộc để tạo tài khoản MXH.
- Khách bấm "Gửi lại OTP" nhiều lần liên tiếp trước khi mã cũ hết hạn — mã cũ có bị vô hiệu ngay hay vẫn dùng được (2 mã cùng sống)?
- SMS OTP đến **chậm** (ngoài thời gian hết hạn OTP phía server) — khách xin mã mới nhưng vẫn nhận được SMS cũ sau đó và nhập nhầm mã cũ.
- Khách đổi SĐT trong hồ sơ (UR-C-005①) sang một SĐT **đã tồn tại** ở tài khoản khác.
- Khách hủy liên kết tài khoản MXH ngay trên Google/Facebook (ngoài app) — lần đăng nhập kế tiếp thất bại, nhưng khách **chưa từng đặt mật khẩu** (đăng ký 100% qua MXH) → không còn đường nào đăng nhập lại.
- Đặt lại mật khẩu mới **giống một mật khẩu đã dùng cách đây nhiều lần đổi trước** — rule "khác mật khẩu cũ" (UR-C-004③) chỉ so với mật khẩu ngay trước hay so với toàn bộ lịch sử?
- Khách nhập ngày sinh khiến tuổi < 18 (hoặc < 16) khi tự đăng ký — không có age-gate nào được mô tả, liên quan trực tiếp tới nghĩa vụ bảo vệ dữ liệu trẻ em (→ 0.4.E).
- Tài khoản bị khóa 15 phút do sai mật khẩu 5 lần, nhưng khách vẫn đăng nhập được ngay qua kênh MXH trong lúc đó — khóa có áp dụng chung cho account hay chỉ riêng nhánh mật khẩu?

### 3. Exception cases
- SMS OTP gửi thất bại (đầu số bị nhà mạng chặn spam, hoặc lỗi gateway) — không thấy fallback (gọi thoại đọc mã, email OTP dự phòng).
- Provider OAuth (Google/Facebook/Apple) timeout hoặc trả lỗi giữa lúc xác thực.
- Mất kết nối DB ngay sau khi OTP xác thực đúng nhưng trước khi ghi user mới — khách "mất trắng", thử lại có báo nhầm "SĐT đã tồn tại" do bản ghi orphan không?
- Access Token (15 phút — NFR-012) hết hạn giữa lúc khách đang điền form đăng ký nhiều bước.
- Rate limit 100 req/phút/user (UR-API-001④) chặn nhầm cả yêu cầu "Gửi lại OTP" hợp lệ khi khách bấm nhanh vài lần do lo lắng chưa thấy SMS tới.

### 4. Validation cases còn thiếu
- Định dạng số điện thoại Việt Nam (10 số, đầu số hợp lệ 03/05/07/08/09) — URD không quy định.
- Độ mạnh mật khẩu (độ dài tối thiểu, có bắt buộc số/hoa/ký tự đặc biệt?) — không có.
- Họ tên: giới hạn độ dài tối đa, ký tự đặc biệt/emoji, tên chỉ 1 ký tự.
- Ngày sinh trong tương lai hoặc tuổi phi thực tế (>100).
- Định dạng email khi nhập tay ở hồ sơ (khác luồng lấy tự động từ MXH).
- Giới tính: enum gồm bao nhiêu giá trị? Không có ví dụ minh họa.
- Độ dài OTP, thời gian hết hạn OTP, số lần nhập sai OTP tối đa trước khi buộc xin mã mới — không một chỉ số nào được nêu.
- Kích thước/định dạng file avatar tối đa.

### 5. Business Rule còn thiếu
- Một SĐT có được liên kết nhiều tài khoản MXH khác nhau (2 email Google khác nhau) không?
- Có giới hạn tổng số lần bị khóa tài khoản/ngày để chống brute-force theo chu kỳ (bên cạnh rule 5 lần/15 phút) không?
- Có giới hạn số thiết bị đăng nhập đồng thời trên 1 tài khoản không?
- **Xóa tài khoản / yêu cầu xóa dữ liệu cá nhân**: hoàn toàn không có tính năng — đây là nghĩa vụ bắt buộc theo Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực 01/01/2026, → 0.4.E). *Cần bổ sung.*
- Một SĐT có thể vừa là tài khoản Khách hàng (App) vừa đứng tên tài khoản Cơ sở (Web Portal) không (→ 0.4.F)? *Thiếu đặc tả.*
- Tuổi tối thiểu để tự đăng ký tài khoản là bao nhiêu? Có cần xác nhận của người giám hộ nếu dưới tuổi đó không? *Thiếu đặc tả.*

### 6. Permission Cases
- Token của khách A gọi API sửa hồ sơ khách B — hệ thống chặn ở tầng backend theo `user_id` suy từ token, hay chỉ ẩn nút ở UI (dễ bị bypass qua gọi API trực tiếp)?
- Access token của Khách hàng bị dùng để gọi nhầm endpoint của Business/Admin — có kiểm tra `role` claim trong JWT ở mọi endpoint không?
- Refresh token đã bị revoke (do khách bấm "Đổi mật khẩu" ở thiết bị khác) nhưng vẫn được dùng để lấy access token mới ở thiết bị cũ — token replay.

### 7. Concurrency Cases
- Hai request đăng ký cùng một SĐT gửi gần như đồng thời từ 2 thiết bị (double-submit) — nếu không có transaction + unique constraint đúng, có thể tạo 2 user cùng SĐT.
- Khách bấm "Gửi OTP" 2 lần liên tiếp rồi nhập mã ở lần gửi đầu sau khi mã thứ hai đã sinh — mã nào được coi là hợp lệ?
- Khách đổi mật khẩu từ 2 thiết bị (điện thoại + máy khác) trong cùng khoảnh khắc.

### 8. Data Integrity
- `USER.phone` có UK (Unique Key) theo §6.2 — đúng — nhưng **`USER.email` không có UK**: 2 tài khoản khác nhau có thể trùng email, gây xung đột khi cố liên kết MXH theo email trùng.
- `USER.role` là enum nhưng không rõ giá trị nào tồn tại và cơ chế gán — nếu Business Owner cũng là một dòng USER, ai/khi nào set `role = business`?
- Không có trường `phone_verified`/`email_verified` tường minh trong entity dù luồng có bước xác thực OTP — trạng thái xác thực được lưu ở đâu, có bị mất khi đổi SĐT không?

### 9. Security Risks
- **OTP brute-force**: không thấy rate-limit riêng cho endpoint verify-otp (ngoài rate-limit chung 100 req/phút/user) — 4-6 số OTP có thể bị dò trong vài trăm request nếu không giới hạn số lần thử/OTP.
- **Brute-force mật khẩu**: có khóa 5 lần/15 phút (tốt) nhưng không có CAPTCHA hoặc progressive delay để chống bot phân tán nhiều IP/nhiều tài khoản.
- **Token replay**: Access/Refresh Token bị đánh cắp (XSS trên Web Portal hoặc lưu trữ không an toàn trên Mobile) — không thấy cơ chế revoke token theo thiết bị hoặc danh sách thiết bị đang đăng nhập.
- **Broken Authentication qua OAuth**: nếu không verify đúng `audience`/`issuer`/`signature` của token MXH, có thể bị giả mạo đăng nhập.
- **IDOR**: nếu `GET /api/v1/users/profile` nhận id qua tham số thay vì suy từ JWT, có thể dò được hồ sơ người khác.
- Mật khẩu dùng bcrypt cost ≥ 12 (NFR-011, đúng chuẩn) — nhưng OTP có bị log dạng plaintext ở tầng SMS gateway/log hệ thống không?

### 10. Performance Risks
- Gửi OTP hàng loạt vào giờ cao điểm/khuyến mãi lớn có thể làm nghẽn SMS gateway — không thấy kế hoạch nhà cung cấp SMS dự phòng (multi-provider failover).
- Gọi xác thực OAuth ra ngoài (Google/Facebook) có độ trễ mạng ngoài tầm kiểm soát — không thấy timeout/circuit breaker được đặc tả cho luồng này.

### 11. UI/UX Traps
- Bấm Back giữa lúc đang chờ nhập OTP — quay lại có giữ được state (đã gửi OTP, còn bao nhiêu giây để xin lại) hay phải làm lại từ đầu?
- Double-submit nút "Tạo tài khoản"/"Xác nhận" do double-tap hoặc mạng chậm, dễ tạo request trùng.
- Gõ nhầm SĐT ở bước đăng ký nhưng OTP đã được gửi đi — không có bước "Sửa số điện thoại" ngay trên màn OTP, phải hủy và làm lại toàn bộ luồng.
- Date picker chọn ngày sinh mặc định hiển thị năm hiện tại (2026), khách phải cuộn rất xa để về đúng năm sinh thật — ảnh hưởng UX rõ nhất với nhóm khách trung niên (đối tượng chính của dịch vụ làm đẹp).

### 12. Tester Checklist
☐ Đăng ký SĐT hợp lệ + OTP đúng → thành công
☐ Đăng ký SĐT đã tồn tại → báo lỗi đúng như UR-C-001④
☐ Đăng ký nhập OTP sai → cho nhập lại, có đếm số lần thử
☐ Đăng ký OTP hết hạn → yêu cầu gửi lại mã
☐ Đăng ký qua Google/Facebook/Apple lần đầu
☐ Đăng ký MXH khi email đã tồn tại trong hệ thống dưới tài khoản khác
☐ Đăng ký MXH khi provider không trả về email (Facebook ẩn email)
☐ Đăng nhập SĐT/mật khẩu đúng
☐ Đăng nhập sai mật khẩu lần 1–4 → còn cho thử
☐ Đăng nhập sai mật khẩu lần 5 → khóa 15 phút đúng UR-C-003⑤
☐ Đăng nhập trong lúc tài khoản đang bị khóa
☐ Quên mật khẩu → OTP đúng → đặt mật khẩu mới hợp lệ
☐ Đặt mật khẩu mới giống mật khẩu cũ → bị chặn đúng UR-C-004③
☐ Sửa hồ sơ: đổi tên/avatar/email/ngày sinh/giới tính
☐ Đổi SĐT trong hồ sơ sang số đã có người dùng
☐ Đăng xuất → token cũ không dùng lại được
☐ Refresh token hết hạn 30 ngày → buộc đăng nhập lại
☐ Gọi API sửa hồ sơ người khác bằng token của mình → kỳ vọng bị từ chối (403)
☐ Nhập ngày sinh khiến tuổi < 18 khi đăng ký

### 13. Giảng viên có thể hỏi gì?
- Nếu một khách đăng ký bằng SĐT/OTP, sau đó đăng nhập Google bằng một email khác nhưng Google trả về đúng số điện thoại phụ trùng với số đã đăng ký — bạn merge 2 identity đó như thế nào?
- Vì sao chọn ngưỡng khóa "5 lần sai/15 phút" mà không phải CAPTCHA hoặc progressive backoff? Cơ chế này chống được brute-force phân tán qua nhiều IP không?
- OTP hết hạn sau bao lâu, và vì sao chọn khoảng thời gian đó?
- Chủ cơ sở (Business Owner) có phải là một dòng trong bảng USER không? Nếu có, `role` đó được gán ở bước nào trong luồng đăng ký cơ sở?
- Hệ thống xử lý "quyền được xóa dữ liệu cá nhân" theo Luật Bảo vệ dữ liệu cá nhân 2025 ở đâu?
- Nếu khách chưa từng đặt mật khẩu (đăng ký 100% qua MXH) và lỡ hủy liên kết MXH ngoài app, làm sao khách đăng nhập lại?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟠 High — đây là cửa ngõ của toàn hệ thống; lỗ hổng ở Authentication kéo theo rủi ro ở mọi module phía sau.

---

## MODULE 2: Trang chủ & Khám phá (Home & Discovery)
**UR liên quan**: UR-C-010 → UR-C-012
**Phạm vi theo URD**: Trang chủ (banner, danh mục, cơ sở nổi bật/gần bạn, khuyến mãi, đánh giá cao), phân loại dịch vụ theo nhóm, xem theo khu vực GPS/bán kính/Map View.

### 1. Business cases
- Khách mở app, thấy banner khuyến mãi dạng carousel, danh mục dịch vụ theo icon, cơ sở nổi bật/gần vị trí, dịch vụ khuyến mãi, cơ sở đánh giá cao (UR-C-010).
- Khách bấm vào 1 nhóm dịch vụ (Tóc/Spa/TMV/Nail/Makeup/Khác) → thấy danh sách cơ sở thuộc nhóm, có thể lọc thêm theo khu vực (UR-C-011).
- Khách cho phép truy cập GPS → thấy cơ sở theo bán kính 1/3/5/10km, xem trên Map View, lọc theo khu vực cụ thể, sắp xếp theo khoảng cách (UR-C-012).

### 2. Edge cases
- Khách từ chối cấp quyền GPS — trang chủ vẫn cần hiển thị "cơ sở gần bạn" (UR-C-010③) và Map View (UR-C-012③); không có phương án fallback (nhập địa chỉ tay, dùng vị trí mặc định theo quận đã chọn lần trước) được mô tả.
- Khách đang di chuyển (trên xe) khi mở app — GPS thay đổi liên tục, danh sách "gần bạn" load lại liên tục gây giật/nhấp nháy.
- Không có cơ sở nào trong bán kính đã chọn (VD: khách ở khu vực mới sáp nhập, xa trung tâm) — màn hình trống, không có gợi ý "mở rộng bán kính".
- Cơ sở "nổi bật"/"đánh giá cao" nhưng vừa bị Admin khóa (status thay đổi) ngay sau khi trang chủ đã cache — khách bấm vào vẫn thấy cơ sở đó.
- Banner khuyến mãi đã hết hạn (theo lịch admin đặt) nhưng CDN/cache app chưa refresh kịp — khách vẫn thấy banner cũ.
- Toàn bộ tính năng "lọc theo quận/huyện" (UR-C-011③) dựa trên đơn vị hành chính **đã bị bãi bỏ từ 01/07/2025** (→ 0.4.D) — trải nghiệm "phân loại theo khu vực" trên trang chủ có thể đang hiển thị dữ liệu khu vực sai/lỗi thời ngay từ module đầu tiên khách nhìn thấy.
- Khách ở ranh giới giữa 2 bán kính (VD: đúng 5.0km) — thuộc nhóm "≤5km" hay "≤10km"? Không quy tắc rõ ràng (đóng/mở khoảng).

### 3. Exception cases
- API danh sách cơ sở nổi bật timeout — trang chủ trắng hoàn toàn hay có skeleton/cache fallback?
- Map API (Google Maps/khác) lỗi hoặc vượt quota — Map View không tải được.
- Dịch vụ định vị (Location Service) của điện thoại bị tắt ở tầng OS (khác với việc app xin quyền) — cần phân biệt 2 loại lỗi này trong thông báo cho khách.
- Ảnh banner lỗi link/404 — carousel hiển thị icon vỡ ảnh.

### 4. Validation cases còn thiếu
- Giá trị bán kính hợp lệ chỉ có 4 mốc cố định (1/3/5/10km) — khách có được nhập tay bán kính khác không? Nếu không, cần validate lựa chọn chỉ trong 4 giá trị này ở tầng API (chặn request giả với bán kính=9999km).
- Tọa độ GPS giả (giả lập vị trí bằng app fake GPS) — không có cơ chế phát hiện.

### 5. Business Rule còn thiếu
- Tiêu chí để một cơ sở được gắn nhãn "nổi bật" là gì (do Admin chọn tay, hay tự động theo rating/lượt đặt)? *Thiếu đặc tả.*
- "Cơ sở gần bạn" và "Cơ sở được đánh giá cao" nếu trùng nhau thì hiển thị ưu tiên section nào trước? *Thiếu đặc tả.*
- Bán kính 10km có áp dụng được cho toàn bộ địa giới mới (đã sáp nhập Bình Dương, Bà Rịa – Vũng Tàu) hay chỉ tính đúng trong nội thành cũ? *Cần bổ sung — liên quan 0.4.D.*

### 6. Permission Cases
- Trang chủ có hiển thị cơ sở đang ở trạng thái "Chờ duyệt" (chưa được Admin phê duyệt) do lỗi filter không? Khách hàng chưa đăng nhập (guest) có xem được trang chủ không, hay bắt buộc đăng nhập trước?

### 7. Concurrency Cases
- Admin đang ẩn một cơ sở (khóa) đúng lúc app đang render danh sách "nổi bật" chứa cơ sở đó → khách bấm vào giữa khoảng đó vẫn vào được trang đã bị khóa.
- Business tự tắt hiển thị dịch vụ khuyến mãi đúng lúc khách đang xem section "Dịch vụ đang khuyến mãi" trên trang chủ.

### 8. Data Integrity
- Không rõ bảng CATEGORY (nhóm dịch vụ) và DISTRICT (khu vực) có attribute gì (→ 0.4.B) — trang chủ hiển thị icon + tên nhóm dịch vụ (UR-C-010②) nhưng schema của CATEGORY chưa được định nghĩa field nào lưu icon.
- "Đánh giá cao" và "nổi bật" là dữ liệu tính toán (derived) — không rõ có cache/tính lại theo lịch (batch job) hay tính real-time mỗi lần load trang chủ; nếu tính real-time trên toàn bộ BUSINESS mỗi lần mở app → rủi ro hiệu năng (liên hệ mục 10).

### 9. Security Risks
- Rò rỉ vị trí chính xác của khách qua request GPS gửi lên server (tọa độ chính xác) — cần chính sách chỉ lưu tạm/không lưu lâu dài nếu không phục vụ mục đích khác, theo luật bảo vệ dữ liệu cá nhân.
- Endpoint danh sách cơ sở theo bán kính có thể bị dùng để scrape toàn bộ dữ liệu cơ sở (business intelligence của đối thủ) nếu không giới hạn tần suất gọi theo IP/user.

### 10. Performance Risks
- Truy vấn "cơ sở trong bán kính Xkm" trên toàn bộ dữ liệu (đặc biệt sau khi địa giới TP.HCM mở rộng rất nhiều, → 0.4.D) cần index không gian địa lý (geospatial index) — URD không đề cập loại index/công nghệ truy vấn địa lý nào được dùng.
- Trang chủ gộp nhiều nguồn dữ liệu (banner + danh mục + nổi bật + khuyến mãi + đánh giá cao) trong 1 lần load — nếu gọi tuần tự (không parallel) sẽ khó đạt NFR-002 (tải trang ≤3s)/NFR-003 (cold start ≤2s).
- Autocomplete/khám phá tải ảnh lớn (banner, cover cơ sở) không có đặc tả về lazy-load/CDN resize theo màn hình.

### 11. UI/UX Traps
- Khách vừa từ chối quyền GPS, sau đó bấm vào "Xem theo khu vực" (UR-C-012) — app có hỏi lại quyền ngay hay chỉ hiển thị màn trống không giải thích?
- Carousel banner tự động chuyển ảnh trong khi khách đang đọc nội dung dài trên banner đó (banner có mô tả khuyến mãi dài dòng dễ bị đổi ảnh trước khi đọc xong).
- Danh sách "gần bạn" thay đổi thứ tự liên tục khi khách đang cuộn (do GPS refresh) gây layout-shift, khách bấm nhầm cơ sở khác với ý định.

### 12. Tester Checklist
☐ Trang chủ tải đủ 5 section theo UR-C-010①–⑤
☐ Trang chủ khi từ chối quyền GPS
☐ Trang chủ khi tắt Location Service ở OS
☐ Bấm nhóm dịch vụ → đúng danh sách cơ sở thuộc nhóm
☐ Lọc nhóm dịch vụ theo khu vực
☐ Bán kính 1km / 3km / 5km / 10km trả đúng tập cơ sở
☐ Không có cơ sở nào trong bán kính đã chọn
☐ Map View hiển thị đúng vị trí cơ sở & khách
☐ Sắp xếp theo khoảng cách gần nhất
☐ Banner hết hạn không còn hiển thị
☐ Bấm vào cơ sở vừa bị Admin khóa từ danh sách nổi bật (đã cache)
☐ Vị trí khách nằm ngoài phạm vi TP.HCM (cũ) — kiểm tra ứng xử của hệ thống

### 13. Giảng viên có thể hỏi gì?
- Nếu GPS sai (do khách giả lập vị trí hoặc tín hiệu yếu trong nhà cao tầng), hệ thống phát hiện và xử lý thế nào?
- Tiêu chí "nổi bật" và "đánh giá cao" tính toán tự động hay do Admin/BA chọn tay? Có cập nhật theo thời gian thực không?
- Vì sao chỉ có 4 mốc bán kính cố định mà không cho khách tùy chỉnh?
- Việt Nam đã bỏ cấp quận/huyện từ 01/07/2025 — nhóm bạn xử lý thế nào cho bộ lọc "khu vực" trên trang chủ và trang tìm kiếm?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟡 Medium — không có rủi ro mất tiền/dữ liệu trực tiếp, nhưng là trang khách nhìn thấy đầu tiên nên lỗi hiển thị ảnh hưởng ấn tượng ban đầu, và lỗi khu vực hành chính (0.4.D) lan ra toàn bộ hệ thống lọc theo vị trí.

---

## MODULE 3: Tìm kiếm (Search)
**UR liên quan**: UR-C-020 → UR-C-021
**Phạm vi theo URD**: Tìm kiếm từ khóa + autocomplete + lịch sử tìm kiếm; lọc theo nhóm dịch vụ/khu vực/giá/đánh giá/khoảng cách; sắp xếp đa tiêu chí.

### 1. Business cases
- Khách gõ từ khóa vào thanh tìm kiếm trên trang chủ, thấy gợi ý autocomplete, chọn kết quả thuộc Cơ sở/Dịch vụ/Thợ (UR-C-020).
- Khách xem lại lịch sử tìm kiếm gần đây.
- Khách lọc kết quả theo nhóm dịch vụ, khu vực, khoảng giá, đánh giá (≥3★/≥4★), khoảng cách, kết hợp nhiều bộ lọc cùng lúc (UR-C-021①③).
- Khách sắp xếp theo: gần nhất / đánh giá cao nhất / giá thấp→cao / giá cao→thấp / phổ biến nhất (UR-C-021②).

### 2. Edge cases
- Từ khóa không dấu / sai dấu tiếng Việt (VD: "toc" thay vì "tóc", "spa nghi ngoi" thay vì "spa nghỉ ngơi") — không thấy đặc tả chuẩn hóa tiếng Việt (bỏ dấu, fuzzy search).
- Từ khóa chỉ gồm khoảng trắng hoặc ký tự đặc biệt.
- Kết quả tìm kiếm trả về 0 kết quả — không có gợi ý "có phải bạn muốn tìm..." hay gợi ý mở rộng bộ lọc.
- Khách áp đồng thời: giá "từ 500k-1tr" + đánh giá "≥4★" + khoảng cách "1km" + khu vực cụ thể — tập giao rất hẹp, dễ về 0 kết quả nhưng UI không có gợi ý bỏ bớt filter nào.
- Khoảng giá "từ - đến" nhập từ > đến (VD: từ 1.000.000 đến 500.000).
- Sắp xếp "phổ biến nhất" dựa trên chỉ số nào (lượt đặt? lượt xem? đánh giá?) khi 2 cơ sở có chỉ số bằng nhau — thứ tự tie-break không được định nghĩa.
- Lọc theo "khu vực (quận/huyện)" — lại vướng lỗ hổng 0.4.D (đơn vị hành chính đã bị bãi bỏ).
- Tìm theo tên **Thợ/Nhân viên** (UR-C-020③ liệt kê "Thợ/Nhân viên" là 1 loại kết quả) nhưng STAFF không có attribute nào được định nghĩa (→ 0.4.B) — không rõ tìm theo trường nào của thợ (tên? chuyên môn?).

### 3. Exception cases
- Search API timeout khi từ khóa quá phổ biến (VD: "tóc") trả về tập kết quả rất lớn.
- Dịch vụ autocomplete lỗi/chậm — có debounce/throttle input không? Không thấy đặc tả.
- Mất mạng giữa lúc khách đang gõ — lịch sử tìm kiếm gần đây có được lưu local trước khi đồng bộ server không?

### 4. Validation cases còn thiếu
- Độ dài tối đa từ khóa tìm kiếm.
- Khoảng giá: giá trị âm, giá trị không phải số.
- Giới hạn số bộ lọc kết hợp tối đa (nếu có).
- Số lượng lịch sử tìm kiếm lưu tối đa (giữ 10 gần nhất? không giới hạn?).

### 5. Business Rule còn thiếu
- Lịch sử tìm kiếm có được đồng bộ giữa các thiết bị đăng nhập cùng tài khoản không, hay chỉ lưu local? *Thiếu đặc tả.*
- Khách có xóa được từng mục / toàn bộ lịch sử tìm kiếm không? *Thiếu đặc tả* — liên quan quyền riêng tư theo luật bảo vệ dữ liệu cá nhân.
- "Phổ biến nhất" được tính theo khung thời gian nào (7 ngày/30 ngày/toàn thời gian)? *Cần bổ sung.*

### 6. Permission Cases
- Cơ sở đang "Chờ duyệt"/"Bị khóa" có xuất hiện trong kết quả tìm kiếm không (nên loại trừ, nhưng URD không nói rõ điều kiện lọc trạng thái trong query tìm kiếm)?

### 7. Concurrency Cases
- Cơ sở vừa cập nhật giá dịch vụ đúng lúc khách đang lọc theo "khoảng giá" — kết quả trả về dựa trên giá cũ hay mới tùy thời điểm index được cập nhật (nếu dùng search engine riêng như Elasticsearch, có độ trễ đồng bộ).

### 8. Data Integrity
- Nếu dùng search engine riêng (Elasticsearch/Algolia) để phục vụ autocomplete + lọc đa tiêu chí, cần pipeline đồng bộ từ DB chính — URD không đề cập kiến trúc search, chỉ có 1 dòng "GET /services (list by category)" trong API, không thấy endpoint search riêng cho autocomplete nhiều-loại-kết-quả (Cơ sở + Dịch vụ + Thợ) như UR-C-020③ yêu cầu.

### 9. Security Risks
- SQL/NoSQL Injection qua tham số tìm kiếm nếu không sanitize input (đặc biệt khi kết hợp nhiều bộ lọc động).
- Lộ thông tin qua thông báo lỗi tìm kiếm chi tiết (leak cấu trúc câu query nội bộ).

### 10. Performance Risks
- Autocomplete gọi API theo mỗi keystroke nếu không debounce → tải server rất lớn, dễ đụng rate-limit 100 req/phút/user (UR-API-001④) ngay trong 1 lượt gõ tìm kiếm dài.
- Tìm kiếm kết hợp nhiều bộ lọc (nhóm dịch vụ + khu vực + giá + đánh giá + khoảng cách) trên dữ liệu lớn cần index tổng hợp; không có đặc tả chỉ mục hoặc giới hạn phân trang (pagination).

### 11. UI/UX Traps
- Gõ tìm kiếm rồi bấm Back ngay khi autocomplete đang tải — kết quả trả về muộn hiển thị sai vào lúc khách đã rời màn hình khác (race condition hiển thị).
- Áp nhiều bộ lọc rồi đổi 1 bộ lọc — có giữ nguyên các bộ lọc khác hay reset toàn bộ?

### 12. Tester Checklist
☐ Tìm từ khóa có dấu / không dấu / sai dấu
☐ Tìm từ khóa rỗng hoặc chỉ khoảng trắng
☐ Autocomplete hiển thị đúng gợi ý theo thời gian thực
☐ Kết quả gồm đủ 3 loại: Cơ sở / Dịch vụ / Thợ
☐ Lưu và hiển thị lịch sử tìm kiếm gần đây
☐ Xóa lịch sử tìm kiếm
☐ Lọc theo từng tiêu chí riêng lẻ (nhóm dịch vụ / khu vực / giá / đánh giá / khoảng cách)
☐ Kết hợp toàn bộ 5 bộ lọc cùng lúc
☐ Khoảng giá "từ" lớn hơn "đến"
☐ Sắp xếp theo cả 5 tiêu chí, kiểm tra tie-break khi giá trị bằng nhau
☐ Kết quả 0 item — kiểm tra thông báo/gợi ý hiển thị
☐ Tìm kiếm khi mất mạng

### 13. Giảng viên có thể hỏi gì?
- Hệ thống search dùng công nghệ gì để xử lý tìm kiếm tiếng Việt có dấu/không dấu và đồng bộ với DB chính như thế nào?
- "Phổ biến nhất" tính theo công thức nào, và tie-break xử lý ra sao khi 2 kết quả bằng điểm?
- Autocomplete có giới hạn tần suất gọi API để tránh lạm dụng rate-limit không?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟡 Medium — ảnh hưởng trải nghiệm khám phá dịch vụ nhưng không trực tiếp gây sai lệch tiền/lịch.

---

## MODULE 4: Chi tiết Cơ sở làm đẹp (Business Detail)
**UR liên quan**: UR-C-030 → UR-C-032, UR-C-035
**Phạm vi theo URD**: Trang chi tiết cơ sở (thông tin, mô tả, khoảng cách, rating, nút Gọi/Chỉ đường/Yêu thích, gallery), danh sách dịch vụ theo nhóm/tag, chi tiết từng dịch vụ, gallery ảnh before/after.

### 1. Business cases
- Khách xem thông tin cơ bản cơ sở: tên, logo, ảnh bìa, địa chỉ, SĐT, giờ hoạt động, mô tả, khoảng cách, rating, nút Gọi/Chỉ đường/Yêu thích, gallery (UR-C-030).
- Khách xem danh sách dịch vụ theo tab/section, mỗi dịch vụ có tên/mô tả ngắn/giá gốc/giá KM/thời gian, tag HOT/MỚI/GIẢM GIÁ (UR-C-031).
- Khách xem chi tiết 1 dịch vụ: mô tả đầy đủ, giá, thời gian, ảnh before/after, đánh giá, nút "Đặt lịch ngay" (UR-C-032).
- Khách xem gallery cơ sở: before/after, không gian, sản phẩm; xem full-screen/zoom/swipe (UR-C-035).

### 2. Edge cases
- Cơ sở hiện đang **ngoài giờ hoạt động** (đã đóng cửa) tại thời điểm khách xem trang — trang chi tiết có báo "Đang đóng cửa" không, hay khách vẫn thấy nút "Đặt lịch ngay" như đang mở?
- Cơ sở có `opening_time`/`closing_time` cố định (§6.2 BUSINESS) nhưng không có trường "ngày nghỉ" hay "giờ hoạt động đặc biệt" trong entity, mặc dù UR-B-002③ yêu cầu chủ cơ sở "quản lý ngày nghỉ/lịch hoạt động đặc biệt" — **rule có ở FR nhưng không có chỗ lưu trong schema (0.4.B)**, khách xem trang chi tiết sẽ không biết cơ sở nghỉ Tết/nghỉ lễ.
- Cơ sở chưa có dịch vụ nào (mới đăng ký, chưa tạo Service) — trang danh sách dịch vụ trống, nút "Đặt lịch ngay" trỏ đi đâu?
- Giá dịch vụ hiển thị "khoảng giá" (`price_from`–`price_to`) — khách bấm "Đặt lịch ngay" thì giá cuối cùng được xác định ở bước nào, ai chọn giá cụ thể trong khoảng đó (khách chọn hay nhân viên chốt tại chỗ)? *Thiếu đặc tả.*
- Cơ sở bị Admin khóa **trong khi** khách đang xem trang chi tiết (đã load) — khách vẫn bấm "Đặt lịch ngay" được vì trang chưa refresh.
- Ảnh gallery before/after gắn với khách hàng chưa đồng ý hiển thị (theo UR-B-040④ "cho phép khách đồng ý hiển thị") nhưng consent bị rút lại sau đó — có cơ chế gỡ ảnh theo yêu cầu không?
- Rating trung bình (`avg_rating` trên BUSINESS) — là trường lưu sẵn (denormalized), vậy được cập nhật lúc nào: mỗi khi có review mới (tính lại toàn bộ, tốn), hay theo batch job định kỳ (có thể hiển thị sai lệch tạm thời)?

### 3. Exception cases
- Nút "Gọi điện" gọi tới SĐT cơ sở nhưng SĐT sai/không tồn tại (dữ liệu đăng ký không được validate lại).
- Nút "Chỉ đường" phụ thuộc Map API lỗi/hết quota.
- Ảnh gallery lỗi tải (link hỏng, ảnh bị xóa khỏi storage nhưng DB chưa cập nhật).
- API chi tiết cơ sở timeout — trang trắng hay có skeleton loading?

### 4. Validation cases còn thiếu
- `price_from` ≤ `price_to` (SERVICE) — không thấy quy tắc validate ở tầng nhập liệu (nếu chủ cơ sở nhập ngược, khách sẽ thấy khoảng giá vô lý).
- Mô tả cơ sở/dịch vụ: giới hạn độ dài tối đa, có chặn HTML/script injection trong mô tả không (business tự nhập mô tả — nguy cơ XSS nếu hiển thị dạng rich text không sanitize).
- Giờ hoạt động: `opening_time` phải trước `closing_time` (trừ trường hợp qua đêm — có cơ sở làm đẹp mở tới sau nửa đêm không? nếu có, model time đơn giản sẽ sai).

### 5. Business Rule còn thiếu
- Cơ sở có bắt buộc phải có ít nhất 1 dịch vụ "active" mới được xuất hiện trên app không? *Thiếu đặc tả.*
- Tag "HOT"/"MỚI"/"GIẢM GIÁ" (UR-C-031③) được gắn tự động theo điều kiện gì (mới tạo trong X ngày? bao nhiêu % giảm giá thì được gắn "GIẢM GIÁ"?) hay do chủ cơ sở tự chọn? *Thiếu đặc tả.*
- Khoảng giá "từ-đến" cho 1 dịch vụ — giá cuối cùng do ai quyết định tại thời điểm đặt lịch/thực hiện dịch vụ? *Cần bổ sung — ảnh hưởng trực tiếp tới `total_amount` của Booking.*

### 6. Permission Cases
- Guest (chưa đăng nhập) có xem được trang chi tiết cơ sở không, hay bắt buộc đăng nhập? Nút "Đặt lịch ngay"/"Yêu thích" cho guest xử lý ra sao?
- Chủ cơ sở khác (Business B) có xem được trang chi tiết đầy đủ của cơ sở A giống một khách hàng thường không (Permission Matrix ghi Cơ sở chỉ xem "cơ sở mình" nhưng không nói rõ cơ sở có bị chặn xem cơ sở khác trên góc nhìn Mobile App hay không, vì Matrix chỉ áp cho Web Portal)?

### 7. Concurrency Cases
- Chủ cơ sở sửa giá/mô tả dịch vụ đúng lúc khách đang xem trang chi tiết dịch vụ đó (đã load lên màn hình) rồi bấm "Đặt lịch ngay" — giá hiển thị khi xem và giá thực áp dụng khi đặt có thể khác nhau (liên quan 0.4.G).
- Hai khách cùng xem/dùng chung 1 trang chi tiết, 1 người bấm "Yêu thích" ngay lúc dữ liệu rating đang được cập nhật do có review mới — không ảnh hưởng nghiêm trọng nhưng cần đồng bộ đúng.

### 8. Data Integrity
- BUSINESS không có trường `holiday`/`special_hours` dù FR có yêu cầu (đã nêu ở Edge cases) — *sai lệch giữa FR và Data Model (0.4.B).*
- SERVICE có `promo_price` là 1 trường đơn — nhưng Promotion Management (module 12) lại có cơ chế khuyến mãi riêng ở entity PROMOTION (không có attribute) — vậy giá khuyến mãi hiển thị trên trang chi tiết dịch vụ lấy từ `SERVICE.promo_price` hay tính từ PROMOTION đang áp dụng? Có 2 nguồn giá khuyến mãi khác nhau nhưng không rule nào nói nguồn nào ưu tiên.

### 9. Security Risks
- XSS qua mô tả cơ sở/dịch vụ do chủ cơ sở tự nhập (nếu render rich text không sanitize).
- Business tự ý chèn số điện thoại/link ngoài (affiliate, cạnh tranh nền tảng) vào phần mô tả để lôi khách ra khỏi app — không thấy rule kiểm duyệt nội dung mô tả do cơ sở tự nhập (khác với Review có kiểm duyệt ở UR-A-062).

### 10. Performance Risks
- Trang chi tiết cơ sở gộp nhiều dữ liệu con (dịch vụ, nhân viên, đánh giá, khuyến mãi, gallery — đúng như nhóm endpoint `/businesses/:id/services|staff|reviews|promotions|gallery` tách riêng trong API) — nếu Mobile App gọi 5 API song song cho 1 trang, cần cân nhắc 1 endpoint tổng hợp (aggregate) để đạt NFR-001 (≤500ms).
- Gallery ảnh before/after độ phân giải cao — không thấy yêu cầu resize/CDN theo thiết bị, ảnh hưởng tốc độ tải trên mạng di động.

### 11. UI/UX Traps
- Khách zoom ảnh gallery rồi bấm Back — có thoát đúng về đúng vị trí ảnh đang xem trong danh sách hay quay về đầu gallery?
- Danh sách dịch vụ dài với nhiều tab/section — khách cuộn nhanh dễ bấm nhầm dịch vụ khác khi tag KM làm thay đổi kích thước card đột ngột.
- Nút "Đặt lịch ngay" ở màn chi tiết dịch vụ (UR-C-032⑥) và luồng đặt lịch tổng ở màn Business Detail có nhất quán về việc dịch vụ đã được chọn sẵn hay khách phải chọn lại từ đầu không?

### 12. Tester Checklist
☐ Hiển thị đầy đủ thông tin cơ bản cơ sở theo UR-C-030①–⑥
☐ Xem cơ sở ngoài giờ hoạt động
☐ Xem cơ sở vào đúng ngày nghỉ/lễ đã khai báo (nếu có cơ chế)
☐ Danh sách dịch vụ hiển thị đúng tag HOT/MỚI/GIẢM GIÁ
☐ Cơ sở chưa có dịch vụ nào
☐ Chi tiết dịch vụ hiển thị giá gốc + giá KM đúng
☐ Bấm "Đặt lịch ngay" từ trang chi tiết dịch vụ
☐ Gallery: xem full-screen, zoom, swipe
☐ Nút Gọi điện / Chỉ đường / Yêu thích
☐ Xem cơ sở vừa bị Admin khóa (trang đã cache trước đó)
☐ Rating trung bình cập nhật đúng sau khi có review mới

### 13. Giảng viên có thể hỏi gì?
- Nếu cơ sở đã đóng cửa (ngoài giờ hoạt động) nhưng khách vẫn xem được nút "Đặt lịch ngay" và đặt được cho ngày mai, hệ thống có chặn đặt lịch cho giờ cơ sở không mở không?
- `avg_rating` được tính lại theo cơ chế nào — real-time hay batch? Đánh đổi giữa 2 cách này là gì?
- Giá khuyến mãi hiển thị lấy từ `SERVICE.promo_price` hay từ bảng PROMOTION? Nếu cả hai cùng áp dụng, giá nào thắng?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟡 Medium (🟠 High riêng ở điểm "ngày nghỉ không có chỗ lưu trong schema" vì ảnh hưởng trực tiếp đến khả năng đặt lịch sai ngày).

---

## MODULE 5: Đặt lịch hẹn (Booking) — MODULE CORE ⚠️
**UR liên quan**: UR-C-040 → UR-C-046
**Phạm vi theo URD**: Đặt lịch đơn lẻ, đặt combo, đặt định kỳ, chọn nhân viên, hủy lịch, đổi lịch, áp voucher/khuyến mãi. URD tự đánh dấu đây là module core, cần UX mượt nhất.

> Đây là module rủi ro cao nhất của toàn hệ thống — mọi lỗ hổng liên-module A, C, D, G, H, I ở file 00 đều hội tụ về đây.

### 1. Business cases
- Đặt lịch đơn lẻ: chọn cơ sở → dịch vụ → nhân viên (hoặc "Bất kỳ") → ngày giờ → xác nhận; hệ thống hiển thị slot trống 30'/1h, tổng chi phí dự kiến, cho thêm ghi chú (UR-C-040).
- Đặt combo nhiều dịch vụ cùng 1 cơ sở, hệ thống tự tính tổng thời gian, hiển thị giá combo nếu có, chọn nhân viên riêng cho từng dịch vụ hoặc "Bất kỳ" (UR-C-041).
- Đặt định kỳ: chọn tần suất (tuần/2 tuần/tháng), ngày giờ cố định, số lần lặp hoặc "cho đến khi hủy", hệ thống tự tạo các lịch tương lai, sửa/hủy từng lần hoặc toàn chuỗi (UR-C-042).
- Chọn nhân viên cụ thể: xem ảnh/tên/đánh giá/kinh nghiệm, xem lịch trống của nhân viên, hoặc chọn "Bất kỳ" (UR-C-043).
- Hủy lịch: miễn phí nếu ≥2 giờ trước giờ hẹn, cảnh báo/có thể phí hủy nếu <2 giờ, không hủy được sau giờ hẹn, yêu cầu chọn lý do, gửi thông báo cơ sở (UR-C-044).
- Đổi lịch: chọn lịch cần đổi → ngày/giờ mới → kiểm tra slot trống → xác nhận, giới hạn chỉ đổi trước ≥1 giờ so với lịch cũ (UR-C-045).
- Áp mã khuyến mãi/voucher: nhập mã hoặc chọn từ "Voucher của tôi", hệ thống validate hạn/điều kiện, hiển thị số tiền giảm và tổng mới (UR-C-046).

### 2. Edge cases
- **Race condition đặt trùng slot**: 2 khách chọn đúng cùng nhân viên + đúng cùng khung giờ, bấm Xác nhận gần như đồng thời — URD không có bất kỳ cơ chế lock/giao dịch atomic nào được đặc tả cho bước tạo Booking; BOOKING entity cũng không có unique constraint nào trên cặp (`staff_id`, `booking_datetime`) (→ liên hệ 0.4.B, 0.4.C, và mục 7 dưới).
- Khách chọn nhân viên "Bất kỳ" — thuật toán phân bổ tự động dựa trên tiêu chí gì (round-robin? ít lịch nhất? ngẫu nhiên?) hoàn toàn không được đặc tả. *Thiếu đặc tả nghiêm trọng vì đây là core logic của tính năng.*
- Cơ sở đóng cửa/nghỉ lễ đột xuất **giữa lúc** khách đang chọn slot (khách đã mở màn chọn giờ trước khi cơ sở cập nhật lịch nghỉ) — khách vẫn thấy slot "trống" và đặt được.
- Nhân viên vừa được chủ cơ sở đánh dấu "Nghỉ phép" (UR-B-030④) đúng lúc khách đang xem lịch trống của nhân viên đó.
- Khách đặt combo gồm dịch vụ A (30 phút) + dịch vụ B (60 phút) nhưng 2 dịch vụ cần 2 nhân viên khác nhau chạy **song song** (thực tế salon có thể làm tóc + làm nail đồng thời với 2 thợ) — hệ thống "tự tính tổng thời gian" (UR-C-041②) có cộng dồn tuần tự (90 phút) hay hiểu được chạy song song (30 hoặc 60 phút)? URD chỉ nói "tự tính tổng" — ngầm định cộng dồn tuần tự, có thể sai với thực tế vận hành salon.
- Đặt lịch định kỳ "cho đến khi hủy" — lịch được tạo trước bao xa (tạo sẵn cả năm hay tạo cuốn chiếu từng tháng)? Nếu một lần trong chuỗi định kỳ rơi vào ngày cơ sở đã đóng cửa (khai báo sau khi chuỗi đã được tạo), lần đó xử lý sao (tự hủy, tự báo lỗi, hay vẫn "trống" ảo)?
- Đặt lịch định kỳ nhưng giá dịch vụ thay đổi giữa các lần lặp — mỗi lần lặp tính giá tại thời điểm tạo chuỗi hay tại thời điểm từng lần diễn ra?
- Đổi lịch (UR-C-045④: chỉ đổi trước ≥1 giờ) nhưng không giới hạn **số lần đổi tối đa** — khách có thể đổi lịch liên tục vô hạn lần, mỗi lần cách giờ hẹn cũ >1 giờ, để "câu giờ" giữ slot mà không có ý định đến. Đây chính là ví dụ mà đề bài gốc đã gợi ý ("Khách được đổi lịch tối đa bao nhiêu lần?") — *Cần bổ sung.*
- Hủy lịch đúng lúc 2 giờ (biên giới chính xác 2:00:00) — tính "miễn phí" hay "có thể phí"? Quy tắc đóng/mở khoảng không rõ.
- Khách mất mạng ngay lúc bấm "Xác nhận" đặt lịch — request có tới server không, khách không biết đã đặt thành công hay chưa, có thể bấm lại tạo trùng booking.
- Voucher vừa hết hạn đúng lúc khách đang ở bước xác nhận thanh toán (đã áp mã, tổng tiền đã trừ giảm giá, nhưng khi bấm Xác nhận thì voucher đã qua hạn theo giờ server).
- Khách đặt lịch cho **chính khung giờ hiện tại hoặc trong quá khứ** (do lỗi đồng bộ giờ thiết bị/timezone) — không thấy validate "ngày giờ đặt phải ở tương lai, sau thời điểm hiện tại + khoảng đệm tối thiểu nào đó".
- Cơ sở có bật "Auto-accept" (UR-B-050④, tùy chọn cấu hình) — khi đó bước "Chờ xác nhận" gần như biến mất; nếu 2 khách đặt trùng slot khi Auto-accept đang mở, cả 2 đều được tự động xác nhận trước khi phát hiện xung đột.

### 3. Exception cases
- API tạo booking timeout — khách không rõ trạng thái, dễ bấm lại (double booking do double-submit, xem mục 11).
- Database mất kết nối giữa lúc đang ghi Booking + BOOKING_ITEM (combo) — nếu không dùng transaction, có thể tạo Booking cha nhưng thiếu Booking_item con (dữ liệu combo bị cắt cụt).
- Push notification báo "Đặt lịch thành công" gửi thất bại — khách không chắc đã đặt thành công, dễ đặt lại.
- Tính năng validate voucher gọi service ngoài (nếu Promotion service tách riêng) bị timeout.
- Đổi lịch nhưng slot mới vừa bị người khác giữ ngay trong khoảnh khắc kiểm tra và xác nhận (giữa bước "① Chọn ngày/giờ mới" và "② Kiểm tra slot trống → Xác nhận" của UR-C-045 tồn tại khoảng hở thời gian).

### 4. Validation cases còn thiếu
- Thời lượng dịch vụ = 0 hoặc âm (kế thừa lỗi từ Service Management nhưng ảnh hưởng trực tiếp việc tính slot ở Booking).
- Giờ đặt lịch nằm ngoài giờ hoạt động cơ sở (`opening_time`–`closing_time`) — không thấy validate rõ ràng ở tiêu chí chấp nhận (chỉ ẩn ý qua "khung giờ trống").
- Số lượng dịch vụ tối đa trong 1 combo (không giới hạn → khách có thể chọn 20 dịch vụ 1 lúc, tổng thời gian vượt cả ngày làm việc cơ sở).
- Ghi chú (note) khi đặt lịch: giới hạn độ dài, chặn nội dung không hợp lệ (số điện thoại spam, link ngoài).
- Số lần lặp tối đa cho đặt định kỳ (không giới hạn → khách chọn lặp "hàng tuần" "cho đến khi hủy" vô thời hạn, hệ thống phải tạo bao nhiêu booking tương lai một lúc?).

### 5. Business Rule còn thiếu (đây là phần dày đặc nhất của cả URD)
- Khách được đổi lịch tối đa bao nhiêu lần? *(ví dụ gốc trong yêu cầu — xác nhận: chưa có trong URD.)*
- Khách được hủy lịch tối đa bao nhiêu lần/tháng trước khi bị hạn chế đặt lịch (chống việc giữ slot ảo rồi hủy liên tục)? *Cần bổ sung.*
- Phí hủy (UR-C-044②) là bao nhiêu % hay số tiền cố định? Ai cấu hình (Admin hệ thống hay từng cơ sở tự đặt)? Thu bằng cách nào khi Phase 1 chưa có thanh toán online (→ 0.4.A)? *Cần bổ sung — mâu thuẫn nghiêm trọng.*
- Voucher dùng được nhiều lần trên 1 tài khoản không, hay chỉ 1 lần/user/toàn bộ thời hạn? *Thiếu đặc tả (ví dụ gốc trong yêu cầu).*
- Một Booking có được áp nhiều voucher cùng lúc không? (ER diagram ở §6.3 gợi ý BOOKING—0/1—PROMOTION, tức tối đa 1, nhưng phần Yêu cầu chức năng UR-C-046 không nói rõ điều này bằng văn bản — *mâu thuẫn ngầm giữa Data Model và Functional Requirements, cần phát biểu rõ thành rule tường minh.*)
- Thuật toán phân bổ nhân viên khi chọn "Bất kỳ" — tiêu chí gì (đã nêu ở Edge case)? *Cần bổ sung.*
- Buffer time giữa 2 lịch hẹn liên tiếp của cùng nhân viên (→ 0.4.H)? *Cần bổ sung.*
- Đặt lịch định kỳ: nếu 1 lần trong chuỗi bị hủy bởi cơ sở, các lần sau trong chuỗi có tự động hủy theo không hay vẫn tiếp tục? *Thiếu đặc tả.*
- Giá áp dụng cho Booking là giá tại thời điểm đặt hay thời điểm thực hiện dịch vụ (→ 0.4.G — chưa có price snapshot)? *Cần bổ sung.*
- Có giới hạn số lượng Booking "Chờ xác nhận" đồng thời mà 1 khách được giữ không (chống 1 khách đặt 10 lịch cùng lúc ở 10 cơ sở khác nhau để giữ chỗ)? *Thiếu đặc tả.*
- Timeout cho trạng thái "Chờ xác nhận" — nếu cơ sở không phản hồi trong X giờ, booking tự hủy hay tồn đọng vô thời hạn (→ 0.4.C)? *Cần bổ sung.*

### 6. Permission Cases
- Khách A gọi API sửa/hủy Booking của khách B bằng cách đoán/thử `booking_id` (IDOR) — cần kiểm tra `user_id` sở hữu booking ở tầng backend cho mọi hành động sửa/hủy/đổi lịch.
- Cơ sở B có xem/sửa được Booking đặt tại cơ sở A không (kiểm tra ownership theo `business_id`)?
- Nhân viên (Staff) — vì không có tài khoản đăng nhập riêng theo §1.3 (→ 0.4.J) — không có khái niệm "quyền của nhân viên với booking của chính mình"; toàn bộ đi qua chủ cơ sở.

### 7. Concurrency Cases (trọng tâm QA của module này)
- **Hai khách đặt cùng slot** (cùng nhân viên, cùng giờ) — cần transaction + unique constraint hoặc pessimistic/optimistic lock ở tầng DB; URD không đề cập cơ chế nào.
- Khách đổi lịch đúng lúc cơ sở hủy lịch đó (2 thao tác trái chiều cùng lúc trên 1 booking) — ai thắng, trạng thái cuối là gì?
- Cơ sở sửa giá dịch vụ đúng lúc khách đang ở bước checkout (đã thấy tổng tiền cũ trên UI, bấm Xác nhận sau khi giá đã đổi) (→ 0.4.G).
- Hai admin/nhân viên hệ thống duyệt/sửa cùng 1 cấu hình khuyến mãi mà booking đang dùng để tính giảm giá.
- Khách bấm "Xác nhận" 2 lần liên tiếp do mạng chậm (double submit) — không thấy idempotency key nào được thiết kế cho API tạo booking.
- Đặt lịch định kỳ tạo ra N booking tương lai trong 1 transaction — nếu 1 trong N lần bị trùng slot (do đã có booking khác từ trước ở đúng lần đó), toàn bộ chuỗi rollback hay chỉ báo lỗi lần đó và giữ các lần hợp lệ khác?

### 8. Data Integrity
- BOOKING không có `end_datetime`/`duration_minutes` — chỉ có `booking_datetime` (1 mốc thời gian) — không đủ để kiểm tra chồng chéo (overlap) giữa các booking của cùng 1 nhân viên, đặc biệt với combo có tổng thời gian dài.
- BOOKING.staff_id là **1 trường duy nhất** trong khi UR-C-043④ yêu cầu chọn nhân viên **riêng cho từng dịch vụ trong combo** — mâu thuẫn schema đã nêu ở 0.4.B, thể hiện rõ nhất ngay tại module này.
- BOOKING_ITEM (chứa các dòng dịch vụ trong 1 combo) không có attribute nào được định nghĩa — không rõ có lưu giá/thời lượng/nhân viên tại thời điểm đặt (snapshot) hay chỉ tham chiếu `service_id` (nếu vậy, đổi giá dịch vụ sau này sẽ "sửa" cả lịch sử — sai dữ liệu tài chính).
- Khi Booking bị xóa (nếu có hard-delete) nhưng Review đã được viết tham chiếu tới Booking đó — REVIEW không có `booking_id` trong entity mô tả ở §6.2 (chỉ có `service_id`, `business_id`, `staff_id`) — vậy hệ thống dựa vào đâu để xác nhận "khách đã thực sự hoàn thành dịch vụ này" trước khi cho viết review (chống review giả)? *Đây là lỗ hổng Data Integrity nghiêm trọng, hé lộ nguy cơ review khống.*
- Booking định kỳ: chuỗi các booking có được liên kết bằng 1 `recurrence_id`/`parent_booking_id` chung không? Không có trường nào cho việc này trong BOOKING — vậy "sửa/hủy toàn bộ chuỗi" (UR-C-042⑤) sẽ được thực hiện dựa trên tiêu chí nào để tìm ra "toàn bộ chuỗi" đó?

### 9. Security Risks
- IDOR trên `booking_id` (đã nêu ở Permission).
- Khách chỉnh sửa giá tổng (`total_amount`) qua request giả mạo (client-side tính rồi gửi thẳng lên) nếu backend không tự tính lại giá từ dữ liệu service/voucher mà tin vào giá trị client gửi lên — cần server tự tính giá, không nhận giá từ client.
- Áp dụng voucher không thuộc quyền sở hữu của mình (thử mã voucher của người khác qua brute-force mã ngắn).

### 10. Performance Risks
- Kiểm tra "slot trống" (`GET /bookings/available-slots`) phải quét lịch làm việc (SCHEDULE — không có attribute, → 0.4.B) + toàn bộ booking hiện có của nhân viên trong ngày — nếu tính real-time mỗi lần khách mở màn chọn giờ, cần index tốt trên (`staff_id`, `booking_datetime`); với NFR-004 (≥5.000 concurrent users) vào giờ cao điểm (tối, cuối tuần) đây là điểm nghẽn lớn nhất của hệ thống.
- Tạo hàng loạt booking cho lịch định kỳ dài hạn ("cho đến khi hủy") trong 1 request có thể vượt timeout API (NFR-001: ≤500ms) nếu tạo đồng bộ (synchronous) toàn bộ chuỗi.

### 11. UI/UX Traps
- **Double-click nút "Xác nhận đặt lịch"** — kinh điển, không thấy debounce/disable-after-click hay idempotency key được đặc tả.
- Nhấn Back giữa lúc đang ở bước chọn giờ (đã chọn dịch vụ+nhân viên) — có giữ lại lựa chọn khi quay lại không, hay phải chọn lại từ đầu (UR-C-040 không đề cập việc lưu tạm draft booking)?
- Refresh trang/app giữa lúc đang thanh toán/xác nhận — mất toàn bộ lựa chọn đã làm.
- Chọn ngày quá khứ (date picker không chặn) — nếu FE không validate, phải trông chờ hoàn toàn vào BE.
- Không thấy slot trống nào hiển thị (cơ sở kín lịch) — màn hình trống, không gợi ý ngày/nhân viên khác gần nhất còn trống.

### 12. Tester Checklist
☐ Đặt lịch đơn lẻ thành công
☐ Đặt lịch thất bại (thiếu trường bắt buộc)
☐ Đặt lịch trùng giờ với booking khác của cùng nhân viên (kỳ vọng bị chặn)
☐ Đặt lịch ngoài giờ hoạt động cơ sở
☐ Đặt lịch vào ngày cơ sở nghỉ/lễ
☐ Đặt lịch khi nhân viên đã nghỉ phép/nghỉ việc
☐ Đặt lịch với voucher hợp lệ / hết hạn / sai điều kiện
☐ Đặt lịch combo nhiều dịch vụ, nhiều nhân viên khác nhau
☐ Đặt lịch định kỳ, kiểm tra tạo đúng số lần lặp
☐ Sửa/hủy 1 lần trong chuỗi định kỳ vs toàn bộ chuỗi
☐ Hủy lịch trước ≥2 giờ (miễn phí) và <2 giờ (cảnh báo/phí)
☐ Hủy lịch sau giờ hẹn (kỳ vọng bị chặn)
☐ Đổi lịch trước ≥1 giờ và <1 giờ so với lịch cũ
☐ Đổi lịch nhiều lần liên tiếp (kiểm tra có giới hạn không — hiện tại: không)
☐ 2 khách đặt cùng slot cùng lúc (test đồng thời bằng script/tool load test)
☐ Double-click nút xác nhận đặt lịch
☐ Mất mạng ngay sau khi bấm xác nhận, kiểm tra booking có bị tạo trùng khi thử lại
☐ Chọn nhân viên "Bất kỳ", kiểm tra thuật toán phân bổ
☐ Đặt lịch cho thời điểm trong quá khứ
☐ Cơ sở đổi giá dịch vụ giữa lúc khách đang checkout

### 13. Giảng viên có thể hỏi gì?
- Nếu hai khách đặt cùng lúc một khung giờ với cùng một nhân viên, hệ thống của bạn xử lý ở tầng nào (UI, application logic, hay database constraint)? Bạn dùng loại lock gì?
- Nếu cơ sở đổi giá dịch vụ giữa lúc khách đang đặt lịch, khách trả giá nào?
- Khách được đổi lịch tối đa bao nhiêu lần? Vì sao chọn số đó?
- Nếu khách mất mạng đúng lúc bấm xác nhận đặt lịch, làm sao đảm bảo không tạo booking trùng khi khách thử lại?
- Thuật toán chọn nhân viên "Bất kỳ" hoạt động theo cơ chế nào?
- Vì sao BOOKING chỉ có 1 `staff_id` nhưng combo lại yêu cầu chọn nhân viên riêng cho từng dịch vụ?
- Phí hủy lịch được thu bằng cách nào khi hệ thống chưa có thanh toán online ở Phase 1?
- Buffer time giữa 2 lịch hẹn liên tiếp của 1 nhân viên được xử lý ở đâu?

### 14. Mức độ nghiêm trọng tổng thể của module: 🔴 Critical — đây là module lõi; mọi race condition, thiếu snapshot giá, và thiếu rule giới hạn đều có thể gây sai lệch tiền bạc và trải nghiệm nghiêm trọng ngay khi lên production.

---

## MODULE 6: Quản lý Lịch hẹn của khách (My Bookings)
**UR liên quan**: UR-C-050 → UR-C-052
**Phạm vi theo URD**: Danh sách lịch hẹn theo 3 tab (Sắp tới/Đã hoàn thành/Đã hủy), chi tiết lịch hẹn (timeline trạng thái, nút Hủy/Đổi lịch/Gọi/Chỉ đường), lịch sử + lọc + tổng chi tiêu + Re-book.

### 1. Business cases
- Khách xem 3 tab: Sắp tới, Đã hoàn thành, Đã hủy; mỗi item hiển thị cơ sở/dịch vụ/ngày giờ/trạng thái/tổng tiền, sắp xếp mới nhất trước, pull-to-refresh (UR-C-050).
- Khách xem chi tiết 1 lịch hẹn: mã, cơ sở, dịch vụ, nhân viên, ngày giờ, ghi chú, timeline trạng thái dạng stepper, nút Hủy/Đổi lịch/Gọi điện/Chỉ đường (UR-C-051).
- Khách xem lịch sử đã hoàn thành, lọc theo thời gian/cơ sở/nhóm dịch vụ, xem tổng chi tiêu theo tháng/quý/năm, đặt lại dịch vụ tương tự — Re-book (UR-C-052).

### 2. Edge cases
- **Chỉ có 3 tab (Sắp tới/Đã hoàn thành/Đã hủy) nhưng vòng đời Booking có ít nhất 6 trạng thái** (Chờ xác nhận, Đã xác nhận, Đang thực hiện, Hoàn thành, Đã hủy, No-show — theo UR-B-051③ và §7). "Đang thực hiện" và "No-show" **không thuộc tab nào cả** — khách sẽ không tìm thấy lịch hẹn đang ở 2 trạng thái này ở đâu trong danh sách của chính mình. Đây là một lỗ hổng UI/luồng dữ liệu rất cụ thể và dễ bị bỏ qua.
- Timeline dạng stepper (UR-C-051④) vốn được thiết kế cho luồng tuyến tính — nhưng vòng đời thực tế có rẽ nhánh (Rejected, Cancelled, No-show, Rescheduled — xem sơ đồ §7); stepper hiển thị nhánh rẽ như thế nào (dừng giữa đường và tô đỏ? hay không hiển thị được)?
- "Đặt lại dịch vụ tương tự" (Re-book) khi cơ sở đã đóng cửa/bị khóa, dịch vụ đã bị xóa, hoặc nhân viên đã nghỉ việc — Re-book dẫn khách vào luồng nào?
- Re-book nhưng giá dịch vụ đã thay đổi so với lần trước — hiển thị giá cũ (gây hiểu lầm) hay tự động cập nhật giá mới mà không báo?
- "Tổng chi tiêu theo tháng/quý/năm" (UR-C-052③) — có tính cả những booking đã hủy giữa đường (đã thu 1 phần phí hủy) không, hay chỉ tính "Hoàn thành"? *Không có rule rõ.*
- Khách có rất nhiều lịch hẹn (khách trung thành nhiều năm) — danh sách dài không thấy đề cập phân trang/lazy-load.
- Pull-to-refresh (UR-C-050④) giữa lúc dữ liệu đang được đẩy real-time qua WebSocket (theo UR-API-003) — có thể gây nhấp nháy/trùng lặp item nếu FE không merge state đúng cách.

### 3. Exception cases
- API lấy danh sách booking lỗi/timeout — tab hiển thị trống, không phân biệt được với trường hợp "khách chưa từng đặt lịch nào".
- Chi tiết lịch hẹn không tìm thấy (`booking_id` không tồn tại — do bị xóa cứng ở DB, nếu có) khi khách bấm vào từ danh sách đã cache cũ trên máy.
- Nút "Gọi điện"/"Chỉ đường" ở màn chi tiết lỗi giống Module 4.

### 4. Validation cases còn thiếu
- Bộ lọc "Thời gian" ở lịch sử (UR-C-052②): khoảng ngày "từ" sau "đến".
- Không có input nhập liệu nào khác đáng kể ở module thuần hiển thị này ngoài các nút hành động (Hủy/Đổi lịch) — validation của các hành động đó đã nêu ở Module 5.

### 5. Business Rule còn thiếu
- Lịch hẹn "Đang thực hiện" và "No-show" hiển thị ở tab nào? *Cần bổ sung — lỗ hổng cụ thể nêu ở Edge cases.*
- "Tổng chi tiêu" có tính phần đã thanh toán của booking bị hủy giữa đường không? *Thiếu đặc tả.*
- Re-book có giữ nguyên nhân viên/ghi chú cũ hay chỉ giữ dịch vụ và để khách chọn lại phần còn lại? *Thiếu đặc tả.*

### 6. Permission Cases
- Khách A xem chi tiết booking của khách B qua đoán/thử `booking_id` trong request (IDOR) — cần kiểm tra ownership ở backend, không chỉ ở việc danh sách hiển thị (vì URL/API chi tiết có thể bị gọi trực tiếp).

### 7. Concurrency Cases
- Khách đang xem màn chi tiết (đã load "Chờ xác nhận") đúng lúc cơ sở xác nhận/từ chối ở phía Web Portal — màn hình khách có tự cập nhật theo real-time (WebSocket/SSE theo UR-API-003) hay khách phải tự thoát vào lại?
- Khách bấm "Hủy" ở đúng thời điểm cơ sở bấm "Đánh dấu hoàn thành" phía Web Portal cho cùng booking đó (2 hành động trái chiều gần như đồng thời).

### 8. Data Integrity
- Nếu BUSINESS/SERVICE/STAFF liên quan tới 1 booking cũ bị xóa (không chỉ khóa) khỏi hệ thống, danh sách lịch sử của khách hiển thị "không xác định" ở các trường tên cơ sở/dịch vụ/nhân viên — hé lộ lại vấn đề cần soft-delete (đánh dấu ẩn) thay vì xóa cứng cho mọi entity liên quan tới Booking.

### 9. Security Risks
- IDOR đã nêu ở Permission — đây là nguy cơ lớn nhất của module này vì lộ toàn bộ thông tin cá nhân/lịch trình của khách khác (địa điểm, giờ giấc — có thể dùng để rình rập ngoài đời thực).

### 10. Performance Risks
- Query "Tổng chi tiêu theo tháng/quý/năm" tính aggregate trên toàn bộ lịch sử của khách — nếu tính real-time mỗi lần mở tab mà không cache/pre-aggregate, chậm dần theo số năm sử dụng của khách lâu năm.

### 11. UI/UX Traps
- Bấm nút "Hủy"/"Đổi lịch" ngay trên item danh sách (không qua trang chi tiết) dễ bấm nhầm giữa nhiều item liền kề — cần bước xác nhận phụ (confirm dialog).
- Pull-to-refresh liên tục do thói quen tay khi mạng chậm, gây gọi API lặp lại không cần thiết.

### 12. Tester Checklist
☐ Hiển thị đúng 3 tab với dữ liệu tương ứng
☐ Booking ở trạng thái "Đang thực hiện" — xác minh xuất hiện ở tab nào
☐ Booking ở trạng thái "No-show" — xác minh xuất hiện ở tab nào
☐ Chi tiết lịch hẹn hiển thị đầy đủ theo UR-C-051①
☐ Timeline/stepper hiển thị đúng cho lịch hẹn bị hủy giữa đường
☐ Hủy/Đổi lịch/Gọi điện/Chỉ đường từ màn chi tiết
☐ Lọc lịch sử theo thời gian/cơ sở/nhóm dịch vụ
☐ Tổng chi tiêu tháng/quý/năm khớp số học với danh sách hoàn thành
☐ Re-book khi cơ sở/dịch vụ gốc vẫn còn hoạt động
☐ Re-book khi dịch vụ gốc đã bị xóa/ẩn
☐ Pull-to-refresh trong khi có cập nhật real-time đang tới
☐ Gọi API chi tiết booking bằng `booking_id` của người khác → kỳ vọng bị từ chối

### 13. Giảng viên có thể hỏi gì?
- Trạng thái "Đang thực hiện" và "No-show" hiển thị ở tab nào trong màn "Lịch hẹn của tôi"?
- Nếu dịch vụ trong lịch sử đã bị cơ sở xóa, chức năng "Đặt lại" (Re-book) hoạt động ra sao?
- Danh sách lịch hẹn có phân trang không? Nếu khách có hàng trăm lịch hẹn, tải toàn bộ 1 lần có ảnh hưởng hiệu năng không?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟡 Medium (riêng lỗ hổng IDOR ở mục 9 là 🟠 High vì lộ dữ liệu cá nhân/lịch trình).

---

## MODULE 7: Đánh giá & Bình luận (Review & Rating)
**UR liên quan**: UR-C-060 → UR-C-062
**Phạm vi theo URD**: Đánh giá dịch vụ (sao theo 4 tiêu chí, bình luận, ảnh, ẩn danh), đánh giá nhân viên riêng, xem đánh giá của người khác + lọc + tổng hợp.

### 1. Business cases
- Sau khi hoàn thành dịch vụ, khách nhận popup/push nhắc đánh giá, chấm sao 1-5 cho 4 tiêu chí (chất lượng/thái độ/không gian/giá), viết bình luận ≤500 ký tự, đính kèm ≤5 ảnh, có thể ẩn danh (UR-C-060).
- Khách đánh giá riêng cho nhân viên/thợ: sao + bình luận ngắn + tag (Tay nghề tốt/Tận tâm/Đúng giờ...) (UR-C-061).
- Khách xem đánh giá của người khác, lọc theo số sao/có ảnh/mới nhất, xem tổng hợp điểm trung bình + biểu đồ phân bổ theo sao (UR-C-062).

### 2. Edge cases
- **Review không có liên kết `booking_id`** trong Data Model (§6.2 REVIEW chỉ có `user_id`, `business_id`, `service_id`, `staff_id`, `rating`, `comment`, `is_anonymous`) — vậy hệ thống dựa vào đâu để đảm bảo khách **đã thực sự đặt và hoàn thành** dịch vụ đó trước khi cho phép viết review? Nếu không ràng buộc theo booking, một khách có thể viết review cho dịch vụ mình chưa từng dùng (review khống) — đây là lỗ hổng Data Integrity/Business Rule nghiêm trọng nhất của module này, và cũng là gốc của rủi ro "review spam" mà đề bài gốc gợi ý.
- Vì thiếu `booking_id`, một khách có thể viết **nhiều review cho cùng 1 dịch vụ** sau nhiều lần dùng — có được phép không, hay chỉ 1 review/dịch vụ/khách (bất kể dùng bao nhiêu lần)? *Thiếu đặc tả.*
- Popup nhắc đánh giá xuất hiện đúng lúc khách đang ở luồng khác (đang đặt lịch mới) — chồng chéo UX.
- Khách đánh giá 1 sao rất thấp + bình luận tiêu cực có chứa thông tin nhạy cảm/xúc phạm — có kiểm duyệt trước khi hiển thị công khai hay hiển thị ngay rồi kiểm duyệt sau (UR-A-062② "Duyệt/Ẩn/Xóa" ngụ ý kiểm duyệt sau, tức review xấu có thể đã hiển thị công khai một thời gian trước khi Admin xử lý)?
- **API có endpoint `PUT /reviews/:id` (sửa review) nhưng module chức năng 3.1.7 hoàn toàn không đề cập tính năng sửa/xóa review ở phía khách** — mâu thuẫn trực tiếp giữa mục 3.4 (API) và mục 3.1.7 (Functional Requirement). Đây là ví dụ điển hình chính xác cho câu hỏi gốc "Review có sửa được không?" mà đề bài đưa ra — và câu trả lời hiện tại là: **có API nhưng không có đặc tả UI/rule đi kèm** (giới hạn thời gian sửa? số lần sửa? có ghi nhận "đã chỉnh sửa" không? sửa có làm rating trung bình tính lại ngay không?).
- Cơ sở/chủ salon có được phản hồi (reply) lại review không? URD không đề cập tính năng này ở bất kỳ đâu (không có trong Permission Matrix, không có API, không có FR) — đây là tính năng phổ biến trong các app cùng loại (Booking.com, Grab...), và sự vắng mặt hoàn toàn của nó là điểm đáng để hỏi trong buổi phản biện, dù không nên tự thêm vào bản thiết kế.
- Ảnh đính kèm review (≤5 ảnh) chứa hình ảnh không liên quan/nhạy cảm — kiểm duyệt ảnh (khác kiểm duyệt text) không được đề cập.

### 3. Exception cases
- Upload ảnh kèm review lỗi (mạng yếu) — review có được gửi thiếu ảnh, hay toàn bộ bị hủy?
- Push nhắc đánh giá gửi thất bại — khách hoàn thành dịch vụ nhưng không được nhắc, tỷ lệ review giảm.

### 4. Validation cases còn thiếu
- Bình luận vượt quá 500 ký tự (giới hạn cứng ở BE hay chỉ ở FE?).
- Rating ngoài khoảng 1-5 (0 sao, 6 sao, số thập phân) gửi qua API trực tiếp (bỏ qua UI).
- Số ảnh đính kèm >5 gửi qua API trực tiếp.
- Định dạng/kích thước ảnh đính kèm review.

### 5. Business Rule còn thiếu
- Review có sửa được không? Trong bao lâu sau khi đăng? *Cần bổ sung (mâu thuẫn API vs FR đã nêu ở Edge case).*
- Review có xóa được bởi chính khách không (khác với Admin xóa do vi phạm)? *Thiếu đặc tả.*
- 1 khách được viết bao nhiêu review cho cùng 1 dịch vụ/cùng 1 cơ sở? *Thiếu đặc tả.*
- Rating tổng hợp (`avg_rating` trên BUSINESS) có loại trừ review đã bị Admin ẩn/xóa khỏi công thức tính không? *Cần bổ sung.*
- Cơ sở có được phản hồi review không? *Vắng mặt hoàn toàn — nêu để phản biện, không tự thêm vào thiết kế.*

### 6. Permission Cases
- Khách A sửa/xóa review của khách B qua gọi trực tiếp `PUT /reviews/:id` với `id` không thuộc về mình.
- Cơ sở có xem được review nào đó đang ở trạng thái "Ẩn" (do Admin ẩn) không, hay chỉ khách/Admin thấy được?
- Theo Permission Matrix (§8): Cơ sở hoàn toàn **không có quyền** với "Đánh giá/Bình luận" (❌) — nghĩa là cơ sở không thể tự báo cáo (report) 1 review sai sự thật/vi phạm để Admin xem xét? Toàn bộ việc phát hiện review xấu chỉ trông chờ vào Admin tự rà soát hoặc rule tự động lọc từ ngữ nhạy cảm (UR-A-062③).

### 7. Concurrency Cases
- Hai review được gửi gần như đồng thời cho cùng 1 dịch vụ vừa lúc `avg_rating` đang được tính lại — cần đảm bảo tính đúng thứ tự cập nhật (không bị lệch do race condition khi 2 request cùng đọc-sửa-ghi giá trị trung bình).
- Admin đang ẩn 1 review đúng lúc khách đang sửa review đó (nếu tính năng sửa tồn tại).

### 8. Data Integrity
- Thiếu `booking_id` trên REVIEW (đã nêu ở Edge case) — đây là lỗ hổng data integrity nghiêm trọng nhất của cả module, vì không có cách nào ràng buộc "review chỉ được viết sau khi hoàn thành dịch vụ thực sự", trong khi chính URD (UR-C-060①) mô tả luồng là "nhắc đánh giá **sau khi hoàn thành**" — tức bản thân yêu cầu chức năng đã ngụ ý cần ràng buộc này nhưng schema lại không hỗ trợ.
- Nếu Business/Service/Staff bị xóa sau khi đã có review liên quan — review "trôi nổi" không còn ngữ cảnh hiển thị đầy đủ (trường hợp ví dụ gốc "Booking bị xóa nhưng review còn" áp dụng tương tự ở đây).

### 9. Security Risks
- Review giả/khống do thiếu ràng buộc booking (đã nêu) — rủi ro thao túng rating (cạnh tranh không lành mạnh giữa các cơ sở, mua bán review).
- XSS qua nội dung bình luận nếu hiển thị không sanitize.
- Spam review tự động (bot) nếu không có rate-limit riêng cho endpoint tạo review.

### 10. Performance Risks
- Tính lại `avg_rating` và biểu đồ phân bổ theo sao (UR-C-062④) mỗi khi có review mới trên cơ sở có hàng nghìn review — cần cân nhắc pre-aggregate/cache thay vì tính real-time toàn bộ.

### 11. UI/UX Traps
- Popup nhắc đánh giá xuất hiện chặn ngang luồng khác đang làm (VD: đang đặt lịch mới) mà không cho tắt dễ dàng.
- Đính kèm ảnh: chọn nhiều ảnh cùng lúc rồi mạng yếu — 1 vài ảnh tải xong, 1 vài ảnh lỗi, khách không biết ảnh nào bị thiếu.

### 12. Tester Checklist
☐ Viết review đầy đủ 4 tiêu chí sao + bình luận + ảnh + ẩn danh
☐ Viết review khi chưa từng đặt/hoàn thành dịch vụ đó (kỳ vọng bị chặn — hiện tại: không có ràng buộc)
☐ Viết review vượt 500 ký tự
☐ Đính kèm >5 ảnh
☐ Đánh giá riêng cho nhân viên
☐ Xem danh sách đánh giá, lọc theo sao/có ảnh/mới nhất
☐ Tổng hợp điểm trung bình cập nhật đúng sau review mới
☐ Gọi API sửa review của người khác
☐ Admin ẩn/xóa review vi phạm — kiểm tra review biến mất khỏi danh sách công khai và không tính vào avg_rating
☐ Rule tự động ẩn bình luận chứa từ ngữ nhạy cảm (UR-A-062③)

### 13. Giảng viên có thể hỏi gì?
- Hệ thống đảm bảo review chỉ được viết bởi khách đã thực sự sử dụng dịch vụ bằng cách nào, khi REVIEW không có liên kết tới BOOKING?
- Review có sửa được không? API có endpoint sửa nhưng FR không đề cập — nhóm bạn xử lý thế nào?
- Nếu 1 cơ sở bị vu khống bởi review giả, cơ sở có công cụ nào để phản hồi hoặc báo cáo không?
- Rating trung bình có bị lệch khi review bị Admin ẩn nhưng hệ thống chưa tính lại kịp không?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟠 High — thiếu ràng buộc booking↔review là lỗ hổng ảnh hưởng trực tiếp đến độ tin cậy của toàn hệ thống rating, vốn là yếu tố quyết định hành vi đặt lịch của khách mới.

---

## MODULE 8: Thông báo & Nhắn tin (Notification & Messaging)
**UR liên quan**: UR-C-070 → UR-C-071
**Phạm vi theo URD**: Push notification (nhắc lịch, xác nhận/từ chối/đổi lịch, khuyến mãi, bật/tắt theo loại), chat trực tiếp với cơ sở (text+ảnh, trạng thái đã gửi/đã đọc, push khi có tin mới).

### 1. Business cases
- Khách nhận push nhắc lịch trước 30 phút/1 giờ/1 ngày, thông báo khi cơ sở xác nhận/từ chối/đổi lịch, thông báo khuyến mãi mới, tự cấu hình bật/tắt từng loại (UR-C-070).
- Khách chat trực tiếp với cơ sở trong app, gửi text + ảnh, thấy trạng thái Đã gửi/Đã đọc, nhận push khi có tin mới (UR-C-071).

### 2. Edge cases
- Khách bật "tắt thông báo nhắc lịch" (UR-C-070④) nhưng vẫn cần nhận thông báo quan trọng khác (bị cơ sở từ chối lịch) — 2 loại thông báo có tách bạch được trong cấu hình on/off hay bị tắt chung một cụm?
- Khách tắt toàn bộ push nhưng cơ sở gửi đề xuất lịch mới (UR-B-052③ "Đề xuất lịch mới → Khách xác nhận/từ chối") — nếu khách không biết có đề xuất do đã tắt thông báo, đề xuất "treo" vô thời hạn, ảnh hưởng tới cả trạng thái booking (liên hệ Module 5/6).
- Chat gửi ảnh chứa nội dung không phù hợp (spam/quấy rối) — không thấy kiểm duyệt nội dung chat ở đâu trong URD (chỉ Review mới có kiểm duyệt UR-A-062).
- **Permission Matrix (§8) ghi Admin ❌ với "Chat/Nhắn tin"** — Admin hoàn toàn không có quyền xem/kiểm duyệt nội dung chat giữa khách và cơ sở. Nếu xảy ra quấy rối/lừa đảo qua chat (VD: cơ sở dụ khách thanh toán ngoài hệ thống để né phí), Admin không có cách nào can thiệp trực tiếp trừ khi khách chủ động report bằng kênh khác (không thấy nút "Report cuộc trò chuyện" nào được đặc tả).
- Nhiều thiết bị đăng nhập cùng 1 tài khoản khách — trạng thái "Đã đọc" đồng bộ ra sao giữa các thiết bị?

### 3. Exception cases
- Push notification gửi thất bại (token thiết bị hết hạn/app bị gỡ) — không có cơ chế fallback (email/SMS) cho các thông báo quan trọng như "cơ sở từ chối lịch".
- WebSocket/SSE (theo UR-API-003, dùng cho chat realtime) mất kết nối — UR-API-003③ có yêu cầu "Auto-reconnect khi mất kết nối" nhưng không nói rõ tin nhắn gửi lúc mất kết nối có được queue lại và gửi lại tự động khi reconnect không.
- Ảnh gửi trong chat upload lỗi.

### 4. Validation cases còn thiếu
- Độ dài tối đa 1 tin nhắn text.
- Định dạng/kích thước ảnh gửi trong chat.
- Giới hạn tần suất gửi tin nhắn (chống spam chat).

### 5. Business Rule còn thiếu
- Lịch sử chat được lưu giữ bao lâu? Có bị xóa khi 1 trong 2 bên xóa tài khoản không? *Thiếu đặc tả — liên quan quyền dữ liệu cá nhân.*
- Khách/cơ sở có chặn (block) được nhau trong chat không? *Thiếu đặc tả.*
- Đề xuất lịch mới qua chat (UR-B-052③) có tự động tạo 1 booking mới ở trạng thái chờ hay chỉ là tin nhắn text đơn thuần mà khách phải tự vào lại màn Đặt lịch để xác nhận thủ công? *Thiếu đặc tả — ảnh hưởng trực tiếp luồng dữ liệu Booking.*

### 6. Permission Cases
- Khách A đọc được tin nhắn giữa khách B và 1 cơ sở (IDOR trên `conversation_id`).
- Cơ sở B đọc được cuộc trò chuyện giữa khách và cơ sở A.
- Admin không có quyền xem chat (đã nêu ở Edge case) — cần làm rõ đây là quyết định privacy có chủ đích, hay là một thiếu sót khi thiết kế Permission Matrix.

### 7. Concurrency Cases
- Cả 2 bên (khách & cơ sở) cùng gõ và gửi tin nhắn cùng lúc — thứ tự hiển thị tin nhắn dựa trên timestamp client hay server (client có thể lệch giờ)?

### 8. Data Integrity
- MESSAGE không có attribute nào được định nghĩa (→ 0.4.B) — không rõ có trường `conversation_id`, `read_at`, `attachment_url` hay không, trong khi FR yêu cầu trạng thái "Đã gửi/Đã đọc" (UR-C-071③) rất cụ thể.

### 9. Security Risks
- Không kiểm duyệt nội dung chat — kênh này có thể bị lợi dụng để lừa đảo/dụ giao dịch ngoài hệ thống (đã nêu ở Edge case), hoặc gửi link phishing.
- Lưu trữ ảnh chat không kiểm tra loại file thực (chỉ dựa vào phần mở rộng) — nguy cơ upload file thực thi giả dạng ảnh.

### 10. Performance Risks
- Gửi push hàng loạt (khuyến mãi mới, UR-C-070③) cho toàn bộ user tại 1 thời điểm — không thấy đề cập cơ chế gửi theo lô/hàng đợi (queue) để tránh nghẽn dịch vụ push khi số lượng user lớn (liên hệ UR-A-061, tính năng Admin gửi push hàng loạt).
- Kết nối WebSocket đồng thời cho tất cả người dùng đang mở app (để nhận chat/thông báo realtime) — với NFR-004 (≥5.000 concurrent users), cần kiến trúc scale-out cho WebSocket server, không thấy đề cập.

### 11. UI/UX Traps
- Push nhắc lịch trước 30 phút đến đúng lúc khách đang lái xe/không thể xem ngay — không có cơ chế "nhắc lại" nếu khách chưa mở app xem.
- Chat: gửi ảnh lớn trên mạng di động yếu, không có preview nén ảnh trước khi gửi.

### 12. Tester Checklist
☐ Nhận push nhắc lịch đúng 3 mốc: 30 phút/1 giờ/1 ngày
☐ Nhận push khi cơ sở xác nhận/từ chối/đổi lịch
☐ Tắt từng loại thông báo riêng lẻ, kiểm tra không còn nhận loại đã tắt
☐ Tắt toàn bộ thông báo, kiểm tra hành vi hệ thống với đề xuất đổi lịch từ cơ sở
☐ Gửi/nhận tin nhắn text + ảnh trong chat
☐ Trạng thái Đã gửi/Đã đọc cập nhật đúng
☐ Nhận push khi có tin nhắn mới
☐ Mất kết nối realtime giữa lúc chat, kiểm tra auto-reconnect và tin nhắn không bị mất
☐ Gọi API đọc cuộc trò chuyện của người khác (kỳ vọng bị chặn)

### 13. Giảng viên có thể hỏi gì?
- Vì sao Admin không có quyền xem nội dung chat giữa khách và cơ sở? Nếu có tranh chấp/lừa đảo qua chat, ai xử lý và bằng cách nào?
- "Đề xuất lịch mới" qua chat có liên kết với dữ liệu Booking không, hay chỉ là tin nhắn tự do?
- Hệ thống chống spam/nội dung không phù hợp trong chat bằng cơ chế nào?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟡 Medium (riêng thiếu kiểm duyệt/giám sát chat là 🟠 High về mặt rủi ro lừa đảo/lạm dụng).

---

## MODULE 9: Yêu thích & Chia sẻ (Favorites & Share)
**UR liên quan**: UR-C-080 → UR-C-081
**Phạm vi theo URD**: Lưu cơ sở yêu thích + thông báo khuyến mãi từ cơ sở yêu thích; chia sẻ cơ sở/dịch vụ qua Link/Zalo/Facebook/Messenger + deep link.

### 1. Business cases
- Khách bấm "Yêu thích" trên trang cơ sở, xem danh sách yêu thích trong profile, nhận thông báo khi cơ sở yêu thích có khuyến mãi mới (UR-C-080).
- Khách chia sẻ cơ sở/dịch vụ qua Link/Zalo/Facebook/Messenger; người nhận bấm deep link mở đúng app tới đúng trang (UR-C-081).

### 2. Edge cases
- Cơ sở đã được yêu thích sau đó bị khóa/xóa khỏi hệ thống — danh sách yêu thích của khách hiển thị "cơ sở không xác định" ra sao?
- Deep link được chia sẻ ra ngoài rồi cơ sở/dịch vụ đó bị gỡ trước khi người nhận bấm vào link — cần trang lỗi/fallback thân thiện thay vì crash hoặc màn trắng.
- Người nhận link chia sẻ **chưa cài app** — deep link có fallback mở App Store/Play Store hay trang web giới thiệu không (Universal Link/App Link)? URD không đề cập.
- Khách bấm "Yêu thích" liên tục nhanh (double-tap) — có gây tạo/xóa lặp bản ghi yêu thích không đồng bộ với UI (trạng thái tim hiển thị sai so với dữ liệu thật)?
- Danh sách yêu thích quá dài — phân trang?

### 3. Exception cases
- Chia sẻ qua Zalo/Facebook/Messenger thất bại (app đích chưa cài, quyền chia sẻ bị chặn bởi OS).
- API lấy danh sách yêu thích lỗi.

### 4. Validation cases còn thiếu
- Không có input nhập liệu đáng kể; cần validate `business_id` hợp lệ khi thêm yêu thích (chặn thêm cơ sở không tồn tại qua gọi API trực tiếp).

### 5. Business Rule còn thiếu
- Giới hạn số lượng cơ sở được yêu thích tối đa (không giới hạn)? *Thiếu đặc tả — không nghiêm trọng nhưng nên có để tránh lạm dụng.*
- Thông báo khuyến mãi từ cơ sở yêu thích (UR-C-080③) có tính vào cùng nhóm cấu hình on/off thông báo khuyến mãi chung (UR-C-070③) không, hay là 1 loại riêng? *Thiếu đặc tả.*

### 6. Permission Cases
- Khách A xóa/thêm mục yêu thích của khách B qua gọi API trực tiếp với `user_id`/`favorite_id` không thuộc về mình.

### 7. Concurrency Cases
- Khách bấm Yêu thích/Bỏ yêu thích rất nhanh liên tiếp (đã nêu ở Edge case) — nguy cơ race condition ghi/xóa bản ghi FAVORITE không đúng thứ tự.

### 8. Data Integrity
- FAVORITE không có attribute nào được định nghĩa (→ 0.4.B) — chỉ biết quan hệ USER 1-N FAVORITE từ §6.3, không rõ có `created_at` để sắp xếp danh sách theo thời gian yêu thích gần nhất không.

### 9. Security Risks
- IDOR trên hành động thêm/xóa yêu thích (đã nêu ở Permission).
- Deep link không kiểm tra tính hợp lệ của tham số (business_id/service_id) có thể bị lợi dụng để dẫn dụ (nhúng link giả trông giống link chia sẻ hợp lệ).

### 10. Performance Risks
- Không đáng kể — module có tải thấp nhất trong toàn hệ thống.

### 11. UI/UX Traps
- Icon tim (yêu thích) đổi trạng thái ngay trên UI trước khi API xác nhận thành công (optimistic update) — nếu API lỗi mà không rollback UI, trạng thái tim sai lệch với dữ liệu thật.

### 12. Tester Checklist
☐ Thêm/xóa yêu thích, kiểm tra đồng bộ đúng giữa UI và dữ liệu
☐ Danh sách yêu thích hiển thị đúng, sắp xếp hợp lý
☐ Nhận thông báo khi cơ sở yêu thích có khuyến mãi
☐ Yêu thích cơ sở sau đó cơ sở bị khóa — kiểm tra hiển thị trong danh sách
☐ Chia sẻ qua từng kênh: Link/Zalo/Facebook/Messenger
☐ Bấm deep link khi đã cài app / chưa cài app
☐ Bấm deep link tới cơ sở/dịch vụ đã bị xóa
☐ Double-tap nút yêu thích liên tục

### 13. Giảng viên có thể hỏi gì?
- Deep link xử lý ra sao khi người nhận chưa cài đặt app?
- Nếu cơ sở bị khóa sau khi được yêu thích, khách còn nhận thông báo khuyến mãi từ cơ sở đó không?

### 14. Mức độ nghiêm trọng tổng thể của module: 🟢 Low — module phụ trợ, rủi ro thấp nhất trong 9 module Mobile App.
