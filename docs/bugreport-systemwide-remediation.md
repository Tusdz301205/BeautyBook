# BeautyBook — BugReport system-wide remediation

Checkpoint QA trước commit/push **13/10/2026**: working tree `main`, HEAD `6a2b43822b6444d9f041bf08f007ae2a75b7a46f`, giữ 185 tracked modifications và 46 untracked entries. Không commit/push/reset/reseed/drop trong đợt này. Code manifest 659 files, SHA256 `c1bd2522356337d755b7d7d8d4fd53f8684788a554dbe3268aa385cdbd657d60`; package/test entry và compiled artifacts được bind riêng trong `report-output/bugreport-completion-20261012/root/checkpoint-current.json`.

Latest safe gates: **API 145 suites/1.555 tests**, typecheck/build đạt; **web 265 tests/build** sau sửa Operations, Field, menu và hold quá hạn; **mobile 222 source/mock tests**, typecheck đạt qua agent; Android Hermes export thuộc checkpoint trước. Đây không phải tỷ lệ hoàn thành sản phẩm hoặc nghiệm thu native.

API QA3014 hiện PID15836, database test và tám global worker/email vẫn tắt; fresh health/database-up và demo5176 HTTP200 được ghi vào checkpoint. Những PID và kết luận readiness cũ phía dưới là lịch sử. Native sau thay đổi copy hiện NOT_RUN; bản demo dữ liệu phát triển dùng5173/API3000, QA5176/API3014 vẫn giữ riêng. **wholeProductComplete=false**; phần bổ sung13/10 ở cuối mô tả chính xác các ca mới và giới hạn còn lại.

Các checkpoint/kết quả 08–12/10 phía dưới được giữ làm lịch sử; không gắn lại chúng cho source hoặc runtime mới.

## Khôi phục checkpoint

Đã đối chiếu git status và diff với handoff: bảo toàn 7 file sửa và 4 helper/test mới về DOB, registration intent, onboarding. Sandbox Windows lỗi `setup refresh had errors`; thực thi local ngoài sandbox đã đọc/ghi đúng repository. Các lệnh không chạy được không được tính là test.

## Quyết định sản phẩm đã thực hiện

| Mục | Trạng thái | Thực hiện / kiểm chứng |
|---|---|---|
| 12 — Yêu cầu xử lý dữ liệu | Đã bỏ UI/flow; web đã xác minh, mobile đã typecheck | Gỡ PrivacySettings, CSS và API client độc lập; gỡ menu; route cũ thông báo đã gỡ và có liên kết trở lại hồ sơ. Gỡ mobile nút “Xóa tài khoản” vốn gửi data-request chứ không xóa/ngừng tài khoản trực tiếp. Giữ backend/history và các cơ chế chung. Giữ profile/security. |
| 14 — Tài chính & hoàn tiền | Đã ẩn, web đã xác minh | `FINANCE_WORKSPACE_ENABLED=false`: menu, workspace cards, owner finance loading/summary/chart, notification links. Route cũ hiển thị chưa khả dụng. Giữ PaymentsWorkspace, backend/data và các luồng thanh toán độc lập trong lifecycle. |
| 17 — Chi tiết sự kiện kiểm toán | Đã bỏ, web đã xác minh | Gỡ modal JSON và nút mở desktop/mobile; không hiển thị entity ID/enum thô/IP/request ID. Giữ list đọc, filter, metrics, pagination và backend audit. |

Bằng chứng: `report-output/bugreport-remediation/browser-qa-20261008.json`: 40/40 PASS, 40 screenshot, 0 pageerror. 3 vai trò customer10/owner0/platform_admin, 375/768/1024/1440px; kiểm tra route thực tế, ảnh hỏng, overflow, menu cũ. Lượt đầu lỗi locator Email của harness, được giữ ở `browser-qa-20261008-harness-prior.json`, không phải product bug.

## Ma trận khảo sát và lỗi sửa

| Vai trò / luồng | Nguyên nhân / kết quả | Trạng thái |
|---|---|---|
| Customer profile DOB | FE/backend từng cho DOB tương lai. Bảo toàn validator lịch Việt Nam UTC+7 và helper đang có; 5 helper tests PASS, DOB nằm trong 87 API regression PASS. | Đã sửa + kiểm thử |
| Business registration CTA/login/refresh | Redirect mặc định mất ý định đăng ký. Giữ safe internal return path; owner đi onboarding, customer không tự tăng quyền. | Code/helper verified; chưa đầy đủ browser mọi trạng thái hồ sơ |
| Business onboarding documents | Checklist theo loại giấy tờ, trạng thái/phiên bản dễ hiểu. Bảo toàn source đã sửa. | Helper verified; lifecycle submit/review tất cả nhánh chưa chạy lại |
| Customer appointments | Baseline thật upcoming/completed 200. Handoff gọi nhầm `/recurring/my` 404; source thực tế gọi `/recurring/mine`, QA mới endpoint đúng 200. Browser customer appointments thật PASS 4 widths. | Đã đúng + xác minh trong scope; không gán lỗi từ endpoint harness sai |
| Owner lists/dashboard | Baseline bookings 200, branches accessible 200; browser overview/services/audit thật 4 widths PASS. | Đã đúng trong scope đã chạy |
| Admin account suspension | Endpoint blind toggle, state lưu trước revoke/audit; UI list chuyển detail nên dialog cũ không còn reachable. | Đã sửa backend + detail control, 31 unit PASS; live API và UI khóa/mở/double-click PASS |
| Account security / notification | Trạng thái đích + expected-state CAS + lý do; ảnh hưởng customer/staff/owner cần acknowledge; Serializable transaction state/session/audit/outbox. Redis lỗi sau commit không biến lock thành failure/retry toggle vì JWT bắt buộc session và DB active. Giữ lịch/assignment, không âm thầm cancel. | Live lock/retry/open/old JWT/session/outbox đã PASS trên user mới; không sửa fixture actors |
| Notification listing | parseInt nhận NaN/negative/fraction/trailing garbage/huge; sort chỉ createdAt thiếu tie-break. Giới hạn integer page1..100000/limit1..100, reject invalid filters, sort createdAt+id; self scope giữ nguyên. | Unit và live invalid-query PASS |
| Service image upload | Blob post-success không revoke, URL tương đối đi nhầm frontend port, gallery append bị gọi “thay”, workspace không project ảnh thật. | Sửa FileUpload/media URL, gallery theo branch, workspace primary image; API upload/link/read/cross-tenant PASS; browser real-upload preview/gallery/revokeBlob 3/3 PASS |
| Public/admin media | HomeMedia và public gallery dùng URL API khác origin đúng, generated assets vẫn frontend. | Source fixed, shared thumbnail/API-origin đã kiểm tra; mọi public media type chưa exhaustively chạy |
| Admin legal files | Chỉ hiển thị số version/status, thiếu nút đọc PDF. Thêm authenticated download/preview, chọn đúng currentVersion, xem history riêng, không public hóa. | Code fixed; live private/public/cross-tenant đã kiểm tra, final UI current/history và authorized download PASS; inline renderer có giới hạn |
| Storage referenced media | Live DELETE media đang được BusinessDocumentVersion tham chiếu trả500; rollback giữ data. Thêm explicit409 guard cho legal history và shared image references trước detach/delete. | 18 media tests PASS; live retest cùng mediaQA trả409, current/history giữ nguyên |
| Search by Vietnamese names | Insensitive chỉ hoa/thường. Thêm normalize diacritics/đ/whitespace; parameterized SQL trước paging cho user/branch/public services; UI staff/service/select dùng helper. ID/email không áp fuzzy fold. | Source fixed; build/tests PASS, live user/public-service/branch queries PASS |

Không dùng quy tắc tên 6–8 ký tự. Không tự áp một độ dài pháp lý chung cho CCCD/mã số thuế: model chưa tách đầy đủ loại hình pháp lý với service businessType. Cần đối chiếu nguồn chính thức và legal-entity discriminator trước khi đổi validation; chưa claim đã xác minh pháp lý.

## Kết quả đã chạy

- Web: 115/115 tests PASS tại `web-tests-20261008.log`; build PASS `web-checks-20261008.json`. Source có thay đổi thêm sau đó, kết quả latest lưu riêng.
- API: 7 suites / 87 tests PASS tại `api-tests-20261008.log` (DOB, pagination, workspace media, media scopes, outbox retry/worker). Build PASS. Typecheck ban đầu có lỗi có sẵn tại available-slots-policy.spec; giữ assertion bằng map/toContain, không giảm test.
- Account/slot: 3 suites /31 tests PASS. Typecheck/build sau correction đạt trong `account-checks-20261008.json`. Mock type error mới được sửa trước bàn giao.
- Media reference: 2 suites /18 tests PASS, typecheck/build PASS `storage-checks-20261008.json`.
- Mobile: `npm run typecheck` exit0 sau gỡ data-request UI. Không restart Metro/emulator, không claim native runtime PASS.
- Actual API: `live-remediation-20261008.json`: 28/28 PASS; chỉ user/service/media QA mới. Lock/retry semantically một audit/outbox, sessions revoked; reopen không hồi sinh token cũ; upload bytes/link/workspace/cross-role checks.
- Legal baseline: `legal-live-20261008-before-fix.json`: private upload/current-history/admin read/public404/cross-owner403; xác nhận product500 khi gỡ referenced document. Bảo toàn evidence fail, không thay kỳ vọng để lấy PASS.

## Demo và evidence

Demo web: http://127.0.0.1:5176 ; controlled API: http://127.0.0.1:3014/api/v1. Runtime dùng database test guard, email credentials trống và 8 background workers tắt. Có tạo login audit/session và các entity QA mới; không gọi đây là zero DB writes. Không gửi kênh external thật.

Ảnh đã kiểm tra trực quan:
- `report-output/bugreport-remediation/ui-owner0-salon-services-375.png`
- `report-output/bugreport-remediation/ui-platform_admin-admin-audit-1440.png`
Các ảnh/JSON/log chi tiết nằm trong cùng thư mục, ignored khỏi Git theo policy repo; MD này commit được.

## Storage triển khai và giới hạn

MediaService giữ file gốc dưới UPLOAD_DIR, metadata/link trong transaction; DB failure unlink file mới, private read dùng quyền hiện tại, không dùng URL công khai chữa preview. Cần mount persistent volume ở production, backup nhất quán DB + volume, kiểm thử restore tại staging; không coi restart local là redeploy/restore production. MIME/signature/extension/10MiB đã có, nhưng chưa xác minh decoder cho mọi image format/truncated content và chưa có quy trình orphan scan/recovery cho crash giữa disk/DB. Không đăng ký cloud hoặc di chuyển dữ liệu.

## Checkpoint giữa đợt (đã được kết quả cuối phía dưới cập nhật)

1. Thu log latest build/typecheck/name tests; kiểm tra live accent queries và legal409 trên đúng entity đã tạo.
2. Browser final: private document current/history, admin account impact, persisted service images, upload preview/failure/retry/double action; lưu screenshot desktop/mobile.
3. Hoàn thiện matrix notification toàn sự kiện (review/reassign/branch/business/account), không dùng outbox unit PASS để claim toàn ma trận recipient/end-to-end đã chạy.
4. Rà soát thêm Reviews/policy/admin appointment routes, pagination/race khi đổi user/branch, mobile customer/staff/owner runtime. Không claim toàn bộ form/all roles/all clicks accepted từ 40 route checks.
5. Search còn cần audit area/service filters của branch và các màn hình khác; không claim toàn web đã chuẩn hóa chỉ từ các entry points chính.
6. Cập nhật kết quả/giới hạn này sau mỗi đợt. Không push Git trong scope lượt tiếp tục này.


## Bàn giao đợt 08/10 — kết quả cuối đã thu

- Build API + web PASS; API typecheck PASS. API delivery **11 suites /122 tests PASS**, web **116 tests PASS**. Mobile typecheck trước đó PASS; mobile source không đổi thêm sau đó.
- Registry browser chọn kết quả mới nhất theo vai trò/route hoặc action/width: **76/76 PASS** trong `delivery-summary-20261008.json`. Đây là 40 route/viewport ban đầu và các kiểm tra bổ sung có thật; không phải toàn bộ nút/form.
- `browser-remaining-20261008.json`: **24/24 PASS** trên customer reviews/notifications/booking entry, owner appointments/reviews/profile/notifications, admin appointments/reviews/salons/users/notifications tại375/1440. Có3 telemetry401 `/auth/refresh` từ3 fresh contexts; không có business API>=400 ghi nhận, không có pageerror. Runner không ghi phase nên không dùng số này để claim HTTP toàn bộ bằng0.
- `browser-upload-final-20261008.json`: **3/3 PASS** cho thumbnail thật, local preview trong request thật, response201/gallery append giữ ảnh cũ + revokeBlob. Một media mới thêm riêng service QA. Ảnh QA1x1 dùng kiểm thử kỹ thuật; không được báo là ảnh BeautyBook mới hoàn thiện.
- `browser-detail-actions-20261008.json`: **3/3 PASS**: double-click khóa chỉ1 POST, mở lại1 POST và refresh status; browser tải đúng PDF version2 bằng quyền admin. Không sửa base fixture user; user target là synthetic mới từ live suite.
- `final-live-20261008.json`: **10/10 PASS**. Retired data-request POST404; referenced legal mediaDELETE409 và giữ version1/2; file upload giữ bytes sau APIrestart; PostgreSQL accent fold, user search trước paging, public service search không dấu, public branch query trả200.
- Source caption “Đã thanh toán” trong image19 của Word nằm trong bitmap được upload, không phải state upload của BeautyBook. Đã xem lại ảnh nguồn; không sửa nhãn payment một cách sai ngữ cảnh.

### Các sai lệch harness đã giữ nguyên bằng chứng

1. Locator login Email khác label thật Địa chỉ email: giữ `browser-qa-20261008-harness-prior.json`.
2. Legal fixture DRAFT mới lúc đầu gắn vào owner0, làm default onboarding chọn draft: giữ `browser-final-20261008-fixture-prior.json` (30PASS/19FAIL). Chuyển **chỉ businessQA mới đãguard** sang một synthetic owner riêng, không đổi business/baseactor cũ; record `legal-fixture-isolation-20261008.json`. Rerun19affected cases có18PASS,1upload harness FAIL rồi narrow upload3PASS. Không trình bày raw19fail là lỗi ảnh/layout product.
3. Route.fetch proxy của harness làm sai multipart bytes/MIME: giữ `browser-upload-final-20261008-proxy-prior.json` HTTP400 (server validation đúng); gửi postDataBuffer và MIMEimage/png rõ ràng rồi HTTP201, không giảm validation.
4. Search API trả `displayName`, không phải `name`: giữ `final-live-20261008-harness-prior.json`, sửa assertion đúng schema, final10PASS.
5. Lỗi product referenced legal delete500 giữ ở `legal-live-20261008-before-fix.json`; đã sửa guard409, không hạ kỳ vọng.

### Những file/luồng mới so với checkpoint

Backend: `common/utils/name-search.*`, users explicit suspension DTO/service/controller/tests, notification pagination controller/service/spec, media reference guard/append order/tests, services workspace/media/search projection/spec, branch search, business document version history, privacy controller retired create endpoints; test slot policy giữ nguyên ý nghĩa assertion nhưng sửa inferenceTypeScript.

Web: featureAvailability + UnavailableFeature và routes/nav/notification target; bỏ PrivacySettings/CSS/client; AdminAudit high-level; AccountStatusControl; LegalDocuments authenticated preview/download/current/history; shared mediaUrl + HomeMedia/publicGallery/FileUpload/galleryWorkspace; shared nameSearch + staff/service/select; đưa helpers vào `npm test`. Bảo toàn các fileDOB/login/register/onboarding đang có.

Mobile: chỉ gỡ AccountScreen destructive data-request row và api/privacy.ts độc lập. Không sửa auth/booking/shared operations.

### Screenshot kiểm chứng đợt cuối

- `report-output/bugreport-remediation/final-owner0-persisted-service-image-375.png`
- `report-output/bugreport-remediation/final-owner0-real-upload-local-preview-375.png`
- `report-output/bugreport-remediation/final-owner0-real-upload-confirmed-gallery-375.png`
- `report-output/bugreport-remediation/final-platform_admin-legal-current-version-1440.png`
- `report-output/bugreport-remediation/actual-legal-pdf-download-375.png`
- `report-output/bugreport-remediation/actual-account-ui-locked-375.png`

PDF inline ở browser/headless có thể không render trang; có fallback tải đúng phiên bản. Đã kiểm chứng downloadbytes/type/version, không claim native PDFviewer PASS.

## Phạm vi chưa hoàn tất — lý do và điểm tiếp tục

- **Native mobile customer/staff/owner:** lượt này không có bản Metro/thiết bị được xác nhận cho source mới; chỉ typecheck. Không tự restart emulator/Metro hoặc dùng thiết bị cá nhân. Cần phiên native QA có nguồn/API endpoint xác nhận để chứng minh runtime.
- **Notification event matrix đầy đủ:** account status đã có transactional outbox + dedupe và tests existing worker/retry; QA runtime tắt background workers/external channels để tránh gửi batch tới dữ liệu có sẵn. Chưa xác minh end-to-end nhận/đọc/badge cho mọi review/branch/business/reassignment event. Cần runner deliver chỉ các outboxQA mới hoặc mock channel cóguard trước chạy worker.
- **Giấy tờ pháp lý/CCCD/mã số thuế:** model hiện chưa có discriminator loại chủ thể pháp lý/identifier rõ ràng. Không áp chung độ dài rồi gây reject dữ liệu lịch sử; cần mô hình này và nguồn chính thức hiện hành để hoàn thiện từng rule.
- **Storage production:** thiếu target persistent volume/deploy/backup được chỉ định. Local bytes sau APIrestartPASS không chứng minh redeploy/restore. Decoder/truncated-image và orphan recovery chưa được hoàn thiện; phải bổ sung decoder phù hợp và test crash riêng, không lấy signature-sniffPASS làm proof mọi ảnh đọc được.
- **Các search/form ngoài entrypoints đã sửa:** branch area/service-filter và những tìm kiếm mới/đặc thù cần tiếp tục audit; không claim mọi search/form đã chuẩn hóa.
- **Booking mọi biến thể/race:** entry/read routes và existing lifecycle/date-policy unitPASS; không tạo booking mới trong đợt này. Full reschedule/cancel/payment/overlap/concurrent lifecycle acceptance không được suy ra từ routePASS.

Không có migration/reset/delete lịch sử. Thay đổi suspension API cố ý không còn hỗ trợ request toggle chỉ córeason; mọi client đang dùng trong repo đã được cập nhật trạng thái đích. Để bật lại finance, chuyển flag và kiểm thử lại permission/workspace/data loaders; các implementation giữ nguyên. Backend audit/history vẫn hoạt động. Chưa pushGit.


## Tiếp tục theo yêu cầu c64cdae3 — harness, inventory và regression rộng

Đợt tiếp tục này không dùng76 PASS trước để chứng minh acceptance toàn hệ thống. Đã đọc lại git/status/diff, giữ các thay đổi hợp lệ.

### Harness mới

Source: `beauty-booking-web-main/beauty-booking-web-main/scripts/qa/browser-case.cjs` và `browser-case.test.cjs`. Mỗi case có role, route/action, startedAt/endedAt, phase, assertions, request/response attribution. API lỗi, JS/pageerror, console/network ngoài dự kiến làm FAIL/exit1. 401 chỉ cho phép đúng POST `/api/v1/auth/refresh` ở bootstrap của context mới chưa có cookie. HTTP200 background được giữ trong log nhưng không gán là lỗi. Không ignore403/404 theo mã chung.

8 unit checks của harness PASS. Browser negative controls trong file `harness-browser-negative-*.json` cho đúng verdict `FAIL / FAIL / PASS` khi chủ động inject503/pageerror/expected503; đây **chỉ là proof harness, không là product acceptance**. Legacy `browser-remaining-20261008.cjs` bị chặn acceptance mới bằngexit2; source cũ và evidence được giữ nguyên ở bảnlegacy.

### Kết quả actual browser mới

`strict-2026-10-08T05-04-05-935Z/results.json`:20/20 PASS, exit0 trên customer10/owner0/receptionist0/staff0/platform_admin. Chỉ kiểm chứng anonymous bootstrap, login đúng workspace/role, API/schema và notification data/empty thực sự trênUI375/1440. Có sourceSHA/head và run riêng. Chưa chứng minh booking writes, staff work lifecycle hoặc toàn bộ profile/forms.

HeaderQA x-forwarded-for chỉ được gắn cho API local. Một runner cũ gửi header toàncontext khiến Google Fonts preflight/CORS lỗi; rawfailedrun được giữ, sửa driver header scope, khôngignorefont errors.

### Regression backend rộng

