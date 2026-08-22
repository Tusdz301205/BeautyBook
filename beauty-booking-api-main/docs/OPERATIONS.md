# Operations runbook

## Deploy

1. Build immutable API và web images.
2. Backup PostgreSQL.
3. Chạy `npx prisma migrate deploy` bằng cùng image API.
4. Khởi động API, chờ `/api/v1/health` trả `status=ok`.
5. Khởi động web/ingress và smoke-test login, booking, payment list.

## Rollback

- Roll back application image trước; Prisma migrations trong dự án là forward-only.
- Nếu migration phá vỡ tương thích, triển khai migration sửa tiến thay vì tự động down migration.
- Khôi phục database chỉ khi có phê duyệt và bản backup đã kiểm tra.

## Monitoring

- HTTP: error rate theo status, p95/p99 latency, rate-limit rejects.
- Business: booking PENDING quá SLA, double-book conflicts, payment/refund failures, voucher conflicts.
- Security: login failures, session revocation, 403 theo permission, forced cancel/audit events.
- Infrastructure: PostgreSQL connections/storage, Redis availability, API health and restart count.

## Incident response

1. Giữ nguyên audit log và request correlation data.
2. Revoke session/user khi nghi ngờ account takeover.
3. Tắt campaign/voucher hoặc payment method bị lỗi bằng status, không xóa lịch sử.
4. Với dữ liệu sức khỏe, giới hạn người xử lý và ghi nhận mọi truy cập/xóa theo PDPA.
