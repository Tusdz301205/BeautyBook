# Owner mobile V1

Triển khai tại `mobile/src/operations/owner/`, API/types tách tại `src/api/ownerOperations.ts` và `src/types/ownerOperations.ts`.

- Tổng quan: chi nhánh accessible trong business của session, ngày lịch từng chi nhánh, tổng lịch/trạng thái từ owner-dashboard. Aggregate qua các chi nhánh được phép, không gọi số dòng trang đầu là tổng. Không hiển thị doanh thu/hoa hồng. ACTIVE profile không được gọi là nhân viên đang trong ca.
- Lượt polish 06/10: việc cần xử lý nằm trước số liệu ngày và danh sách chi nhánh. Chỉ báo “Không có việc chờ xử lý” khi hai API đã tải thành công và cùng có số lượng 0; loading/error không được coi là 0. Chi nhánh dùng thẻ gọn, giữ đúng nghĩa hồ sơ nhân viên hoạt động. Link desktop được giữ ở nơi luồng mobile dừng, không lặp trên từng thẻ chi nhánh.
- Thẻ yêu cầu có nhãn loại đổi/hủy và khách/lịch; thẻ ảnh hưởng vận hành có icon/viền riêng, nguyên nhân, trạng thái và hạn xử lý. Lý do yêu cầu đầy đủ nằm trong màn xét duyệt hiện có. Tab vận hành cho phép nhãn xuống dòng và tăng chiều cao theo font scale/safe area.
- Chi nhánh có chỉ báo attention từ request/impact của đúng branch khi hai nguồn đều tải thành công; impact toàn doanh nghiệp không bị gán giả cho từng branch. Màn detail dùng header native-stack để tránh lặp title/safe-area. Native xác nhận spacing cuối còn vướng bootstrap sau khi môi trường QA dừng; TESTS.md phân biệt source PASS với phần native chưa xác nhận.
- Vận hành: pending change requests và operational impact cases, phân biệt hai loại. Review hiển thị trước/sau, thời hạn thật, lý do; success quay về danh sách sau server xác nhận. Yêu cầu đã xử lý/không còn chờ không được báo như lỗi lưu. Slot conflict giữ nguyên request và lịch; đọc lại trước retry.
- Ngoại lệ: confirm/reject booking PENDING và check-in chỉ trong chi tiết/Thao tác khác. Không có START/COMPLETE ở Owner shell. Personal-work mode yêu cầu profile ACTIVE của chính tài khoản trong business được phép.
- Impact: APPROVED_EXCEPTION qua endpoint case/item, complete chỉ khi mọi item RESOLVED và case READY_TO_COMPLETE. Các nhánh chuyển cơ sở, refund và phân công/đổi lịch phức tạp tiếp tục desktop.
- Account/notifications dùng hạ tầng chung; link desktop chỉ origin cấu hình và allowlist, không gắn token. Notifications theo user, không giả định theo branch.

Mutation gửi `X-Mobile-Owner-V1: true`; server chặn cancel/reject có liên kết tài chính/quyền lợi. Giữ desktop compatibility khi không có header. Preflight fingerprint kiểm tra nội dung user đã xem; session generation **và context/unmount fence** được kiểm tra trước write. Không optimistic success hoặc blind replay khi timeout.

Owner có profile Staff ở business khác không bị chặn Owner context: 403 của personal-profile lookup là thiếu khả năng cá nhân tùy chọn, không xóa branches đã có quyền Owner. Staff-only vẫn bị chặn khi profile lookup 403. Staff được giao nhưng endpoint pending không trả tên được ghi “Đã phân công; chưa tải tên nhân viên”, không bịa “Chưa phân công”.

Người chưa có business context chỉ đọc trạng thái hồ sơ thật và tiếp tục trên web, không dựng onboarding wizard mobile.

Nguồn QA: [TESTS.md](TESTS.md). Native thực tế: login/restore Owner, dashboard, reschedule approval, slot-conflict denial, chuyển về Vận hành sau success và giữ nguyên màn nhận cập nhật từ web. Các ca chưa chạy được ghi riêng, không suy ra từ typecheck.
