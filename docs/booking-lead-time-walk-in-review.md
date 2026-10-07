# BeautyBook — đặt sát giờ, walk-in và lịch quá giờ

Cập nhật 07/10/2026. Yêu cầu: attachment `00a245a0-403f-4cb1-8225-7ac6f6ff959c/Pasted text.txt`, kèm quyết định của người dùng về permission `booking.actual_time.correct`. Đã sửa code, kiểm thử và mở Chromium demo. Bảo toàn các thay đổi có trước task; không reset/seed/drop, không push.

## 1. Điều tra 19h → 21h

Trước sửa, `BookingsService.create` và `getAvailableSlots` áp dụng platform `minBookingLeadTimeHours` cho mọi nguồn, kể cả walk-in. Đây là lỗi xác minh bằng code/test đối với ngoại lệ tại quầy.

Online giữ policy hiện hành. Cấu hình `platform_settings` key `platform` trong database development hiện không có override, nên dùng default **2 giờ**. `BranchBookingPolicy.leadTimeMinutes` có lưu từ onboarding nhưng chưa được dùng trong luồng này; không tự đổi thứ tự ưu tiên.

- 19:00:00.000 → 21:00:00.000 đủ đúng biên 2 giờ.
- 19:00:30 → 21:00 thiếu 30 giây và bị chặn đúng policy.
- Slot lấy trước rồi confirm sau có thể xuống dưới biên. Create kiểm tra lúc đầu và trong transaction sau quote/catalog, kể cả khi retry.
- Giờ đóng cửa, thời lượng/buffer, khả năng chuyên viên và lịch trùng vẫn có thể chặn 21h. Không làm tròn giờ server xuống phút để vượt lead time.

**Không kết luận đã tìm được nguyên nhân duy nhất của lần 19h gốc.** Không có request/timestamp phiên đó. Đã đọc ảnh 22:52: lịch BB-2026-0100001 ngày06/10,22:00–22:30 còn CONFIRMED/SCHEDULED, actual chưa ghi nhận. Database local hiện có cùng mã nhưng là **26/09/2026,08:00–09:00,EXPIRED**, không khớp ảnh; giờ mở cửa của branch bản ghi hiện tại là08:00–21:00. Vì vậy không dùng record này để suy diễn phiên trong ảnh. Case22:00–22:30 tới22:52 được tái hiện có kiểm soát bằng fake clock/fixture UI.

Bằng chứng: `original-case-readonly.json`, `local-lead-config.json`, các suite lead/slots/overrun. Tất cả artifact dưới `report-output/booking-lead-time/`.

## 2. Online và tại quầy sau sửa

| Kênh | Quy tắc |
| --- | --- |
| ONLINE_WEB/ONLINE_APP | Giữ lead platform, start > server now, maximum horizon |
| WALK_IN/PHONE/STAFF_CREATED | Miễn lead tối thiểu chỉ khi controller xác minh quyền thực tế và branch scope; vẫn phải là tương lai, trong horizon và đúng channel policy |
| Customer tự khai WALK_IN | Controller đưa về online; không nhận server-only context |
| STAFF/khác chi nhánh | Không được lấy/tạo counter chỉ bằng source hoặc role client |

Endpoint mới `GET /bookings/counter-slots` authenticated; thông số slot cũ và `source=WALK_IN` cho màn quầy. Public `/bookings/available-slots` không đổi quyền online. Context ngoại lệ truyền riêng từ server, không lấy từ DTO.

Giữ grid30 phút hiện có, **bổ sung đầu phút tương lai gần nhất** tại quầy khi đủ điều kiện. Đây là độ chính xác chọn giờ, không phải policy lead1 phút hoặc dung sai: min lead quầy vẫn0, start phải >now. Candidate này đi qua cùng kiểm tra ca theo mô hình hiện hành, duration/buffer, kỹ năng và overlap. Lọc lại slot hết hạn/không còn đủ lead ngay trước trả response; create vẫn recheck, không đảm bảo giữ slot từ một GET.

Lễ tân: Lịch hẹn → Tạo lịch tại quầy → branch/service/provider → tên khách → slot → Tạo lịch. Đổi filter xóa slot chọn cũ; response cũ bị fence. Slot theo timezone chi nhánh. QUOTE variant được discovery ở counter theo cùng quy tắc create; online vẫn chặn cần báo giá.

Walk-in tiếp tục tạo CONFIRMED theo hành vi có sẵn. Tạo lịch không tự check-in/START; sau đó người có quyền xác nhận khách đến, chuyên viên bắt đầu dịch vụ. Không cho đặt quá khứ, vượt đóng cửa hoặc đè provider được chọn.

## 3. Lịch quá giờ: trạng thái và thời gian tách biệt

