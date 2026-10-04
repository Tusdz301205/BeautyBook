# Đặc tả Use Case nghiệp vụ

Ranh giới: hoạt động phối hợp của BeautyBook và cơ sở tham gia. Khách/đại diện đăng ký là business actor bên ngoài; chủ cơ sở, lễ tân, chuyên viên và điều phối nền tảng là business worker trong hoạt động. Một người có thể mang vai trò nghiệp vụ khác nhau theo ngữ cảnh, không tạo kế thừa role phần mềm. Tổng quan chọn hành trình giá trị; các hình chi tiết bao phủ toàn bộ BUC.

## BUC-01 — Tìm dịch vụ phù hợp

- Mục tiêu: Khách có thông tin để lựa chọn cơ sở và dịch vụ.
- Actor chính/đối tượng thụ hưởng: Khách.
- Worker/bên hỗ trợ: Cơ sở cung cấp thông tin.
- Trigger: Khách có nhu cầu làm đẹp.
- Tiền điều kiện: nhu cầu hợp lệ trong phạm vi hoạt động mô tả; thông tin, cam kết hoặc hồ sơ ở bước đầu tồn tại. Điều kiện tài khoản cụ thể thuộc đặc tả SUC, không biến thành bước kinh doanh.
- Hậu điều kiện thành công: Khách có thông tin để lựa chọn cơ sở và dịch vụ.
- Bảo đảm thất bại: không coi đề nghị đang chờ/từ chối là cam kết đã hoàn tất; giữ lịch sử theo phần triển khai có căn cứ.

### Luồng chính

1. Khách nêu nhu cầu và khu vực.
2. BeautyBook cung cấp các cơ sở, dịch vụ và nhận xét đủ điều kiện công khai.
3. Khách so sánh và chọn phương án phù hợp.

### Thay thế/ngoại lệ

- 2a. Không có kết quả: khách điều chỉnh tiêu chí; không cam kết có lịch trống.

### Quy tắc và trách nhiệm

Thông tin công khai không đồng nghĩa còn năng lực nhận lịch.

Cơ sở cung cấp thông tin thực hiện đúng phần việc ở từng bước; Khách cung cấp nhu cầu/căn cứ, không tự có thẩm quyền của worker. Quyết định thẩm quyền cụ thể được ràng buộc tại SUC-01, SUC-12.

### Bằng chứng và giới hạn

- [ServicesController.search](../../../src/services/services.controller.ts) (dòng 70)
- [BranchesController.findAll](../../../src/branches/branches.controller.ts) (dòng 59)
- [StaffController.findPublicOne](../../../src/staff/staff.controller.ts) (dòng 174)
- [SavedServicesController.list](../../../src/saved-services/saved-services.controller.ts) (dòng 14)
- [SavedServicesController.save](../../../src/saved-services/saved-services.controller.ts) (dòng 19)
- [SavedServicesService.save](../../../src/saved-services/saved-services.service.ts) (dòng 56)

Ánh xạ SUC: SUC-01, SUC-12. Đây là mô hình phân tích từ code, chưa được phỏng vấn xác nhận với đơn vị vận hành. Các giới hạn triển khai trong SUC liên quan vẫn áp dụng, đặc biệt chuyển chủ/quyền dữ liệu/gói buổi.

## BUC-02 — Thỏa thuận lịch phục vụ

- Mục tiêu: Khách và cơ sở có lịch phục vụ được ghi nhận theo chính sách xác nhận.
- Actor chính/đối tượng thụ hưởng: Khách.
- Worker/bên hỗ trợ: Chủ cơ sở; Lễ tân.
- Trigger: Khách muốn đặt dịch vụ hoặc liên hệ quầy.
- Tiền điều kiện: nhu cầu hợp lệ trong phạm vi hoạt động mô tả; thông tin, cam kết hoặc hồ sơ ở bước đầu tồn tại. Điều kiện tài khoản cụ thể thuộc đặc tả SUC, không biến thành bước kinh doanh.
- Hậu điều kiện thành công: Khách và cơ sở có lịch phục vụ được ghi nhận theo chính sách xác nhận.
- Bảo đảm thất bại: không coi đề nghị đang chờ/từ chối là cam kết đã hoàn tất; giữ lịch sử theo phần triển khai có căn cứ.

### Luồng chính

1. Khách và cơ sở xác định dịch vụ, chuyên viên và thời điểm.
2. Cơ sở kiểm tra khả năng đáp ứng và điều kiện đặt lịch.
3. Lịch được ghi nhận chờ xác nhận hoặc đã xác nhận; các bên theo dõi kết quả.

### Thay thế/ngoại lệ

- 2a. Hết chỗ hoặc khách bị hạn chế tự đặt: chọn phương án khác hoặc liên hệ cơ sở.
- 3a. Cơ sở xác nhận thủ công: lịch chưa được coi là chắc chắn trước khi duyệt.

