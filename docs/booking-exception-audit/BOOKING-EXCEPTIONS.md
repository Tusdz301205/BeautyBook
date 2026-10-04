# Scenario ngoại lệ đã kiểm tra

Mỗi ID tương ứng đúng một dòng trong [ma trận](BOOKING-EXCEPTION-MATRIX.md). `NOT RUN` cho tất cả test execution. Đường dẫn `src/` và `prisma/` bên dưới tính từ thư mục backend `beauty-booking-api-main/`; `mobile/` tính từ root repo.

### BE-01 — Hai create tranh cùng provider/customer — HANDLED

Tiền đề: hai request cùng slot, cả hai thấy availability. Tại create, service chọn provider trong Serializable transaction, lấy advisory lock theo provider rồi customer, kiểm overlap (`src/bookings/bookings.service.ts:1172-1374`). Migration `20260829_remove_attendance_workforce/migration.sql:180-238` định nghĩa trigger staff; `20260729_use_nonblocking_booking_slot_locks/migration.sql:68-113` định nghĩa trigger customer. Kỳ vọng một request thành công, request kia conflict. Source đáp ứng điều kiện nếu migrations đã áp dụng; runtime chưa xác minh. Test integration `src/bookings/postgres-hardening.integration.spec.ts:183-346` có assertion một hold; chưa chạy. Rule BR-03/04. Không gọi trigger là exclusion constraint.

### BE-02 — Slot/catalog hiển thị cũ trước confirm — HANDLED trong final create

T1 đọc `getAvailableSlots` (`bookings.service.ts:1917-2157`); T2 có actor khác đổi slot/catalog; T3 create re-read branch/channel, catalog `FOR SHARE`, duration/version, staff/overlap (`1183-1374`), từ chối nếu stale. Preview không giữ slot. Giá promo/voucher reserve được xử lý trong transaction qua PricingEngine; UI có thể cần tải lại. Chưa kiểm chứng mọi thay đổi price-only tại runtime, nên kết luận HANDLED chỉ cho slot/catalog eligibility, không mở rộng sang settlement. BR-02/03/05.

### BE-03 — Customer/tenant đọc hoặc sửa booking người khác — HANDLED cho route đã kiểm

`bookings.controller.ts:867-895` dùng `BookingsAccessService.loadAndAssert`; `bookings-access.service.ts:77-114,126-181` đối chiếu customer.userId, branch.businessId, staff assignment và permission trên resource. `assertCustomerCreate:200-230` lấy profile từ principal, không tin customerId body ở customer-only. List/scheduler cần điều kiện scope riêng, xem ownership audit. Kết luận không bao trùm route ngoài inventory. BR-01.

### BE-04 — Chuyển trạng thái sai hoặc terminal bị sửa — HANDLED

`bookings.validation.ts:15-86` định nghĩa allowed transition và actor; `bookings.service.ts:511-529,630-651` kiểm trước và CAS `where id,status` trong Serializable transaction. Customer, salon, staff có quyền khác nhau; platform write bị `bookings-access.service.ts:137-144` chặn trên endpoint vận hành. Parent-child khi hoàn thành có ngoại lệ BE-05. BR-06.

### BE-05 — Complete và add item đan xen — NOT HANDLED, G-01

Tiền đề booking `IN_PROGRESS`, mọi item hiện tại terminal. Complete đọc items ở `bookings.service.ts:442-480` **trước** Serializable transaction tại `560`; add item khóa booking, thấy `IN_PROGRESS`, tạo item `SCHEDULED` rồi cập nhật end time tại `booking-items.service.ts:27-82`. Nếu add commit sau pre-read nhưng trước complete transaction bắt đầu, complete CAS chỉ so `status` (`630-651`), không kiểm lại child set; trạng thái cuối có thể `COMPLETED` + `SCHEDULED`. Nếu giao nhau trong transaction, Serializable có thể abort; đó không phủ interleaving nêu trên. Cần test PostgreSQL buộc thứ tự. BR-06/07. Impact: báo hoàn thành sai, lịch và báo cáo sai. Xem concurrency audit.

### BE-06 — Archive catalog sau precheck, create chen vào — PARTIALLY HANDLED, G-02