Safety inventory tại `backend-suite-safety-20261008.json`:117spec trongsrc;7integration và1socket transport cầnreview. Ngoàisrc còn3unit security/policy suites. Broadrun đầu112suite:106PASS/6FAIL,1100PASS/9FAIL; giữ JSON/log nguyên.

Cácfail được phân loại và xử lý có căn cứ:
- OpenAPI chưa regenerate sau route thay đổi: generate lại theo controller hiện tại, giữ contract assertions.
- Manager migration bị so với permission được thêm ở migration10/06: kiểm tra chuỗiadditive, **không sửaSQL đãáp dụng**. Identity/resource/action/scope vàowner-onlydefaultgrant vẫnassert chặt; displaydescription historical kiểm riêng.
- Scopefixture thiếu branch.findUniqueOrThrow/findMine mới: bổ sung mock đúngsignature vàassert selfactor.
- Hold expiry/overlap snapshot chưa cóguard khôngexpire service đãrunning/completed, và running-overrun clause: giữ businessrules nguồn, thêmassert exactguard, giữ planned/legacy predicates.
- Staticserialization test bắt `user:true` trong **typealias**, không phải leak runtime đã xác nhận. Narrowtype CustomerBookingServiceView thành id/fullName/avatarMediaId; không thay trảdata thật thành fullUser.

Sau authfix bên dưới: `backend-unit-auth-final-20261008.json`:**114suite/1113test PASS**, exit0. Bao gồm sockettransport đãreview chỉlisten127.0.0.1:port0 + JWT thật, account/sessionstoremock.7DBintegration chưa chạy. Unitprocess dùng NODE_ENV=test vàDBURLloopbackport1 để không vô tình gọiDB thật. Typecheck/buildAPI đãPASS ở `auth-checks-20261008.json`.

### Lỗi sản phẩm mới đã tái hiện và sửa: mở lại/login trong cùng giây

Baseline scopedworker `outbox-0397d585-8a99-4c18-b630-95ff463e761c/results.json`: lock/open201, login200 rồi GETnotifications401 “Phiên đăng nhập đã bị thu hồi”. Regression determinist `revocation-precision-before-20261008.log` FAIL: verified session mới150ms saurevoke bị reject.

Rootcause: per-userblacklist lưu epochseconds, soJWTiat cùnggiây bằng<=. Fix `auth/token-blacklist.service.ts`: mốc mới epochmilliseconds, oldRedis seconds vẫnfence conservative toàngiây; timestamp phiên mới lấy từDB, không lấyclaimclient. `auth/jwt.strategy.ts`: verifySessionId/user/revoked/expiry rồisoDBsession.createdAt vớifence. Phiên cũ/vô hiệu vẫnreject, thiếuverifiedtimestamp fallbackconservative, corruptrecordfailclosed. Khôngmigration. Cachelegacy vẫncompatible; không giảm kiểm tra JWT/session.

### Worker/API/browser end-to-end cóscope thật

`outbox-885f0d63-842e-48f7-b119-5561739e4a9c/results.json`:**13check PASS, exit0**, gồm4strictbrowsercases. ChỉuserQA mới,2outbox từrealadminlock/open; tấtcảoutbox query/maintenance/transaction bịintersect với đúng2ID. Haiworker cùngdrain, retries không thêmduplicate; mỗioutboxSENT/attempt1/one notification. ReceiverAPI200/unread2, UI thấy2message, mark1read/persist qua reload, unread1, linkđúngcustomersecurity. Otherowner querykhông nhậnrows, foreignmark đúngcontract200/count0 vàDBrowisRead/readAtkhôngđổi. Không mặcđịnh404/403 khiendpoint được thiết kếupdateMany.

Khônginitperiodicworker, khôngglobaldrain, khôngemail/SMS/push. Cácfailedrun/startupfail/incorrectharness expectation/fontCORS giữnguyên, khôngmask bằngPASS mới. Eventmatrix mớichứngminh accountlock/open; review/branch/booking/reassignment/foreground cònpending.

### Native và cácđiểm tiếp tục

ADBSDK đãkiểmtra theoquyền explicit mới: `adb devices -l` trả danh sáchrỗng; khôngcóMetro8081listener. Native3vai trò BLOCKED vìkhôngcóthiếtbị/emulatorkếtnối; khôngboot/reset/installapp. Tiếptụcweb/API độc lập.

Inventory banđầu `docs/bugreport-systemwide-coverage.md` + `systemwide-inventory-20261008.json`:152route/navigation/form/worker rows,260endpoint và117srcspec. Đây làdiscovery, chưa đượcdùng làmcompletionpercentage. Cầngắn acceptance theo từngflow, đặc biệtbookingE2E/near-now/checkin/serviceactions/race, onboarding/reviewconcurrency, visiblePDF/imagefixtures, decoder/orphancleanup, validationpháp lý.

Checkpoint tiếp tục: harness đãsiết, broadregression xanh, authsame-secondbug đãfix/liveverified. Ưutiên tiếp theo realbooking/customer→owner/receptionist/staff vàwalkin; giữ paymentngoài phạmvi. Khôngpush, khôngresetDB, giữcácquyếtđịnh12/14/17.


## Đợt đặt lịch và tiếp nhận khách — checkpoint tiếp theo

Source vẫn trên `main`, HEAD `38c5fb68859135c9a8c458eb053d894a92eb97be`, có thay đổi chưa commit. Fingerprint cuối đợt tại `report-output/bugreport-remediation/source-booking-current.json`. Giữ nguyên các quyết định 12/14/17; không phát triển hoặc kiểm thử thanh toán.

### Luồng đặt lịch thực tế

- Tạo một customer QA mới, có email/phone verified như **prerequisite fixture**; không coi đây là kiểm thử đăng ký/OTP.
- Đi bằng UI: chi tiết dịch vụ công khai → CTA đặt dịch vụ → chuyên viên cụ thể → slot API thật hơn48h → liên hệ/consent → policy và price preview thật → xác nhận liên tiếp → success/reload.
- `booking-38764f5d-0bfa-4492-83a0-251b53c436d2/results.json`:6 case browser strict PASS,10 API/DB checks PASS, exit0. Chỉ một POST và một booking DB: **BB-2026-0100099 /5d1f2988-ba86-428d-b2eb-ec35a65f989a**, slot11/10/2026 08:00 Asia/Ho_Chi_Minh. Status ban đầu PENDING; UI nói đúng “Đã gửi yêu cầu”, không giả là đã xác nhận.
- Owner/receptionist/staff đọc đúng ID/code qua API; customer12 bị403. Owner xác nhận bằng UI đúng một lần, rồi hủy bằng UI đúng một lần. Không tạo lại booking khi runner thất bại sau commit.
- Receipt xác nhận200 ở run `booking-followup-075d2d76-3b67-4fa0-8507-390968ae1f43`; receipt hủy200 ở run `booking-followup-a672035d-b723-48c9-b133-aa93148c0b45`. Các run này vẫn giữ FAIL tổng thể do assertion/429 được ghi bên dưới, không sửa JSON thànhPASS.
- Readback cuối `booking-followup-4ff6e13a-3c2b-4bed-b8b3-fffd4675f40f/results.json`:9 browser cases cho3 vai trò +8 API/DB checks PASS, exit0. Booking và item vẫn tồn tại ở trạng thái CANCELLED; status history có đúng1 CONFIRMED và1 CANCELLED. Slot provider ban đầu được mở lại. Đây là **owner cancellation**, chưa phải customer cancel/reschedule acceptance.

### Root cause và thay đổi đã kiểm chứng

**Scheduler origin và request burst**

Calendar/list dùng VITE_WS_URL hoặc frontend origin; QA đã trỏ API3014 nhưng WS vẫn3000 nên console có connection refused. Thêm shared `socketEndpoint.js`: explicit WS URL giữ ưu tiên, khi không cấu hình thì lấy origin API. QA runtime khai báo cả API vàWS3014; không ignore lỗi kết nối.

Khi mở/cập nhật lịch nhiều chi nhánh, một ca ghi nhận **97 HTTP scheduler request trong2,264s**,51×200 và46×429. Sửa:
- GET `/bookings/scheduler/batch`, tối đa50 branch và92 ngày mỗi query, UUID/date validation. Authorize toàn bộ branch trước đọc bất kỳ payload, sau đó delegate từng branch sang scoped implementation cũ (giữ staff projection).
- UI batch các branch, chia chunk50; không nâng hoặc tắt throttler.
- Coalescer75ms cho socket invalidation, gộp burst và giữ một trailing refresh nếu dữ liệu đổi khi fetch còn chạy; cleanup/auth failure bỏ hàng đợi scope cũ.
- Calendar fence và clear dữ liệu ngay khi token/branch context đổi.

Unit batch8 PASS; coalescer/scheduler-events9 PASS. Live foreign tenant trong batch403. Readback điều hướng cuối có owner6, receptionist5, staff5 request, tất cả200, không pageerror/429. Đây là phép kiểm ở giai đoạn readback; không trình bày97→6 như benchmark cùng một thao tác mutation. Live burst mutation mới sau bản sửa còn cần acceptance riêng.

**Walk-in thất bại để lại shadow user**

`walkin-closed-e5b71f7a-0e58-4641-af76-e0654b125be3/results.json`: receptionist đăng nhập200, closed-day slots rỗng, POST booking400 đúng lỗi ngoài giờ, bookingDelta0 nhưngshadowUserDelta1. Controller lưu user/customer trước availability và booking transaction.

Sửa `BookingsController.create`: chỉ cấp ID server và descriptor; `BookingsService.create` tạo guest user/customer trong **cùng Serializable transaction** với booking. Guest allocation yêu cầu authorized counter context và matching customer ID; không áp cho customer trực tuyến.

Pricing trước transaction cần biết guest chưa insert: `PricingEngineService.quote` nhận server-only allocation context matching đúng ID. Existing profile vẫn là nguồn thật; normal missing customer vẫn reject. Guest mới có DOB unknown/history empty đúng với profile sẽ được tạo, không giả dữ liệu hoặc bỏ promotion/voucher eligibility.

Regression atomic trước sửa FAIL, sau sửa PASS. Lượt trung gian trả400 “Khách hàng không tồn tại” đã phát hiện là **không đúng tình huống ngoài giờ** dù harness lúc đó nhận status400; artifact được giữ và không dùng làm acceptance. Harness nay bắt đúng message “Giờ đặt nằm ngoài giờ mở cửa của chi nhánh”.

- `walkin-closed-8462d00e-324c-4438-8b8e-f360739defae/results.json`:5/5 PASS, đúng400 ngoài giờ, bookingDelta0/shadowUserDelta0.
- Vì thời gian thực hiện đang ngoài giờ cơ sở gốc, chưa claim walk-in hiện tại/check-in/start/complete thành công. Không sửa giờ cơ sở để ép test.
- Kiểm thử positive đường **PHONE** hợp lệ trong giờ mở cửa tương lai: `counter-phone-b1aaf6df-6c32-4840-b25c-f782a3c22b80/results.json`,8/8 API/DB checks PASS. Một shadow guest và booking được commit cùng nhau: **BB-2026-0100100 /99433bb8-2b0c-4be7-a6f9-8aed967f94dd**, sau đó receptionist hủy đúng record200. Guest/history giữ lại, payment count0. Không gọi đây là walk-in tự nhiên hoặc UI PHONE đã được kiểm thử.

**Thao tác terminal không khả dụng**

Screenshot CANCELLED vẫn có nút “Thêm dịch vụ phát sinh”, trong khi backend đã enforce409 cho terminal booking. UI AddItemOperation nay dùng đúng allowed states PENDING/CONFIRMED/CHECKED_IN/IN_PROGRESS. Readback strict xác nhận không có nút add/cancel lại trên terminal; không sửa backend để cho phép thao tác sai.

### Kết quả kiểm thử cuối đợt

- Backend safe regression: `backend-counter-final.json`:**116 suites /1125 tests PASS**. Gồm reviewed loopback socket transport;7 DB integration tiếp tục excluded. Typecheck/build backend PASS ở `walkin-pricing-checks.json`.
- Web: **121 tests PASS** (`web-booking-fixes-tests.log`); build PASS, gồm build sau terminal UI fix (`web-terminal-build-status.json`).
- Broker/allocation target regressions và live outcomes ghi riêng như trên; không cộng chúng thành tỷ lệ hoàn thành sản phẩm.
- Không reset/reseed/drop bảng. Các orphan baseline của QA được giữ làm evidence; không bulk delete user. Fixture base hours/policies/profiles/mappings không bị sửa; chỉ thêm dữ liệu QA và thao tác trên hai booking mới của đợt này.

### Sai lệch harness đã xử lý, giữ nguyên log thất bại

1. `waitForLoadState(networkidle)` không đủ cho SPA→confirm: bản đầu0 POST/0 booking, nút chưaready. Driver đợi policy/price responses và button enabled; không bỏ policy.
2. Nhãn lịch PENDING trên scheduler là “Mới”; driver ban đầu dùng “Chờ xác nhận”.
3. Drawer có chủ đích đóng sau `onUpdated`; không buộc nó còn hiện ngay saumutation. Reconcile DB và reload đúng ID; marker wx ngăn replay confirm/cancel.
4. Một startup run kiểm tra trước API ready: giữ artifact checks0/exit1, thêm readiness guard.
5. Intermediate closed-hours run chỉ nhận400 bất kỳ bị đánh **INVALID_DOMAIN_ACCEPTANCE** vì customer-not-found khác outside-hours. Bản đúng sau đó xác minh status+reason+DB deltas.

### Đường dẫn ảnh thực tế

- `booking-38764f5d-0bfa-4492-83a0-251b53c436d2/success-reload-375.png`
- `booking-followup-4ff6e13a-3c2b-4bed-b8b3-fffd4675f40f/owner0-cancelled.png`
- `booking-followup-4ff6e13a-3c2b-4bed-b8b3-fffd4675f40f/receptionist0-cancelled.png`
- `booking-followup-4ff6e13a-3c2b-4bed-b8b3-fffd4675f40f/staff0-cancelled.png`

Source provenance: các run booking mới kể từ source-version helper có fingerprint đầu run. Run producer đầu và vài follow-up lịch sử chỉ có timestamp/script/evidence, chưa có full application hash tại thời điểm chạy; không gán hash hiện tại cho chúng. Fingerprint cuối đợt là snapshot hiện tại, không retroactively chứng minh source lịch sử.

### Điểm tiếp tục chính xác

1. Positive walk-in/check-in/START/COMPLETE và late/overrun: cần fixture giờ hoạt động hợp lệ tại thời gian chạy hoặc chờ cửa sổ cơ sở; có thể dựng fixture hoàn toàn mới có cấu hình rõ, không đổi cơ sở gốc. Chưa được phép suy ra từ PHONE future booking.
2. Customer reschedule/cancel/rebook, two-customer slot race, unknown-commit timeout replay, branch/staff/service switch race và reconnect/held-view proof còn cần actual acceptance.
3. Onboarding/register/review concurrency, PDF/visible image fixtures và decoder/orphan storage, legal classification và native runtime vẫn còn trong backlog. Native cần thiết bị development đã xác nhận.
4. Không tạo lại/hủy lại BB0100099 hoặcBB0100100. Cả hai đãCANCELLED; marker/receipt/history được giữ. APIQA3014 vàweb5176 chạy,8worker vẫndisabled; khôngpush.


## Tiếp tục 09/10/2026 — PDF đọc được, ảnh đủ nội dung và storage/search/context

### Source và phạm vi

Repo được kiểm tra trước sửa; giữ các thay đổi hợp lệ từ checkpoint. HEAD vẫn `38c5fb68859135c9a8c458eb053d894a92eb97be`, chưa commit/push. Source SHA256 cuối (API/web/mobile src, 598 file): `2ca699f204537d392d293953f0de15547912a3269561266d9dcbefc675630776`. SHA package/lockfile và bằng chứng chọn trong `report-output/bugreport-remediation/delivery-media-storage-20261009.json`.

Đây là đợt BugReport remediation. Các ảnh/PDF mới là **fixture QA có nhãn**, không phải ảnh doanh nghiệp thật, giấy tờ thật hoặc số lượng ảnh AI đã hoàn thành toàn website. Mục12 vẫn bỏ UI/luồng; mục14 vẫn ẩn và giữ code/data; mục17 vẫn không có chi tiết audit thô, backend audit giữ nguyên. Thanh toán ngoài phạm vi.

### PDF riêng tư — thực sự đọc nội dung thay cho khung iframe xám

- Thêm `PdfPreview.jsx` (PDF.js lazy import + worker local). Canvas từng trang responsive theo chiều rộng; chuyển trang; văn bản trích xuất để đọc dễ hơn; lỗi/password có thông báo và nút tải file đúng phiên bản ở component cha. Không đổi endpoint hoặc visibility PRIVATE để chữa preview.
- `LegalDocuments.jsx` vẫn tải authenticated blob của đúng media ID hiện hành/lịch sử; giữ sequence fence và revoke object URL. Không dùng bản lịch sử thay cho currentVersion thiếu file.
- Thêm dependency/lockfile `pdfjs-dist`6.4.299. Bundle PDF chỉ nạp khi mở tài liệu; PDF chunk riêng khoảng484kB trước gzip, không đưa vào initial public bundle.
- Tạo **hai PDF mẫu, mỗi file hai trang**, ghi rõ không có giá trị pháp lý và `QA-V1-P1/P2`, `QA-V2-P1/P2`; render bằng Poppler và xem hình trước upload. Chỉ một doanh nghiệp nháp QA mới và hai media/document versions mới; không sửa hồ sơ base.
- Run cuối `pdf-readable-ac1cff4d-25ef-4541-8bb9-280e0b34aa54/results.json`: **22 browser cases +11 API/DB checks PASS**, exit0. Bốn width375/768/1024/1440; từng trang đúng nhãn phiên bản, canvas có pixels nội dung/màu, văn bản tương ứng và không lẫn bản cũ. Admin bytes khớp file; unrelated owner403, public404; versions vẫn còn2.
- Run tạo fixture trước đó `pdf-readable-ef9d7346-cd37-41e7-9644-129c677eaf8c/results.json`13 API/DB checks +22 browser cases PASS; không cộng lại thành44 ca sản phẩm khác nhau.
- Screenshot cuối: `pdf-readable-ac1cff4d-25ef-4541-8bb9-280e0b34aa54/pdf-v2-p1-1440.png`, `.../pdf-v1-p2-375.png`. Đã nhìn ảnh desktop/mobile, chữ/nhãn hiện rõ. Mobile có nội dung dạng văn bản cho PDF nhiều chữ.
- Giới hạn: chưa chạy acceptance PDF encrypted/corrupt/scan-only; backend hiện chưa kiểm tra đầy đủ cấu trúc PDF, vẫn kiểm tra MIME/ext/header/size. Không suy từ sample hợp lệ rằng mọi PDF đều mở được.

### Ảnh upload — decode trước ghi, đủ nội dung và đúng entity

- `image-content.ts`: Sharp0.35.5, `failOn:warning`; đọc metadata và **decode toàn bộ bằng stats()**, vì magic bytes/metadata đơn thuần chưa đủ. Reject file không giải mã được, quá40triệu pixel, cạnh quá10.000px hoặc nhiều frame. `MediaService.upload` kiểm size khớp buffer, MIME/ext; authorize scope trước decode, decode trước filesystem/DB write. Không đổi ảnh người dùng hoặc resize file gốc ngầm.
- `media-storage.spec.ts` dùng temp dir riêng: PNG header-only, truncated, MIME/ext/size sai, excessive pixels/side; valid JPEG/PNG/WebP/AVIF; failure DB sau ghi gỡ đúng file mới và giữ file trước;6 upload đồng thời keys khác nhau; đọc từ MediaService mới sau reinitialization. Đây là unit + filesystem với mocked DB, không gọi là DB E2E.
- Fixture service QA mới: catalog `a379c0af-03c9-4308-abff-8a1890695477`, offering `2a945241-d7e3-467e-8cd4-71aedaafd671`, đúng branch/business base. Không thay base staff/profile/hours/mappings. Ba PNG mẫu có nhãn LANDSCAPE2400×1400, PORTRAIT1400×2400, LARGE4096×2304; hai upload API và một upload UI. Không phải chân dung/cơ sở/kết quả điều trị giả.
- `media-readable-58c4eae0-e0e3-4290-96fe-018079874a9e/results.json`: **15 API/DB checks +11 browser cases PASS**, exit0. Corrupt API400 và zero row delta; cross-owner upload403; gallery sau reload đúng3 media IDs/order/dimensions ở bốn width; public service thật tải ảnh gốc đúng entity. Gỡ **chỉ ảnh QA phụ** bằng UI200; hai ảnh còn, primary không đổi. Portrait gỡ khỏi mới tạo, không xóa lịch sử/phần dữ liệu của entity khác.
- Một upload LARGE đã commit ở run chưa hoàn tất; marker media ID dùng để readback, **không gửi lần thứ hai**. Vì run đó bị ngắt/HMR và thiếu final JSON, không chấm PASS toàn run. Ca final dùng receipt/DB của cùng record và scoped UI reads.
- Screenshot `media-readable-58c4eae0-e0e3-4290-96fe-018079874a9e/owner-gallery-1440.png`, `.../owner-gallery-375.png`, `.../public-service-375.png`. Đã xem crop desktop/mobile. Public screenshots là viewport có timeout; không thay bằng mock hoặc gọi ảnh kỹ thuật QA là ảnh nội dung website đã hoàn thiện.

