# BeautyBook — Kết quả rehearsal archive health/consultation

> Cập nhật final 21/09/2026: rehearsal đã được duyệt, main đã apply đủ chuỗi 5 migration và final regression trên copy đạt 103 suite/943 test BE+PostgreSQL, 58 FE, 66 browser actor/RBAC/booking/responsive và 12 concurrency/negative. Xem `HEALTH_ARCHIVE_MAIN_GATE.md` và `DATABASE_SCHEMA_AUDIT_FINAL.md`. Nội dung ngày 19/09 bên dưới là bằng chứng lịch sử.

Ngày 19/09/2026. **REHEARSAL ĐẠT — CHỜ NGƯỜI DÙNG DUYỆT. CHƯA APPLY DATABASE CHÍNH. CHƯA VẼ SƠ ĐỒ FINAL.**

Copy kiểm chứng: `beautybook_test_restriction_2026091903`. Copy restore backup: `beautybook_test_restriction_202609190399`. Preflight gốc lấy từ copy sạch 2026091901; copy 1903 được restore từ backup pre-archive đó, không lấy từ bản đã có fixture lỗi.

## 1. Bảng kết quả đủ 12 model/table

Mọi mapping là `public.<table>` → `archive_health_20260919.<table>`. SET SCHEMA chuyển chính object cũ, không tạo dữ liệu thay thế. PK, FK, actor/reference, ciphertext và timestamp gốc được giữ. Tên cột/kiểu/OID/index/trigger gốc được so sánh; fingerprint tính trên toàn bộ JSON của mỗi row, không chỉ count.

