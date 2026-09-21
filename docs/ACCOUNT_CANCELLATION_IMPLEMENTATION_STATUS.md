# BeautyBook — checkpoint phân tách tài khoản và chính sách hủy lịch

## Checkpoint mới nhất: main deployment 20/09/2026

- Đã áp đủ 5 migration được duyệt lên main; không còn pending. Main integrity PASS, 395 FK/0 orphan, 2 consent nguyên vẹn trong archive. Đã gỡ bảo trì sau Prisma/build/smoke PASS.
- Final regression trên bản sao main mới `beautybook_test_restriction_20260921155245`: **103 suite /943 test BE+PostgreSQL PASS, 0 skip**; **58/58 FE PASS** và production build PASS. Browser actor/RBAC/booking/responsive **66/66 PASS**; concurrency/negative **12/12 PASS**.
- Final schema audit đã chốt tại `DATABASE_SCHEMA_AUDIT_FINAL.md`; baseline kỹ thuật tại `thesis/TECHNICAL_FINAL_BASELINE.md`. Các checkpoint cũ bên dưới chỉ còn giá trị truy nguyên.
- Bằng chứng triển khai mới: `HEALTH_ARCHIVE_MAIN_GATE.md` và local ignored `tmp/main-deployment-20260920193641/`.

## Checkpoint lịch sử: health archive rehearsal 19/09/2026

- User chỉ duyệt cleanup trên DATABASE COPY, chưa cho phép apply DB chính. Không tự chạy migrate deploy theo `.env` chính.
- Source Prisma hiện **121 model /92 enum** sau bỏ 12 model retired và 10 enum exclusive. DB copy `beautybook_test_restriction_2026091903` chuyển nguyên graph sang `archive_health_20260919`; giữ 2 consent nguyên vẹn. Hai migration mới: `20260919_archive_retired_health`, `20260919_health_archive_row_guard` (cần cả hai).
- Copy đầu 1901 phát hiện statement-trigger chặn cascade rỗng; giữ bằng chứng lỗi, sửa bằng forward migration row guard rồi rehearsal sạch lại trên 1903. Không sửa test cũ để che lỗi.
- 168 bảng giữ fingerprint/count/PK/FK/OID/index/trigger cũ trước/sau migration; 395 FK không orphan. Reverse recovery COMMIT/forward reapply và native backup restore vào copy 190399 đều khớp. Archive không đổi sau tests.
- Full Jest bật integration, khóa DATABASE_URL vào copy: **101 suites /917 tests đạt, 0 skip** (777 unit +140 DB). Prisma validate/generate, BE/FE build, FE57 tests đạt; OpenAPI233 paths; API40 checks, privacy center và browser15/15 đạt. Root/nested FE diff check đạt (chỉ dọn dòng trống EOF CSS).
- DB chính được READ ONLY đối chiếu: 4.000 booking, 12 bảng health vẫn public, 2 consent fingerprint không đổi, không có 5 migration mới (16/17/18/19archive/19rowguard). Không seed/reset/migrate main, không push.
- API test `localhost:3102`, FE test `localhost:8183` hiện dùng copy1903. Có fixture sau rehearsal; không đồng nhất số dòng copy sau test với baseline4.000 bookings.
- Báo cáo đủ bảng12, source dependency, FK, backup và runbook: `HEALTH_ARCHIVE_PREFLIGHT.md`, `HEALTH_ARCHIVE_REHEARSAL_RESULT.md`. Chờ user duyệt kết quả; chưa finalize audit/5 sơ đồ. Phần133 model bên dưới là checkpoint trước cleanup, giữ để truy nguyên.

Cập nhật 19/09/2026. Giai đoạn violation/warning/restriction đã triển khai và kiểm chứng trên database sao chép. Toàn bộ task chưa hoàn tất: chưa triển khai DB chính, chưa cleanup schema hoặc tạo 5 sơ đồ cuối.

## Checkpoint hiện hành — 19/09/2026

Các phần ngày 17/09 bên dưới được giữ làm lịch sử; trạng thái hiện hành dùng mục này.

### A. Worktree

