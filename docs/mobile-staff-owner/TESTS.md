# Kết quả Staff / Owner mobile — 06/10/2026

## Kết quả đã chạy

| Lớp | Kết quả | Bằng chứng/phạm vi |
|---|---|---|
| Mobile | typecheck PASS; 133/133 test PASS; Android Hermes export PASS, 1100 modules | Bao gồm hồi quy Customer feedback/sync và auth/role/context, Staff item, Owner mutation. Test VM/mock không phải native acceptance. |
| Backend | typecheck/build PASS; 15 suites, 147 tests PASS (12 suites/123 + access/lifecycle21 + context3; 139 là lượt workstream trước) | Theo workstream backend, Prisma mocks; source và giới hạn trong BACKEND.md. |
| API thật + DB | 15 nhóm PASS, 0 FAIL + 3 kiểm tra context status PASS | `qa/evidence/runtime-1791257005494.json`; hai tenant, mixed Owner A/Staff B, assignment/projection, lifecycle/revision, request/impact. |
| Android Staff | login đúng shell, Today chỉ own items, START/COMPLETE thật PASS | `evidence/native/staff-*.png`; DB readback xác nhận 1 START + 1 COMPLETE, item đầu COMPLETED; hai sibling SCHEDULED, booking IN_PROGRESS, giá/payment không đổi. |
| Android Owner | login/restore, dashboard thật, duyệt reschedule, slot conflict PASS | `owner-overview-fixed`, `owner-positive-after`; read-only DB `owner-readback-1791258775487.json`. Request success APPROVED; conflict PENDING, slot/assignment/giá không đổi. |
| WEB → màn native đang giữ | PASS_OBSERVED sau fix namespace | `owner-sync-fixed-acceptance-20261006.json`; một Edge UI rejection thật, zero native input/reload/navigation; 1→0 yêu cầu, capture upper bound 3266ms sau response. Không gọi đó là render latency chính xác. |
| Visual Android | Pixel_7a 1080×2400, density 420 (~411dp), font 1.0/1.3 | `owner-large-text-stable-20261006.png`, tên/nhánh dài xuống dòng; font_scale khôi phục 1.0. Không tuyên bố đã đo native 320/375dp. |
| Contrast tokens | PASS các cặp đã đo | Berry/white 7.71, ink/cream 13.8, secondary/cream 5.21. Chưa audit toàn bộ pixel/TalkBack. |

Không cộng các lớp thành một con số nghiệm thu; unit, API và native có mức bằng chứng khác nhau.

## Những lỗi phát hiện và sửa

1. Owner A bị chặn bởi optional Staff profile B trả403: Owner vẫn giữ context/branches hợp lệ; Staff-only403 vẫn chặn.
2. Owner preflight cũ có thể ghi sau đổi branch/mode: context + unmount fence trước write, ngoài session generation.
3. Alert COMPLETE của màn Staff đã unmount: callback bị chặn, không gửi mutation phiên cũ.
4. Thành công review bị hiển thị như lỗi vì request rời pending list: success về danh sách; closed request có trạng thái rõ.
5. Staff đã phân công nhưng thiếu tên trong pending projection: giữ assigned/unknown-name, không báo chưa phân công.
6. Operational socket dùng sai namespace `/scheduler`: gateway thực tế root. Sửa root origin/forceNew theo Customer, giữ scoped invalidation/refetch. Native held baseline FAIL cũ được giữ; fresh fixed case PASS.
7. Bộ lọc Owner chiếm đầu màn: compact date controls/modal, inset cards và trạng thái có số lượng thực.
8. OpenAPI thiếu work routes/header: đã regenerate inventory và document optional mobile finance header trên 3 operation. Endpoint business/mobile-context mới giới hạn trạng thái doanh nghiệp ở backend (id/name/status/restriction), không tải giấy tờ/tax/contact vào mobile. Context-smoke3PASS; Staff/Customer403. Staff Account đọc dịch vụ theo lịch/ngày bằng safe personal work API, không commission/catalog price.

## Ma trận 22 ca yêu cầu

