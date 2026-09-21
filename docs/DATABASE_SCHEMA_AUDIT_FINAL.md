# BeautyBook — Final Database Schema Audit

Ngày chốt kỹ thuật: **21/09/2026**. Phạm vi: source hiện tại, Prisma schema, PostgreSQL main sau 5 migration đã duyệt, runtime permission catalog và bằng chứng regression trên database copy. Tài liệu này không cấp quyền xóa thêm dữ liệu trên main.

## 1. Kết luận

- Active Prisma: **121 model / 92 enum**.
- PostgreSQL: **395 FK / 0 orphan** tại gate triển khai main.
- Health/consultation: **12 table** đã rời active `public` schema và nằm trong `archive_health_20260919`; **2/2 sensitive consent** còn nguyên.
- Runtime account roles: `CUSTOMER`, `STAFF`, `RECEPTIONIST`, `BUSINESS_OWNER`, `PLATFORM_ADMIN`. Guest chỉ là public actor.
- Runtime permission catalog: **113 code**. Database còn 24 permission definition lịch sử; 8 direct grant trỏ các code này nhưng runtime từ chối code ngoài catalog.
- Prisma/PostgreSQL controlled diff không còn drift chưa giải thích trong active schema. Database-only archive/history/compatibility objects được giữ có chủ đích.
- Main đã nhận đúng 5 migration được duyệt; không có migration alignment mới.

## 2. Bằng chứng triển khai

| Hạng mục | Kết quả |
| --- | --- |
| Migration main | 5/5 PASS ngày 20/09/2026 |
| Backup/restore | PASS, SHA-256 và row fingerprint đã đối chiếu |
| Dữ liệu cốt lõi | Không mất dòng ngoài thiết kế archive |
| Health consent | 2 trước / 2 sau |
| FK/orphan | 395 / 0 |
| Prisma validate/generate | PASS |
| Controlled diff | PASS, phần còn lại là DB-only history/archive đã ghi nhận |
| Backend + PostgreSQL regression cuối | 103/103 suites; 943/943 tests; 0 failed; 0 skipped |
| Frontend unit tests | 58/58 PASS |
| Backend/frontend build | PASS |
| Browser actor/RBAC/booking/responsive | 66/66 PASS |
| Browser concurrency/negative | 12/12 PASS |

Bằng chứng máy cục bộ nằm trong thư mục git-ignored `tmp/main-deployment-20260920193641`; backup nằm trong `docs/db-backups` và không được commit.

## 3. Phân loại active schema

Phân loại cuối kế thừa inventory 133 model đã được trace theo source. Sau khi 12 model retired được archive, 121 model active có kết quả:

| Quyết định | Số model | Ý nghĩa |
| --- | ---: | --- |
| KEEP | 93 | Đang phục vụ domain/runtime hoặc giữ lịch sử bắt buộc |
| REFACTOR | 25 | Giữ model; chỉ còn debt/compatibility cần xử lý theo migration riêng |
| MERGE | 1 | `SalonMember` là compatibility metadata; chưa được xóa khi caller lịch sử chưa tách hoàn toàn |
| NEEDS_DECISION | 2 | `PlatformSetting`, `PayoutAccountVersion`; cần quyết định sản phẩm/pháp lý trước thay đổi |
| REMOVE khỏi active schema | 0 | Không có xóa bổ sung được duyệt trong audit này |
| ARCHIVE | 12 | Health/consultation retired, chỉ dùng truy vết lịch sử |

Chi tiết từng model, PK/FK/index và callsite nằm tại `DATABASE_SCHEMA_INVENTORY.md` và `schema-audit-decisions.json`. Các con số baseline 131/133 trong phần lịch sử của tài liệu cũ không còn là trạng thái hiện hành.

## 4. Archive health/consultation

Các table được bảo toàn trong `archive_health_20260919`:

1. `sensitive_consents`
2. `booking_health_records`
3. `health_record_access_logs`
4. `consultation_form_templates`
5. `consultation_form_versions`
6. `consultation_form_fields`
7. `service_consultation_requirements`
8. `consultation_submissions`
9. `sensitive_answers`
10. `consent_events`
11. `sensitive_data_access_events`
12. `sensitive_break_glass_grants`

Archive giữ PK, FK, timestamp, actor/reference và có row/TRUNCATE guards. Runtime source, Prisma active models, seed, route và OpenAPI không còn phụ thuộc domain này. Không được đổi archive thành fake replacement data.

## 5. Database-only và legacy objects

| Nhóm | Trạng thái | Quyết định |
| --- | --- | --- |
| 12 health archive tables | Có dữ liệu lịch sử (2 consent) | KEEP_ARCHIVE; immutable guards |
| 35 bảng history/legacy khác | Ngoài Prisma | KEEP/REMOVE_LATER theo inventory; không tự DROP |
| `cash_shifts`, `cash_movements` | Rỗng, không thuộc runtime hiện hành | REMOVE_LATER bằng migration được duyệt riêng |
| `GUEST` role/enum | 0 assignment; còn 5 public grants lịch sử | INTENTIONAL_COMPATIBILITY; runtime catalog không coi là account role |
| 24 permission definition ngoài catalog | 8 direct grant lịch sử | DESTRUCTIVE_NEEDS_APPROVAL; runtime fail-closed |
| Applied migration/archive audit tables | Có giá trị phục hồi/truy vết | KEEP_HISTORY |

Không sửa migration đã applied và không làm sạch các object này chỉ để Prisma diff rỗng.

## 6. Schema alignment đã chốt

- `platform_settings.id` và `updated_by`: giữ native UUID của PostgreSQL, Prisma khai báo explicit.
- `branches.district_id` và `canonical_services.replacement_canonical_id`: giữ FK `RESTRICT` theo nghiệp vụ.
- `updated_at` và recurring defaults: giữ default hữu ích của database, Prisma phản ánh đúng.
- `special_working_days` index: giữ index riêng; không drop vì có vẻ dư trên schema.
- `user_sessions` index: khác biệt tên được phân loại naming-only.
- UUID không bị chuyển thành text; `ON DELETE` không bị thay đổi để ép diff sạch.

## 7. Active domain audit

Active: authentication/session/RBAC, business/branch onboarding, services/staff capability, booking/scheduler/change request, cancellation/no-show/violation policy, promotions/vouchers, manual payment/ledger/refund/invoice, reviews, notifications, media, privacy, ownership transfer, reports, waitlist, loyalty, recurring booking, saved services.

Retired khỏi runtime: Manager roles, health/consultation, attendance/timesheet/payroll/salary/workforce scheduling, online card payment và cancellation fee. Các historical records tương ứng chỉ được giữ để audit.

## 8. Rủi ro còn lại và quyết định sau audit

- Dọn 24 permission cũ, `GUEST` metadata, cash tables hoặc compatibility fields cần migration mới và phê duyệt riêng.
- `SalonMember` chưa được merge vật lý; source phân quyền dùng `UserRole`, nhưng metadata compatibility vẫn được giữ.
- `PlatformSetting` và payout/legal ownership history không được đơn giản hóa khi chưa có quyết định pháp lý/sản phẩm.
- Các cột legacy như cancellation fee/sensitive consent snapshot không được dùng để tái kích hoạt nghiệp vụ đã retire; xóa vật lý cần migration riêng.

Kết luận schema: **active schema ổn định; mọi phần còn lại đã được giải thích hoặc phân loại, không có destructive cleanup ngầm.**