- Root repository: `main`; nested FE repository: `dev`. Giữ nguyên toàn bộ thay đổi có trước; không reset, không chuyển Manager lần nữa.
- Code feature đã từng push: API `3d0bcee`, FE `6d96fea`. Phần policy/ack/restriction, regression fixture và tài liệu mới hiện local, chưa commit/push.
- Root `git diff --check` đạt. Nested FE còn lỗi blank line EOF có trước tại `src/styles/branch-operations.css:86`, ngoài phạm vi thay đổi này; không báo toàn nested worktree sạch.

### B–D. Violation, warning và restriction

- Event là nguồn điểm Customer+Business rolling 90d: late +1 tại requestedAt; no-show +2. VOID có evidence/audit loại khỏi điểm; không backfill trạng thái lịch sử thành vi phạm.
- 0–1 bình thường; 2 cảnh báo; đúng 3 bắt buộc boolean acknowledgment khi tự đặt. API từ chối thiếu xác nhận bằng 409 `BOOKING_WARNING_ACK_REQUIRED`, chuỗi `"true"` bị validation từ chối. Audit acknowledgment nằm trong transaction tạo lịch.
- Event mới đạt >=4 kích hoạt 30 ngày. Event mới trong hạn chế gia hạn đến occurredAt+30 ngày. GET hoặc tạo lịch sau khi hết hạn không tự tái kích hoạt dù score còn >=4. Sau hết hạn, acknowledgment vẫn áp dụng đúng score=3, không tự mở rộng thành >=3.
- `CustomerBookingPolicy` unique Customer+Business lưu hạn chế và revision làm transaction fence, không lưu score. Event/VOID/self-booking cùng ghi fence dưới SERIALIZABLE, retry conflict có giới hạn. Audit giữ before/after; trigger kiểm scope và hạn 30 ngày.
- Customer bị chặn chỉ ở business tương ứng bằng 403 `SELF_BOOKING_RESTRICTED`; vẫn xem lịch sử/public, login, dùng business khác. Owner/Receptionist vẫn tạo giúp qua counter flow. Forged source, guest endpoint và recurring không bypass self-booking guard.
- UI có cảnh báo, checkbox chưa được tick sẵn, ngày hết hạn, hướng dẫn liên hệ salon. Khi điểm thay đổi lúc submit, UI tải lại policy và ở bước xác nhận, không chuyển nhầm sang lỗi slot.
- Luồng late-request/cancellation/no-show hiện có được giữ, không thêm phí hoặc blacklist platform. Operational account không act as Customer; Public/Preview vẫn chỉ xem.

### E. Migration / dữ liệu

- PostgreSQL thực tế là native Windows PostgreSQL 18 tại localhost:5432; không phải container Docker phục vụ DB này.
- Đã backup DB chính và restore fresh copy `beautybook_test_restriction_20260918`; rehearsal migration 16/17/18 giữ nguyên fingerprint/count 166 bảng có trước và 4.000 booking; bảng event mới rỗng lúc migrate. Không backfill restriction.
- Bản sao sau đó có thêm fixture kiểm thử; số dòng hiện tại của copy không được dùng làm fingerprint trước migration.
- READ ONLY ngày 19/09 xác nhận DB chính vẫn 4.000 booking, cả `20260916_account_separation`, `20260917_booking_violation_events`, `20260918_customer_booking_policy` chưa applied. Không chạy seed/reset/cleanup trên DB chính.
- Test frontend: `http://localhost:8183`; API: `http://localhost:3102/api/v1`, kết nối copy nói trên. Không coi đây là deploy production. Email disabled; Redis blacklist hiện in-memory ở dev.

### F. Kiểm thử

- BE build đạt; full Jest: 95 suites, **777 pass**; 123 DB cases skip ở lệnh mặc định được chạy riêng trên copy: **5 suites /123 pass**.
- FE: **57/57 unit tests** và production build đạt.
- Browser policy mới: **4/4 pass** (2 điểm, 3 điểm+ack, 4 điểm+assisted booking và restriction phát sinh giữa lúc xác nhận).
- Browser hồi quy 55 cases: 50 pass, 2 optional skip (chưa có inactive/noScope fixture), 3 lần login bị 429 do vượt 8 lần/phút/tài khoản. Sau cửa sổ giới hạn, dùng tài khoản responsive riêng, ba case đó chạy lại pass; không nới rate-limit production.
- Thêm Owner public/preview không gọi Customer API: pass. Tổng **58 browser cases khác nhau pass**, **2 skip không tính pass**. Không tuyên bố đã chạy mọi test file E2E khác trong repository.
- Runtime API: **40 checks pass** trên copy, gồm request/no-show race, account isolation, own/foreign preview. Script event verification: **9 nhóm pass**, đã chạy lại ngày 19/09 cùng implementation.
- Policy unit có 24 cases, DB có 6 cases mới, kiểm activation/extension/expiry/VOID/window/scope, duplicate concurrent event và hai thứ tự commit self-booking/event; capacity integration cũ tiếp tục đạt. Không quan sát HTTP500 trong các flow đã kiểm thử.
- Lượt browser đầu ngày 19/09 dùng nhầm 127.0.0.1 trong khi CORS chỉ cho localhost nên login fail; đổi đúng origin test rồi chạy lại đạt, không sửa/nới CORS production.

