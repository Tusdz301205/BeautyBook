# Đặc tả Use Case hệ thống

Mức kiểm chứng: đọc code của working tree; không chạy nghiệp vụ hoặc truy vấn DB. Association trên hình chỉ là tham gia; các hành động trong cùng UC có thể có quyền khác nhau.

## SUC-01 — Tra cứu dịch vụ và cơ sở

- Mục tiêu: Tra cứu dịch vụ và cơ sở, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-01.
- Actor tham gia: Người chưa đăng nhập (PUBLIC); Khách hàng (CUSTOMER); Chủ doanh nghiệp (BUSINESS_OWNER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu tra cứu dịch vụ và cơ sở.
- Tiền điều kiện: Hành động Public không cần phiên; hành động protected trong UC vẫn cần phiên tương ứng. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Actor chọn phương án; thông tin dùng cho bước đặt lịch sau đăng nhập.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Actor nhập tiêu chí tìm kiếm; hệ thống lọc các mục đủ điều kiện công khai.
2. Actor mở chi tiết; hệ thống trả dịch vụ, nhân sự và đánh giá công khai.
3. Actor chọn phương án; thông tin dùng cho bước đặt lịch sau đăng nhập.

### Thay thế và ngoại lệ

- 1a. Không có kết quả: danh sách rỗng.
- 2a. Cơ sở không công khai: không cung cấp như cơ sở đang mở.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: Từ khóa, khu vực, danh mục, giá; ID cơ sở/dịch vụ.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: PUBLIC chỉ nội dung công khai; CUSTOMER theo chính chủ, tài khoản tách vận hành; OWNER theo doanh nghiệp và thao tác được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-10

- ServicesController.search: `@Get('search')`; `@Public()`
- BranchesController.findAll: `@Get()`; `@Public()`
- StaffController.findPublicOne: `@Get('public/:id')`; `@Public()`

### Bằng chứng và mức triển khai

- [ServicesController.search](../../../src/services/services.controller.ts) (dòng 70)
- [BranchesController.findAll](../../../src/branches/branches.controller.ts) (dòng 59)
- [StaffController.findPublicOne](../../../src/staff/staff.controller.ts) (dòng 174)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Public/PublicHome.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Public/PublicHome.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Public/PublicDetails.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Public/PublicDetails.jsx)
- Schema: `Branch`, `BranchServiceOffering`, `StaffProfile`, `Review`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: HomeScreen, SearchScreen, VenueDetailScreen dùng API..
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-02 — Thiết lập tài khoản và đăng nhập

- Mục tiêu: Thiết lập tài khoản và đăng nhập, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-12.
- Actor tham gia: Người chưa đăng nhập (PUBLIC). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu thiết lập tài khoản và đăng nhập.
- Tiền điều kiện: Hành động Public không cần phiên; hành động protected trong UC vẫn cần phiên tương ứng. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống cấp phiên phù hợp; web dùng refresh cookie, mobile có transport BODY.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Người dùng chọn loại tài khoản và cung cấp thông tin; hệ thống kiểm tra dữ liệu/định danh.
2. Người dùng đăng nhập; hệ thống kiểm tra mật khẩu, trạng thái và workspace.
3. Hệ thống cấp phiên phù hợp; web dùng refresh cookie, mobile có transport BODY.

### Thay thế và ngoại lệ

- 1a. Trùng định danh hoặc loại tài khoản không hợp lệ: từ chối.
- 2a. Sai mật khẩu/trạng thái: không cấp phiên.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: Thông tin đăng ký/đăng nhập trong auth.dto.ts; accountType, workspace khi có.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: PUBLIC chỉ nội dung công khai.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-01

- AuthController.register: `@Public()`; `@Post('register')`
- AuthController.login: `@Public()`; `@Post('login')`

### Bằng chứng và mức triển khai

- [AuthController.register](../../../src/auth/auth.controller.ts) (dòng 96)
- [AuthController.login](../../../src/auth/auth.controller.ts) (dòng 71)
- [AuthService.register](../../../src/auth/auth.service.ts) (dòng 141)
- [AuthService.login](../../../src/auth/auth.service.ts) (dòng 44)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Login/RegisterScreen.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Login/RegisterScreen.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Login/LoginScreen.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Login/LoginScreen.jsx)
- Schema: `User`, `CustomerProfile`, `BusinessOwnerProfile`, `UserSession`, `AccountToken`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: AuthContext và Login/RegisterScreen gọi API..
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-03 — Khôi phục và bảo vệ truy cập

- Mục tiêu: Khôi phục và bảo vệ truy cập, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-12.
- Actor tham gia: Người chưa đăng nhập (PUBLIC); Khách hàng (CUSTOMER); Chủ doanh nghiệp (BUSINESS_OWNER); Lễ tân (RECEPTIONIST); Chuyên viên (STAFF); Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu khôi phục và bảo vệ truy cập.
- Tiền điều kiện: Hành động Public không cần phiên; hành động protected trong UC vẫn cần phiên tương ứng. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống cập nhật xác thực, mật khẩu hoặc thu hồi phiên theo hành động.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Actor gửi thông tin khôi phục hoặc quản lý phiên; hệ thống kiểm tra điều kiện của hành động.
2. Actor cung cấp token/mật khẩu hiện tại khi bắt buộc; hệ thống kiểm tra hiệu lực.
3. Hệ thống cập nhật xác thực, mật khẩu hoặc thu hồi phiên theo hành động.

### Thay thế và ngoại lệ

- 2a. Token hết hạn/đã dùng hoặc sai mật khẩu: từ chối.
- 1a. Hành động phiên yêu cầu đăng nhập, khôi phục/verify có route Public.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: Email, token, mật khẩu theo DTO; sessionId chỉ phiên thuộc mình.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: PUBLIC chỉ nội dung công khai; CUSTOMER theo chính chủ, tài khoản tách vận hành; OWNER theo doanh nghiệp và thao tác được cấp; RECEPTIONIST theo chi nhánh và hành động tại quầy; STAFF theo assignment/tài khoản của mình; PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-01

- AuthController.verifyEmail: `@Public()`; `@Post('verify-email')`
- AuthController.forgotPassword: `@Public()`; `@Post('forgot-password')`
- AuthController.resetPassword: `@Public()`; `@Post('reset-password')`
- AuthController.changePassword: `@Post('change-password')`
- AuthController.revokeSession: `@Delete('sessions/:sessionId')`

### Bằng chứng và mức triển khai

- [AuthController.verifyEmail](../../../src/auth/auth.controller.ts) (dòng 131)
- [AuthController.forgotPassword](../../../src/auth/auth.controller.ts) (dòng 138)
- [AuthController.resetPassword](../../../src/auth/auth.controller.ts) (dòng 146)
- [AuthController.changePassword](../../../src/auth/auth.controller.ts) (dòng 168)
- [AuthController.revokeSession](../../../src/auth/auth.controller.ts) (dòng 187)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/SecuritySettings.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/SecuritySettings.jsx)
- Schema: `AccountToken`, `UserSession`, `User`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-04 — Duy trì hồ sơ cá nhân

- Mục tiêu: Duy trì hồ sơ cá nhân, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-12.
- Actor tham gia: Khách hàng (CUSTOMER); Chủ doanh nghiệp (BUSINESS_OWNER); Lễ tân (RECEPTIONIST); Chuyên viên (STAFF); Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu duy trì hồ sơ cá nhân.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống lưu và trả hồ sơ cập nhật.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Actor xem hồ sơ của mình; hệ thống trả các trường được phép.
2. Actor chỉnh thông tin hợp lệ/ảnh; hệ thống kiểm tra dữ liệu và quyền media.
3. Hệ thống lưu và trả hồ sơ cập nhật.

### Thay thế và ngoại lệ

- 2a. Dữ liệu hoặc media không hợp lệ: không cập nhật thành công.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: Thông tin hồ sơ; không dùng cập nhật hồ sơ để tự đổi role.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: CUSTOMER theo chính chủ, tài khoản tách vận hành; OWNER theo doanh nghiệp và thao tác được cấp; RECEPTIONIST theo chi nhánh và hành động tại quầy; STAFF theo assignment/tài khoản của mình; PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-01

- UsersController.me: `@Get('me/profile')`; `@Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'CUSTOMER')`; `@RequirePermission('user:read:self')`
- UsersController.updateMe: `@Patch('me/profile')`; `@Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'CUSTOMER')`; `@RequirePermission('user:update:self')`

### Bằng chứng và mức triển khai

- [UsersController.me](../../../src/users/users.controller.ts) (dòng 34)
- [UsersController.updateMe](../../../src/users/users.controller.ts) (dòng 41)
- [UsersService.updateSelf](../../../src/users/users.service.ts) (dòng 56)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/ProfileSettings.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/ProfileSettings.jsx)
- Schema: `User`, `CustomerProfile`, `StaffProfile`, `MediaFile`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-05 — Tự đặt lịch dịch vụ

- Mục tiêu: Tự đặt lịch dịch vụ, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-02.
- Actor tham gia: Khách hàng (CUSTOMER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu tự đặt lịch dịch vụ.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống tạo lịch cùng các phần dịch vụ và snapshot, trả trạng thái PENDING hoặc CONFIRMED.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Khách chọn dịch vụ/chuyên viên/thời điểm; hệ thống kiểm tra phạm vi và chính sách.
2. Khách xác nhận giá, thông tin và cảnh báo nếu cần; hệ thống kiểm tra slot/năng lực lần cuối.
3. Hệ thống tạo lịch cùng các phần dịch vụ và snapshot, trả trạng thái PENDING hoặc CONFIRMED.

### Thay thế và ngoại lệ

- 2a. Điểm 3 chưa xác nhận cảnh báo: từ chối.
- 2b. Hạn chế tự đặt hoặc slot vừa bị chiếm: từ chối, khách chọn lại.
- 3a. Chính sách thủ công: trả PENDING, không mô tả đã được cơ sở xác nhận.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: branchId, serviceIds hoặc comboId, thời điểm, staffId tùy chế độ, voucherCode, violationAcknowledged.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: CUSTOMER theo chính chủ, tài khoản tách vận hành.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-01, BR-02, BR-03

- BookingsController.create: `@Post()`; `@Roles('BUSINESS_OWNER', 'RECEPTIONIST', 'CUSTOMER')`; `@RequirePermission( 'booking:create:self', 'booking:create:tenant', 'booking:create:branch', )`
- BookingsController.createGuest: `@Post('guest')`; `@Roles('CUSTOMER')`; `@RequirePermission('booking:create:self')`

### Bằng chứng và mức triển khai

- [BookingsController.create](../../../src/bookings/bookings.controller.ts) (dòng 237)
- [BookingsController.createGuest](../../../src/bookings/bookings.controller.ts) (dòng 199)
- [BookingsService.create](../../../src/bookings/bookings.service.ts) (dòng 817)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingStep1.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingStep1.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingConfirm.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingConfirm.jsx)
- Schema: `Booking`, `BookingService`, `BookingContact`, `BranchServiceOffering`, `StaffProfile`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: BookingScreen/BookingsContext tạo lịch ONLINE_APP..
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-06 — Kiểm tra giờ còn khả dụng

