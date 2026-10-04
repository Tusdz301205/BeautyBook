# BeautyBook — kết quả audit để Astra nhận xét, đánh giá

## Mục đích

Đây là bản bàn giao độc lập để Astra **phản biện chất lượng audit ngoại lệ nghiệp vụ** trên repository hiện tại. Không coi nội dung bên dưới là yêu cầu sửa code. Cần đánh giá độ đúng của từng kết luận bằng source và chỉ rõ false positive, false negative, mức severity chưa hợp lý, bằng chứng thiếu hoặc sai ID/link. Nếu có nhận định khác, trích file, symbol và dòng tương ứng.

## Baseline và những việc thực sự đã làm

- Repository: `C:\Users\Admin\Downloads\beauty-booking-api-main`; nhánh `main`; HEAD `761d3607297e72bb7765efe791a8dbcb71673d01`. Worktree vốn có nhiều thay đổi chưa commit từ các lượt trước; staged diff rỗng. Audit đọc **working tree hiện tại**, không đọc riêng HEAD.
- Thời điểm đọc source: 27-09-2026, khoảng 14:14–14:30 ICT. Backend NestJS/Prisma, web React, mobile Expo hiện diện. `AppModule`, controllers, schema/migrations, guards, services, selected tests, web/mobile consumers và diff remediation đã được đọc. Không khởi động backend/web/mobile hay worker.
- Task này chỉ thêm tài liệu dưới `docs/business-exception-audit/`. Không sửa code ứng dụng, tests, schema, migration, seed, dependency hoặc cấu hình. Không thao tác dữ liệu demo/live, không gửi mail, không thu hoặc hoàn tiền.
- **Không chạy Jest, build, E2E, browser hay PostgreSQL concurrency test trong audit này.** Báo cáo remediation trước đó ghi 95 suites/799 tests pass; đó là execution của lượt trước, không phải bằng chứng runtime mới của bộ audit này.

## Kết quả phân loại

| Chỉ số | Kết quả |
| --- | ---: |
| Business-exception scenarios (`BEX-01`–`BEX-26`) | 26 |
| `HANDLED` | 12 |
| `PARTIALLY HANDLED` | 6 |
| `NOT HANDLED` | 6 |
| `CANNOT CONFIRM` | 2 |
| `NOT APPLICABLE` | 0 |
| Unresolved root causes (`BGAP-01`–`BGAP-10`) | 10 |
| Severity của root causes | CRITICAL 0, HIGH 3, MEDIUM 7, LOW 0 |

`HANDLED` có nghĩa là guard/control flow bảo vệ scenario đã khảo sát theo source; **không đồng nghĩa đã kiểm chứng runtime hoặc mọi writer khác**. `CANNOT CONFIRM` dành cho promotion quota race (`BEX-16`) và package entitlement scope (`BEX-19`), không được đếm là lỗi đã chứng minh. Thanh toán/package chỉ audit; remediation vẫn hoãn.

## Các kết luận đáng kiểm tra lại đầu tiên

| ID | Kết luận hiện tại | Bằng chứng chính | Điều Astra cần thử bác bỏ / xác minh |
| --- | --- | --- | --- |
| `BEX-02/11/14`, `BGAP-01` | Các writer create/disable/pause/offboard có guard nhưng giao thức khóa xuyên writer chưa được chứng minh; HIGH | `src/bookings/bookings.service.ts:1172–1265`, `src/branches/branch-state.service.ts:117–140`, `src/staff/staff.service.ts:474–577` | Có writer nào cùng khóa và Serializable đủ để loại interleaving? Nếu vậy hạ status/severity; nếu không, chỉ rõ lịch A/B khả thi. |
| `BEX-05`, `BGAP-03` | Kiểm item/payment trước transaction, rồi CAS chỉ status booking; MEDIUM | `src/bookings/bookings.service.ts:457–510,629–669`, `src/bookings/booking-items.service.ts:105–210` | Item/payment writer có khóa booking hoặc state check nào khiến kết quả sai không thể commit? Đọc toàn bộ writer trước khi khẳng định. |
| `BEX-10`, `BGAP-04` | Impact claim `PROCESSING`, mutate booking và finalize ở các transaction khác; crash có thể kẹt; HIGH | `src/operations/impact.service.ts:58–199` | Có worker/recovery khác không? Phân biệt nonpayment với `CANCEL_REFUND`; không đề xuất replay refund mù. |
| `BEX-12`, `BGAP-05` | SMTP disabled/fail bị `MailService` nuốt, invitation PENDING có thể được báo thành công; MEDIUM | `src/mail/mail.service.ts:22–41`, `src/staff/staff-invitations.service.ts:65–112` | Có signal delivery khác hoặc UI cảnh báo đủ để owner biết và resend không? |
| `BEX-17/18`, `BGAP-06/07` | Split payment va partial unique index; refund request không tính PROCESSING; MEDIUM/HIGH, audit-only | `prisma/migrations/20260715_harden_payment_concurrency/migration.sql:1–5`, `src/payments/payments.service.ts:149–303,363–539` | Xác minh split payment là luồng sản phẩm thực; index có thực áp dụng DB không thể xác nhận từ repo; xem logic PaymentTransaction/ledger trước khi chốt hậu quả. |
| `BEX-20`, `BGAP-08` | Reminder dùng cửa sổ 5 phút, read-before-write không dedupe bền; MEDIUM | `src/scheduler/policy-notification.cron.ts:15–38` | Có single-worker deployment guarantee, catch-up hoặc unique constraint ngoài file này không? |
| `BEX-22`, `BGAP-09` | Recurring compensation có thể fail, cần reconcile; MEDIUM | `src/recurring/recurring.service.ts:39–141` | Kiểm logic bù trừ, worker recovery khác và policy `skipConflicts`; tránh gọi lỗi nếu case đã được xử lý có chủ ý. |
| `BEX-23`, `BGAP-10` | Hai admin moderate cùng stale status có thể ghi event `fromStatus` sai; MEDIUM | `src/reviews/reviews.service.ts:475–515` | Có CAS/row lock/DB trigger ở lớp khác? Product có cho override tức thời không, và audit event phải ghi thế nào? |
| `BEX-25` | Transfer target được đánh dấu HANDLED dù query branch không lọc `reviewStatus` | `src/operations/impact.service.ts:238–279` | Có thể tạo tổ hợp `status=ACTIVE`, `operationalStatus=ACTIVE`, `reviewStatus!=APPROVED` bằng route hiện tại không? Nếu reachable, đổi classification. |