### G–H. Schema và phần còn lại

- Source hiện **133 model**. KEEP 93; REMOVE_CANDIDATE 12; MERGE_CANDIDATE 1; REFACTOR 25; NEEDS_REVIEW 2. Hai model mới KEEP; CancellationPolicy đổi MERGE sang REFACTOR. Không tạo lại audit toàn bộ từ đầu.
- Chi tiết delta ở `DATABASE_SCHEMA_AUDIT_DRAFT.md`, `DATABASE_SCHEMA_INVENTORY.md`; quyết định máy đọc ở `schema-audit-decisions.json`.
- `DATABASE_SCHEMA_CLEANUP_APPROVAL.md` liệt kê 40 model không thuộc KEEP, counts/FK hiện tại, ảnh hưởng, archive/recovery/test. Đây là đề xuất, không cấp quyền drop/delete.
- Chờ duyệt phạm vi archive 12 model health/consultation (SensitiveConsent còn 2 dòng), chưa gộp SalonMember, chưa sửa hàng loạt 25 refactor. Hai quyết định PlatformSetting/PayoutAccountVersion còn mở.
- Chưa apply additive migration vào DB chính. Chưa thực hiện destructive cleanup. Chưa tạo 5 artefact `.drawio/.svg` vì schema cuối chưa được chốt; không vẽ theo schema cũ hoặc báo toàn task DONE.

## Lịch sử checkpoint trước 19/09/2026

## A. Tiếp nhận và impact audit

Nguồn nghiệp vụ đã đọc: `BeautyBook_Account_Separation_Public_Preview_Rules.md` và `BeautyBook_Cancellation_NoShow_Policy_Notes.md` trong Downloads. Source, diff, trạng thái Manager và inventory/decisions/evidence của 131 model được đối chiếu; không bỏ audit cũ. Chưa dọn schema lớn hoặc vẽ sơ đồ cuối.

Manager đã retire, 1 tài khoản chuyển Lễ tân và 9 session đã revoke là checkpoint giữ nguyên. Không sửa migration đã áp dụng.

### Database read-only ngày 16/09/2026

Script: `beauty-booking-api-main/scripts/audit-account-cancellation.mjs`, REPEATABLE READ READ ONLY, kết thúc ROLLBACK; không xuất PII.

| Hạng mục | Kết quả |
|---|---:|
| User / UserRole / Role | 1.038 / 1.038 / 6 |
| CustomerProfile / StaffProfile / SalonMember | 1.000 / 29 / 0 |
| Customer / Owner / Receptionist / Staff / Platform Admin | 1.000 / 5 / 2 / 26 / 5 |
| Tài khoản trộn Customer + operational | 0 |
| Operational account có CustomerProfile | 0 |
| CustomerProfile không có Customer role còn hạn | 0 |
| Booking / BookingService / Review | 4.000 / 4.000 / 871 |
| LoyaltyAccount / LoyaltyTransaction / ChangeRequest | 0 / 0 / 0 |
| Notification / AuditLog | 1.065 / 281 |
| CANCELLED / NO_SHOW | 379 / 369 |

379 lịch hủy đều thiếu `cancelledByType`, mặc dù có actor/time. 369 NO_SHOW có status history/actor nhưng chưa có bằng chứng quy tắc 15 phút hoặc khách không báo. **Không backfill điểm vi phạm từ các trạng thái này.** Không xóa profile/history.

### Xung đột đã xác nhận

