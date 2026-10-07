# BeautyBook — kiểm tra 9 yêu cầu mobile/web

Cập nhật: 06/10/2026. Yêu cầu: attachment `0d2ae425-846a-49c0-8d8d-5f84d197f582/Pasted text.txt`. Người dùng yêu cầu tự kiểm thử. `C:/Users/Admin/Desktop/Requirement.txt` là câu hỏi walk-in; không dùng để đổi chính sách đặt sát giờ hoặc thanh toán.

## Kết quả theo yêu cầu

| Mục | Thay đổi và kết quả kiểm tra | Giới hạn |
| --- | --- | --- |
| 1. Đăng nhập | Bỏ workspace CUSTOMER mặc định và lựa chọn vai trò trước đăng nhập. Chỉ hiện lựa chọn nghiệp vụ khi backend trả WORKSPACE_REQUIRED/BUSINESS_REQUIRED. Sửa câu thông báo backend; giữ RBAC. Auth fixture kiểm tra sai mật khẩu, challenge, giữ dữ liệu, điều hướng và restore đạt; backend 22 test đạt. | Chưa acceptance Android đăng nhập/restore cho từng vai trò. API QA chưa restart để nhận câu thông báo mới. |
| 2. Bộ lọc | Bổ sung danh mục canonical, đánh giá tối thiểu, giá giảm dần; query/khu vực/giá/sort/page gửi server. Xóa lọc xóa khu vực. Browser 360/390/430 đạt. | QA catalog nhỏ; chưa test trên 50 kết quả thật. Không có sắp xếp khoảng cách giả. |
| 3. Dịch vụ chi nhánh | Giữ danh mục, tên đầy đủ, giá/thời lượng, lưu và chọn riêng; không tự chọn dịch vụ đầu. Browser 3 kích thước đạt. Android chọn Cắt tóc QA, đổi Info → Services vẫn Đã chọn và Đặt lịch (1); tên dài xuống dòng. | Chưa đo đủ mọi kích thước trên Android; bộ 3 viewport là Expo Web. |
| 4. Tab Thông tin | Bỏ native Google map không có API key, dùng handoff ngoài; mapping null/TIME an toàn, nội dung chính không chờ optional API, fence request cũ. Android Info hiện địa chỉ, giờ 08:00–20:00, điện thoại; mở Maps với đúng URI địa chỉ QA; quay lại Home hoạt động. | Không đủ log để kết luận nguyên nhân crash lịch sử của người dùng. Không báo tìm kiếm địa chỉ QA trên Maps có kết quả thực. |
| 5. Card cơ sở Home | Định danh branchId vốn đúng; ưu tiên tên chi nhánh, xử lý null/error chung và đường quay lại/tìm khác. Android Home → Chi nhánh QA 0 → Info/Services đạt; browser 3 viewport đạt. | Không acceptance mọi trường hợp 404/mất mạng trên Android. |
| 6. Trạng thái lịch | Phân biệt CONFIRMED/CHECKED_IN/IN_PROGRESS; giữ lịch đang làm trong Sắp tới dù qua giờ dự kiến. Unit 9 trạng thái đạt; fixture IN_PROGRESS quá giờ vẫn Sắp tới. | Không thêm trạng thái hoặc timeline giả. |
| 7. Đặt lại | Lịch kết thúc mở chi nhánh hiện tại với serviceIds; dịch vụ ngừng có cảnh báo; lấy giá hiện tại, chọn staff/slot mới qua pipeline thông thường. Thêm accessibility cho nút Xem lại đặt lịch. Đã chạy thật đến confirm trên Expo Web/API QA: đúng một POST201 tạo BB-2026-0100097, PENDING ONLINE_APP, 09/10/2026 08:00 VN, 200.000đ. 5 kiểm tra DB read-only đạt; hash lịch cũ không đổi. | Không chạy confirm native Android lần nữa để tránh tạo lịch thừa. Service/branch ngừng hoạt động/no-slot chưa đủ acceptance thiết bị. |
| 8. Chuông web | Hook chung một poll 60s/shell, focus/visibility/route/read/readall refresh, user và sequence fences. Customer/Owner/Admin fixture: 2→1→0, focus nhận mới, mở danh sách không tự đọc; 2 hook test đạt. | Không ghi/read thông báo QA thật; badge owner thật được quan sát đọc-only. |
| 9. Lịch trắng | Không tái hiện, không sửa scheduler hoặc thêm timeout/remount. Fixture SPA/direct URL/Ngày/Tuần/Tháng/375/1440 đạt. Owner thật: vào từ menu, đổi mode/resize, mở URL trực tiếp đều đạt trong lượt kiểm tra lại. | Lượt trước có HTTP429 được ghi trong lịch sử báo cáo; không xem là lỗi render. Không chỉnh throttler. |

## Kiểm thử và build

