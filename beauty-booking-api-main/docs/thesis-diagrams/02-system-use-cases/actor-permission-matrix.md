# Actor × chức năng × quyền

O=BUSINESS_OWNER; R=RECEPTIONIST; S=STAFF; A=PLATFORM_ADMIN; C=CUSTOMER; V=chưa đăng nhập. Dấu tham gia không là quyền CRUD toàn phần.

| UC | V | C | O | R | S | A | Trạng thái |
|---|---|---|---|---|---|---|---|
| SUC-01 Tra cứu dịch vụ và cơ sở | Có nhánh | Có nhánh | Có nhánh | — | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-02 Thiết lập tài khoản và đăng nhập | Có nhánh | — | — | — | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-03 Khôi phục và bảo vệ truy cập | Có nhánh | Có nhánh | Có nhánh | Có nhánh | Có nhánh | Có nhánh | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-04 Duy trì hồ sơ cá nhân | — | Có nhánh | Có nhánh | Có nhánh | Có nhánh | Có nhánh | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-05 Tự đặt lịch dịch vụ | — | Có nhánh | — | — | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-06 Kiểm tra giờ còn khả dụng | Có nhánh | Có nhánh | — | — | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-07 Xem giá và ưu đãi đặt lịch | — | Có nhánh | — | — | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-08 Theo dõi lịch và chính sách tự đặt | — | Có nhánh | — | — | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-09 Tự hủy lịch đủ sớm | — | Có nhánh | — | — | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-10 Gửi yêu cầu đổi hoặc hủy lịch | — | Có nhánh | — | — | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-11 Sắp xếp chuỗi lịch định kỳ | — | Có nhánh | — | — | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-12 Lưu dịch vụ quan tâm | — | Có nhánh | — | — | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-13 Tạo lịch hộ tại cơ sở | — | — | Có nhánh | Có nhánh | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-14 Điều phối lịch và phân công | — | — | Có nhánh | Có nhánh | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-15 Xử lý yêu cầu thay đổi lịch | — | — | Có nhánh | Có nhánh | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-16 Tiếp nhận khách và ghi no-show | — | — | Có nhánh | Có nhánh | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-17 Thực hiện phần dịch vụ được giao | — | — | Có nhánh | — | Có nhánh | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-18 Thu tiền và xác minh giao dịch | — | — | Có nhánh | Có nhánh | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-19 Đề nghị và xét duyệt hoàn tiền | — | — | Có nhánh | — | — | Có nhánh | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-20 Ghi kết quả xử lý hoàn tiền | — | — | — | — | — | Có nhánh | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-21 Quản lý gói buổi dịch vụ | — | Có nhánh | Có nhánh | Có nhánh | — | — | Triển khai một phần: backend có các hành động; web xác minh được tạo gói, chưa xác minh đầy đủ UI mua/dùng buổi. |
| SUC-22 Chuẩn bị và nộp hồ sơ doanh nghiệp | — | — | Có nhánh | — | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-23 Thẩm định doanh nghiệp và chi nhánh | — | — | — | — | — | Có nhánh | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-24 Thiết lập và công bố chi nhánh | — | — | Có nhánh | — | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-25 Quản lý dịch vụ và giá tại cơ sở | — | — | Có nhánh | — | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-26 Quản lý chuyên viên và lời mời | Có nhánh | — | Có nhánh | — | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-27 Quản lý combo dịch vụ | — | — | Có nhánh | — | — | — | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-28 Thiết lập khuyến mãi và voucher | — | — | Có nhánh | — | — | Có nhánh | Triển khai web OWNER/API; thao tác PLATFORM có API, cần xác minh đường UI quản lý đầy đủ. |
| SUC-29 Đánh giá dịch vụ đã dùng | — | Có nhánh | — | — | — | — | Đã triển khai web/API; mobile cần phân biệt caller thật với ReviewsContext cục bộ. |
| SUC-30 Phản hồi và xem xét đánh giá | — | Có nhánh | Có nhánh | — | — | Có nhánh | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-31 Theo dõi thông báo cá nhân | — | Có nhánh | Có nhánh | Có nhánh | Có nhánh | Có nhánh | Đã triển khai in-app qua web/API; push ngoài chưa xác minh |
| SUC-32 Kiểm soát quyền dữ liệu | — | Có nhánh | — | — | — | — | Triển khai một phần: tiếp nhận/yêu cầu và export có API/UI; chưa thấy quy trình xử lý mọi quyền dữ liệu end-to-end. |
| SUC-33 Giải quyết tác động vận hành | — | — | Có nhánh | — | — | Có nhánh | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-34 Đề nghị và tiếp nhận chuyển chủ | — | — | Có nhánh | Có nhánh | Có nhánh | Có nhánh | Triển khai một phần: backend có xử lý, web lệch workspace khi nhận chuyển giao; create yêu cầu OWNER, accept không có Roles decorator và kiểm tra newOwnerUserId. |
| SUC-35 Thẩm định và thực hiện chuyển chủ | — | — | — | — | — | Có nhánh | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-36 Xem hiệu quả và đối soát | — | — | Có nhánh | — | — | Có nhánh | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-37 Quản trị truy cập người dùng | — | — | — | — | — | Có nhánh | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-38 Quản trị danh mục và chính sách | — | — | — | — | — | Có nhánh | API có triển khai; web settings đã nối, taxonomy route cần xác minh (GAP-04). |
| SUC-39 Giám sát và xử lý độ tin cậy | — | — | — | — | — | Có nhánh | Đã triển khai qua code web/API; chưa kiểm chứng runtime |
| SUC-40 Lưu và sử dụng tài liệu hình ảnh | — | Có nhánh | Có nhánh | Có nhánh | Có nhánh | Có nhánh | Đã triển khai qua code web/API; chưa kiểm chứng runtime |

Quyền từng endpoint và scope nghiệp vụ được ghi trong specifications.md. Không suy STAFF đọc mọi lịch từ permission :branch; BookingsAccessService còn kiểm tra assignment.

