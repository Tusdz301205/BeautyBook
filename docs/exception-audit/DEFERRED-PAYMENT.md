# Phần thanh toán hoãn xử lý

Theo phạm vi đợt này, các phần dưới đây chưa sửa, chưa migrate và chưa kiểm thử với tiền thật:

| GAP/nhánh | Tình trạng và hướng tiếp tục |
| --- | --- |
| GAP-03 | Chỉ mục một khoản PAID/booking xung đột split payment. Cần thống nhất ledger, giới hạn tổng thu và migration riêng. |
| GAP-18 | Refund PROCESSING chưa giữ chỗ số dư. Cần thiết kế reserve/settlement và kiểm tra concurrency bằng DB cô lập. |
| GAP-19 | Package entitlement ở booking terminal hoặc sai branch. Cần chính sách quyền lợi và invariant DB/transaction trước khi sửa. |
| GAP-07 phí | Recovery/đối soát platform fee sau booking vẫn chưa xử lý. Không che lỗi này bằng success giả. |
| GAP-09 tài chính | Không tự replay CANCEL_REFUND hoặc refund side effect trong worker recovery. |
| GAP-15 pricing | Chưa thay đổi reprice, discount, financial quote hoặc snapshot lịch sử. |

Nguồn bằng chứng chi tiết ở [CRITICAL-GAPS.md](CRITICAL-GAPS.md); tất cả phần này giữ trạng thái `DEFERRED_PAYMENT`.