- Mục tiêu: Kiểm tra giờ còn khả dụng, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-02.
- Actor tham gia: Người chưa đăng nhập (PUBLIC); Khách hàng (CUSTOMER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu kiểm tra giờ còn khả dụng.
- Tiền điều kiện: Hành động Public không cần phiên; hành động protected trong UC vẫn cần phiên tương ứng. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Actor nhận giờ khả dụng; khi tạo lịch vẫn phải kiểm tra lại.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Actor chọn dịch vụ/ngày; hệ thống xác định thời lượng và cửa sổ mở cửa.
2. Hệ thống xét nhân sự nhận lịch, kỹ năng và các khoảng đã chiếm.
3. Actor nhận giờ khả dụng; khi tạo lịch vẫn phải kiểm tra lại.

### Thay thế và ngoại lệ

- 1a. Ngày đóng cửa/dịch vụ không cho đặt online: không có slot.
- 2a. Không nhân sự phù hợp: kết quả không có giờ khả dụng.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: branchId, serviceIds, ngày, staffId khi chọn; theo truy vấn controller.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: PUBLIC chỉ nội dung công khai; CUSTOMER theo chính chủ, tài khoản tách vận hành.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-02

- BookingsController.getAvailableSlots: `@Get('available-slots')`; `@Public()`

### Bằng chứng và mức triển khai

- [BookingsController.getAvailableSlots](../../../src/bookings/bookings.controller.ts) (dòng 724)
- [BookingsService.getAvailableSlots](../../../src/bookings/bookings.service.ts) (dòng 1917)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingStep3.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingStep3.jsx)
- Schema: `BranchWorkingHour`, `BranchHoliday`, `SpecialWorkingDay`, `StaffService`, `BookingService`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: BookingScreen gọi available slots..
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-07 — Xem giá và ưu đãi đặt lịch

- Mục tiêu: Xem giá và ưu đãi đặt lịch, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-02, BUC-06.
- Actor tham gia: Khách hàng (CUSTOMER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu xem giá và ưu đãi đặt lịch.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Khách nhận báo giá để quyết định; giá được kiểm tra lại khi tạo lịch.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Khách chọn dịch vụ/biến thể và mã ưu đãi; hệ thống kiểm tra dữ liệu.
2. Hệ thống tính giá, điều kiện và phạm vi ưu đãi.
3. Khách nhận báo giá để quyết định; giá được kiểm tra lại khi tạo lịch.

### Thay thế và ngoại lệ

- 2a. Mã hết hạn, sai khách/phạm vi hoặc vượt lượt: không áp dụng theo kiểm tra pricing.
- 3a. Báo giá không khóa chỗ hay bảo đảm giá bất biến trước khi tạo.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: Danh sách dịch vụ, biến thể, voucherCode, ngày.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: CUSTOMER theo chính chủ, tài khoản tách vận hành.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-03, BR-09

- BookingsController.previewPrice: `@Post('preview-price')`; `@Roles('CUSTOMER')`; `@RequirePermission('booking:create:self')`

### Bằng chứng và mức triển khai

- [BookingsController.previewPrice](../../../src/bookings/bookings.controller.ts) (dòng 308)
- [VouchersService.preview](../../../src/bookings/vouchers.service.ts) (dòng 15)
- [PricingEngineService.quote](../../../src/promotions/pricing-engine.service.ts) (dòng 28)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingConfirm.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingConfirm.jsx)
- Schema: `Voucher`, `Promotion`, `PriceAdjustment`, `BranchServiceOffering`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-08 — Theo dõi lịch và chính sách tự đặt

- Mục tiêu: Theo dõi lịch và chính sách tự đặt, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-02, BUC-03.
- Actor tham gia: Khách hàng (CUSTOMER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu theo dõi lịch và chính sách tự đặt.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Khách xem chính sách tại doanh nghiệp; hệ thống tính điểm trong cửa sổ và đọc hạn chế hiện hành.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Khách mở lịch của mình; hệ thống giới hạn ownership.
2. Khách mở chi tiết; hệ thống trả trạng thái, từng dịch vụ và điều kiện thao tác.
3. Khách xem chính sách tại doanh nghiệp; hệ thống tính điểm trong cửa sổ và đọc hạn chế hiện hành.

### Thay thế và ngoại lệ

- 1a. Lịch người khác: từ chối.
- 3a. Đọc chính sách không tự tạo hoặc gia hạn hạn chế.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: bookingId hoặc businessId; không nhận customerId người khác làm quyền truy cập.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: CUSTOMER theo chính chủ, tài khoản tách vận hành.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-06

- BookingsController.myAppointments: `@Get('my-appointments')`; `@Roles('CUSTOMER')`; `@RequirePermission('booking:read:self')`
- BookingsController.findOne: `@Get(':id')`; `@Roles( 'PLATFORM_ADMIN', 'BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'CUSTOMER', )`; `@RequirePermission('booking:read:self', 'booking:read:branch', 'booking:read:tenant', 'booking:read:platform')`
- BookingsController.selfBookingPolicy: `@Get('self-booking-policy')`; `@Roles('CUSTOMER')`; `@RequirePermission('booking:create:self')`

### Bằng chứng và mức triển khai

- [BookingsController.myAppointments](../../../src/bookings/bookings.controller.ts) (dòng 545)
- [BookingsController.findOne](../../../src/bookings/bookings.controller.ts) (dòng 858)
- [BookingsController.selfBookingPolicy](../../../src/bookings/bookings.controller.ts) (dòng 185)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerAppointments.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerAppointments.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerAppointmentDetail.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerAppointmentDetail.jsx)
- Schema: `Booking`, `BookingViolationEvent`, `CustomerBookingPolicy`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: LichHenScreen/AppointmentDetailScreen dùng API..
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-09 — Tự hủy lịch đủ sớm

- Mục tiêu: Tự hủy lịch đủ sớm, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-03.
- Actor tham gia: Khách hàng (CUSTOMER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu tự hủy lịch đủ sớm.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Lịch chuyển CANCELLED, giải phóng quyền lợi/slot theo xử lý hiện có.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Khách chọn hủy lịch thuộc mình; hệ thống kiểm tra trạng thái và thời điểm.
2. Khách xác nhận; hệ thống kiểm tra lại điều kiện trong giao dịch.
3. Lịch chuyển CANCELLED, giải phóng quyền lợi/slot theo xử lý hiện có.

### Thay thế và ngoại lệ

- 1a. Còn dưới 4 giờ: phải gửi yêu cầu hủy sát giờ.
- 1b. Lịch đã bắt đầu/trạng thái không cho phép: từ chối.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: bookingId, trạng thái CANCELLED, lý do khi UI yêu cầu.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: CUSTOMER theo chính chủ, tài khoản tách vận hành.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-04

- BookingsController.updateStatus: `@Patch(':id/status')`; `@Roles( 'PLATFORM_ADMIN', 'BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'CUSTOMER', )`; `@RequirePermission('booking:update:self', 'booking:update:branch', 'booking:update:tenant', 'booking:cancel:platform')`

### Bằng chứng và mức triển khai

- [BookingsController.updateStatus](../../../src/bookings/bookings.controller.ts) (dòng 977)
- [BookingsService.updateStatus](../../../src/bookings/bookings.service.ts) (dòng 421)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerAppointmentDetail.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerAppointmentDetail.jsx)
- Schema: `Booking`, `BookingService`, `BookingStatusHistory`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: AppointmentDetailScreen gọi API hủy..
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-10 — Gửi yêu cầu đổi hoặc hủy lịch

- Mục tiêu: Gửi yêu cầu đổi hoặc hủy lịch, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-03.
- Actor tham gia: Khách hàng (CUSTOMER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu gửi yêu cầu đổi hoặc hủy lịch.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống tạo yêu cầu PENDING có hạn 24 giờ; hủy sát giờ ghi vi phạm tại lúc gửi.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Khách chọn đổi giờ/chuyên viên hoặc yêu cầu hủy; hệ thống kiểm tra sở hữu và trạng thái.
2. Khách gửi phương án/lý do; hệ thống kiểm tra yêu cầu đang mở và chính sách.
3. Hệ thống tạo yêu cầu PENDING có hạn 24 giờ; hủy sát giờ ghi vi phạm tại lúc gửi.

### Thay thế và ngoại lệ

- 1a. Đổi lịch bị tắt/đạt số lần tối đa: từ chối.
- 2a. Có yêu cầu PENDING còn hiệu lực: xung đột.
- 3a. Gửi yêu cầu chưa thay đổi lịch.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: requestType RESCHEDULE/STAFF_CHANGE/CANCEL; proposedStartTime/proposedEndTime/proposedStaffId.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: CUSTOMER theo chính chủ, tài khoản tách vận hành.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-04, BR-05, BR-06

- BookingsController.createChangeRequest: `@Post(':id/change-requests')`; `@Roles('CUSTOMER')`; `@RequirePermission('change_request:create:self')`

### Bằng chứng và mức triển khai

- [BookingsController.createChangeRequest](../../../src/bookings/bookings.controller.ts) (dòng 1186)
- [ChangeRequestsService.create](../../../src/bookings/change-requests.service.ts) (dòng 56)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerAppointmentDetail.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerAppointmentDetail.jsx)
- Schema: `AppointmentChangeRequest`, `Booking`, `BookingViolationEvent`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: RescheduleScreen và AppointmentDetailScreen có caller..
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-11 — Sắp xếp chuỗi lịch định kỳ

