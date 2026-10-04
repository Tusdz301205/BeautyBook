# Luồng use case và ngoại lệ

Mapping BUC/SUC lấy từ [traceability luận văn](../../beauty-booking-api-main/docs/thesis-diagrams/TRACEABILITY.md), sau đó kiểm source hiện tại. Main flow mô tả **implementation**; các bước mong muốn chưa có được ghi rõ là đề xuất. Mọi flow thất bại tối thiểu phải không ghi trạng thái nghiệp vụ dở dang mà báo actor cách tiếp tục; đây là mục tiêu, không phải bảo đảm runtime đã xác nhận.

## UC-BOOK — Tự đặt lịch (BUC-02 / SUC-05, SUC-06, SUC-07)

Primary CUSTOMER; supporting salon/booking service. Trigger chọn dịch vụ trên web/mobile. Preconditions: customer session, branch/offering bookable, slot tương lai. Main success: (1) tải branch/service/staff; (2) xem availability và price preview; (3) chọn service→staff→giờ; (4) gửi create với channel/context; (5) server recheck customer, branch/offering/staff, giờ, quota và overlap trong transaction; (6) lưu Booking, BookingService, history/outbox; (7) hiển thị mã lịch. Postcondition booking PENDING/CONFIRMED theo policy, item SCHEDULED, slot giữ. Source `bookings.controller.ts:180–400`, `bookings.service.ts:817–1579`, web `BookingConfirm.jsx`, mobile `BookingScreen.tsx`. Failure guarantee mong muốn: không tạo partial booking; khi commit mơ hồ phải tra được kết quả.

| EX | BEX | Bước | Condition / tương tác | Expected result | Current / status | Retry/termination & evidence |
| --- | --- | --- | --- | --- | --- | --- |
| EX-BOOK-01 | BEX-01 | 5 | Sai customer/branch/service | Reject, chọn lại | Guard+recheck; HANDLED static | Reload, `bookings-access.service.ts:200`, `bookings.service.ts:1172` |
| EX-BOOK-02 | BEX-02 | 2→5 | Owner ngưng offering/branch sau preview | Conflict/reselect | Recheck create; writer protocol chưa chứng minh; PARTIALLY HANDLED | Reload slot/catalog; `services.service.ts:755`, `branch-state.service.ts:117` |
| EX-BOOK-03 | BEX-03 | 6→7 | Commit xong mất response | Replay booking đã tạo | Redis CAS, thiếu DB receipt; PARTIALLY HANDLED | Tra lịch trước retry; `idempotency.interceptor.ts`, `bookings.service.ts:1502` |
| EX-BOOK-04 | BEX-16 | 5 | Hai khách dùng quota cuối | Một thành công/một reprice | Chưa xác nhận DB race; CANNOT CONFIRM | Không hứa giảm giá cũ; `pricing-engine.service.ts:180–245` |

## UC-STATUS — Thực hiện và kết thúc lịch (BUC-04 / SUC-14–16 theo traceability)

Primary salon/staff; supporting CUSTOMER. Trigger xác nhận/check-in/bắt đầu item/hoàn tất. Preconditions booking active, actor đúng scope. Main success: (1) salon xem lịch; (2) xác nhận hoặc check-in; (3) staff bắt đầu item; (4) staff hoàn thành từng item; (5) salon/staff complete booking khi items terminal và payment rule thoả; (6) history/outbox cập nhật. Postcondition Booking COMPLETED, item trạng thái lịch sử giữ nguyên. Source `bookings.validation.ts:10–86`, `booking-items.service.ts:105–210`, `bookings.service.ts:421–710`. Failure minimum: status/item không quay ngược hoặc bị complete thiếu điều kiện.

| EX | BEX | Bước | Condition / tương tác | Expected result | Current / status | Retry/termination & evidence |
| --- | --- | --- | --- | --- | --- | --- |
| EX-STATE-01 | BEX-04 | 2/5 | Terminal→active hoặc thao tác lặp | Reject | Whitelist+CAS; HANDLED | Reload booking; `bookings.validation.ts:10–86` |
| EX-STATE-02 | BEX-05 | 5 | Item/payment đổi giữa pre-read và CAS | Recheck/Conflict | Pre-read ngoài transaction; PARTIALLY HANDLED | Reload; `bookings.service.ts:457–510,629` |
| EX-STATE-03 | BEX-07 | 2 | No-show sau báo hủy/đến | Reject và giữ audit đúng | Lock+evidence check; HANDLED | Chọn flow hủy/đổi lịch; `bookings.service.ts:555–611` |