- `auth-workspace.ts` cho CustomerProfile mở CUSTOMER dù không có role; account mixed có thể chọn workspace để dùng Customer. Quy tắc mới cấm.
- `UsersService.assignRole`, chấp nhận StaffInvitation và OwnershipTransfer có thể cấp role vận hành cho Customer; cần chặn cả API/service/DB, không đổi identity model/email unique.
- RolesGuard chỉ kiểm `roles.includes`; permission SELF có thể mượn role Customer của mixed principal.
- Trang public tải saved-services cho mọi tài khoản đã đăng nhập, CTA dẫn vào Customer flow dù đang vận hành.
- `BranchesService.findPublic` có projection và filter public; `findOne` là management payload chứa documents/readiness. Preview phải dùng projection public, không trả management payload hay private media.
- Chưa có bản nháp phiên bản riêng cho từng lần sửa của branch đã live. Preview lần này thể hiện **dữ liệu đã lưu của branch/service chưa public**, không hứa có staging cho chỉnh sửa chưa lưu.
- `resolveCancellationPolicy` đọc cutoff business/platform (default cũ 2h), direct cancellation cho phép `warn_late_cancel`; khác rule cố định 4h.
- ChangeRequest đã có PENDING/APPROVED/REJECTED/EXPIRED, hết hạn 24h và worker expire; có approve/reject và lock booking khi áp dụng. Ưu tiên reuse, không tạo CancellationRequest mới. Không tự thêm WITHDRAWN/withdraw hoặc đổi expiry.
- Approve CANCEL hiện từ chối sau giờ hẹn, vì dùng policy `too_late`; cần phân biệt thời điểm khách gửi và salon xử lý, không tự quy khách không báo thành no-show.
- Chưa có nguồn event/đợt restriction có version chính sách mới; status history tự do không đủ để phạt dữ liệu cũ hoặc xử lý hết hạn 30 ngày không lặp mãi.

## B. Account Separation — source và runtime đã kiểm chứng, chưa deploy DB thật

- Auth resolver không suy Customer từ CustomerProfile và không cho active operational assignment chọn CUSTOMER (kể cả scope vận hành sai).
- Guard/policy và service saved/review chặn mixed/operational principal; self profile và notification vẫn dùng được đúng account.
- Tạo tại quầy cần chọn khách/walk-in; không nhận source online của account vận hành.
- Grant writers kiểm xung đột role; migration mới `20260916_account_separation` thêm precondition và trigger, không sửa/xóa dữ liệu.
- Public API vẫn dùng `@Public`; Owner preview có kiểm quyền tenant và cùng projection với public, không public hóa tài liệu quản trị.
- Frontend đã thêm nút Public/Preview, banner và chặn customer CTAs/mutations cho operational account.

Migration trên **DB thật chưa áp dụng** tại checkpoint này. Đã rehearsal trên `beautybook_test_manager_20260916234927973`, kiểm counts + fingerprint dữ liệu lịch sử, DB role-conflict/concurrent grant và API public/preview/customer-only. Copy sau rehearsal có thêm fixture kiểm thử, không còn là bản sao nguyên trạng. Không đổi database thật, không backfill hoặc xóa dữ liệu lịch sử.

## C. Cancellation — chưa hoàn thành

### Đã triển khai và kiểm tra

- Direct self-cancel cố định >=4h, đúng 4h cho phép; dưới 4h phải gửi ChangeRequest. Đọc lại giờ hẹn dưới row lock trong SERIALIZABLE để tránh reschedule đồng thời vượt cutoff. Recurring cancellation cũng kiểm cutoff, không tiếp tục dùng 2h hoặc cấu hình legacy để nới quyền.
- ChangeRequest create kiểm ownership, trạng thái và giờ hẹn dưới cùng booking lock; request và notification đúng salon nằm cùng transaction. Hai request đồng thời chỉ tạo một request; booking chưa chuyển CANCELLED.
- No-show chỉ Owner/Receptionist, chỉ sau start +15 phút; không cho Staff/Customer/Platform, kể cả Platform kèm Owner. Không cho environment/parameter rút ngắn grace. Kiểm lại thời gian/trạng thái sau khi lock.
- Có bất kỳ CANCEL request (kể cả REJECTED/EXPIRED), history khách đã đến hoặc dịch vụ đã bắt đầu/hoàn thành → chặn no-show. Không suy rằng khách chưa báo chỉ từ việc không có request: salon phải tick xác nhận chưa đến/chưa báo qua kênh khác.
- Bằng chứng xác nhận no-show gồm actor, timestamp, start, grace, policyVersion được ghi AuditLog trong cùng transaction; không ghi được evidence thì không chuyển trạng thái. Không dùng audit này để tự động chấm điểm lịch sử cũ.
- Drawer có nút no-show đúng vai trò/mốc thời gian và hộp thoại xác nhận. API vẫn là lớp quyết định cuối.
- Sửa projection Customer bỏ mất changeRequests; khách thấy yêu cầu còn PENDING sau giờ hẹn, không hiển thị thành hủy thành công.
- Runtime phát hiện raw `SELECT ... FOR UPDATE` conflict Prisma P2010/adapter SQLSTATE 40001 trả 500. Helper SERIALIZABLE nay retry có giới hạn cho structured 40001/40P01, hết retry trả 409; không retry lỗi SQL khác hoặc match message text.