### Quy tắc và trách nhiệm

BR-01, BR-02, BR-03; nhân sự không dùng tài khoản vận hành để tự đặt như khách.

Chủ cơ sở; Lễ tân thực hiện đúng phần việc ở từng bước; Khách cung cấp nhu cầu/căn cứ, không tự có thẩm quyền của worker. Quyết định thẩm quyền cụ thể được ràng buộc tại SUC-05, SUC-06, SUC-07, SUC-08, SUC-11, SUC-13, SUC-14.

### Bằng chứng và giới hạn

- [BookingsController.create](../../../src/bookings/bookings.controller.ts) (dòng 237)
- [BookingsController.createGuest](../../../src/bookings/bookings.controller.ts) (dòng 199)
- [BookingsService.create](../../../src/bookings/bookings.service.ts) (dòng 817)
- [BookingsController.getAvailableSlots](../../../src/bookings/bookings.controller.ts) (dòng 724)
- [BookingsService.getAvailableSlots](../../../src/bookings/bookings.service.ts) (dòng 1917)
- [BookingsController.previewPrice](../../../src/bookings/bookings.controller.ts) (dòng 308)
- [VouchersService.preview](../../../src/bookings/vouchers.service.ts) (dòng 15)

Ánh xạ SUC: SUC-05, SUC-06, SUC-07, SUC-08, SUC-11, SUC-13, SUC-14. Đây là mô hình phân tích từ code, chưa được phỏng vấn xác nhận với đơn vị vận hành. Các giới hạn triển khai trong SUC liên quan vẫn áp dụng, đặc biệt chuyển chủ/quyền dữ liệu/gói buổi.

## BUC-03 — Điều chỉnh cam kết lịch hẹn

- Mục tiêu: Yêu cầu đổi/hủy được xử lý theo thẩm quyền và bảo toàn lịch sử.
- Actor chính/đối tượng thụ hưởng: Khách.
- Worker/bên hỗ trợ: Chủ cơ sở; Lễ tân.
- Trigger: Một bên không thể giữ lịch đã thỏa thuận.
- Tiền điều kiện: nhu cầu hợp lệ trong phạm vi hoạt động mô tả; thông tin, cam kết hoặc hồ sơ ở bước đầu tồn tại. Điều kiện tài khoản cụ thể thuộc đặc tả SUC, không biến thành bước kinh doanh.
- Hậu điều kiện thành công: Yêu cầu đổi/hủy được xử lý theo thẩm quyền và bảo toàn lịch sử.
- Bảo đảm thất bại: không coi đề nghị đang chờ/từ chối là cam kết đã hoàn tất; giữ lịch sử theo phần triển khai có căn cứ.

### Luồng chính

1. Khách thông báo nhu cầu đổi hoặc hủy.
2. Cơ sở xem điều kiện, thời điểm và năng lực thay thế.
3. Các bên nhận kết quả; lịch và quyền lợi được điều chỉnh theo kết quả xử lý.

### Thay thế/ngoại lệ

- 2a. Tự hủy đủ sớm: không cần cơ sở duyệt.
- 2b. Hủy sát giờ: ghi nhận tại lúc gửi yêu cầu; từ chối/hết hạn không tự xóa vi phạm.
- 3a. Yêu cầu hết hạn: cam kết lịch cũ chưa được thay đổi bởi yêu cầu.

### Quy tắc và trách nhiệm

BR-04, BR-05, BR-06.

Chủ cơ sở; Lễ tân thực hiện đúng phần việc ở từng bước; Khách cung cấp nhu cầu/căn cứ, không tự có thẩm quyền của worker. Quyết định thẩm quyền cụ thể được ràng buộc tại SUC-08, SUC-09, SUC-10, SUC-15.

### Bằng chứng và giới hạn

- [BookingsController.myAppointments](../../../src/bookings/bookings.controller.ts) (dòng 545)
- [BookingsController.findOne](../../../src/bookings/bookings.controller.ts) (dòng 858)
- [BookingsController.selfBookingPolicy](../../../src/bookings/bookings.controller.ts) (dòng 185)
- [BookingsController.updateStatus](../../../src/bookings/bookings.controller.ts) (dòng 977)
- [BookingsService.updateStatus](../../../src/bookings/bookings.service.ts) (dòng 421)
- [BookingsController.createChangeRequest](../../../src/bookings/bookings.controller.ts) (dòng 1186)
- [ChangeRequestsService.create](../../../src/bookings/change-requests.service.ts) (dòng 56)

Ánh xạ SUC: SUC-08, SUC-09, SUC-10, SUC-15. Đây là mô hình phân tích từ code, chưa được phỏng vấn xác nhận với đơn vị vận hành. Các giới hạn triển khai trong SUC liên quan vẫn áp dụng, đặc biệt chuyển chủ/quyền dữ liệu/gói buổi.