## UC-CANCEL — Tự hủy và xin hủy sát giờ (BUC-03 / SUC-09, SUC-10)

Primary CUSTOMER; supporting salon. Trigger khách mở lịch. Preconditions booking của customer, PENDING/CONFIRMED. Main success: (1) tải lịch và thời điểm bắt đầu; (2) nếu còn ≥4h, PATCH CANCELLED; (3) server lock, recheck deadline/status; (4) đóng item unfinished, ghi history/violation nếu policy; (5) trả kết quả. Alternative hợp lệ: dưới 4h nhưng trước start, tạo `AppointmentChangeRequest` để salon xét; sau start liên hệ cơ sở. Postcondition cancel chỉ khi có phép, còn request thì booking chưa tự hủy. Source `customer-cancellation-policy.ts:4–30`, `change-requests.service.ts:56–173`, `bookings.service.ts:531–676`, mobile `AppointmentDetailScreen.tsx:255–273`.

| EX | BEX | Bước | Condition | Expected result | Current / status | Retry/termination & evidence |
| --- | --- | --- | --- | --- | --- | --- |
| EX-CANCEL-01 | BEX-06 | 2→3 | Vượt mốc 4h hoặc slot dời giữa đọc/ghi | Chuyển sang request, không direct cancel | Recheck sau lock; HANDLED | Gửi request khi còn trước start; `bookings.service.ts:618` |
| EX-CANCEL-02 | BEX-07 | flow salon | Salon đánh no-show sau request hủy | Reject no-show | Request/history guard; HANDLED | Salon xử lý request; `bookings.service.ts:555–611` |

## UC-BRANCH/UC-IMPACT — Ngừng branch có lịch tương lai (BUC-08/09, SUC-33)

Primary OWNER; supporting receptionist/customer/admin. Trigger PAUSE/CLOSE/SUSPEND/ARCHIVE. Preconditions branch tồn tại, actor có quyền, reason. Main success hiện tại: (1) tìm active future bookings; (2) tạo impact case/items nếu cần; (3) owner resolve từng booking bằng REASSIGN/RESCHEDULE/TRANSFER_BRANCH/CANCEL_REFUND/APPROVED_EXCEPTION; (4) complete case; (5) branch transition recheck coverage và ghi history. Postcondition branch không public/bookable, lịch đã được xử lý hoặc có approved exception. Source `branch-state.service.ts:65–174`, `impact.service.ts:50–235`. Failure minimum mong muốn: branch vẫn active nếu unresolved; impact không kẹt/không phản ánh sai booking.

| EX | BEX | Bước | Condition | Expected result | Current / status | Retry/termination & evidence |
| --- | --- | --- | --- | --- | --- | --- |
| EX-IMPACT-01 | BEX-10 | 3 | Crash sau booking mutation trước RESOLVED | Atomic hoặc recoverable | PROCESSING có thể kẹt; NOT HANDLED | Manual reconciliation; `impact.service.ts:58–199` |
| EX-IMPACT-02 | BEX-11 | 4→5 | Customer tạo booking mới | Recheck toàn tập | Có recheck+branch lock; PARTIALLY HANDLED vì chưa DB race | Reload impact; `branch-state.service.ts:117–130` |

## UC-STAFF — Mời và ngưng staff (BUC-08 / staff SUC trong traceability)

Primary OWNER; supporting recipient/customer. Trigger owner tạo staff profile, mời hoặc offboard. Preconditions staff thuộc business/branch, recipient hợp lệ. Main success: (1) tạo profile; (2) tạo invitation, gửi email; (3) recipient chấp nhận và kích hoạt; (4) owner gán service/branch; (5) khi offboard, xử lý lịch rồi INACTIVE. Postcondition invitation accepted hoặc staff active; offboard không bỏ sót lịch. Source `staff-invitations.service.ts:32–318`, `staff.service.ts:369–577`. Failure minimum mong muốn: owner biết lời mời chưa phát, staff offboard không còn lịch active chưa xử lý.

