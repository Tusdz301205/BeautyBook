# Section A — Implementation và test report

## Preflight

- Backend baseline build: pass.
- Backend baseline test: 47 suite pass, 1 suite skip; 248 test pass, 5 skip.
- Frontend baseline local build: esbuild bị Windows sandbox chặn đọc thư mục cha; Docker/build ngoài sandbox là đường kiểm chứng.
- Dependency audit baseline: 3 moderate và 3 high; không tự nâng major dependency trong Section A.

## Thay đổi đã triển khai

- Workspace-bound authentication/session/JWT.
- Profile-bound invitation, existing User acceptance và salon-only session revoke.
- Staff lifecycle `PROFILE_ONLY/INVITED/ACTIVE/LOCKED/INACTIVE`.
- Admin booking read-only và force-cancel preview/reason.
- Review auto-publish, report, hậu kiểm và reply gắn đúng Review.
- User/Business/Branch detail routes.
- Staff detail và account lifecycle actions.
- Admin sidebar cleanup và notification deep-link.
- Booking code thay UUID ở payment collect; customer contact thay UUID ở voucher grant.
- Additive Prisma migration, không reset và không `db push`.

## Evidence đã chạy

### Backend build

```text
npm run build
> nest build
Exit code: 0
```

### Targeted tests sau sửa RBAC/review

```text
5 suites passed
20 tests passed
```

Phạm vi: permission catalog, review lifecycle, auth workspace, staff invitation và staff offboarding.

### Frontend production build

```text
vite v5.4.21
3344 modules transformed
✓ built in 26.50s (final build after payment/voucher lookup changes)
```

Các chunk mới đã được sinh cho `AdminEntityDetails`, `AdminReviewsModeration`, `StaffDetail`, `SalonReviews` và `AdminAppointmentsView`.

### Full test quality gate cuối

```text
48 suites passed, 1 suite skipped
253 tests passed, 5 skipped
Exit code: 0
```

Contract `SUPPORT`/Business Detail và toàn bộ regression suite đều pass sau khi catalog được sửa.

## Migration

Migration: `beauty-booking-api-main/prisma/migrations/20260806_section_a_identity_workspace/migration.sql`.

Migration chỉ add enum/column/index/FK và backfill workspace session. Không xóa User, StaffProfile, booking, payment hoặc lịch sử. Partial unique indexes cố ý fail nếu dữ liệu cũ có duplicate role scope; không tự merge.

Audit read-only trước migration (`npx tsx scripts/section-a-preflight-audit.ts`) ghi nhận:

- 0 duplicate role scope;
- 0 StaffProfile trùng `userId`;
- 0 unfinished migration;
- 90 review legacy đang `PENDING`, không tự publish hàng loạt;
- bảng `staff_branch_assignments` chưa tồn tại trong DB hiện chạy;
- một migration health-record cũ có history `ROLLED_BACK` đã được Prisma ghi nhận;
- Prisma báo 19 migration chưa apply, gồm cả Section A.

Quy trình đã thực hiện:

1. Tạo backup custom-format `docs/db-backups/section-a-preflight-20260806.dump`.
2. Restore sang DB staging `glowbook_section_a_stage_20260806`.
3. Apply toàn bộ migration backlog trên staging: pass.
4. Audit staging và thêm controlled backfill chỉ khi StaffProfile primary branch khớp chính xác branch-scoped role.
5. Apply lại migration/backfill trên staging: pass, 0 assignment mismatch.
6. Apply 20 migration đang chờ lên DB chính: pass.
7. Audit DB chính: 0 duplicate role, 0 duplicate StaffProfile/User, 0 missing active assignment, 0 inactive staff có SALON session, 0 unfinished migration.

90 review legacy vẫn giữ `PENDING`; chỉ review mới dùng auto-publish. Đây là quyết định bảo toàn dữ liệu/policy, không phải migration lỗi.

## Manual verification trên stack Docker

Đã kiểm tra trực tiếp trên `http://localhost:8080`:

- Login bằng workspace `PLATFORM` và `SALON` điều hướng đúng UI tương ứng; smoke API `CUSTOMER` cũng pass.
- Platform Admin sidebar không còn Voucher/Campaign salon, Settings/Profile/Security cá nhân; Trust & Safety vẫn còn.
- User Detail mở đúng resource cụ thể, hiển thị identity, role/scope, session, booking liên quan và audit.
- Branch Detail và Business Detail mở đúng route; giờ hoạt động được chuẩn hóa thành `08:00 – 23:00`, không còn chuỗi ngày epoch.
- Booking calendar tuần hiển thị đầy đủ mốc `08:00`; mở được drawer bằng booking thật `BB-2026-04104`.
- Platform Booking Detail chỉ có action ngoại lệ `Force-cancel`; không có confirm/check-in/start/complete/collect payment.
- Force-cancel preview hiển thị ảnh hưởng phân công, payment/refund và bắt buộc nhập lý do trước khi xác nhận; không thực hiện hủy trong smoke test.
- Admin Review là hàng hậu kiểm, mô tả rõ review hợp lệ được đăng ngay và chỉ xử lý reported/hidden.
- Owner Review chỉ có `Trả lời`/`Báo cáo vi phạm`, không có action tự ẩn hoặc tự xóa.
- Staff Detail mở đúng `/salon/staff/:staffId`, có 10 tab nghiệp vụ và trạng thái tài khoản; nhãn điều hướng đã đổi thành `Chi tiết` để không nhầm với chỉnh lịch.
- Responsive mobile 390×844 và tablet 768×1024 không phát sinh horizontal overflow ở Booking/Admin Detail; viewport đã reset sau test.
- Browser console không ghi nhận error trong vòng kiểm tra cuối.

Các invariant invitation existing-Customer, offboarding preserve-history, cross-tenant và workspace rejection được kiểm chứng bằng backend test/API smoke; chưa tạo hoặc hủy dữ liệu nghiệp vụ thật chỉ để phục vụ manual test.

## Runtime verification

- Docker image `api` và `web` rebuild thành công từ source mới.
- Compose recreate thành công, giữ nguyên volume PostgreSQL/Redis/media.
- `postgres`, `redis`, `api` đều healthy; `web` up tại `http://localhost:8080`.
- `GET /api/v1/health`: HTTP 200, database `up`.
- Login smoke test pass: Admin/PLATFORM, Owner/SALON, Customer/CUSTOMER.
- Negative smoke test pass: Admin đăng nhập SALON bị 401.
- User Detail, Branch Detail và Business Detail API smoke test đều pass.
- Frontend Docker build cuối: Vite 5.4.21, 3344 modules, exit 0; container web được recreate thành công sau hai lỗi UX phát hiện trong manual QA.

## Known limitations

- 90 review legacy `PENDING` cần policy review riêng trước khi chuyển sang public; không tự động backfill thành APPROVED.
- Dedicated compliance-application aggregate và booking dispute/support-note model chưa tồn tại; Section A không tạo fake model hay fake success.
- Chưa có test UI tự động cho toàn bộ 52 scenario; backend contract/unit coverage đã tăng, còn manual role matrix cần chạy trên stack có DB.
- Source cũ còn một số chuỗi encoding không đồng nhất ngoài các màn hình Section A đã viết lại.