## BUC-04 — Tiếp nhận và hoàn tất phục vụ

- Mục tiêu: Cơ sở biết khách đã đến và từng phần dịch vụ đã thực hiện.
- Actor chính/đối tượng thụ hưởng: Khách.
- Worker/bên hỗ trợ: Lễ tân; Chuyên viên; Chủ cơ sở.
- Trigger: Đến thời điểm phục vụ.
- Tiền điều kiện: nhu cầu hợp lệ trong phạm vi hoạt động mô tả; thông tin, cam kết hoặc hồ sơ ở bước đầu tồn tại. Điều kiện tài khoản cụ thể thuộc đặc tả SUC, không biến thành bước kinh doanh.
- Hậu điều kiện thành công: Cơ sở biết khách đã đến và từng phần dịch vụ đã thực hiện.
- Bảo đảm thất bại: không coi đề nghị đang chờ/từ chối là cam kết đã hoàn tất; giữ lịch sử theo phần triển khai có căn cứ.

### Luồng chính

1. Lễ tân xác nhận khách đến hoặc xác nhận vắng mặt theo điều kiện.
2. Chuyên viên được phân công tiếp nhận phần việc và bắt đầu thực hiện.
3. Chuyên viên/cơ sở ghi nhận hoàn tất; lịch phản ánh tiến độ.

### Thay thế/ngoại lệ

- 1a. Khách chưa đến sau thời gian ân hạn: chỉ người có thẩm quyền xác nhận no-show.
- 2a. Chuyên viên không còn khả dụng: cơ sở phân công lại theo điều kiện.

### Quy tắc và trách nhiệm

BR-06, BR-07; hàng đợi phục vụ khác danh sách chờ đã gỡ.

Lễ tân; Chuyên viên; Chủ cơ sở thực hiện đúng phần việc ở từng bước; Khách cung cấp nhu cầu/căn cứ, không tự có thẩm quyền của worker. Quyết định thẩm quyền cụ thể được ràng buộc tại SUC-14, SUC-16, SUC-17.

### Bằng chứng và giới hạn

- [BookingsController.moveBooking](../../../src/bookings/bookings.controller.ts) (dòng 1072)
- [BookingsController.assignStaff](../../../src/bookings/bookings.controller.ts) (dòng 1105)
- [BookingsController.addBookingItem](../../../src/bookings/bookings.controller.ts) (dòng 1118)
- [BookingsService.assignStaff](../../../src/bookings/bookings.service.ts) (dòng 2488)
- [BookingsController.checkin](../../../src/bookings/bookings.controller.ts) (dòng 1297)
- [BookingsController.updateStatus](../../../src/bookings/bookings.controller.ts) (dòng 977)
- [BookingsService.checkin](../../../src/bookings/bookings.service.ts) (dòng 2797)

Ánh xạ SUC: SUC-14, SUC-16, SUC-17. Đây là mô hình phân tích từ code, chưa được phỏng vấn xác nhận với đơn vị vận hành. Các giới hạn triển khai trong SUC liên quan vẫn áp dụng, đặc biệt chuyển chủ/quyền dữ liệu/gói buổi.

## BUC-05 — Quyết toán khoản phải trả

- Mục tiêu: Khoản thu và hoàn trả có căn cứ, đúng phạm vi và không vượt số dư.
- Actor chính/đối tượng thụ hưởng: Khách.
- Worker/bên hỗ trợ: Lễ tân; Chủ cơ sở; Quản trị nền tảng.
- Trigger: Phát sinh nghĩa vụ thu tiền hoặc yêu cầu hoàn tiền.
- Tiền điều kiện: nhu cầu hợp lệ trong phạm vi hoạt động mô tả; thông tin, cam kết hoặc hồ sơ ở bước đầu tồn tại. Điều kiện tài khoản cụ thể thuộc đặc tả SUC, không biến thành bước kinh doanh.
- Hậu điều kiện thành công: Khoản thu và hoàn trả có căn cứ, đúng phạm vi và không vượt số dư.
- Bảo đảm thất bại: không coi đề nghị đang chờ/từ chối là cam kết đã hoàn tất; giữ lịch sử theo phần triển khai có căn cứ.

### Luồng chính

1. Cơ sở đối chiếu khoản phải trả và tiếp nhận tiền/chứng từ.
2. Nhân sự có quyền xác minh giao dịch; hệ thống ghi nhận khoản đã trả.
3. Khi cần hoàn tiền, chủ cơ sở/nền tảng lập và người khác duyệt; nền tảng ghi nhận kết quả xử lý.

### Thay thế/ngoại lệ