| TABLE / MODEL | OLD ROW COUNT | ARCHIVED ROW COUNT | FK IMPACT | SOURCE REFERENCES REMOVED | TEST RESULT | RECOVERY PLAN |
|---|---:|---:|---|---|---|---|
| SensitiveConsent / `sensitive_consents` | 2 | 2 | Giữ 1 FK vào, 1 FK ra, cùng constraint/OID/actions; tham chiếu tự chuyển theo OID | Bỏ model và inverse relation khỏi Prisma; không có production delegate/route cần thay bằng fake data | Fingerprint/PK/FK/trigger khớp; integration đạt | Chuyển cùng table về public bằng reverse recipe; hoặc restore backup đã thử |
| BookingHealthRecord / `booking_health_records` | 0 | 0 | Giữ 0 FK vào, 3 FK ra, cùng constraint/OID/actions; tham chiếu tự chuyển theo OID | Bỏ model và inverse relation khỏi Prisma; không có production delegate/route cần thay bằng fake data | Fingerprint/PK/FK/trigger khớp; integration đạt | Chuyển cùng table về public bằng reverse recipe; hoặc restore backup đã thử |
| HealthRecordAccessLog / `health_record_access_logs` | 0 | 0 | Giữ 0 FK vào, 0 FK ra, cùng constraint/OID/actions; tham chiếu tự chuyển theo OID | Bỏ model và inverse relation khỏi Prisma; không có production delegate/route cần thay bằng fake data | Fingerprint/PK/FK/trigger khớp; integration đạt | Chuyển cùng table về public bằng reverse recipe; hoặc restore backup đã thử |
| ConsultationFormTemplate / `consultation_form_templates` | 0 | 0 | Giữ 2 FK vào, 2 FK ra, cùng constraint/OID/actions; tham chiếu tự chuyển theo OID | Bỏ model và inverse relation khỏi Prisma; không có production delegate/route cần thay bằng fake data | Fingerprint/PK/FK/trigger khớp; integration đạt | Chuyển cùng table về public bằng reverse recipe; hoặc restore backup đã thử |
| ConsultationFormVersion / `consultation_form_versions` | 0 | 0 | Giữ 2 FK vào, 1 FK ra, cùng constraint/OID/actions; tham chiếu tự chuyển theo OID | Bỏ model và inverse relation khỏi Prisma; không có production delegate/route cần thay bằng fake data | Fingerprint/PK/FK/trigger khớp; integration đạt | Chuyển cùng table về public bằng reverse recipe; hoặc restore backup đã thử |
| ConsultationFormField / `consultation_form_fields` | 0 | 0 | Giữ 2 FK vào, 1 FK ra, cùng constraint/OID/actions; tham chiếu tự chuyển theo OID | Bỏ model và inverse relation khỏi Prisma; không có production delegate/route cần thay bằng fake data | Fingerprint/PK/FK/trigger khớp; integration đạt | Chuyển cùng table về public bằng reverse recipe; hoặc restore backup đã thử |
| ServiceConsultationRequirement / `service_consultation_requirements` | 0 | 0 | Giữ 0 FK vào, 2 FK ra, cùng constraint/OID/actions; tham chiếu tự chuyển theo OID | Bỏ model và inverse relation khỏi Prisma; không có production delegate/route cần thay bằng fake data | Fingerprint/PK/FK/trigger khớp; integration đạt | Chuyển cùng table về public bằng reverse recipe; hoặc restore backup đã thử |
| ConsultationSubmission / `consultation_submissions` | 0 | 0 | Giữ 3 FK vào, 6 FK ra, cùng constraint/OID/actions; tham chiếu tự chuyển theo OID | Bỏ model và inverse relation khỏi Prisma; không có production delegate/route cần thay bằng fake data | Fingerprint/PK/FK/trigger khớp; integration đạt | Chuyển cùng table về public bằng reverse recipe; hoặc restore backup đã thử |
| SensitiveAnswer / `sensitive_answers` | 0 | 0 | Giữ 1 FK vào, 2 FK ra, cùng constraint/OID/actions; tham chiếu tự chuyển theo OID | Bỏ model và inverse relation khỏi Prisma; không có production delegate/route cần thay bằng fake data | Fingerprint/PK/FK/trigger khớp; integration đạt | Chuyển cùng table về public bằng reverse recipe; hoặc restore backup đã thử |
| ConsentEvent / `consent_events` | 0 | 0 | Giữ 1 FK vào, 8 FK ra, cùng constraint/OID/actions; tham chiếu tự chuyển theo OID | Bỏ model và inverse relation khỏi Prisma; không có production delegate/route cần thay bằng fake data | Fingerprint/PK/FK/trigger khớp; integration đạt | Chuyển cùng table về public bằng reverse recipe; hoặc restore backup đã thử |
| SensitiveDataAccessEvent / `sensitive_data_access_events` | 0 | 0 | Giữ 0 FK vào, 6 FK ra, cùng constraint/OID/actions; tham chiếu tự chuyển theo OID | Bỏ model và inverse relation khỏi Prisma; không có production delegate/route cần thay bằng fake data | Fingerprint/PK/FK/trigger khớp; integration đạt | Chuyển cùng table về public bằng reverse recipe; hoặc restore backup đã thử |
| SensitiveBreakGlassGrant / `sensitive_break_glass_grants` | 0 | 0 | Giữ 1 FK vào, 3 FK ra, cùng constraint/OID/actions; tham chiếu tự chuyển theo OID | Bỏ model và inverse relation khỏi Prisma; không có production delegate/route cần thay bằng fake data | Fingerprint/PK/FK/trigger khớp; integration đạt | Chuyển cùng table về public bằng reverse recipe; hoặc restore backup đã thử |

Chi tiết tên FK, source line và mapping trước migration: [HEALTH_ARCHIVE_PREFLIGHT.md](HEALTH_ARCHIVE_PREFLIGHT.md).

## 2. Dependency trace và phạm vi source

