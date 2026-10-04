# Root causes cần xử lý

Đây là **7 root cause** tương ứng 7 scenario chưa xử lý trọn vẹn, không phải 7 endpoint. Severity là mức ưu tiên đề xuất từ source; không có runtime verification. Hai HIGH, năm MEDIUM, không tự đặt CRITICAL khi chưa có điều kiện khai thác/tần suất production.

| Gap | Severity | Scenario | Root cause, trigger và invariant | Hướng xử lý + kiểm chứng |
| --- | --- | --- | --- | --- |
| G-01 | HIGH | [BE-05](BOOKING-EXCEPTIONS.md#be-05--complete-và-add-item-đan-xen--not-handled-g-01) | Complete đọc child trước transaction; add item commit sau pre-read; CAS chỉ so parent status (`bookings.service.ts:442-480,560-651`; `booking-items.service.ts:27-82`). Vi phạm COMPLETED ⇒ không còn item active. | Khóa parent rồi đọc/check item trong cùng tx ngay trước CAS; PostgreSQL barrier test 2 writers và assert invariant. |
| G-02 | HIGH | [BE-06](BOOKING-EXCEPTIONS.md#be-06--archive-catalog-sau-precheck-create-chen-vào--partially-handled-g-02) | Archive precheck ngoài tx (`services.service.ts:755-782`), create có thể commit giữa count và update dù có `FOR SHARE` trong create (`bookings.service.ts:1200-1215`). Lịch tương lai gắn catalog archived. | Đưa precheck vào tx sau lock catalog, đồng bộ lock order với create; thử cả hai commit order. |
| G-03 | MEDIUM | [BE-07](BOOKING-EXCEPTIONS.md#be-07--offboard-staff-dùng-impact-completed-cũ--partially-handled-g-03) | Bất kỳ impact case COMPLETED cũ cho phép offboard dù booking mới (`staff.service.ts:521-549`). Booking vẫn assigned staff inactive. | Trong tx khóa staff, lấy current booking IDs và yêu cầu từng ID resolved/đã reassigned; test case cũ + booking mới. |
| G-04 | MEDIUM | [BE-11](BOOKING-EXCEPTIONS.md#be-11--recurring-dở-dang-khi-chết-processcompensation-lỗi--partially-handled-g-04) | Worker chỉ quét CREATING; FAILED sau compensation error cần manual (`recurring.service.ts:117-140`; `recurring-plan-recovery.worker.ts:31-65`). Partial plan có thể tồn tại lâu. | Quyết định policy giữ/hủy kỳ; worker/admin repair idempotent cho FAILED; fault injection sau từng commit. |
| G-05 | MEDIUM | [BE-12](BOOKING-EXCEPTIONS.md#be-12--impact-item-kẹt-processing-sau-crash--not-handled-g-05) | PROCESSING claim riêng; mutation và finalize ở tx khác (`impact.service.ts:58-198`). Process chết không chạy catch; chưa thấy worker sửa trạng thái. | Reconciler dựa trên booking state/audit/operation id; không reset mù để tránh lặp refund/notification; crash test từng ranh giới. |
| G-06 | MEDIUM | [BE-15](BOOKING-EXCEPTIONS.md#be-15--đóng-ngàythu-hẹp-giờ-làm-sau-khi-đã-có-lịch--not-handled-g-06) | Holiday/special day/working hours đổi trực tiếp, không impact check (`staff.service.ts:599-627`, `branches.service.ts:916-930`). Booking active cũ có thể nằm ngoài giờ mới. | Check future booking trước thay đổi, lập impact hoặc từ chối; test đóng ngày đã có lịch. |
| G-07 | MEDIUM | [BE-18](BOOKING-EXCEPTIONS.md#be-18--branch-submitreview-state-và-hồ-sơ-commit-khác-transaction--partially-handled-g-07) | `BranchStateService.transition` commit trước transaction request/event/document (`branches.service.ts:1182-1225,1273-1312`). Lỗi bước hai để state lệch hồ sơ. | Một transaction cho state + hồ sơ, hoặc compensation/reconcile; fault injection ngay sau transition. |

## Giả thuyết cần xác nhận, chưa cộng vào gap

**H-01:** Create re-read branch trong transaction chỉ lọc `status ACTIVE` và business status/restriction (`bookings.service.ts:1183-1195`), trong khi public predicate yêu cầu `reviewStatus APPROVED` và `operationalStatus ACTIVE` (`branch-state.service.ts:45-62`). Precheck create bên ngoài transaction có thể đã xét đủ; cần dựng chính xác writer review/operational update và interleaving, cùng dữ liệu branch đã load tại create, trước khi gán status. Branch transition có recheck future booking (`branch-state.service.ts:117-129`) là counter-evidence. Không khẳng định bypass production.

**H-02 / BE-13:** Guest profile commit trước booking tx (`bookings.controller.ts:275-304`, `bookings.service.ts:1172`). Booking conflict để lại shadow account. Nếu đây là lead cố ý thì không là gap; nếu phải atomic thì cần cùng transaction hoặc cleanup idempotent. Chưa gán severity cho policy chưa rõ.

## DEFERRED_PAYMENT

**Một finding phụ thuộc, BE-14**, tách khỏi 7 root cause: impact cancellation gọi refund request sau khi booking đổi (`impact.service.ts:98-107`). Khi refund request lỗi, booking có thể cancelled nhưng refund chưa được request; cần audit payment/settlement và reconciliation riêng. Refund reservation khác chi tiền thật; `postgres-hardening.integration.spec.ts:466+` có test reservation nhưng NOT RUN. Không gán severity booking chắc chắn, không đề nghị sửa payment trong task chỉ-audit này.

## Ưu tiên test còn thiếu

1. PostgreSQL interleaving complete/add và archive/create: barrier trước/giữa transaction, assert trạng thái cuối, không dùng mock DB.
2. Offboard sau impact COMPLETED cũ + booking mới; impact crash sau mutation; recurring FAILED compensation failure.
3. Counter guest create conflict: so số user/profile/booking trước-sau; test policy lead.
4. Regression ownership 2 tenant, status/cancel/reschedule và migrations deployed. Tất cả execution hiện `NOT RUN`.