- Mục tiêu: Sắp xếp chuỗi lịch định kỳ, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-02, BUC-06.
- Actor tham gia: Khách hàng (CUSTOMER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu sắp xếp chuỗi lịch định kỳ.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Khách theo dõi/tạm dừng/tiếp tục/hủy theo trạng thái được hỗ trợ.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Khách chọn quy tắc lặp; hệ thống preview từng kỳ.
2. Khách quyết định bỏ qua xung đột nếu chấp nhận; hệ thống tạo các kỳ đủ điều kiện.
3. Khách theo dõi/tạm dừng/tiếp tục/hủy theo trạng thái được hỗ trợ.

### Thay thế và ngoại lệ

- 2a. Có xung đột mà không bỏ qua: từ chối.
- 2b. Tạo chuỗi lỗi: trạng thái FAILED và cơ chế bù các kỳ đã tạo; không gọi đây là một giao dịch nguyên tử.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: Tần suất, startDate, occurrenceCount/endDate, staffMode, skipConflicts; xem recurring.dto.ts.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: CUSTOMER theo chính chủ, tài khoản tách vận hành.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-02, BR-04, BR-06

- RecurringController.preview: `@Roles('CUSTOMER')`; `@Post('preview')`; `@RequirePermission('booking:create:self')`
- RecurringController.create: `@Roles('CUSTOMER')`; `@Post()`; `@RequirePermission('booking:create:self')`
- RecurringController.status: `@Roles('CUSTOMER')`; `@Patch(':id/status')`; `@RequirePermission('booking:update:self')`

### Bằng chứng và mức triển khai

- [RecurringController.preview](../../../src/recurring/recurring.controller.ts) (dòng 16)
- [RecurringController.create](../../../src/recurring/recurring.controller.ts) (dòng 22)
- [RecurringController.status](../../../src/recurring/recurring.controller.ts) (dòng 35)
- [RecurringService.create](../../../src/recurring/recurring.service.ts) (dòng 39)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingConfirm.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingConfirm.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerAppointments.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerAppointments.jsx)
- Schema: `RecurringBookingPlan`, `Booking`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-12 — Lưu dịch vụ quan tâm

- Mục tiêu: Lưu dịch vụ quan tâm, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-01, BUC-06.
- Actor tham gia: Khách hàng (CUSTOMER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu lưu dịch vụ quan tâm.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Khách xem hoặc bỏ lưu; hệ thống chỉ thay đổi danh sách của mình.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Khách chọn lưu dịch vụ; hệ thống kiểm tra dịch vụ và danh tính.
2. Hệ thống ghi liên kết duy nhất khách–dịch vụ.
3. Khách xem hoặc bỏ lưu; hệ thống chỉ thay đổi danh sách của mình.

### Thay thế và ngoại lệ

- 1a. Dịch vụ không hợp lệ: từ chối.
- 2a. Lưu lặp không tạo nhiều liên kết trùng.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: branchServiceOfferingId/serviceId.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: CUSTOMER theo chính chủ, tài khoản tách vận hành.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-01

- SavedServicesController.list: `@Roles('CUSTOMER')`; `@RequirePermission('service:read:public')`; `@Get()`
- SavedServicesController.save: `@Roles('CUSTOMER')`; `@RequirePermission('service:read:public')`; `@Post()`

### Bằng chứng và mức triển khai

- [SavedServicesController.list](../../../src/saved-services/saved-services.controller.ts) (dòng 14)
- [SavedServicesController.save](../../../src/saved-services/saved-services.controller.ts) (dòng 19)
- [SavedServicesService.save](../../../src/saved-services/saved-services.service.ts) (dòng 56)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerBenefits.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerBenefits.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Public/PublicDetails.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Public/PublicDetails.jsx)
- Schema: `CustomerSavedService`, `CustomerProfile`, `BranchServiceOffering`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: FavoritesContext đồng bộ saved-services API..
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-13 — Tạo lịch hộ tại cơ sở

- Mục tiêu: Tạo lịch hộ tại cơ sở, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-02.
- Actor tham gia: Chủ doanh nghiệp (BUSINESS_OWNER); Lễ tân (RECEPTIONIST). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu tạo lịch hộ tại cơ sở.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Nhân sự xác nhận; hệ thống tạo lịch với nguồn nghiệp vụ được phép.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Nhân sự chọn chi nhánh, khách/hồ sơ vãng lai và dịch vụ.
2. Hệ thống kiểm tra quyền tại chi nhánh, thời điểm, kỹ năng và phương án nhận lịch.
3. Nhân sự xác nhận; hệ thống tạo lịch với nguồn nghiệp vụ được phép.

### Thay thế và ngoại lệ

- 1a. Ngoài chi nhánh/doanh nghiệp: từ chối.
- 2a. Vãng lai được tạo hồ sơ không đồng nghĩa có tài khoản CUSTOMER đăng nhập.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: Thông tin khách, dịch vụ, giờ, nguồn WALK_IN/PHONE/STAFF_CREATED theo chính sách kênh.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: OWNER theo doanh nghiệp và thao tác được cấp; RECEPTIONIST theo chi nhánh và hành động tại quầy.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-01, BR-02

- BookingsController.create: `@Post()`; `@Roles('BUSINESS_OWNER', 'RECEPTIONIST', 'CUSTOMER')`; `@RequirePermission( 'booking:create:self', 'booking:create:tenant', 'booking:create:branch', )`

### Bằng chứng và mức triển khai

- [BookingsController.create](../../../src/bookings/bookings.controller.ts) (dòng 237)
- [BookingsService.create](../../../src/bookings/bookings.service.ts) (dòng 817)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonAppointments.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonAppointments.jsx)
- Schema: `CustomerProfile`, `BookingContact`, `Booking`, `BookingService`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-14 — Điều phối lịch và phân công

- Mục tiêu: Điều phối lịch và phân công, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-02, BUC-04.
- Actor tham gia: Chủ doanh nghiệp (BUSINESS_OWNER); Lễ tân (RECEPTIONIST). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu điều phối lịch và phân công.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Nhân sự xác nhận; hệ thống cập nhật và phát sự kiện lịch.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Nhân sự xem lịch thuộc scope; chọn phương án dời/gán hoặc thêm dịch vụ.
2. Hệ thống kiểm tra trạng thái, khả năng nhận dịch vụ và xung đột.
3. Nhân sự xác nhận; hệ thống cập nhật và phát sự kiện lịch.

### Thay thế và ngoại lệ

- 2a. Xung đột hoặc nhân sự không đủ kỹ năng: từ chối.
- 1a. Resize chỉ OWNER; không suy mọi thao tác scheduler có cùng quyền.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: bookingId, staffId/thời điểm/serviceId tùy hành động; resize có endpoint riêng.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: OWNER theo doanh nghiệp và thao tác được cấp; RECEPTIONIST theo chi nhánh và hành động tại quầy.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-02, BR-07

- BookingsController.moveBooking: `@Patch(':id/move')`; `@Roles('BUSINESS_OWNER', 'RECEPTIONIST')`; `@RequirePermission('booking:reschedule:branch', 'booking:update:tenant')`
- BookingsController.assignStaff: `@Patch(':id/assign')`; `@Roles('BUSINESS_OWNER', 'RECEPTIONIST')`; `@RequirePermission('booking:assign:branch', 'booking:assign:tenant')`
- BookingsController.addBookingItem: `@Post(':id/items')`; `@Roles('BUSINESS_OWNER', 'RECEPTIONIST')`; `@RequirePermission('booking:update:branch', 'booking:update:tenant')`

### Bằng chứng và mức triển khai

- [BookingsController.moveBooking](../../../src/bookings/bookings.controller.ts) (dòng 1072)
- [BookingsController.assignStaff](../../../src/bookings/bookings.controller.ts) (dòng 1105)
- [BookingsController.addBookingItem](../../../src/bookings/bookings.controller.ts) (dòng 1118)
- [BookingsService.assignStaff](../../../src/bookings/bookings.service.ts) (dòng 2488)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonAppointments.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonAppointments.jsx)
- Schema: `Booking`, `BookingService`, `StaffProfile`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-15 — Xử lý yêu cầu thay đổi lịch

- Mục tiêu: Xử lý yêu cầu thay đổi lịch, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-03.
- Actor tham gia: Chủ doanh nghiệp (BUSINESS_OWNER); Lễ tân (RECEPTIONIST). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu xử lý yêu cầu thay đổi lịch.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống ghi kết quả và thông báo; chỉ cập nhật lịch khi duyệt hợp lệ.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Nhân sự mở yêu cầu chờ trong scope.
2. Nhân sự duyệt hoặc từ chối; hệ thống kiểm tra hạn và trạng thái hiện tại, kiểm tra phương án mới nếu duyệt.
3. Hệ thống ghi kết quả và thông báo; chỉ cập nhật lịch khi duyệt hợp lệ.

### Thay thế và ngoại lệ

- 2a. Yêu cầu hết 24 giờ: EXPIRED, không duyệt.
- 2b. Slot phương án mới bị chiếm: xung đột.
- 3a. Từ chối/hết hạn không xóa sự kiện hủy sát giờ đã ghi.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: reqId, quyết định, reviewNote.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: OWNER theo doanh nghiệp và thao tác được cấp; RECEPTIONIST theo chi nhánh và hành động tại quầy.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-05, BR-06

- BookingsController.approveChangeRequest: `@Patch('change-requests/:reqId/approve')`; `@Roles('BUSINESS_OWNER', 'RECEPTIONIST')`; `@RequirePermission('change_request:approve:branch', 'change_request:approve:tenant')`
- BookingsController.rejectChangeRequest: `@Patch('change-requests/:reqId/reject')`; `@Roles('BUSINESS_OWNER', 'RECEPTIONIST')`; `@RequirePermission('change_request:approve:branch', 'change_request:approve:tenant')`

### Bằng chứng và mức triển khai

- [BookingsController.approveChangeRequest](../../../src/bookings/bookings.controller.ts) (dòng 1209)
- [BookingsController.rejectChangeRequest](../../../src/bookings/bookings.controller.ts) (dòng 1227)
- [ChangeRequestsService.approve](../../../src/bookings/change-requests.service.ts) (dòng 194)
- [ChangeRequestsService.reject](../../../src/bookings/change-requests.service.ts) (dòng 525)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonAppointments.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonAppointments.jsx)
- Schema: `AppointmentChangeRequest`, `Booking`, `BookingService`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-16 — Tiếp nhận khách và ghi no-show

- Mục tiêu: Tiếp nhận khách và ghi no-show, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-04.
- Actor tham gia: Chủ doanh nghiệp (BUSINESS_OWNER); Lễ tân (RECEPTIONIST). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu tiếp nhận khách và ghi no-show.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống ghi CHECKED_IN hoặc NO_SHOW theo nhánh, ghi lịch sử và vi phạm khi đủ điều kiện.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Lễ tân/chủ cơ sở kiểm tra lịch CONFIRMED.
2. Actor xác nhận khách đến hoặc xác nhận no-show; hệ thống kiểm tra thời gian và yêu cầu hủy đã báo.
3. Hệ thống ghi CHECKED_IN hoặc NO_SHOW theo nhánh, ghi lịch sử và vi phạm khi đủ điều kiện.