| EX | BEX | Bước | Condition | Expected result | Current / status | Retry/termination & evidence |
| --- | --- | --- | --- | --- | --- | --- |
| EX-STAFF-01 | BEX-12 | 2 | SMTP disabled/fail | Báo failed + retry | MailService nuốt lỗi; NOT HANDLED | Owner dùng resend nhưng không biết lúc nào cần; `mail.service.ts:22–41` |
| EX-STAFF-02 | BEX-14 | 5 | Booking mới cạnh tranh offboard | Chặn/cover lịch mới | Impact guard, race chưa xác minh; PARTIALLY HANDLED | Recheck impact; `staff.service.ts:474–577` |

## UC-PAY — Thu tiền, hoàn tiền, dùng gói (BUC-05 / payment SUC)

Primary salon/admin, supporting customer. Preconditions booking/payment/purchase hợp lệ. Main success: (1) xem balance/checkout; (2) collect/verify; (3) nếu phát sinh refund, request→review→process; (4) nếu dùng package, reserve→redeem/release theo outcome. Postcondition ledger, booking và entitlement khớp. `payments.controller.ts:25–252`, `payments.service.ts:149–1703`. **Audit-only, remediation hoãn; không thực hiện giao dịch.**

| EX | BEX | Bước | Condition | Expected result | Current / status | Retry/termination & evidence |
| --- | --- | --- | --- | --- | --- | --- |
| EX-PAY-01 | BEX-17 | 2 | Nhiều PAID trên một booking | Split theo policy/total | Unique index cản; NOT HANDLED | Chưa retry tự động; migration `20260715_harden_payment_concurrency:4` |
| EX-PAY-02 | BEX-18 | 3 | PROCESSING chưa giữ số dư | Không over-request | Count bỏ PROCESSING; NOT HANDLED | Manual reconcile; `payments.service.ts:363–383` |
| EX-PAY-03 | BEX-19 | 4 | Entitlement terminal/sai scope | Theo package policy đã quyết | Chưa đủ căn cứ; CANNOT CONFIRM | Product clarification; `payments.service.ts:1588–1703` |

## UC-REVIEW/UC-OWNER/UC-NOTIFY — Quyền và tiến trình phụ thuộc

Review (BUC-06): CUSTOMER của booking COMPLETED tạo rating theo item; EX-REVIEW-01/BEX-08 tại bước submit sai booking/item bị reject (`reviews.service.ts:280–365`, HANDLED). Ownership (BUC-10): owner đề nghị → recipient accept → admin review → execute; EX-OWNER-01/BEX-09 khi actor cạnh tranh trạng thái, CAS chặn stale transition (`ownership.service.ts:51–222`, HANDLED static). Notification: worker nhắc lịch CONFIRMED; EX-NOTIFY-01/BEX-20 khi restart/tick đôi, mất hoặc lặp notification (`policy-notification.cron.ts:15–38`, NOT HANDLED). Failure guarantee của reminder là không thay đổi booking; recovery/dedupe còn là đề xuất.

## UC-BUSINESS — Nộp và thẩm định doanh nghiệp (BUC-07)

Primary OWNER, supporting PLATFORM_ADMIN. Trigger tạo draft và submit. Preconditions chủ hợp lệ, hồ sơ DRAFT/NEED_MORE_INFO. Main success: (1) cập nhật thông tin/tài liệu; (2) server kiểm checklist theo setting; (3) lock row, chuyển PENDING_REVIEW hoặc auto-approved theo policy; (4) admin review, ghi document/review events; (5) chủ nhận kết quả. Postcondition business và tài liệu đồng trạng thái quyết định. EX-BUSINESS-01/BEX-21 tại bước 2/4: thiếu hồ sơ hoặc admin B quyết định trên trạng thái cũ → reject/reload; HANDLED static (`business-onboarding.service.ts:438–568`). Failure minimum: không duyệt thiếu dữ liệu hoặc ghi đè review; runtime notification sau commit chưa kiểm. `APPROVED` không tự bảo đảm branch đã public, xem `branch-state.service.ts:48–62`.

## UC-RECURRING — Tạo chuỗi lịch (BUC-02 / SUC-11)

