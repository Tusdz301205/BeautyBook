# Kế hoạch khắc phục lỗi BeautyBook

Baseline: `main` tại `761d3607297e72bb7765efe791a8dbcb71673d01`, worktree đã có 103 file tracked thay đổi và nhiều file untracked trước đợt sửa này. Tất cả được giữ nguyên. Báo cáo audit gốc là bằng chứng ban đầu, không phải trạng thái đã sửa.

Phạm vi hiện tại: sửa 21 GAP ngoài nghiệp vụ thanh toán; ưu tiên xác thực/quyền, sau đó tính nhất quán lịch, workflow, dữ liệu và contract. Chỉ dùng database test cô lập cho migration và kiểm tra race thực; không chạy seed/migration trên demo hoặc production.

| Cụm | GAP | Tiêu chí hoàn thành |
| --- | --- | --- |
| Auth | 01, 02, 11 | Đổi mật khẩu, consume token, thu hồi phiên và rotation có transaction/CAS; lỗi hạ tầng không bị đổi thành 401; test race và rollback. |
| Quyền/concurrency | 04, 05 | Chuyển branch kiểm tra staff/slot/revision; chuyển chủ không ghi đè kết quả đã hoàn thành. |
| Shared clients | 06, 12, 13 | Idempotency có owner fence; web/mobile fence session và xử lý lỗi tạm thời. |
| Booking/operations | 07, 09, 10, 15, 16, 24 | Outbox bền vững, recovery impact, khóa branch/catalog, recurring preview và offboard đúng invariant. |
| Workflow/data | 08, 14, 17, 21, 22, 23 | Mail state, runtime DTO, safe response, ownership route, review CAS, reminder dedupe. |
| Contract | 20 | Generated OpenAPI phản ánh runtime metadata; contract test pass. |

Phụ thuộc quan trọng: GAP-01/02/11 cùng dùng DB session; GAP-04/09/10/15/24 cùng chạm lịch và cần protocol concurrency tương thích; GAP-06/07 cần xử lý retry sau commit. Các GAP-03/18/19 và nhánh phí GAP-07, tài chính GAP-09, pricing GAP-15 được hoãn theo [DEFERRED-PAYMENT.md](DEFERRED-PAYMENT.md).

Trạng thái thật, lệnh kiểm tra và giới hạn theo từng GAP nằm tại [REMEDIATION-RESULTS.md](REMEDIATION-RESULTS.md). Không coi unit mock là chứng minh an toàn race PostgreSQL.