### Thay thế và ngoại lệ

- 2a. No-show trước start+15 phút hoặc thiếu xác nhận: từ chối.
- 2b. Đã có yêu cầu hủy CUSTOMER: chặn no-show theo service.
- 3a. Hồ sơ vãng lai không có role CUSTOMER: không tính vi phạm tự đặt.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: bookingId, noShowConfirmed=true cho no-show; check-in mặc định sớm tối đa 30 phút (có env).
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: OWNER theo doanh nghiệp và thao tác được cấp; RECEPTIONIST theo chi nhánh và hành động tại quầy.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-06, BR-07

- BookingsController.checkin: `@Post(':id/checkin')`; `@Roles('RECEPTIONIST', 'BUSINESS_OWNER')`; `@RequirePermission('booking:check_in:branch', 'booking:check_in:tenant')`
- BookingsController.updateStatus: `@Patch(':id/status')`; `@Roles( 'PLATFORM_ADMIN', 'BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'CUSTOMER', )`; `@RequirePermission('booking:update:self', 'booking:update:branch', 'booking:update:tenant', 'booking:cancel:platform')`

### Bằng chứng và mức triển khai

- [BookingsController.checkin](../../../src/bookings/bookings.controller.ts) (dòng 1297)
- [BookingsController.updateStatus](../../../src/bookings/bookings.controller.ts) (dòng 977)
- [BookingsService.checkin](../../../src/bookings/bookings.service.ts) (dòng 2797)
- [BookingsService.updateStatus](../../../src/bookings/bookings.service.ts) (dòng 421)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonAppointments.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonAppointments.jsx)
- Schema: `Booking`, `BookingStatusHistory`, `BookingViolationEvent`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-17 — Thực hiện phần dịch vụ được giao

- Mục tiêu: Thực hiện phần dịch vụ được giao, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-04.
- Actor tham gia: Chuyên viên (STAFF); Chủ doanh nghiệp (BUSINESS_OWNER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu thực hiện phần dịch vụ được giao.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống cập nhật tiến độ item và tổng hợp trạng thái lịch theo xử lý service.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Chuyên viên mở phần việc được giao.
2. Actor bắt đầu/hoàn tất phần dịch vụ; hệ thống kiểm tra assignment, trạng thái và thời gian.
3. Hệ thống cập nhật tiến độ item và tổng hợp trạng thái lịch theo xử lý service.

### Thay thế và ngoại lệ

- 1a. STAFF không được thao tác phần việc người khác.
- 2a. Không thể hoàn tất sai thứ tự hoặc trạng thái không hợp lệ.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: bookingId, itemId và trạng thái item; OWNER có quyền trong doanh nghiệp.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: STAFF theo assignment/tài khoản của mình; OWNER theo doanh nghiệp và thao tác được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-07

- BookingsController.updateBookingItem: `@Patch(':id/items/:itemId')`; `@Roles('BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF')`; `@RequirePermission('booking:update:branch', 'booking:update:tenant', 'booking:complete:branch')`

### Bằng chứng và mức triển khai

- [BookingsController.updateBookingItem](../../../src/bookings/bookings.controller.ts) (dòng 1147)
- [BookingItemsService.update](../../../src/bookings/booking-items.service.ts) (dòng 85)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonAppointments.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonAppointments.jsx)
- Schema: `BookingService`, `BookingServiceAdjustment`, `Booking`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-18 — Thu tiền và xác minh giao dịch

- Mục tiêu: Thu tiền và xác minh giao dịch, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-05.
- Actor tham gia: Chủ doanh nghiệp (BUSINESS_OWNER); Lễ tân (RECEPTIONIST). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu thu tiền và xác minh giao dịch.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Tiền mặt được ghi VERIFIED; chuyển khoản PENDING chỉ thành VERIFIED sau actor xác minh chứng từ.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Nhân sự xem checkout và số dư; nhập khoản thu/phương thức.
2. Hệ thống kiểm tra scope, amount và idempotency; tạo intent/transaction/payment.
3. Tiền mặt được ghi VERIFIED; chuyển khoản PENDING chỉ thành VERIFIED sau actor xác minh chứng từ.

### Thay thế và ngoại lệ

- 2a. Vượt số dư/khóa trùng hoặc provider không hỗ trợ: từ chối.
- 3a. Chưa xác minh chuyển khoản: chưa ghi nhận như đã thanh toán.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: bookingId, amount, method CASH/BANK_TRANSFER, idempotencyKey; settlementReference/evidence cho verify.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: OWNER theo doanh nghiệp và thao tác được cấp; RECEPTIONIST theo chi nhánh và hành động tại quầy.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-08

- PaymentsController.collect: `@Post('collect')`; `@Roles('RECEPTIONIST', 'BUSINESS_OWNER')`; `@RequirePermission('payment:create:branch', 'payment:create:tenant')`
- PaymentsController.verifyTransaction: `@Post('transactions/:transactionId/verify')`; `@Roles('RECEPTIONIST', 'BUSINESS_OWNER')`; `@RequirePermission('payment_transaction:verify:branch', 'payment_transaction:verify:tenant')`

### Bằng chứng và mức triển khai

- [PaymentsController.collect](../../../src/payments/payments.controller.ts) (dòng 36)
- [PaymentsController.verifyTransaction](../../../src/payments/payments.controller.ts) (dòng 61)
- [PaymentsService.collect](../../../src/payments/payments.service.ts) (dòng 149)
- [PaymentsService.verifyTransaction](../../../src/payments/payments.service.ts) (dòng 735)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentsWorkspace.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentsWorkspace.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentCorePanels.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentCorePanels.jsx)
- Schema: `Payment`, `PaymentIntent`, `PaymentTransaction`, `FinancialLedgerEntry`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-19 — Đề nghị và xét duyệt hoàn tiền

- Mục tiêu: Đề nghị và xét duyệt hoàn tiền, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-05.
- Actor tham gia: Chủ doanh nghiệp (BUSINESS_OWNER); Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu đề nghị và xét duyệt hoàn tiền.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Một người có quyền khác xét duyệt; hệ thống ghi APPROVED hoặc REJECTED.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Actor có quyền nhập số tiền, lý do và căn cứ.
2. Hệ thống giữ số dư yêu cầu để chống vượt tiền đã trả.
3. Một người có quyền khác xét duyệt; hệ thống ghi APPROVED hoặc REJECTED.

### Thay thế và ngoại lệ

- 1a. Payment chưa PAID/PARTIALLY_REFUNDED hoặc amount không hợp lệ: từ chối.
- 3a. Người tạo tự duyệt: từ chối.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: paymentId, amount>0, reason, evidence; refundId và quyết định.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: OWNER theo doanh nghiệp và thao tác được cấp; PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-08

- PaymentsController.requestRefund: `@Post(':paymentId/refund-requests')`; `@Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')`; `@RequirePermission('refund:create:tenant', 'refund:create:platform')`
- PaymentsController.review: `@Patch('refunds/:refundId/review')`; `@Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')`; `@RequirePermission('refund:approve:tenant', 'refund:approve:platform')`

### Bằng chứng và mức triển khai

- [PaymentsController.requestRefund](../../../src/payments/payments.controller.ts) (dòng 227)
- [PaymentsController.review](../../../src/payments/payments.controller.ts) (dòng 239)
- [PaymentsService.requestRefund](../../../src/payments/payments.service.ts) (dòng 363)
- [PaymentsService.reviewRefund](../../../src/payments/payments.service.ts) (dòng 396)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentsWorkspace.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentsWorkspace.jsx)
- Schema: `RefundRequest`, `Payment`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-20 — Ghi kết quả xử lý hoàn tiền

- Mục tiêu: Ghi kết quả xử lý hoàn tiền, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-05.
- Actor tham gia: Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu ghi kết quả xử lý hoàn tiền.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống cập nhật trạng thái, phân bổ/sổ cái và khoản thanh toán khi xác nhận thành công.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Quản trị chọn yêu cầu đủ điều kiện và START xử lý.
2. Quản trị cung cấp kết quả thực tế: CONFIRM kèm mã đối soát hoặc FAIL kèm lý do.
3. Hệ thống cập nhật trạng thái, phân bổ/sổ cái và khoản thanh toán khi xác nhận thành công.

### Thay thế và ngoại lệ

- 2a. Thiếu căn cứ/mã đối soát hoặc trạng thái không hợp lệ: từ chối.
- 2b. FAIL không được hiểu là tiền đã về khách.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: action START/CONFIRM/FAIL; settlementReference/failureReason.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-08

- PaymentsController.process: `@Post('refunds/:refundId/process')`; `@Roles('PLATFORM_ADMIN')`; `@RequirePermission('refund:process:platform')`

### Bằng chứng và mức triển khai

- [PaymentsController.process](../../../src/payments/payments.controller.ts) (dòng 251)
- [PaymentsService.processRefund](../../../src/payments/payments.service.ts) (dòng 421)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentsWorkspace.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentsWorkspace.jsx)
- Schema: `RefundRequest`, `RefundAllocation`, `FinancialLedgerEntry`, `Payment`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-21 — Quản lý gói buổi dịch vụ

- Mục tiêu: Quản lý gói buổi dịch vụ, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-05, BUC-06.
- Actor tham gia: Khách hàng (CUSTOMER); Chủ doanh nghiệp (BUSINESS_OWNER); Lễ tân (RECEPTIONIST). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu quản lý gói buổi dịch vụ.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống quản lý quyền dùng buổi; nhân sự dự trữ buổi cho lịch khi đủ điều kiện.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Chủ doanh nghiệp định nghĩa gói; hệ thống kiểm tra phạm vi.
2. Khách/nhân sự có quyền tạo giao dịch mua và khoản trả theo API.
3. Hệ thống quản lý quyền dùng buổi; nhân sự dự trữ buổi cho lịch khi đủ điều kiện.

### Thay thế và ngoại lệ

- 2a. Vai trò/phạm vi mỗi hành động khác nhau, CUSTOMER không tạo gói.
- 3a. Chưa đủ điều kiện hoặc vượt buổi: từ chối.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: packageId, dữ liệu mua/trả góp/dự trữ theo payments.dto.ts.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: CUSTOMER theo chính chủ, tài khoản tách vận hành; OWNER theo doanh nghiệp và thao tác được cấp; RECEPTIONIST theo chi nhánh và hành động tại quầy.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-08