- Mobile typecheck đạt; toàn bộ unit trước bước accessibility: **145/145**. Sau sửa accessibility, typecheck và scoped requirement/booking-feedback: **23/23** đạt.
- Android Hermes export: **1066 modules** đạt trước bước accessibility. Bundle Android dev thực sự phục vụ từ Metro QA; Expo Go tải và chạy được Home/Info/Services. Đây không phải kết quả build APK mới.
- Web: **84/84 unit**, build **3293 modules** đạt. Role UX smoke sẵn có 29 kiểm tra đạt bằng fixture.
- Backend: typecheck/build đạt; auth Jest **3 suites, 22/22** đạt. Không restart API.
- Expo Web 360/390/430: không pageerror, không tràn ngang; auth/restore/status/rebook fixture 4 kiểm tra đạt. Rebook live 2 kiểm tra, DB readback 5 kiểm tra đạt.
- Web Owner thật: **3 nhóm kiểm tra đạt**, errors rỗng; không còn block direct URL trong lượt mới.
- Android Expo Go: Home mở branch đúng, Info đọc dữ liệu thật, Services chọn/giữ state, handoff Maps URI đúng và quay về Home. PNG đã mở xem trực tiếp. Không ghi nghiệp vụ trong Android.

## Lịch được tạo trong QA

Chỉ **một** lịch mới `dcbfe107-78ac-4663-a9d2-2ed7c3c76d20` / **BB-2026-0100097**. Slot `2026-10-09T01:00:00Z`, 08:00 Việt Nam; đúng customer/branch/service, giá và thời lượng hiện tại, staff đã gán. Không thu tiền, không hoàn tiền hoặc thay đổi lịch cũ.

Lịch cũ `4a51db68-df45-41d1-b11c-aec7c8fbb505` / BB-2026-0100095 có booking/items hash trước và sau giống nhau: `33d9aecf467bc1ae73557bc4ee72882551bd0734adfdb0b308ad069c3c40cf6e`. Readback dùng DATE/TIME dạng text để tránh lệch timezone của node-pg. Runner có write gate và committed record: **không chạy lại script tạo lịch**. Chỉ script readback được phép lặp.

## Môi trường và giới hạn

Web `http://127.0.0.1:5176`; Expo Web `http://localhost:8086`; QA API3012. Browser runner bridge request thật đến API test và thêm CORS credentials do origin Expo Web chưa nằm trong allowlist; không chứng minh CORS production hoặc điện thoại thật.

Emulator Pixel_7a `emulator-5556` chạy read-only/no-snapshot, không wipe/reset/seed/migrate. Giữ Metro8081 và API đang có; khởi chạy Metro QA riêng. Android chạy trong **host.exp.exponent (Expo Go)** với bundle dùng `http://10.0.2.2:3012/api/v1`. APK **com.beautybook.mobile** cài sẵn báo Unable to load script: chưa acceptance được APK này. System UI ANR khi khởi động emulator được xử lý bằng Wait; crash buffer có Chrome SIGILL từ trước các ca kiểm tra, không gán cho BeautyBook. Google Maps handoff kiểm chứng bằng Activity intent; XML thất bại trong lúc chuyển activity không dùng làm assertion.

Giữ mọi thay đổi docs và staff/owner có trước task. Không push, không reset/drop DB, không đổi thanh toán/RBAC/chính sách booking. Cảnh báo build SEO có sẵn: domain production chưa cấu hình; không tự bịa domain.

## Source và bằng chứng

Source chính: mobile auth/Login/Search/VenueDetail/AppointmentDetail/LichHen/BookingScreen/HomeStack/useBranchDetail/useCatalog/catalog mapper/VenueMap/AppointmentCard/status; web useUnreadNotifications/AppShell/CustomerShell/apiClient; backend auth-workspace (câu thông báo).

Runner: mobile `tests/requirement-regression.test.cjs`, `requirement-browser.mjs`, `requirement-auth-rebook.mjs`, `requirement-rebook-live.mjs`, `requirement-rebook-readback.mjs`; web hook regression và `tests/e2e/requirement-web*.mjs`.

Evidence dưới `C:/Users/Admin/Downloads/beauty-booking-api-main/report-output/requirement-mobile-web/` (ignore, không commit artifact tạm):

- `mobile/results.json`, `mobile/auth-rebook-results.json`: responsive và auth fixture.
- `mobile/rebook-live-results.json`, `mobile/rebook-live-readback.json`, `mobile/rebook-live-committed.json`: đúng một lịch mới và DB invariant.
- `mobile/rebook-live-review-390.png`, `mobile/rebook-live-success-390.png`: review/kết quả thật, tên staff đầy đủ.
- `web/results.json`, `web/live-results.json`: fixture và lượt QA mới 3 nhóm PASS. Log selector cũ giữ riêng; 429 trước đó được mô tả ở đây, không trình bày file hiện tại là có 429.
- `native-home.png`, `native-branch.png`, `native-services-selected.png` + XML tương ứng: actual Android. `native-map-return.png/xml` là Home sau quay lại.
- `native-main.png/xml`: lỗi tải script của APK cài sẵn.
- `native-acceptance.json`, `validation.json`: tổng hợp phạm vi, provenance và giới hạn.

## Chưa kiểm chứng đầy đủ

1. APK chính cài sẵn/production: cần build tương thích và xác nhận endpoint trước acceptance; Expo Go Android đã chạy các ca công khai nêu trên.
2. Android staff/owner login/restore cho từng workspace.
3. Catalog trên 50 kết quả, branch/service ngừng hoạt động/no-slot, toàn bộ mất mạng/404 trên thiết bị.
4. Không tuyên bố mọi vai trò và mọi trường hợp lỗi đã acceptance chỉ từ unit hoặc fixture.
