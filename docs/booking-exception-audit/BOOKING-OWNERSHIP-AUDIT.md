# Ownership và tenant isolation

Nguồn chính: `beauty-booking-api-main/src/bookings/bookings.controller.ts:185-1320` và `bookings-access.service.ts:44-245`. Guard `@Roles`/`@RequirePermission` là lớp thô; quyền theo booking cụ thể xét `customer.userId`, `branch.businessId`, branch scope và staff assignment (`loadAndAssert:77-114`). Bảng chỉ phản ánh route đã đọc, không là lời khẳng định về mọi endpoint ngoài booking.

| Actor | Create | List/detail | Mutate/cancel | Scope thực thi |
| --- | --- | --- | --- | --- |
| CUSTOMER | Self profile, branch thật (`assertCustomerCreate:200-230`) | `my-appointments`/detail self (`controller:545-~635,867-895`) | Cancel/request thay đổi khi được policy cho phép | `customer.userId`, không tin `customerId` từ body |
| BUSINESS_OWNER | Tạo lịch tại business/branch được cấp (`controller:245-304`) | Tenant-wide; branch list theo business | Update/reschedule/service lifecycle theo resource permission | Scope `businessId`, `rolesAtResource:184-192` |
| RECEPTIONIST | Counter booking tại branch được cấp | Branch-wide `assertReadBranch:44-55` | Confirm/check-in/cancel/assign theo permission | Scope branch, không ghép role branch A với staff branch B |
| STAFF | Không có create endpoint của riêng staff | Lịch được phân công; detail kiểm `staffUserId` (`controller:890-892`) | Chỉ thao tác item START/COMPLETE của mình (`booking-items.service.ts:101-116`) | staff profile `userId`, item assignment hiện tại |
| PLATFORM_ADMIN | Bị chặn create vận hành (`assertCustomerCreate:204-208`) | Platform read | `assertWrite:137-144` chặn update vận hành; force-cancel/refund có route/guard riêng | Platform scope; payment deferred |

Các filter do client gửi không được dùng như bằng chứng quyền. `assertReadBranch` giải businessId từ branch thật; detail `loadAndAssert` truy booking rồi mới kiểm resource. `controller:418-~865` có các list `list`, `my-appointments`, `salon-queue`, `scheduler`, `by-branch`, `by-customer`; cần bảo đảm từng query áp scope ngay trong DB (đặc biệt scheduler/socket/export). Các route list đã được đọc ở mức predicate/controller nhưng **chưa có runtime multi-tenant probe** trong task này; kết luận BE-03 giới hạn ở các đường đã đối chiếu, không kết luận “toàn hệ thống không IDOR”.

Cross-entity: create offering kiểm `branchId` (`bookings.service.ts:865-875,1203-1210`); staff validation kiểm branch/capability; `booking-items.service.ts:102-105` kiểm `itemId` thuộc `bookingId` trong URL; change request lấy booking từ request và lock đúng booking (`change-requests.service.ts:194-205,286-315`); impact transfer kiểm branch replacement/status/offering (`impact.service.ts:238-271`). Không xây invariant dựa trên field không tồn tại. Nếu role/session bị thu hồi sau JWT phát hành, `rolesAtResource` xét scope expiry (`bookings-access.service.ts:184-192`), nhưng thời điểm thu hồi session giữa request và commit chưa có runtime test; không gán verdict vượt bằng chứng.

Review phụ thuộc booking: `reviews.service.ts:~290-350` kiểm booking/customer, trạng thái hoàn thành, rating item thuộc booking và staff khớp; review sau khi booking bị thay đổi là câu hỏi policy lịch sử, không được coi là bypass booking ownership trong phạm vi này. Socket/realtime và notification payload cần test recipient-scope riêng; task không gửi notification.

Test nguồn: `bookings-tenant-scope.spec.ts`, `booking-role-refactor.spec.ts`, `bookings.controller.spec.ts` có các trường hợp RBAC; chưa chạy. Test đề nghị: tạo 2 business/2 branch/2 customer/1 multi-role user, thử từng list/detail/mutation với ID và filter giả, assert 403/404 hoặc list rỗng và không đổi DB. Đặc biệt thử staff branch B có receptionist branch A và scheduler branch B. Execution: NOT RUN.