### Chưa hoàn thành

Đã thêm `BookingViolationEvent`: late cancel +1 tại requestedAt, no-show +2, nguồn event có uniqueness/idempotence, rolling 90d theo Customer+Business và summary trên UI salon/customer. Điểm được derive từ event còn hiệu lực, không dùng bộ đếm penalty cố định. Chưa triển khai cảnh báo ngưỡng 2/3 điểm, acknowledgment khi đặt lịch và restriction 30d/self-booking guard. Chưa cập nhật inventory cuối; không coi event/summary là đã hoàn tất toàn bộ restriction.

### Quyết định đã chốt và triển khai ngày 17/09/2026

Customer gửi valid late-cancellation request trong <4h và trước startAt được ghi event +1 ngay trong transaction tạo request. Salon được approve sau startAt nếu vẫn trong cửa sổ xử lý 24h; classification dùng requestedAt/start snapshot. Approve chuyển CANCELLED, không thêm điểm. Expired request giữ event và không biến thành NO_SHOW. Không cho salon REJECT valid late-cancel request. Event chỉ được VOID do lỗi ownership/duplicate/trạng thái/nghiệp vụ có evidence và audit; hiện chỉ có primitive nội bộ, không mở endpoint tùy ý miễn điểm. Request legacy không có event vẫn được xử lý bảo thủ để tránh no-show sai; không backfill điểm.

**User đã chốt:** mỗi vi phạm mới trong thời gian hạn chế gia hạn ngày kết thúc thành 30 ngày kể từ vi phạm mới. Sau khi hết hạn, chỉ truy vấn điểm/đặt lịch không tự tạo lại hạn chế; phải có sự kiện vi phạm mới.

## D. Schema impact trước Phase 4

| Model/table | Decision cần xem lại | Lý do |
|---|---|---|
| UserRole / roles / UserSession | REFACTOR | Account separation và revalidation phiên; không gộp Customer+operational |
| CustomerProfile | REFACTOR, giữ dữ liệu | Domain/historical identity, không phải nguồn cấp quyền |
| StaffInvitation / OwnershipTransfer | REFACTOR | Không tạo mixed account qua grant gián tiếp |
| Branch / BranchServiceOffering / media | KEEP + refactor projection | Public/authorized preview cùng presentation; không thêm publish-version giả |
| Booking / BookingStatusHistory / AppointmentChangeRequest | REFACTOR | 4h/15m, attribution hủy trễ và event policy mới |
| CancellationPolicy | Tạm dừng MERGE candidate | Cancellation cố định 4h, reschedule còn resolver riêng; không xóa theo kết luận cũ |
| Notification / AuditLog | KEEP | Thông báo/historical evidence; không dùng ghi chú tự do làm nguồn điểm duy nhất |
| Review / CustomerSavedService / Loyalty | KEEP | Customer-only actions, giữ counter/service system workflows hợp lệ |

Model count hiện 132 với `BookingViolationEvent`. Migration `20260917_booking_violation_events` chỉ áp dụng trên copy `beautybook_test_manager_20260916234927973`: fingerprint/count của 166 bảng có trước được giữ nguyên, 4.021 bookings được bảo toàn, bảng event mới rỗng khi migrate. Không áp dụng migration lên database chính. Chưa cập nhật inventory cuối khi implementation chưa ổn định.

## E. Verification

### Retest theo yêu cầu mới (17/09/2026)