- 2a. Chuyển khoản chưa xác minh: không coi là đã thu.
- 3a. Hoàn tiền thất bại: giữ trạng thái thất bại để xử lý tiếp; không báo đã hoàn.

### Quy tắc và trách nhiệm

BR-08; không có phát hành hóa đơn/phiếu thu hay cổng thanh toán trực tuyến.

Lễ tân; Chủ cơ sở; Quản trị nền tảng thực hiện đúng phần việc ở từng bước; Khách cung cấp nhu cầu/căn cứ, không tự có thẩm quyền của worker. Quyết định thẩm quyền cụ thể được ràng buộc tại SUC-18, SUC-19, SUC-20, SUC-21, SUC-36.

### Bằng chứng và giới hạn

- [PaymentsController.collect](../../../src/payments/payments.controller.ts) (dòng 36)
- [PaymentsController.verifyTransaction](../../../src/payments/payments.controller.ts) (dòng 61)
- [PaymentsService.collect](../../../src/payments/payments.service.ts) (dòng 149)
- [PaymentsService.verifyTransaction](../../../src/payments/payments.service.ts) (dòng 735)
- [PaymentsController.requestRefund](../../../src/payments/payments.controller.ts) (dòng 227)
- [PaymentsController.review](../../../src/payments/payments.controller.ts) (dòng 239)
- [PaymentsService.requestRefund](../../../src/payments/payments.service.ts) (dòng 363)

Ánh xạ SUC: SUC-18, SUC-19, SUC-20, SUC-21, SUC-36. Đây là mô hình phân tích từ code, chưa được phỏng vấn xác nhận với đơn vị vận hành. Các giới hạn triển khai trong SUC liên quan vẫn áp dụng, đặc biệt chuyển chủ/quyền dữ liệu/gói buổi.

## BUC-06 — Duy trì quan hệ với khách

- Mục tiêu: Khách tiếp tục dùng dịch vụ và cơ sở có phản hồi/ưu đãi phù hợp.
- Actor chính/đối tượng thụ hưởng: Khách.
- Worker/bên hỗ trợ: Chủ cơ sở; Quản trị nền tảng.
- Trigger: Có nhu cầu quay lại hoặc phản hồi sau phục vụ.
- Tiền điều kiện: nhu cầu hợp lệ trong phạm vi hoạt động mô tả; thông tin, cam kết hoặc hồ sơ ở bước đầu tồn tại. Điều kiện tài khoản cụ thể thuộc đặc tả SUC, không biến thành bước kinh doanh.
- Hậu điều kiện thành công: Khách tiếp tục dùng dịch vụ và cơ sở có phản hồi/ưu đãi phù hợp.
- Bảo đảm thất bại: không coi đề nghị đang chờ/từ chối là cam kết đã hoàn tất; giữ lịch sử theo phần triển khai có căn cứ.

### Luồng chính

1. Cơ sở thiết lập ưu đãi hợp lệ cho đối tượng/phạm vi áp dụng.
2. Khách lựa chọn ưu đãi, lưu dịch vụ hoặc sắp lịch định kỳ khi có nhu cầu.
3. Khách đánh giá sau phục vụ; cơ sở phản hồi và nền tảng xử lý nội dung bị báo cáo.

### Thay thế/ngoại lệ

- 1a. Ưu đãi hết hạn/ngoài phạm vi: không áp dụng.
- 3a. Đánh giá vi phạm: có thể bị ẩn hoặc đưa vào quy trình xem xét.

### Quy tắc và trách nhiệm

BR-09; điểm thưởng và danh sách chờ không thuộc nghiệp vụ hiện hành.

Chủ cơ sở; Quản trị nền tảng thực hiện đúng phần việc ở từng bước; Khách cung cấp nhu cầu/căn cứ, không tự có thẩm quyền của worker. Quyết định thẩm quyền cụ thể được ràng buộc tại SUC-07, SUC-11, SUC-12, SUC-21, SUC-27, SUC-28, SUC-29, SUC-30, SUC-31.

### Bằng chứng và giới hạn

- [BookingsController.previewPrice](../../../src/bookings/bookings.controller.ts) (dòng 308)
- [VouchersService.preview](../../../src/bookings/vouchers.service.ts) (dòng 15)
- [PricingEngineService.quote](../../../src/promotions/pricing-engine.service.ts) (dòng 28)
- [RecurringController.preview](../../../src/recurring/recurring.controller.ts) (dòng 16)
- [RecurringController.create](../../../src/recurring/recurring.controller.ts) (dòng 22)
- [RecurringController.status](../../../src/recurring/recurring.controller.ts) (dòng 35)
- [RecurringService.create](../../../src/recurring/recurring.service.ts) (dòng 39)

