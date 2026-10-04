# Khảo sát hệ thống BeautyBook

Ngày đối chiếu: 26/09/2026. Nguồn là working tree hiện tại, gồm thay đổi chưa commit. Đây là khảo sát tĩnh: không chạy nghiệp vụ, không truy vấn database, không chứng nhận trạng thái triển khai production. Hash nguồn nằm trong [source inventory](00-scope-and-traceability/source-inventory.json).

Lượt chỉnh phong cách UML truyền thống: đã đối chiếu lại hash 153 file backend và schema với inventory; không có thay đổi nguồn trong tập đã ghi nhận. Đọc lại module đăng ký, account-separation, policy hủy/no-show/hạn chế và registry thanh toán; các kết luận bên dưới giữ nguyên. Hai ảnh mẫu chỉ được dùng cho hình thức; không lấy actor ngân hàng/kế toán, nghiệp vụ hóa đơn, dấu cộng trước bội số hoặc quan hệ extend đăng nhập từ ảnh mẫu.

## Phạm vi và kiến trúc

Backend NestJS, Prisma/PostgreSQL; web chính React/Vite; mobile React Native/Expo là kênh tương tác. Controllers kiểm tra DTO, authentication/role/permission; services và policy helpers tiếp tục kiểm tra scope, ownership và trạng thái. PrismaService là đầu mối persistence. Scheduler, workers và gateway là thành phần nội bộ, không là actor ngoài ranh giới phần mềm.

Module đang đăng ký được kiểm tra tại [AppModule](../../src/app.module.ts). Operations hiện đăng ký xử lý tác động vận hành; không còn đăng ký worker/controller danh sách chờ. Payments vẫn có khoản thu, hoàn tiền, ledger, phí nền tảng, bảng kê và gói buổi. Việc gỡ FinanceModule không có nghĩa bỏ thanh toán. Các bảng cũ vẫn được mô tả trong ERD vật lý.

## Actor, workspace và scope

| Actor phần mềm | Vai trò/phiên | Phạm vi thực tế |
|---|---|---|
| Người chưa đăng nhập | PUBLIC, không có role đăng nhập | Tra cứu endpoint Public; đăng ký, đăng nhập, khôi phục hoặc nhận lời mời theo token |
| Khách hàng | CUSTOMER; phiên customer / workspace CUSTOMER | Dữ liệu của chính mình; tạo lịch online sau assertCustomerPrincipal |
| Chủ doanh nghiệp | BUSINESS_OWNER; SALON | Doanh nghiệp được cấp; không tự có quyền khách hàng |
| Lễ tân | RECEPTIONIST; SALON | Chi nhánh được cấp và các hành động tại quầy; không có quyền chủ doanh nghiệp |
| Chuyên viên | STAFF; SALON | Công việc được phân công và tài khoản của mình; không đọc/đổi mọi lịch chi nhánh |
| Quản trị nền tảng | PLATFORM_ADMIN; ADMIN | Các thao tác quản trị được cấp; không suy toàn quyền vận hành salon |

Nguồn: [permission-catalog](../../src/common/permissions/permission-catalog.ts), [account-separation](../../src/auth/account-separation.ts), [BookingsController](../../src/bookings/bookings.controller.ts), [BookingsAccessService](../../src/bookings/bookings-access.service.ts). Ma trận đầy đủ: [actor × SUC](02-system-use-cases/actor-permission-matrix.md); decorator và quyền từng nhánh: [đặc tả SUC](02-system-use-cases/specifications.md).

Enum GUEST không chứng minh tồn tại actor đăng nhập Guest. Khách vãng lai do nhân sự tạo hồ sơ là đối tượng được phục vụ, không mặc nhiên là tài khoản CUSTOMER. `POST bookings/guest` vẫn yêu cầu CUSTOMER, permission và assertCustomerPrincipal. BRANCH_MANAGER đã có migration loại bỏ; không tạo actor từ comment/tài liệu cũ. Không vẽ kế thừa CUSTOMER cho OWNER/STAFF.

## Chức năng và mức triển khai