- Đã quét tên 12 model/table và inverse relation ở các model còn giữ trong backend, frontend, seed, test, migration, scripts, OpenAPI. Không dùng tiêu chí “không có controller” để suy ra an toàn.
- Backend production không có delegate/nested relation/raw SQL gọi 12 bảng. Prisma validate/generate và full compile với client 121 model chứng minh không còn static typed dependency; runtime API và DB integration bổ sung kiểm chứng query thực tế.
- PrivacyCenterService.center/buildExportPayload chỉ đọc user/booking/review/notification/data request/marketing; health/consultation đã bị loại trước cleanup. Giữ privacy và SensitiveDataCipherService vì còn mã hóa privacy export; không xóa theo từ khóa sensitive.
- services.service.ts còn consultationRequired=false như compatibility field của ServiceVariant; booking-items bỏ gating. Giữ field lịch sử này (không đọc 12 bảng), không mở lại consultation hay đổi dữ liệu service. Các scalar consent/fee legacy trong Booking không bị drop trong task này.
- Permission catalog runtime không cấp health_record permissions; negative tests deny vẫn giữ. Chỉ sửa comment catalog còn mô tả health domain đã retired. Legacy permission rows/history không xóa vì nằm ngoài 12 bảng.
- Notification/AuditLog vẫn giữ nguyên rows/references. HealthRecordAccessLog giữ hai trigger append-only và function OID cũ. Stored-function scan chỉ thấy prevent_health_access_log_mutation, đã chuyển cùng schema; không có function khác query tên 12 bảng.
- Frontend không còn health/consultation caller trong src. /health là API readiness, không phải hồ sơ sức khỏe, vẫn giữ. Test privacy xác nhận không export healthRecords/consultationSubmissions vẫn giữ.
- Seed hiện tại không tạo 12 domain. Migration lịch sử có references được giữ nguyên để dựng/recover lịch sử schema; không sửa migration đã chạy. OpenAPI generate vẫn 233 paths, không có route health-profile được thêm lại.
- Prisma bỏ 12 model, inverse relation và 10 enum exclusive; active source còn **121 model, 92 enum**. SQL giữ 10 enum types trong archive, không DROP type/data. Bốn enum unused khác ở audit cũ không tự xóa.

## 3. Bằng chứng dữ liệu và recovery

- 168 bảng có trước giữ count/fingerprint toàn bộ tại thời điểm migration; kiểm trước khi thêm fixture test. Bao gồm 4.000 booking, customer, staff, business, payment, review và history.
- 395/395 FK trước/sau: zero orphan. PK/FK/index/column type/original trigger cùng OID và definition metadata. Hai consent nguyên vẹn, không chèn bản thay thế.
- Thử reverse recovery thực sự COMMIT trên copy, so lại fingerprint/catalog, rồi apply forward lại. Thử restore native pg_dump backup vào database khác và so count/fingerprint của toàn bộ 168 bảng.
- Archive row-level trigger chặn INSERT/UPDATE/DELETE thực sự; statement trigger chặn TRUNCATE. Cho phép câu lệnh ảnh hưởng 0 row để không chặn cascade của dữ liệu core không liên quan. Recovery chỉ gỡ trigger bảo vệ mới thêm; trigger lịch sử giữ nguyên.
- Lượt đầu dùng statement-level DML guard làm 5 test cleanup booking/refund fail do cascade rỗng. Đây là lỗi migration design, đã sửa bằng forward migration thứ hai, không đổi test cũ để che lỗi. Sau đó rehearsal lại từ backup sạch 1903 và 917 tests đạt.
- Check cuối READ ONLY lúc 2026-09-19T14:06:59.327Z: DB chính còn 4000 booking, đủ 12 public health tables, 2 consent có fingerprint không đổi, 0/5 migration mới applied. Archive sau tests cũng không đổi.

## 4. Kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| Prisma validate / generate | Đạt; client không còn 12 model |
| Backend build / OpenAPI | Đạt; 233 paths |
| Full Jest, bật PostgreSQL integration trên copy 1903 | 101 suites / 917 tests đạt, 0 skip (777 unit + 140 DB integration) |
| Frontend unit / build | 57 tests đạt; production build đạt |
| Runtime API account/cancellation/public-preview | 40 checks đạt |
| Privacy center API trên copy archive | HTTP 200, không phụ thuộc retired tables |
| Browser targeted sau archive | 15/15 đạt, 0 skip: warning/restriction, assisted booking, cancellation/no-show, Owner public/preview và smoke. Lượt đầu service-offline bị connection refused; đã khởi động lại và chạy đủ 15 ca, không coi lượt lỗi là đạt |
| Root + nested FE git diff --check | Đạt; chỉ bỏ một dòng trống EOF CSS, không thay layout |

