# BeautyBook — BugReport system-wide remediation

Cập nhật checkpoint 11/10/2026; các kết quả 08–10/10 phía dưới được giữ làm lịch sử. Source of truth: working tree trên `main`, checkpoint HEAD `38c5fb68` cùng các thay đổi chưa commit. Không reset/reseed/drop bảng. Báo cáo đang tiếp tục; không tuyên bố toàn hệ thống hết lỗi.

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