| Nhóm | Kết luận từ code | SUC |
|---|---|---|
| Tìm dịch vụ/cơ sở/chuyên viên, lưu dịch vụ | Có API và caller web; home/search/detail mobile có API | 01, 12 |
| Tài khoản, phiên, hồ sơ | Có web/API; mobile xác thực có transport riêng | 02–04 |
| Tự đặt lịch, slot, báo giá, theo dõi | Có web/API và code mobile; chưa xác nhận đồng bộ runtime | 05–08 |
| Đổi/hủy, duyệt yêu cầu, lịch định kỳ | Có xử lý API và caller web; không suy mọi chức năng đã có mobile | 09–11, 15 |
| Tạo lịch hộ, điều phối, check-in, no-show, phần dịch vụ | Có API và giao diện vận hành; phân quyền từng thao tác | 13–17 |
| Thu, xác minh, hoàn tiền | Có API và web; adapter tiền mặt/chuyển khoản thủ công | 18–20 |
| Gói buổi dịch vụ | Backend có vòng đời; bằng chứng web chưa bao phủ toàn vòng đời | 21 |
| Onboarding doanh nghiệp/chi nhánh, công bố | Có API và web; duyệt không đồng nghĩa công bố | 22–24 |
| Catalog, chuyên viên, lời mời, combo | Có API và web | 25–27 |
| Khuyến mãi/voucher, đánh giá/kiểm duyệt, thông báo | Có API và web; không suy có chat hoặc push thực tế từ model | 28–31 |
| Quyền dữ liệu | Tiếp nhận yêu cầu/xuất dữ liệu có code; chưa có bằng chứng toàn vòng đời xóa dữ liệu | 32 |
| Tác động vận hành | Có controller/service/worker; OWNER/ADMIN, không cấp cho lễ tân từ mô tả nghiệp vụ | 33 |
| Chuyển chủ | Backend có xử lý; đường dẫn nhận chuyển giao web lệch workspace | 34–35 |
| Đối soát, báo cáo, quản trị truy cập/tin cậy | Có API và web tương ứng | 36–37, 39 |
| Danh mục chuẩn/chính sách | API và settings có; page taxonomy chưa được mount trong App.jsx | 38 |
| Media/tài liệu | Có upload/read theo scope; private content phải được kiểm tra quyền | 40 |
| Điểm thưởng, danh sách chờ, hóa đơn/phiếu thu | Đã gỡ khỏi module/luồng được khảo sát; schema di sản giữ lại | Không có SUC hiện hành |
| Cổng thanh toán MOMO/VNPAY; chat; tự động chuyển tiền hoàn | Không có bằng chứng tích hợp trong luồng khảo sát; enum/tên màn hình không đủ căn cứ | Không thêm SUC |

“Có” là có triển khai trong code được dẫn chứng, không tương đương đã kiểm thử end-to-end. Mỗi SUC có mục mobile, nguồn frontend/backend/schema và giới hạn riêng.

## Quy tắc nghiệp vụ đối chiếu