- BE mặc định: 94 suites / 753 pass; 117 DB tests được chạy riêng sau đó và cả 4 integration suites / 117 tests pass trên database copy.
- FE unit: 57/57 pass. Chromium public smoke: 8/8 pass. Browser cancellation/no-show: 2/2 pass trên fixture mới, không phải chạy lại fixture đã NO_SHOW.
- Runtime API: 40 kiểm tra pass; event/scoring database script: 9 nhóm kiểm tra pass, gồm immediate +1, approve sau start, expiry, reject/no-show protection, rolling 90d, business isolation, VOID, immutability và duplicate prevention.
- Sửa harness, không đổi production logic: hai script runtime tránh fixture vắt qua nửa đêm bị legacy DATE/TIME constraint từ chối; FK deletion test tạo user/profile riêng thay vì phụ thuộc thứ tự FK của dữ liệu seed. Browser test account separation đổi kỳ vọng redirect cũ sang màn hình chặn hiện hành, đồng thời kiểm không gọi API Customer.
- Browser RBAC/responsive: lượt 45 cases có 42 pass, 2 skip và 1 fail do kỳ vọng redirect cũ. Sau cập nhật assertion màn hình chặn, case đó chạy lại pass (1/1): tổng 43 cases khác nhau đạt. Hai optional account cases inactive/noScope chưa có credentials riêng nên vẫn skip, không tính pass. Kết hợp 8 smoke + 2 policy UI = 53 browser cases khác nhau pass. Chưa chạy toàn bộ bộ E2E tạo lịch/lifecycle/concurrency trong lượt này.
- Code trước retest đã push dev: API `3d0bcee`, FE `6d96fea`. Các điều chỉnh test trong lượt này chưa commit/push. DB chính không migrate/seed/reset.

### Checkpoint build trước khi user yêu cầu test lại

Cập nhật cuối theo yêu cầu user bỏ qua test: BE và FE build thành công ngày 17/09/2026. Không chạy thêm test suite hoặc script `verify-violation-events.mjs`. Trước yêu cầu dừng test, lượt BE đã chạy 93 suites / 747 pass / 117 skip; lượt targeted approval/request/no-show 46 pass. Các kết quả FE/browser bên dưới thuộc checkpoint trước event integration, không phải xác nhận hồi quy toàn bộ phiên bản mới. Kiểm tra khởi động/HTTP riêng không thay thế kiểm chứng nghiệp vụ.

Bản production FE được phục vụ tại `http://localhost:8181`, API tại `http://localhost:3000/api/v1` dùng database copy đã migrate. Web `/` và `/login` trả HTTP 200; API health trả HTTP 200, `database: up`. Docker Desktop và container PostgreSQL hiện có được khởi động lại; không deploy vào DB chính, không chạy seed/reset. Redis chưa cấu hình nên blacklist dùng in-memory trong môi trường development; không coi đây là cấu hình production deployment.

Ngày 17/09/2026:

- Full BE: 93 suites / 745 tests pass, 4 suites /117 DB tests skip ở lệnh thường. Số skip không được xem là đã chạy DB integration.
- FE: 57/57 unit tests pass; BE/FE build pass. Prisma validate/generate pass. OpenAPI regenerate 232 paths.
- Runtime script `scripts/verify-account-cancellation-runtime.mjs`: 40 kiểm tra pass trên copy, gồm role/public/preview, >=4h/<4h, request concurrency, no-show confirmation/roles/concurrency và request chống no-show. Một no-show đồng thời chỉ có 1 history +1 evidence; không còn HTTP500.
- `scripts/diagnose-test-copy-conflict.mjs` tái hiện có điều khiển P2010 / TransactionWriteConflict /40001 trên fixture copy, không xuất SQL/credentials/PII.
- Chromium e2e: thao tác no-show xác nhận checkbox, update thành công và giao diện đổi ngay không F5 đã pass; Customer pending request sau giờ hẹn đã pass sau khi sửa projection. Tests lưu ở `tests/e2e/salon/cancellation-policy.spec.js`.
- Trước đó: preview unit + DB separation 13 tests pass; browser Guest/Owner live/preview và CTA operational đã kiểm tra.
- Root git diff --check pass. Nested FE repository có blank line EOF sẵn ở `src/styles/branch-operations.css:86`; không sửa file không thuộc task.
- Chưa xác nhận toàn bộ hai task hoàn tất; chưa migrate DB thật, chưa push, chưa dọn schema hoặc vẽ sơ đồ cuối.