### Lỗi mới: hồ sơ nháp mới làm mất workspace đang hoạt động

Tạo PDF fixture nháp của cùng owner đã tái hiện route `/salon/services` chuyển vào onboarding dù session thuộc doanh nghiệp APPROVED. `BusinessOnboardingService.findMine` chỉ lọc owner và lấy createdAt mới nhất, bỏ `user.businessId` server-validated. Các UI gates/nav tin status của kết quả đó.

- Sửa mine thêm exact selected business ID **và vẫn giữ ownerId/deletedAt constraints**. Owner mới chưa có selected business giữ luồng onboarding cũ. Foreign selected ID không đọc được dữ liệu owner khác.
- `ApprovedBusinessGate`, `BusinessOnboardingRoute`, AppShell reload/cleanup khi businessId đổi; giữ active-request cleanup tránh apply kết quả scope cũ.
- Ba regression context + existing onboarding suite PASS. API final xác nhận trả business base APPROVED, không trả draft QA mới; owner browser mở được services/gallery và public sau reload. Chưa claim đã test toàn bộ UI đổi doanh nghiệp hoặc manager onboarding.

### Tìm kiếm khu vực/dịch vụ — trước pagination và không phá exact filters

- `BranchesService.findAll`: fold tên district/province và service bằng shared SQL translation, parameterized LIKE pattern đã escape; area kết hợp districtId exact bằng AND. Service text kết hợp category/status/price ở cùng matched-service filter trước skip/take; không có match giữ `in:[]`, không bỏ điều kiện.
- `findPublicServices`: lookup tên không dấu ở exact branch rồi giữ ACTIVE/deletedAt/category cùngwhere cho page vàcount. BookingStep1 dùng shared normalize cho tên/địa chỉ branch và tên service; ID/code không bị fold.
- API thật bắt được **500 do query mới ép text branch_id sang uuid**. Bỏ cast; giữ log `filter-live-before-sql-type-fix.json`, regression kiểm parameter branchId và không thêm cast sai. Không che failure bằng mock/đổi business rule.
- `filter-live-1791557058420.json`: **7/7 PASS** sau compiled API restart; unaccented/accented service trả cùngIDs, exact branch present; service pagination total1, unknown total0; area/service impossible intersection empty; mine correct selected business. Positive area+district+service case **NOT_RUN** vì branch fixture base có districtId=null, không sửa base address để ép test đạt. Combination giữ exact filters được unit-test; chưa coi đó là positive UI/API acceptance toàn bộ địa bàn.

### Storage local — bounded dry-run và backup/restore file QA

- `storage-inventory.ts` + `scripts/audit-media-storage.ts`: **DRY_RUN_ONLY**, không có delete/unlink. Require absolute root, bounded prefix, cutoff, test DB matching QA_DATABASE; không follow symlink và reject traversal. Chỉ query storageKey namespace; phát hiện old untracked, fresh untracked giữ lại, referenced missing; không tự dọn.
- Unit tạo directory riêng: nhận old orphan/fresh/referenced/missing đúng, file ngoài scope và file orphan vẫn nguyên; traversal/empty prefix reject. Một test PASS.
- Live `storage-inventory-live.json`: namespaceQA `2026/10`, cutoff24h, **56 files scanned /0 orphan candidates /0 missing references** sau khi gỡ portrait QA. Đợt trước gỡ có57; không dùng57 làm số ảnh nội dung hoàn thành. Không có file thật nào bị cleanup.
- `media-backup-d489efce-6bdf-48db-83cc-33a20cd3b090/results.json`: **12 checks PASS**; chỉ4 file mới có label QA (2 PDF,2 ảnh còn lại), copy sang backup rồi restore ở directory mới và hash khớp; public API đọc bytes sau process restart khớp; secondary vẫn removed. Không overwrite hoặc restore vào upload source. Đây là kiểm tra backup/restore **bytes file**, không phải DB snapshot restore hoặc redeploy production.

### Hồi quy cuối và giới hạn còn lại

- Backend `backend-media-regression.json`: **120 suites /1142 tests PASS**, exit0; danh sách116 suites đã được review từ đợt trước cộng4 mới, includes reviewed socket loopback. NODE_ENV=test, DATABASE_URL trỏ loopbackport1 không thể chạmDB; **7 DB integration suites không chạy**. Không gọi đây là full system E2E.
- Typecheck/build API PASS (`media-final-api-status.json`); web **121 tests/build PASS** (`media-gate-web-status.json`). Diff-check PASS; CRLF warnings không phải whitespace failures. Không reset/reseed/drop hoặc sửa historical schema.
- Bổ sung Sharp/PDF.js có package +lockfile. npm install có audit findings của dependency tree (API24/web17 ở lúc cài), chưa chạy audit fix/force vì ngoài scoped remediation; không kết luận tất cả là mới phát sinh hoặc đã security-audit tree.
- API QA3014/process3132 và Vite5176/process23808 đang chạy tại lúc bàn giao;8 workers/email tắt theo runtime guard. Không chạy global outbox delivery hoặc gửi bên ngoài.
- Native: adb danh sách thiết bị trống, Metro8081 không có listener; **BLOCKED_NO_CONNECTED_DEVELOPMENT_DEVICE**, không lấy viewport375 làm native acceptance.
- Các raw failures giữ nguyên: API chưa listen trước first PDF run; catalog contract `branchOfferings` vs `branchAvailability` driver; wrong searchbox locator; onboarding draft bug; incomplete/HMR media run; SQL500; filter report detail.status collision đã đổi thành businessStatus và chạy lại final7PASS. Không lấy PASS trước đó che FAIL mới hoặc sửa JSON cũ thànhPASS.

Phạm vi toàn BugReport **chưa hoàn tất**. Tiếp tục ưu tiên: natural walk-in/check-in/START/COMPLETE và late/overrun; customer đổi/hủy/đặt lại +slot race/unknown commit/reconnect; toàn onboarding/review concurrent và giấy tờ lỗi; notification producer matrix ngoàilock/open; pháp lý CCCD/tax type/official source; positive area filters với dataset có địa bàn; native thật khi device có sẵn. Production DB restore/redeploy chưa có target; file local checks độc lập đã làm như trên.


## Bổ sung cùng source 09/10 — lỗi preview và walk-in tự nhiên

Source application giữ nguyên SHA `2ca699f204537d392d293953f0de15547912a3269561266d9dcbefc675630776`; chỉ thêm runner/evidence và cập nhật MD sau hồi quy120/1142. Không cần chạy lại build chỉ vì thêm báo cáo/script QA.

### Negative PDF UI rõ phạm vi

`pdf-fallback-92f37aeb-ea57-439e-9e5f-763807b8d999/results.json`:4 browser cases PASS (bootstrap/login và controlled corrupt preview ở375/1440). Driver fetch tài liệu authorized thật200 rồi **chủ động thay nội dung response** thành PDF cắt cụt. UI hiển thị không xem trước được, canvas ẩn, nút tải bản đang chọn rõ ràng; không còn khung trống giả đang hoạt động. Đây là proof **xử lý lỗi frontend**, không gọi payload mock là PDF thực hợp lệ, backend validation hoặc sự cố mạng production. PDF encrypted/scan-only vẫn chưa có acceptance.

### Natural walk-in/check-in/STAFF START/COMPLETE

Vì branch base đóng cửa lúc thử, tạo prerequisite **chi nhánh QA mới, staff QA mới và offering mới**, cùng business base đang APPROVED; giờ hoạt động riêng00:00–23:59, allowWalkIn/counter=true, lead0, duration30 đúng minimum policy. Prerequisite seed có status/review APPROVED/ACTIVE; **không claim luồng duyệt branch/onboarding nhân viên đã test**. Không sửa working hours, policy, staff profiles hoặc mappings của base.

- `walkin-natural-5dce5023-86bb-4328-8466-fa5ec4e1a14a/results.json`:**21/21 actual API/DB checks PASS**, exit0.
- Một booking mới **BB-2026-0100101 /d5496396-01c8-4db8-9526-caad5cb1c7fb**, item `103f443c-4fdf-457f-9c79-721f6bb07af6`. WALK_IN201 tự CONFIRMED theo rule hiện hành. Same-key same-payload retry201 trả cùng ID, DB chỉ1 guest/booking. Lần thử same staff/slot khác guest bị409; zero guest orphan và không thêm booking.
- STAFF thật đăng nhập bằng fixture mới; START trước check-in409. Chọn next-minute slot từ counter-slots thật; **chờ đồng hồ15.252ms** rồi owner check-in200. Không update booking status/timestamps trực tiếp trong DB, không backdate.
- Assigned STAFF personal item endpoint200 cho CHECKED_IN/canStart=true; START200→IN_PROGRESS; COMPLETE200→COMPLETED, revision tăng. Stale repeated COMPLETE409. Actual projection lấy audit server clicks và scheduled interval giữ nguyên.
- Dự kiến09/10/2026 **21:59–22:29 Asia/Ho_Chi_Minh**. Actual START `2026-10-09T14:59:01.075Z`, COMPLETE `2026-10-09T14:59:01.284Z` (cách209ms). Đây là **lifecycle QA mô phỏng**, không có dịch vụ làm đẹp thật; không suy actual end=start+30phút.
- Parent COMPLETE409 đúng gate unpaid: “Dịch vụ tiêu chuẩn chỉ được hoàn thành khi số dư thanh toán đã đủ”. Parent còn IN_PROGRESS, item COMPLETED, zero payments/amount adjustments. Không thanh toán hoặc ép parentCOMPLETED để lấy PASS; dữ liệu/history giữ lại để readback.
- Snapshot hash base branch/hours/policy/staff/mapping/status trước/sau khớp. Không reset/reseed/drop hoặc xóa dữ liệu base/historical.
- `walkin-read-ad122e44-6ba1-4d57-95fa-c123f9a2bd20/results.json`:**6 browser read-only cases PASS**, exact owner detail at375/768/1024/1440. API body trùng ID/item/actual timestamps; UI label dự kiến/thực tế riêng; không có horizontal overflow. Đã nhìn screenshot `owner-natural-timing-1440.png` và `owner-natural-timing-375.png`. Không claim STAFF native/browser UI vì STAFF source fixture chỉ được kiểm API.

Các raw harness failures vẫn giữ: bootstrap dùng SalonMemberRole.STAFF sai enum (transaction rollback toàn bộ, invocation/hash được redact); fixture duration5 phút trái minimum30 dẫn create400, zerobooking/guest (không phải lý do đổi minimum policy). Dùng guard xác minh0 rows trước retry/fresh fixture, giữ các entity QA đã tạo thay vì xóa lịch sử. Hai branch fixture mới có nhãn QA còn trong QA DB; branch duration5 không dùng làm positive fixture. Read-only helper đầu tìm nút “Dịch vụ” trong khi drawer là section luôn hiện: fail được giữ `walkin-read-3538dac2-1864-4436-b8da-d20912b22689`; sửa helper, không sửa UI/assertion nghiệp vụ để che lỗi. Không replay POST đã commit.

**Khoảng trống cập nhật:** natural positive counter/check-in/start/complete đã có proof API và owner UI; chưa phải lễ tân walk-in UI/native, chưa có thời gian chạy quá giờ thật. Same-key retry và occupied-slot rejection đã test, **chưa phải hai online customer race đồng thời, response-lost-after-commit hay held reconnect**. Customer đổi/hủy/đặt lại, complete onboarding/admin review races, notification matrix và legal identifiers vẫn tiếp tục chưa kiểm đủ. Full BugReport scope chưa hoàn tất.

## Tiếp tục 09/10 — khách đổi/hủy/đặt lại, race và realtime

Source đã kiểm tra: HEAD `38c5fb68859135c9a8c458eb053d894a92eb97be`, dirty src SHA `a2967e88784bcd91d4989b80da5847d484996d92dd57d0ac0336ea4bd73a1e22` (600 file API/web/mobile src). Không reset/revert thay đổi trước.

Lỗi mới và sửa:
- **CUSTOMER-HELD-STALE**: owner PATCH200/DB CONFIRMED nhưng trang chi tiết khách đang giữ nguyên vẫn “Chờ xác nhận” sau10s. Baseline `customer-lifecycle-6007ce54-3efc-4782-826e-ebc68b489ef4/results.json` FAIL giữ nguyên. Hai trang khách chỉ nghe focus/visibility; bổ sung socket invalidation→scoped API refetch + reconnect/resync/online; fence theo user/token, gỡ listener/lease khi scope thay đổi. List dùng latest-request thay cho các Promise không có fence.
- **CUSTOMER-RESCHEDULE-STAFF-CONTRACT**: projection chi tiết khách có `staff.id` nhưng không có `staffId`, trong khi RescheduleModal đọc `staffId`; guard baseline chặn request thiếu ID trước khi ghi. Không tuyên bố backend đã đặt nhầm staff: request bị guard chặn. Thêm scalar staffId vốn đã được phép đọc qua nested staff, regression controller giữ snapshot và ID.

Selected live final: `customer-lifecycle-88c3c3ca-44f6-4cc2-9fa1-4a8069da00d6/results.json`: **15 browser +10 API/DB checks PASS**, exit0.
Hai khách QA mới/verified DB là prerequisite, không phải đăng ký/OTP acceptance. Hai POST thật chạy đồng thời cùngstaff/slot nhận đúng201/409; DB chỉ1booking; loser403. BB0100106→owner confirm→khách held tự cập nhật→khách UI yêu cầu đổi13/10 08:00→owner APIapprove→held detail tự cập nhật→khách tự hủy→đặt lại qua wizard một lần BB0100107. DB giữ2 lịch khácUUID; cuối2CANCELLED, không payment. Bốn width375/768/1024/1440 kiểm tra cancelled history/code/no horizontal overflow, screenshot đã xem375+1440.

Reconnect case trong selected final có browser setOffline→owner confirm→online và cùnglist cập nhật; offline chỉ42ms, **chưa chứng minh socket đã thực sự ngắt**. Không lấy khoảng53ms làm latency/native recovery. Cần bounded offline thật +failed request/wire/readback để khép kín transport recovery.

Failures khác giữ nguyên:
- `cf76977d-f106-4fd8-9dec-e8aba96f6743`: harness đọc main đúng lúc socketconnect refetch (UI code đã hiện sau đó), không thêm productbug.
- `2fa7d0a9-d4a4-4a30-8163-046243eadfa1`: đổi/hủy/heldsync PASS, rebooking201 commit nhưng assertion ngay saureload thiếuwait. Không tạo lại booking đãcommit.
- `lifecycle-reconcile.json` cleanup guard FAIL tại rebook note trống (đúng vì wizard mới không copy note cũ). Continuation `lifecycle-reconcile-continuation.json`4rows PASS: chỉknown receipt/user/branch, bỏquaCANCELLED; hủy3 knownpending/confirmed bằngAPI, giữdata/history; không xóa.
Các runner có wx marker trướcwrite và receipt trướcassertion, không dùng failure làm lý do blindretry mutation.

Validation: customer refresh hook5/5 (actual hook code qua VM +EventEmitter, không native/browser); controller12/12; APItypecheck/buildPASS; web126/126+buildPASS `customer-final-web-status.json`. 120suites1142 backend trước đó vẫn là historical overlay; đợt này backend chỉselectedcontroller đã chạy lại.

Screenshots dưới cùng final folder: `held-confirm-375.png`, `held-rescheduled-375.png`, `rebook-success-375.png`, `reconnect-confirmed-375.png`, `cancelled-history-{375,768,1024,1440}.png`. Fullpage screenshot có fixed header/nav tại vị trí viewport lúccapture; không dùng ảnhfullpage này để suy luận header che nội dung khi cuộn.

Phần còn tiếp tục: sustained offline/lostresponse vàcontext-switch; legalclassification/tax/CCCD; fulldraft-review lifecycle/outbox producers; native hiện thiếu connecteddevelopmentdevice; DB integration7chưa chạy. Thanh toán vẫnEXCLUDED.



## Checkpoint 10/10/2026 — transport, pháp nhân, xét duyệt và thông báo

Các mục trước là bằng chứng lịch sử, không phải trạng thái hoàn tất toàn sản phẩm. Giữ nguyên HEAD `38c5fb68859135c9a8c458eb053d894a92eb97be` và toàn bộ thay đổi hợp lệ chưa commit. Không push, reset, seed lại, drop bảng hoặc xóa lịch sử. Thanh toán tiếp tục **EXCLUDED**. Data-request UI/flow và raw audit-detail UI tiếp tục bị gỡ; finance UI tiếp tục ẩn, code/data vẫn giữ.

### Mất phản hồi sau commit và reconnect thật trong browser

Runner `scripts/qa/booking-transport.cjs` đặt marker độc quyền trước mutation, ghi receipt trước assertion. Final `transport-331cc13c-2caf-4bc8-b633-b14522ec933b/results.json`: **12 browser cases +4 API/DB checks PASS**. Backend đã commit201 rồi harness mới cắt phản hồi browser. UI báo kết quả chưa xác định, khóa xác nhận mới; reload giữ journal. Replay gửi cùng idempotency key và body hash, nhận cùng UUID; DB vẫn đúng một booking. Đây là controlled network fault trên backend thật, không phải API mock.

Booking QA `c5a36d81-46f2-4a88-8dba-de67b86dd6ec` / BB-2026-0100109 đã hủy có lịch sử, không xóa. Browser offline có navigator=false và GET thật bị ERR_INTERNET_DISCONNECTED, owner xác nhận đúng UUID trong thời gian đó. Sau khoảng2,6giây mất mạng, khôi phục mạng làm detail đang giữ cập nhật CONFIRMED, không input/reload/navigation. Không suy ra SLA production hoặc native, không chứng minh idempotency bền vững qua API restart.

Raw initial `transport-2e67303c-a8bf-40df-b65e-fd93f8b1b979` giữ nguyên: lỗi harness chưa allowlist đúng WebSocket console offline, không phải product defect. Cleanup guard chỉ hủy booking QA đã có receipt, không tạo lại. Screenshot final: `unknown-after-commit-375.png`, `same-booking-after-replay-375.png`, `held-offline-pending-375.png`, `held-recovered-375.png`, cancelled history375/1440. Đã xem ảnh recovered375.

### Phân loại pháp lý và validation

Backend `business/legal-registration.ts` cung cấp catalog riêng với service category: tổ chức10, đơn vị phụ thuộc10-3, hộ/cá nhân Việt Nam12, cá nhân nước ngoài chưa có định danh Việt Nam10, đơn vị phụ thuộc giữ mã10 theo ngoại lệ chuyển tiếp. Loại giấy tờ người đại diện là lựa chọn riêng: định danh Việt Nam12 hoặc hộ chiếu nước ngoài; không ép hộ chiếu vào regex CCCD.