Primary CUSTOMER; supporting booking service. Trigger chọn tần suất. Preconditions branch/service/staff hợp lệ. Main success: (1) generate dates; (2) preview từng kỳ; (3) xác nhận `skipConflicts`; (4) tạo plan CREATING; (5) tạo từng booking qua create thường; (6) plan ACTIVE. Postcondition occurrence count đúng, khách thấy từng kỳ. EX-RECURRING-01/BEX-22 tại bước 2→5: kỳ được người khác lấy sau preview → create fail, plan FAILED và compensation; PARTIALLY HANDLED vì hoàn tác cũng có thể lỗi (`recurring.service.ts:39–141`). Failure minimum mong muốn: tra được toàn bộ kỳ và trạng thái, không tự động tạo lần hai; code hiện trả thông báo kiểm tra thủ công nếu compensation thất bại. Cần product quyết định all-or-nothing khi `skipConflicts=true` gặp race sau preview.

## UC-CUSTOMER-POLICY — Cảnh báo và giới hạn tự đặt theo doanh nghiệp

Primary CUSTOMER; supporting salon. Trigger xem self-booking policy rồi xác nhận đặt lịch. Preconditions customer profile và business. Main success: (1) đọc violation 90 ngày theo pair customer/business; (2) hiển thị warning/acknowledgment; (3) tại create, lock pair, tính lại restriction; (4) nếu đủ điều kiện lưu booking. Postcondition booking không vượt restriction, read không tự gia hạn. EX-POLICY-01/BEX-24 tại bước 3: restriction vừa kích hoạt hoặc hết hạn → server quyết định bằng thời điểm sau lock, HANDLED static (`customer-booking-policy.ts:5–93`, `bookings.service.ts:1179`). Alternative: tự đặt bị hạn chế thì liên hệ cơ sở; counter booking có channel/policy riêng, không đồng nghĩa self-booking được bypass. Failure minimum: không ghi booking bị cấm; unknown DB race/runtime.

## UC-MODERATION — Báo cáo và kiểm duyệt đánh giá (BUC-06)

Primary PLATFORM_ADMIN; supporting CUSTOMER/OWNER. Trigger review report/quarantine. Preconditions review tồn tại và actor đủ quyền. Main success: (1) reporter gửi lý do; (2) hệ thống tạo report/event; (3) admin quyết định APPROVED/HIDDEN với reason; (4) event/notification; (5) nếu có appeal, admin xử lý. EX-MOD-01/BEX-23 tại bước 3: hai admin đọc cùng status rồi quyết định khác nhau → hiện last-write-wins và event fromStatus cũ, NOT HANDLED (`reviews.service.ts:475–515`). Expected: quyết định trên state mới hoặc conflict; actor tải lại. Failure minimum mong muốn: event phản ánh thứ tự thực; chưa chạy race test.

## UC-SCHEDULE — Chọn giờ hợp lệ (BUC-02 / SUC-06)

Primary CUSTOMER hoặc salon. Trigger chọn ngày, staff và dịch vụ. Preconditions branch bookable. Main success: (1) server tính slot từ branch working hours và holiday/special day; (2) client chọn staff/slot; (3) create kiểm lại staff/status/service/branch/opening window và overlap; (4) booking lưu. EX-SCHEDULE-01/BEX-26 tại bước 1/3: ngày nghỉ hoặc thời lượng vượt giờ đóng cửa → reject/reselect, HANDLED static (`bookings.validation.ts:126–200`, `bookings.service.ts:1917–2140`). EX-SCHEDULE-02/BEX-02: slot stale do owner chỉnh catalog/branch → PARTIALLY HANDLED theo writer protocol còn phải kiểm. Failure minimum: không tạo item ngoài giờ; UI phải tải lại slot, chưa kiểm mobile runtime.

## UC-TRANSFER — Chuyển booking khi xử lý impact (BUC-09 / SUC-33)

Primary OWNER; supporting customer/staff. Trigger chọn `TRANSFER_BRANCH` cho impact item. Preconditions booking PENDING/CONFIRMED, cùng business, target branch nhận lịch. Main success: (1) chọn target branch và staff; (2) server lock/re-read booking và items; (3) kiểm offering/duration/staff/overlap; (4) CAS item/booking trong transaction; (5) finalize impact item/outbox. EX-TRANSFER-01/BEX-25 tại bước 3: target không phù hợp → reject, HANDLED trong transaction transfer (`impact.service.ts:238–279`). EX-TRANSFER-02/BEX-10 tại bước 4→5: process crash → impact PROCESSING kẹt, NOT HANDLED. Failure minimum mong muốn: không có booking chuyển mà impact chưa ghi; hiện chưa đạt, cần reconciliation; không tự replay nhánh refund.
