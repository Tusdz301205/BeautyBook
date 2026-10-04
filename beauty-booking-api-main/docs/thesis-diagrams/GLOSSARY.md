# Thuật ngữ thống nhất

| Thuật ngữ Việt | Trong code/mô hình | Nghĩa sử dụng |
|---|---|---|
| Nghiệp vụ | BUC | Mục tiêu/kết quả kinh doanh; không phải endpoint |
| Tương tác hệ thống | SUC | Mục tiêu actor đạt qua phần mềm; có thể gồm nhiều API |
| Tác nhân nghiệp vụ | business actor | Bên ngoài ranh giới phối hợp được chọn |
| Nhân sự nghiệp vụ | business worker | Người thực hiện bên trong ranh giới nghiệp vụ, không là kế thừa role |
| Khách chưa đăng nhập | PUBLIC | Không phải tài khoản role GUEST |
| Khách hàng | CUSTOMER, CustomerProfile | Tài khoản tự đặt/khách có hồ sơ, tùy ngữ cảnh; phân biệt khách vãng lai |
| Khách vãng lai | hồ sơ do quầy tạo | Không tự có phiên hoặc quyền CUSTOMER |
| Doanh nghiệp | Business | Đơn vị có chủ sở hữu, nhiều chi nhánh |
| Cơ sở/chi nhánh | Branch | Địa điểm phục vụ; tránh dùng “salon” thay cho cả Business và Branch trong quan hệ dữ liệu |
| Chủ doanh nghiệp | BUSINESS_OWNER, BusinessOwnerProfile | Chủ theo doanh nghiệp được cấp scope |
| Lễ tân | RECEPTIONIST | Nhân sự điều phối trong scope chi nhánh |
| Chuyên viên | STAFF, StaffProfile | Hồ sơ chuyên môn có thể chưa gắn User |
| Dịch vụ chuẩn | CanonicalService | Định nghĩa danh mục nền tảng |
| Dịch vụ doanh nghiệp | BusinessService | Dịch vụ được doanh nghiệp kinh doanh |
| Dịch vụ tại chi nhánh | BranchServiceOffering / services | Phạm vi cung cấp, giá và cấu hình tại chi nhánh |
| Lịch hẹn | Booking / LichHen | Cam kết phục vụ và trạng thái tổng thể |
| Phần dịch vụ | BookingService / PhanDichVu | Một dịch vụ trong lịch; không phải lớp BookingsService |
| Điều phối lịch | BookingsService / DieuPhoiDatLich | Lớp ứng dụng / trách nhiệm phân tích tương ứng |
| Năng lực phục vụ | NangLucPhucVu | Điều kiện giờ, kỹ năng, khả dụng; không là bảng mới |
| Yêu cầu thay đổi | AppointmentChangeRequest / YeuCauThayDoi | Đề nghị hủy hoặc đổi cần xử lý |
| Hủy sát giờ | LATE_CANCELLATION | Vi phạm ghi ở thời điểm gửi yêu cầu hợp lệ |
| Vắng mặt | NO_SHOW | Xác nhận theo time guard và điều kiện nghiệp vụ |
| Lịch sử vi phạm | BookingViolationEvent / LichSuViPham | Sự kiện có căn cứ và khả năng void có dấu vết |
| Hạn chế tự đặt | CustomerBookingPolicy | Theo cặp khách–doanh nghiệp, khác chặn tài khoản toàn hệ thống |
| Khoản thu | Payment / KhoanThu | Ghi nhận thanh toán; không là hóa đơn |
| Yêu cầu hoàn | RefundRequest / YeuCauHoan | Quy trình kiểm soát hoàn trả; không chứng minh đã chuyển tiền bên ngoài |
| Sổ cái | FinancialLedgerEntry | Dấu vết tài chính còn hoạt động |
| Bảng kê nền tảng | PlatformStatement | Đối soát phí; khác Invoice đã gỡ tính năng |
| Gói buổi | TreatmentPackage, PackageSessionEntitlement | Quyền sử dụng số buổi; khác combo nhiều dịch vụ trong lịch |
| Ưu đãi | Promotion, Voucher | Khuyến mãi/mã quyền lợi đang hoạt động; không là điểm thưởng |
| Hàng đợi phục vụ | scheduler/tiến độ lịch | Điều phối lịch đang có; khác WaitlistEntry di sản |
| Ranh giới/Bộ điều khiển/Thực thể | Boundary / Control / Entity | Ba trách nhiệm phân tích BCE; không mặc định là class NestJS |
| Phụ thuộc | dependency, nét đứt mũi tên mở | Sử dụng/DI; không khẳng định composition |
| Hiện thực hóa | realization, nét đứt tam giác rỗng | Class implements interface có bằng chứng AST |
| Kế thừa | generalization, nét liền tam giác rỗng | extends có bằng chứng; không suy từ cấp bậc nhân sự |
| PK / FK / UQ | primary / foreign / unique key | Ràng buộc schema; UQ có điều kiện SQL ghi riêng |
| 0..1 / 0..* / 1 | optional một / nhiều / đúng một | Bội số vật lý; collection không ép ít nhất một |
| Dấu ... trong lớp | chữ ký lược bớt | Không phải kiểu thực; xem inventory/source đầy đủ |

Tên lớp phân tích, thuộc tính và trách nhiệm hiển thị bằng tiếng Việt có dấu. Alias không dấu trong nguồn được giữ ổn định để truy vết, ví dụ `LichHen` hiển thị “Lịch hẹn”. Bảng ánh xạ nhãn nằm trong `scripts/analysis-labels.cjs`; class thiết kế vẫn giữ đúng tên code. Ánh xạ từng Boundary/Control/Entity sang lớp thiết kế có tại [analysis-class-notes](03-analysis-classes/analysis-class-notes.md) và [TRACEABILITY](TRACEABILITY.md).
