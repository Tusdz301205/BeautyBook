# Audit ngoại lệ BeautyBook

Kết quả:75 scenario,43 HANDLED,23 PARTIALLY HANDLED,1 NOT HANDLED,3 NOT APPLICABLE,5 CANNOT CONFIRM.24 root causes chưa khắc phục:0 CRITICAL,4 HIGH,19 MEDIUM,1 LOW. Audit chỉ đọc source và chạy tests cô lập; không triển khai bản vá. [Ma trận](EXCEPTION-MATRIX.md) là đơn vị kết luận; [gaps](CRITICAL-GAPS.md) là đơn vị ưu tiên để tránh đếm trùng.

## 1. Nguồn sự thật và độ phủ

Đã kiểm tra git status/diffstat/diff/staged, package scripts/entrypoints, module registration, controller metadata, Prisma schema/migrations và instructions mobile. Worktree dirty có sẵn được giữ nguyên. [Baseline](BASELINE.json), [đối chiếu cuối](VERIFICATION.json). Không dùng báo cáo/sơ đồ cũ làm chứng cứ cho behavior.

[Inventory](INVENTORY.md) bao gồm25 module source,24 controllers,252 method declarations/256 verb-path (4 SavedServices aliases),119 test files (100 backend,19 web),91 mobile source files và432 dòng consumer/route evidence. AST scanner hiện có đọc source, không import app. Controller decorators effective được lưu theo từng operation. Runtime prefix /api/v1.

Coverage có3 mức: **metadata inventory** cho mọi route; **static end-to-end** cho các flow chính dưới đây, có đối chiếu client và DB; **executed isolated tests** cho93 backend suites và7 web files. Không có coverage runtime của256 routes, không có coverage browser/emulator. CRUD phụ được rà metadata/service checks và tests liên quan; không đồng nghĩa mọi payload/branch đã exhaustively tested. Token/session, booking concurrency, money lifecycle, multi-tenant scope, workflow workers là trọng tâm.

### Module/client/entity/dependency

Bảng chi tiết và từng verb/path/role/permission nằm trong INVENTORY.md, không chỉ liệt kê tên thư mục. AppModule import trực tiếp các module nghiệp vụ; Mail, Prisma, Scheduler có service/worker không controller. Web App.jsx chia public/customer/booking/salon/admin; các API consumers được liệt kê cùng file/dòng. Mobile active customer flows dùng AuthContext, api/client, BookingsContext, catalog/review/favorites APIs; ReviewsContext cũ không có call site mutation hiện hành, không coi đó là luồng backend thiếu đồng bộ.

## 2. Kiến trúc xử lý request và lỗi hiện tại