Ánh xạ SUC: SUC-07, SUC-11, SUC-12, SUC-21, SUC-27, SUC-28, SUC-29, SUC-30, SUC-31. Đây là mô hình phân tích từ code, chưa được phỏng vấn xác nhận với đơn vị vận hành. Các giới hạn triển khai trong SUC liên quan vẫn áp dụng, đặc biệt chuyển chủ/quyền dữ liệu/gói buổi.

## BUC-07 — Đưa cơ sở đủ điều kiện lên sàn

- Mục tiêu: Cơ sở được thẩm định và công bố theo trạng thái đáp ứng.
- Actor chính/đối tượng thụ hưởng: Đại diện cơ sở đăng ký.
- Worker/bên hỗ trợ: Chủ cơ sở; Quản trị nền tảng.
- Trigger: Đại diện doanh nghiệp muốn tham gia hoặc mở chi nhánh.
- Tiền điều kiện: nhu cầu hợp lệ trong phạm vi hoạt động mô tả; thông tin, cam kết hoặc hồ sơ ở bước đầu tồn tại. Điều kiện tài khoản cụ thể thuộc đặc tả SUC, không biến thành bước kinh doanh.
- Hậu điều kiện thành công: Cơ sở được thẩm định và công bố theo trạng thái đáp ứng.
- Bảo đảm thất bại: không coi đề nghị đang chờ/từ chối là cam kết đã hoàn tất; giữ lịch sử theo phần triển khai có căn cứ.

### Luồng chính

1. Đại diện chuẩn bị thông tin và giấy tờ doanh nghiệp/chi nhánh.
2. Nền tảng xem xét, yêu cầu bổ sung hoặc quyết định theo chính sách.
3. Cơ sở hoàn tất điều kiện dịch vụ, nhân sự và công bố chi nhánh đủ điều kiện.

### Thay thế/ngoại lệ

- 2a. Cần bổ sung: cơ sở sửa và gửi lại.
- 2b. Chính sách tự duyệt: không mô tả bắt buộc con người phê duyệt mọi hồ sơ.
- 3a. Chưa sẵn sàng: chưa công bố.

### Quy tắc và trách nhiệm

BR-10; phê duyệt và công bố chi nhánh là hai bước khác nhau.

Chủ cơ sở; Quản trị nền tảng thực hiện đúng phần việc ở từng bước; Đại diện cơ sở đăng ký cung cấp nhu cầu/căn cứ, không tự có thẩm quyền của worker. Quyết định thẩm quyền cụ thể được ràng buộc tại SUC-22, SUC-23, SUC-24, SUC-40.

### Bằng chứng và giới hạn

- [BusinessController.createDraft](../../../src/business/business.controller.ts) (dòng 28)
- [BusinessController.submit](../../../src/business/business.controller.ts) (dòng 62)
- [BusinessOnboardingService.updateDraft](../../../src/business/business-onboarding.service.ts) (dòng 527)
- [BusinessOnboardingService.submit](../../../src/business/business-onboarding.service.ts) (dòng 599)
- [BusinessController.review](../../../src/business/business.controller.ts) (dòng 73)
- [BranchesController.review](../../../src/branches/branches.controller.ts) (dòng 261)
- [BusinessOnboardingService.review](../../../src/business/business-onboarding.service.ts) (dòng 666)

Ánh xạ SUC: SUC-22, SUC-23, SUC-24, SUC-40. Đây là mô hình phân tích từ code, chưa được phỏng vấn xác nhận với đơn vị vận hành. Các giới hạn triển khai trong SUC liên quan vẫn áp dụng, đặc biệt chuyển chủ/quyền dữ liệu/gói buổi.

## BUC-08 — Bảo đảm danh mục và năng lực phục vụ

- Mục tiêu: Cơ sở cung cấp dịch vụ đúng danh mục, giá và năng lực nhân sự.
- Actor chính/đối tượng thụ hưởng: Khách hưởng lợi.
- Worker/bên hỗ trợ: Chủ cơ sở; Lễ tân; Chuyên viên.
- Trigger: Cơ sở thay đổi dịch vụ, nhân sự hoặc giờ mở cửa.
- Tiền điều kiện: nhu cầu hợp lệ trong phạm vi hoạt động mô tả; thông tin, cam kết hoặc hồ sơ ở bước đầu tồn tại. Điều kiện tài khoản cụ thể thuộc đặc tả SUC, không biến thành bước kinh doanh.
- Hậu điều kiện thành công: Cơ sở cung cấp dịch vụ đúng danh mục, giá và năng lực nhân sự.
- Bảo đảm thất bại: không coi đề nghị đang chờ/từ chối là cam kết đã hoàn tất; giữ lịch sử theo phần triển khai có căn cứ.

### Luồng chính

1. Chủ cơ sở xác định dịch vụ kinh doanh và phạm vi tại chi nhánh.
2. Chủ cơ sở chuẩn bị hồ sơ nhân sự, năng lực dịch vụ và khả năng nhận lịch.
3. Cơ sở áp dụng giá/biến thể/combo; đánh giá ảnh hưởng trước khi ngừng cung cấp.