| Mã | Quy tắc hiện hành và bằng chứng |
|---|---|
| BR-01 | Tách tài khoản CUSTOMER và vận hành. assertCustomerPrincipal kiểm tra sessionType, workspace nếu có, CUSTOMER scope hoạt động và không có role vận hành. Grant/chuyển chủ phải kiểm tra tương thích tài khoản. [account-separation](../../src/auth/account-separation.ts) |
| BR-02 | Slot theo giờ mở cửa/ngày nghỉ/ngày đặc biệt, chuyên viên hoạt động/nhận lịch, kỹ năng dịch vụ và lịch chồng lấn. Không suy thêm ca làm/đơn nghỉ vào thuật toán hiện tại. Tạo lịch còn kiểm tra buffer/chuyển tiếp và khả dụng. [BookingsService](../../src/bookings/bookings.service.ts) |
| BR-03 | Kênh tự đặt CUSTOMER chỉ ONLINE_WEB/ONLINE_APP; lịch do nhân sự tạo có chính sách nguồn riêng. Hạn chế tự đặt theo cặp khách–doanh nghiệp, không cấm toàn sàn. [booking-channel-policy](../../src/bookings/booking-channel-policy.ts), [customer-booking-policy](../../src/bookings/customer-booking-policy.ts) |
| BR-04 | Còn ít nhất 4 giờ: tự hủy trực tiếp nếu trạng thái cho phép. Còn dưới 4 giờ và chưa bắt đầu: phải gửi yêu cầu hủy sát giờ. Helper trả too_late khi remaining < 0; service tạo yêu cầu CANCEL từ chối start <= now, nên đúng thời điểm bắt đầu không được gửi mới. [customer-cancellation-policy](../../src/bookings/customer-cancellation-policy.ts), [ChangeRequestsService](../../src/bookings/change-requests.service.ts) |
| BR-05 | Yêu cầu đổi/hủy dành lịch PENDING/CONFIRMED thuộc khách. Một yêu cầu pending chưa hết hạn; hết hạn 24 giờ. Đổi lịch còn phụ thuộc allowRescheduleRequests và giới hạn số yêu cầu đổi (đếm cả các trạng thái, không chỉ lần được duyệt). Duyệt kiểm tra lại slot. Hủy sát giờ ghi vi phạm lúc gửi; từ chối/hết hạn không tự xóa vi phạm. [ChangeRequestsService](../../src/bookings/change-requests.service.ts) |
| BR-06 | Cửa sổ 90 ngày: hủy sát giờ trọng số 1, no-show trọng số 2. Điểm 2 cảnh báo; điểm 3 yêu cầu xác nhận khi còn được tự đặt. Điểm >=4 hoặc sự kiện mới trong hạn chế đang còn hiệu lực đặt endsAt = thời điểm sự kiện +30 ngày. Đọc policy không tự kích hoạt/gia hạn. Sự kiện hợp lệ bất biến, void có dấu vết; không suy có API salon miễn vi phạm. [customer-booking-policy](../../src/bookings/customer-booking-policy.ts) |
| BR-07 | Check-in sớm mặc định 30 phút; bắt đầu sớm mặc định 0 phút (hai giá trị có env). Hoàn tất sau/đúng giờ kết thúc. No-show chỉ khi now > start +15 phút, có người xác nhận và noShowConfirmed. Chặn khi có dấu vết đã đến/đã thực hiện hoặc yêu cầu hủy đủ điều kiện loại trừ. Không ghi vi phạm policy cho khách vãng lai không có tài khoản khách hợp lệ. [bookings.validation](../../src/bookings/bookings.validation.ts), [BookingsService](../../src/bookings/bookings.service.ts) |
| BR-08 | Registry chỉ có CASH_INTERNAL và BANK_TRANSFER. Tiền mặt được xác minh trong adapter, chuyển khoản cần xác minh thủ công. Hoàn tiền: OWNER/ADMIN yêu cầu/duyệt theo scope; không tự duyệt yêu cầu mình lập; chỉ ADMIN xử lý START/CONFIRM/FAIL. Không khẳng định tự chuyển tiền qua ngân hàng. [registry](../../src/payments/providers/payment-provider.registry.ts), [PaymentsService](../../src/payments/payments.service.ts) |
| BR-09 | Đánh giá yêu cầu lịch hoàn tất thuộc khách, điểm 1–5, service rating khớp phần dịch vụ/chuyên viên trong lịch. bookingId unique. Tạo đánh giá ban đầu APPROVED; không thêm bước duyệt bắt buộc trước đăng. [ReviewsService](../../src/reviews/reviews.service.ts) |
| BR-10 | Hồ sơ DRAFT/NEED_MORE_INFO được chỉnh theo điều kiện, gửi phải đủ dữ liệu; chính sách có thể autoApproveNewSalons. Quyết định thẩm định và publish readiness tách riêng. [BusinessOnboardingService](../../src/business/business-onboarding.service.ts), [BranchesService](../../src/branches/branches.service.ts) |
| BR-11 | Catalog CanonicalService → BusinessService → BranchServiceOffering; model cuối map services. StaffProfile.userId tùy chọn và unique; phần dịch vụ của lịch có thể chưa có staff. Không suy composition chỉ từ FK/Cascade. [schema](../../prisma/schema.prisma) |

## Trạng thái trọng tâm

Booking có state map chung, tiếp tục bị ràng buộc bởi actor map và time guards. Không đọc bảng sau thành quyền cho mọi actor.

| Trước | Đích trong state map chung |
|---|---|
| PENDING | CONFIRMED, CANCELLED, REJECTED, EXPIRED |
| CONFIRMED | CHECKED_IN, CANCELLED, NO_SHOW |
| CHECKED_IN | IN_PROGRESS, CANCELLED |
| IN_PROGRESS | COMPLETED, CANCELLED |
| COMPLETED / CANCELLED / REJECTED / EXPIRED / NO_SHOW | Kết thúc theo map |

