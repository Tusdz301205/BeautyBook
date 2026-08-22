# BeautyBook — Security Audit Before Deploy

Ngày audit: 18/07/2026  
Phạm vi: API NestJS, Prisma/PostgreSQL, Redis, React web, Docker Compose và các luồng upload/combo/recurring mới.

## Kết luận

Các lỗi có thể sửa an toàn trong source đã được xử lý và xác minh bằng build, Jest, Prisma validate/migrate và smoke test trên Docker. Tài liệu này **không** tuyên bố hệ thống đã production-ready tuyệt đối. Trước khi có người dùng thật vẫn cần hoàn thành cookie/CSRF, hạ tầng lưu file production, distributed scheduler/limiter, backup-restore drill, quan sát tập trung và kiểm thử xâm nhập độc lập.

Quy ước trạng thái:

- **FIXED**: đã sửa trong code và có phép kiểm tra tương ứng.
- **PARTIAL**: đã có lớp bảo vệ chính nhưng còn hạng mục production.
- **NOT IMPLEMENTED**: không giả lập; cần hạng mục riêng.
- **PRODUCTION LIMITATION**: phụ thuộc hạ tầng/provider/deployment.

## Ma trận audit A–Z

| Hạng mục | Trạng thái | Kết quả thực tế | Việc còn lại trước production |
|---|---|---|---|
| Authentication | **FIXED** | Bcrypt cost 12; login/register/logout/reset; access 15 phút; refresh 30 ngày; refresh token được gắn `jti`, chỉ lưu SHA-256 trong `user_sessions`, rotate một lần và chặn replay; password reset/change thu hồi các session. Auth endpoint có throttle riêng. | Kiểm thử xâm nhập luồng account recovery và chính sách khóa tài khoản theo rủi ro. |
| Password | **FIXED** | Backend bắt current password, độ dài/quy tắc DTO, không cho dùng lại mật khẩu hiện tại; frontend có confirm, show/hide và strength indicator. | Có thể bổ sung password-history nhiều phiên bản và breached-password check qua provider. |
| Session | **FIXED** | Danh sách session, current device, last active, revoke từng session, revoke all other sessions, chặn revoke nhầm current session từ UI/API, security history. | Chuẩn hóa parser browser/OS; retention policy cho session/audit. |
| RBAC | **FIXED** | Guard role + permission + scope ở backend; quyền không chỉ ẩn ở frontend; permission contract test pass. Media/combo/recurring dùng permission và tenant guard. | Duy trì test contract khi thêm route mới. |
| Tenant isolation / IDOR | **FIXED** | `assertBusinessAccess`, `assertBranchAccess`, scope resolver và ownership check áp dụng cho booking, staff, media, promotion, reports. Private media trả 404/403 khi không có scope. | Chạy DAST có ma trận ID chéo trên môi trường staging riêng. |
| Input validation | **FIXED** | Global `ValidationPipe` bật whitelist, reject field lạ và transform; DTO kiểm enum/date/money/count; body limit 1 MB; upload limit 10 MB. | Fuzz API tự động trong CI. |
| XSS | **PARTIAL** | React render text mặc định; không có `dangerouslySetInnerHTML`, `innerHTML`, `eval` trong frontend; Helmet bật ở API. | Thêm CSP production chặt, loại bỏ/host nội bộ Google Fonts và chạy stored-XSS DAST cho review/description/note. |
| CORS | **FIXED** | Allowlist lấy từ `CORS_ORIGINS`; production từ chối `*`; WebSocket dùng cùng nguyên tắc allowlist. | Cấu hình chính xác domain staging/production, không dùng localhost. |
| CSRF / cookie | **NOT IMPLEMENTED** | API hiện dùng Bearer token, không dựa vào cookie auth nên CSRF cookie chưa áp dụng. | Di chuyển access/refresh token sang HttpOnly + Secure + SameSite cookie, thêm CSRF token và rollout đồng bộ web/API. |
| Token storage | **PRODUCTION LIMITATION** | Zustand hiện persist access/refresh token trong `localStorage`; source đã giảm XSS surface nhưng localStorage vẫn bị đọc nếu XSS xảy ra. | Đây là blocker cho mức bảo mật trình duyệt cao: hoàn tất cookie migration trước public launch. |
| Upload security | **FIXED / PARTIAL** | Kiểm tra magic bytes + MIME + extension; chỉ JPG/PNG/WebP/AVIF/PDF; cấm executable/SVG/HTML/JS; tên lưu UUID; path traversal guard; public/private; legal PDF bắt buộc private; permission delete/read; upload/delete legal docs có audit; upload throttle; Docker volume giữ file qua restart. | Local volume chưa phải object storage HA; chưa antivirus/CDR; private URL là authenticated endpoint chứ chưa signed URL ngắn hạn. Dùng S3-compatible private bucket + malware scan trước production lớn. |
| Rate limiting | **PARTIAL** | Global 100 request/phút theo IP/user; auth và upload có limit riêng. | Store throttler còn process-local; chuyển sang Redis store khi chạy nhiều replica và tinh chỉnh booking/payment/review limit theo traffic thật. |
| Booking concurrency | **FIXED** | Transaction, slot reservation, overlap validation, unique/locking hardening hiện hữu; combo bung item và giữ duration toàn bộ; recurring preview từng occurrence và không tạo chuỗi khi có conflict chưa xử lý. | Chạy PostgreSQL integration/load test song song trên staging với dữ liệu production-like. |
| Payment/refund | **PARTIAL** | Amount lấy từ snapshot server, không tin client; idempotency bắt buộc cho mutation nhạy cảm; refund không vượt số đã trả; review/process tách action; audit money action. | Không có gateway/callback/signature/reconciliation production; mock phải tắt khi `NODE_ENV=production`. |
| Secrets / environment | **FIXED** | Production fail-fast nếu JWT secret thiếu/yếu/default; `.env.example` chỉ là mẫu; request log không in token. | Secret manager, rotation runbook, TLS termination và CI secret scan. |
| Audit trail | **FIXED / PARTIAL** | Audit role/security/profile, onboarding, trust action, setting, money, attendance và legal document. Audit helper không log raw exception/payload nhạy cảm. | Bất biến hóa toàn bộ `audit_logs` bằng DB permission/trigger tương tự health-access audit và thiết lập retention/export SIEM. |
| Backup / restore | **PARTIAL** | Compose dùng named volume; migration dùng `migrate deploy`; không có seed trong startup; README cảnh báo không seed production. | Có backup mẫu nhưng chưa có bằng chứng restore drill định kỳ. Thiết lập PITR, mã hóa backup và diễn tập restore có RTO/RPO. |
| Monitoring | **PARTIAL** | `/api/v1/health`, DB health, request ID, structured Nest logs, graceful shutdown, Docker healthcheck. | Central logs, metrics, tracing, alert, SLO, slow-query/APM và on-call runbook. |
| 2FA | **NOT IMPLEMENTED** | UI không giả lập 2FA. | TOTP/WebAuthn, backup code và recovery policy cho Admin/Owner. |

