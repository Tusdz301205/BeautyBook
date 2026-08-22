# Known limitations

Cập nhật: 18/07/2026

Các luồng media, combo và recurring đã có API/UI thật; danh sách dưới đây chỉ ghi những phần chưa nên hiểu là đã hoàn thiện ở mức production.

- Không có app mobile native, Flutter/React Native hoặc APK.
- Upload hiện lưu trên Docker named volume/local filesystem. Chưa có object storage HA, signed URL ngắn hạn, antivirus/CDR hoặc quy trình backup media độc lập. Upload đã nối cho avatar user, giấy tờ pháp lý, logo doanh nghiệp, ảnh chi nhánh, ảnh dịch vụ, ảnh nhân viên/portfolio và ảnh combo; chưa có gallery nhiều ảnh hoàn chỉnh, ảnh review và banner promotion có quan hệ dữ liệu riêng.
- Combo hỗ trợ một nhân viên có đủ kỹ năng cho toàn bộ dịch vụ. Chưa hỗ trợ tách từng dịch vụ cho nhiều nhân viên, hủy/refund một phần combo hoặc payment provider thật.
- Recurring hỗ trợ preview, phát hiện/bỏ qua conflict, tạo plan, pause/resume, hủy một buổi và hủy cả chuỗi. Chưa có reschedule cả chuỗi, chỉnh riêng từng conflict ngay trong preview hoặc thanh toán trước toàn chuỗi.
- Tự phát voucher đã triển khai cho birthday month. Các audience khác có thể cấu hình nhưng chưa có scheduler đầy đủ cho new/loyal/win-back/off-peak.
- Notification có read/unread, filter, detail và action URL; độ đầy đủ của từng loại sự kiện còn phụ thuộc nơi phát event. Socket.IO có sẵn, nhưng production nhiều replica vẫn cần adapter/queue dùng chung.
- Web vẫn lưu bearer token trong `localStorage`. Refresh token đã rotate/replay-protect ở server, nhưng public launch cần chuyển sang HttpOnly/Secure/SameSite cookie và thêm CSRF protection.
- Rate limiter hiện process-local; scheduler/lock chưa phân tán. Cần Redis-backed limiter/queue khi chạy nhiều replica.
- Chưa có payment gateway, webhook signature, provider reconciliation, SMS hoặc mobile push production.
- Chưa có 2FA/TOTP/WebAuthn. UI không giả lập tính năng này.
- Frontend chưa có automated unit/E2E/visual-regression suite. Production build và browser smoke test không thay thế ma trận thiết bị thật 375/768/1024/1440.
- Chưa thực hiện độc lập các gate production: SAST/dependency scan/DAST, tenant-IDOR matrix, load/concurrency test staging, backup/PITR restore drill, central observability/SLO/on-call.
- Không tuyên bố production-ready cho tới khi hoàn tất các blocker trong `SECURITY_AUDIT_BEFORE_DEPLOY.md`.