Nguồn chính thức: [TT90/2026/TT-BTC, Điều5](https://chinhphu.vn/?classid=1&docid=218839&pageid=27160&typegroupid=6), [Luật108/2025/QH15, Điều11](https://vanban.chinhphu.vn/?classid=1&docid=216541&orggroupid=1&pageid=27160), [Luật Căn cước, Điều12](https://xaydungchinhsach.chinhphu.vn/toan-van-luat-can-cuoc-119240130064813615.htm). Hai nguồn thuế có hiệu lực01/07/2026; không dùng TT86 đã bị thay thế như quy định hiện hành. Đã đọc trang bản ký liên quan, PDF nguồn lưu ignored trong evidence.

Chỉ kiểm định dạng theo loại đã chọn: không xác minh người thật, mã đã cấp hay thuật toán check digit. Không đoán loại pháp lý từ businessType, role hoặc độ dài dữ liệu cũ. Dữ liệu cũ chưa phân loại vẫn đọc/lưu nguyên trạng; gửi hồ sơ phải bổ sung loại. Dữ liệu mới/sửa sai bị400 trước write. Ngoại lệ mã10 chuyển tiếp bắt buộc TAX_DOCUMENT và xét duyệt thủ công dù cấu hình autoapprove bật.

Classification lưu additive trong onboardingData JSON, không SQL migration/backfill hay tự relabel dữ liệu cũ. Rollback code cũ có thể bỏ qua các khóa JSON mới nhưng không nên gỡ validation để cho hồ sơ mới sai đi qua; giữ nguyên lịch sử và cần đánh giá tương thích trước deploy rollback. Chưa có migration tách pháp nhân độc lập theo business.

**Giới hạn kiến trúc:** company/tax/identity vẫn nằm ở owner profile dùng chung. Đã thêm row lock, kiểm expected value và guard409 `SHARED_LEGAL_IDENTITY_LOCKED` để draft khác không âm thầm sửa hồ sơ đã gửi/duyệt. UI giải thích cần xử lý thay đổi pháp nhân riêng. Đây là bảo vệ dữ liệu, chưa phải hỗ trợ nhiều pháp nhân độc lập cho một owner.

### Luồng xét duyệt, phiên bản giấy tờ và thông báo

Reproduced source/unit: UNKNOWN decision và REQUEST_INFO/REJECT lý do trắng từng đi qua guard; baseline3FAIL lưu `business-review-input-baseline.json`. Đã chặn trước transaction, regressionPASS. Backend review vẫn CAS; hai admin cạnh tranh chỉ một quyết định được lưu.

Baseline actual DB `business-review-missing-notification-baseline.json`: hai review events nhưng zero outbox/notification cho owner. Đã bổ sung review-result producer trong cùng transaction với state/history/document decisions; owner hiện tại active được dedup, target BUSINESS và `/salon/onboarding`, key theo event+recipient. Rollback không tạo thông báo thành công. Autoapprove cũng dùng producer, có unit proof; không claim đã live autoapprove.

Selected live `legal-flow-3cd0898f-5e14-4ccc-a6e2-1cf07fc1d894/results.json`: **30 API/DB checks +9 strict browser cases PASS**. Business QA `c9160972-9cf7-4f1f-8f61-9deba89bb4bd`: legacy draft→classification→upload→PENDING_REVIEW→REQUEST_INFO→thay giấy phép v2 giữ v1→resubmit→APPROVE/REJECT cạnh tranh200/409→APPROVED. Invalid API và UI không mutation; unrelated owner403, private PDF403; new conflicting draft409/profile unchanged. Owner được seed verified làm prerequisite, không coi đăng ký/OTP/email hay xác minh giấy tờ thật là PASS. Các PDF ghi rõ QA, không giá trị pháp lý.

Hai outbox đúng business/owner được worker Proxy giới hạn exact IDs xử lý, gồm hai worker đồng thời và retry theo availableAt thật: final2SENT,2notifications, mỗi outbox attempt1, không duplicate. Owner UI đọc2unread, đánh dấu1→1unread persisted, link đúng onboarding; foreign API không thấy target. Worker scheduled chung vẫn tắt8; không gửi external email. Đây chỉ là review-result event matrix, không suy ra mọi producer đã đạt.

Raw prior worker attempt nhận Serializable write conflict và retry2giây là hành vi đúng; harness ban đầu đòi SENT tức thì gâyFAIL. Giữ `legal-flow-12c9c272-74c4-45e5-bf4b-71664e8758b6`, continuation bounded IDs PASS, không replay hồ sơ. Bootstrap sai relation name trước đó có zero writes đã xác minh. Các QA entities/history/documents giữ lại.

Admin readonly `legal-admin-47d05a4a-f0c5-4772-9fe6-2c45e4c22456/results.json`: **6 browser cases PASS**, phân loại riêng đúng375/1440 và PDF v2 có pixels/text QA-V2-P1. Đã xem `admin-legal-375.png` trực quan. Admin review mutation trong đợt này chạy API thật, không phải nút duyệt UI.

### Checklist ngoại lệ và regression cập nhật

Sửa `requiredBusinessDocuments` dùng chung cho validation/checklist: TAX_DOCUMENT hiện bắt buộc khi chọn LEGACY_DEPENDENT_10 dù policy chung không yêu cầu giấy tờ. Khi đổi sang tổ chức thường không giữ yêu cầu ngoại lệ. Thông báo thiếu thuế nói đúng tài liệu thuế. `SHARED_LEGAL_IDENTITY_LOCKED` không bị đổi thành lời mời blind retry.

- Helper13/13PASS; web full **131/131PASS**, production buildPASS (`final-web-status.json`).
- Browser mocked transport **5/5PASS**: existing save-before-submit +checklist375/768/1024/1440, `legal-checklist-ui.log` và screenshots. Không ghi DB; chỉ chứng minh UI conditional checklist, không live acceptance hồ sơ ngoại lệ.
- Backend scoped legal/outbox7suites58testsPASS; broader reviewed-safe **123suites1171testsPASS**, DB URL cổng1 không kết nối (`backend-legal-final.json`). API typecheck/buildPASS (`final-api-status.json`).
- Full regression snapshot SHA `43759450c3b4d4e4ef8f522759e2d97c516d4c71b632795d983a8330b753e834`; live legal sourceSHA `e0eefa32e853becd094f35cf785b2778f9c85d729357675e5073b72a0ee2448a`. Sau đó chỉ web checklist/error và integration assertions sửa thêm; không gán full live proof cho mọi source mới.

### Integration chỉ đọc và test harness

Đã review7DB suites, chỉ allowlist59cases metadata/history không finance trong4files; PostgreSQL `default_transaction_read_only=on` enforce read-only. Không chạy mutation hooks/reset/drop/truncate/collection/refund. Kết quả `db-readonly-summary.json`: **58PASS/1FAIL**,79cases khác skipped bởi allowlist, ba suite ghi không chạy. Runner exit1 đúng.

Siết manager-retirement assertion: LEFT JOIN grant bị thiếu không được bool_and(NULL) coi là hợp lệ; zero archived grants vẫn hợp lệ nhưng missing grant không PASS. Health generated-client test trước hardcode121models, hiện schema có123 do hai model actual-time hợp lệ; đổi sang đối chiếu tên model generated với schema và vẫn chặn retired models, không chỉ nâng số đếm. Raw2FAIL giữ prior JSON/log.

FAIL còn lại: suite yêu cầu2consent lịch sử nhưng QA archive có0rows. Read-only `health-archive-fixture-readback.json` confirms0,không orphan. **BLOCKED historical-preservation acceptance do thiếu fixture nguồn**, không bằng chứng đợt sửa đã xóa2rows, không sửa expectation thành0 hoặc tự tạo consent quá khứ. Cần DB rehearsal có source lịch sử đúng để khép ca này.

Latest sourceSHA `2ef182be33ac03c13dc35b7efb47eb809747f9bec55c2db3c10a2b2dc0030886`,604srcfiles; integration assertions covered on that source. Runtime restart sau interruption giữ QA DB/worker guard, không reset. Logs environment failure giữ riêng.

### Phần còn tiếp tục / chưa thể xác nhận

- Native chưa có connected development device (adb không thấy thiết bị); không dùng375web thay native. Production deploy/DB restore target và domain chưa được cấu hình; không bịa URL hay mở dịch vụ tính phí.
- Session expiry/full UI; staff/service-context changes while availability pending; timezone/day-boundary/late/overrun live acceptance còn cần kiểm tra. Branch/date controlled race UI đang được khép, kết quả riêng phía dưới.
- Notification producer matrix còn reassignment/branch-change/review-moderation/nativeforeground, không dùng review workerPASS bao phủ tất cả.
- Nhiều form/routes mới discovery, chưa có action acceptance; full admin review UI, signupOTP/email và mọi legal subject live chưa hoàn tất.
- Historical consent case trên DB hiện tại không thể PASS trung thực; mutation integration/DB backup restore chưa đủ môi trường phù hợp. Encrypted/scan-only PDF và process-crash orphan chưa actual acceptance.
- Thanh toán, tài chính/hoàn tiền vẫn EXCLUDED theo quyết định. Không tuyên bố toàn bộ BeautyBook đã hoàn tất.


### Kết quả bổ sung 10/10: race UI và thông báo xét duyệt chi nhánh

`booking-request-race-ready.log`: **6/6 Playwright PASS** tại375/1440. Đổi chi nhánh trong lúc catalog cũ chưa trả, đổi ngày trong lúc slot cũ chưa trả và phản hồi cũ500 không được thay kết quả/slot hiện tại hoặc bật lại lựa chọn cũ. API transport giả lập toàn bộ, không ghi booking; chỉ là regression UI request fencing, không backend availability acceptance. Source hook hiện tại đã fence đúng nên không sửa product để ép testPASS. Raw runs giữ riêng: fixture ban đầu thiếu CUSTOMER scope; accessible button name còn địa chỉ; demo bị tắt sau interruption gây connection-refused. Tất cả là harness/environment, không gán product bug.

Rà soát tiếp `BranchesService.review` phát hiện không có result notification; state transition còn commit trước transaction request/history/documents. Sửa `BranchStateService.transition` có callback nội bộ cùng Serializable transaction, review đưa request/event/document/outbox vào callback đó; snapshot updatedAt/reviewStatus stale bị409 và rollback. Non-review transition callers không dùng callback giữ contract hiện hành. Unknown decision/non-string/blank reason reject sớm. Chủ nhận là active nonexpired BUSINESS_OWNER grant của exact business, dedup; target BRANCH và route thật `/salon/branches/:id/setup`, key event+recipient. Không backfill notification lịch sử.

Validation `branch-review-selected.json`: **5suites59testsPASS**, gồm unit dùng real state service+mock transaction để chứng minh outbox fault không commit state, stale snapshot không lưu result và input guard. Unit rollback không được gọi là DBfault acceptance. API typecheck/buildPASS; log lần đầu gọi sai tên suite transition-controller vẫn giữ, selected dùng `branches-transition.controller.spec.ts` đúng.

Actual compiled API `branch-review-f0940985-dd90-400e-bfd3-d0fd636b8a1a/results.json`: **27checksPASS**,4new QA branch/request snapshots seeded dưới business0 đãapproved. Three decisions+oneconcurrentAPPROVE/REJECT; owner403, invalid400/historyzero; each branch exactone state transition/event/resolvedrequest, unpublished/public404. Fouroutboxes→restricted worker (only exactIDs), two drains concurrent,4SENT/4notifications đúngowner, APIowner sees unread. Basebusiness status/updatedAt unchanged. Không claim create/submit/upload branch wizard acceptance; không sửa base staff/services/booking/finance. Original run09963375 stopped before anybranchcreate do fixture dùng businessId thayid, evidence giữ nguyên; marker tồn tại vẫn chặn blind replay.

Sau interruption khởi động lại Vite5176/API3014 đúngQA guard, sau build restart API task-owned PID kiểm commandline; không resetdata. Native, fullUI OTP/sessionexpiry, staff-context race live, branch UI notification click và đầy đủ matrix trạng thái vận hành vẫn chưa có acceptance mới. Chi nhánh review producer đã khép API/worker, không thay lời kết luận thành toàn notification matrixPASS.


Final gate tại checkpoint này: `backend-branch-final.json` **124suites1179testsPASS**, sourceSHA `b31c1ff812825e5c653a01974c93878bbd2377588ce2ec15edfe9c5398c045a3` (605srcfiles). `branch-review-selected.json`5/59PASS, type/build0; `final-web-status.json`131web tests+buildPASS. `checkpoint-20261010.json` machine summary ghi rõ wholeProductComplete=false, actual/mock/unit riêng; 58DBreadonlyPASS/1historicalfixtureFAIL vẫn giữ. Đã xem trực quan date-race-500-375.png: slot10:00 mới vẫn chọn được, không tràn ngang, action bar đủ chỗ. Không dùng ảnh mock đó làm proof backendslot.

Source review bổ sung: BookingItemsService.update REASSIGN hiện có immutable adjustment audit và postcommit realtime, nhưng không thấy durable notification producer tại đường này. Các đường bulk/change-request/provider audit cần khảo sát chung trước sửa để tránh notification đôi hoặc lọt scope. ReviewsService report/moderate có transaction notification trực tiếp, targetREVIEW được UI role router xử lý; chưa gán actionUrl `/reviews` là lỗi vì frontend có target fallback. Những kết quả đọc source này chưa phải E2E và vẫn nằm trong gap producer matrix.

Demo tiếp tục chạy tại http://127.0.0.1:5176 với guardedAPI3014/PID6544, VitePID30208. Native adb kiểm lại10/10 vẫnzero devices. Không có test/browser write đang chạy tại checkpoint; worker chỉdrainoutboxQA4IDs đã kết thúc. Các screenshot/mock traces/results local bịignored theo policy repo, haiMD và source/test có thểcommit; chưapush. Phạm vi chưa hoàn tất toàn bộ, các NOT_RUN/BLOCKED phía trên cần tiếp tục, không phải miễn trừ acceptance.


## Checkpoint 11/10/2026 — producer phân công, notification UI/mobile và input đánh giá

Tiếp tục từ checkpoint10/10, không reset/revert thay đổi hợp lệ, không xóa lịch sử và không push. HEAD vẫn38c5fb68859135c9a8c458eb053d894a92eb97be. Thanh toán/tài chính tiếp tục EXCLUDED; data-request và raw audit detail UI vẫn gỡ, danh sách lịch sử audit vẫn kiểm quyền và backend history vẫn hoạt động.

### Phân công lại — baseline thật và producer dùng chung

`provider-baseline-continuation-6d4efb07-8a58-4fe6-9c65-85fa859bb995/results.json` dùng API đã build cũ (b31 source), một lịch QA **BB-2026-0100110 /96572df5-22b0-4ba5-95d6-c601ab55a32f**: REASSIGN200, audit1, providerOutbox0. Đây là reproduced missing durable notice, không phải productPASS. Source đang sửa và API đã build được ghi riêng, không đánh đồng hash source mới với runtimebaseline.

Sửa `booking-provider-notifications.ts`, `booking-provider-audit.ts`, `BookingItemsService` và `BookingsService.assignStaff`: queue trong cùng transaction với assignment/audit. Helper được các đường reschedule/change-request dùng lại; nhân viên trước/sau phân công chỉ nhận nếu hồ sơ/tài khoản active, grant không hết hạn, đúng business và STAFFbranch hoặc tenantOWNER. Dedup theo event+recipient; cùng staff không queue. Không copy tên/phone khách hoặc lý do nội bộ vào payload. Không đổi START/COMPLETE hay giờ dự kiến/thực tế hay quyền correction.

Outbox cố ý **không nối relatedBookingId** để notification list không project code/status/date hiện tại cho người đã bị gỡ. BOOKING targetUUID chỉ là navigation hint; mobile thêm fallback exacttype+UUID và màn hình phải authorized refetch. Không follow actionUrl/external URL trong mobile. Người đã mất assignment nhận thông tin việc chuyển khỏi lịch; mở personal work vẫn404. Webrefetch target cũ403 và giải thích thật, không lộ code/detail.

Bulk giữ audit/version behavior cũ khi bấm cùng staff; helper không tạo notification cho no-change. Đây là compatibility decision, không tự viết lại historical audit. Bulk realtime được đổi sang safe aftercommit helper: lỗi socket sau commit không biến assignment đã lưu thành requestfailure. Có unit fault injection; không claim đã inject socketfault trênAPI thật.

Selected `provider-regression-4b5a3878-5934-4d79-b038-4d6f18f3a3ba/results.json`: **20actualchecksPASS** trên đúng booking baseline, không tạo thêm lịch. ItemREASSIGN, retry revision cũ trả 409 và không thêm outbox; bulk; customerSTAFF_CHANGE request+owner duyệt;6deltaoutboxes→**hai worker instances riêng biệt**→6SENT/6projectednotifications, mỗi outbox có một lần thử; mỗi staff nhận ba thông báo của mình, ownerkhông nhậnstaff-targetednotice. Nhân viên hiện được giao personal detail200, nhân viên đã bị gỡ404. Chi nhánh gốc không đổi; không có payment hoặc amountDelta khác 0. Prerequisites branch/offering/staff/customer/mappings QA mới được seed; không claim registration/branchreview/publication acceptance hay điều trị thật.

Failures/harness giữ nguyên:
- Initialbaseline `provider-baseline-2ae1f248-3762-4f71-b8e6-071628794888` gửi `notes`/endTime ngoàiDTO, chưa tạo booking. DB không có booking, đã đối chiếu ở provider-baseline-no-booking-readback.json, continuation dùng đúng fixture và body.
- Regression `55dcc27a-2822-48b9-930f-dd6502d77214`: item/bulkPASS, request thiếu idempotencykey400, requestsDBzero. Final dùng marker khác, intent mới córevision hiện hành, đo delta6; không blind replay đãcommit. BốnoutboxQA từ attempt đó vẫnPENDING, bịexclude exactIDs khỏi finalworker; khôngxóa/backfill/globaldrain.
- Hai lời gọi drain trên cùng một instance ở branch-review run10/10 chỉ chứng minh overlapping-drain guard, **không phải distributed two-worker acceptance**. Statement cũ “hai worker” ở overlay branch được đính chính tại đây. Legal-flow10/10 ców1/w2riêng; provider11/10 cũnghai instance riêng.

### Web notification center — race, count và link permissions

Source `NotificationCenter.jsx`, new `notificationCenterState.js`/tests: request/session/controller lease; read/read-all invalidate pendingreads trước transport, lock exactitem, reconcile bằng list/countAPI, tự trở về trang cuối hợp lệ khi unreadfilter hết trang. Không trừcount nhiều lần dựa vào captureditem. Relatedlinks đối chiếu guard thật trong App.jsx và scope gợi ý; destinationAPI vẫn enforce quyền. Branchsetup owner link và audit-history lists hợp lệ vẫn mở, rawauditdetail/datarequest/financehidden vẫn không cólink. Không invent permission cho routes chỉ có account-zone gate.

Agent baseline hai controlled failures giữ dưới notification-ui outputs. Unit143PASS trước allowlistparity; final full **147webtestsPASS +buildPASS**, `web-notification-final-status.json`. Mocked browser `notification-ui-1791717570705/evidence.json`:375/1440, late-list fencing/onePATCH/last-unread-page/read-all/account-response/deniedlink/nooverflow. Toàn bộtransport mocked, khôngrealAPIwrite, không gán là notificationdeliveryE2E.

Actual web `provider-read-fixed-0126814b-b776-4ccb-ba53-8b948b974120/results.json`: **16strictcasesPASS** (bốn freshSTAFF contexts375/1440; mỗicontext bootstrap/login/data/target). Bothusers seeexact3ownprovider rows, không có relation/code lịch hiện tại trênnotices; assigned opens exactbooking; former403/no detaildisclosure. Run chỉGET/auth, notificationWrites0/bookingWrites0. Earlier actualrun `provider-ui-8e0b943b-a46f-43b4-a8de-40d84c74b0e9` giữ6assignedSTAFFcasesPASS và đúng1ownednotificationPATCH→2unread; sau đó điều khiển viewport bị treo, chỉ dừng đúng PID runner thuộc task khi không có HTTP request đang chạy. Không gọi interruptedwhole runPASS.

Priorfixedrun `2f8dc37d-a704-442a-b823-34943001591d`: denial đúng, harness đợi từ “quyền” trong khi toast thật “Nhân viên chỉ được đọc lịch được giao trong phạm vi còn hiệu lực”; ReactdevStrictMode tạo2sameGETs. Sửa expectedexacttext vàallow tốiđa2GET403 đúngUUID/phase (source main.jsxStrictMode), vẫnFAILmọi lỗi ngoài đó. Giữ raw failure/log; khônggiảm backendauthorization. Đãxem screenshots staff-old-notifications375 và staff-new-target1440, khôngtràn/ngườiđãgỡkhôngthấybookingcode.

### Mobile source — notifications và owner branch routing

Đã đọc mobile/AGENTS và officialExpo57docs trước khi chỉnh code. New `useNotificationRequests`+`notificationRequests` helper áp dụng cho MessagesScreen/OperationsNotifications: synchronousbusyguard, boundedpagination, duplicate-read locks, stale loadmore/readall fences, sessiongeneration/context/unmountclear. Tin count từ API khi các hàng và số đếm không cùng snapshot; chỉlocalmarkdecrement oldsnapshot, khôngdecrementfreshcount lầnhai. Server count 2 với row còn false vẫn giữ count 2, có test riêng. Mobiletest dùng actualhelper/hook/component qua VM với mockedReact/native/request surfaces, không có thiết bị.

BOOKING targetUUID fallback không dùnguntrustedURLs; malformed/code/URLreject. OwnerBooking notificationroute cófromNotification=true: transientscope choownedbranches **trongcurrentbusiness**; server/branchallowlist/grant/currentgeneration vẫncheck. Defaultcalendar/listdetail vẫnselectedbranchstrict. Màn hìnhshowactualbranch; mutation/correctionpinscopedbranch đãverify, không đổi chi nhánh đang chọn toàn app, không mở doanh nghiệp khác hoặc chi nhánh chưa được cấp quyền. Request/Impactnotificationrouting vẫngiữselectedcontext, chưa cócrossbranchacceptance mới.

Native runtime **BLOCKED_NO_CONNECTED_DEVELOPMENT_DEVICE**: freshadb11/10zero. Không khởi động/reset emulator, cài app, reload hoặc đổi Metro. Typecheck và mocked tests không chứng minh bàn phím, Back, foreground hoặc lifecycle trên thiết bị. Root final selectedmockedsuites trước sửa count cuối134PASS; helper21PASS+typecheck sau sửa; combinedlatest ghi mobile-notification-current-status.json/log bên dưới, khôngcộng overlap thànhnhiều uniqueproductcases.

### Form đánh giá — invalidJSON/types trướcDB

Actual oldAPI `reviews-input-baseline-7fb34b12-d24c-4060-8caa-0fb1e358fc9e/results.json`: reportreason10/replycontenttrue/appealreasonarray/moderationreasonCode10 trả **500**. IDsrandom đã kiểmkhôngcóreview/booking, không tạo dữ liệu nghiệp vụ; không dùngreview thật đểprovokefailure. Unitbaseline10FAIL giữ reviews-input-baseline.json.

`reviews.service.ts`/controller: enforce nonemptystring reasons/content, objectJSONbody, category/severitystring nếuđượcgửi, appeal decisionJSONboolean. Add sharedassertReviewCreationInput: integeroverall/service rating1..5, textcomments, booleananonymous, array/objectservice entries, nonemptystring itemIDs. Chặn lúccontroller/service boundary, giữchính sách độ dài tối thiểu của nhận xét/COMPLETED/owner/duplicate/assignmentchecks. KhôngápUUIDchohistoricalstringIDs, khôngguesslegal/identity hoặcboolcoercechuỗi“false”. Cácnulloptional đượcgiữcompatibility vốn có.

Creationunitbaseline8FAIL riêng; final3suites31PASS (22input+existinglifecycle/servicechecks). Type/buildPASS reviews-all-input-status.json. TypecheckpriorTSunion trongtestnull đãsửa bằngawaitwrapper, khôngweaken assertion; logprior giữ. Actual regression `reviews-input-regression-dabf9169-4902-47e9-982f-afa8213b43b1`:4/4malformednow400, no target data. Actualcreation `reviews-input-creation-19cc1caf-fe02-4fcf-9379-c137b3a70266`:6badtype400 vàvalidshapeunknownbooking404; no review/report/appeal rows. Đây là negativeAPI validation, không phải lifecycle review hợp lệ từ đầu đến cuối.

Acceptance thật cho tạo/báo cáo/kiểm duyệt/khiếu nại đánh giá trên UI và worker còn cần một booking QA hoàn tất hợp lệ. Booking QA hiện tại CONFIRMED; **không giả lập trạng thái hoàn tất**, không thu tiền. Source hoàn tất booking gọi platformFee/ledger cảzero-pricedbooking, nên không tạo “free” completionfixture để lách financeEXCLUDED. Unit review hiện có vẫn PASS, livepositive deferred với lýdo trên. Khônggán best-effort auditLog saureportcommit là APIfailure: đãđọc helper, nócatch; transactional ReviewModerationEvent vẫnprimaryhistory.

### Storage — actual child process interruption, bounded dry-run

`storage-crash-bee390b8-49e8-4157-a4ac-66159dc1d94e/results.json` PASS. Compiled MediaService trong riêngchild đãauthorizeavatarQA/decodeảnh LANDSCAPE hiệncó vàghifile113147bytes, metadataDBshim dừngngaytrướcCREATE. ParentverifyownPID/path rồiSIGKILLchild; file vẫn còn và hash khớp. Freshinventoryretainsuntracked trong24hgrace; mtimechỉ file QA của task đượcstaged25hold→dry-runcandidate1, file vẫn còn. Công cụ không xóa file. Scopeisolated-upload-root mới, không tác động thư mục upload/database thật.

Proof là **actualprocess+filesystem+realMediaService, mockedmetadataDB**. Khôngclaim fullNestcrash/productionDBrecovery/restore. Khôngthayagingconditionthànhclockwait25h. Sourceinventoryhelper/read-only chứanodeletes giữnguyên.

### Các giới hạn tiếp tục

Chưa hoàn tất toàn sản phẩm. Native cần thiết bị/build phát triển kết nối; lịch sửconsentfixture58DBPASS/1FAIL còn thiếuhai dòng dữ liệu lịch sử nguồn; productiondomain/deploy/restoretarget chưa có. Finance/paymentEXCLUDED. FullsignupOTP/email, eligiblepositiveReview, Impactcrossbranchnotification, toànbộforms/actions vàsustainedoverrun/day-boundarylive vẫn được ghi NOT_RUN/BLOCKED riêng. Không coi số test/viewport là tỷ lệ sản phẩm hoàn thành. Không xóa các failure hoặc ghi đè source hợp lệ để lấy PASS. Gate và hash cuối được cập nhật bên dưới sau khi các tiến trình kết thúc.


## Checkpoint tiếp tục 11/10 — tìm kiếm, DB integration và phiên hết hạn

Repo đã được đối chiếu `git status`/`git diff` trước khi tiếp tục. Giữ nguyên toàn bộ thay đổi hợp lệ và ba quyết định sản phẩm. Không reset/seed/migration/drop, không push. Demo web5176/API3014 dùng DB QA riêng, external channels và background batch vẫn tắt.

### Tìm kiếm thông báo

Baseline API thật có dấu “Phân công” trả3 hàng nhưng `  PHAN   CONG ` trả0. Backend `notifications.service.ts` dùng shared Vietnamese fold và parameterized SQL giới hạn `user_id` trước phân trang; title/body cùng được tìm, giữ bộ lọc state/type/severity, thứ tự createdAt+id và literal wildcard. Thêm5 tests tại `notifications-search.spec.ts`. Final selected22 tests PASS (5search+17pagination), API typecheck/build PASS. `notifications-search-status.json` testExit1 là lệnh chọn thêm file test không tồn tại; giữ lỗi harness này, không gọi gate đó PASS. Full backend mới128suites/1216testsPASS tại `backend-search-final-20261011.json`.

`notification-search-live.json`:5/5 actual API checks PASS, gồm same IDs có/không dấu/hoa thường/whitespace, filter+page2, unread riêng từng tài khoản, ký tự wildcard literal và empty. Không thay notice hay booking bằng các kiểm tra tìm kiếm.

Actual Edge `provider-read-fixed-7d51872b-a63b-42ca-a7f1-fa656ade898a/results.json`:40 strict cases PASS, 2staff ×4widths375/768/1024/1440 ×5cases. Đúng3 thông báo riêng tài khoản; currentstaff đọc đúng lịch, formerstaff403 không lộ mã lịch; search Enter thật gọi API search200. bookingWrites/notificationWrites=0. Đã xem trực quan staff-old-search-375.png và staff-new-search-1440.png. Đây là browser responsive, không phải native.

Prior `provider-read-fixed-f6ea4fe3-c44c-4d5d-9ce0-aad67056a590` và lần search-label-fixed tiếp theo timeout vì harness tìm placeholder “Tìm thông báo” trong khi Input dùng aria-label này, placeholder thật khác. Sửa locator `getByRole(textbox,name)` và xử lý pending response rejection; không thay UI để hợp thức hóa test. Raw partial runs giữ nguyên, không tính toàn run PASS.

### Tách tài khoản trên PostgreSQL thật

`account-separation-db-summary.json`:6/6 integration cases PASS. Customer không trộn BUSINESS_OWNER/RECEPTIONIST/STAFF/PLATFORM_ADMIN ở cả hai thứ tự; grant expired giữ history nhưng renew thành mixed bị constraint23514; hai transaction cạnh tranh không cùng commit. Tạo tài khoản mới cho chính suite rồi chỉ dọn các ID đã INSERT thành công. Sửa cleanup allowlist trong `account-separation.integration.spec.ts`: chỉ push ID sau INSERT thành công để không bao giờ dọn ID do INSERT thất bại/collision.

UserCount170/grantCount160 và SHA256 của tất cả user state/grant trước/sau giống nhau. Không sửa lịch, hồ sơ hay giao dịch. Initial harness dừng trước Jest do source gate không chuẩn hóa CRLF; sửa gate, giữ marker cũ; không gọi đây là lỗi constraint/application.

### Phiên hết hạn trên web thật

`session-expiry-ce0481bf-06a5-434b-b166-6489bd463696/results.json`:10/10 strict browser cases PASS ở375/1440. Login API thật vào user QA mới của task; chỉ stage expires_at của đúng session vừa issued sau kiểm tra owner/createdAt. Search thật sau expiry nhận401; refresh của session ấy401; giao diện về login, không còn notice cũ, persisted user=null; login mới thành công. Account/grant và các session khác giữ nguyên hash. Đây là synthetic expiry prerequisite cho actualAPI/UI, không phải chờ TTL30ngày.

Initial `session-expiry-a2d41298-bf56-4b8c-9e3a-b0c99f29d70a` giữ FAIL: assertion chạy ngay khi URL đổi trước khi React render; badge unread-count cũng401 cùng session nhưng chưa khai báo expected. Final dùng visibility wait và allow đúng endpoint/phase/max1; không ignore401 chung. Không đổi auth code từ lỗi harness này. Ảnh expired-login-375.png đã xem trực quan.

Gate mobile final139/139 scoped mocked tests +typecheckPASS (`mobile-notification-current-status.json/log`), thay số134 của lượt trước trong kết luận hiện hành; không cộng hai lượt thành unique cases. Web147tests/buildPASS trước chỉnh layout tiếp theo; source mới và gate cuối ghi riêng sau khi kết thúc.


### Kiểm tra bố cục auth sau quan sát screenshot

Số đo baseline `auth-layout-1fa93d99-3be5-410a-be6a-ff3acd2d4d9f/results.json` không có giao vùng hình chữ nhật: link kết thúc x110.296875 và logo bắt đầu đúng x110.296875 ở375px. Vấn đề thực tế là **khoảng cách bằng0**, khiến chữ “Trang chủ” dính sát icon logo; không báo nhầm đây là lỗi click bị che. `public-home.css` sửa mobile brand từ inline-flex sang block flex có width fit-content, để margin-top tạo hàng riêng cho tất cả AuthShell. Desktop giữ cấu trúc hiện tại.

Regression `auth-layout-59fcab7b-0b66-4812-bbd8-7fb4de6699ac/results.json`:16/16 strict read-only cases PASS ở login/register/register-business/forgot-password ×375/768/1024/1440. Form inputs thật đã tải; link hit-test trực tiếp được, brand có khoảng cách ít nhất12px khi hiện, không overflow; không submit/register/email. Đây là geometry+UI proof trên4form, không acceptance chức năng gửi của các form đó.


## Checkpoint cuối đợt 11/10 — quyền review và race phiên

### Review appeal: quyền hiện hành, cạnh tranh và kết quả

Review độc lập xác nhận service cũ tra bất kỳ Owner grant trong DB, không enforce expiry/selected business; check PENDING ở ngoài transaction và quyết định không CAS. `reviews.controller.ts` nay truyền AuthUser đầy đủ. `reviews.service.ts` authorize author bằng review:create:self hoặc Owner bằng review:moderate:tenant với đúng tenant/branch từ review, theo scopes hiện hành của phiên. Không dùng membership/grant lịch sử để mở quyền. Khóa hàng review bằng parameterized SELECT FOR UPDATE; check PENDING và insert appeal/event cùng transaction. Không đổi schema, không xóa lịch sử hoặc dựng completed fixture.

Resolve khóa cùng review, claim appeal PENDING bằng updateMany trước khi đổi review; mất claim trả409, không ghi event/notice. Kết quả, lịch sử và một thông báo SYSTEM generic tới chính appellant cùng transaction. Không đưa resolution/PII thô vào notice; target REVIEW để frontend tự map route theo vai trò và kiểm tra quyền. Nếu lưu notice thất bại, toàn bộ decision/status/event rollback. Business rule review completed/finance, author/tenant quyền và lifecycle START/COMPLETE không đổi.

New `reviews-appeal-integrity.spec.ts`11 tests; toàn bộ6review suites50PASS, typecheck/buildPASS. `reviews-appeal-historical-baseline.json`: source HEAD của đúng service được transpile thành artifact riêng, transaction model tái hiện8FAIL/3PASS. Đây là **historical source + controlled model**, không phải8HTTP failures/8DB exploitcases. Initial require/config failures giữ reviews-appeal-baseline.json/log và reviews-appeal-baseline-config-prior.log; không tính là product bugs. Mô hình lock không chứng minh PostgreSQL deadlocks/isolation; positive live review vẫn cần completed QA prerequisite hợp lệ, deferred vì financeEXCLUDED. Review độc lập sau sửa không phát hiện lỗi critical mới.

Sau restart đúng controlledAPI3014/PID32788, `reviews-input-regression-74526382-6961-4cae-baa7-db8399f92ea4/results.json`:4 malformed400 thật, no target review/report/appeal rows. Không gọi các case này là positive appeal E2E.

### Auth: rào chắn theo thế hệ và identity phiên

Service/API client trước sửa có thể clear tài khoản B bởi401/refresh lỗi của A đến trễ; restore A sau logout; B join refreshPromise của A. Initialization/logout completion cũng có quyền ghi session muộn. `sessionGeneration.js`, `apiClient.js`, `authStore.js` fence trước transport/WebLock callback, sau response/body, trước set/clear/retry. Dedupe refresh theo lease, old finalizer không xóa slot mới. Login/register/same-account relogin/context change/logout/clear invalidate lease; logout clear local ngay sau dispatch đúng credential, completion không xóa login sau đó. Giữ idempotency-key và scope của retry.

Identity so sánh id/sessionType/workspace/businessId/branchId/sessionId, không so token xoay hay danh sách role refresh. Cùng Owner đổi context invalidates old reads; refresh từ cookie session/context khác bị reject. SchedulerView/ListView và useCustomerBookingRefresh giữ active/context/epoch/lease ở callback thành công/lỗi/unmount, không clear tài khoản mới bằng lỗi refresh cũ. Ordinary refresh cùng session giữ generation để concurrent reads không bị tự làm stale.

Latest agent evidence `auth-context-1791725161505/summary.json`:29targeted +171full web tests PASS, buildPASS. Baseline context17PASS2FAIL và callback19PASS4FAIL được giữ riêng, không cộng overlapping tests. Deferred transport tests chạy actual source với state/transport infrastructure mocked, chưa là native/server-cookie proof.

Actual Chromium/Vite modules với toàn bộ transport intercept: `auth-session-browser-762f91bb-c941-4d98-9dc7-f3af7a9594d8/results.json`:8/8cases PASS, four late scenarios ×375/1440. Late401 không refresh; latefailure không clear B; late refresh sau clear không restore A; late logout completion không clear B. UI của B hiển thị đúng own controlled notice, không A. Không gọi API/DB thật. Initial713f34... failure là harness import URL không có query, tạo Zustand singleton thứ hai khác với Vite HMR module của app. Final import đúng URL module được quan sát trong resource entries; không sửa sản phẩm để hợp thức hóa test.

Actual API3014: `access-refresh-fb31eea7-ff1d-467f-b0db-2b65d43893eb/results.json`6/6cases PASS. Chỉ stage expired JWT của đúng QA user/session trong browser memory; refresh cookie/server session thật vẫn còn hiệu lực. Hai GET thực nhận401, dùng đúng một POSTrefresh200, retry200, giữ exact user/sessionId và3own notices. Không sửa DB hoặc output JWT/secret; login/refresh có session writes bình thường. Initial3f331... failure cũng do singleton harness khác UI, preserve raw result.

Actual full-session expiry sau source freeze: `session-expiry-de78f3b8-9783-4028-b7b4-1fd2c0b55a87/results.json`10/10PASS375/1440. Các lượt expiry cũ giữ riêng, không cộng chúng thành unique product cases. Đã xem actual refreshed-notifications-1440.png và controlled late401-375.png, phân biệt rõ loại bằng chứng.

**Giới hạn auth:** per-tab generation không ngăn browser áp dụng Set-Cookie từ response đã ở trên mạng. Không claim đã chứng minh durable cookie ordering giữa nhiều tab/browser hoặc crossrestart. Identity mismatch fail closed, không tự chuyển sang tài khoản/context khác.

### Gate cuối và dữ liệu được bảo vệ

- Backend latest safe gate gồm126src suites1199PASS tại backend-appeal-final-20261011.json và3test-folder suites28PASS tại backend-appeal-testfolder-final.json:129unique suites/1227tests,0FAIL. Discovery chỉsrc bỏ3file test-folder; lần backend-appeal-omitted-final.json chạy3src cùng basename đã có trong126 nên **không cộng46test đó**. API typecheck/buildPASS, DB integrations riêng; finance units có mock không phải payment acceptance.
- PostgreSQL account separation6/6 actualintegrationPASS riêng; priorreadonly58PASS/1historical-fixtureFAIL vẫn giữ. Không dựng hai consent lịch sử để đổi FAIL thànhPASS.
- Web171tests/buildPASS; mobile139scoped mocked tests/typecheckPASS. Native vẫn thiếu connected development device, không suy từ375px.
- Current combined source SHA256 **7c572b763de5a8aef9fdc716266ea9cbeb92164cf8dc163116622c299f4cf79b**,618src files, HEAD38c5fb68859135c9a8c458eb053d894a92eb97be, dirty. Backend/web gates chỉ ràng buộc partition liên quan; source composite trước sửa vẫn lưu lịch sử. Machine checkpoint tại report-output/bugreport-remediation/checkpoint-20261011.json.
- Own provider fixture booking96572df5... đãCANCELLED bởi cleanup hợp lệ trước đợt tiếp tục; không tạo booking mới/rerun reassignment. Lịch, trạng thái/audit history và các row QA giữ nguyên. Không thu tiền, no historical deletion, no reset/migration/push. QA API32788/web16244 còn healthy tại checkpoint.

### Đối chiếu phạm vi còn lại — không tuyên bố toàn sản phẩm hoàn tất

| Phần | Trạng thái cuối / lý do | Điều kiện tiếp tục |
|---|---|---|
| Native customer/staff/owner |BLOCKED: không có thiết bị phát triển kết nối; code/mock/typecheck đã chạy |Connected device/build/API provenance, không reset thiết bị |
| Positive review UI/report/moderation/appeal full lifecycle |NOT_RUN: cần completed QA booking hợp lệ; completion đụng fee/ledger trong phạm vi paymentEXCLUDED |Fixture completed hợp lệ hoặc riêng scope finance được cho phép; không backdate/fake state |
| Historical consent archive rehearsal |FixtureFAIL: thiếu2dòng lịch sử gốc; không được tạo giả dữ liệu quá khứ |Bản rehearsal chứa lịch sử nguồn đúng |
| Production storage/deploy/DB+volume restore |BLOCKED: chưa có target/volume/snapshot production được chỉ định |Target staging/restore độc lập +backup phù hợp; local file restore/crashmodel không thay proof này |
| OTP/email/signup external verification |NOT_RUN external: QA credentials/channels tắt có chủ đích |Sandbox external/config policy +account test đúng; không gửi dữ liệu người thật |
| Mọi form/control, legal subject live, late/day-boundary/overrun live, staff/service availability pending |PARTIAL: code/unit và các actual flows được liệt kê; chưa có acceptance cho mọi tổ hợp |Các case IDs và dữ liệu cô lập cụ thể; không dùng route/heading PASS làm action proof |
| Impact/request notification crossbranch/native foreground |PARTIAL: BOOKING owner route được sửa; Impact vẫnselectedcontext, native thiếu thiết bị |Owned context fixture +runtime; không mở scope xuyên doanh nghiệp để test |
| Toàn ma trận cron/external notifications |PARTIAL: restricted outbox delivery QA đã chạy cho account/business/branch/reassignment; globalbatch vẫn tắt |Allowlist outbox/event QA mới; không bật batch gửi tới dữ liệu có sẵn |
| Tài chính/hoàn tiền/payment acceptance |EXCLUDED theo quyết định sản phẩm |Giữ code/data, không dùng test hiện tại để claim finance |

Các phần PARTIAL tiếp tục là chưa hoàn tất, không phải đã đóng. Không có tỷ lệ “toàn hệ thống đạt” từ số tests/screen widths. Ba quyết định bỏ/ẩn UI tiếp tục giữ nguyên. Tài liệu này là checkpoint để tránh làm lại hoặc xóa mất bằng chứng ở lần tiếp tục.


Bổ sung lock-SQL boundary trên compiled API/PostgreSQL thật: `reviews-input-appeal-unknown-34295c13-ba63-4d78-bc99-2d0ab6d6e367/results.json` PASS. POST appeal có reason hợp lệ với UUID đã xác minh không có review →404 (không500), zero review/report/appeal target rows trước/sau. Điều này kiểm tra cú pháp/parameterized query và boundary unknown object; **không** chứng minh concurrent winner trên PostgreSQL với review thật. Các hash bảo vệ account integration là id/is_active/deleted_at và toàn bộ grants; session staging là id/user_id/expires_at/revoked_at của các phiên khác, không tuyên bố đã hash mọi trường auth telemetry.

## Checkpoint tiếp tục 12/10 — thông báo Owner, đánh giá và audit

Đã đối chiếu trạng thái Git trước khi sửa. Giữ nguyên bản mobile Berry Bloom đã merge từ `123` và các thay đổi dọn nội dung giao diện; không reset/revert/seed/migration, không xóa dữ liệu lịch sử. Các kết quả 11/10 phía trên vẫn là bằng chứng lịch sử, không gắn lại cho source mới. Ba quyết định mục12/mục14/mục17 tiếp tục giữ nguyên.

### Owner mobile: thông báo khác chi nhánh cùng doanh nghiệp

Baseline component thật: callback thông báo sự cố thiếu `fromNotification`, chi tiết sự cố dùng bộ lọc chi nhánh hiện tại; hai assertions thất bại (`impact-baseline.log`). Đã sửa `OwnerTabs`, `OwnerDetails`, `hooks`: chỉ đường mở từ thông báo được đọc các chi nhánh đã cấp quyền trong **doanh nghiệp đang chọn**. Sau đọc hợp lệ, thao tác ngoại lệ/đóng sự cố được ghim vào chi nhánh trả về; mọi thao tác vẫn refetch, kiểm tra quyền và fence phiên/context. Không tự đổi bộ lọc toàn ứng dụng. Link lịch liên quan giữ nguồn mở từ thông báo. Đường mở thông thường vẫn chịu bộ lọc chi nhánh hiện tại.

Producer yêu cầu đổi/hủy hiện dùng target BOOKING, không có target request mới. Chi tiết lịch mở từ thông báo nay hiển thị link tới các yêu cầu **đúng lịch đó, còn PENDING, còn hạn**; màn hình xét duyệt truyền nguồn mở, ghim chi nhánh lịch và giữ nguyên kiểm tra tài chính backend. Lỗi hoặc đang tải queue không cung cấp thao tác từ dữ liệu cũ. Booking detail thông thường không gọi API queue thêm. Baseline bốn assertions thất bại (`request-baseline.log`), sau sửa đạt. Không thêm endpoint/permission hay mở scope sang doanh nghiệp khác.

Final Owner **48/48** behavioral tests, nằm trong **220/220** mobile tests; typecheck và Android Hermes export đạt. Có tests actual JSX/hook, nhánh A đang chọn nhưng B được cấp quyền, foreign/unknown branch, chuyển business/session/context/unmount giữa preflight, branch drift ngăn ghi, request hết hạn/terminal/unrelated không được mở. Đây là controlled transport/source proof, **chưa** là native foreground/offline acceptance. Không chạy ADB/emulator/Metro trong lượt này. Các thông báo sự cố hiện tại có thể dẫn tới BOOKING; route target `OperationalImpactCase` được sửa riêng, chưa khẳng định đã có live producer/direct-target acceptance.

### Positive review trên API/DB thật

Scout chạy BEGIN READ ONLY/ROLLBACK, tìm thấy ba booking QA COMPLETED hợp lệ. Dùng duy nhất booking sẵn có `0076db61-92cf-48f9-915e-18328616d5cc` / `BB-2026-0100040`; không tạo/complete/backdate lịch và không ghi tài chính.

Chuỗi API thật: customer tạo → Owner đúng scope báo cáo → platform ẩn → tác giả khiếu nại → platform chấp thuận. Final có **1 review APPROVED, 1 report, 1 appeal APPROVED, 4 moderation events, 4 notifications**; công khai và Owner đọc đúng nội dung đã trim. Owner khác doanh nghiệp bị403, duplicate khiếu nại409, resolve retry400. Supplemental final16/16 checks PASS tại `review-positive-verification-fixed-ip.json`. Initial final-read assertion FAIL vì so sánh comment đầu vào chưa trim, được giữ trong `review-positive-lifecycle.json`; không tạo lại review để chạy lại cả chuỗi. First listener guard EPERM và lần đọc supplemental dùng header IP sai cũng được giữ, không gọi toàn các run cũ là PASS.

Snapshot hash trước lifecycle đầu tiên chưa được persist, nên **không tuyên bố** đã chứng minh mọi row trước/sau chuỗi đầu bằng hash. Readonly timestamp checks và mutation allowlist không có booking/payment/profile writes; đợt regression sau deploy có snapshot hash exact riêng. Concurrent PostgreSQL resolve race và các submit form review qua UI còn NOT_RUN. External delivery chưa chạy, không bật global outbox.

### Audit bị ghi đôi: sửa nguyên nhân dùng chung

QA thật phát hiện hai request-audit rows cho mỗi trong tám review requests. `AppModule` đã đăng ký `APP_INTERCEPTOR: AuditInterceptor`, nhưng chín controller lại `@UseInterceptors(AuditInterceptor)`. Đã gỡ đăng ký trùng/import ở Admin, Bookings, Branches, Promotions, Vouchers, Reviews, Services, Staff, Users; giữ global interceptor, tất cả `@Audited` và audit/history nghiệp vụ trong service.

Composition baseline **11 FAIL/2 PASS**; final **13/13 PASS** kiểm tra registration thực, success/error chỉ ghi một lần, và audit persistence fault không đổi kết quả đã commit. Compiled QA3014 được root khởi động lại đúng guarded wrapper/PID3104, database test giữ nguyên, tám background workers và email vẫn tắt.

Live regression **19/19 PASS**, đúng hai request từ chối trên cùng review/appeal: foreign Owner403 và resolved appeal retry400, **mỗi request ID đúng một error audit row**. Snapshot hash review/report/appeal/history/notifications/outbox/booking/payments không đổi; final original counts vẫn 1/1/1/4/4. Không tạo thêm hay hide/resolve thêm lần nữa, không sửa/xóa các audit rows trùng lịch sử. Live success sau dedup chưa mutation lại; success có composition proof, ghi riêng giới hạn này.

### Hai lỗi web tìm được trên demo

- CustomerReviews lấy ngày từ `appointmentStartTime` (Prisma TIME serializes năm1970), làm cả ba hàng hiện ngày1970. Chuyển sang `formatBookingWallDate(appointmentDate)` dùng chung; không chuyển calendar date theo timezone máy. Readonly DB xác nhận booking mới có ngày `2026-10-03`.
- Route `/` dựng element bằng `useAuthStore.getState()` một lần, giữ redirect phiên cũ. Trên demo sau logout, link Trang chủ quay lại login qua customer route. `App` nay subscribe trạng thái access-token/sessionType. Actualsource baseline5FAIL →5PASS; kiểm tra login/logout không remount, cold authenticated cả ba workspace, đổi workspace và mất token. Actual browser Owner login → reload protected page → logout → Trang chủ PASS, không phải chỉ HMR proof.

Browser thật: customer và Owner đọc review đã phục hồi ở **375/768/1024/1440px**, tám viewport cases PASS; ngày3/10/2026, trạng thái đúng, không document horizontal overflow. Đã xem screenshots desktop và mobile trực quan. Đây là read-only final-state acceptance sau API mutations, **không** acceptance submit từng form review qua UI. Các phiên QA do root mở đã logout; demo để lại trang chủ công khai. Captured browser error logs:0, không suy ra toàn bộ web không có lỗi.

Ảnh: `report-output/bugreport-continuation-20261012/review-customer-375-full.png`, `review-customer-1440.png`, `review-owner-375-visible.png`, `review-owner-1440.png`, `root-route-ui-final.png`. JSON UI: `review-ui-regression.json`, `review-owner-ui.json`, `root-route-ui-regression.json`.

### Gate và phần còn thiếu

Backend selected safe unit **127 suites/1212 PASS** (loại `*.integration.spec.ts`; có13 audit tests), typecheck/build PASS. Web **176/176 PASS** (có5 root-route tests), production build PASS. Mobile **220/220 PASS**, typecheck và Android Hermes export PASS. Không cộng targeted/full reruns thành unique scenarios. Sandbox spawn EPERM, lệnh mobile test sai cwd và lỗi TypeScript annotation trong test mới được giữ trong log riêng; corrected gates nêu trên đạt. Không coi các lỗi harness này là product bugs.

Evidence mới ở `report-output/bugreport-continuation-20261012/`; final `checkpoint-final.json`, `source-manifest-final.json`. Source SHA256 **01c1bb06e4e50cdef31d981a7844d3b37cfaa41c02f8a017467064bf828a388e**, 629 code files trong ba `src` (kể cả colocated tests); thuật toán/paths/hash từng file ghi trong manifest. Đây là code manifest, không phải hash DB hay mọi asset/package trong repo. HEAD6a2b438 giữ nguyên, chưa commit/push lượt này.

**wholeProductComplete=false.** Còn native device acceptance sau merge; review submit UI và concurrent DB race; historic consent thiếu hai source rows; production domain/deploy/storage/restore target; external OTP/email sandbox; mọi forms/control/late/day-boundary/overrun và toàn matrix cron/channel chưa có proof. Finance/refund live QA EXCLUDED, UI vẫn ẩn và code/data còn nguyên. Impact/request crossbranch code gap đã xử lý, live native/category coverage vẫn PARTIAL. Các giới hạn này không được chuyển thành PASS vì số test đã tăng.

## Checkpoint tiếp tục 12/10 — kiểm chứng hành động thật và bản khôi phục

Đây là bổ sung sau checkpoint trên, không đổi kết quả lịch sử thành PASS. Giữ nguyên HEAD và mọi thay đổi hợp lệ; không seed/reset/drop, không ghi tài chính. Evidence ở `report-output/bugreport-completion-20261012/`. `coverage-reconcile.md/json` đối chiếu mười nhóm lỗi gốc và các yêu cầu checkpoint, không lấy số control được khám phá làm số chức năng nghiệm thu.

### Đánh giá: toàn chuỗi qua giao diện và race PostgreSQL

Trên booking COMPLETED QA sẵn có `366812b4-0f9b-47bf-a16d-05560f2d4208` / `BB-2026-0100018`, customer3 tạo đúng một đánh giá qua UI; Owner báo cáo; platform ẩn; tác giả khiếu nại; platform chấp thuận qua các nút thật. Review mới `eae335fb-683c-411d-9707-f4488de6ce37`, appeal `aab077b5-f1fd-459c-8961-ff9fca8def08`. Đã kiểm tra lý do rỗng/whitespace không submit, trạng thái sau reload, bốn history events và bốn thông báo đúng người nhận. Một thông báo kết quả của chính phiên test được mở/đánh dấu đọc; link dẫn về đánh giá đúng. Hash booking/items/payments/grants trước và sau không đổi. Auth telemetry login/logout là thao tác setup riêng. Trace `root/review-ui-steps-final.json`, guard `root/review-ui-before.json` và `review-ui-after.json`; ảnh `root/review-*.png`. Các nhầm lẫn helper về tên nhãn/redirect được giữ, không mutation lại để chạy đẹp log.

Hai lỗi tìm được đã sửa: review REPORTED hiện “Đang được xem xét”; khi đã có khiếu nại PENDING, UI hiện “Khiếu nại đang chờ xử lý” thay vì mời gửi lần nữa. Backend my-appointments trả boolean `hasPendingAppeal` từ dữ liệu thật, không lộ relation nội bộ. Sau submit thành công hoặc mất phản hồi, UI refetch trạng thái server và chặn thao tác dựa trên dữ liệu cũ. Baseline API2FAIL/1PASS, web3FAIL; regression API3PASS/web3PASS. Không tự suy đoán thất bại khi phản hồi bị mất sau commit.

Race riêng trên booking QA COMPLETED `724d2ca9-1377-4177-88a2-fcc7e36c4c0c`, review `418bda34-2b85-4d4c-a622-2a6315e30e1b`, appeal `7c55d3f3-3967-4fd5-8807-b6944ca1c2af`: hai submit đồng thời chỉ tạo một appeal; approve/reject đồng thời chỉ một quyết định commit. Final APPROVED, một report/appeal, bốn history/bốn notices; request audit đúng một lần, bảo vệ fixture nền. `concurrent-review/race-results.json` có64 checks PASS và `final-audit.json` xác nhận cuối. Loser400/409 theo trạng thái/arrival, không miễn mọi HTTP lỗi. Không dùng transaction mock để thay bằng chứng này.

### Thông báo dễ hiểu, tìm kiếm đúng nội dung và validation

Thông báo báo cáo cũ hiển thị `OTHER/MEDIUM` được chuyển thành nhãn tiếng Việt khi đọc, không sửa row lịch sử. Producer mới dùng cùng mapping. SQL tìm kiếm áp dụng presentation trước filter/pagination, giữ user scope; “trung bình”, “TRUNG BINH” và khoảng trắng trả cùng thông báo thật. Chỉ áp dụng đúng loại/tựa thông báo báo cáo, không thay nội dung tùy ý của người dùng.

Report/appeal reason giới hạn1000 ký tự đúng form; category/severity ngoài tập hỗ trợ bị400 trước ORM. Targeted7 suites65PASS. `root/notice-and-validation-live.json`:18 checks/12 requests PASS trên API3014 đã build, bốn input sai không đổi domain rows; stored notification body/hash giữ nguyên. Actual browser search ở375/1440px trả một thông báo đúng, không còn enum thô/overflow; ảnh `root/notice-localized-search-375.png`, `notice-localized-search-1440.png`, JSON `notice-ui-regression.json`.

### Khôi phục toàn DB và media trên runtime độc lập

`storage-restore/results.json`: pg_dump dùng đúng exported READ ONLY snapshot, restore vào database scratch mới `beautybook_test_bugreport_restore_1791810505095`; **171 bảng/9360 rows** có count và canonical UTC hash giống snapshot, schema/owner/ACL giống nhau. **65/65** file tham chiếu được copy và SHA256 recheck, thiếu/thay đổi0. Không dùng `--clean`, không sửa database nguồn, không tạo lại hai consent lịch sử bị thiếu.

API riêng3015 dùng đúng scratch DB và volume vừa khôi phục, tám workers/email tắt; không restart API chính3014. `storage-restore/restored-app-results.json`: **208 checks PASS/137 requests**, cả65 tệp đọc được đúng MIME và byte SHA (4 public,61 private qua tài khoản platform có quyền);61 URL public của tài liệu private đều404. Owner hợp lệ đọc đúng byte, Owner khác403, anonymous private401. Domain/media/document/booking/payment/grant hashes không đổi; login/logout có auth telemetry, private reads append audit READ cần thiết trên **scratch**, không tuyên bố toàn DB bất biến sau các read có audit. Hai lỗi helper tên bảng/tên actor được giữ trong artifacts riêng; final không có product FAIL.

Dump và volume nằm trong thư mục ignored/private; không commit dữ liệu/secret. Đây là **local redeploy/restore acceptance**, không thay production target, snapshot DB+filesystem đồng thời hay backup cloud. Filesystem không có MVCC; source SHA được recheck, giới hạn được ghi rõ.

### Gate hiện tại và việc còn tiếp tục

Gate trước thay đổi PDF tiếp theo: backend **130 suites/1222 PASS**, typecheck/build PASS; web **179 PASS**, build PASS. Mobile source không đổi sau gate220PASS/typecheck/Hermes export đã ghi trên. Không cộng reruns thành unique scenarios. Các kết quả này ở `root/backend-unit-final.log`, `backend-typecheck-notice.log`, `backend-build-notice.log`, `web-tests-final.log`, `web-build-final.log`.

**wholeProductComplete=false.** Review UI và actual PostgreSQL race, local restored-app/media acceptance đã đóng phần QA tương ứng. Còn: PDF cấu trúc/page-content validation đang triển khai (header/MIME chưa đủ); onboarding/admin mutation UI; các case hữu hạn booking/time/context và positive geo/service filter; restricted impact/request recipient matrix; native device chưa kết nối; production target/domain; authentic historical consent source và external OTP/email sandbox. Giữ mục12/mục17 bỏ UI, mục14 ẩn UI/code-data giữ nguyên; finance QA EXCLUDED. Không gọi responsive browser là native acceptance.

## Checkpoint12/10 tiếp theo — PDF, onboarding và trạng thái Owner mới

### PDF được kiểm tra trước lưu và xem trước ổn định

`MediaService` gọi validator sau xác nhận scope, trước mkdir/writeFile/media transaction. PDF.js6.4.299 đọc nội dung từng trang; parsed objects từ pdf-lib1.17.1 được duyệt để kiểm tra cấu trúc page-tree/count/Parent/Contents, kể cả object stream nén. Không dùng regex thay parser. Worker có15s deadline/256MiB old-generation budget và cleanup; lỗi khởi tạo worker trả503. Tệp yêu cầu mật khẩu, không trang, bị cắt ngắn, count sai hoặc Contents không phải stream bị400. Trang trắng có thể đọc, văn bản và image-only scans hợp lệ vẫn được chấp nhận.

Review độc lập tái hiện count khai thấp làm bỏ qua trang hỏng, Contents string/dictionary bị xem như blank và constructor error500. Baseline bổ sung7FAIL/26PASS giữ nguyên; sau sửa **97 scoped tests PASS**, typecheck/build PASS. Dependencies pin đúng phiên bản, giữ lock entries trước đó. Báo cáo `report-output/pdf-validation/review-fix/report.md`; đợt đầu `report-output/bugreport-completion-20261012/pdf-validation/implementation-report.md` là lịch sử, không thay kết luận review sau. Validator kiểm tra các invariant nêu trên/readability, không chứng minh PDF conformance toàn bộ, antivirus, chữ ký hay giá trị pháp lý. Deadline/heap là per-worker, chưa có aggregate concurrency/load acceptance.

Trên API3014 đã build: `root/pdf-upload-live.json` **15checks/8requests PASS** — sáu negative uploads (count khai thấp/trang sau hỏng, Contents string/dictionary, zero pages, encrypted, Flate hỏng) đều400; media/version/booking/payment rows và SHA tất cả files không đổi. Audit của request bị từ chối vẫn được append đúng thiết kế, không gọi đây là “zero DB writes” tuyệt đối. PDF hợp lệ upload v1/v2 qua UI ở luồng dưới.

Demo thật phát hiện PdfPreview nhấp nháy loading/render liên tục: `hidden={busy}` làm canvas co lại, scrollbar modal biến mất, ResizeObserver đổi width718↔729 rồi render lại. `PdfPreview.jsx` nay giữ footprint canvas khi render và dùng visibility/aria-hidden; chỉ collapse khi chưa có document hoặc lỗi. Baseline `root/pdf-preview-layout-baseline.json` có canvas ẩn/hiện luân phiên trong các samples; ảnh loading giữ nguyên. Cold reload, v1/v2, trang1/2 và375/768/1024/1440 kiểm chứng đọc đúng label, canvas hiện, không overflow. Ảnh `root/onboarding-admin-pdf-v1-fixed.png`, `onboarding-pdf-v2-*.png`, `onboarding-pdf-v1-history.png`. Không dùng chỉ canvas count làm proof; đã đọc text và xem ảnh render trực quan.

### Đăng ký/xét duyệt doanh nghiệp qua giao diện thật

Tạo riêng Owner QA mới bằng API (setup, không claim registration UI/OTP), business `ed837c6c-fb74-4d76-a21e-1948441d281f`. Hồ sơ/tài liệu đều có nhãn QA, không chứa giấy tờ người thật. UI thực hiện: thiếu lĩnh vực→chặn; thông tin pháp nhân thiếu→chặn; mã thuế sai dạng→chặn; lưu nháp→upload header-onlyPDF400/no media; upload giấy phép v1→thiếu định danh vẫn chặn; upload đủ hai PDF→gửi xét duyệt; reload owner giữ trạng thái; Admin đọc PDF hai trang→REQUEST_INFO với lý do; Owner thay giấy phép v2→gửi lại; Admin đọc v2 và v1 lịch sử→APPROVE; Owner login lại đọc trạng thái đã duyệt/chưa có chi nhánh.

Final **3media,3versions,4business review events SUBMIT/REQUEST_INFO/RESUBMIT/APPROVE**, hai giấy tờ APPROVED, current license2, v1 media/name/history giữ nguyên. Mọi phase readback có hash bookings/items/payments/services/staff không đổi. `root/onboarding-ui-steps.json`, `onboarding-ui-*-db.json`, `onboarding-ui-setup.json` và ảnh `onboarding-*.png`. Thử resubmit đầu helper logout quá sớm nên chưa commit; DB chứng minh còn NEED_MORE_INFO. Không coi là lỗi sản phẩm hoặc retry mù: corrected action chờ trạng thái server trước chuyển phiên. Các selector/filechooser và history-label helper failures được giữ, không xóa log.

Hai worker thật chạy đồng thời trên allowlist **chỉ hai outbox IDs mới của hồ sơ này**, không drain toàn database. `root/onboarding-notice-delivery.json`:5checks PASS, hai projection/SENT đúng một lần/attempt1, user/target đúng, mọi outbox/notice khác giữ hash. Owner thấy hai thông báo thật; mở notice REQUEST_INFO cũ dẫn về profile đọc trạng thái **APPROVED hiện tại**, không cung cấp resubmit theo trạng thái cũ. Một notice mới được đánh dấu đọc bằng thao tác UI của chính Owner. Không claim email/push đã giao.

### Owner vừa được duyệt nhưng chưa có chi nhánh

Trên demo trước sửa, overview có selector trống và câu “Lịch vẫn sẵn sàng...” với0branches. Nay chỉ sau API branches trả thành công0 mới hiện hướng dẫn thiết lập `/salon/profile` đúng permission. Đang tải hoặc API lỗi không bị biến thành zero branches; lỗi có retry. Reads branches/dashboard được fence theo user/token/business/session generation/filter/unmount, dữ liệu cũ không ghi đè context mới. Finance flag/permission giữ nguyên. Actual JSX deferred **10targeted PASS**, toàn web **189PASS**; source test `SalonOverview.test.js`. Root UI375/768/1024/1440 PASS: không selector trống, không calendar ready giả, link thiết lập hiện đúng. Evidence `root/owner-no-branch-ui.json`, `owner-no-branch-baseline.png`, `owner-no-branch-fixed-*.png`. `SalonProfile` dùng nhãn/tone trạng thái tiếng Việt thay enum APPROVED, có Owner cold reload proof.

### Gate và giới hạn đang tiếp tục

Backend sau PDF **137suites/1319PASS**, typecheck/build PASS; web sau overview **189PASS**, Vite build PASS. Root xác minh189tests ở `root/web-tests-overview-final.log`; agent overview build chỉ Vite, root build trước overview đã chạy pipeline đầy đủ, bản build cuối sau mọi thay đổi sẽ ghi riêng. Source mobile không đổi từ gate220 trước. Sandbox spawnEPERM giữ log, chạy đúng quyền process được phép mới đạt; không đổi test để né lỗi.

Đang kiểm tra thêm availability-input ngày không tồn tại và variant map sai kiểu: baseline13FAIL/2PASS; source đã sửa fail400 trước hold-expiry/query,16 targeted PASS, chờ build/live và full gate mới. Chưa gắn các gate1319 phía trên cho source này. Positive geo/service filter đang đọc fixture thật, chưa claim PASS. ADB từng thấy emulator5554, nhưng kiểm tra chuẩn bị sau gián đoạn xác nhận không còn thiết bị/process/Metro; native vẫn NOT_RUN, không tự reset/cài lại/khởi động thiết bị. API/Vite cũ cũng đã dừng theo trạng thái process thực; root khôi phục demo đúngQA3014/5176, không resetdatabase. Backend source build/runtime có timestamp riêng, không dùng PID cũ làm readiness.

**wholeProductComplete=false**: các case timing/context/geo còn lại, restricted impact/request recipient matrix, native/production/authentic consent/external transports vẫn chưa nghiệm thu. Các nhóm review UI/race, local restore, PDF invariants/readable versions và chuỗi onboarding UI trên đã có proof đúng phạm vi. Finance EXCLUDED và ba quyết định12/14/17 giữ nguyên.

## Checkpoint12/10 — sửa phân trang/sắp xếp và số liệu tổng quan

### Input chọn giờ

`getAvailableSlots` trước đây chỉ regex date rồi dùng Date.UTC, nên30/02/tháng13 có thể bị normalize sang ngày khác; variantSelections array/scalar/value sai kiểu hoặc key không thuộc dịch vụ đi vào hold-expiry/query trước validation. Baseline **13FAIL/2PASS** ở `root/availability-input-baseline.log`. Nay kiểm tra calendar date exact roundtrip (có leap-day đúng, không năm0) và map dịch vụ/variant trước xử lý dữ liệu; không đổi policy lead-time/slot hay scheduled/actual timing.16targeted PASS, cùng policy/filter/sort suite78PASS.

API thật sau build `root/availability-input-live.json`: **13checks/11requests PASS**, sáu ngày sai và bốn variant maps sai trả400 đúng message; ngày leap hợp lệ đi tiếp tới readiness của branch UUID đã xác minh không tồn tại. Các row bookings/items/payments/services/branches/users không đổi. Đây là input boundary proof, không thay actual available-slot/check-in/overrun acceptance.

### Bộ lọc dương và sắp xếp toàn tập

Không dùng empty intersection để nghiệm thu. Business0 đã có15branches vượt limit10, nên preflight đúng chặn tạo fixture; không tăng setting/xóa branch/bypass quota. Dùng business1 đã được xác minh2branches còn capacity, qua API tạo **hai branch mới/four offerings/two unattached staff/four service links** và các giờ/policy/lifecycle của chính newIDs. Prices/duration/catalog/category copy nguyên nguồn; không sửa shared catalog/account/grants/geography hay business0/newOwner UI. Staff chỉ được activate đúng newIDs. Vùng/quận là dữ liệu QA có sẵn, không bịa địa danh thật.

`geo-filter-positive/positive-handoff.md/json` và `execution-280a4ea7-3b88-45e6-865a-8e98005c9ef1.json`: **81named checks PASS/65HTTP**, bốn positive accented/noaccent/uppercase-space/province queries trả đúng hai branchIDs; limit1 pages1/2 đúng thứ tự theo DB, page3 empty; per-branch service totals2 và search match trước paging. **159tables/9460 pre-existing rows** được bảo vệ theo row-ID/hash; chỉ telemetry login của hai actors được tách, own newrows thêm đúng allowlist. Không worker/email/finance/booking writes. Run này bind runtime cũPID25912, không gắn lại cho source/runtime mới sau đó.

`BranchesService.findAll` có lỗi giá/rating được sort sau skip/take. Nay giữ eligibility predicates, lấy lightweight candidateIDs + DB aggregates, sort metric/tieID trước pagination và chỉ hydrate cards của trang cuối; popularity dùng nondeleted count đúng projection. Newest có createdAt+ID tie. Baseline bổ sung23FAIL/6PASS; final targeted49PASS/typecheck. Không hydrate tất cả bookings/reviews/assets. Chi phí vẫn O(C) IDs và O(C log C) sorting; chưa benchmark production-scale/query plan và không thêm snapshot guarantee cho các reads khác thời điểm.

Root deploy sau GeoQA quiescent, API3014PID19068. `root/global-sort-live.json`: **142checks/65GET PASS** với SQL oracle độc lập trên toàn10public branches: newest/popular/rating/price_asc/price_desc, exact IDs/metrics, mỗi page limit1, page cuối rỗng, union không duplicate/mất dòng và repeated tie order. Oracle rows trước/sau không đổi; không sửa price/reviews để làm test đạt.

UI thật `/explore`: nhập service/khu vực không dấu → đúng hai offeringIDs; chọn giá thấp đến cao; cards vẫn đúng,4widths không horizontal overflow/broken image. Hai fixture cùng giá nên **UI riêng không chứng minh global price displacement**, proof đó ở SQL/API. `root/explore-positive-ui.json`, `explore-positive-viewport.json`, `explore-positive-*-visible.png`. First helper đọc count label cũ trong lúc skeleton nên IDs rỗng; raw result giữ `explore-positive-ui-harness-loading.json`, corrected đợi cards thật. Full-page capture lỗi công cụ được giữ trong viewport note; visible captures đạt. Fixture chưa upload ảnh thì placeholder giữ đúng thực trạng, không báo ảnh hoàn thành.

### Tổng lịch đầy đủ và lịch sắp tới của Owner

Demo Owner0 có hơn100lịch, overview cũ lấy `.length` của page100 làm tổng và hiện EXPIRED trong “Lịch hẹn tiếp theo”. Nay total/pending/completed dùng `meta.total` từ3requests limit1 đúng branch/date scope. Upcoming lấy hai nhóm PENDING/unfinished theo appointment order, bỏ terminal, page qua các lịch đã qua hôm nay và merge đúng sáu lịch sớm nhất. Failed count hiện `—` với cảnh báo, không biến lỗi thành0. Context/generation/branch/date fences và finance exclusion giữ nguyên. Backend filter chỉ ngày nên backlog hôm nay có thể cần thêm page; không fetch tất cả full rows chỉ để đếm.

Baseline3regressions FAIL; final **18overview tests/197web tests PASS**, build PASS. Logs agent được copy về `overview-counts/web-tests.log`, `web-build.log`. Root cold UI đọc **112total/4completed/0pending**, khớp SQL READ ONLY độc lập; exact6upcomingUUIDs/order khớp, không EXPIRED. `root/owner-overview-db-oracle.json`, `owner-overview-counts-ui.json`, `owner-counts-viewport.json`, ảnh `owner-existing-dashboard-counts-fixed.png`/`owner-counts-fixed-*.png`;4widths đạt, capturederror0. Không lấy initial page100 hay số viewport làm tỷ lệ toàn sản phẩm.

### Gate và điểm tiếp tục

Backend final **139suites/1365PASS**, selected safe unit excludes integration specs; build/typecheck kiểm tra tương ứng source dưới evidence. Web final **197PASS**, production build PASS. Mobile source không thay đổi,220prior tests/type/Hermes export vẫn ghi phạm vi cũ. Các lỗi sandbox/runner được giữ; secret scan snapshot180text artifacts/docs không tìm runtime/fixture secrets hoặcJWT, private credentials/dump bị loại có chủ đích và nằm ignored. Chưa commit/push.

Review UI/race, local restore, PDF/onboarding/version/notice, positive geo/default pagination, global branch sort và overview counts đã được xử lý/kiểm chứng theo từng case trên. **wholeProductComplete=false** vẫn giữ cho finite timing/overrun/day-boundary/latest selection, restricted impact/request event matrix, native runtime, production target/domain, authentic historical consent sources và external sandbox transports. Không tự tạo lịch sử consent, domain, medical/identity evidence hoặc đổi policy để chấm đạt. Mục12 bỏ UI/flow,14 ẩn giữ code/data,17 bỏ raw-detail UI giữ audit vẫn là quyết định bắt buộc.

## Checkpoint12/10 — ảnh upload trên kết quả tìm kiếm

`services.search()` không chiếu trường ảnh trong SQL, trong khi card public đọc images/imageUrl/coverImage. Baseline DB có4public image links ởhai offerings không đủ điều kiện xuất hiện trên search; `root/public-media-baseline.json` ghi **NO_ELIGIBLE_OMISSION_REPRODUCED**, không dùng nó làm proof lỗi UI. Chưa có linked staff inactive/deleted phù hợp trong snapshot này.

Để tái hiện hợp lệ, Root upload **một ảnh QA hình học có chữ PORTRAIT/BEAUTYBOOK QA ONLY,1400×2400** vào đúng offering `3c2f64e4-6e18-4133-b0fa-fa8c88be1594` của branch mới trong ca geo. Đây không phải chân dung/cơ sở/kết quả trị liệu, cũng không được tính là ảnh đã tạo cho mọi thực thể. `root/public-media-fixture.json`:26checksPASS, đúng một media PUBLIC/IMAGE `b39bdece-e748-4c51-b2cc-725dbb06b574`/một ServiceImage sort0; tất cả hashes của rows có sẵn còn nguyên, stored bytes đúng sample. Offering công khai trả về thật nhưng URL ảnh vẫn thiếu; actual card `is-placeholder`, images[] dù link ảnh đã lưu, tại `root/public-image-card-before.json/png`.

Đã bổ sung scalar subquery lấy đúng PUBLIC/IMAGE của **offeringID đó**, order sort_order/id, limit1, không join fanout ảnh hưởng paging/count. Staff-count lateral query nay cùng eligibility với helper dùng chung: cho phép userIdNULL; loại linked user inactive/deleted. Không đổi pricing/catalog/tenant predicates. Unit SQL-contract/response mapping baseline2FAIL/3PASS →29targetedPASS/typecheck. Guard linked-user chỉ có source/model proof trong lượt này, **không** claim đã chạy suspend/live recipient test mới.

Sau build và controlled restart QA3014PID23704: `root/public-media-live.json` **11checksPASS**, query có/không dấu trả đúngURL, một row exactID, không gán ảnh nhầm sang fixture còn lại; PUBLIC PNG byteSHA đúng nguyên bản; media/service/staff/booking/payment hashes không đổi trong regression. Actual browser cold reload hiển thị ảnh đúngURL/kích thước, `has-image is-loaded`, không placeholder của offering đã xử lý. Đã xem ảnh375/1440 trực quan, cả375/768/1024/1440 không overflow/broken image, crop ratio1.6 cố định và alt tiếng Việt. Evidence `root/public-image-card-after.json`, `public-image-card-after-*.png`. Fixture chưa có upload ởcard bên cạnh vẫn placeholder đúng thực trạng. Không claim toàn website có đủ ảnh hoặc số526 từ kế hoạch.

Backend mới **140suites/1370PASS**, build/typecheck scoped đạt, `root/backend-unit-public-media-final.log`/`backend-build-public-media.log`, `public-media-search/typecheck.txt`. Web không thay source sau197PASS/build đã ghi. Source manifest sau này phải bind lại vì ServicesService/test mới đã thay đổi; snapshot644SHA12f32 trước đó là lịch sử.

Timing-next03: `timing-final/plan.md`, `scope.json`, `run-prepared.cjs`, `checkpoint-next03.json` đã chuẩn bị và kiểm tra READ ONLY/syntax/guard; **chưa execute**. Hai branches tự nhiên cũ còn đủ giờ/policy/mappings, nhưng credential provider gốc không lưu lại; owner được phép thao tác theo backend. Proposal một variant mới1min+29buffer vàhai bookings riêng không đổi base duration/hours/policy hoặc parent finance. Tại23:21:53, guard ngân sách trước latestStart23:29 đã không còn đủ8min, nên phải chờ cửa sổ tự nhiên tiếp theo. Không hạ guard/chỉnh giờ/fakeclock để đạt. Root phải review full script, rebind runtime/source và recheck dữ liệu trước khi cấp approval file/execute; prepared script không phải product PASS. Native/production/consent/external và latest-selection/event cases tiếp tục PARTIAL/NOT_RUN.

## Overlay13/10 — timing tự nhiên, availability và lựa chọn mới nhất

Bổ sung từ evidence đã chạy; các checkpoint/preparation, FAIL và BLOCKED phía trên giữ nguyên lịch sử. Timeline dùng giờ local UTC+7: timing chạy **13/10/2026 00:00:31–00:06:04** (12/10 17:00:31–17:06:04 UTC), đúng giờ branch 00:00–23:59, không fake clock hay đổi hours/policy. **90 assertions PASS/37 HTTP**, không phải90 unique product scenarios. Hai booking/guest mới và một variant mới1min+29min buffer được giữ; LATE_NOT_STARTED rồi START thật, OVERRUN, COMPLETE và running SKIP có actualStoppedAt được xác minh. Planned schedule không đổi; reservation đang chạy chặn cùng ngày và ngày kế tiếp rồi được giải phóng khi terminal. Năm failed creates không có orphan;19 bảng finance/benefit giữ exact rows/count/hash, rows có sẵn trong7 bảng booking/item/service/variant/staff/mapping/role được giữ. Hai START đều sau nửa đêm: **natural physical midnight crossing NOT_PROVEN**; next-day conflict và cross-day reject không chứng minh chạy xuyên nửa đêm.

Evidence: `report-output/bugreport-completion-20261012/timing-final/execution-qa-timing-747d7981-004d-48bf-bfb4-4f6380665b4a.json`; preparation/giới hạn lịch sử: `report-output/bugreport-completion-20261012/timing-final/plan.md`.

Sau timing, Root sửa availability bằng shared `assertValidDuration(totalDuration)` trên tổng thời gian chiếm chỗ. Baseline mocked **4 FAIL/37 PASS →41 PASS**; không áp minimum cho từng service thành phần. Live baseline và after mỗi lượt **7 checks PASS**: baseline tái hiện lỗi standalone15min bị quảng cáo HTTP200 (staff explicit và auto); after trả400 “Slot tối thiểu là 30 phút”;30/45min hợp lệ vẫn200, protected rows không đổi. PASS baseline là proof tái hiện lỗi, không phải behavior đúng. Không cần và không claim live tạo booking15min. Backend safe gate sau sửa **141 suites/1382 PASS**, typecheck/build PASS theo bàn giao Root. Runtime3014PID22348, tám workers/email tắt là marker của đợt này, không phải health hiện tại.

Evidence: `report-output/bugreport-completion-20261012/availability-minimum/evidence.md` (baseline/proposal trước fix); `report-output/bugreport-completion-20261012/availability-minimum/jest-final.json`; `report-output/bugreport-completion-20261012/availability-minimum/live-baseline.json`; `report-output/bugreport-completion-20261012/availability-minimum/live-after.json`; `report-output/bugreport-completion-20261012/availability-minimum/backend-full-final.log`.

Latest-selection thêm **15 actual JSX/source tests PASS trên implementation không đổi**, không xác nhận production regression/fix. Handoff lúc đầu chưa tích hợp file vào npm test là lịch sử; normal npm test sau tích hợp **212 PASS**, web build PASS. Root CUA dùng actual React DOM, proxy delay authentic API GET và controlled stale errors: ba case mạnh PASS ban đầu; old staff success chỉ **OBSERVED** vì old/current slots giống nhau. Current-error→retry tại375px thêm PASS: tổng **4 strong PASS +1 weak observation**, không tạo booking. Không suy ra native hay mọi service/staff/date/context combination.

Evidence: `report-output/bugreport-completion-20261012/latest-selection/handoff.md`; `report-output/bugreport-completion-20261012/latest-selection/npm-test-integrated.txt`; `report-output/bugreport-completion-20261012/root/selection-ui.json`.

## Overlay13/10 — native HOME_LOADED lịch sử và disconnection khi resume

Prep00:05local xác nhận primary Pixel_7a / `emulator-5554` / `com.beautybook.mobile`; zero-devices không còn đúng tại thời điểm prep. Root sau đó thu actual served Android bundle **HTTP200/6,292,275 bytes**, SHA256 `1eb0c11ae551a251fb355311a75a3e4c025a67637de7b12fade9eff554a1d6b8`, API override3014. Root capture **12/10 17:13:38–17:13:40 UTC (13/10 00:13local)** xác nhận primary app foreground và **HOME_LOADED**. First-open spinner là quan sát lịch sử, không phải permanent bug. Bounded read-only HOME proof và runtime-ready marker khi đó không chứng minh native all-roles acceptance.

Evidence: `report-output/bugreport-completion-20261012/native-prep/native-prep-summary-20261013-000516.md`; `report-output/bugreport-completion-20261012/native-prep/served-bundle-proof.json`; `report-output/bugreport-completion-20261012/native-prep/primary-load-observation.json`; screenshot Root đã xác minh `report-output/bugreport-completion-20261012/native-prep/primary-load-observation.png`.

**Cập nhật sau interruption, 13/10/2026 02:40UTC (09:40local), theo bàn giao Root:** independent ADB get-state hiện `emulator-5554 NOT FOUND`; daemon đã dừng và ADB tự khởi động lại daemon. Không có emulator/app action mới. Current native role QA lại **BLOCKED_NO_CONNECTED_DEVICE**; HOME_LOADED capture cũ vẫn giữ giá trị trong phạm vi/thời điểm của nó. API/Metro PID/listener markers trên chỉ là lịch sử; Root đang kiểm tra listeners/health mới trước resume, **chưa có proof runtime READY hiện tại**. Không thêm native acceptance từ disconnection hoặc daemon start.

**wholeProductComplete=false.** Native all roles, physical midnight crossing, các event/recipient/notification paths chưa covered, external transport/OTP/email, production targets và authentic historical consent sources tiếp tục PARTIAL/BLOCKED/NOT_RUN theo từng mục. Finance QA EXCLUDED; giữ ba quyết định bắt buộc: mục12 bỏ UI/flow, mục14 ẩn UI nhưng giữ code/data, mục17 bỏ raw-detail UI nhưng giữ audit. Test counts không là product percentage. Root sở hữu checkpoint/source manifest và QA tiếp theo; overlay này không rebind source hay sửa checkpoint. Root đã skip prompt lookup vì checklist hiện có. Evidence nằm dưới ignored report root, không commit private artifacts; lượt này chỉ append hai báo cáo được giao, bảo toàn dirty files khác.


## Overlay13/10 — request expiry, impact privacy và mobile target

Source mới: API `operations/impact.service.ts`, helper `impact-provider-recipients.ts`,25 regression tests; mobile `utils/operationNotifications.ts` và actual producer contract test. Impact provider recipient selection trước đây dùng user snapshot, thiếu active/live scope và kèm relatedBookingId/bookingCode. Baseline model dùng actual ImpactService/NotificationsService:19FAIL/6PASS. Sửa eligibility trong final Serializable transaction, scope business/exact profile branch, loại tài khoản/profile inactive/deleted/unlinked/expired/wrong scope; provider chỉ có UUID hint và label, không summary relation/code/private reason. Customer vẫn có thông tin của mình. Focused40PASS, backend142suites/1407PASS/type/build. Không thay finance behavior. Independent read-only review không thấy actionable finding trong phạm vi mới.

Request-worker: một booking QA mới `e78c198f-28cf-461d-a07d-4e6dff1c130b`, không duplicate hoặc sửa base fixture. First-stage delivery hai real workers→một notice/attempt1, foreign read/count0, badge/read đúng được giữ trong artifact có FAIL cuối do harness thiếu Idempotency-Key. Continuation reuse exact booking,56 assertions/14HTTP PASS: customer request→owner reject→notice hai bên, request mới staged deadline expired→hai compiled expiry workers một winner/retryzero, booking không hủy, không success notice sai. Invalidation ở gateway seam, không live socket/native proof. Deadline stage chỉ request mới; không claim chờ24h tự nhiên.19financial tables exact/all old11tables retained. Các lỗi preflight/schema/missing header của runner được giữ; label suy đoán DTO của initial400 được rút lại vì body không được ghi. Xem `report-output/bugreport-completion-20261012/request-worker/REPORT.md` và `results.json`.

Impact live:59 assertions/13HTTP PASS, compiled QA3014PID22456; một case/item mới, synthetic overdue deadline trên đúng booking QA trên. Hai deadline workers không duplicate; ba notices owner-warning/customer/provider mỗi outbox SENT/attempt1 qua hai delivery workers. Foreign owner detail/resolve403, APPROVED_EXCEPTION qua API thật, retry409/no extra outbox, complete hợp lệ, completed case không enqueue thêm. Actual PostgreSQL/NotificationsService provider list không có relatedBooking summary; không claim login staff JWT hay native. Independent SQL readback5PASS, eligibility oracle xác nhận đúng provider, case/item/audit/notice persisted;19financial tables exact/old13tables retained. Không pause branch, reassign booking hoặc xử lý tiền. Evidence `report-output/bugreport-completion-20261012/impact-notification/REPORT.md`, `live-results.json`, `readback.json`.

Mobile deadline target: producer thực gửi OPERATIONAL_IMPACT trong khi helper chỉ nhận OperationalImpactCase; actual producer contract baseline FAIL. Sửa canonical+legacy cho OWNER, STAFF vẫn không vào impact; UUID strict/booking precedence/no untrusted actionUrl.67focused/222full source-mockPASS, typecheck và Android Hermes export PASS; sandbox compiler spawnEPERM lần đầu giữ riêng, retry compiler được phép đạt. Không suy từ export sang runtime/native. Native hiện không kết nối; prior HOME proof và source10hash/bundle cũ không chứa fix này.

Current code snapshot649files SHA256 `682a248296dc72f898d724935ad4979f073a3cf8fc2c453bbfaf55a3ada8c070`; additional package/test/dist hashes ở root/checkpoint-current.json. Web212PASS/build là gate gần nhất không bị thay production web sau đó. API fresh health/database-up và demo HTTP200 được ghi sau restart; PID22456 dùng guarded test database, tám global workers/emailoff. Browser restore thử tab ID lịch sử bị protocol policy chặn; không tính là product failure hay current screenshot proof. Demo panel mở bằng URL HTTP đã xác minh được queued, không tính là nghiệm thu UI mới. Không reset/emulator replacement, seed/delete/backfill/push.

Remaining finite scope vẫn được giữ: native customer/staff/owner và foreground/reconnect/keyboard/back cần connected primary device; physical running-service midnight crossing chưa chứng minh; các onboarding/forms/action combinations chưa có evidence vẫn NOT_RUN; production target/domain và sandbox external OTP/email/push unset; hai authentic historical consent source rows thiếu. Source hiện không phát opening/completion notice cho impact, không tự thêm behavior chưa được quyết định; deadline stored-owner eligibility boundary chưa live-tested. Finance EXCLUDED, ba quyết định12/14/17 nguyên vẹn. `wholeProductComplete=false`; tests/assertions không được cộng thành unique scenarios hoặc100% sản phẩm.


## Overlay13/10 — footer không bị thanh điều hướng che và CTA khách hàng

Lỗi mới tái hiện trên customer notifications: khi cuộn hết trang, thanh điều hướng cố định che liên kết “Dành cho cơ sở”; hit-test tại tâm liên kết trả về mục lịch hẹn. Baseline `footer-clearance/baseline.json` và ảnh694px được giữ. Root cause: footer nằm ngoài main, nên padding của main không tạo khoảng trống cuối shell. Sửa `CustomerShell.jsx` bằng padding dưới65px cộng safe-area ở mobile, md trở lên0; không giấu overflow hay thu nhỏ chữ.

Actual browser regression375/768/1024/1440px: cả20 liên kết footer hit đúng href, không bị nav che, không tràn ngang; screenshot `footer-375.png` tới `footer-1440.png`. Bấm thật mobile và desktop mở `/for-business`, CTA đi `/register/business` và khách hàng nhận thông báo chưa có quyền tạo doanh nghiệp, không bị đưa sang lịch hẹn. Refresh chờ auth/render hoàn tất vẫn giữ thông báo đúng quyền; không submit form, không tạo doanh nghiệp/nâng quyền. Quan sát reload quá sớm trả false được giữ và giải thích riêng trong `cta-checks.json`, không tính thành product failure/PASS. Logs chỉ có React Router future warnings đã có, không có error trong tập logs thu được.

Web212/212 tests và build đạt sau bản sửa, initial sandbox spawn EPERM giữ riêng. Evidence toàn đợt tại `report-output/bugreport-completion-20261012/footer-clearance/`; current manifest/checkpoint đã rebind SHA `e24aa86c0fbd67d0be5b199a30f9865ff5d32af68db40855c90087b0385ccbbb`. Backend/mobile gates giữ nguyên phạm vi trước; native vẫn cần thiết bị phát triển kết nối. Whole-product chưa hoàn tất.


## Overlay13/10 — sidebar, actual CTA, deadline owner scope và nhãn lịch sử

Hai lỗi layout dùng chung đã xác minh actual browser: CustomerShell footer bị nav dưới che đã sửa; AppShell sidebar đóng vẫn nằm trong tab order, Tab đi vào “Đóng menu” ở x<0. Sửa `invisible lg:visible` khi đóng, `visible` khi mở;375/768 Tab tới Mở menu hiện trên màn hình,1024/1440 tới navigation desktop;4widths không tràn ngang. Mở menu375→Tài khoản đúng `/salon/account`, sidebar đóng lại. Không suy ra native hoặc tất cả vai trò từ một Owner run. Evidence `navigation-keyboard/baseline.json`, `regression.json`, `open-navigate.json` và ảnh trước/sau.

Business CTA actual browser: chưa đăng nhập→form Owner→login `from=/register/business` và refresh giữ intent; customer12 login trở lại thông báo giới hạn quyền, Owner0 APPROVED login tới hồ sơ BeautyBook QA0, refresh/Back đúng. Không submit đăng ký/đồng ý điều khoản/tạo doanh nghiệp hoặc nâng quyền. Existing draft/pending/info/rejected entry-path combinations chưa khép bằng cùng lượt UI. Form DOB Owner375 nhập bàn phím ngày tương lai có inline error/aria-invalid, submit bị chặn, reload ngày cũ còn nguyên; initial date fill không phát onChange được giữ như harness observation. Evidence `registration-intent/results.json`, `profile-birthdate-ui/results.json`.

Deadline privacy: worker cũ gửi reason mới cho stored case owner sau mất quyền/chuyển chủ; baseline actual-worker doubles19FAIL/12PASS. Sửa Serializable enqueue chọn actual Business.owner.userId, active/nondeleted account, live owner grant theo resolver; dedupe case/deadline/recipient, legacy same-recipient không replay và warning của người cũ không chặn chủ mới.31 focusedPASS; existing test double được cập nhật transaction/access contract, không fallback bỏ guard. Một case QA mới `32cb0040-0270-441a-9fd2-7c8ca0a3f62d` có historical ownerId=foreignowner1 là prerequisite synthetic; không chuyển chủ business hay pause chi nhánh thật. Hai compiled workers trên PostgreSQL→1warning, hai deliveryworkers→1notice/attempt1; Owner0 GETcase/notice200, Owner1 case403/notice không thấy.51assertions/8HTTP;19financialtables exact và oldrows11tables retained. Syntheticcase cuối CANCELLED bằng DBguard để tránh futurewarn, history giữ nguyên; không gọi đó là product lifecycle.

Nhãn deadline mới và lịch sử dùng tiếng Việt: helper chỉ thay known anchored enum prefix của đúng SYSTEM/impact/deadline title; giữ reason chính xác, không sửa từ enum-like trong ghi chú và không update database. SQL search dùng cùng presentation trước paging. Baseline2FAIL/3PASS→5PASS; realAPI12assertions/4HTTP +4browserwidths xác minh legacy warning được đọc/tìm với “tạm ngừng”, toàn notifications/outbox/cases giữ exact. Search UI cần Enter; initial fill-only timeout là harness chưa submit, được ghi riêng. Cảnh báo đã enqueue trước khi quyền thay đổi vẫn là historical intent; chưa thêm delivery-time reauthorization/history cleanup.

Latest gates: API143suites/1440PASS/type/build; production lint0errors ở worker +hai label helpers; web212PASS/build sau AppShell fix; mobile222source/mockPASS sau cập nhật actual producer boundary, production mobile không thay. Current QA3014PID19140 freshdatabase-up,8globalworkers/emailoff; Vite5176đang chạy. Bản compiledworker test trước refactor labels và API request logs giữ hash/runtime ban đầu; current manifest651codefiles SHA `bd3f8b8ab6746555121ba9f9dc0fd3abbfeba99b8d2a9fe6d439bf550d08f03d`. Provider JWT gap BLOCKED vì password hiện có không match,19guardchecks+SQL notice/outbox exact nhưng không login/reset/forge; distinct-staff DOM gap chưa có dữ liệu khác nhau, không sửa fixture để ép PASS. Remaining native/production/external/consent/timewindow vẫn chưa hoàn tất; không tuyên bố100%.


## Overlay13/10 — vận hành theo tên, accessibility và chặn hold quá hạn

Operations dùng tên nhân viên/chi nhánh có scope, clear và fence lựa chọn cũ; giao diện lỗi/trống/retry rõ, required đúng field. Nhãn enum và legal keys thô được thay bằng tiếng Việt. Finance flag ẩn CANCEL_REFUND và payout form, guard stale choice, code/data vẫn giữ.11 actual JSX/helper tests; Field sửa primary control khi children có sibling/false,13 baseline failures→21 tests đạt, label/required/error association giữ đầy đủ. Menu mobile trap Tab/ShiftTab, Escape trả focus, resize mở khóa scroll; final actual focus proof đạt.

Actual Operations375/768/1024/1440: named staff/transfer choices, legal required/finance exclusion và empty detail được kiểm tra. Một REASSIGN trên lịch QA mới persist đúngstaff/revision,38 SQL checks giữ19financialtables exact và oldrows; nó xảy ra sau hold deadline khi policy còn chưa chốt, nên được giữ làm **baseline behavior**, không là nghiệm thu policy mới. Lịch này sau đó EXPIRED qua luồng expiry bình thường. Một lịch PHONE mới khác được xác nhận trước deadline cung cấp slot khác nhau thật cho hai nhân viên; actual back/change-staff/return, release old HTTP200 không đưa00:00 vào lịch mới hoặc xóa selection00:30. Bốn widths không overflow. Không suy ra old response được browser tiêu thụ hay same-mounted/native race.

Provider controller gap được khép trong phạm vi bằng normalJWT của một provider QA mới,58assertions/17HTTP: notification generic/no live booking relation/private reason; personal work scoped, foreign owner không thấy;19finance exact/old28tables retained. Identity/mapping/case prerequisite synthetic được ghi rõ; không đổi password/grant cũ. Evidence cũ BLOCKED credential giữ nguyên theo timestamp.

Người dùng chốt chặn ngay khi hết hạn, muốn tiếp tục phải đặt lại. Shared backend guard đọc sau parent lock, deadline<=serverNow và không có execution status evidence; áp dụng confirm/add/reassign/move/resize/bulk assign/request scheduling approval và direct branch transfer. Legacy null deadline, execution exception, cancel/reject/REPRICE và lifecycle hiện tại giữ nguyên.93newactual-service tests đạt (baseline38failure);6transfer tests thêm, baseline3failure;3oldfixtures bổ sung locked parent read, không bỏ assertion. Safe full gate144suites1539PASS/type/build,web257PASS/build,mobile222source/mock giữ phạm vi trước. Live tái sử dụng đúng lịchQA mới của đợt này, deadline tự nhiên03:26UTC đã qua nhưng parent cònPENDING:7 scheduling entrypoints409 đúngcode, không tạo thêm lịch/sửa deadline;5continuation requests có oracle exact158domain tables và audit table riêng chỉ thêm failed security records được chứng minh, stage1 hai calls/failure oracle itemId được giữ. Không audit thành công/outbox/tài chính do rejection; không tắt security audit. Approval live NOT_RUN vì không có request hợp lệ;93service tests kiểm cả hai approval paths.

Drawer web dùng server clock anchor, hiện cảnh báo cố định và bỏ confirm/add/reassign/resize/START của pending unserved đã hết hạn; hủy và các quyền độc lập giữ nguyên.13 helper tests kiểm boundary/null/unknown/execution exception. Actual375/768/1024/1440 cảnh báo hiện, confirm/add không còn, hủy enabled, no overflow; menu chỉ đọc không submit. Lượt sai tab viewport/Escape đóngdrawer giữ artifact, không tính product failure. Native/mobile UI không suy ra từ browser. Evidence pending-hold-live/ui-regression.json và hold-ui-*.png.

Current runtime26672/QA3014 freshdatabase-up,8workers/emailoff; source 659 files SHA `b60cb2dd099bc43b45dfa35c68ed94eea2d128c6bc79e7c038501b01f91229d9`. Không reset/seed/drop/delete/history backfill, không live finance. Native device/external/production/authentic consent và physical midnight còn thiếu; wholeProductComplete=false.


## Overlay13/10 — yêu cầu sau hold deadline và Pixel 7a hiện tại

Gửi yêu cầu đổi giờ/đổi nhân viên mới cũng bị chặn khi PENDING chưa phục vụ đã hết thời gian giữ chỗ. Guard chạy sau parent lock/fresh read và quyền sở hữu, trước policy, lazy request expiry, request create và thông báo. Yêu cầu hủy vẫn giữ rule cũ; foreign customer nhận lỗi quyền trước thông tin deadline.16 actual-class regression tests: baseline6FAIL/10PASS →16PASS; không sửa scheduled/actual/finance. Safe full gate mới **145 suites/1555 tests**, typecheck/build đạt trên compiled QA3014PID15836. Lượt concurrent timeout PDF do áp lực RAM và interruption được giữ; lượt sequential dùng timeout/assertions bình thường, không loại PDF để lấy PASS.

Actual API dùng customer9 hợp lệ và đúng lịch QA mới của đợt này, deadline tự nhiên đã qua: hai POST RESCHEDULE/STAFF_CHANGE mỗi loại một lần trả409 PENDING_HOLD_EXPIRED.327 retention checks gồm158 domain tables exact, audit cũ giữ nguyên và chỉ hai failed security records đúng actor/target/request; không tạo request/lịch/deadline hoặc ghi tài chính.327checks là assertion, không phải327scenarios. Live approval còn NOT_RUN do không có request hợp lệ; source/service approval đã được kiểm thử riêng. Evidence: pending-hold-live/request-create-live.json; oracle preflight table-name failure được giữ, không replay writer.

Pixel_7a/emulator-5554 được người dùng bật. Sau ADB/VM mất phản hồi vì RAM pressure, phục hồi bằng cold boot đúng AVD cũ, không wipe userdata/reinstall/clone. Current Metro18136 phục vụ Android bundle200,6292329bytes SHA256 8b42ac800781814b4c9659003cad8c192b553cb642e0cc9a8b7903c058fd1265 với QA override3014; host bundle proof không chứng minh thiết bị tiêu thụ đúng hash. Fresh HOME PNG/XML nhìn thấy category/branch QA; Account tab và login form entry có fresh hierarchy và ảnh kế tiếp. PNG/XML không atomic: account-public-01.png cònHOME; login-empty-01.png cònAccount; không dùng ảnh trước-transition để chấm màn hình sau.

Một bulk ADB email input bị rơi ký tự; chưa gửi đăng nhập, chưa xác định nguyên nhân sản phẩm. Paced retry đã chuẩn bị nhưng **chưa thực thi** vì automatic approval review hết hạn mức, báo thử lại17:10 local; đây là lỗi review availability, không phải unsafe-action rejection. Không dùng tool/sandbox khác để vượt. Native CUSTOMER/STAFF/OWNER authenticated, keyboard/Back, offline/foreground, notification và media picker vẫn NOT_RUN. recovered-primary.xml bị INVALIDATED vì UIAutomator null-root nhưng helper đọc XML cũ; đã sửa unique path/error check/password redaction và giữ artifact cũ. Native acceptance-current.json ghi riêng giới hạn này.

Current source 660 files SHA256 `4abb4340fe0f8196750defe44e16424964feff646216e1374025d63b8bc1dd12`; 172 tracked dirty/45 untracked, không reset/commit/push. Hai code paths delta từ checkpoint trước được kiểm chứng; mọi thay đổi hợp lệ khác giữ nguyên. **wholeProductComplete=false**; external sandbox/production/consent và các acceptance gaps vẫn được liệt kê, không lấy unit count hoặc HOME proof thay cho toàn hệ thống.


## Bổ sung13/10 — gỡ chuyển chủ và tab nhân sự

Theo yêu cầu mới, đã gỡ giao diện chuyển quyền sở hữu khỏi Staff/Lễ tân/Owner/Admin: menu, trang IncomingOwnership/AdminOwnership, tab vận hành, form/phần pháp nhân-payout chỉ dùng cho chuyển chủ, client ownershipApi và helper độc lập. Vận hành giữ xử lý lịch bị ảnh hưởng. Backend ownership/data/audit giữ nguyên; không tuyên bố endpoint server đã bị bỏ. Link cũ salon/incoming-ownership về account, admin/ownership về admin; customer benefits?tab=ownership về màn hợp lệ theo vai trò. Notification allowlist không mở hai route đã gỡ.

Chi tiết nhân sự còn Tổng quan/Tài khoản/Vai trò & chi nhánh/Dịch vụ; documents/audit/unknown query được replace về profile, giữ query khác. Không render raw auditTrail; nhân sự, tài khoản/mời nhân viên và dịch vụ độc lập giữ nguyên. Nhãn trạng thái/position mã role được trình bày tiếng Việt, tên vị trí tự nhập giữ nguyên.

Gỡ hai câu trong ảnh cùng9mô tả giới thiệu lặp ở web, metadata kỹ thuật trong lịch sử bảo mật; đổi KYC/private/public URL thành hướng dẫn ngắn về ảnh công khai và giấy tờ riêng. Mobile dọn8file copy, subtitle tùy chọn không còn element trống. Giữ validation/consent/hậu quả/quyền/actual timing/unknown/ảnh minh họa; không xóa comment mã nguồn hữu ích.

Web **265tests/build đạt**, mobile **222Node/typecheck đạt** qua agent (raw logs chỉ tool output), native không chạy cho revision này. Actual demo5173/databaseglowbook:12observations đạt ở5roles,4widths375/768/1024/1440 staff tabs/no horizontal overflow; Reviews/Vouchers375/1440 không còn hai câu. Old links/reload giữ phiên và về đúng màn. Không coi đây là mọi nút/E2E; timestamp artifact là evidence time, không đo latency.

Browser phát hiện empty ImpactPanel thiếu AlertTriangle sau dọn import; sửa +actual JSX regression, error baseline giữ. Đổi tài khoản nhanh lộ STALE_SESSION từ logout cũ; actual store/API regression baselineFAIL→PASS, giữ transport error thật, không clear/navigate sau phiên mới. Hai shell đi login ngay khi user yêu cầu logout; normal fast switch/reload cuối không console error. Các lần goto trước khi login hoàn tất, selector nhãn sai, chờ root/salon trong khi receptionist vềappointments và scrollbar15px gây falseFAIL được giữ như harness findings. Build preview thống nhất API127.0.0.1 để khớp host; initial login trace không dùng làm bằng chứng duy nhất của lỗi SameSite.

Evidence: report-output/ui-prune-20261013/ (validation.json/browser-cases.json/staff-widths.json/logout-browser-final.json +PNG/logs). Source659files SHA256 `c1bd2522356337d755b7d7d8d4fd53f8684788a554dbe3268aa385cdbd657d60`. Backend source không đổi; old gates/timestamps giữ lịch sử. Không chủ động tạo/sửa/hủy lịch, ghi tài chính, reset/seed/drop hoặc xóa lịch sử. **wholeProductComplete=false** cho goal hệ thống còn native/external/production/consent gaps.