Nguồn: [ALLOWED_STATUS_TRANSITIONS và ACTOR_STATUS_TRANSITIONS](../../src/bookings/bookings.validation.ts). STAFF bắt đầu/hoàn tất phần dịch vụ được giao; quyền của Receptionist ở controller không đồng nghĩa được START/COMPLETE phần việc. [BookingItemsService](../../src/bookings/booking-items.service.ts).

Yêu cầu thay đổi: PENDING → APPROVED/REJECTED/EXPIRED theo service/scheduler. Booking cũ không tự đổi khi mới gửi yêu cầu. Hoàn tiền, chuyển chủ, onboarding có các nhánh trạng thái riêng tại đặc tả SUC và service; danh mục enum đầy đủ ở từ điển dữ liệu, không biến mọi giá trị enum thành transition hợp lệ.

Chuyển chủ: PENDING_NEW_OWNER_ACCEPTANCE → UNDER_REVIEW khi đúng người nhận xác nhận. Review có NEED_MORE_INFO/REJECTED hoặc APPROVED/SCHEDULED theo điều kiện. Execute kiểm tra phê duyệt, xác nhận, hiệu lực, tác động và tương thích tài khoản trước cập nhật chủ/lịch sử. Worker không bỏ qua những điều kiện của service.

## Dữ liệu và ràng buộc

121 model và 92 enum trong snapshot nguồn. [Coverage](05-data-model/model-coverage.md) liệt kê model → bảng vật lý → miền/hình, bao gồm tám model di sản trong hai miền. [Từ điển](05-data-model/data-dictionary.md) giữ toàn bộ field/annotation; [catalogue](05-data-model/relationship-catalog.md) liệt kê 296 FK khai báo có fields/references. Hình là phép chiếu rút gọn và công bố quan hệ bị lược; không phải mỗi field Id là FK.

Các điểm trọng tâm: Booking có nhiều BookingService và Payment; Review.bookingId unique; StaffProfile.userId optional unique; BookingService.staffId optional; bảng nối promotion/voucher/combo có unique/khóa ghép; chính sách và vi phạm tách lịch sử sự kiện với trạng thái áp dụng.

SQL migration có partial unique một vi phạm không void/booking, unique policy theo khách–doanh nghiệp, kiểm tra nguồn/scope, trigger tách tài khoản, kiểm soát overlap với advisory lock. [Danh mục SQL](05-data-model/sql-constraints.md) giữ nguồn theo thứ tự lịch sử; migration sau có thể thay hàm/trigger trước. Chưa kiểm chứng migration nào đã chạy trên DB thực.

## Chênh lệch và điểm cần xem lại

| Mã | Quan sát có căn cứ | Hệ quả cho sơ đồ |
|---|---|---|
| GAP-01 | OwnershipService tạo actionUrl `/customer/benefits?tab=ownership`; App.jsx đặt trang trong workspace CUSTOMER. Chủ mới lại phải tương thích BUSINESS_OWNER, không được có CUSTOMER. Accept không có Roles decorator; nó kiểm tra phiên và đúng newOwnerUserId. | Backend có nhận chuyển giao, nhưng không gọi luồng web là hoàn chỉnh; không ghi sai rằng accept bắt buộc role OWNER. |
| GAP-02 | Gói buổi có API rộng hơn các caller web đã xác minh. | Đánh dấu một phần; chưa cam kết mua/trả góp/đổi buổi đầy đủ ở giao diện. |
| GAP-03 | Privacy tiếp nhận yêu cầu và xuất dữ liệu, chưa chứng minh toàn vòng đời xóa dữ liệu; ReviewsContext mobile có state cục bộ. | Không suy yêu cầu xóa đã thực hiện hoặc đánh giá mobile đã đồng bộ server. |
| GAP-04 | AdminServiceTaxonomy.jsx tồn tại nhưng không có route/import trong App.jsx hiện tại. | Catalog API có; web taxonomy chưa có lối vào đã chứng minh. |
| GAP-05 | Một số comment/enum/bảng di sản còn nhắc chức năng đã bỏ hoặc role cũ. | Chỉ dùng module/guard/service/caller hiện hành làm bằng chứng tính năng hoạt động. |

Các thay đổi ứng dụng để giải quyết gap nằm ngoài lượt làm tài liệu này. Cần người phụ trách nghiệp vụ duyệt thuật ngữ BUC và ranh giới phối hợp trước khi đưa vào luận văn. Chưa kiểm thử khả năng gửi email/push, thanh toán ngoài hệ thống, đồng bộ nhiều tài khoản, hoặc trạng thái DB production.