| Tình huống | Hành vi |
| --- | --- |
| A. Chưa tới start | Không cảnh báo đến giờ |
| B. SCHEDULED, now >= start | Đã đến giờ — chưa bắt đầu |
| C. SCHEDULED, now > end;22:52 cho22:00–22:30 | Quá giờ dự kiến — cần kiểm tra |
| D. IN_PROGRESS, now > end | Đang phục vụ quá giờ dự kiến |
| E. CHECKED_IN, chưa START | Chưa ghi nhận bắt đầu; không no-show |
| F. Chưa có check-in | Chưa ghi nhận khách đến; không khẳng định khách vắng |
| G. Đã làm, quên cập nhật | Permission correction ghi mốc đã xác minh hoặc UNKNOWN; không lấy planned làm actual |
| H. Parent/item terminal | Không nhắc quá giờ hoặc chuyển lại trạng thái |
| Nhiều dịch vụ | Tính từng item, không tự hoàn thành anh em/parent |
| Qua ngày | Staff Hôm nay có unfinished ngày trước; Owner có danh sách20/trang theo giờ hẹn; web chọn ngày trước/filter chưa kết thúc |

Các nhãn không phải enum DB. Clock hiển thị dùng `serverNow` + monotonic elapsed, không dùng giờ client làm bằng chứng. Timer cập nhật khi đang mở. Foreground/reconnect dùng provider/socket/refresh có sẵn, các read có context/revision/session fences. Cache cũ ghi rõ và chặn thao tác chưa xác minh. Khách nhận nhắc trung tính, không nhận lý do/audit/phân quyền nội bộ.

## 4. Bắt đầu muộn, đóng cửa và capacity

START cần check-in, đúng staff/scope/revision, item SCHEDULED và thời điểm bắt đầu theo **start grace cấu hình có sẵn** (default0). Actual START/COMPLETE vẫn từ server audit lúc bấm, không từ duration/planned.

START kiểm tra phần dịch vụ còn phải làm từ now đến now + duration + transition + variant bufferAfter; đối chiếu mở cửa bằng instant đầy đủ, gồm giây và qua ngày, cùng lịch khác. Không âm thầm sửa planned. Xung đột với lịch khách khác/outside hours bị reject trước ghi START và hướng tới quầy/quản lý điều phối hợp lệ; không tự dời lịch sau.

Dịch vụ SCHEDULED kế tiếp **cùng booking** là công việc tuần tự: không khóa START chỉ vì trễ1 giây, không tự đổi planned; ngăn hai item cùng provider IN_PROGRESS đồng thời. Mobile có xác nhận bắt đầu muộn, nêu tác động cần kiểm tra công việc sau.

Provider đang làm bình thường chỉ giữ khoảng planned. **IN_PROGRESS đã quá end hoặc thiếu end** chưa có bằng chứng giải phóng: chặn nhận slot xung đột/không xác định, kể cả ngày trước, cho tới COMPLETE/stop hợp lệ. Không chặn vô cớ toàn bộ ngày mai chỉ vì provider đang phục vụ trong giờ bình thường. Không kéo dài planned hoặc reservation từ nhãn UI.

No-show giữ rule cũ: owner/lễ tân đúng scope, xác nhận rõ, **sau** start+15 phút; bằng biên chưa cho. Check-in/execution/correction completed hoặc báo hủy hợp lệ chặn no-show. Không có job tự no-show, tự hoàn thành hoặc phạt vì staff quên.

Pending hold vẫn có worker hết hạn riêng. Thêm guard ở discovery và claimed update để không EXPIRED parent có item IN_PROGRESS/COMPLETED (kể cả correction UNKNOWN); race không được ghi đè evidence phục vụ.

## 5. Permission và bổ sung / hiệu chỉnh actual time

Permission **`booking.actual_time.correct`**:

- BUSINESS_OWNER có mặc định, vẫn phải đúng live business/branch scope.
- Manager dùng explicit scoped grant, không tạo lại role Manager đã bị loại khỏi kiến trúc hiện tại.
- Receptionist không mặc định, có thể được Owner cấp quyền theo business/branch, expires/revoked.
- Staff không quyền mặc định. Có grant vẫn không correction dịch vụ của mình, kể cả đã đổi assignee: kiểm tra provider identity từ snapshot hoặc profile lịch sử, không chỉ actor bấm/current assignee.
- Owner với Staff role bấm hộ provider khác không bị coi là người phục vụ khi snapshot xác định provider khác.

Không dùng global `UserPermission` không scope để vượt tenant RBAC. Grant mới có business/branch và chủ sở hữu xác minh; global RBAC khác không đổi. Backend coarse guard và service transaction đều enforce. UI chỉ dùng capability server, không lấy hiding làm authorization.

API:

