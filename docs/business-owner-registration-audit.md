# BeautyBook: đăng ký chủ doanh nghiệp

Ghi nhận hợp đồng và kết quả sửa luồng đăng ký chủ doanh nghiệp. Thông tin cá nhân trong ảnh kiểm thử không được sao chép vào mã, test hay tài liệu này.

Tệp đính kèm đọc được trong lượt này chỉ có nội dung yêu cầu dạng `.txt`; không có file Word/ảnh tham chiếu tại thư mục đính kèm. Đối chiếu vì vậy dựa trên yêu cầu, mã nguồn và ảnh QA đã lưu sẵn trong project.

## Trải nghiệm đăng ký tài khoản

`/register` và `/register/business` cùng dùng `RegisterScreen`. Hai lựa chọn Khách hàng/Chủ doanh nghiệp nằm cạnh nhau; route thứ hai mở sẵn lựa chọn Chủ doanh nghiệp. Đổi lựa chọn cập nhật nội dung và `accountType` gửi API, đồng thời giữ nguyên các trường đã nhập. CTA chọn chủ doanh nghiệp trùng bên dưới form đã được bỏ.

| Trường | Bắt buộc | Quy tắc giao diện và backend | Chuẩn hóa / lỗi |
| --- | --- | --- | --- |
| Loại tài khoản | Có trên giao diện; API mặc định `CUSTOMER` nếu bỏ trống | Chỉ `CUSTOMER` hoặc `BUSINESS_OWNER` | Gửi enum đã chọn; lựa chọn nằm trong form trước khi submit |
| Họ và tên | Có | 2–100 ký tự sau trim | Backend trim; lỗi tại trường |
| Email | Có | Email hợp lệ, tối đa 254 ký tự; duy nhất | Trim, lowercase; email trùng được báo tại trường |
| Điện thoại | Không | Nếu nhập: số Việt Nam 10 chữ số dạng `0…` hoặc `+84…` | Bỏ khoảng trắng, ngoặc, dấu chấm/gạch nối; backend lưu dạng `+84…`; số trùng được báo tại trường |
| Mật khẩu | Có | 8–128 ký tự, có chữ thường, chữ hoa và số; không bắt buộc ký hiệu đặc biệt | Chỉ gửi trong request đăng ký; không lưu vào recovery của onboarding |
| Nhập lại mật khẩu | Có trên giao diện | Phải khớp mật khẩu | Chỉ kiểm tra trên giao diện, không gửi như trường API |
| Đồng ý điều khoản | Có trên giao diện | Phải được chọn | Điều kiện trước khi gửi; không gửi nội dung checkbox lên API |

## Hồ sơ doanh nghiệp và giấy tờ

Onboarding dùng một lựa chọn nhóm dịch vụ (`onboardingData.businessType` là một chuỗi đơn), không phải danh sách nhiều nhóm. Schema hiện tại lưu lựa chọn trong JSON của hồ sơ; danh sách được tập trung ở `BUSINESS_TYPE_CATALOG` trong `business-onboarding.service.ts`. API config trả các mục đang hoạt động cho giao diện; server vẫn từ chối mã lạ hoặc đã ngừng hoạt động. Để thêm nhóm mới, thêm `{ code, label, active: true }` vào catalog, rồi bổ sung test tương ứng. Để ngừng một nhóm, đặt `active: false`; hồ sơ đang lưu mã cũ sẽ phải chọn mã đang hoạt động trước khi gửi lại. Không cần sửa migration cho thay đổi catalog này.