- PaymentsController.createPackage: `@Post('packages')`; `@Roles('BUSINESS_OWNER')`; `@RequirePermission('treatment_package:manage:tenant')`
- PaymentsController.purchasePackage: `@Post('packages/:packageId/purchases')`; `@Roles('RECEPTIONIST', 'BUSINESS_OWNER')`; `@RequirePermission( 'package_purchase:create:branch', 'package_purchase:create:tenant', )`
- PaymentsController.reservePackageSession: `@Post('package-purchases/:purchaseId/sessions/reserve')`; `@Roles('CUSTOMER', 'RECEPTIONIST', 'BUSINESS_OWNER')`; `@RequirePermission( 'package_purchase:create:self', 'package_purchase:create:branch', 'package_purchase:create:tenant', )`

### Bằng chứng và mức triển khai

- [PaymentsController.createPackage](../../../src/payments/payments.controller.ts) (dòng 163)
- [PaymentsController.purchasePackage](../../../src/payments/payments.controller.ts) (dòng 174)
- [PaymentsController.reservePackageSession](../../../src/payments/payments.controller.ts) (dòng 212)
- [PaymentsService.purchaseTreatmentPackage](../../../src/payments/payments.service.ts) (dòng 1339)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentCorePanels.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentCorePanels.jsx)
- Schema: `TreatmentPackage`, `PackagePurchase`, `PackageInstallment`, `PackageSessionEntitlement`; xem từ điển dữ liệu.
- Mức triển khai: Triển khai một phần: backend có các hành động; web xác minh được tạo gói, chưa xác minh đầy đủ UI mua/dùng buổi..
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-22 — Chuẩn bị và nộp hồ sơ doanh nghiệp

- Mục tiêu: Chuẩn bị và nộp hồ sơ doanh nghiệp, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-07.
- Actor tham gia: Chủ doanh nghiệp (BUSINESS_OWNER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu chuẩn bị và nộp hồ sơ doanh nghiệp.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Actor gửi hồ sơ; hệ thống chuyển chờ xét hoặc tự duyệt theo chính sách.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Chủ doanh nghiệp lập hồ sơ nháp, dịch vụ/nhân sự và giấy tờ.
2. Actor hoàn thiện checklist; hệ thống kiểm tra thông tin và quyền tài liệu.
3. Actor gửi hồ sơ; hệ thống chuyển chờ xét hoặc tự duyệt theo chính sách.

### Thay thế và ngoại lệ

- 1a. Hồ sơ không DRAFT/NEED_MORE_INFO: không sửa như nháp.
- 2a. Thiếu thông tin bắt buộc: chưa được nộp.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: name, slug, legalDocuments và cấu hình onboarding được validation trong service.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: OWNER theo doanh nghiệp và thao tác được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-10

- BusinessController.createDraft: `@Roles('BUSINESS_OWNER', 'STAFF')`; `@Post('onboarding/draft')`; `@Roles('BUSINESS_OWNER')`; `@RequirePermission('business:create:self')`
- BusinessController.submit: `@Roles('BUSINESS_OWNER', 'STAFF')`; `@Post(':businessId/submit')`; `@Roles('BUSINESS_OWNER')`; `@RequirePermission('business:update:tenant')`

### Bằng chứng và mức triển khai

- [BusinessController.createDraft](../../../src/business/business.controller.ts) (dòng 28)
- [BusinessController.submit](../../../src/business/business.controller.ts) (dòng 62)
- [BusinessOnboardingService.updateDraft](../../../src/business/business-onboarding.service.ts) (dòng 527)
- [BusinessOnboardingService.submit](../../../src/business/business-onboarding.service.ts) (dòng 599)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/BusinessOnboarding.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/BusinessOnboarding.jsx)
- Schema: `Business`, `BusinessDocument`, `BusinessDocumentVersion`, `BusinessReviewEvent`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-23 — Thẩm định doanh nghiệp và chi nhánh

- Mục tiêu: Thẩm định doanh nghiệp và chi nhánh, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-07, BUC-11.
- Actor tham gia: Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu thẩm định doanh nghiệp và chi nhánh.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống kiểm tra trạng thái và ghi quyết định/lịch sử; chi nhánh được duyệt chưa đồng nghĩa đã công bố.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Quản trị mở hồ sơ chờ và giấy tờ.
2. Actor chọn phê duyệt, yêu cầu bổ sung hoặc từ chối kèm căn cứ.
3. Hệ thống kiểm tra trạng thái và ghi quyết định/lịch sử; chi nhánh được duyệt chưa đồng nghĩa đã công bố.

### Thay thế và ngoại lệ

- 2a. Thiếu lý do khi bắt buộc: từ chối.
- 3a. Hồ sơ không còn chờ: xung đột.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: ID hồ sơ, decision, note và quyết định giấy tờ nếu endpoint hỗ trợ.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-10

- BusinessController.review: `@Roles('BUSINESS_OWNER', 'STAFF')`; `@Patch(':businessId/review')`; `@Roles('PLATFORM_ADMIN')`; `@RequirePermission('business:review:platform')`
- BranchesController.review: `@Post(':id/review')`; `@Roles('PLATFORM_ADMIN')`; `@RequirePermission('branch:status:platform')`

### Bằng chứng và mức triển khai

- [BusinessController.review](../../../src/business/business.controller.ts) (dòng 73)
- [BranchesController.review](../../../src/branches/branches.controller.ts) (dòng 261)
- [BusinessOnboardingService.review](../../../src/business/business-onboarding.service.ts) (dòng 666)
- [BranchesService.review](../../../src/branches/branches.service.ts) (dòng 1238)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminSalons.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminSalons.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminEntityDetails.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminEntityDetails.jsx)
- Schema: `BusinessReviewEvent`, `BranchReviewRequest`, `BranchReviewEvent`, `DocumentReviewEvent`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-24 — Thiết lập và công bố chi nhánh

- Mục tiêu: Thiết lập và công bố chi nhánh, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-07, BUC-08.
- Actor tham gia: Chủ doanh nghiệp (BUSINESS_OWNER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu thiết lập và công bố chi nhánh.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Actor gửi xét/công bố theo trạng thái; hệ thống chỉ đưa công khai khi đủ điều kiện.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Chủ cơ sở nhập địa điểm, giờ làm, dịch vụ và nhân sự.
2. Hệ thống kiểm tra readiness và hồ sơ chi nhánh.
3. Actor gửi xét/công bố theo trạng thái; hệ thống chỉ đưa công khai khi đủ điều kiện.

### Thay thế và ngoại lệ

- 2a. Thiếu readiness hoặc chưa duyệt: chặn công bố.
- 3a. Dừng/đóng cơ sở có lịch tương lai chuyển qua nghiệp vụ tác động.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: Dữ liệu onboarding, branchId, danh mục/nhân sự gắn chi nhánh.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: OWNER theo doanh nghiệp và thao tác được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-10, BR-11

- BranchesController.saveOnboarding: `@Patch(':id/onboarding')`; `@Roles('BUSINESS_OWNER')`; `@RequirePermission('branch:update:tenant', 'branch:create:tenant')`
- BranchesController.publish: `@Post(':id/publish')`; `@Roles('BUSINESS_OWNER')`; `@RequirePermission('branch:update:tenant')`

### Bằng chứng và mức triển khai

- [BranchesController.saveOnboarding](../../../src/branches/branches.controller.ts) (dòng 186)
- [BranchesController.publish](../../../src/branches/branches.controller.ts) (dòng 285)
- [BranchesService.getReadiness](../../../src/branches/branches.service.ts) (dòng 764)
- [BranchesService.publish](../../../src/branches/branches.service.ts) (dòng 1317)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/BranchOnboardingWizard.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/BranchOnboardingWizard.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonProfile.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonProfile.jsx)
- Schema: `Branch`, `BranchOnboardingProgress`, `BranchWorkingHour`, `BranchDocument`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-25 — Quản lý dịch vụ và giá tại cơ sở

- Mục tiêu: Quản lý dịch vụ và giá tại cơ sở, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-08.
- Actor tham gia: Chủ doanh nghiệp (BUSINESS_OWNER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu quản lý dịch vụ và giá tại cơ sở.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống lưu trạng thái cung cấp; khi archive kiểm tra lịch tương lai.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Chủ cơ sở chọn định nghĩa chuẩn và xây dựng dịch vụ doanh nghiệp.
2. Actor thiết lập cung cấp ở chi nhánh, giá, biến thể/phụ thuộc; hệ thống kiểm tra scope và dữ liệu.
3. Hệ thống lưu trạng thái cung cấp; khi archive kiểm tra lịch tương lai.

### Thay thế và ngoại lệ

- 1a. Không được sửa catalog chuẩn nếu chỉ là OWNER.
- 3a. Dịch vụ còn lịch tương lai bị ràng buộc: từ chối archive.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: businessServiceId, branchId, pricing, variant/dependency theo DTO.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: OWNER theo doanh nghiệp và thao tác được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-11

- ServicesController.createCatalog: `@Post('catalog')`; `@Roles('BUSINESS_OWNER')`; `@RequirePermission('business_service:create:tenant')`
- ServicesController.updateOfferingPricing: `@Patch('offerings/:id/pricing')`; `@Roles('BUSINESS_OWNER')`; `@RequirePermission('branch_service_offering:pricing:tenant')`
- ServicesController.archiveCatalog: `@Delete('catalog/:id')`; `@Roles('BUSINESS_OWNER')`; `@RequirePermission('business_service:archive:tenant')`

### Bằng chứng và mức triển khai

- [ServicesController.createCatalog](../../../src/services/services.controller.ts) (dòng 187)
- [ServicesController.updateOfferingPricing](../../../src/services/services.controller.ts) (dòng 265)
- [ServicesController.archiveCatalog](../../../src/services/services.controller.ts) (dòng 214)
- [ServicesService.setBranchAvailability](../../../src/services/services.service.ts) (dòng 785)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonServices.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonServices.jsx)
- Schema: `CanonicalService`, `BusinessService`, `BranchServiceOffering`, `ServiceVariant`, `ServicePriceRule`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-26 — Quản lý chuyên viên và lời mời

- Mục tiêu: Quản lý chuyên viên và lời mời, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-08.
- Actor tham gia: Chủ doanh nghiệp (BUSINESS_OWNER); Người chưa đăng nhập (PUBLIC). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu quản lý chuyên viên và lời mời.
- Tiền điều kiện: Hành động Public không cần phiên; hành động protected trong UC vẫn cần phiên tương ứng. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Chủ cơ sở bật nhận lịch/ngừng nhân sự; hệ thống kiểm tra tác động và giữ lịch sử.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Chủ cơ sở tạo hồ sơ, gán kỹ năng/chi nhánh hoặc mời nhân sự.
2. Người nhận dùng token hợp lệ để nhận lời mời; hệ thống kiểm tra tài khoản và tách role.
3. Chủ cơ sở bật nhận lịch/ngừng nhân sự; hệ thống kiểm tra tác động và giữ lịch sử.