`services.service.ts:755-782` đếm future booking **ngoài** archive transaction rồi update catalog/offering. Create khóa `business_services FOR SHARE` trong transaction (`bookings.service.ts:1200-1215`) nên nếu archive đã update trước create lock, create có thể conflict/revalidate. Chiều ngược lại: archive precheck = 0; create commit booking; archive sau đó lấy row lock và update, không recheck future bookings. Serializable của create không bảo vệ một writer archive bắt đầu transaction sau commit. Cần test interleaving. BR-02/10. Lịch tương lai còn nhưng catalog không hoạt động.

### BE-07 — Offboard staff dùng impact COMPLETED cũ — PARTIALLY HANDLED, G-03

`staff.service.ts:474-505` tải future booking; `deactivate:521-549` nếu có booking chỉ tìm bất kỳ case `COMPLETED` của staff, không đối chiếu ID booking hiện tại với resolved items. Sau đó cập nhật staff/assignment trong transaction `551-589` mà không recheck tập booking. Tình huống áp dụng: case cũ hoàn tất; booking mới được tạo; deactivate cho qua. Nếu case xử lý trước đó chỉ còn booking đã reassigned thì không có vấn đề; gap nằm ở booking phát sinh mới. BR-03/10.

### BE-08 — Close/pause branch khi có booking mới — HANDLED trong flow transition đã đọc

`branch-state.service.ts:73-115` precheck và tạo impact case; `117-129` lấy branch `FOR UPDATE`, đọc lại active booking và yêu cầu từng booking được `completedImpactCovers` (`14-36`) xác nhận. T1 create thông thường không lấy branch `FOR UPDATE` (`bookings.service.ts:1264-1279` chỉ controlled overflow), nhưng Serializable + re-read branch tại `1183-1195` và branch writer update cần thử runtime để xác nhận lịch khóa cụ thể. Không khẳng định mọi branch writer an toàn; BE-08 chỉ transition này. BR-10.

### BE-09 — Khách hủy sát giờ hoặc sau đổi lịch — HANDLED cho direct cancel

`bookings.service.ts:531-557` áp chính sách; trong transaction customer cancel khóa booking, đọc lại giờ và kiểm cutoff (`617-627`), CAS status và cascade item (`630-655`). Change request có quy tắc riêng BE-10. BR-08.

### BE-10 — Salon approve yêu cầu khi booking đã đổi — HANDLED cho status/cutoff/slot

`change-requests.service.ts:286-315` khóa booking, claim request còn PENDING/chưa hết hạn, chặn booking không còn PENDING/CONFIRMED; reschedule kiểm lại cutoff, từng item staff/overlap và customer overlap (`323-374`), rồi update booking/items cùng transaction (`437-505`). Approval không được xem là bằng chứng payment/refund đã hoàn tất. BR-03/04/08.

### BE-11 — Recurring dở dang khi chết process/compensation lỗi — PARTIALLY HANDLED, G-04

`recurring.service.ts:39-147` preview rồi create từng occurrence; khi lỗi bắt được, claim `FAILED`, quét booking đã commit, cố compensation (`97-141`). Worker đăng ký trong `recurring.module.ts:5` quét `CREATING` quá 10 phút (`recurring-plan-recovery.worker.ts:27-65`), chuyển `FAILED` và **giữ** booking đã tạo, gửi outbox. Worker không quét `FAILED` có compensationFailed; case này báo kiểm tra thủ công. Đúng hơn là có recovery CREATING nhưng không có tự động hoàn tất/hoàn tác FAILED. Policy giữ kỳ sau crash và hủy kỳ sau lỗi bắt được khác nhau; cần product owner xác nhận. BR-11.

### BE-12 — Impact item kẹt PROCESSING sau crash — NOT HANDLED, G-05

`impact.service.ts:58-62` claim `PENDING→PROCESSING` ngoài transaction mutation; các gọi `bookingItems.update`/`moveBooking`/`updateStatus` thực hiện trước finalize `RESOLVED` (`81-189`). `catch` chỉ reset khi process còn sống (`191-198`). `ImpactDeadlineWorker` được đọc chỉ tạo nhắc deadline (`impact-deadline.worker.ts:~20-45`), không thấy recovery PROCESSING. Crash sau mutation có thể để booking đã đổi nhưng item kẹt, chặn complete case. Một số nhánh mutation nhiều item còn có partial success. BR-10/12.

### BE-13 — Guest tại quầy thất bại booking để lại shadow profile — CANNOT CONFIRM policy

