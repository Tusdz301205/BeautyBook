# Luồng đặt lịch chỉ cần xác nhận khách đến

Quyết định nghiệp vụ ngày 13/10/2026: khách đặt lịch, cơ sở xác nhận, lễ tân xác nhận khách đã đến, nhân viên xem lịch và phục vụ, khách ra về. Nhân viên không phải bấm START hoặc COMPLETE. Với lịch dùng gói đã mua, **check-in là thời điểm ghi nhận dùng buổi**, theo lựa chọn trực tiếp của người dùng.

Tài liệu này thay thế yêu cầu START/COMPLETE bắt buộc trong các báo cáo nghiệm thu trước đây; các bằng chứng cũ vẫn được giữ làm lịch sử.

## Hành vi đã triển khai

| Bước | Người thực hiện / kết quả |
|---|---|
| Đặt lịch | Giữ luồng đặt trực tuyến / tại quầy, khả dụng, xác nhận, hết hạn giữ chỗ, voucher và giá hiện tại. |
| Xác nhận lịch | Người vận hành có quyền xác nhận; lịch hết hạn giữ chỗ vẫn bị chặn ngay, không chờ worker. |
| Khách đến | Lễ tân hoặc Owner có quyền check-in xác nhận. Backend ghi CHECKED_IN và lịch sử trong transaction. Giữ các kiểm tra thời điểm check-in đã có. |
| Dùng gói | Các buổi RESERVED hợp lệ của lịch chuyển REDEEMED trong transaction check-in; gọi lại không trừ thêm. Dịch vụ SKIPPED/CANCELLED không bị tiêu buổi. |
| Phục vụ | Staff xem ngày, giờ, khách và dịch vụ được phân công. Không có START/COMPLETE hoặc thao tác thay đổi lịch trong web/mobile; API cũng chặn các thao tác ghi từ Staff. |
| Qua giờ hẹn dự kiến | Lịch CHECKED_IN được phân loại HISTORY khi đọc. Không tự ghi COMPLETED, không giả tạo actualStartedAt/actualCompletedAt, không tự ghi đã thanh toán. |
| Đánh giá | Khách của lịch được đánh giá sau khi lịch đã check-in và qua giờ kết thúc dự kiến, hoặc với lịch COMPLETED lịch sử. Lịch hủy/không đến không được đánh giá. Giữ giới hạn đánh giá, moderation và ownership. |
| Thanh toán | Ghi nhận khoản thu thật độc lập với Staff START/COMPLETE; check-in không có nghĩa đã thanh toán. |

## Trạng thái, thời gian và quyền

- Trạng thái lưu DB của lịch mới đã đến tiếp tục là CHECKED_IN. `scheduleBucket`, `scheduleElapsed`, `scheduledStartAt`, `scheduledEndAt`, `serverNow`, `canReview` là dữ liệu chiếu khi đọc; HISTORY không phải bằng chứng dịch vụ đã kết thúc thực tế.
- Không lấy thời lượng dự kiến để tính giờ hoàn thành thực tế. Khi không có audit thực tế, thời gian vẫn UNKNOWN/null. Audit START/COMPLETE cũ và cơ chế bổ sung/hiệu chỉnh có lý do, permission và lịch sử được giữ nguyên.
- Staff không có quyền sửa giờ thực tế, kể cả khi còn bản cấp quyền cũ. Owner và Receptionist được cấp explicit permission vẫn tuân theo cơ chế correction hiện có; không mở quyền mặc định cho Receptionist.
- API START/COMPLETE lịch sử vẫn tồn tại cho ngoại lệ Owner có quyền và vẫn kiểm tra lifecycle, tài chính, revision, thời gian và xung đột. Các nút này không thuộc luồng vận hành thông thường. Không xóa audit hoặc chuyển hàng loạt lịch cũ.
- No-show tiếp tục dựa vào khách chưa đến, sau ngưỡng hiện hành hơn 15 phút và xác nhận thủ công của người có quyền. Không suy ra no-show từ việc nhân viên không bấm START.
- Khách đã check-in nhưng lịch bị hủy sau đó vẫn có bằng chứng lượt đến trong statusHistory. Quy tắc khách cũ và báo cáo không quên lượt đến đó. Buổi đã dùng không tự trả lại chỉ vì hủy sau check-in.

## Các phụ thuộc đã điều chỉnh

- Truy vấn lịch sử/lịch sắp tới lọc theo cùng thời điểm server trước phân trang, kể cả dữ liệu TIME qua ngày cũ. `my-appointments?tab=all` trả một snapshot để mobile không ghép ba truy vấn có thể lệch thời điểm.
- Web khách hàng, lịch điều phối và mobile customer/owner/staff đặt lịch refetch khi qua giờ kết thúc dự kiến. Có chặn response cũ, đổi tài khoản/phạm vi và unmount; timer chỉ tải lại dữ liệu, không ghi lifecycle.
- Lịch đã check-in và qua giờ dự kiến không còn mắc kẹt trong danh sách chưa kết thúc. Legacy IN_PROGRESS vẫn giữ bằng chứng và cơ chế ngoại lệ riêng.
- Gia hạn dịch vụ lưu đúng giờ địa phương trong cột TIME; không ghi UTC instant vào TIME gây lệch mốc lịch sử.
- Quy tắc khách mới/khách quay lại và phát voucher nhận biết lượt check-in, bao gồm lịch đã hủy nhưng có audit đã đến.
- Thu tiền chấp nhận lịch đã CHECKED_IN. Phí nền tảng chỉ được ghi nhận khi có lượt đến và khoản thu hợp lệ; thay đổi giá sau đó đối soát bằng adjustment/ledger bổ sung, không sửa mất phí ban đầu. Doanh thu dựa trên khoản thu ròng thực tế, không tự tạo doanh thu lúc check-in. Số lịch COMPLETED vẫn chỉ đếm trạng thái thật.
- Đặt buổi trong gói kiểm tra cả quyền với gói và chi nhánh của lịch. Đặt bổ sung cho lịch đã check-in được ghi dùng ngay, idempotent theo dịch vụ. Bỏ qua/hủy dịch vụ trước check-in giải phóng phần giữ buổi.
- Giao diện Staff không hiển thị tổng tiền giả bằng 0 khi API đã lược bỏ dữ liệu tài chính.