### Thay thế và ngoại lệ

- 2a. Token hết hạn/không hợp lệ hoặc tài khoản CUSTOMER xung đột: từ chối.
- 3a. Còn tác động lịch chưa xử lý: chưa hoàn tất ngừng nhân sự.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: Hồ sơ chuyên viên, serviceIds, invitation token; userId có thể null.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: OWNER theo doanh nghiệp và thao tác được cấp; PUBLIC chỉ nội dung công khai.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-01, BR-11

- StaffController.create: `@Post()`; `@Roles('BUSINESS_OWNER')`; `@RequirePermission('user:role_assign:tenant')`
- StaffController.invite: `@Post('invitations')`; `@Roles('BUSINESS_OWNER')`; `@RequirePermission('user:role_assign:tenant')`
- StaffController.acceptInvitation: `@Post('invitations/accept')`; `@Public()`

### Bằng chứng và mức triển khai

- [StaffController.create](../../../src/staff/staff.controller.ts) (dòng 226)
- [StaffController.invite](../../../src/staff/staff.controller.ts) (dòng 79)
- [StaffController.acceptInvitation](../../../src/staff/staff.controller.ts) (dòng 113)
- [StaffService.deactivate](../../../src/staff/staff.service.ts) (dòng 541)
- [StaffInvitationsService.accept](../../../src/staff/staff-invitations.service.ts) (dòng 230)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonStaffManagement.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonStaffManagement.jsx)
- Schema: `StaffProfile`, `StaffInvitation`, `StaffBranchAssignment`, `StaffService`, `UserRole`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-27 — Quản lý combo dịch vụ

- Mục tiêu: Quản lý combo dịch vụ, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-08, BUC-06.
- Actor tham gia: Chủ doanh nghiệp (BUSINESS_OWNER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu quản lý combo dịch vụ.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Combo đủ điều kiện được công khai và dùng để giải quyết danh sách dịch vụ khi đặt.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Chủ cơ sở chọn các dịch vụ thành phần và điều kiện combo.
2. Hệ thống kiểm tra cùng phạm vi và tính hợp lệ của cấu hình.
3. Combo đủ điều kiện được công khai và dùng để giải quyết danh sách dịch vụ khi đặt.

### Thay thế và ngoại lệ

- 2a. Dịch vụ/phạm vi không tương thích: từ chối.
- 3a. Không suy mọi cấu hình combo đều hỗ trợ đặt online.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: Danh sách serviceIds và cấu hình combo; xem combos.dto.ts.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: OWNER theo doanh nghiệp và thao tác được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-02, BR-09

- CombosController.create: `@Post()`; `@Roles('BUSINESS_OWNER')`; `@RequirePermission('combo:manage:tenant')`
- CombosController.update: `@Patch(':id')`; `@Roles('BUSINESS_OWNER')`; `@RequirePermission('combo:manage:tenant')`

### Bằng chứng và mức triển khai

- [CombosController.create](../../../src/combos/combos.controller.ts) (dòng 36)
- [CombosController.update](../../../src/combos/combos.controller.ts) (dòng 44)
- [CombosService.resolveForBooking](../../../src/combos/combos.service.ts) (dòng 136)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonCombos.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonCombos.jsx)
- Schema: `Combo`, `ComboService`, `BranchServiceOffering`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-28 — Thiết lập khuyến mãi và voucher

- Mục tiêu: Thiết lập khuyến mãi và voucher, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-06.
- Actor tham gia: Chủ doanh nghiệp (BUSINESS_OWNER); Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu thiết lập khuyến mãi và voucher.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Khi đặt lịch, pricing xác định ưu đãi và giữ/áp dụng lượt theo trạng thái lịch.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Actor có quyền định nghĩa ưu đãi và phạm vi.
2. Actor cấp voucher khi cần; hệ thống kiểm tra khách, thời hạn và giới hạn.
3. Khi đặt lịch, pricing xác định ưu đãi và giữ/áp dụng lượt theo trạng thái lịch.

### Thay thế và ngoại lệ

- 1a. OWNER không cấp phạm vi ngoài doanh nghiệp.
- 3a. Hết lượt/hết hạn/sai scope: không được áp dụng.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: Giá trị, loại ưu đãi, ngày, limits và phạm vi doanh nghiệp/chi nhánh/dịch vụ/combo.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: OWNER theo doanh nghiệp và thao tác được cấp; PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-09

- PromotionsController.create: `@Post()`; `@Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')`; `@RequirePermission('promotion:manage:tenant', 'promotion:manage:platform')`
- VouchersController.create: `@Post()`; `@Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')`; `@RequirePermission('voucher:manage:tenant', 'voucher:manage:platform')`
- VouchersController.grant: `@Post(':id/grant')`; `@Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')`; `@RequirePermission('voucher:manage:tenant', 'voucher:manage:platform')`

### Bằng chứng và mức triển khai

- [PromotionsController.create](../../../src/promotions/promotions.controller.ts) (dòng 78)
- [VouchersController.create](../../../src/promotions/vouchers.controller.ts) (dòng 56)
- [VouchersController.grant](../../../src/promotions/vouchers.controller.ts) (dòng 98)
- [PricingEngineService.reserve](../../../src/promotions/pricing-engine.service.ts) (dòng 174)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonPromotions.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonPromotions.jsx)
- Schema: `Promotion`, `Voucher`, `CustomerVoucher`, `PromotionRedemption`, `VoucherRedemption`; xem từ điển dữ liệu.
- Mức triển khai: Triển khai web OWNER/API; thao tác PLATFORM có API, cần xác minh đường UI quản lý đầy đủ..
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-29 — Đánh giá dịch vụ đã dùng

- Mục tiêu: Đánh giá dịch vụ đã dùng, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-06.
- Actor tham gia: Khách hàng (CUSTOMER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu đánh giá dịch vụ đã dùng.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống tạo một review cho booking với trạng thái APPROVED theo code.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Khách mở lịch COMPLETED thuộc mình.
2. Khách nhập điểm tổng/thành phần và nhận xét; hệ thống kiểm tra 1–5 và liên kết booking service/staff.
3. Hệ thống tạo một review cho booking với trạng thái APPROVED theo code.

### Thay thế và ngoại lệ

- 1a. Chưa COMPLETED/không sở hữu: từ chối.
- 2a. Booking đã có review hoặc staff không khớp: từ chối.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: bookingId, overallRating, comment, isAnonymous, serviceRatings.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: CUSTOMER theo chính chủ, tài khoản tách vận hành.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-09

- ReviewsController.create: `@Post()`; `@Roles('CUSTOMER')`; `@RequirePermission('review:create:self')`

### Bằng chứng và mức triển khai

- [ReviewsController.create](../../../src/reviews/reviews.controller.ts) (dòng 106)
- [ReviewsService.create](../../../src/reviews/reviews.service.ts) (dòng 280)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerReviews.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerReviews.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerAppointmentDetail.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerAppointmentDetail.jsx)
- Schema: `Review`, `ReviewServiceRating`, `BookingService`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai web/API; mobile cần phân biệt caller thật với ReviewsContext cục bộ..
- Mobile: ReviewsContext chỉ lưu state; không lấy đó làm bằng chứng gửi review thành công..
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-30 — Phản hồi và xem xét đánh giá

- Mục tiêu: Phản hồi và xem xét đánh giá, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-06, BUC-11.
- Actor tham gia: Khách hàng (CUSTOMER); Chủ doanh nghiệp (BUSINESS_OWNER); Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu phản hồi và xem xét đánh giá.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Quản trị xem xét và quyết định kiểm duyệt/giải quyết khiếu nại.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Chủ cơ sở phản hồi; khách/chủ cơ sở báo cáo hoặc khiếu nại khi có căn cứ.
2. Hệ thống kiểm tra quyền theo hành động và ghi sự kiện; báo cáo nghiêm trọng có thể tạm ẩn.
3. Quản trị xem xét và quyết định kiểm duyệt/giải quyết khiếu nại.

### Thay thế và ngoại lệ

- 1a. Trùng report hoặc lý do trống: từ chối.
- 2a. Chủ cơ sở không tự có quyền kiểm duyệt nền tảng.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: reviewId, content/reason, category/severity, status/decision theo hành động.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: CUSTOMER theo chính chủ, tài khoản tách vận hành; OWNER theo doanh nghiệp và thao tác được cấp; PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-09

- ReviewsController.reply: `@Post(':id/reply')`; `@Roles('BUSINESS_OWNER')`; `@RequirePermission('review:moderate:tenant')`
- ReviewsController.report: `@Post(':id/report')`; `@Roles('CUSTOMER', 'BUSINESS_OWNER')`; `@RequirePermission('review:read:public', 'review:report:tenant')`
- ReviewsController.moderate: `@Patch(':id/moderate')`; `@Roles('PLATFORM_ADMIN')`; `@RequirePermission('review:moderate:platform')`
- ReviewsController.appeal: `@Post(':id/appeals')`; `@Roles('CUSTOMER', 'BUSINESS_OWNER')`; `@RequirePermission('review:create:self', 'review:moderate:tenant')`
- ReviewsController.resolveAppeal: `@Patch('appeals/:appealId')`; `@Roles('PLATFORM_ADMIN')`; `@RequirePermission('review:moderate:platform')`

### Bằng chứng và mức triển khai

- [ReviewsController.reply](../../../src/reviews/reviews.controller.ts) (dòng 163)
- [ReviewsController.report](../../../src/reviews/reviews.controller.ts) (dòng 147)
- [ReviewsController.moderate](../../../src/reviews/reviews.controller.ts) (dòng 189)
- [ReviewsController.appeal](../../../src/reviews/reviews.controller.ts) (dòng 204)
- [ReviewsController.resolveAppeal](../../../src/reviews/reviews.controller.ts) (dòng 216)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonReviews.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonReviews.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminReviewsModeration.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminReviewsModeration.jsx)
- Schema: `BusinessComment`, `ReviewReport`, `ReviewAppeal`, `ReviewModerationEvent`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-31 — Theo dõi thông báo cá nhân

- Mục tiêu: Theo dõi thông báo cá nhân, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-06, BUC-12.
- Actor tham gia: Khách hàng (CUSTOMER); Chủ doanh nghiệp (BUSINESS_OWNER); Lễ tân (RECEPTIONIST); Chuyên viên (STAFF); Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu theo dõi thông báo cá nhân.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống trả số chưa đọc; actionUrl chỉ là đường dẫn gợi ý, không cấp quyền.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Actor mở hộp thông báo; hệ thống chỉ truy vấn user hiện tại.
2. Actor đọc hoặc đánh dấu đã đọc; hệ thống kiểm tra ownership.
3. Hệ thống trả số chưa đọc; actionUrl chỉ là đường dẫn gợi ý, không cấp quyền.

