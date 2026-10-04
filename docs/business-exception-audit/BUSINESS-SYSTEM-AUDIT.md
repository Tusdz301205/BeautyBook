# Hệ thống nghiệp vụ theo source hiện tại

## Baseline và độ tin cậy

Baseline trong [README](README.md). Source code là bằng chứng *implementation*; [glossary](../../beauty-booking-api-main/docs/thesis-diagrams/GLOSSARY.md), [traceability](../../beauty-booking-api-main/docs/thesis-diagrams/TRACEABILITY.md), [BUC](../../beauty-booking-api-main/docs/thesis-diagrams/01-business-use-cases/specifications.md) và [SUC](../../beauty-booking-api-main/docs/thesis-diagrams/02-system-use-cases/specifications.md) là đầu mối *expected behavior* cần đối chiếu, không phải policy đã được product xác nhận. `main.ts:76–91` gắn global validation, `/api/v1` và guard trong `app.module.ts:77–91`. Lớp resource checks vẫn nằm tại services, ví dụ `bookings-access.service.ts:44–251`. Không suy quyền từ menu.

## Actor, workspace, quyền và tài nguyên

`schema.prisma:3033–3040` liệt kê `PLATFORM_ADMIN`, `BUSINESS_OWNER`, `RECEPTIONIST`, `STAFF`, `CUSTOMER`, `GUEST`; `:2983–2987` liệt kê `CUSTOMER`, `SALON`, `PLATFORM`. `GUEST` là enum, không đồng nghĩa tài khoản guest được mọi permission; route tạo guest có policy riêng ở `bookings.controller.ts:180–260`. Principal phải đồng thời có role/permission, workspace đúng, business membership hoặc branch assignment và quyền trên resource. `bookings-access.service.ts:62–225` là nguồn kiểm tra booking; `ownership.service.ts:13–61` phân biệt người đề nghị và người tiếp nhận; `staff.controller.ts:79–153` giới hạn lời mời cho owner. Web `src/App.jsx:300–390` có `ProtectedRoute` và `PermissionGate` để điều hướng, không thay server guard. Mobile `src/api/bookings.ts:23–75` là CUSTOMER consumer.

## Entity, trạng thái và quan hệ

`schema.prisma:376–540`: `Business` chứa `Branch`; branch có ba chiều `status`, `reviewStatus`, `operationalStatus`. `:755–887`: `CanonicalService` là taxonomy, `BusinessService` là catalog, `BranchServiceOffering` (`services`) là sản phẩm đặt tại branch, `StaffService` là năng lực. `:1014–1122`: `Booking` thuộc `Branch` và `CustomerProfile`; mỗi `BookingService` tham chiếu `BranchServiceOffering`, staff có thể nullable, có revision và snapshot tên/giá/thời lượng. `:1820–1884` chứa yêu cầu đổi lịch/vi phạm; `:2324–2376` chứa impact; `:2624–2674` chứa chuyển chủ; `:1169–1584` chứa payment/refund/package; `:1677–1706` chứa notification outbox.

Enum lưu DB: `BookingStatus` ở `schema.prisma:3208` gồm PENDING, CONFIRMED, CHECKED_IN, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW, REJECTED, EXPIRED. `BookingLifecycleStatus` ở `:3023` là biểu diễn hẹp hơn; không tự gộp REJECTED/EXPIRED với CANCELLED khi đọc lịch sử. `BookingServiceStatus` ở `:3160` gồm SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, SKIPPED. `BusinessStatus` ở `:3066`, ba enum Branch ở `:3077–3101`, StaffStatus ở `:3131`. Enum không chứng minh transition reachable; xem [state machine](BOOKING-STATE-MACHINE.md).

## Inventory UC và business rule