| Trường | Bắt buộc | Quy tắc và xác thực |
| --- | --- | --- |
| Loại hình dịch vụ | Có trước khi gửi | Một mã trong catalog hoạt động; không phải loại hình pháp nhân |
| Tên thương hiệu | Có trước khi gửi | 2–150 ký tự; tên nội bộ tạo tự động `Hồ sơ cơ sở của …` không được xem là tên người dùng nhập |
| Đường dẫn BeautyBook (slug) | Có khi tạo draft | Tối đa 70 ký tự; chữ Latin thường, số và dấu gạch nối; không trùng. Giao diện tự gợi ý theo tên và cho sửa |
| Tên pháp nhân | Có trước khi gửi | 2–255 ký tự; không áp quy tắc pháp lý tự suy đoán |
| Mã số thuế | Có trước khi gửi | 1–100 ký tự và duy nhất; không áp regex/độ dài pháp lý chưa có trong policy |
| Số CCCD người đại diện | Không | Tối đa 100 ký tự; không áp quy tắc pháp lý tự suy đoán |
| Email liên hệ | Có trước khi gửi | Email hợp lệ, tối đa 254 ký tự; trim và lowercase |
| Điện thoại liên hệ | Có trước khi gửi | Số Việt Nam 10 chữ số dạng `0…`/`+84…`; chuẩn hóa về `+84…` |
| Địa chỉ đăng ký | Có trước khi gửi | 1–500 ký tự sau trim |
| Người đại diện | Có trước khi gửi | 2–150 ký tự sau trim |
| Giới thiệu doanh nghiệp | Không | Tối đa 2.000 ký tự |
| Loại tài liệu | Có với mỗi mục đã tải | `BUSINESS_LICENSE`, `OWNER_ID_CARD`, `TAX_DOCUMENT`, `OTHER`; mỗi loại khác `OTHER` chỉ có một mục đang hiệu lực |
| Tên tài liệu | Có khi thêm tài liệu | Tối đa 255 ký tự |
| Số tài liệu | Không | Tối đa 100 ký tự |
| Ngày hết hạn | Không | Ngày hợp lệ; giao diện dùng input date, server kiểm tra ngày |
| Ghi chú tài liệu | Không | Tối đa 1.000 ký tự nếu được gửi |
| File và media ID | Có để tài liệu được tính là đã tải | Chỉ PDF; từ 1 byte đến 10 MiB; phải tải xong, gắn media riêng tư thuộc đúng hồ sơ. URL được tạo từ media đã tải, không nhập tay |

Các tài liệu bắt buộc theo cài đặt nền tảng: khi `requireIdVerification` bật, cần giấy phép kinh doanh và giấy tờ người đại diện; khi tắt, không ép hai loại này. Lỗi thiếu giấy tờ được kiểm tra trước khi submit. Dữ liệu liên hệ, tên pháp nhân, mã số thuế và số định danh đi vào đúng trường riêng, không gán chéo.

## Nguyên nhân và thay đổi luồng gửi

Khi tạo tài khoản chủ doanh nghiệp, `AuthService.register` sinh draft `DRAFT` với tên nội bộ và slug `draft-*`. Bản cũ đưa tên nội bộ vào ô tên thương hiệu rồi coi trường này là đủ; lúc submit backend từ chối `name`, còn giao diện hiển thị lỗi kỹ thuật. Ngoài ra, nếu lần lưu mới thất bại, giao diện có thể dùng ID cũ để tiếp tục submit.

Giờ giao diện loại tên/slug nội bộ khỏi thông tin thương hiệu, yêu cầu nhập tên trước khi gửi, chuẩn hóa và kiểm tra từng bước. Nếu upload chưa xong hoặc lưu lỗi thì không chuyển bước/không gửi; submit chỉ dùng ID từ response lưu thành công. Nút gửi có khóa chống nhấn lặp. Sau khi server nhận hồ sơ, giao diện GET lại hồ sơ và hiển thị trạng thái backend. Draft vẫn là `DRAFT`; gửi duyệt dùng trạng thái xét duyệt hiện có, không tự tạo chi nhánh, công khai cơ sở hoặc bật nhận lịch.

Recovery của biểu mẫu chỉ giữ tên thương hiệu, slug, mô tả và lựa chọn loại hình dưới khóa riêng cho từng tài khoản. Không lưu các trường liên hệ, người đại diện, địa chỉ, mã số thuế, số định danh hoặc mật khẩu. Khóa recovery cũ dùng chung được loại bỏ; không nhập dữ liệu của tài khoản khác vào hồ sơ mới. Storage bị chặn không làm thao tác lưu thành công trở thành lỗi. Lỗi API nội bộ không được đưa nguyên văn ra giao diện; lỗi trùng email/điện thoại, slug/mã số thuế và lỗi tên được chuyển thành hướng dẫn tiếng Việt.