Các GAP cũ đã thay đổi sau remediation: token/auth, ownership CAS, business review CAS, transfer target validation, branch impact coverage, staff PATCH guard, booking catalog recheck. Astra cần đọc source hiện tại trước khi lặp lại finding của [audit cũ](../exception-audit/CRITICAL-GAPS.md); [kết quả remediation](../exception-audit/REMEDIATION-RESULTS.md) chỉ là chỉ mục thay đổi, không phải chứng cứ đủ.

## Kiểm tra đã chạy cho tài liệu này

1. Đếm ma trận: **26 dòng BEX**, đúng 26 heading catalog, đúng 10 dòng BGAP.
2. Tất cả 26 dòng ma trận có đúng **21 cột** được yêu cầu.
3. Đếm status từ chính ma trận: `HANDLED=12`, `PARTIALLY HANDLED=6`, `NOT HANDLED=6`, `CANNOT CONFIRM=2`; khớp README.
4. Quét liên kết Markdown nội bộ của bảy file tài liệu: **0 đường dẫn file bị hỏng**. Kiểm tra này không chứng minh anchor/dòng source là đúng.
5. `git status --short -- docs/business-exception-audit` chỉ thấy thư mục tài liệu mới. Không có test/runtime mới được thực hiện trong lượt audit.

## Phạm vi còn thiếu và câu hỏi đánh giá

Coverage sâu tập trung booking/status/cancel, branch/impact, staff, catalog, ownership, payment/package selected paths; privacy, reports, media, saved services, admin governance chủ yếu mới ở mức inventory/read. **26 scenario là tập đã kiểm, không phải exhaustive inventory của mọi exception.** Chưa xác minh PostgreSQL/Redis thực, migration áp dụng trên demo, UI/browser/mobile runtime, worker topology, E2E multi-account. Đặc tả luận văn có thể lệch source; không dùng nó làm policy duy nhất.

Astra vui lòng đánh giá: (1) bảng role/workspace/ownership và state machine có đúng current source không; (2) mỗi `NOT HANDLED` có reachability, invariant và alternative writer đủ chứng minh không; (3) `HANDLED` nào bị đánh giá quá mức; (4) root causes có bị trùng hoặc thiếu; (5) severity HIGH/MEDIUM có phản ánh hậu quả thực; (6) test coverage labels có chính xác theo assertion, không nhầm test mock với race DB; (7) có ambiguity nào phải chuyển thành `CANNOT CONFIRM`; (8) nội dung payment/package có tuân thủ audit-only và không suy online gateway/webhook không.

Đề nghị phản hồi theo mẫu: **ID → kết luận giữ/đổi → bằng chứng source/schema/test (file:symbol:dòng) → lý do → status/severity đề nghị → kiểm chứng còn thiếu**. Ưu tiên nêu lỗi có thể thay đổi quyết định xử lý trước, rồi mới góp ý trình bày.

## Tài liệu cần đọc

- [README và baseline](README.md)
- [Mô hình nghiệp vụ, inventory, rule, coverage](BUSINESS-SYSTEM-AUDIT.md)
- [Catalog chi tiết BEX](BUSINESS-EXCEPTIONS.md)
- [Ma trận 21 cột](BUSINESS-EXCEPTION-MATRIX.md)
- [Booking state machine](BOOKING-STATE-MACHINE.md)
- [10 BGAP](CRITICAL-BUSINESS-GAPS.md)
- [Luồng use case và exceptions](USE-CASE-EXCEPTION-FLOWS.md)