| UC | Luồng thực thi | Actor chính | Rule đã thấy và scope | Điểm server / test liên quan |
| --- | --- | --- | --- | --- |
| UC-ACCOUNT | Đăng nhập, tự quản lý hồ sơ | CUSTOMER/SALON/PLATFORM | BR-ACCOUNT: phiên/workspace và resource owner đúng; không suy từ profile | `auth.service.ts`, `jwt.strategy.ts`, `users.service.ts`; `auth-remediation.spec.ts` |
| UC-BUSINESS | Draft, submit, review hồ sơ doanh nghiệp | OWNER/admin | BR-BUSINESS: checklist theo setting, status/updatedAt CAS, tài liệu cùng quyết định | `business-onboarding.service.ts:438–568`; `business-onboarding.service.spec.ts` |
| UC-BOOK | Xem slot → quote → tạo booking web/mobile/counter | CUSTOMER/RECEPTIONIST/OWNER | BR-BOOK: branch, service, staff, giờ, booking restriction và channel phải hợp lệ tại commit; override nếu được cấp riêng | `bookings.controller.ts:180–400`, `bookings.service.ts:817–1580`, `bookings-access.service.ts:200`; booking specs |
| UC-STATUS | Xác nhận, check-in, bắt đầu item, hoàn thành, no-show | salon/staff | BR-STATE: whitelist theo actor + thời điểm + item; terminal không quay active | `bookings.validation.ts:10–86`, `bookings.service.ts:421–710`, `booking-items.service.ts:105–210` |
| UC-CANCEL | Tự hủy hoặc xin hủy sát giờ | CUSTOMER/salon | BR-CANCEL: self-cancel còn ít nhất 4h, sau đó request riêng trước start; no-show cần xác nhận | `customer-cancellation-policy.ts:4–30`, `change-requests.service.ts:56–173`, `bookings.service.ts:560–618` |
| UC-MOVE | Dời giờ, đổi staff, yêu cầu thay đổi | CUSTOMER/salon | BR-MOVE: active booking, target eligible, slot không trùng, cutoff/expiry | `change-requests.service.ts:183–`, `bookings.service.ts:2159–2570` |
| UC-BRANCH | Onboard, review, publish, pause/close/restore | OWNER/admin | BR-BRANCH: ba chiều trạng thái và lịch còn hiệu lực cần impact | `branches.service.ts:1142–`, `branch-state.service.ts:14–207` |
| UC-IMPACT | Xử lý lịch khi branch/staff thay đổi | OWNER/salon | BR-IMPACT: từng booking có resolution và case hoàn tất trước transition | `impact.service.ts:50–235`, `branch-state.service.ts:14–130` |
| UC-STAFF | Mời, gán năng lực/branch, offboard | OWNER | BR-STAFF: staff active/bookable/branch/service; lịch cũ phải xử lý | `staff-invitations.service.ts:32–`, `staff.service.ts:369–577` |
| UC-CATALOG | Tạo/ẩn/lưu trữ offering, combo, recurring | OWNER/CUSTOMER | BR-CATALOG: đúng business/branch, active/bookable, snapshot lịch sử | `services.service.ts:519–887`, `combos.service.ts`, `recurring.service.ts:13–130` |
| UC-RECURRING | Preview và tạo chuỗi lịch | CUSTOMER | BR-BOOK: từng occurrence phải hợp lệ tại commit, failure cần reconcile | `recurring.service.ts:13–141`, `recurring.service.spec.ts` |
| UC-PROMO | Preview, reserve, apply/release voucher/promotion | CUSTOMER/OWNER | BR-PROMO: scope, thời hạn, quota, version tại commit | `pricing-engine.service.ts:28–247`, `bookings.service.ts:1172–` |
| UC-PAY | Ghi nhận khoản thu, verify, reverse, refund, package | salon/admin/customer | BR-PAY: số tiền, booking và entitlement phù hợp; payment không mặc định bắt buộc trước booking | `payments.controller.ts:25–252`, `payments.service.ts:149–1703` |
| UC-REVIEW | Đánh giá, báo cáo, phản hồi, moderation | CUSTOMER/OWNER/admin | BR-REVIEW: customer đúng booking COMPLETED; item/staff đúng | `reviews.service.ts:280–365`, `reviews.controller.ts:106–219` |
| UC-OWNER | Đề nghị, chấp nhận, review, execute chuyển chủ | OWNER/recipient/admin | BR-OWNER: recipient hợp lệ, CAS status, grants/history đồng bộ | `ownership.service.ts:13–282` |
| UC-NOTIFY | Lời mời/reminder/outbox | SYSTEM/salon | BR-NOTIFY: thông báo cần cho use case phải có delivery/retry minh bạch | `staff-invitations.service.ts:65–112`, `policy-notification.cron.ts:15–69`, `notification-outbox.worker.ts` |

