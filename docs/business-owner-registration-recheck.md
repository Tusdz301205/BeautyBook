# BeautyBook — kiểm tra lại đăng ký chủ doanh nghiệp

Ngày kiểm tra: 03/10/2026. Phạm vi: web đăng ký Customer/Business Owner, hồ sơ onboarding, upload pháp lý và thông tin phục vụ xét duyệt.

## Kết luận

Báo cáo trước phản ánh các sửa đổi có trong code nhưng mới kiểm chứng trình duyệt bằng API giả lập. Sau khi đối chiếu lại và bổ sung các sửa đổi bên dưới, luồng chính đã đạt kiểm tra bằng API thật và PostgreSQL local cô lập. Chưa tuyên bố hoàn thành OTP điện thoại, giao email thật hoặc kiểm tra production.

## Lỗi phát hiện và đã sửa thêm

| Vấn đề | Kết quả sau sửa | Bằng chứng |
| --- | --- | --- |
| Bước đã hoàn thành vẫn giữ tick khi xóa dữ liệu bắt buộc | Tiến độ và completedSteps tính lại theo dữ liệu hợp lệ; loại cả các bước phụ thuộc | Unit + browser: xóa tên làm tiến độ 75% về 25%, không gửi |
| Bấm tiếp tục trong lúc autosave có thể bị bỏ qua | Chờ save đang chạy và khóa thao tác trùng | Test luồng API thật và lưu nhiều bước |
| Upload tài liệu rồi xóa tên làm tài liệu biến mất khỏi payload | Chặn lưu/gửi, báo tại trường tên tài liệu | Browser: không có request save hoặc submit |
| Ngày 30/02 được JavaScript tự chuyển tháng | Kiểm tra ngày lịch đúng ở cả client/server | Unit: 30/02 bị từ chối, 29/02 năm nhuận được nhận |
| Kiểu dữ liệu giấy tờ sai có thể tạo TypeError | Kiểm tra object/string trước xử lý, trả validation 400 | Jest cho null, array, số/object thay chuỗi |
| Recovery dùng chung giữa tài khoản, chứa các thông tin liên hệ | Khóa riêng tài khoản, whitelist chỉ thương hiệu/slug/mô tả; loại khóa cũ | Browser: dữ liệu tài khoản khác không hydrate |
| Lỗi localStorage làm save thành công bị coi là thất bại | Storage không quyết định kết quả server | Browser ép removeItem ném lỗi, submit vẫn hoàn tất |
| Submit thành công nhưng GET trạng thái lỗi vẫn còn nút gửi | Khóa form, cho tải lại trạng thái | Browser: đúng một submit, GET retry thấy APPROVED |
| REJECTED/APPROVED bị mô tả như đang chờ duyệt | Hiển thị đúng quyết định; approved reload tới profile theo route hiện tại | Browser giả lập và API thật |
| Quản trị thiếu loại hình/pháp nhân; tên giấy tờ hiển thị chung | Catalog backend cung cấp nhãn cho detail/queue; bổ sung pháp nhân, mã số thuế, liên hệ và nhãn enum giấy tờ | API thật + ảnh quản trị 375/1440 |
| Lỗi mạng đăng ký hiển thị thông báo kỹ thuật | Thông báo tiếng Việt; lỗi DTO nhận diện được gắn tại trường | Code + test validation/duplicate |

## Kết quả chạy

| Kiểm tra | Kết quả |
| --- | --- |
| API typecheck/build | Đạt |
| Jest onboarding + DTO đăng ký + auth service | 22/22 đạt |
| Frontend unit | 68/68 đạt |
| Frontend build `node scripts/build-vite.mjs` | Đạt |
| Playwright Chromium giả lập lỗi | 14/14 đạt |
| Playwright toàn luồng API/PostgreSQL thật | 1/1 đạt |
| Đăng ký responsive | 320, 375, 768, 1024, 1440 px: hai lựa chọn cạnh nhau, không tràn ngang |
| Onboarding responsive | 375, 768, 1024, 1440 px: không tràn ngang |
| Hồ sơ quản trị responsive | 375, 1440 px: không tràn ngang |

Test thực tế tạo Business Owner từ form → role BUSINESS_OWNER, business DRAFT, không có chi nhánh. Tên draft nội bộ và thiếu giấy tờ bị chặn. Hai PDF được upload qua endpoint thật, lưu PRIVATE; chủ hồ sơ đọc được, endpoint public trả 404, tài khoản khác trả 403. Refresh cookie đọc lại đúng dữ liệu đã lưu. Hồ sơ đi qua PENDING_REVIEW → NEED_MORE_INFO → RESUBMIT → PENDING_REVIEW → APPROVED. Hai endpoint quản trị detail/queue và giao diện dùng cùng nhãn Spa. Khi duyệt xong, vẫn 0 chi nhánh. Đăng ký Customer không sinh business owner profile. Email/điện thoại trùng bị database từ chối. Không có `pageerror` trên trang chủ hồ sơ trong test thật.