### Thay thế và ngoại lệ

- 1a. Không có thông báo: danh sách rỗng.
- 3a. Token thiết bị có lưu không chứng minh đã có dịch vụ push production.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: Bộ lọc và notificationId.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: CUSTOMER theo chính chủ, tài khoản tách vận hành; OWNER theo doanh nghiệp và thao tác được cấp; RECEPTIONIST theo chi nhánh và hành động tại quầy; STAFF theo assignment/tài khoản của mình; PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-01

- NotificationsController.findMy: `@Get()`; `@RequirePermission('notification:read:self')`
- NotificationsController.markAsRead: `@Patch(':id/read')`; `@RequirePermission('notification:read:self')`

### Bằng chứng và mức triển khai

- [NotificationsController.findMy](../../../src/notifications/notifications.controller.ts) (dòng 28)
- [NotificationsController.markAsRead](../../../src/notifications/notifications.controller.ts) (dòng 65)
- [NotificationsService.findByUser](../../../src/notifications/notifications.service.ts) (dòng 12)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerNotifications.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerNotifications.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonNotifications.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonNotifications.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminNotifications.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminNotifications.jsx)
- Schema: `Notification`, `NotificationOutbox`, `DeviceToken`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai in-app qua web/API; push ngoài chưa xác minh.
- Mobile: MessagesScreen dùng notificationsApi, không phải chat thời gian thực..
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-32 — Kiểm soát quyền dữ liệu

- Mục tiêu: Kiểm soát quyền dữ liệu, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-12.
- Actor tham gia: Khách hàng (CUSTOMER). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu kiểm soát quyền dữ liệu.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Khách tải gói bằng token theo thời hạn hoặc theo dõi yêu cầu.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Khách xem dữ liệu/quyền của mình và chọn yêu cầu hoặc ưu tiên tiếp thị.
2. Hệ thống kiểm tra quyền/mật khẩu hiện tại khi xuất; tạo yêu cầu/gói xuất.
3. Khách tải gói bằng token theo thời hạn hoặc theo dõi yêu cầu.

### Thay thế và ngoại lệ

- 2a. Sai mật khẩu/token hoặc gói hết hạn: từ chối.
- 3a. Tạo yêu cầu xóa không chứng minh hệ thống đã hoàn tất xóa.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: Loại yêu cầu, lý do; currentPassword khi export; marketing preferences.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: CUSTOMER theo chính chủ, tài khoản tách vận hành.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-01

- PrivacyController.createDataRequest: `@Post('data-requests')`; `@Roles('CUSTOMER')`; `@RequirePermission('privacy_request:manage:self')`
- PrivacyController.export: `@Post('exports')`; `@Roles('CUSTOMER')`; `@RequirePermission('privacy_request:manage:self')`

### Bằng chứng và mức triển khai

- [PrivacyController.createDataRequest](../../../src/privacy/privacy.controller.ts) (dòng 33)
- [PrivacyController.export](../../../src/privacy/privacy.controller.ts) (dòng 67)
- [PrivacyCenterService.createExport](../../../src/privacy/privacy-center.service.ts) (dòng 204)
- [PrivacyCenterService.updateMarketingPreferences](../../../src/privacy/privacy-center.service.ts) (dòng 176)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/PrivacySettings.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/PrivacySettings.jsx)
- Schema: `DataSubjectRequest`, `PrivacyExportPackage`, `MarketingPreference`; xem từ điển dữ liệu.
- Mức triển khai: Triển khai một phần: tiếp nhận/yêu cầu và export có API/UI; chưa thấy quy trình xử lý mọi quyền dữ liệu end-to-end..
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-33 — Giải quyết tác động vận hành

- Mục tiêu: Giải quyết tác động vận hành, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-09.
- Actor tham gia: Chủ doanh nghiệp (BUSINESS_OWNER); Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu giải quyết tác động vận hành.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống chỉ hoàn tất hồ sơ khi thỏa điều kiện; thay đổi trạng thái cơ sở kiểm tra tác động lần cuối.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Actor xem hồ sơ tác động trong scope.
2. Actor chọn phương án cho từng mục; hệ thống kiểm tra quyền hành động và dữ liệu hiện tại.
3. Hệ thống chỉ hoàn tất hồ sơ khi thỏa điều kiện; thay đổi trạng thái cơ sở kiểm tra tác động lần cuối.

### Thay thế và ngoại lệ

- 2a. Lễ tân không được quản lý hồ sơ tác động; controller chỉ cho OWNER/PLATFORM_ADMIN.
- 3a. Có lịch mới hoặc mục chưa giải quyết: chặn hoàn tất/thay đổi.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: caseId, itemId, action và dữ liệu phương án được service cho phép.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: OWNER theo doanh nghiệp và thao tác được cấp; PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-11

- ImpactController.resolve: `@Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')`; `@RequirePermission('booking:update:tenant', 'booking:read:platform')`; `@Patch(':id/items/:itemId')`
- ImpactController.complete: `@Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')`; `@RequirePermission('booking:update:tenant', 'booking:read:platform')`; `@Post(':id/complete')`

### Bằng chứng và mức triển khai

- [ImpactController.resolve](../../../src/operations/impact.controller.ts) (dòng 40)
- [ImpactController.complete](../../../src/operations/impact.controller.ts) (dòng 52)
- [ImpactService.resolveItem](../../../src/operations/impact.service.ts) (dòng 50)
- [BranchStateService.transition](../../../src/branches/branch-state.service.ts) (dòng 65)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonOperations.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonOperations.jsx)
- Schema: `OperationalImpactCase`, `OperationalImpactItem`, `BranchStateTransition`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-34 — Đề nghị và tiếp nhận chuyển chủ

- Mục tiêu: Đề nghị và tiếp nhận chuyển chủ, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-10.
- Actor tham gia: Chủ doanh nghiệp (BUSINESS_OWNER); Lễ tân (RECEPTIONIST); Chuyên viên (STAFF); Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu đề nghị và tiếp nhận chuyển chủ.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Chủ mới hợp lệ xác nhận; hệ thống chuyển hồ sơ để xem xét.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Chủ hiện tại đề nghị chủ mới và thời điểm.
2. Hệ thống kiểm tra tài khoản chủ mới, khác chủ cũ và không xung đột CUSTOMER.
3. Chủ mới hợp lệ xác nhận; hệ thống chuyển hồ sơ để xem xét.

### Thay thế và ngoại lệ

- 2a. CUSTOMER làm chủ mới bị chặn.
- 3a. Web đặt nút nhận ở CustomerBenefits trong khi API accept yêu cầu phiên và đúng người nhận; không tuyên bố luồng này hoàn chỉnh.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: newOwnerEmail, effectiveAt tương lai, reason và transferId.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: OWNER theo doanh nghiệp và thao tác được cấp; RECEPTIONIST theo chi nhánh và hành động tại quầy; STAFF theo assignment/tài khoản của mình; PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-01; GAP-01

- OwnershipController.create: `@Post()`; `@Roles('BUSINESS_OWNER')`; `@RequirePermission('business:update:tenant')`
- OwnershipController.accept: `@Patch(':id/accept')`

### Bằng chứng và mức triển khai

- [OwnershipController.create](../../../src/ownership/ownership.controller.ts) (dòng 14)
- [OwnershipController.accept](../../../src/ownership/ownership.controller.ts) (dòng 35)
- [OwnershipService.create](../../../src/ownership/ownership.service.ts) (dòng 13)
- [OwnershipService.accept](../../../src/ownership/ownership.service.ts) (dòng 55)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonOperations.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonOperations.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerBenefits.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerBenefits.jsx)
- Schema: `OwnershipTransfer`, `Business`, `BusinessOwnerProfile`; xem từ điển dữ liệu.
- Mức triển khai: Triển khai một phần: backend có xử lý, web lệch workspace khi nhận chuyển giao; create yêu cầu OWNER, accept không có Roles decorator và kiểm tra newOwnerUserId..
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-35 — Thẩm định và thực hiện chuyển chủ

- Mục tiêu: Thẩm định và thực hiện chuyển chủ, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-10.
- Actor tham gia: Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu thẩm định và thực hiện chuyển chủ.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Actor/hệ thống đến hạn thực hiện; service kiểm tra trạng thái/hiệu lực và cập nhật quyền, giữ lịch sử.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Quản trị kiểm tra hồ sơ chuyển giao và phiên bản pháp nhân/payout.
2. Actor yêu cầu bổ sung hoặc phê duyệt theo điều kiện.
3. Actor/hệ thống đến hạn thực hiện; service kiểm tra trạng thái/hiệu lực và cập nhật quyền, giữ lịch sử.

### Thay thế và ngoại lệ

- 2a. Chưa đủ căn cứ: NEED_MORE_INFO hoặc REJECTED.
- 3a. Điều kiện thực hiện chưa đáp ứng: chưa chuyển chủ.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: transferId, quyết định, căn cứ xác minh; phiên bản payout chứa dữ liệu bảo vệ.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-01; GAP-01

- OwnershipController.review: `@Patch(':id/review')`; `@Roles('PLATFORM_ADMIN')`; `@RequirePermission('business:review:platform')`
- OwnershipController.execute: `@Post(':id/execute')`; `@Roles('PLATFORM_ADMIN')`; `@RequirePermission('business:review:platform')`

### Bằng chứng và mức triển khai

- [OwnershipController.review](../../../src/ownership/ownership.controller.ts) (dòng 63)
- [OwnershipController.execute](../../../src/ownership/ownership.controller.ts) (dòng 84)
- [OwnershipService.execute](../../../src/ownership/ownership.service.ts) (dòng 148)
- [OwnershipService.verifyVersion](../../../src/ownership/ownership.service.ts) (dòng 335)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminOwnership.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminOwnership.jsx)
- Schema: `OwnershipTransfer`, `OwnershipHistory`, `LegalEntityVersion`, `PayoutAccountVersion`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-36 — Xem hiệu quả và đối soát

- Mục tiêu: Xem hiệu quả và đối soát, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-05, BUC-11.
- Actor tham gia: Chủ doanh nghiệp (BUSINESS_OWNER); Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu xem hiệu quả và đối soát.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Actor xem kết quả, sổ cái/bảng kê khi có quyền; nền tảng quản lý trạng thái bảng kê.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Actor chọn khoảng thời gian/phạm vi báo cáo.
2. Hệ thống kiểm tra scope và tổng hợp dữ liệu theo phương thức báo cáo.
3. Actor xem kết quả, sổ cái/bảng kê khi có quyền; nền tảng quản lý trạng thái bảng kê.