```text
PATCH /bookings/:id/items/:itemId/actual-time
{ expectedRevision, actualStartedAt: ISO|null, actualCompletedAt: ISO|null, reason }
GET   /bookings/:id/items/:itemId/actual-time
POST  /bookings/actual-time-grants
{ userId, businessId, branchId?, expiresAt?, reason }
POST  /bookings/actual-time-grants/:grantId/revoke
{ reason }
```

KNOWN: cả hai ISO có timezone, start < complete <=server now; không tương lai. UNKNOWN: null/null, item hoàn tất nhưng không đoán actual. Reason bắt buộc, tối đa2000. Expected revision chống ghi đè/retry. Không sửa itemStartAt/itemEndAt, duration/price hay tự hoàn thành/tính tiền parent.

Journal append-only lưu service/version, old/new actual, old/new item status, actor và server correctedAt. Trigger DB cấm sửa/xóa journal. Public timing chỉ có facts/status/source; actor/reason chỉ qua endpoint được cấp quyền. Form để trống thời gian; có lựa chọn UNKNOWN và xác nhận hậu quả; lịch sử hiển thị trước/sau/actor/reason trên web và mobile Owner.

Actual overlap cùng provider bị reject. Dịch vụ hủy đã có release event sử dụng thời điểm giải phóng **chỉ làm bound kiểm tra capacity**, giữ actualStoppedAt null khi không biết. Legacy terminal có START nhưng thiếu cả stop/release và có thể chồng khoảng đang sửa sẽ bị chặn với yêu cầu đối soát; không đoán end và không mở lại terminal lifecycle.

Tính bất biến provider: bulk assign từ chối mọi item đã bắt đầu/kết thúc ở cả trước và sau lock; Scheduled được tăng revision và ghi audit before/after provider/user/actor. Whole move, approved STAFF_CHANGE/RESCHEDULE cũng không ghi đè item đã thực hiện; đổi provider được audit và tăng revision. Dùng per-item workflow/phần booking mới cho công việc chưa làm nếu cần.

## 6. Migration và dữ liệu

Migration additive `20261006_actual_time_corrections` tạo hai bảng journal/scoped grants, enum KNOWN/UNKNOWN, index/constraints/triggers, thêm permission/default Owner. Không rewrite lịch sử lifecycle/planned/finance.

Đã áp dụng **QA** và **database development xác minh localhost:5432/glowbook_db**, không production. Local trước/sau: **4016 bookings,4018 items,4000 payments**, bằng nhau; hash record+items mãBB-2026-0100001 trong DB hiện tại giữ nguyên. Record này khác ngày ảnh, không gọi là exact pictured record. Không reset/seed/drop hoặc xóa lịch sử. Migration được ghi ledger; script guard NODE_ENV/development +loopback +exact DB, hoặc QA prefix +fixture match.

QA mới: một provider/skill fixture riêng, một guest walk-in **BB-2026-0100098**, bookingUUID `2a6a0679-1eae-47fb-9155-67c5ae65c4ed`, item `ca560fb4-be96-4e51-a5d8-caf82e5873bc`. Tạo thật qua Receptionist201 cho slot07/10,09:30VN, lead khoảng29 phút, không có ở online. Sau đó chỉ hai row mới được **synthetic staging** planned06/10,22:00–22:30 để test correction; đây không phải claim API cho tạo quá khứ.

Bốn correction thật: Owner KNOWN, Owner UNKNOWN, Receptionist có grant KNOWN, Owner lưu qua Chromium UI. Grant đã revoke. Current provider/revision5/planned22:00–22:30 giữ nguyên qua test từ chối bulk assignment; parentCONFIRMED và200.000đ giữ nguyên, payments0. Base branch/service/provider QA hash trước/sau giống nhau. Không chạy lại writer để tạo booking/audit trùng.

## 7. Kiểm thử và demo

- Backend curated **17 suites,294/294 PASS**; gồm fake-clock lead19→21/giây/ms, trusted channel, QUOTE, nearest-minute, closing seconds/midnight, overdue/cross-date, sequential/running siblings, self correction/former assignee/proxy owner, unknown/future/order/reason, grant/revoke/scope, actual overlap, immutable history, bulk revision/audit/race, pending expiry/no-show, request approval và postcommit.
- Mobile scoped **47/47 PASS**, typecheck PASS; Expo Android Hermes export PASS. Export không phải native phone acceptance.
- Web **108/108 PASS**, production Vite build PASS **3301 modules**; targeted form/history render4/4 cũng PASS (nằm trong tổng108, không cộng thêm).
- Selected new backend production helpers và typed new overrun/bulk/provider tests lint PASS. Không claim toàn bộ repo lint sạch; các service/test cũ có unsafe-any patterns ngoài phạm vi lint chọn lọc.
- Chromium web:11 PASS ban đầu (real Owner/Receptionist counter GET + fixture22:52/running/terminal/clock transitions), không booking write trong runner đó. Real correction UI một PATCH200; readback có4 versions, desktop1440/mobile375 không tràn ngang.
- Expo Web staff fixture2 checks PASS: due→overdue không reload, actual vẫn chưa ghi nhận, không START khi chưa check-in. Owner realQA3 checks PASS: login→branch-scoped unfinished past record→blank correction/UNKNOWN→history4 entries,390px không overflow, không domain write.
- Final API readback3 checks PASS: nearest-minute counter vs online, actual bulk409, unchanged provider/revision/planned/history.