Các lần chạy thử ban đầu có lỗi selector select của test, kỳ vọng HTTP login sai và kỳ vọng route approved sai. Đã đối chiếu component/API/route và sửa test theo contract thực tế; không đổi API hoặc router để làm test qua. Lỗi autosave bị bỏ qua thao tác đã được sửa tại component.

## Môi trường và dữ liệu

- Demo test: `http://localhost:5175`; API: `http://localhost:3011/api/v1`.
- Database: `beautybook_test_onboarding_1790998391380`; chỉ sao chép schema public và catalog role từ database local. Các tài khoản, giấy tờ và reviewer trong test dùng dữ liệu tổng hợp `example.test`.
- Không reset, seed lại, drop hoặc ghi các tài khoản thử vào database chính. Đối chiếu read-only trước/sau: 1.075 user, 4.016 lịch hẹn không đổi.
- SMTP tắt rõ ràng trong fixture; Redis không cấu hình, dùng cơ chế dev trong một process. Đây không phải kiểm chứng email hoặc hệ thống nhiều instance.
- Database/file upload thử được giữ lại để kiểm chứng; không drop dữ liệu trong quá trình kết thúc QA.

## Tệp kiểm chứng

Trong `report-output/business-owner-registration/` tại root repo:

- `real-api-results.json`: trạng thái APPROVED, business ID thử, 2 private documents, 0 branches và danh sách kiểm tra thực tế.
- `local-fixture.json`: tên DB riêng, địa chỉ demo/API, SMTP tắt và số lượng dữ liệu gốc.
- `source-database-check.json`: kiểm tra read-only số lượng user/lịch hẹn gốc.
- `register-choices-{320,375,768,1024,1440}.png`: lựa chọn loại tài khoản.
- `register-owner-mobile.png`: form chủ doanh nghiệp với dữ liệu tổng hợp.
- `onboarding-review-{375,768,1024,1440}.png`: màn hình xem lại trước gửi.
- `admin-registration-{375,1440}.png`: thông tin phục vụ xét duyệt.
- `onboarding-approved-{mobile,desktop}.png`: profile sau phê duyệt, chưa có chi nhánh.

## Chạy lại

Tại thư mục API: build rồi chạy `node scripts/onboarding-review-server.mjs`. Script tạo một database test mới mỗi lần, kiểm tra localhost, không ghi đè hoặc drop database có sẵn. PostgreSQL CLI mặc định ở `C:/Program Files/PostgreSQL/18/bin`; có thể đặt `BEAUTYBOOK_PG_BIN` nếu máy dùng vị trí khác.

Tại frontend: `node scripts/onboarding-review-web.mjs`. Sau đó, trong PowerShell:

```powershell
$env:PW_NO_WEB_SERVER='1'
$env:PW_BASE_URL='http://localhost:5175'
$env:PW_REAL_ONBOARDING='1'
npx playwright test tests/e2e/auth/register-account-type.spec.js tests/e2e/auth/business-onboarding-submit.spec.js tests/e2e/auth/business-onboarding-failures.spec.js tests/e2e/auth/business-onboarding-real.spec.js --project=chromium
```

Test thật mặc định skip nếu không có opt-in và fixture local; không chạy nó đối với API production. Test giả lập có thể chạy riêng trên demo frontend đang có.

## Giới hạn còn lại

- Chưa có UI/nhà cung cấp OTP điện thoại. Khi policy bật, tài khoản chưa xác minh bị chặn; người dùng chưa có cách tự hoàn tất OTP trong sản phẩm. Không tắt policy để lách yêu cầu.
- Chưa gửi email thật, kiểm tra inbox hoặc link xác minh qua SMTP; chưa kiểm thử production.
- Tài liệu gốc đọc được của lượt sửa trước chỉ là `.txt`; chưa có Word/ảnh gốc để đối chiếu thêm. Ảnh QA mới và dữ liệu tổng hợp không thay thế tài liệu pháp lý.
- Chưa có policy định dạng pháp lý chính thức của mã số thuế/định danh, nên vẫn áp các giới hạn của contract hiện có; không tự đặt regex pháp lý.

Để thêm loại hình dịch vụ, cập nhật `BUSINESS_TYPE_CATALOG` trong service backend. Config owner và nhãn quản trị cùng đọc catalog đó. Một hồ sơ chọn một mã. Mã lạ/inactive bị server từ chối.