Other registered modules: reports, admin, privacy, media, saved-services, platform-settings, notifications, operations, ownership, payments (`app.module.ts:38–74`). Chúng được kiểm tra ở mức reachability và quan hệ; không phải mọi endpoint đều đã được trace sâu trong catalog.

## Invariant xuyên thực thể, stale data và đồng thời

`Booking.branch.businessId` phải khớp `BranchServiceOffering.branch.businessId`; `BookingService.staffId` phải thuộc branch, active/bookable và có `StaffService`; actor phải có quyền trên booking cụ thể. Create khóa catalog/offering/variant `FOR SHARE` và branch `FOR UPDATE` rồi recheck trong Serializable (`bookings.service.ts:1172–1265`); exclusion constraint cho staff overlap nằm trong `prisma/migrations/20260829_remove_attendance_workforce/migration.sql:200–240`. Migration tồn tại chưa chứng minh DB demo đã áp dụng. Quote/availability là preview; commit phải recheck version/quota và có hướng client reload. `pricing-engine.service.ts:180–245` có recheck version, nhưng race quota cần PostgreSQL test. Booking idempotency dùng Redis, không phải receipt DB (`idempotency.interceptor.ts`); kết quả sau commit/lỗi response chưa chứng minh replay bền vững.

Race chính: A bắt đầu create booking, B archive offering hoặc pause branch; A/B phải cùng khóa row theo cùng protocol trước check+write. Offering create path đã khóa, branch create khóa branch; archive/offboard writer khác cần kiểm tra độc lập. A/B cùng chuyển status dùng CAS trong transaction (`bookings.service.ts:629–669`). A xử lý impact item chuyển `PROCESSING`, B/worker chết sau mutation booking trước finalize: item có thể kẹt, xem BEX-10.

## Delete/deactivate và lịch sử

| Entity → operation | Actor | Dependent records | Cách ghi/guard hiện tại | Tác động lịch tương lai & lịch sử |
| --- | --- | --- | --- | --- |
| User → suspend | admin | sessions, bookings, profile | `users.service.ts`, safe projection; session revocation từ remediation | Chưa xác minh UI recovery của booking khách đã có |
| Business → suspend/review | admin | branches, bookings | `business-onboarding.service.ts:438–568`; `branch-state.service.ts:48–62` tính public/bookable | Booking cũ không bị xóa; xử lý impact cần xem policy cụ thể |
| Branch → pause/close/archive | owner/admin | bookings, offerings | `branch-state.service.ts:65–174` dùng impact và transition history | Lịch active phải được cover; race create/transition chưa test DB |
| Staff → deactivate | owner | assigned `BookingService`, assignment, invitation | `staff.service.ts:474–577` tạo impact và kết thúc assignment | Giữ staff/booking history; race tạo booking mới còn mở |
| Catalog/offering → archive | owner | booking items | `services.service.ts:755–887` kiểm tra future booking rồi soft delete | Snapshot item giữ tên/giá; race writer chưa test DB |
| Booking → cancel/expire/no-show | customer/salon/system | items, payments, redemption | `bookings.service.ts:629–710`, `booking-item-lifecycle.ts:8–20` | Chỉ item chưa hoàn tất bị CANCELLED, item đã hoàn tất giữ lịch sử; refund riêng |
| Review → moderate | admin | ratings, report/appeal | `reviews.service.ts:475–` | Cần kiểm tra aggregate public sau moderation, chưa xác nhận runtime |

DB FK/restrict/cascade trong `schema.prisma` chỉ là bảo vệ tham chiếu, không tự giải quyết UX/history. Không reset, seed, migrate hoặc đụng dữ liệu hiện hữu trong audit.