HTTP → body parser/limit → request ID → guards → interceptors → ValidationPipe/DTO/controller → service/resource authorization → Prisma/transaction → response/side effects. [ValidationPipe — beauty-booking-api-main/src/main.ts:3](../../beauty-booking-api-main/src/main.ts); [{ provide: APP_GUARD — beauty-booking-api-main/src/app.module.ts:79](../../beauty-booking-api-main/src/app.module.ts). Body parser nằm trước middleware request ID nên malformed/oversize body có thể thiếu ID; chưa đánh đồng mọi500 với Prisma filter.

Guard order: JwtAuthGuard → UserAwareThrottlerGuard → RolesGuard → ScopeGuard → PolicyGuard. Public decorator bypass auth theo guard; permission mang chữ public trên một endpoint authenticated không tự bỏ JWT. Các decorators là kiểm tra coarse; [export class — beauty-booking-api-main/src/bookings/bookings-access.service.ts:38](../../beauty-booking-api-main/src/bookings/bookings-access.service.ts) và [export function can — beauty-booking-api-main/src/common/utils/policy.ts:121](../../beauty-booking-api-main/src/common/utils/policy.ts) kiểm tra resource DB thực. Unknown permission deny. Platform admin không mặc định có tenant operational powers. CUSTOMER tách operational account; BRANCH_MANAGER không phải role active chỉ vì enum/migration cũ còn nhắc.

JWT strategy verify signature/expiry, đọc blacklist và persistent session, user active, active role/direct permission grants; workspace lấy từ session. Redis lỗi đọc fail-closed, song refresh có đường thực thi khác: GAP-01/11 cần sửa tính nguyên tử/recovery. Cookie web và BODY native đã phân biệt; credential không nằm trong idempotency cache.

ValidationPipe whitelist/forbidNonWhitelisted/transform hữu hiệu với DTO class. Inline object types và any không giữ metadata runtime, nên không được coi là validated chỉ vì TypeScript có kiểu (GAP-14). Services có nhiều manual validators đúng: nested onboarding allowlist, booking-item finite amount/integer duration, branch hours, scope IDs. Không yêu cầu lặp validation mọi lớp khi invariant đã bảo vệ.

[catch( — beauty-booking-api-main/src/common/filters/prisma-exception.filter.ts:76](../../beauty-booking-api-main/src/common/filters/prisma-exception.filter.ts) chỉ bắt PrismaClientKnownRequestError: P2002/P2003→409, P2025→404, P2034→409, P2024/P2021/P2022→503; safe response không raw SQL/stack. Unknown TypeError/Prisma validation errors không tự trở thành400. [export async function — beauty-booking-api-main/src/common/utils/serializable-transaction.ts:52](../../beauty-booking-api-main/src/common/utils/serializable-transaction.ts) dùng Serializable, maxWait5000ms/timeout10000ms, mặc định2 retries và jitter; phân loại P2034, raw40001/40P01; exhaustion409 và overlap23P01→409. Chỉ những caller dùng helper hưởng retry này.

AuditInterceptor chạy cho Audited metadata, ghi outcome asynchronous; helper auditLog catch không throw. Direct tx.auditLog.create ở no-show/branch/impact có rollback semantics khác. Integrity triggers bảo vệ log đã tồn tại, không bảo đảm mọi thao tác đều có log khi storage lỗi (DEP-005). Không suy ra log pipeline hay alerting production.

## 3. Flow đã trace từ client tới persistence

| Flow | Client → API/service → persistence/side effect | Kết luận gắn ID |
|---|---|---|
| Login/register/logout/native refresh | web authStore/mobile AuthContext → AuthController → AuthService/JwtStrategy → User/Session/AccountToken/Redis | AUTH-001..009, GAP-01/02/11/12/13 |
| Customer đặt lịch đơn | BookingConfirm/mobile booking create ONLINE_APP → BookingsController derive profile/channel → BookingsService create → branch/policy/staff locks/items/price/quota → notify/socket | ACL-003, BOOK-001/002/007/008/009, GAP-07/15 |
| Counter/guest appointment | controller roles/channel check trước tạo guest → BookingsAccessService branch scope → same booking create | Không coi guest route là public; ACL-003 |
| Booking state/items | salon API → access/assigned-staff authorization → state/time/revision gates → Serializable parent/items/history/violation | BOOK-003/004/006; post-commit GAP-07 riêng |
| Customer hủy/đổi lịch | web/mobile cancel/request → lock booking → cutoff4h, one pending, violation, notification cùng tx → expiry worker | BOOK-005/007; notification failure không thuộc GAP-07 ở create request |
| Thu tiền/chuyển khoản | PaymentsWorkspace → collect/verify controller/resource can → PaymentIntent/Transaction/legacyPayment/Ledger tx | PAY-001/002, GAP-03; chưa có online gateway |
| Hoàn tiền | request/refund review → role+requester separation → START PROCESSING → CONFIRM evidence+payment lock/cap/ledger | PAY-003..005; GAP-18 omits PROCESSING ở reservation |
| Gói liệu trình | counter purchase → policy/branch/customer checks → nested purchase/installments/entitlements; pay row lock; reserve self/branch scope | PKG-001..003; GAP-19 terminal/branch invariant |
| Onboarding/catalog/staff | web owner/admin → resource scope → readiness/publish/staff status/catalog offering → working-hour validators | CAT-/STAFF-; GAP-08/10/15/22/24 |
| Operations/ownership | SalonOperations/AdminOwnership/CustomerBenefits → impact access/owner-recipient checks → booking mutations or owner/role/payout tx | GAP-04/05/09/21; business states/locks chưa đồng nhất mọi writer |
| Pricing/combo | price preview → audience/scope/value → reserve row lock version/quota → redemption/adjustment cùng booking | PROM-001/002; quote không phải reservation |
| Review/media/privacy | authenticated customer/owner + public projections → ownership/visibility/manual validators → unique/nested tx/file storage/encrypted exports | REV-/MEDIA-/PRIV-; root User response GAP-17 |
| Background/realtime | registered cron/worker + socket gateway → claim/revalidate → tx/outbox/notification | BG-/SOCKET-; GAP-16/23, DEP-002 |

Evidence pointers: [const confirm = async — beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingConfirm.jsx:79](../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingConfirm.jsx); [async create( — beauty-booking-api-main/src/bookings/bookings.service.ts:816](../../beauty-booking-api-main/src/bookings/bookings.service.ts); [async create( — beauty-booking-api-main/src/bookings/change-requests.service.ts:56](../../beauty-booking-api-main/src/bookings/change-requests.service.ts); [async collect( — beauty-booking-api-main/src/payments/payments.service.ts:149](../../beauty-booking-api-main/src/payments/payments.service.ts); [async resolveItem — beauty-booking-api-main/src/operations/impact.service.ts:48](../../beauty-booking-api-main/src/operations/impact.service.ts); [async execute — beauty-booking-api-main/src/ownership/ownership.service.ts:132](../../beauty-booking-api-main/src/ownership/ownership.service.ts); [const reload = — mobile/src/context/BookingsContext.tsx:61](../../mobile/src/context/BookingsContext.tsx). Inventory bổ sung đường route cụ thể cho mỗi symbol.

## 4. Đánh giá theo nghiệp vụ

**Auth/account.** Sai credentials/inactive được reject; register normalize/DTO và DB unique; workspace separation/role freshness mạnh hơn kiểm tra roles trên token cũ. Logout persistent session đúng. Thiếu atomic consume reset token và password/session revocation là HIGH có tiền đề phải có token/session hợp lệ, không phải anonymous bypass. Refresh rotation CAS chống replay nhưng consume marker trước bước có thể fail làm401 không phục hồi. Web/mobile clear session quá rộng và thiếu epoch fence khi response cũ về. [private async consumeAccountToken — beauty-booking-api-main/src/auth/auth.service.ts:618](../../beauty-booking-api-main/src/auth/auth.service.ts); [async resetPassword — beauty-booking-api-main/src/auth/auth.service.ts:426](../../beauty-booking-api-main/src/auth/auth.service.ts); [async refresh — beauty-booking-api-main/src/auth/auth.service.ts:286](../../beauty-booking-api-main/src/auth/auth.service.ts).

**Authorization/tenant.** Các test management-role-scope, booking-access và role-refactor kiểm tra nhiều mixed-role/foreign-branch cases. Mọi path/body/header ID phải được bind về quan hệ DB; đa số flow chính làm điều đó. Lỗ hổng nổi bật là TRANSFER_BRANCH ghi replacementStaffId trực tiếp dù đã kiểm tra business của branch đích (GAP-04). Không coi scope của case nguồn là quyền sử dụng mọi staff ID. Root user suspend response trả passwordHash (GAP-17) bị giới hạn cho admin có permission nên MEDIUM. [private async transferBranch — beauty-booking-api-main/src/operations/impact.service.ts:236](../../beauty-booking-api-main/src/operations/impact.service.ts); [async suspend — beauty-booking-api-main/src/users/users.service.ts:236](../../beauty-booking-api-main/src/users/users.service.ts).

**Booking/schedule.** Availability chỉ là đọc; create/move/resize/assign recheck slot, customer collision, staff active/bookable/skill/branch và giờ hoạt động. Branch holiday/special day có ưu tiên rõ; individual leave/break/attendance không còn là dependency. Business timezone UTC+7 và half-open interval cho phép lịch liền kề. No-show cần strict >15phút, actual attendance/request cancellation chặn; customer cancellation cutoff4h, pending request expiry24h; violation90ngày late1/no-show2, score3 cần true acknowledgment, threshold4 tạo30ngày restriction bằng event. Booking/item states không được đánh đồng; cancel terminal chỉ cascade unfinished items. Source mạnh về data invariants, nhưng service/price đọc trước tx và post-commit notify còn gap.

**Business/branch/staff.** Readiness/public projection tách draft/approved/active; owner preview không tự publish. Nested onboarding fields whitelist và giờ ngày validate. State transition branch re-read sau lock và history version. Completed impact cũ không đủ đại diện cho tập lịch mới (GAP-10). Business review vẫn pre-read rồi update id (GAP-22). Generic staff update và offboarding workflow không chung gate (GAP-24). SMTP helper nuốt lỗi làm rollback invitation ở caller không chạy (GAP-08); không coi forgot-password trả generic ok để chống enumeration là lỗ hổng.

**Payment/refund/packages.** Cash/manual bank có thực; phương thức online chưa có adapter được reject, không giả định webhook. Payment writes dùng transaction và scope; split amount được UI quảng bá nhưng migration giữ unique một settled Payment/booking. Vì vậy kết luận chính là không hoàn tất split payment (GAP-03), không phải đã double-charge. Refund request/approve/process là các state khác nhau; cap CONFIRM và chứng từ vẫn giữ, nhưng PROCESSING không giữ chỗ ở request balance (GAP-18). Purchase nested atomic; installment lock/state chống thu hai lần một kỳ. Reserve entitlement có unique item và purchase sequence, nhưng không chặn terminal booking/khác branch cùng business (GAP-19).

**Promotion/combo/review.** Discount quote có scope/audience/stacking/value caps; reserve version/quota locks trong booking tx, snapshots không phải current price. Combo phải có ít nhất2 dịch vụ khác nhau đúng branch, snapshots lưu server values. Review yêu cầu customer và booking COMPLETED, item/staff match; UNIQUE bookingId chặn duplicate khi hai prechecks cùng pass. Public identity/summary chỉ approved và mask anonymous. Review input inline vẫn chịu gap validation chung; HANDLED REV-001 chỉ về ownership/lifecycle/duplicate, không có nghĩa mọi malformed payload được400.

**Media/privacy.** Media derive tenant từ entity, size/MIME/magic/extension allowlist, safe random storage path; PDF legal private có capability checks. Bytes ghi trước DB attach; rollback DB có unlink best effort, crash giữa file và DB chưa có runtime kiểm chứng cleanup. Không khẳng định magic detection là antivirus/full decoder validation. Privacy export reauth, self scope mọi domain, AES-GCM, raw download token chỉ response/hash storage; one-time CAS trước decrypt. Mất response sau one-time claim phải xin gói mới, không báo lần tải đã được quan sát thành công.

**Reports/settings/saved services/admin.** Dashboard owner dùng cùng scope/date cho KPI/chart, financial metrics có test biên tháng UTC/local; không đối soát số liệu live. Settings manual known-key/type/range guards và fixed cancellation4h. Saved services dùng customer/offering compound upsert và own removal; chức năng này độc lập với loyalty đã bỏ. Admin governance có lý do/audit và quyền riêng; từng endpoint contract nằm inventory, không ngầm cấp quyền tenant-operational.

**Workers.** Outbox claim+attempt fence, stale reclaim, projection+SENT atomic, backoff/dead-letter là bảo vệ tốt. Change request expiry updateMany state/time, reentrancy guard. Recurring CREATING có heartbeat/fence và recovery giữ committed bookings; preview chưa đọc occupied slot (GAP-16). Policy reminders trực tiếp read/create qua cửa sổ5phút thiếu catch-up và atomic dedupe (GAP-23). Impact workflow claim PROCESSING rồi nhiều tx con, không lease recovery (GAP-09). Ownership timer bắt lỗi execute và ghi EXECUTION_FAILED; review/cancel writers chưa dùng cùng CAS protocol (GAP-05). Các worker không được tự khởi động trong audit.

## 5. Validation đối chiếu database

| Invariant | Validation/service | Constraint/transaction repository | Giới hạn còn lại |
|---|---|---|---|
| Email/role hợp lệ | Register DTO normalize, role do service quyết định, account separation | User.email unique, role scope/account separation triggers | DB thực đã áp dụng chưa biết; reset token consume không hưởng email uniqueness |
| Booking đúng slot/staff | Recheck eligibility và overlap trong helper | Serializable, advisory locks, booking_services_staff_slot_guard/customer trigger | FK staff không kiểm tra tenant/skill; transfer bypass validator (GAP-04) |
| Một transition đúng | Booking/item CAS status/revision | Conditional UPDATE và history cùng tx | Ownership cancel/business review không dùng cùng pattern (GAP-05/22) |
| Giá/số tiền hợp lệ | Item finite/integer/precision và DTO payment amounts | CHECK amount>=0, numeric columns, unique business keys | CHECK từng row không cap tổng; settled-payment index lại xung đột split (GAP-03) |
| Refund không vượt | Payment lock, pending/approved reservation; CONFIRM sum | Transaction + settlement ref uniqueness | PROCESSING bị bỏ ở reserve (GAP-18), cap final vẫn còn |
| Quota discount | Reserve lock/version/counters | Redemption links và booking tx | Quote không giữ quota; phải xử lý giá hết hiệu lực ở confirm |
| Entitlement đúng | Purchase active/expiry, customer/business match | Unique redeemedBookingServiceId, unique purchase/sequence | Không bind terminal state/branch đúng (GAP-19) |
| Không rò sensitive response | Select public projections, private media capability | DB lưu hash/encrypted data, không tự redact response | Root User.update trả passwordHash (GAP-17); serialization regex test quá hẹp |
| Audit bất biến | Direct tx logs hoặc helper/interceptor tùy flow | Audit/history immutable guards | Immutable không đồng nghĩa durable delivery khi helper catch fail (DEP-005) |

Đã tìm toàn migration chain cho chỉ mục payment settled: có CREATE trong20260715_harden_payment_concurrency, không thấy DROP. Schema Prisma một mình không phản ánh partial indexes/triggers nên phải đọc SQL. Booking overlap function có phiên bản thay thế trong20260829_remove_attendance_workforce, không dùng logic workforce đã bỏ làm bằng chứng hiện hành. Tất cả đây là **repository protection**, không phải kết quả introspect database demo.

## 6. Concurrency, transaction, idempotency và side effects

Những pattern được triển khai tốt: Serializable helper bounded retry; sorted provider advisory locks; customer/booking row fences; booking/item CAS; promotion/voucher row locks+version; installment row lock; refund state CAS; outbox attempt fencing; recurring creation fencing. Tests mock mô phỏng count1/count0 hoặc Prisma errors chỉ xác minh nhánh điều khiển. Chỉ test PostgreSQL riêng mới xác minh lock ordering, transaction abort và migration triggers thật.

Những cửa sổ còn thiếu: account token read-usedAt update không CAS (GAP-02); password write trước Redis/session revoke (GAP-01); owner cancel đọc cũ rồi ghi sau execute (GAP-05); business review pre-read ngoài tx (GAP-22); catalog eligibility/snapshot ngoài create tx (GAP-15). Completed impact không gắn version của transition/tập lịch (GAP-10). Transaction đơn lẻ không tự ngăn writer khác không theo cùng protocol.

Idempotency interceptor bắt buộc key cho allowlist POST nhạy cảm, bind actor+method+concrete resource path+stable body fingerprint, TTL và NX reservation; auth bị loại để không cache tokens. Test memory chứng minh replay payload giống, conflict payload khác và concrete ID isolation. **Không** có test Redis conflict branch: exception semantic bên trong try bị đổi503/fallback memory (GAP-06). Complete ghi Redis XX sau DB commit, release theo fingerprint; đây không phải transaction xuyên DB/Redis. Chưa có durable operation-result table bảo đảm exactly-once sau crash/lost response; GAP-07 nêu reachable post-commit failure. Không suy tất cả retries sẽ tạo duplicate vì constraints vẫn có thể chặn.

Side-effect semantics khác nhau cần giữ rõ: change-request notification nằm trong tx; booking create/status notify ở sau commit; operations finalization outbox atomic nhưng booking mutations trước đó đã commit; invitation email errors bị swallow; policy reminder trực tiếp notification create không dùng outbox. Lỗi một bước sau commit không thể được Prisma filter rollback bước trước. Financial fee sau COMPLETED notify bị bỏ qua nếu notify throw; cần replay/reconciliation, không chỉ catch rồi trả thành công thiếu nghĩa vụ.

## 7. Web/mobile error và recovery

Shared fetch client web xử lý response JSON/empty/204, giữ error details và safe5xx, single-flight refresh và Web Lock giữa tab, preserve generated idempotency key khi retry401. Loading/error/retry ở BookingConfirm gồm price/policy, strict acknowledgment và409 quay chọn giờ; submittingRef giảm double clicks. Booking store logout reset không mang contact/note qua tài khoản. latestRequest/useAsyncResource bảo vệ stale response ở call sites áp dụng; không tự hủy mọi HTTP request toàn web.

Mobile dùng BODY refresh cho native, SecureStore trên native; bản mobile web fallback localStorage chứa session (khác với web Vite chỉ persist metadata). Không có kết luận storage an toàn mọi nền tảng từ tests chưa chạy. BookingsContext có owner/request generation gate và addBooking recheck user, nên không ghi nhận sai là thiếu chống response lịch của user cũ. AuthContext/refresh handler vẫn thiếu session epoch và transient network classification (GAP-12/13).

Cả fetch client không có timeout mặc định; có nơi nhận signal nhưng không thành global cancellation. Refresh infrastructure errors có thể xóa session; malformed200/mobile cast payload và storage persistence failure chưa được E2E xác minh. Không thấy application ErrorBoundary chung trong src được rà; chỉ Vite preload recovery không thay thế React render-error recovery. Đây là giới hạn recovery coverage, không tự khẳng định mọi trang sẽ trắng.

Ownership acceptance link đi CustomerBenefits trong workspace CUSTOMER, nhưng account separation đòi recipient operational (GAP-21). API accept vẫn recipient-bound; thiếu đường UI đúng không phải backend authorization bypass. Operations UI có batch result từng item, không nên diễn giải HTTP200 của batch là mọi item thành công; đồng thời raw error.message trong batch cần safe envelope ở GAP-14.

## 8. Kiểm thử thực sự đã chạy

Đã đọc package scripts/Jest configuration và quét setup trước khi chạy trực tiếp runner, tránh scripts seed/deployment. Các suite được chọn dùng mock/fixture; socket transport test dùng local stub, không DB production.7 PostgreSQL integration tách riêng do cần DB riêng và có ghi/xóa fixtures. Test không được viết/sửa trong audit.

Từ thư mục backend beauty-booking-api-main, command đã chạy:

```powershell
node node_modules/jest/bin/jest.js --runInBand --testPathIgnorePatterns=integration.spec.ts --no-cache --cacheDirectory=../docs/exception-audit/jest-cache --json --outputFile=../docs/exception-audit/backend-tests.json *> ../docs/exception-audit/backend-tests.log
exit $LASTEXITCODE
```

Kết quả: **93 suites:92pass/1fail;775tests:774pass/1fail;0pending;55.965s**. Exit1 do assertion contract. Lỗi xác định: GET /bookings/by-branch/{branchId}, OpenAPI generated có x-scope-requirement trong khi AST metadata route.scope undefined. Source test ở common/permissions/openapi-contract.spec.ts:19. Hai assertions/test cases còn lại trong cùng suite pass. Không regenerate OpenAPI vì task không sửa artifact ứng dụng. Đã dùng scanner read-only để xác định mismatch duy nhất; output trong ROUTES.json.

Từ thư mục frontend beauty-booking-web-main/beauty-booking-web-main:

```powershell
node --test src/utils/businessCompletionRules.test.js src/utils/latestRequest.test.js src/store/bookingStore.test.js src/utils/schedulerSocketEvents.test.js src/utils/authScope.test.js src/utils/operationsScope.test.js src/utils/customerCancellation.test.js *> ../../docs/exception-audit/web-tests.log
exit $LASTEXITCODE
```

Kết quả: **57pass/0fail/0skip**, khoảng418ms. Đây là pure Node tests, không browser render hoặc mobile booking. [Raw Jest JSON](backend-tests.json), [backend log](backend-tests.log), [web log](web-tests.log), [tên test đầy đủ](TEST-COVERAGE.md).

### Assertion và giới hạn tiêu biểu

| Nhóm | Assertion đã đối chiếu | Điều chưa chứng minh |
|---|---|---|
| Auth DTO/controller/workspace | reject role injection/weak password; cookie/BODY đúng; mixed/retired roles reject | Token reset race, Redis failure giữa password/session; passport DB+Redis end-to-end |
| RBAC/access/management | foreign tenant/branch/staff-unassigned rejects; owner không mượn receptionist membership | Replacement staff trong TRANSFER_BRANCH, mọi deployed grant |
| Booking lifecycle/time | count1 vs0 ra một winner; child failure prevents mock commit; strict no-show+cancel boundaries | PostgreSQL concurrent transactions và trigger version deployed |
| Restriction/violation | exact90day/30day expiry, strict acknowledgment, business/customer fence | Cross-connection serialization under load |
| Prisma/tx helper | safe status mappings; synthetic40001 retry2calls; unknown no retry | Real driver payload/production contention |
| Idempotency | memory same key replay, payload mismatch, resource isolation | Redis branch, crash after commit before cache complete |
| Payments | foreign collector/customer denied, pending refunds reserve, review CAS, START≠settled, CONFIRM evidence | Settled unique index vs split, PROCESSING reservation, terminal package reserve |
| Media | scope từ entity, spoofed business rejected | Filesystem failure/crash cleanup/content decoder, actual private download HTTP |
| Outbox/recurring recovery | one mocked notification+attempt fence; lost claim no-op; notice failure prevents mock tx completion | Two-worker DB race/process crash/recovery timing thật |
| Frontend helpers | stale requests không overwrite, scope/session mapping, cancellation policy | Render error boundaries, offline auto-refresh, multi-account auth race, device storage |

Một test tên “concurrent” với Prisma mock không được dùng làm bằng chứng DB race thật. Test failed trong worktree hiện tại không tự được quy cho thay đổi trước đây; chỉ biết audit không đổi application source theo baseline.

## 9. Không chạy và kế hoạch runtime an toàn

7 suites PostgreSQL: customer-booking-policy.integration, postgres-hardening.integration, account-separation.integration, audit-integrity.integration, health-archive.integration, manager-retirement.integration, schema-alignment.integration. Có RUN_POSTGRES_INTEGRATION và các database-name guards, nhưng tên/flag không tự chứng minh DB dùng riêng. Không set flag hoặc dùng DATABASE_URL hiện hữu để chạy.12 Playwright files chưa chạy. playwright.config.js tự start API start:dev và Vite/reuse existing server nếu không tắt, API start kích hoạt workers; setup/seed.spec.js được đọc chỉ mở login, không tự giả định file tên seed reset DB. Các E2E booking vẫn có writes.

1. Task kiểm chứng riêng tạo PostgreSQL/Redis disposable, SMTP sink và provider adapters local; xác nhận hostname/dbname/ownership, không kết nối database demo/live. Chuẩn bị fixtures 2 businesses/branches, customer, owner, receptionist, staff và admin bằng quy trình riêng được kiểm soát. Audit này chưa tạo DB/migrate/seed.
2. Đối chiếu pg_indexes/pg_trigger/migration history với repository: settled unique index, overlap guard functions, account separation/audit guards. Không bỏ constraint để làm test pass.
3. Repro HIGH có barrier: consume token A/B; password→Redis fault; transfer foreign staff; cancel owner-transfer vs execute. Đọc cả state/history/notifications/roles, không chỉ HTTP.
4. Repro money: split40+60, two pending100+100, refund PROCESSING reserve, terminal package session. Không gửi tiền thật; mọi settlement evidence giả trong fixture.
5. Inject post-commit failures và process crash cho booking/outbox/impact/recurring; assert durable recovery và no lost/duplicate logical events. Reminder clock skip/catch-up và multi-worker race.
6. Browser/mobile: chọn service→staff→slot→confirm→cancellation/request; logout/login account khác khi request delay; offline refresh, expired key,409 conflict, storage failure. Kiểm tra owner/receptionist chỉ thấy branch của mình; socket revoke đổi room và missed-event resync. Chụp evidence desktop/mobile ở môi trường này.
7. Rerun existing unit +7 integration đủ điều kiện rồi Playwright có explicit disposable base/API URLs; ghi pass/fail/skips tách biệt, cleanup chỉ fixtures thuộc test.

## 10. Ưu tiên khắc phục và kết luận có giới hạn

- **Trước tiên GAP-01/02/04/05:** atomic account revocation/reset claim, bind target staff và đồng bộ mọi ownership writer.
- **Tiền/lượt GAP-03/18/19:** thống nhất split-payment model/DB constraints, reserve PROCESSING refund, bind entitlement lifecycle.
- **Nhất quán lịch GAP-07/09/10/15/24:** outbox/result durability, impact checkpoint/recovery, transition version, catalog revalidation và staff transition chung.
- **Recovery GAP-06/11/12/13:** tách Redis semantic conflict/hạ tầng, refresh transaction/epoch và offline retry.
- **Workflow GAP-08/16/21/22/23, input/output GAP-14/17, contract GAP-20:** sửa cùng tests có assertion riêng đã nêu, không chỉ tăng số test.

Trong phần được trace, **booking core và resource authorization** có coverage tốt nhất: nhiều test explicit ownership/role/time/CAS/rollback, migrations+helper có defense in depth. **Operations/ownership và auth partial-failure/recovery** yếu nhất tương đối: nhiều bước commit riêng, writers không cùng protocol, tests chủ yếu scope/happy-path; payment split schema mismatch cũng cần ưu tiên. Đây là so sánh theo evidence đã đọc, không score tuyệt đối toàn sản phẩm.

Không tuyên bố “chuẩn bảo mật”, “không double booking trong production”, “mobile đồng bộ hoàn toàn” hoặc “toàn bộ routes đã test”. Chưa sửa mã ứng dụng. Các file audit là kết quả bàn giao để task tiếp theo xử lý từng ID có bằng chứng.
