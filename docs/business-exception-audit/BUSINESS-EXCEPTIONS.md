# Catalog ngoại lệ nghiệp vụ

Các link `src/...` dưới đây trỏ từ repository gốc qua `../../beauty-booking-api-main/`. `Expected` là rule suy từ policy/source được nêu, **không** lấy riêng đặc tả luận văn làm quyết định product. `Current` là đọc control flow; không hàm ý đã chạy trên demo. `PARTIALLY TESTED` là unit assertion có liên quan trong repo/báo cáo remediation, nhưng task audit này không chạy test. Không case nào có `TESTED` trong task này.

<a id="bex-01"></a>
## BEX-01 — Customer đặt booking thuộc tài khoản/branch/service hợp lệ

UC-BOOK; BR-BOOK; CUSTOMER; trigger POST `/bookings`; precondition có customer session, chọn branch/offering/staff. Expected: từ chối customer khác, branch/business/offering không bookable, giữ slot hợp lệ; nguồn policy [booking access](../../beauty-booking-api-main/src/bookings/bookings-access.service.ts#L200), [create](../../beauty-booking-api-main/src/bookings/bookings.service.ts#L817). Current: controller áp channel policy, service kiểm tra account/resource, catalog/branch và slot trong Serializable, `FOR SHARE` catalog, `FOR UPDATE` branch (`bookings.service.ts:1172–1265`). **HANDLED** theo static path; prevention; impact nếu thiếu guard là đặt nhầm cơ sở/khách. DB: schema Booking/BookingService `:1014–1122`, staff exclusion migration `20260829_remove_attendance_workforce/migration.sql:200–240`; áp dụng migration trên runtime chưa rõ. Web `src/pages/Customer/BookingConfirm.jsx`, mobile `src/screens/BookingScreen.tsx:116–` là consumers. Coverage PARTIALLY TESTED: booking policy/unit tests có, chưa race DB. Severity tiềm tàng HIGH. Khuyến nghị test PostgreSQL đồng thời và xác minh migration; unknown runtime.

<a id="bex-02"></a>
## BEX-02 — Catalog/branch thay đổi giữa chọn slot và commit

UC-BOOK/UC-CATALOG; BR-BOOK/BR-CATALOG; CUSTOMER vs OWNER; precondition preview hợp lệ. A đọc preview, B archive offering/pause branch, A confirm. Expected: recheck cùng giao thức khóa, hoặc trả stale conflict để chọn lại. Current: create recheck catalog/variant/branch trong Serializable (`bookings.service.ts:1172–1265`), archive offering kiểm tra future bookings trước soft delete (`services.service.ts:755–887`), branch transition khóa branch (`branch-state.service.ts:117–140`); **chưa chứng minh tất cả writer catalog/offboard dùng cùng lock**. **PARTIALLY HANDLED**, prevention một phần, BGAP-01. Impact: có thể nhận lịch cho resource vừa ngưng nếu interleaving không bị serialization/DB constraint bắt; chưa tái hiện. DB: FK bảo vệ ID, không tự bảo vệ eligibility. Coverage PARTIALLY TESTED (unit guard, không có DB interleaving). Severity HIGH. Khuyến nghị test writer-pair trên DB disposable; client reload/reselect khi conflict. Unknown isolation thực và migration runtime.

<a id="bex-03"></a>
## BEX-03 — Retry sau commit booking nhưng response thất lạc

UC-BOOK; BR-BOOK một intent không tạo hai booking; CUSTOMER/web/mobile; trigger gửi lại POST sau timeout. Expected: cùng idempotency key trả lại đúng kết quả đã commit hoặc có cách tra cứu; nguồn cơ chế `IdempotencyInterceptor` và UI checkout (`mobile/src/screens/BookingScreen.tsx:116`). Current: Redis reservation owner nonce/CAS và semantic conflict đã cải thiện (`idempotency.interceptor.ts`), booking notification outbox nằm cùng transaction (`bookings.service.ts:1502–1579`); nếu commit xong nhưng lưu replay Redis thất bại, không có receipt DB chứng minh từ source. **PARTIALLY HANDLED**, BGAP-02. Impact có thể tạo booking lặp khi retry bằng key mới sau lỗi response; không khẳng định đã xảy ra. Coverage PARTIALLY TESTED (`idempotency.interceptor.spec.ts` mock; không có post-commit fault DB/Redis). Severity MEDIUM. Khuyến nghị receipt bền vững và test fault đúng ranh giới; unknown retry behavior trên browser/mobile runtime.

<a id="bex-04"></a>
## BEX-04 — Chuyển booking terminal về active

UC-STATUS; BR-STATE; actor salon/staff/admin qua PATCH status; precondition booking terminal. Expected từ chối và giữ lịch sử. Current `assertStatusTransition` chặn same/terminal; `assertActorStatusTransition` giới hạn actor; status CAS trong Serializable (`bookings.validation.ts:10–86`, `bookings.service.ts:629–669`). **HANDLED** cho route này; prevention. DB BookingStatus enum không tự hạn chế cạnh; direct writers ngoài route cần audit thêm. Coverage PARTIALLY TESTED (`booking-role-refactor.spec.ts`, `booking-item-lifecycle.spec.ts`). Severity tiềm tàng HIGH. Khuyến nghị kiểm tra mọi writer status khi thêm mới; unknown legacy direct updates.

<a id="bex-05"></a>
## BEX-05 — Booking hoàn tất khi item hoặc payment vừa đổi

UC-STATUS/UC-PAY; BR-STATE/BR-PAY; salon/staff; precondition IN_PROGRESS. Expected chỉ complete khi mọi item terminal và số dư hợp lệ tại commit, hoặc conflict. Current `bookings.service.ts:457–510` đọc items và payments **trước** transaction; `:629–669` CAS chỉ booking status. Nếu B đổi item/payment giữa read và write, A không đọc lại các phụ thuộc sau lock trong cùng transaction. **PARTIALLY HANDLED**, BGAP-03. Impact: booking COMPLETED không đồng bộ item/số dư trong interleaving; payment branch audit-only, chưa sửa. Coverage PARTIALLY TESTED (guard unit; race DB chưa chạy). Severity MEDIUM. Khuyến nghị re-read/lock dependents cùng transaction; xác định thứ tự writer; unknown khả năng B đi qua state guard của item/payment trong interleaving cụ thể.

<a id="bex-06"></a>
## BEX-06 — Customer tự hủy sát mốc bốn giờ

UC-CANCEL; BR-CANCEL; CUSTOMER; precondition PENDING/CONFIRMED, booking thuộc user. Expected còn **≥4h** được hủy trực tiếp, dưới 4h trước start phải gửi change request, sau start liên hệ cơ sở. Current `customerCancellationMode` dùng `remaining >= 4h` (`customer-cancellation-policy.ts:4–30`); `bookings.service.ts:531–628` kiểm tra lại sau row lock, `change-requests.service.ts:56–173` kiểm tra owner và expiry. **HANDLED** cho direct cancellation path; prevention/alternative. DB `AppointmentChangeRequest` `schema.prisma:1820`. Mobile `AppointmentDetailScreen.tsx:255–273` có hai hành động. Coverage PARTIALLY TESTED (`customer-cancellation-policy.spec.ts`, chưa UI runtime). Severity tiềm tàng MEDIUM. Unknown đồng hồ client/server và timezone runtime; khuyến nghị boundary test API.

<a id="bex-07"></a>
## BEX-07 — No-show dù khách đã báo hủy hoặc đã đến

UC-STATUS/UC-CANCEL; BR-STATE; OWNER/RECEPTIONIST; CONFIRMED. Expected từ chối no-show khi có request hủy hoặc dấu vết check-in/item thực hiện; grace 15 phút. Current `bookings.service.ts:555–611` lock booking, kiểm request, status history, item state; ghi audit và violation cùng transaction; actor guard cấm CUSTOMER/admin (`bookings.validation.ts:51–64`). **HANDLED** theo source; prevention. Coverage PARTIALLY TESTED (`no-show-policy.spec.ts`, không runtime). Severity tiềm tàng HIGH. Unknown lịch sử legacy thiếu history; khuyến nghị fixture legacy riêng.

<a id="bex-08"></a>
## BEX-08 — Customer đánh giá booking của người khác/chưa hoàn tất

UC-REVIEW; BR-REVIEW; CUSTOMER; trigger POST `/reviews`. Expected chỉ customer của booking COMPLETED, rating item/staff thuộc booking. Current `reviews.service.ts:280–365` kiểm customerId và userId, status COMPLETED, item ID, staff ID; DB unique review/booking và rating/item (`schema.prisma:1585–1626`, migration init `:752–761`). **HANDLED** theo static path; prevention. Coverage PARTIALLY TESTED (review specs tồn tại, chưa chạy lại); severity tiềm tàng MEDIUM. Unknown concurrent moderation aggregate; không gộp vào scenario này.

<a id="bex-09"></a>
## BEX-09 — Hai actor cùng review/cancel/execute chuyển chủ

UC-OWNER; BR-OWNER; OWNER/recipient/admin; trạng thái đang xét. Expected không ghi đè transition mới, owner grants/history chỉ đổi một lần. Current `ownership.service.ts:51–136` dùng status/updatedAt CAS cho accept/review/submit/cancel; execute trong transaction kiểm approved/accepted, cập nhật owner/history/session (`:142–222`). **HANDLED** theo static path; prevention. Coverage PARTIALLY TESTED (`ownership.service.spec.ts` mock stale, không DB race). Severity tiềm tàng HIGH. Unknown notification/audit sau commit và runtime deep link; xem BEX-12 cho workflow communication tương tự.

<a id="bex-10"></a>
## BEX-10 — Impact item kẹt PROCESSING hoặc mutation dở dang

UC-IMPACT; BR-IMPACT; OWNER; precondition impact OPEN/IN_PROGRESS, item PENDING. A claim PROCESSING (`impact.service.ts:58–70`), đổi item/booking qua service khác (`:81–121`), rồi transaction khác mới RESOLVED/outbox (`:157–188`). Crash giữa hai commit để lại PROCESSING và booking đã đổi; catch reset PENDING chỉ chạy khi exception còn trong process (`:190–199`). Expected atomic transition hoặc durable recovery có idempotent checkpoint; không tự replay `CANCEL_REFUND`. **NOT HANDLED**, BGAP-04; detected but poorly handled. Impact: case không thể complete hoặc retry có thể thực hiện side effect lặp; payment branch audit-only. DB `OperationalImpactCase/Item` `schema.prisma:2324–2376` không ràng buộc atomicity với booking. Web `SalonOperations.jsx`. Coverage NOT TESTED cho crash; severity HIGH. Khuyến nghị transaction/checkpoint và recovery manual; unknown dữ liệu đang mắc kẹt.

<a id="bex-11"></a>
## BEX-11 — Booking mới xuất hiện khi branch impact hoàn tất

UC-BRANCH/UC-IMPACT; BR-BRANCH; OWNER vs CUSTOMER; precondition branch ACTIVE có impact case. Expected branch chỉ pause/close khi mọi booking hiện hành đã xử lý, kể cả mới tạo. Current `branch-state.service.ts:14–39` yêu cầu completed impact sau transition gần nhất và cover từng booking; `:117–130` lock branch và recheck trong transaction; create booking cũng lock branch `bookings.service.ts:1265`. Đây là bảo vệ đáng kể, nhưng chưa có DB race test chứng minh protocol trên các writer khác/transaction isolation. **PARTIALLY HANDLED**, BGAP-01; severity HIGH. Coverage PARTIALLY TESTED (`branch-state.service.spec.ts` unit), unknown PG interleaving/DB migration. Khuyến nghị test A/B trên disposable DB.

<a id="bex-12"></a>
## BEX-12 — Gửi lời mời staff thất bại nhưng API báo đã mời

UC-STAFF/UC-NOTIFY; BR-NOTIFY; OWNER; precondition tạo invitation hợp lệ. Expected biết delivery thất bại và có resend/recovery; người nhận cần link mới có thể hoàn thành onboarding. Current `mail.service.ts:22–41` trả thành công khi SMTP disabled và nuốt lỗi SMTP; `staff-invitations.service.ts:65–112` chỉ rollback/revoke khi send throw, nên status PENDING/INVITED có thể được trả dù email không đến. Resend route có (`staff.controller.ts:129–153`) nhưng không có delivery state bền vững. **NOT HANDLED**, BGAP-05. Impact: onboarding staff kẹt, owner hiểu nhầm đã gửi; no mail in audit. Coverage NOT TESTED fault SMTP; severity MEDIUM. Khuyến nghị delivery state/outbox hoặc trả failure rõ; unknown SMTP thực.

<a id="bex-13"></a>
## BEX-13 — Archive offering đang có lịch tương lai

UC-CATALOG; BR-CATALOG; OWNER; precondition offering có active future booking. Expected không xóa lịch sử hoặc làm booking hiện hành mất dữ liệu; yêu cầu pause và xử lý lịch trước. Current `services.service.ts:755–887` đếm future bookings trước archive, soft delete + INACTIVE/bookable false; `BookingService` giữ snapshot (`schema.prisma:1081–1122`). **HANDLED** với request tuần tự; prevention, còn race ở BEX-02. Coverage PARTIALLY TESTED (service tests, không DB race); severity tiềm tàng MEDIUM. Khuyến nghị xác nhận UI hiển thị lịch sử từ snapshot, không master data hiện hành.

<a id="bex-14"></a>
## BEX-14 — Staff offboard khi lịch mới vừa gán

UC-STAFF/UC-BOOK; BR-STAFF; OWNER vs CUSTOMER; precondition staff ACTIVE, có thể bookable. Current PATCH status bị chặn bypass (`staff.service.ts:369–397`); offboarding lấy future bookings, tạo impact và deactivate (`:474–577`); booking create kiểm staff (`bookings.validation.ts:126–185`). Chưa chứng minh create và deactivate dùng cùng lock/protocol, và `isBookable=false` có ý nghĩa khác inactive. Expected mọi lịch active được reassigned/resolved trước offboard. **PARTIALLY HANDLED**, BGAP-01. Impact lịch mới có thể được gán ngay trước offboard; chưa tái hiện PG. Coverage PARTIALLY TESTED (`staff.service.spec.ts` PATCH guard); severity HIGH. Khuyến nghị test A/B create/offboard.

<a id="bex-15"></a>
## BEX-15 — Actor đúng role nhưng thao tác booking sai tenant/customer

UC-BOOK/UC-STATUS; BR-ACCOUNT; CUSTOMER/RECEPTIONIST/STAFF/OWNER; trigger read/write booking ID bất kỳ. Expected quyền theo resource business/branch/customer/item assignment. Current global guards (`app.module.ts:77–91`) + `bookings-access.service.ts:44–251` load booking rồi kiểm permission/scope/owner; `booking-items.service.ts:105–124` kiểm staff được gán. **HANDLED** cho những route đã trace; prevention. Web route guard chỉ giúp UI, không là bằng chứng server. Coverage PARTIALLY TESTED (`bookings-tenant-scope.spec.ts`, `booking-role-refactor.spec.ts`); severity tiềm tàng HIGH. Unknown mọi route reporting/media; không mở rộng kết luận.

<a id="bex-16"></a>
## BEX-16 — Hai khách dùng promotion/voucher cuối cùng cùng lúc

UC-PROMO/UC-BOOK; BR-PROMO; CUSTOMER A/B; precondition còn một quota, cùng preview. Expected tối đa quota, hoặc một request conflict/requote. Current `pricing-engine.service.ts:180–245` recheck status/version và count active redemptions trong transaction; DB schema `PromotionRedemption/VoucherRedemption` `:2188–2239` có unique theo booking/scope nhưng không thấy constraint tổng quota. Chưa đọc đủ isolation/lock của toàn reservation path để chứng minh race có thể commit cả hai; **CANNOT CONFIRM** (AMB-07), coverage CANNOT CONFIRM, severity —. Khuyến nghị test A/B PostgreSQL disposable với 1 quota và đọc final count, xác nhận business cho phép over-issue hay không; chưa sửa tiền/discount.

<a id="bex-17"></a>
## BEX-17 — Split payment hợp lệ bị unique một PAID/booking cản hoặc vượt tổng thu

UC-PAY; BR-PAY; salon; booking có nhiều khoản thu. Expected nếu split payment là nghiệp vụ được hỗ trợ thì tổng verified/reversed không vượt final amount, nhiều khoản có thể cùng PAID. Current `payments.service.ts:149–303` tính số dư và collect; [audit payment cũ](../exception-audit/DEFERRED-PAYMENT.md) ghi GAP-03 chỉ mục một PAID/booking; cần so với DB migration trước khẳng định deployment. **NOT HANDLED** ở thiết kế source hiện tại đối với split flow; BGAP-06, remediation hoãn. Impact thu nhiều đợt có thể conflict dù còn nợ, hoặc sổ/booking mismatch; không khẳng định mất tiền. Coverage NOT TESTED runtime; severity MEDIUM. Khuyến nghị quyết định ledger/split semantics và migration riêng; không sửa trong audit.

<a id="bex-18"></a>
## BEX-18 — Hai yêu cầu hoàn tiền cùng sử dụng số dư chưa giữ chỗ

UC-PAY; BR-PAY; OWNER/admin; payment PAID, refund A/B cạnh tranh. Expected tổng PENDING/APPROVED/PROCESSING/REFUNDED không vượt refundable. Current `payments.service.ts:363–421` tính reserved từ PENDING/APPROVED/REFUNDED, thiếu PROCESSING trong phép tính; `:421–539` xử lý PROCESSING. **NOT HANDLED**, BGAP-07, remediation hoãn. Impact yêu cầu hoàn tiền vượt số dư khả dụng trong race; chưa xác nhận tiền đã chuyển. Coverage NOT TESTED PostgreSQL concurrent; severity HIGH. Khuyến nghị reservation nguyên tử/constraint và reconcile trạng thái; không chạy refund.

<a id="bex-19"></a>
## BEX-19 — Package entitlement của booking terminal hoặc sai branch

UC-PAY/UC-BOOK; BR-PAY; CUSTOMER/RECEPTIONIST; package ACTIVE, entitlement AVAILABLE. Current `payments.service.ts:1588–1703` kiểm purchase ACTIVE/expiry, reserve entitlement và redeem/release theo booking terminal. Chưa xác nhận đầy đủ policy branch/service/customer và mọi writer release/reserve trong transaction chung; audit cũ GAP-19 chỉ là đầu mối, không tự suy mất lượt. **CANNOT CONFIRM** (AMB-08), coverage CANNOT CONFIRM, severity —. Expected phụ thuộc package scope được product xác nhận; khuyến nghị matrix entitlement vs booking/service/branch và DB race test; remediation hoãn.

<a id="bex-20"></a>
## BEX-20 — Reminder bị bỏ sót hoặc trùng sau restart/hai worker

UC-NOTIFY; BR-NOTIFY; SYSTEM; booking CONFIRMED. Expected reminder trong cửa sổ hợp lý, một lần/booking/appointment; nếu đổi giờ phải tính lại. Current `policy-notification.cron.ts:15–38` tick mỗi 5 phút, chỉ chọn cửa sổ `[target,target+5m)`, `take:2000` không cursor, check notification rồi `createMany` không dedupe key/transaction claim. Restart trễ bỏ qua, hai worker có thể cùng tạo. **NOT HANDLED**, BGAP-08. Đây là tiện ích, không chặn booking, nhưng ảnh hưởng khách đến đúng giờ. Coverage NOT TESTED failure/restart; severity MEDIUM. Khuyến nghị bounded catch-up và outbox dedupe theo booking+start instant; unknown topology worker runtime.

<a id="bex-21"></a>
## BEX-21 — Owner nộp thiếu hồ sơ hoặc hai admin cùng review

UC-BUSINESS; BR-BUSINESS; OWNER/admin; precondition business DRAFT/NEED_MORE_INFO hoặc PENDING_REVIEW. Expected thiếu trường/tài liệu bắt buộc bị từ chối; review stale không ghi đè quyết định mới. Current `business-onboarding.service.ts:438–501` tính checklist theo setting, lock business khi submit và so status/updatedAt; `:505–568` review dùng updateMany CAS trong transaction, document status CAS + event. **HANDLED** theo source; prevention. DB `Business/BusinessDocument/BusinessReviewEvent` ở `schema.prisma:376–449,1943–1994`. Web `BranchOnboardingWizard.jsx` và admin review. Coverage PARTIALLY TESTED (`business-onboarding.service.spec.ts` stale mock, không PostgreSQL race); severity tiềm tàng HIGH. Unknown consistency audit/notification sau commit và `autoApproveNewSalons` product policy; khuyến nghị DB race test.

<a id="bex-22"></a>
## BEX-22 — Recurring preview hợp lệ nhưng một kỳ bị chiếm trước create

UC-RECURRING; BR-BOOK; CUSTOMER; precondition nhiều occurrence, preview trả available. Expected nếu `skipConflicts=false`, toàn chuỗi hoặc không kỳ nào; nếu true, minh bạch kỳ bị bỏ, không âm thầm giữ chuỗi sai. Current `recurring.service.ts:13–37` preview kiểm staff/overlap; `:39–141` tạo từng booking qua `BookingsService.create`, khi lỗi claim FAILED và cố compensate các kỳ đã tạo kể cả commit trước lỗi response. Compensation có thể thất bại và code báo cần kiểm tra thủ công. **PARTIALLY HANDLED**, BGAP-09: workflow có recovery nhưng không nguyên tử cho chuỗi; không khẳng định thất thoát lịch. DB `RecurringBookingPlan` `schema.prisma:1137–1168`. Coverage PARTIALLY TESTED (`recurring.service.spec.ts` preview, không race multi-occurrence DB); severity MEDIUM. Khuyến nghị durable occurrence outcomes và reconciliation, phân biệt skipConflicts với failure sau preview. Unknown requirement all-or-nothing của product.

<a id="bex-23"></a>
## BEX-23 — Hai moderator quyết định review từ cùng trạng thái cũ

UC-REVIEW; BR-REVIEW; PLATFORM_ADMIN A/B; precondition review REPORTED/HIDDEN. Expected mỗi quyết định moderation có fromStatus thực và không ghi đè quyết định vừa commit nếu policy yêu cầu review lại. Current `reviews.service.ts:475–515` đọc review trước transaction, `tx.review.update({where:{id}})` không CAS status/revision, event dùng `review.status` đã đọc. A/B cùng đọc rồi cập nhật khác nhau có thể ghi event từStatus cũ và last-write-wins; global role guard không giải quyết race. **NOT HANDLED**, BGAP-10; impact hiển thị/aggregate review và dấu vết kiểm duyệt có thể sai, chưa tái hiện runtime. DB `ReviewModerationEvent` `schema.prisma:2409–2427`, FK không serializes decision. Coverage NOT TESTED concurrent moderation; severity MEDIUM. Khuyến nghị CAS status/version + transaction retry/conflict, DB race test. Unknown policy có cho moderator override tức thời không; dù có, event phải phản ánh trạng thái thực trước quyết định.

<a id="bex-24"></a>
## BEX-24 — Hạn chế tự đặt lịch theo business bị áp sai hoặc hết hạn

UC-BOOK; BR-CUSTOMER-POLICY; CUSTOMER; precondition có violation history theo một business. Expected chỉ tự đặt bị hạn chế tại business tương ứng trong 30 ngày từ trigger; warning acknowledgment tại score 3; đọc policy không tự gia hạn. Current `customer-booking-policy.ts:5–93` lọc `customerId,businessId`, cửa sổ 90 ngày, khóa/upsert pair trước kiểm create trong Serializable, không tạo restriction trong read; `bookings.service.ts:1179` gọi tại commit. **HANDLED** theo source; prevention. DB `CustomerBookingPolicy` unique pair `schema.prisma:1885–1903`. Web/mobile self-booking policy consumer (`bookings.controller.ts:185–208`, mobile `src/api/bookings.ts:24`). Coverage PARTIALLY TESTED (booking policy specs cũ, không DB race); severity tiềm tàng MEDIUM. Unknown clock/timezone runtime và policy version legacy; khuyến nghị boundary test với hai business.

<a id="bex-25"></a>
## BEX-25 — Transfer impact sang branch/staff không tương thích

UC-IMPACT; BR-IMPACT; OWNER; precondition booking PENDING/CONFIRMED, target branch cùng business. Expected target có offering tương ứng, duration, staff active/capable và slot. Current `impact.service.ts:238–279` yêu cầu staff, khóa booking, recheck status/revision, target branch/business/offering, validate staff+overlap và CAS item/booking trong Serializable. **HANDLED** cho validation target theo static path; workflow PROCESSING/finalize vẫn là BEX-10. Coverage PARTIALLY TESTED (`impact.service.spec.ts` wrong branch, không multi-item DB race); severity tiềm tàng HIGH. Unknown branch reviewStatus check ở target: query có `status/operationalStatus=ACTIVE`, không `reviewStatus`; nếu dữ liệu có tổ hợp lệch, cần BR-BRANCH quyết định và test riêng. Khuyến nghị dùng canonical branch predicate.

<a id="bex-26"></a>
## BEX-26 — Booking ngoài giờ mở cửa hoặc ngày nghỉ

UC-BOOK; BR-SCHEDULE; CUSTOMER/salon; precondition chọn staff/service và thời điểm. Expected holiday/special day/working hours áp dụng đúng, slot đủ duration. Current `bookings.validation.ts:126–200` kiểm staff ACTIVE/bookable, branch match, StaffService, holiday/special day/BranchWorkingHour bằng wall-clock timezone; `bookings.service.ts:1917–2140` availability, create revalidates staff/slot. **HANDLED** theo source cho guard giờ/eligibility; preview stale liên quan BEX-02. DB `BranchWorkingHour/BranchHoliday/SpecialWorkingDay` `schema.prisma:541–631`. Coverage PARTIALLY TESTED (`available-slots-policy.spec.ts`, không mobile runtime); severity tiềm tàng MEDIUM. Unknown timezone config deployment/DST; khuyến nghị test boundary ngày đặc biệt và mobile crop/giờ hiển thị ở task UI khác.
