# Kiểm toán ngoại lệ nghiệp vụ đặt lịch BeautyBook

Baseline: working tree ngày 2026-09-27, `main` tại `761d3607297e72bb7765efe791a8dbcb71673d01`. Working tree đã có thay đổi từ trước; nhận định dưới đây dựa trên **nội dung hiện tại**, không phải HEAD sạch. Đây là kiểm toán tĩnh, không phải xác nhận hệ thống production.

Đã đọc đường đi web/mobile → controller/permission → service → Prisma transaction → worker và các migration bảo vệ slot. Đọc test liên quan nhưng **không chạy**: PostgreSQL integration test cần DB thử nghiệm được cô lập; task không cho phép khởi động, seed hoặc thay đổi DB. Không truy cập deployed DB, không xác nhận migration đã áp dụng. Không sửa code ứng dụng. Phần payment chỉ xét ảnh hưởng trực tiếp đến booking và đánh dấu `DEFERRED_PAYMENT`.

## Mục lục

1. [Luồng thực tế](BOOKING-FLOW.md)
2. [Quy tắc nghiệp vụ](BOOKING-BUSINESS-RULES.md)
3. [Ngoại lệ chi tiết](BOOKING-EXCEPTIONS.md)
4. [Ma trận ngoại lệ](BOOKING-EXCEPTION-MATRIX.md)
5. [State machine](BOOKING-STATE-MACHINE.md)
6. [Concurrency](BOOKING-CONCURRENCY-AUDIT.md)
7. [Ownership](BOOKING-OWNERSHIP-AUDIT.md)
8. [Root causes ưu tiên](CRITICAL-BOOKING-GAPS.md)
9. [Use case ngoại lệ](USE-CASE-BOOKING-EXCEPTION-FLOWS.md)

## Cách đọc kết luận

`HANDLED`: source thể hiện cơ chế phù hợp với scenario cụ thể. `PARTIALLY HANDLED`: có cơ chế nhưng một nhánh/writer/recovery còn hở. `NOT HANDLED`: đường đi áp dụng được và thiếu guard cần thiết có thể chỉ ra. `NOT APPLICABLE`: không có flow còn hoạt động. `CANNOT CONFIRM`: thiếu policy hoặc bằng chứng để chốt. Evidence: `SOURCE_VERIFIED` = đọc source; `TEST_ASSERTION_VERIFIED` = đã đọc assertion thực tế nhưng không đồng nghĩa test vừa chạy; `RUNTIME_VERIFIED` = có phép kiểm chứng runtime của task này (không có); `HYPOTHESIS_REQUIRES_VALIDATION` = interleaving cần tái hiện. Severity chỉ cho gap đủ bằng chứng, xét khả năng xảy ra và tác động, không gán theo tên nhóm lỗi. Coverage `TESTED` nghĩa là assertion có trong test; execution của mọi case ở đây là `NOT RUN`.

Ma trận có **18 scenario**: HANDLED 9, PARTIALLY HANDLED 4, NOT HANDLED 3, NOT APPLICABLE 0, CANNOT CONFIRM 2. Có **7 root cause** đã xác định (HIGH 2, MEDIUM 5), thêm 2 giả thuyết/policy cần kiểm chứng. Một finding payment phụ thuộc booking, **không** tính vào 7 root cause. Số scenario khác số root cause và số endpoint.

Các phạm vi chưa xác minh: dữ liệu và cấu hình production, migration runtime, hành vi lock thực trên DB cụ thể, kết quả test, khả năng gửi email/push, thanh toán/settlement end-to-end, toàn bộ UI quản trị không trực tiếp đổi booking. Các tính năng waitlist/loyalty/invoice đã bị gỡ trong working tree nên không được tính là entry point hoạt động.

## Đối chiếu nhận định cũ

Đã xác nhận lại: branch `FOR UPDATE` trong create chỉ chạy khi controlled overflow (`beauty-booking-api-main/src/bookings/bookings.service.ts:1264-1279`); promotion/voucher reserve có `FOR UPDATE` (`beauty-booking-api-main/src/promotions/pricing-engine.service.ts`, hàm `reserve`); recurring **có** recovery worker đăng ký (`beauty-booking-api-main/src/recurring/recurring.module.ts:5`, `recurring-plan-recovery.worker.ts:8-77`). Migration dùng trigger + advisory lock, không phải exclusion constraint. Nhận định về duplicate sau response-lost được thu hẹp: customer-overlap guard có thể chặn retry và để client không biết mã booking; không mặc định tạo bản sao. Các kết luận cũ khác chỉ được dùng làm đầu mối, không nhập số liệu cũ.

| Đầu mối audit cũ (không phải ID mới) | Đối chiếu ở audit này | Điều chỉnh kết luận |
| --- | --- | --- |
| `BEX-01/02`, `BGAP-01` | BE-01/02/06/08; G-02 | Tách create/create, archive/create, branch transition; trigger không phải exclusion constraint. |
| `BEX-03`, `BGAP-02` | [Concurrency: idempotency](BOOKING-CONCURRENCY-AUDIT.md#idempotency-và-response-lost) | Response-lost có thể dẫn tới replay fail/conflict; chưa chứng minh duplicate booking nhờ customer overlap. |
| `BEX-04/05`, `BGAP-03` | BE-04/05; G-01 | Chốt interleaving complete/add item sau pre-read; payment branch vẫn deferred. |
| `BEX-06/07/08` | BE-09/04/17 | Direct cancel, no-show, review ownership kiểm lại theo source; không gộp vào root cause. |
| `BEX-10/11`, `BGAP-04` | BE-12/08; G-05 | Impact crash còn hở; branch transition hiện có recheck coverage trong tx, không giữ verdict chung cho mọi writer. |
| `BEX-13/16/22/26`, `BGAP-09` | BE-06/11/16; G-02/04 | Archive race khác snapshot; PricingEngine có lock; recurring có recovery CREATING; giờ địa phương có guard. |

Các ID `BEX/BGAP` thuộc tài liệu cũ trong `docs/business-exception-audit/`; bảng chỉ là mapping câu hỏi, không chuyển trạng thái cũ sang kết luận mới. Phần review moderation, ownership transfer và reminder worker không nằm trong root cause booking trừ khi ảnh hưởng trực tiếp vòng đời booking.