### Thay thế và ngoại lệ

- 1a. Scope ngoài quyền: không trả dữ liệu.
- 3a. Bảng kê phí nền tảng còn hoạt động, không phải hóa đơn khách hàng đã gỡ.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: from/to, businessId/branchId; thao tác bảng kê dành riêng quyền platform.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: OWNER theo doanh nghiệp và thao tác được cấp; PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-08

- ReportsController.getRevenue: `@Get('revenue')`; `@Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER')`; `@RequirePermission( 'report:revenue:platform', 'report:revenue:tenant', )`
- ReportsController.getDashboardOverview: `@Get('overview')`; `@Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER')`; `@RequirePermission( 'report:overview:platform', 'report:overview:tenant', )`
- PaymentsController.ledger: `@Get('ledger')`; `@Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')`; `@RequirePermission('financial_ledger:read:tenant', 'financial_ledger:read:platform')`
- PaymentsController.statements: `@Get('platform-statements')`; `@Roles('BUSINESS_OWNER', 'PLATFORM_ADMIN')`; `@RequirePermission('platform_statement:read:tenant', 'platform_statement:manage:platform')`

### Bằng chứng và mức triển khai

- [ReportsController.getRevenue](../../../src/reports/reports.controller.ts) (dòng 62)
- [ReportsController.getDashboardOverview](../../../src/reports/reports.controller.ts) (dòng 25)
- [PaymentsController.ledger](../../../src/payments/payments.controller.ts) (dòng 111)
- [PaymentsController.statements](../../../src/payments/payments.controller.ts) (dòng 135)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonStats.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonStats.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminReports.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminReports.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentCorePanels.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentCorePanels.jsx)
- Schema: `FinancialLedgerEntry`, `PlatformStatement`, `PlatformStatementLine`, `Booking`, `Payment`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-37 — Quản trị truy cập người dùng

- Mục tiêu: Quản trị truy cập người dùng, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-11.
- Actor tham gia: Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu quản trị truy cập người dùng.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống lưu quyết định và xử lý phiên theo luồng triển khai.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Quản trị xem người dùng và các grant.
2. Actor đình chỉ/khôi phục hoặc điều chỉnh quyền; hệ thống kiểm tra scope và tương thích role.
3. Hệ thống lưu quyết định và xử lý phiên theo luồng triển khai.

### Thay thế và ngoại lệ

- 2a. Grant CUSTOMER kết hợp vận hành: từ chối.
- 2b. Không suy PLATFORM_ADMIN kế thừa quyền vận hành của salon.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: userId, roleCode và scope, trạng thái/permission theo DTO.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-01

- UsersController.suspend: `@Post(':id/suspend')`; `@Roles('PLATFORM_ADMIN')`; `@RequirePermission('user:suspend:platform')`
- UsersController.assignRole: `@Post(':id/roles')`; `@Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER')`; `@RequirePermission('user:role_assign:platform', 'user:role_assign:tenant')`
- UsersController.grantDirectPermission: `@Post(':id/permissions')`; `@Roles('PLATFORM_ADMIN')`; `@RequirePermission('user:role_assign:platform')`

### Bằng chứng và mức triển khai

- [UsersController.suspend](../../../src/users/users.controller.ts) (dòng 109)
- [UsersController.assignRole](../../../src/users/users.controller.ts) (dòng 160)
- [UsersController.grantDirectPermission](../../../src/users/users.controller.ts) (dòng 128)
- [UsersService.assignRole](../../../src/users/users.service.ts) (dòng 274)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminUsers.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminUsers.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminEntityDetails.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminEntityDetails.jsx)
- Schema: `User`, `UserRole`, `UserPermission`, `Role`, `Permission`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-38 — Quản trị danh mục và chính sách

- Mục tiêu: Quản trị danh mục và chính sách, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-08, BUC-11.
- Actor tham gia: Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu quản trị danh mục và chính sách.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống lưu cấu hình; policy effective được các luồng nghiệp vụ đọc.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Quản trị xem định nghĩa dịch vụ chuẩn/chính sách.
2. Actor thay đổi cấu hình; hệ thống kiểm tra kiểu, giới hạn và quyền.
3. Hệ thống lưu cấu hình; policy effective được các luồng nghiệp vụ đọc.

### Thay thế và ngoại lệ

- 2a. Giá trị sai giới hạn: từ chối.
- 1a. Trang taxonomy có source nhưng cần xác minh route/mount; không đồng nhất file page với route được truy cập.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: Mã dịch vụ chuẩn, settings hợp lệ; không đổi quy tắc cố định 4 giờ/15 phút qua settings.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-10

- ServicesController.createCanonical: `@Post('canonical')`; `@Roles('PLATFORM_ADMIN')`; `@RequirePermission('canonical_service:manage:platform')`
- AdminController.updateSettings: `@Patch('settings')`; `@Roles('PLATFORM_ADMIN')`; `@RequirePermission('platform_setting:manage:platform')`

### Bằng chứng và mức triển khai

- [ServicesController.createCanonical](../../../src/services/services.controller.ts) (dòng 111)
- [AdminController.updateSettings](../../../src/admin/admin.controller.ts) (dòng 39)
- [PlatformSettingsService.validate](../../../src/platform-settings/platform-settings.service.ts) (dòng 78)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminServiceTaxonomy.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminServiceTaxonomy.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminSettings.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminSettings.jsx)
- Schema: `CanonicalService`, `ServiceCategory`, `PlatformSetting`; xem từ điển dữ liệu.
- Mức triển khai: API có triển khai; web settings đã nối, taxonomy route cần xác minh (GAP-04)..
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-39 — Giám sát và xử lý độ tin cậy

- Mục tiêu: Giám sát và xử lý độ tin cậy, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-11.
- Actor tham gia: Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu giám sát và xử lý độ tin cậy.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Hệ thống ghi hành động/quyết định để truy nguyên.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Quản trị xem chỉ số tin cậy và dấu vết có quyền.
2. Actor chọn biện pháp có căn cứ; hệ thống kiểm tra dữ liệu và phạm vi.
3. Hệ thống ghi hành động/quyết định để truy nguyên.

### Thay thế và ngoại lệ

- 2a. Điều kiện/ràng buộc chưa thỏa: từ chối.
- 3a. Snapshot không tự chứng minh cơ sở có sai phạm.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: businessId, action, reason và dữ liệu theo service.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-10

- AdminController.snapshots: `@Get('trust-snapshots')`; `@Roles('PLATFORM_ADMIN')`; `@RequirePermission('admin:trust_snapshot:read')`
- AdminController.trustAction: `@Post('trust-actions')`; `@Roles('PLATFORM_ADMIN')`; `@RequirePermission('admin:trust_snapshot:manage')`
- AdminController.auditLogs: `@Get('audit-logs')`; `@Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER')`; `@RequirePermission('audit:read:platform', 'audit:read:tenant')`

### Bằng chứng và mức triển khai

- [AdminController.snapshots](../../../src/admin/admin.controller.ts) (dòng 57)
- [AdminController.trustAction](../../../src/admin/admin.controller.ts) (dòng 78)
- [AdminController.auditLogs](../../../src/admin/admin.controller.ts) (dòng 91)
- [TrustSnapshotService.performAction](../../../src/admin/trust-snapshot.service.ts) (dòng 192)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminSalons.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminSalons.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminAudit.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Admin/AdminAudit.jsx)
- Schema: `SalonTrustSnapshot`, `TrustAction`, `AuditLog`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

## SUC-40 — Lưu và sử dụng tài liệu hình ảnh

- Mục tiêu: Lưu và sử dụng tài liệu hình ảnh, đạt kết quả mô tả ở bước cuối.
- BUC: BUC-07, BUC-08, BUC-12.
- Actor tham gia: Khách hàng (CUSTOMER); Chủ doanh nghiệp (BUSINESS_OWNER); Lễ tân (RECEPTIONIST); Chuyên viên (STAFF); Quản trị nền tảng (PLATFORM_ADMIN). Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.
- Trigger: actor phát sinh nhu cầu lưu và sử dụng tài liệu hình ảnh.
- Tiền điều kiện: Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động. Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.
- Hậu điều kiện thành công: Actor gắn media vào hồ sơ; nội dung private phải qua kiểm tra quyền khi đọc.
- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.

### Luồng chính

1. Actor chọn tài liệu/ảnh thuộc phạm vi được phép.
2. Hệ thống kiểm tra upload và lưu media cùng quyền truy cập.
3. Actor gắn media vào hồ sơ; nội dung private phải qua kiểm tra quyền khi đọc.

### Thay thế và ngoại lệ

- 2a. Sai MIME/kích thước/phạm vi: từ chối.
- 3a. Không coi ảnh minh họa AI là bằng chứng cơ sở thật.

### Dữ liệu, quyền và trạng thái

- Dữ liệu vào/validation: File, entity/purpose metadata; theo media DTO/service.
- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.
- Scope: CUSTOMER theo chính chủ, tài khoản tách vận hành; OWNER theo doanh nghiệp và thao tác được cấp; RECEPTIONIST theo chi nhánh và hành động tại quầy; STAFF theo assignment/tài khoản của mình; PLATFORM_ADMIN chỉ hành động platform được cấp.
- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.
- Quy tắc: BR-01, BR-10

- MediaController.upload: `@Post('upload')`; `@Roles('PLATFORM_ADMIN', 'BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'CUSTOMER')`; `@RequirePermission('user:update:self')`
- MediaController.privateContent: `@Get(':id/content')`

### Bằng chứng và mức triển khai

- [MediaController.upload](../../../src/media/media.controller.ts) (dòng 29)
- [MediaController.privateContent](../../../src/media/media.controller.ts) (dòng 54)
- [MediaService.upload](../../../src/media/media.service.ts) (dòng 39)
- [MediaService.readForUser](../../../src/media/media.service.ts) (dòng 117)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/BranchOnboardingWizard.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/BranchOnboardingWizard.jsx)
- Web: [../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/ProfileSettings.jsx](../../../../beauty-booking-web-main/beauty-booking-web-main/src/pages/ProfileSettings.jsx)
- Schema: `MediaFile`, `BusinessImage`, `BranchImage`, `ServiceImage`, `StaffImage`; xem từ điển dữ liệu.
- Mức triển khai: Đã triển khai qua code web/API; chưa kiểm chứng runtime.
- Mobile: Chưa xác minh kênh mobile cho mục này.
- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.