## Kiểm thử bản sửa

Baseline Git trước sửa: `7558b7a4302e303854fb567e963af8544eb73fd2`, working tree sạch. Không reset/revert, migration, seed, backfill hoặc xóa dữ liệu. Bằng chứng runtime không commit nằm ở `report-output/check-in-only-20261013/`.

| Kiểm tra | Kết quả |
|---|---|
| Backend typecheck / build | Đạt, `api-typecheck-release.log`, `api-build-release.log`. |
| Backend Jest đầy đủ | 146 suites / 1.606 test đạt; 7 suites / 158 test tích hợp bỏ qua. `api-full-release.log`. |
| Lint hai file attendance mới và test sau dọn typing | Đạt; 30 test attendance đạt. `api-new-files-lint.log`, `api-attendance-lint-cleanup-test.log`. Không tuyên bố toàn repo lint sạch. |
| PostgreSQL thật, transaction READ ONLY | 177 lịch, ba truy vấn phân loại đối chiếu projection đạt; `postgresql-read-only.json`. |
| API đã build, QA riêng cổng 3014 | 38 kiểm tra đạt; login thật, chín lịch khách cùng cutoff, Staff chỉ đọc đúng phân công/không nhận dữ liệu tài chính, START/COMPLETE/parent START đều 403, hash lịch/items/audit không đổi. `api-live.json`. |
| Frontend | 281 test đạt sau sửa hiển thị tiền Staff; bản sửa copy cuối build đạt. Log ở nested frontend `report-output/check-in-only-20261013/final-ui-approved-npm-test.log` và `final-copy-build.log`. |
| Mobile source | Typecheck và 225 Node test đạt trên source cuối; `mobile-final-typecheck.log`, `mobile-final-unit.log`. Không chạy emulator/Metro/native cho revision này. |
| Trình duyệt thật | 15 ca đạt ở vai trò Receptionist/Staff/Customer; 375/768/1024/1440 px không tràn ngang ở các màn được kiểm. Không lỗi console error trong cửa sổ kiểm tra của hai tab Staff/Customer. `browser-cases.json`. |

Hai runtime local đã nạp bản build mới: demo API 3000 dùng `glowbook_db`; QA API 3014 dùng DB kiểm thử riêng. Email ngoài hệ thống và tám global worker tắt trong helper kiểm thử. Web demo 5173 giữ nguồn dữ liệu cũ, không trỏ sang QA. Browser dùng tài khoản demo và xem dữ liệu; không check-in/hủy/ghi thu hoặc trừ buổi trên dữ liệu demo cũ.

Các lỗi test cũ được giữ riêng: expectations Staff còn cho START trước đổi yêu cầu, mock thiếu contract, sandbox Node `spawn EPERM`, thao tác điền date của runner chưa phát change. Không coi chúng là sản phẩm đạt hoặc âm thầm xóa bằng chứng thất bại.

Browser đã mở lịch được phân công thật trên demo cũ: lễ tân còn check-in; Staff không có check-in/START/COMPLETE/hủy/thêm dịch vụ, không thấy giá giả 0. Hai lịch CHECKED_IN QA đã qua giờ xuất hiện trong Lịch sử với nút đánh giá; form mở được nhưng không gửi. Browser phát hiện câu cũ của form khẳng định “đã hoàn thành”; đã đổi sang mã lịch trung tính và kiểm tra lại. Copy tương tự trong mobile lịch sử/lịch biểu/đánh giá cơ sở đã được đồng bộ.

Ảnh đã lưu: `reception-detail-375.png`, `reception-detail-1440.png`, `staff-detail-375.png`, `staff-detail-1440.png`, `customer-history-375.png`, `customer-history-1440.png`, `review-dialog-1440.png` (cùng prefix bằng chứng trên). Ảnh bốn chiều rộng được giữ đầy đủ; desktop Staff, mobile Staff/Receptionist và desktop Customer đã được mở xem. Đây là web responsive, không phải ảnh ứng dụng native.

## Giới hạn nghiệm thu

1. Chưa chạy luồng native trên thiết bị cho revision này, theo `mobile/AGENTS.md`; không dùng browser màn hẹp thay bằng chứng native.
2. Các kiểm tra dùng buổi, thu tiền, fee adjustment và race tài chính ở mức unit/transaction doubles; chưa tạo khoản thu hoặc tiêu buổi thật trong DB demo. 158 integration test bỏ qua không được tính PASS.
3. Legacy DATE/TIME vẫn dùng BOOKING_TIME_ZONE chung. Predicate có test dữ liệu qua ngày, không đồng nghĩa hỗ trợ đầy đủ mọi branch timezone/DST hoặc booking qua ngày mới.
4. Không đo được thời lượng thực tế khi nhân viên không ghi START/COMPLETE. Báo cáo không được gắn thời lượng dự kiến thành thực tế. Không tự phục hồi buổi đã dùng khi check-in nhầm; xử lý ngoại lệ phải có nghiệp vụ/audit riêng.
5. Không backfill gói hoặc lifecycle của toàn bộ lịch lịch sử; giữ nguyên dữ liệu cũ. Không tuyên bố toàn bộ BugReport/native/external/production đã nghiệm thu 100%.
