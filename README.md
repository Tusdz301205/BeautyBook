# BeautyBook

Marketplace đặt lịch làm đẹp gồm NestJS/Prisma/PostgreSQL API và React/Vite web portal. Hệ thống dùng RBAC có scope platform → tenant → branch → self cho 11 vai trò, booking lifecycle, salon operations, onboarding/compliance, payment/refund, campaign/voucher, review và dữ liệu sức khỏe có consent.

## Chạy nhanh

### Docker Compose

```bash
docker compose up --build
```

Web chạy tại `http://localhost:8080`; health check tại `http://localhost:8080/api/v1/health`. Compose tự chạy `prisma migrate deploy` trước khi API khởi động.

### Chạy local

```bash
cd beauty-booking-api-main
copy .env.example .env
npm ci
npx prisma migrate deploy
npm run seed:permissions
npm run start:dev
```

```bash
cd beauty-booking-web-main/beauty-booking-web-main
copy .env.example .env
npm ci
npm run dev
```

API prefix chuẩn là `/api/v1`.

## Kiểm tra chất lượng

```bash
cd beauty-booking-api-main
npx prisma validate
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
npm run openapi:generate
```

```bash
cd beauty-booking-web-main/beauty-booking-web-main
npm run build
```

OpenAPI được sinh tại `beauty-booking-api-main/docs/openapi.generated.json`; tài liệu chứa toàn bộ route cùng role/permission contract (`x-roles`, `x-permissions`).

## Vai trò và tài khoản demo

Mật khẩu chung cho seed local: `Password123!`.

| Vai trò | Email |
|---|---|
| Platform Admin | `admin@glowbook.vn` |
| Compliance | `compliance@glowbook.vn` |
| Support | `support@glowbook.vn` |
| Marketing | `marketing@glowbook.vn` |
| Finance | `finance@glowbook.vn` |
| Business Owner | `lananh.owner@glowbook.vn` |
| Branch Manager | `manager@glowbook.vn` |
| Receptionist | `reception@glowbook.vn` |
| Staff | `staff@glowbook.vn` |
| Customer | `khach0001@glowbook.vn` |
| Guest | Không cần tài khoản; dùng `/book` |

Không dùng mật khẩu hoặc JWT secret demo ở production.

## Các nguyên tắc bảo mật đã áp dụng

- JWT access/refresh kèm session có thể revoke theo thiết bị; đổi mật khẩu/khóa tài khoản thu hồi session.
- Permission catalog là source of truth; test tự quét mọi controller để bắt permission lạ, route thiếu permission và role không thể thỏa permission.
- Scope tenant/branch được kiểm tra lại ở service; ID từ body không được tin cho customer-owned resources.
- Response chỉ dùng projection whitelist cho User, không bao giờ serialize `passwordHash` qua relation.
- POST yêu cầu `Idempotency-Key`; booking transaction dùng Serializable và voucher dùng conditional update.
- Refund có reserved amount, four-eyes approval và idempotent processing.
- Health record yêu cầu consent và mask payload sau khi consent bị thu hồi.
- Endpoint public chỉ trả projection an toàn; scheduler nội bộ không public.

## Production checklist

- Đổi toàn bộ secret và database password; cấu hình TLS ở ingress/load balancer.
- Cấu hình `REDIS_URL`, SMTP, `CORS_ORIGINS` và `FRONTEND_URL` chính xác.
- Chạy `prisma migrate deploy`, không dùng `db push`.
- Chạy CI và backup database trước deploy; xác minh `/api/v1/health` sau deploy.
- Seed dữ liệu lớn (`npx prisma db seed`) chỉ dành cho môi trường demo/staging vì script xóa dữ liệu hiện có.