### Thay thế/ngoại lệ

- 2a. Chưa có tài khoản nhân viên: vẫn có thể có hồ sơ chuyên viên.
- 3a. Còn lịch tương lai bị ảnh hưởng: cần giải quyết tác động trước.

### Quy tắc và trách nhiệm

BR-02, BR-11; không suy lịch ca/đơn nghỉ là đầu vào tính slot hiện tại.

Chủ cơ sở; Lễ tân; Chuyên viên thực hiện đúng phần việc ở từng bước; Khách hưởng lợi cung cấp nhu cầu/căn cứ, không tự có thẩm quyền của worker. Quyết định thẩm quyền cụ thể được ràng buộc tại SUC-24, SUC-25, SUC-26, SUC-27, SUC-38, SUC-40.

### Bằng chứng và giới hạn

- [BranchesController.saveOnboarding](../../../src/branches/branches.controller.ts) (dòng 186)
- [BranchesController.publish](../../../src/branches/branches.controller.ts) (dòng 285)
- [BranchesService.getReadiness](../../../src/branches/branches.service.ts) (dòng 764)
- [BranchesService.publish](../../../src/branches/branches.service.ts) (dòng 1317)
- [ServicesController.createCatalog](../../../src/services/services.controller.ts) (dòng 187)
- [ServicesController.updateOfferingPricing](../../../src/services/services.controller.ts) (dòng 265)
- [ServicesController.archiveCatalog](../../../src/services/services.controller.ts) (dòng 214)

Ánh xạ SUC: SUC-24, SUC-25, SUC-26, SUC-27, SUC-38, SUC-40. Đây là mô hình phân tích từ code, chưa được phỏng vấn xác nhận với đơn vị vận hành. Các giới hạn triển khai trong SUC liên quan vẫn áp dụng, đặc biệt chuyển chủ/quyền dữ liệu/gói buổi.

## BUC-09 — Xử lý gián đoạn hoạt động

- Mục tiêu: Lịch và nghĩa vụ đang mở được xử lý khi cơ sở/nhân sự dừng hoạt động.
- Actor chính/đối tượng thụ hưởng: Khách bị ảnh hưởng.
- Worker/bên hỗ trợ: Chủ cơ sở; Lễ tân; Quản trị nền tảng.
- Trigger: Ngừng nhân sự, tạm dừng/đóng chi nhánh hoặc tác động tương tự.
- Tiền điều kiện: nhu cầu hợp lệ trong phạm vi hoạt động mô tả; thông tin, cam kết hoặc hồ sơ ở bước đầu tồn tại. Điều kiện tài khoản cụ thể thuộc đặc tả SUC, không biến thành bước kinh doanh.
- Hậu điều kiện thành công: Lịch và nghĩa vụ đang mở được xử lý khi cơ sở/nhân sự dừng hoạt động.
- Bảo đảm thất bại: không coi đề nghị đang chờ/từ chối là cam kết đã hoàn tất; giữ lịch sử theo phần triển khai có căn cứ.

### Luồng chính

1. Cơ sở xác định phạm vi bị ảnh hưởng.
2. Người có quyền chọn phương án xử lý từng lịch và nghĩa vụ liên quan.
3. Cơ sở hoàn tất hồ sơ tác động rồi thực hiện thay đổi được phép.

### Thay thế/ngoại lệ

- 2a. Còn mục chưa xử lý: chưa hoàn tất hồ sơ.
- 3a. Phát sinh lịch mới: kiểm tra lại tác động.

### Quy tắc và trách nhiệm

Đọc điều kiện cụ thể của ImpactService/BranchStateService; không suy hoàn tiền tự động.

Chủ cơ sở; Lễ tân; Quản trị nền tảng thực hiện đúng phần việc ở từng bước; Khách bị ảnh hưởng cung cấp nhu cầu/căn cứ, không tự có thẩm quyền của worker. Quyết định thẩm quyền cụ thể được ràng buộc tại SUC-33.

### Bằng chứng và giới hạn

- [ImpactController.resolve](../../../src/operations/impact.controller.ts) (dòng 40)
- [ImpactController.complete](../../../src/operations/impact.controller.ts) (dòng 52)
- [ImpactService.resolveItem](../../../src/operations/impact.service.ts) (dòng 50)
- [BranchStateService.transition](../../../src/branches/branch-state.service.ts) (dòng 65)

Ánh xạ SUC: SUC-33. Đây là mô hình phân tích từ code, chưa được phỏng vấn xác nhận với đơn vị vận hành. Các giới hạn triển khai trong SUC liên quan vẫn áp dụng, đặc biệt chuyển chủ/quyền dữ liệu/gói buổi.