| # | Bằng chứng hiện có | Giới hạn |
|---|---|---|
| 1 Customer | Native guest catalog, Customer login và own appointments PASS; unit feedback/sync PASS | Native Customer tạo booking mới sau refactor chưa chạy lại. |
| 2 Staff/Owner auth | Native login và restore Staff/Owner không nhập lại PASS | Staff timing sau restore trong staff-timing-after-restore-20261006. |
| 3 Unsupported roles | Auth/routing unit + native Receptionist/Platform limited-page PASS | Không vào Owner/Customer và không có thao tác nghiệp vụ. |
| 4 Account isolation | Unit generation/cache; API Staff customer-endpoint403; native logout Staff → guest → Owner | Chưa native back/deep-link exhaustive. |
| 5 Scope/profile/context | Unit + live mixed tenants/profile/auth scope PASS | Native scope expiry/onboarding/all branch switching chưa chạy đầy đủ. |
| 6 Assigned resource | API other-item404/mutation403/projection PASS; native own two items | Không chỉ lọc UI. |
| 7 Forbidden Staff actions | Live denied check-in/reprice/reassign/review/tenant reads + safe network projection | Existing legacy personal commission API không dùng trong V1; không tuyên bố đã gỡ. |
| 8 Three items/two staff | API lifecycle và native one-item completion, siblings unchanged PASS | Synthetic CHECKED_IN prerequisite, không natural check-in. |
| 9 Illegal/revision/race | API + behavior tests PASS | Native double-tap race riêng chưa chạy. |
| 10 Live reassignment | Unit + actual API REASSIGN + held native Staff A tự xóa dữ liệu/CTA PASS | staff-handoff-held-before/after-20261006; một case synthetic riêng, không sửa golden-path booking. |
| 11 Ambiguous mutation | Behavior timeout/refetch/no-replay tests PASS | Transport fault injection native NOT_RUN. |
| 12 Actual timing | Native START/COMPLETE + DB/API audit agreement + timestamp/elapsed sau restore PASS | Warm native timer background/offline-reconnect riêng NOT_RUN. |
| 13 Owner tenant | Live two-tenant/mixed-role denial PASS | Tampered deep-link native riêng NOT_RUN. |
| 14 Requests | API approve/reject/expiry; native reschedule success + occupied slot no-change PASS | Native every expiry/processed variation NOT_RUN. |
| 15 Impact | Live APPROVED_EXCEPTION/item/case complete and invariant PASS | Native impact mutation NOT_RUN. |
| 16 Finance boundary | Backend helper + client guard tests; header wired/generated | Money-linked real API cancellation/rejection integration NOT_RUN; no payment/refund fixture writes. |
| 17 Metrics | Live dashboard/date/branch counts + native date view PASS | Multi-timezone scheduling runtime NOT_RUN. |
| 18 Notifications | Self account API contract, allowlisted UUID routing tests | Native unread/target variants not fully tested; not push. |
| 19 Held sync | Actual Edge → Android Owner zero-input PASS after root-namespace fix | Staff held-screen changes NOT_RUN independently. |
| 20 Late data/session | Actual hooks/tests old response/context/unmount fences PASS | All native account-switch socket races NOT_RUN. |
| 21 Small/large/keyboard | Native ~411dp, long labels, font1.3, real keyboard login PASS | iOS, TalkBack, 320dp native NOT_RUN. |
| 22 Staff data minimization | Real HTTP recursive allowlist checks PASS | No clinical/contact/finance fields in safe work endpoint. |

V1 code và các luồng chính đã chạy API thật/Android, nhưng **chưa nghiệm thu toàn bộ 22 ca trên native và chưa production-ready**. Các ô NOT_RUN là việc còn lại, không phải PASS giả.

## Fixture, môi trường và artifact cần phân biệt

- Chỉ QA3012/database test được guard bằng tên/loopback. Dữ liệu mới additive; protected business/branch/staff/offering/booking baseline unchanged trong các scripts. Không migration/reset/drop/seed/delete/history backfill hoặc ghi thanh toán/hoàn tiền.
- Native CHECKED_IN và request setup được ghi rõ synthetic. User actions START/COMPLETE/review diễn ra bằng UI thật.
- Run đầu API `runtime-1791256960750.json`: fixture email staffA/staffB chưa lower-case → login401, 4PASS/1 harnessFAIL; sửa riêng email case của tài khoản synthetic, không đổi password, rerun15PASS.
- `staff-started-20261006.xml` là XML cũ do UIAutomator không idle khi counter1s; PNG thực tế đã visual-review. Harness đã sửa để xóa/check fresh XML; không dùng XML đó chứng minh trạng thái. DB readback + PNG/audit chứng minh START.
- `owner-overview-final-20261006.png` là màn đỏ do Metro IPv6 không truy cập qua IPv4; giữ lịch sử, không phải ảnh nghiệm thu. Dùng `owner-overview-fixed` và `owner-large-text-stable`.
- `owner-review-after` là lỗi feedback trước sửa; `owner-positive-after` là hồi quy thành công. Native sync baseline cũ vẫn stale sau web response; fixed watch mới giữ đủ samples/marker.
- Secrets nằm trong runtime ignored, không ghi vào tài liệu. Các ảnh login/account chứa credentials không được capture. iOS và mobile web export/acceptance NOT_RUN ở đợt này; Edge web Owner thật được ghi riêng.