Demo **QA**: web `http://127.0.0.1:5176`, Expo Web `http://localhost:8086`, API `http://127.0.0.1:3014/api/v1`. Vite/Expo process env trỏQA, không sửa production .env/domain. Browser bridge dùng trong runner được ghi mode rõ; demo Vite đã cấu hình QA trực tiếp. SMTP trống/disabled trên QA; không SMS/email/push trả phí.

### Bằng chứng

Prefix tuyệt đối: `C:/Users/Admin/Downloads/beauty-booking-api-main/report-output/booking-lead-time/` (ignore, không commit artifact/secret).

- `backend-final.json`, `migration-qa.json`, `migration-local-development.json`, `original-case-readonly.json`, `local-lead-config.json`.
- `actual-live-results.json`, `final-api-readback.json`: live permissions/UNKNOWN/history/near slot/data invariants.
- `browser/results.json`, `browser/actual-ui-results.json` và `browser/actual-ui-readback-results.json`: PATCH proof + readback; raw selector fail được giữ riêng, không rerun writer.
- `browser/actual-correction-review-1440.png`, `actual-correction-history-1440.png`, `actual-correction-history-375.png`.
- `mobile/results.json`, `owner-actual-results.json`; `staff-overdue-390.png`, `staff-overdue-detail-390.png`, `owner-correction-empty-390.png`, `owner-correction-history-390.png`.
- `android-final-export/metadata.json` và Hermes bundle; `validation.json` tổng hợp.

Các ảnh history/overdue/form đã mở xem trực tiếp. Harness fail đã sửa: thiếu Idempotency-Key (0 booking), dùng sai fixture businessId (grant403), nhầm drawer/heading/reason prefix/tab, sai route assign404, code-vs-UUID mapping bug đã sửa ở sản phẩm và regression, mock thiếu audit delegates/lock count. Không bỏ assertion để làm đẹp kết quả.

## 8. File và giới hạn còn lại

Backend: lead policy/controller/service; actual-time corrections service/DTO/permission guard/catalog; actual timing projection; item START/snapshots; schedule/provider integrity; staff unfinished query; change request guards/audits; pending expiry guards; schema/migration và các regression/guarded QA scripts.

Mobile: server monotonic clock/operational labels; staff card/list/detail/API/fences/action confirmation; Owner projection/unfinished pagination/correction/history; customer detail neutral cue. Web: clock/refresh/adapter/scheduler/list/detail/counter-slot fencing/timezone/correction/history và tests; web handoff vẫn tại nested `docs/booking-lead-time-walk-in-review.md`.

**Không gọi là acceptance toàn bộ mọi hoàn cảnh:**

1. Chưa chạy luồng correction mới trên APK/điện thoại thật, native background/offline hoặc stress nhiều instance DB thực. Browser mobile là Expo Web; recovery/race được kiểm tra unit/fake clock theo phạm vi ghi rõ.
2. Individual shifts/breaks/leave đã được loại khỏi availability trước task; hiện dùng opening window +active/bookable/skill. Không tuyên bố ca riêng/phòng/thiết bị đã kiểm tra: chưa có resource model đó trong luồng.
3. Legacy DATE/TIME scheduling dùng BOOKING_TIME_ZONE chung (defaultAsia/Ho_Chi_Minh), chưa hỗ trợ booking qua ngày hoặc mọi branch timezone/DST. Correction UI tránh đoán DST ambiguous; actual ISO có timezone.
4. Buffer lịch sử chưa có snapshot đầy đủ; late START dùng variant buffer hiện tại. Không claim đã backfill mọi reservation.
5. Nhắc là inline vận hành; không thêm background reminder job/threshold chính thức. Vì không job mới, không claim đã test reminder downtime/multi-instance.
6. Legacy terminal thiếu stop và release evidence có thể cần đối soát thủ công; không tạo actual end giả. Correction V1 không phục hồi lifecycle CANCELLED/NO_SHOW.
7. Lần19h/ảnh gốc không khớp record local hiện tại; nguyên nhân phiên đó chưa xác minh đầy đủ. Không chỉnh actual hay trạng thái record mãtrùng để khớp ảnh.