## Thay đổi bảo mật trong hạng mục này

- Migration `20260718_z_refresh_token_rotation` thêm `user_sessions.refresh_token_hash`.
- Refresh-token rotation dùng token nonce (`jti`), hash tại DB, atomic claim và reject replay.
- Password change/reset thu hồi session; trang bảo mật có revoke session khác và lịch sử bảo mật.
- Upload thật có magic-byte validation, allowlist type/extension, giới hạn size, UUID path, public/private isolation, permission, audit và throttle.
- Legal onboarding không còn nhận URL tùy ý; chỉ nhận media private thuộc đúng business/user.
- Combo và recurring controller có role/permission; service kiểm branch/business/service/staff/availability.
- CORS, Helmet, body limit, production-secret validation và global DTO validation được giữ nguyên.
- Hallmark/accessibility pass thay modal khóa tài khoản bằng dialog có focus trap; form có focus-visible rõ.

## Kiểm tra đã chạy

- `npx prisma format` — PASS.
- `npx prisma validate` — PASS.
- `npx prisma generate` — PASS.
- `npm run build` tại API — PASS.
- `npm test -- --runInBand` — 30 suite PASS, 160 test PASS; 1 suite/4 test được skip theo cấu hình.
- `npm run build` tại web — PASS, 3.322 modules transformed.
- `docker compose config` — PASS.
- `prisma migrate status` trên container và health/smoke test được ghi ở report tổng sau lần deploy cuối.

## Gate bắt buộc trước public launch

1. Chuyển token khỏi `localStorage` sang HttpOnly cookie + CSRF.
2. Dùng object storage private, signed URL, malware scan và backup media.
3. Redis-backed throttler và distributed lock/queue cho scheduler.
4. Tích hợp payment provider thật với signature, webhook idempotency và reconciliation.
5. Chạy SAST/dependency scan/DAST, tenant-IDOR test và load/concurrency test trong CI staging.
6. Backup PITR + restore drill; central monitoring/alert/SLO.
7. Bắt buộc 2FA cho tài khoản đặc quyền.