## 5. Migration và điều kiện triển khai (CHƯA ĐƯỢC PHÉP CHẠY DB CHÍNH)

Hai migration của cleanup:

1. `20260919_archive_retired_health/migration.sql`: chuyển 12 table, 10 enum và function append-only sang archive, thêm protection.
2. `20260919_health_archive_row_guard/migration.sql`: sửa DML protection sang ROW, giữ TRUNCATE guard. Phải áp cả hai trước khi mở lại application, không vận hành với migration đầu riêng lẻ.

DB chính còn pending ba migration prerequisite `20260916_account_separation`, `20260917_booking_violation_events`, `20260918_customer_booking_policy`. Vì vậy không chạy `prisma migrate deploy` vào .env chính một cách mặc định: lệnh sẽ áp cả năm, không chỉ hai archive migration. Cần duyệt kế hoạch triển khai đầy đủ riêng.

## 6. Recovery procedure

1. Dừng API/workers, xác nhận database và migration history; lưu bản build/schema/client trước triển khai. Không checkout/reset đè worktree.
2. Backup native trước migration; kiểm file tồn tại và restore thử. Backup có dữ liệu cá nhân, chỉ nằm trong docs/db-backups đã Git-ignore; không đưa lên Git hoặc gửi cho AI công khai.
3. Nếu transaction migration lỗi trước COMMIT: ROLLBACK, kiểm namespace/count/FK; xử lý trạng thái failed migration theo bằng chứng thật, không đánh dấu applied giả.
4. Nếu cần quay lại sau COMMIT: dùng reverse recipe `scripts/recover-health-archive.sql` đã thử trên copy. Nó chuyển cùng table/type/function về public và chỉ bỏ guard mới + schema rỗng bằng RESTRICT, không DROP TABLE, không CASCADE.
5. Recipe có guard chỉ cho database rehearsal. Recovery production cần bản compensating forward migration được duyệt riêng, không sửa/xóa checksum hoặc lịch sử applied migration. Không đơn thuần chạy SQL ngược rồi để Prisma ledger lệch schema. Trong rehearsal, trạng thái tạm lệch chỉ tồn tại lúc copy offline trước forward reapply.
6. Sau reverse: so consent fingerprint/PK/FK/orphan và toàn bộ core fingerprints, generate/build client khớp schema cũ, health checks/test rồi mới mở application. Nếu reverse không an toàn, restore backup đã kiểm chứng vào DB mới và chuyển kết nối trong maintenance; không overwrite/drop DB cũ.

## 7. Rủi ro/giới hạn còn lại

- ALTER TABLE SET SCHEMA lấy lock mạnh; cần maintenance window, timeout/kiểm long-running transaction trước khi được phép deploy.
- FK cross-schema cố ý giữ để truy vết. Xóa cứng parent đang được archive tham chiếu có thể bị chặn để bảo toàn history; soft delete runtime giữ nguyên. Đã kiểm parent không có archived row không bị chặn giả.
- Schema REVOKE PUBLIC không chặn owner/superuser; trigger không phải ranh giới chống DBA. Production cần role least-privilege/backup ACL và quy trình cấp quyền đọc archive, chưa tự đổi credentials/roles ở task này.
- Snapshot counts phản ánh DB local hiện tại, không được suy rộng sang DB khác. Trước deploy phải backup/preflight lại; nếu consent/FK/data thay đổi thì dừng đối chiếu.
- Các scalar reference lịch sử không có FK từ trước (actor/reference trong access logs) được giữ nguyên, không tạo FK giả hoặc fake parent. Không tuyên bố đã chữa mọi dữ liệu legacy ngoài phạm vi archive.
- Test tạo fixture sau migration làm số dòng core trên copy tăng; bằng chứng bất biến migration được chụp trước test, và archive được đối chiếu lại sau test.
- Chưa apply DB chính, chưa push Git, chưa cập nhật audit FINAL hoặc vẽ 5 sơ đồ final. Chỉ cập nhật checkpoint rehearsal; đợi người dùng duyệt kết quả này.