`bookings.controller.ts:275-304` tạo `User` và `CustomerProfile` trước khi gọi `BookingsService.create`, vốn mở transaction riêng tại `bookings.service.ts:1172`. Slot conflict, catalog stale hay lỗi reserve có thể rollback booking nhưng không rollback shadow profile. Đây là shadow profile không có booking của attempt đó. Chưa biết sản phẩm cố ý giữ lead hay yêu cầu atomic; vì vậy **không** gán gap/severity đã xác nhận. Cần product owner quyết định lifecycle lead. BR-01/12.

### BE-14 — Hoàn tiền và booking cancel không đồng bộ — CANNOT CONFIRM, DEFERRED_PAYMENT

`impact.service.ts:98-107` hủy booking rồi lần lượt request refund; đây là các transaction riêng. Thất bại ở refund có thể để booking cancelled và refund chưa được yêu cầu. `payments.service.ts` có bảo vệ refund reservation; không được suy ra tiền đã chi vượt hạn mức chỉ từ số request. Không kiểm settlement/callback/processor trong audit này. Cần audit payment riêng và runtime sandbox. BR-08; không tính vào root cause booking đã xác nhận.

### BE-15 — Đóng ngày/thu hẹp giờ làm sau khi đã có lịch — NOT HANDLED, G-06

`staff.service.ts:599-627` upsert branch holiday/special day trực tiếp, không tìm hay xử lý booking đã đặt. `branches.service.ts:916-930` thay toàn bộ working hours trong transaction nhưng không có precheck future booking/impact. `bookings.validation.ts:173-210` và `bookings.service.ts:1980-2004` dùng lịch mới để chặn slot mới; các booking cũ không tự đổi. Nếu salon đóng ngày có booking CONFIRMED, hệ thống vẫn giữ lịch đó nhưng availability mới báo đóng — cần nhân sự chủ động xử lý lịch hiện hữu. Test còn thiếu: tạo booking ngày X, đóng X, assert hệ thống chặn thay đổi hoặc tạo impact, không để booking active ngoài giờ không có cảnh báo. BR-03/10. Đây là gap lifecycle, không phải double-booking.

### BE-16 — Giờ địa phương, giờ quá khứ và booking qua ngày — HANDLED cho create/validation đã đọc

`bookings.service.ts:970-994` parse ISO instant, kiểm tương lai, lead/horizon, không hỗ trợ booking qua ngày; `bookings.validation.ts:173-210` lấy ngày/giờ theo booking timezone, so với holiday/special/working hours dưới dạng wall-clock. `getAvailableSlots:1971-2004` tính cửa sổ ngày. Có test boundary tại `available-slots-policy.spec.ts:29-36`, chưa chạy. Chưa kiểm cấu hình timezone khác Asia/Bangkok ở runtime; status chỉ áp cho logic source hiện tại, không xác nhận mọi timezone triển khai. BR-03/05.

### BE-17 — Đánh giá trước hoàn thành, sai customer/item hoặc đánh giá trùng — HANDLED

`reviews.service.ts:302-340` kiểm booking thuộc customer principal, status COMPLETED, chưa review, service rating thuộc booking và staff khớp; `prisma/schema.prisma:1585-1588` có `bookingId @unique` chống race hai review cùng booking. Nếu BE-05 khiến parent COMPLETE sai khi còn item active, điều kiện review dựa trên parent có thể chấp nhận đánh giá sớm — đó là hậu quả của G-01, không tạo root cause mới. Test execution NOT RUN. BR-01/06.

### BE-18 — Branch submit/review state và hồ sơ commit khác transaction — PARTIALLY HANDLED, G-07

`branches.service.ts:1182-1225` gọi `BranchStateService.transition(SUBMIT)` trước, sau đó mới mở transaction ghi `submittedAt`, review request/event, document statuses và notification. `review:1273-1312` cũng transition APPROVE/REQUEST_INFO/REJECT trước transaction cập nhật review request/event/documents. Trong mỗi transaction thứ hai các bản ghi phụ thuộc cùng commit, nhưng **branch state transition đã commit riêng** (`branch-state.service.ts:117-~160`). Nếu transaction thứ hai thất bại, branch state có thể PENDING_REVIEW/APPROVED trong khi request/documents chưa tương ứng. Source có kiểm impact trước transition nhưng không có compensation cho lỗi ở bước hai. Đây là lệch workflow; không khẳng định một nhánh đã công khai nhận booking trước `PUBLISH` nếu chưa xem target state cụ thể. Cần fault injection sau transition, assert state/request/document nhất quán. BR-02/10.