## Mâu thuẫn và ambiguity

- AMB-01: tài liệu luận văn mô tả BUC/SUC, nhưng một số nguồn cũ còn role hoặc tính năng đã gỡ; `AppModule`/controller hiện tại quyết định reachability. Cần product duyệt lại bản mô tả cuối.
- AMB-02: `APPROVED` của business có được hiển thị công khai khi branch `ACTIVE` và review approved? Code cho phép `APPROVED` **hoặc** `ACTIVE` (`branch-state.service.ts:48–62`); cần tên trạng thái sản phẩm rõ.
- AMB-03: `BookingLifecycleStatus` thiếu REJECTED/EXPIRED so với `BookingStatus`; cần quyết định mapping API cho lịch sử/migration, không tự đồng nhất.
- AMB-04: chính sách sau khi invitation mail thất bại, auto reminder miss window, và partial refund/package reservation cần product + operations xác nhận SLA/recovery.
- AMB-05: staff `isBookable=false` giữ lịch đã gán hay bắt buộc impact? Code phân biệt với `INACTIVE`; cần UI giải thích chính xác.

Coverage: đã trace sâu booking/status/cancel, branch/impact, staff invitation/offboard, catalog, ownership, payment/package ở mức code path; review/promotion/recurring ở mức guard và selected writer; privacy/reports/media/saved-services/admin-governance chỉ inventory/read path. Không kiểm chứng dữ liệu runtime, migration trạng thái DB hay tất cả alternative writer.

## Đối chiếu assertion hiện có và kiểm chứng còn thiếu

Không chạy test trong task này. Các assertion dưới đây được **đọc source**, không phải kết quả chạy mới; [remediation cũ](../exception-audit/REMEDIATION-RESULTS.md) có execution riêng của lượt trước.

| Miền/BEX | Assertion hiện có | Không chứng minh được |
| --- | --- | --- |
| BEX-06 | `customer-cancellation-policy.spec.ts:70–97`: đúng mốc 4h, reject late, recheck reschedule dưới lock | API/browser timezone thực |
| BEX-07 | `no-show-policy.spec.ts:93–132`: reschedule stale, arrival history, audit failure | Legacy DB history/multi-worker |
| BEX-03 | `idempotency.interceptor.spec.ts:79–129`: replay, semantic conflict, owner nonce | Commit DB rồi Redis/response fail |
| BEX-11 | `branch-state.service.spec.ts:6–41`: completed impact mới, coverage mọi booking, row-lock recheck | PostgreSQL A/B branch/create |
| BEX-14 | `staff.service.spec.ts:6–17`: PATCH offboard guard và profile retained | Booking create vs deactivate |
| BEX-21 | `business-onboarding.service.spec.ts:52`: stale reviewer không ghi quyết định/event thứ hai | PostgreSQL admin A/B |
| BEX-22 | `recurring.service.spec.ts:97–188`: compensation, stale recovery, preview occupied slot | Crash khi compensation và occurrence race DB |
| BEX-23 | `review-moderation.spec.ts:13–40`: quarantine, duplicate report, one pending appeal | Hai admin moderate đối nghịch |
| BEX-17/18 | `payments.service.spec.ts:75–88,159–253`: giới hạn refund đơn lẻ, CAS review, settlement evidence | Split PAID theo index DB; PROCESSING reservation race |

Các câu hỏi product cụ thể: (1) `APPROVED` business khác `ACTIVE` thế nào khi publish? (2) `skipConflicts=true` cho phép kỳ bị chiếm sau preview được bỏ qua hay toàn chuỗi FAILED? (3) Moderator có thể cố ý override quyết định vừa có hay phải tải lại? (4) Split payment trên cùng booking là luồng sản phẩm chính thức và dùng Payment hay PaymentTransaction làm nguồn số dư? (5) Package entitlement giới hạn chi nhánh/dịch vụ/customer theo phiên bản nào? (6) Invitation/reminder cần SLA, kênh fallback và trạng thái delivery nào? (7) `isBookable=false` staff có cần impact cho lịch đã gán không?