## BUC-10 — Chuyển giao quyền sở hữu

- Mục tiêu: Doanh nghiệp có chủ chịu trách nhiệm mới và lịch sử chuyển giao.
- Actor chính/đối tượng thụ hưởng: Đại diện cơ sở.
- Worker/bên hỗ trợ: Chủ cơ sở; Chủ mới; Quản trị nền tảng.
- Trigger: Chủ hiện tại đề nghị chuyển giao.
- Tiền điều kiện: nhu cầu hợp lệ trong phạm vi hoạt động mô tả; thông tin, cam kết hoặc hồ sơ ở bước đầu tồn tại. Điều kiện tài khoản cụ thể thuộc đặc tả SUC, không biến thành bước kinh doanh.
- Hậu điều kiện thành công: Doanh nghiệp có chủ chịu trách nhiệm mới và lịch sử chuyển giao.
- Bảo đảm thất bại: không coi đề nghị đang chờ/từ chối là cam kết đã hoàn tất; giữ lịch sử theo phần triển khai có căn cứ.

### Luồng chính

1. Chủ hiện tại xác định chủ mới, lý do và thời điểm hiệu lực.
2. Chủ mới xác nhận; nền tảng xem xét tác động, pháp nhân và tài khoản nhận tiền.
3. Đến điều kiện hiệu lực, nền tảng thực hiện chuyển giao và giữ lịch sử.

### Thay thế/ngoại lệ

- 1a. Chủ mới dùng tài khoản CUSTOMER: bị chặn do tách tài khoản.
- 2a. Cần bổ sung hoặc từ chối: chưa chuyển chủ.
- 3a. Có vướng mắc điều kiện: chưa thực hiện.

### Quy tắc và trách nhiệm

Triển khai một phần: đường dẫn tiếp nhận trên web lệch workspace; xem GAP-01.

Chủ cơ sở; Chủ mới; Quản trị nền tảng thực hiện đúng phần việc ở từng bước; Đại diện cơ sở cung cấp nhu cầu/căn cứ, không tự có thẩm quyền của worker. Quyết định thẩm quyền cụ thể được ràng buộc tại SUC-34, SUC-35.

### Bằng chứng và giới hạn

- [OwnershipController.create](../../../src/ownership/ownership.controller.ts) (dòng 14)
- [OwnershipController.accept](../../../src/ownership/ownership.controller.ts) (dòng 35)
- [OwnershipService.create](../../../src/ownership/ownership.service.ts) (dòng 13)
- [OwnershipService.accept](../../../src/ownership/ownership.service.ts) (dòng 55)
- [OwnershipController.review](../../../src/ownership/ownership.controller.ts) (dòng 63)
- [OwnershipController.execute](../../../src/ownership/ownership.controller.ts) (dòng 84)
- [OwnershipService.execute](../../../src/ownership/ownership.service.ts) (dòng 148)

Ánh xạ SUC: SUC-34, SUC-35. Đây là mô hình phân tích từ code, chưa được phỏng vấn xác nhận với đơn vị vận hành. Các giới hạn triển khai trong SUC liên quan vẫn áp dụng, đặc biệt chuyển chủ/quyền dữ liệu/gói buổi.

## BUC-11 — Giám sát chất lượng và hiệu quả sàn

- Mục tiêu: Người có thẩm quyền nhận biết hiệu quả, rủi ro và thực hiện biện pháp quản trị.
- Actor chính/đối tượng thụ hưởng: Cơ sở tham gia.
- Worker/bên hỗ trợ: Chủ cơ sở; Quản trị nền tảng.
- Trigger: Nhu cầu xem báo cáo hoặc phát hiện sai phạm.
- Tiền điều kiện: nhu cầu hợp lệ trong phạm vi hoạt động mô tả; thông tin, cam kết hoặc hồ sơ ở bước đầu tồn tại. Điều kiện tài khoản cụ thể thuộc đặc tả SUC, không biến thành bước kinh doanh.
- Hậu điều kiện thành công: Người có thẩm quyền nhận biết hiệu quả, rủi ro và thực hiện biện pháp quản trị.
- Bảo đảm thất bại: không coi đề nghị đang chờ/từ chối là cam kết đã hoàn tất; giữ lịch sử theo phần triển khai có căn cứ.

### Luồng chính

1. Chủ cơ sở/nền tảng xem số liệu trong phạm vi được giao.
2. Nền tảng kiểm tra hồ sơ, đánh giá, dấu vết và mức độ tin cậy.
3. Người có quyền áp dụng quyết định, cấu hình hoặc biện pháp xử lý được hỗ trợ.

### Thay thế/ngoại lệ

- 1a. Ngoài scope: không nhận được dữ liệu.
- 3a. Không đủ căn cứ/điều kiện: từ chối thay đổi.