## Kiểm tra và giới hạn xác minh

- Đối chiếu lại ngày 03/10/2026: các test cũ đều qua nhưng chưa phủ đầy đủ các lỗi tiến độ, recovery, tài liệu và autosave. Xem [báo cáo kiểm tra lại](business-owner-registration-recheck.md).
- API: `npm run typecheck`, `npm run build`, **22/22 Jest test** qua ở `business-onboarding.service.spec.ts`, `auth/dto/auth.dto.spec.ts` và `auth.service.spec.ts`.
- Frontend: `npm test` (**68/68**), `node scripts/build-vite.mjs` đạt. **14/14 Playwright Chromium test** dùng API giả lập, gồm lỗi lưu/submit, lỗi tải trạng thái sau submit, dữ liệu khôi phục của tài khoản khác, storage bị chặn, tên nội bộ, tiến độ và OTP policy. Responsive đăng ký: 320/375/768/1024/1440 px.
- **1/1 test toàn luồng bằng API thật + PostgreSQL riêng** đạt: đăng ký chủ doanh nghiệp, lưu, upload hai PDF riêng tư, đọc lại hồ sơ sau refresh cookie, gửi duyệt, quản trị yêu cầu bổ sung, gửi lại và phê duyệt. Kiểm tra thêm tài khoản khác không được sửa/đọc giấy tờ, email/điện thoại trùng bị từ chối, đăng ký Customer vẫn hoạt động. Hồ sơ duyệt vẫn có 0 chi nhánh. Responsive màn hình xem lại: 375/768/1024/1440 px; hồ sơ phía quản trị: 375/1440 px.
- Database test `beautybook_test_onboarding_1790998391380` được tạo mới bằng cách sao chép cấu trúc public và catalog role, không sao chép dữ liệu người dùng. Không reset/seed/migrate/drop database chính. Số user/lịch hẹn chính trước và sau vẫn là 1.075/4.016. SMTP tắt; chưa kiểm chứng giao email thật hoặc cấu hình production.
- Backend có policy `requirePhoneVerification`; API config trả trạng thái xác minh của tài khoản và giao diện chặn gửi nếu policy bật nhưng tài khoản chưa xác minh. Repository hiện không có luồng giao diện gửi/nhập OTP cho số điện thoại, nên người dùng chưa thể tự hoàn tất yêu cầu đó trong sản phẩm; cần bổ sung luồng xác minh trước khi bật policy này.
- Ràng buộc pháp lý chính thức về mã số thuế và số định danh không có trong contract/policy đã kiểm tra. Hiện chỉ áp độ dài và điều kiện bắt buộc nêu trên; không suy đoán định dạng.

## Điều chỉnh bổ sung sau kiểm tra lại

- Tiến độ hiển thị và payload lưu chỉ giữ những bước đã được xác nhận và còn hợp lệ, đồng thời loại các bước phụ thuộc khi thông tin trước đó mất hiệu lực. Checklist backend không xem tên draft nội bộ hay tài liệu chưa có media version là hoàn tất.
- Nút tiếp tục chờ autosave đang chạy, có khóa chống chuyển bước/gửi trùng. Sau khi submit đã thành công nhưng GET trạng thái lỗi, form chuyển sang màn hình chờ tải trạng thái và khóa việc gửi lại.
- Tài liệu đã bắt đầu nhập phải có tên và media ID; ngày hết hạn phải là ngày thực tế, không tự chuyển 30/02 thành tháng 03. Backend trả lỗi 400 cho kiểu dữ liệu tài liệu sai thay vì phát sinh TypeError/500.
- Màn hình xem lại hiển thị loại hình, pháp nhân, liên hệ, địa chỉ và người đại diện. Hàng đợi xét duyệt và trang chi tiết quản trị dùng nhãn loại hình từ cùng catalog backend; nhãn giấy phép/CCCD/tài liệu thuế khớp enum thực tế.
- Approved/Rejected hiển thị đúng quyết định. Khi tải lại hồ sơ đã approved, route hiện có chuyển tới `/salon/profile`; việc duyệt doanh nghiệp vẫn không tạo chi nhánh hoặc bật nhận lịch.