### Quy tắc và trách nhiệm

Phân biệt tài chính quản trị còn hoạt động với hóa đơn/phiếu thu đã gỡ.

Chủ cơ sở; Quản trị nền tảng thực hiện đúng phần việc ở từng bước; Cơ sở tham gia cung cấp nhu cầu/căn cứ, không tự có thẩm quyền của worker. Quyết định thẩm quyền cụ thể được ràng buộc tại SUC-23, SUC-30, SUC-36, SUC-37, SUC-38, SUC-39.

### Bằng chứng và giới hạn

- [BusinessController.review](../../../src/business/business.controller.ts) (dòng 73)
- [BranchesController.review](../../../src/branches/branches.controller.ts) (dòng 261)
- [BusinessOnboardingService.review](../../../src/business/business-onboarding.service.ts) (dòng 666)
- [BranchesService.review](../../../src/branches/branches.service.ts) (dòng 1238)
- [ReviewsController.reply](../../../src/reviews/reviews.controller.ts) (dòng 163)
- [ReviewsController.report](../../../src/reviews/reviews.controller.ts) (dòng 147)
- [ReviewsController.moderate](../../../src/reviews/reviews.controller.ts) (dòng 189)

Ánh xạ SUC: SUC-23, SUC-30, SUC-36, SUC-37, SUC-38, SUC-39. Đây là mô hình phân tích từ code, chưa được phỏng vấn xác nhận với đơn vị vận hành. Các giới hạn triển khai trong SUC liên quan vẫn áp dụng, đặc biệt chuyển chủ/quyền dữ liệu/gói buổi.

## BUC-12 — Bảo vệ tài khoản và quyền dữ liệu

- Mục tiêu: Chủ thể kiểm soát truy cập tài khoản và yêu cầu quyền dữ liệu của mình.
- Actor chính/đối tượng thụ hưởng: Chủ tài khoản.
- Worker/bên hỗ trợ: BeautyBook xử lý xác thực/quyền dữ liệu.
- Trigger: Đăng ký, đăng nhập, khôi phục truy cập hoặc yêu cầu dữ liệu.
- Tiền điều kiện: nhu cầu hợp lệ trong phạm vi hoạt động mô tả; thông tin, cam kết hoặc hồ sơ ở bước đầu tồn tại. Điều kiện tài khoản cụ thể thuộc đặc tả SUC, không biến thành bước kinh doanh.
- Hậu điều kiện thành công: Chủ thể kiểm soát truy cập tài khoản và yêu cầu quyền dữ liệu của mình.
- Bảo đảm thất bại: không coi đề nghị đang chờ/từ chối là cam kết đã hoàn tất; giữ lịch sử theo phần triển khai có căn cứ.

### Luồng chính

1. Người dùng xác lập danh tính và vai trò phù hợp.
2. Chủ tài khoản quản lý hồ sơ, mật khẩu và phiên truy cập.
3. Khách hàng điều chỉnh ưu tiên tiếp thị hoặc gửi yêu cầu/xuất dữ liệu.

### Thay thế/ngoại lệ

- 1a. Thông tin/token không hợp lệ: không cấp truy cập.
- 3a. Yêu cầu xóa dữ liệu mới được tiếp nhận: không suy đã xóa dữ liệu.

### Quy tắc và trách nhiệm

BR-01; xử lý yêu cầu dữ liệu end-to-end chỉ một phần.

BeautyBook xử lý xác thực/quyền dữ liệu thực hiện đúng phần việc ở từng bước; Chủ tài khoản cung cấp nhu cầu/căn cứ, không tự có thẩm quyền của worker. Quyết định thẩm quyền cụ thể được ràng buộc tại SUC-02, SUC-03, SUC-04, SUC-31, SUC-32, SUC-40.

### Bằng chứng và giới hạn

- [AuthController.register](../../../src/auth/auth.controller.ts) (dòng 96)
- [AuthController.login](../../../src/auth/auth.controller.ts) (dòng 71)
- [AuthService.register](../../../src/auth/auth.service.ts) (dòng 141)
- [AuthService.login](../../../src/auth/auth.service.ts) (dòng 44)
- [AuthController.verifyEmail](../../../src/auth/auth.controller.ts) (dòng 131)
- [AuthController.forgotPassword](../../../src/auth/auth.controller.ts) (dòng 138)
- [AuthController.resetPassword](../../../src/auth/auth.controller.ts) (dòng 146)

Ánh xạ SUC: SUC-02, SUC-03, SUC-04, SUC-31, SUC-32, SUC-40. Đây là mô hình phân tích từ code, chưa được phỏng vấn xác nhận với đơn vị vận hành. Các giới hạn triển khai trong SUC liên quan vẫn áp dụng, đặc biệt chuyển chủ/quyền dữ liệu/gói buổi.

