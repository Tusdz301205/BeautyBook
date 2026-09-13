# BEAUTYBOOK — BÁO CÁO AUDIT NGHIỆP VỤ TOÀN HỆ THỐNG

**Ngày audit:** 22/08/2026  
**Phạm vi:** Backend NestJS/Prisma, frontend React, migration, permission catalog, API, job nền, audit log và test hiện có.  
**Nguyên tắc:** Chỉ phân tích source; không sửa code, không reset/seed database và không tạo/xóa dữ liệu.  
**Lưu ý pháp lý:** Các nhận định về quyền riêng tư trong báo cáo là yêu cầu thiết kế/vận hành cần xác minh với tư vấn pháp lý tại thị trường triển khai, không phải kết luận pháp lý.

**Kiểm chứng test:** Đã chạy Jest backend ngày 22/08/2026: **50/51 test suites pass**, 1 suite skipped; **266/272 tests pass**, 6 tests skipped. Test xanh xác nhận hành vi hiện đã được viết, không phủ định các capability/rule còn thiếu. Frontend không có script test và không tìm thấy file test/spec.

## 1. Executive summary — 10 rủi ro quan trọng nhất

1. **KPI dịch vụ và doanh thu theo dịch vụ có thể sai:** một số báo cáo đếm mọi `BookingService`, kể cả booking pending/cancelled/no-show, rồi cộng `priceAtBooking` như doanh thu.
2. **Promotion tách rời khỏi engine tính giá:** hệ thống tạo và hiển thị campaign nhưng booking chỉ áp dụng voucher; giá quảng bá và giá phải trả có thể không trùng nhau.
3. **Không quản lý tài nguyên hữu hạn:** chưa có phòng, giường, ghế, máy; hệ thống chỉ chống trùng nhân viên nên vẫn có thể nhận số lịch vượt công suất thực.
4. **Khóa nhân viên/chi nhánh/doanh nghiệp không giải quyết lịch tương lai:** source cho phép xác nhận đã biết tác động rồi tiếp tục, nhưng không bắt buộc tái phân công, hủy, hoàn tiền và thông báo.
5. **Thiếu phân tách nhiệm vụ phía nền tảng:** các role SUPPORT, COMPLIANCE, MARKETING, FINANCE đã bị migration loại bỏ; `PLATFORM_ADMIN` nắm đồng thời quyền user, duyệt cơ sở, tiền, trust, setting và audit.
6. **Phí hủy/no-show mới là con số trên booking:** chưa thấy bút toán, payment intent, thu tiền, miễn/giảm phí hay đối soát khoản phí đó.
7. **Voucher có thuộc tính nhưng chưa thực thi đầy đủ:** audience, giới hạn dùng mỗi khách, auto-issue ngoài birthday và điều kiện theo dịch vụ/chi nhánh chưa nhất quán với engine áp dụng.
8. **Thanh toán online chưa sẵn sàng production:** DTO chấp nhận MoMo/VNPay/ZaloPay/card nhưng service chủ động từ chối; chỉ cash và chuyển khoản xác minh thủ công hoạt động.
9. **Quyền riêng tư mới hoàn chỉnh một phần:** export khá tốt, nhưng yêu cầu xóa/sửa/xóa tài khoản chỉ tạo phiếu; chưa có workflow quản trị, thực thi, purge theo retention và consent riêng cho ảnh trước/sau.
10. **Thiếu complaint/case management:** review report và refund request là hai luồng rời; chưa có hồ sơ sự cố, bằng chứng, SLA, điều tra, kháng nghị và quyết định bồi thường end-to-end.

**Kết luận phát hành:** Chưa nên đưa vào production đa cơ sở có thanh toán thật trước khi đóng P0 về số liệu, giá, capacity, xử lý lịch tương lai, phân quyền nền tảng và tiền hủy/refund.

## 2. Bản đồ hệ thống đã xác minh

### 2.1 Role, workspace và scope

| Role trong source cuối | Workspace | Scope chính | Nhận xét |
|---|---|---|---|
| `GUEST` | Public | Không tenant | Chỉ duyệt public; không có self-service booking. Endpoint tên `guest` vẫn yêu cầu CUSTOMER; walk-in do salon tạo |
| `CUSTOMER` | Customer | SELF | Đặt lịch, payment, voucher, review, privacy |
| `STAFF` | Salon | Branch/self | Lịch làm, thực hiện dịch vụ, chấm công, dữ liệu cần thiết |
| `RECEPTIONIST` | Salon | Branch | Tạo/xác nhận/check-in/hủy lịch, thu tiền theo quyền |
| `BRANCH_MANAGER` | Salon | Branch | Vận hành chi nhánh, staff, lịch, báo cáo |
| `BUSINESS_OWNER` | Salon | Tenant | Nhiều chi nhánh, catalog, tài chính, workforce |
| `PLATFORM_ADMIN` | Admin | Platform | Toàn bộ vận hành nền tảng |

Migration `20260810_service_taxonomy_role_cleanup` đã loại `SUPPORT`, `COMPLIANCE`, `MARKETING`, `FINANCE` và chuyển mô hình về một platform role duy nhất.

### 2.2 State machine chính đang có

- Booking: `PENDING → CONFIRMED → CHECKED_IN → IN_PROGRESS → COMPLETED`; nhánh cuối gồm `CANCELLED`, `NO_SHOW`, `REJECTED`, `EXPIRED`.
- Booking item: `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `SKIPPED`, nhưng chưa có luồng UI/API đầy đủ để vận hành từng item độc lập.
- Payment: `PENDING`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`, `FAILED`; có intent, transaction và ledger.
- Refund: `PENDING → APPROVED/REJECTED → PROCESSING → REFUNDED/FAILED` với khóa giao dịch và kiểm tra người tạo không tự duyệt.
- Business: `DRAFT`, `PENDING`, `PENDING_REVIEW`, `NEED_MORE_INFO`, `APPROVED`, `ACTIVE`, `SUSPENDED`, `REJECTED`.
- Branch có hai cột trạng thái: `status` và `operationalStatus`; đây là nguồn rủi ro lệch trạng thái.
- Review: `PENDING`, `APPROVED`, `REPORTED`, `HIDDEN`; review mới hiện được tạo trực tiếp ở `APPROVED`.
- Attendance, timesheet, pay run và privacy request đều có enum trạng thái riêng; mức enforcement không đồng đều.

### 2.3 Inventory trạng thái đã đối chiếu

| Domain | Enum/trạng thái trong schema | Kết quả audit |
|---|---|---|
| Identity/access | `UserStatus`, `InvitationStatus`, `TenantStatus`, `AuthWorkspace`, `RoleCode` | Session revoke có; platform SoD thiếu |
| Business review | `DRAFT`, `PENDING`, `PENDING_REVIEW`, `NEED_MORE_INFO`, `APPROVED`, `ACTIVE`, `SUSPENDED`, `REJECTED` | Onboarding có history; suspend thiếu resolution lịch/tiền |
| Branch review | `DRAFT`, `SUBMITTED`, `PENDING_REVIEW`, `NEED_MORE_INFO`, `APPROVED`, `REJECTED` | Có document review; cần invariant với operation |
| Branch operation | `INACTIVE`, `READY_TO_PUBLISH`, `ACTIVE`, `PAUSED`, `SUSPENDED`, `CLOSED`, `ARCHIVED` | Có readiness; có thể lệch `BranchStatus` |
| Service/combo | Service `ACTIVE/INACTIVE`; Combo `ACTIVE/INACTIVE/PAUSED/EXPIRED` | Snapshot lịch sử có; variant/resource thiếu |
| Booking | `PENDING`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`, `REJECTED`, `EXPIRED` | Top-level guard tốt; per-item/financial side effects thiếu |
| Booking item | `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `SKIPPED` | Enum có nhưng operation API/UI chưa đầy đủ |
| Recurring | `CREATING`, `ACTIVE`, `PAUSED`, `FAILED`, `CANCELLED`, `COMPLETED` | Có create/cancel; exception từng kỳ còn hạn chế |
| Change request | `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`; type reschedule/staff/cancel | Không có service/branch change |
| Payment | `PENDING`, `PARTIALLY_PAID`, `PAID`, `FAILED`, `PARTIALLY_REFUNDED`, `REFUNDED` | Manual payment tốt; online provider thiếu |
| Intent/transaction | Intent `CREATED/PENDING/REQUIRES_ACTION/SUCCEEDED/FAILED/CANCELLED/EXPIRED`; transaction `PENDING/VERIFIED/FAILED/REVERSED` | Cần webhook inbox/reconciliation state |
| Refund | `PENDING`, `APPROVED`, `REJECTED`, `PROCESSING`, `REFUNDED`, `FAILED` | Có concurrency/maker-checker cục bộ; thiếu case/customer flow |
| Statement/fee | Statement `DRAFT/REVIEW/ISSUED/PAID/OVERDUE`; fee `ACCRUED/STATEMENTED/ADJUSTED` | Transition có; phụ thuộc metric/ledger đúng |
| Package | Purchase `PENDING_PAYMENT/ACTIVE/COMPLETED/EXPIRED/CANCELLED`; entitlement `AVAILABLE/RESERVED/REDEEMED/RELEASED/EXPIRED` | Có redemption/release; cần pricing precedence |
| Voucher | `ACTIVE`, `RESERVED`, `USED`, `EXPIRED`, `REVOKED` | Lifecycle booking có; multi-use/audience không nhất quán |
| Promotion | `ACTIVE`, `INACTIVE`, `EXPIRED` | CRUD có; không nối pricing/redemption |
| Review | `PENDING`, `APPROVED`, `REPORTED`, `HIDDEN` | Reported vẫn public; moderation reason/appeal thiếu |
| Trust | `WARNING_SENT`, `EXPLANATION_REQUESTED`, `MONITORING_STARTED`, `BOOKING_RESTRICTED`, `SUSPENDED`, `RESTORED`, `NOTE_ADDED` | Action log có; case/evidence/resolution thiếu |
| Attendance | `NOT_CHECKED_IN`, `CHECKED_IN`, `CHECKED_OUT`, `LATE`, `LEFT_EARLY`, `ABSENT`, `MISSING_CHECKOUT`, `MANUALLY_ADJUSTED` | QR/exception/audit có; absence impact cần closure workflow |
| Timesheet | `RAW`, `SUBMITTED`, `APPROVED`, `REJECTED`, `LOCKED` | Có adjustment/lock; cần đảm bảo source earnings đầy đủ |
| Pay run | `DRAFT`, `REVIEW`, `APPROVED`, `LOCKED`, `EXPORTED`, `MARKED_PAID` | Transition rõ; tip/product source thiếu |
| Consultation/consent | Submission `DRAFT/SUBMITTED/REVOKED`; consent event `GRANTED/REVOKED`; access `GRANTED/DENIED/REDACTED` | Access control mạnh; eligibility/purge/photo consent thiếu |
| Privacy request | `RECEIVED`, `IDENTITY_VERIFICATION`, `IN_PROGRESS`, `COMPLETED`, `REJECTED` | Export hoàn chỉnh hơn; các request còn lại thiếu executor |

## 3. Coverage matrix

| Nhóm | Module/source đã đọc | Role đã đối chiếu | Trạng thái coverage | Phát hiện chính |
|---|---|---|---|---|
| A. Customer/booking | bookings, recurring, change requests, booking wizard, customer pages | Guest, Customer, Receptionist, Staff, Manager | Đã phủ | Guest mismatch; group/dependent; sửa dịch vụ; timezone |
| B. Service/catalog | services, canonical taxonomy, combos, branch offering | Owner, Manager, Platform | Đã phủ | Thiếu variant, resource, quote/surcharge/buffer |
| C. Scheduling | validation, scheduler, working hours, leave, holidays | Customer, Receptionist, Staff, Manager | Đã phủ sâu | Capacity, waitlist, overbooking, offboarding |
| D. Workforce | attendance, schedule, timesheet, compensation, pay run | Staff, Manager, Owner | Đã phủ | Lịch tương lai; tip/product commission |
| E. Finance | payment policy, intent, transaction, ledger, refund, statements | Customer, Receptionist, Owner, Platform | Đã phủ sâu | Gateway, fee cancellation, invoice/cash close |
| F. Growth | promotion, voucher, customer voucher, birthday job | Customer, Owner | Đã phủ | Promotion không tính giá; audience/usage; loyalty |
| G. Multi-branch | business, branches, onboarding, member, assignment | Manager, Owner, Platform | Đã phủ | Hai trạng thái branch; ownership/payout transfer |
| H. Trust/review | review, report, trust snapshot/action | Customer, Owner, Platform | Đã phủ | Reported vẫn public; thiếu case/appeal |
| I. Privacy | consent, consultation, access log, break-glass, export, DSR | Customer, Staff, Receptionist, Platform | Đã phủ | DSR execution, purge, photo consent |
| J. Reports/support | reports, financial metrics, notification, audit, tests | Owner, Manager, Platform | Đã phủ | KPI sai nghĩa; SoD; delivery; frontend test = 0 |

## 4. Findings theo severity

### Critical

### BB-BIZ-001 — Báo cáo đếm lịch không tạo doanh thu và cộng giá item thành doanh thu

- **Nhóm / loại:** J, E / Loại 5 và 6.
- **Tình huống:** Một booking 1.000.000đ bị hủy vẫn xuất hiện trong top dịch vụ; dashboard cộng 1.000.000đ vào “revenue” của dịch vụ dù chưa thu tiền.
- **Hiện trạng:** `getCategoryStats`, `getServiceStats`, `getTopBranches` không lọc trạng thái booking. Owner dashboard cộng `priceAtBooking` của mọi item trong kỳ; phân phối rating lấy mọi review trong khi average chỉ lấy `APPROVED`.
- **Điểm sai:** Trộn “nhu cầu đặt”, “dịch vụ hoàn thành” và “doanh thu thực thu”; KPI không có định nghĩa thống nhất và không drill-down về nguồn.
- **Ảnh hưởng:** Owner, manager, platform, kế toán; quyết định nhân sự/marketing sai, tranh chấp đối soát.
- **Ví dụ bước:** Tạo booking → hủy trước khi thanh toán → mở báo cáo dịch vụ/branch → booking vẫn tăng volume và giá item vẫn tăng revenue.
- **Bằng chứng:** `src/reports/reports.service.ts` (`getCategoryStats`, `getServiceStats`, `getTopBranches`, `getOwnerDashboard`); entity `Booking`, `BookingService`, `Payment`, `RefundRequest`.
- **Business rule đề xuất:** Tách rõ `booked_count`, `completed_count`, `cancelled_count`, `gross_collected`, `refund`, `net_collected`, `recognized_service_revenue`. Doanh thu chỉ lấy ledger/transaction verified; phân bổ voucher/refund xuống item bằng rule có snapshot.
- **UI đề xuất:** Tooltip định nghĩa KPI, bộ lọc trạng thái, tab “Nhu cầu” và “Tài chính”, click KPI mở danh sách giao dịch nguồn.
- **Backend/data:** Tạo metric contract dùng chung, query theo transaction/ledger; bổ sung allocation cho discount/refund đến booking item; bucketing theo timezone chi nhánh.
- **Acceptance criteria:** Booking hủy chưa thu không làm tăng doanh thu; refund giảm net đúng kỳ; tổng drill-down bằng KPI; rating distribution và average dùng cùng population.
- **Test bắt buộc:** pending/cancel/no-show/completed; partial payment; partial refund; voucher; refund khác kỳ; multi-branch; boundary 23:59 theo timezone.
- **Độ chắc chắn:** **Confirmed gap**.

### BB-BIZ-002 — Campaign Promotion không tham gia tính giá booking

- **Nhóm / loại:** B, E, F / Loại 4 và 6.
- **Tình huống:** Salon quảng bá giảm 20% cho dịch vụ A nhưng khách chọn đúng dịch vụ vẫn bị tính nguyên giá nếu không có voucher.
- **Hiện trạng:** Có model promotion và liên kết business/branch/service/combo, có UI quản lý; booking preview/create chỉ gọi `applyVoucher`.
- **Điểm sai:** Campaign hiển thị được nhưng không tạo price adjustment/snapshot; không có precedence, stacking hoặc quota enforcement trong booking.
- **Ảnh hưởng:** Khách, lễ tân, owner; mất niềm tin, bù giá thủ công và thất thoát.
- **Ví dụ bước:** Tạo promotion ACTIVE gắn service → khách đặt trong thời gian campaign → price preview không giảm.
- **Bằng chứng:** `prisma/schema.prisma` models `Promotion*`; `src/bookings/bookings.service.ts`; `src/common/utils/voucher.ts`; frontend `SalonPromotions.jsx`.
- **Business rule:** Một pricing engine duy nhất chọn promotion đủ điều kiện tại thời điểm giữ chỗ; quy định thứ tự promotion/voucher/package, cap và no-stacking; snapshot rule/version vào booking.
- **UI:** Preview giải thích từng dòng giá, lý do promotion không áp dụng, cảnh báo khi campaign không có engine tương ứng.
- **Backend/data:** `PriceAdjustment`/`PromotionRedemption`, allocation theo item, idempotent reservation/release trong transaction.
- **Acceptance criteria:** Giá public, preview, booking, payment và report giống nhau; sửa campaign không đổi booking đã giữ; request song song không vượt quota.
- **Test:** service/branch/combo scope; thời điểm bắt đầu/kết thúc; voucher stacking; cancel/expire/rebook; concurrent quota.
- **Độ chắc chắn:** **Confirmed gap**.

### BB-BIZ-003 — Không có capacity cho phòng, giường, ghế và máy

- **Nhóm / loại:** B, C / Loại 1 và 7.
- **Tình huống:** Spa có 2 giường và 4 nhân viên; hệ thống có thể nhận 4 lịch cùng giờ vì chỉ kiểm tra nhân viên.
- **Hiện trạng:** Validation khá đầy đủ cho giờ làm, nghỉ, kỹ năng và overlap nhân viên; schema không có resource/equipment/room/capacity reservation.
- **Điểm thiếu:** Không thể mô tả tài nguyên dùng riêng/dùng chung, số lượng, bảo trì, buffer và conflict.
- **Ảnh hưởng:** Khách, lễ tân, staff, manager; trùng lịch vật lý, chờ đợi, hủy tại chỗ.
- **Ví dụ bước:** Gán bốn staff khác nhau vào một dịch vụ cần cùng loại máy chỉ có một chiếc → cả bốn booking hợp lệ.
- **Bằng chứng:** `prisma/schema.prisma`; `src/bookings/bookings.validation.ts`; `src/bookings/bookings.service.ts`.
- **Business rule:** Service/step khai báo resource requirement và quantity; giữ resource cùng transaction với staff; hỗ trợ maintenance/closed period và controlled capacity.
- **UI:** Resource calendar, cảnh báo conflict, chọn/tự gán resource, màn hình bảo trì.
- **Backend/data:** `ResourceType`, `Resource`, `ServiceResourceRequirement`, `ResourceReservation`, exclusion/locking chống race.
- **Acceptance criteria:** Không hai booking chiếm cùng resource độc quyền; capacity N chỉ nhận N; hủy/expire giải phóng resource; combo giữ resource đúng từng segment.
- **Test:** concurrent booking; maintenance; multi-step combo; resize/move; timezone; resource shared quantity.
- **Độ chắc chắn:** **Confirmed gap**.

### BB-BIZ-004 — Khóa nhân viên/cơ sở không bắt buộc xử lý lịch tương lai

- **Nhóm / loại:** C, D, G, H / Loại 2, 5 và 7.
- **Tình huống:** Nhân viên nghỉ việc hoặc branch bị suspend nhưng hàng chục khách đã đặt và đặt cọc.
- **Hiện trạng:** Offboarding trả impact và yêu cầu `acknowledgeFutureBookings`, sau đó khóa staff, kết thúc assignment và revoke session nhưng giữ nguyên booking assignment. Trust action đổi status/restriction nhưng không tạo case xử lý lịch/payment tương lai.
- **Điểm sai:** “Đã đọc cảnh báo” thay cho “đã có phương án”; booking có thể trỏ đến staff không bookable hoặc branch không vận hành.
- **Ảnh hưởng:** Tất cả actor; hủy tại chỗ, tiền treo, thiếu thông báo và trách nhiệm.
- **Ví dụ bước:** Staff còn booking CONFIRMED → owner tick xác nhận và deactivate → booking vẫn gán staff cũ.
- **Bằng chứng:** `src/staff/staff.service.ts` (`offboardingImpact`, `deactivate`); `src/admin/trust-snapshot.service.ts`; `TrustAction`, `StaffBranchAssignment`, `BookingService`.
- **Business rule:** Không cho hoàn tất offboarding/closure cho đến khi mọi booking active có resolution: reassign, reschedule, cancel+refund hoặc documented exception; phân công owner xử lý và deadline.
- **UI:** Wizard impact có batch action, trạng thái từng booking, số tiền phải hoàn, notification preview; không dùng một checkbox bỏ qua.
- **Backend/data:** `OperationalImpactCase` và `BookingResolution`; transaction/outbox cho reassign/cancel/refund/notify; job cảnh báo quá hạn.
- **Acceptance criteria:** Sau closure không còn booking active vô chủ; tiền và voucher được xử lý; khách/staff nhận thông báo; audit nối được action với từng booking.
- **Test:** staff offboard, branch pause/suspend/close, business suspend, partial paid, combo multi-staff, failure giữa refund và notification.
- **Độ chắc chắn:** **Confirmed gap**.

### BB-BIZ-005 — Một Platform Admin nắm các nhiệm vụ xung đột

- **Nhóm / loại:** G, H, J / Loại 10.
- **Tình huống:** Cùng một tài khoản có thể duyệt doanh nghiệp, can thiệp user, xử lý refund, suspend/restore và đổi chính sách nền tảng.
- **Hiện trạng:** Schema cuối chỉ còn 7 role; migration chủ động loại SUPPORT/COMPLIANCE/MARKETING/FINANCE; `PLATFORM_ADMIN` có permission rất rộng.
- **Điểm thiếu:** Không có segregation of duties, maker-checker theo phòng ban hoặc quyền support read-only/time-bound.
- **Ảnh hưởng:** Platform, salon, khách; gian lận nội bộ, sai thao tác, audit khó quy trách nhiệm.
- **Ví dụ bước:** Admin tạo/duyệt tác động tài chính và tự chỉnh policy làm cơ sở quyết định.
- **Bằng chứng:** `prisma/schema.prisma` enum `RoleCode`; migration `20260810_service_taxonomy_role_cleanup`; `src/common/permissions/permission-catalog.ts`.
- **Business rule:** PO phải chốt mô hình tổ chức. Khuyến nghị role/capability riêng Support, Trust/Compliance, Finance, Marketing; hành động tiền/trust quan trọng cần hai người và cấm self-approval.
- **UI:** Workspace/queue theo chức năng, hiển thị scope và lý do; elevated access có hết hạn.
- **Backend/data:** Khôi phục role hoặc dùng permission bundle + approval workflow; policy engine kiểm tra actor khác creator; access review định kỳ.
- **Acceptance criteria:** Support không refund/suspend; Finance không đọc health data; người tạo không tự duyệt; mọi grant có scope/expiry/audit.
- **Test:** matrix deny/allow cho từng role, cross-tenant, self-approval, revoked session, emergency grant expiry.
- **Độ chắc chắn:** **Confirmed gap về SoD; Product decision needed về mô hình role**.

### High

### BB-BIZ-006 — Phí hủy/no-show chưa trở thành nghĩa vụ tài chính thực

- **Nhóm / loại:** A, E / Loại 5 và 6.
- **Tình huống:** Khách hủy sát giờ, policy tính phí 30%, nhưng hệ thống chỉ lưu con số mà không thu, cấn tiền cọc hoặc ghi công nợ.
- **Hiện trạng:** `cancellationFeeAmount` được tính và snapshot trên Booking; không thấy tích hợp vào payment intent, ledger, refund allocation hoặc collection workflow.
- **Điểm thiếu:** Không biết trừ deposit, thu thêm, miễn phí, thất thu hay ghi debt; no-show fee chưa có flow tương đương.
- **Ảnh hưởng:** Khách, lễ tân, owner, platform; tranh chấp và sai báo cáo.
- **Ví dụ:** Booking 1 triệu đã cọc 200k, phí hủy 300k → hệ thống không quyết định giữ 200k và thu thêm 100k hay chỉ giữ cọc.
- **Bằng chứng:** `src/bookings/bookings.service.ts`, `change-requests.service.ts`; entity `Booking`, `FinancialLedgerEntry`, `RefundAllocation`.
- **Business rule:** Chốt ma trận customer cancel/salon cancel/no-show; fee cap theo paid balance; waiver có quyền/lý do; salon cancel luôn release/hoàn theo chính sách.
- **UI:** Hiển thị fee trước xác nhận hủy, breakdown cọc/hoàn/còn thu, nút waiver có audit.
- **Backend/data:** Ledger entry `CANCELLATION_FEE/NO_SHOW_FEE/FEE_WAIVER`; allocation vào payment/refund; idempotent settlement.
- **Acceptance criteria:** Mọi fee có bút toán và trạng thái thu; refund không vượt net refundable; report tách fee service.
- **Test:** chưa trả/partial/full; salon cancel; late cancel; waiver; retry; refund sau fee.
- **Độ chắc chắn:** **Confirmed gap**.

### BB-BIZ-007 — Voucher audience và usage limit không nhất quán

- **Nhóm / loại:** F / Loại 5 và 6.
- **Tình huống:** Voucher đặt `NEW_CUSTOMER`, `VIP`, `maxUsagePerCustomer=3` nhưng engine chỉ kiểm tra khách có một `CustomerVoucher` ACTIVE.
- **Hiện trạng:** `applyVoucher` kiểm tra thời gian, quota tổng, business, min order và ownership. Không kiểm tra audience; schema unique `(voucherId, customerId)` không thể biểu diễn nhiều lần dùng; auto-issue chỉ có job birthday.
- **Điểm sai:** Cấu hình UI hứa nhiều hành vi backend không thực hiện; scope service/branch cụ thể không có trong Voucher.
- **Ảnh hưởng:** Khách, owner; phát sai ưu đãi, vượt/thiếu quyền sử dụng, tranh chấp.
- **Ví dụ:** Owner tạo voucher RETURNING_CUSTOMER autoIssue → khách quay lại không nhận; hoặc đặt max usage 3 nhưng lần đầu đã chuyển row sang USED.
- **Bằng chứng:** `prisma/schema.prisma` `Voucher`, `CustomerVoucher`; `src/common/utils/voucher.ts`; `src/scheduler/policy-notification.cron.ts`; `SalonPromotions.jsx`.
- **Business rule:** Chốt voucher là coupon nhiều lượt hay entitlement một lượt; audience được tính từ dữ liệu snapshot; xác định scope và stacking.
- **UI:** Ẩn option chưa hỗ trợ hoặc hiển thị validator/ước lượng audience; giải thích lý do không đủ điều kiện.
- **Backend/data:** `VoucherRedemption` nhiều dòng; counter per customer; audience evaluator; branch/service/combo links; atomic reserve/use/release.
- **Acceptance criteria:** Mọi field cấu hình đều có enforcement; concurrent request không vượt quota; cancel/expire restore theo rule.
- **Test:** new/returning/VIP/selected/birthday; max usage 1 và >1; multi-tab race; cancel/refund/expiry.
- **Độ chắc chắn:** **Confirmed gap**.

### BB-BIZ-008 — Phương thức thanh toán online được công bố nhưng bị từ chối

- **Nhóm / loại:** E / Loại 4 và 6.
- **Tình huống:** Customer chọn MoMo/VNPay/ZaloPay/card nhưng API trả unsupported.
- **Hiện trạng:** DTO nhận các method này; `PaymentsService` đưa chúng vào danh sách unsupported. Chỉ CASH và MANUAL_BANK_TRANSFER có adapter.
- **Điểm sai:** Contract và kỳ vọng sản phẩm không trùng capability thực; không có callback signature, webhook idempotency và reconciliation gateway.
- **Ảnh hưởng:** Khách, lễ tân, owner; bỏ đơn và vận hành chuyển khoản thủ công.
- **Bằng chứng:** `src/payments/payments.service.ts`; `src/payments/providers/*`; `src/payments/dto/payments.dto.ts`.
- **Business rule:** Trước launch phải công bố đúng method hỗ trợ; chốt authorize/capture/refund/timeout/callback policy cho từng gateway.
- **UI:** Chỉ hiện provider READY; trạng thái chờ/không xác định; hướng dẫn retry không tạo trả hai lần.
- **Backend/data:** Adapter production, signed webhook, provider event inbox unique, reconciliation job và dead-letter queue.
- **Acceptance criteria:** Callback lặp không nhân tiền; timeout được reconcile; refund về đúng nguồn; secret không nằm client.
- **Test:** success/fail/timeout/duplicate/out-of-order callback; amount mismatch; partial refund.
- **Độ chắc chắn:** **Confirmed gap**.

### BB-BIZ-009 — Data Subject Request chưa có quy trình thực thi đầy đủ

- **Nhóm / loại:** I / Loại 1 và 9.
- **Tình huống:** Khách gửi yêu cầu sửa/xóa dữ liệu hoặc xóa tài khoản; ticket nằm RECEIVED vô thời hạn.
- **Hiện trạng:** Customer tạo/list request; export được tạo tức thời có re-auth, encryption, token một lần. Không thấy API/admin workflow cập nhật identity verification, legal hold, resolution hoặc thực thi erasure/delete. Retention được dùng để chặn đọc nhưng không có purge job; ConsentScope không có before/after photo.
- **Điểm thiếu:** Không có owner queue, SLA escalation, delete/anonymize matrix, legal hold, proof, retry; ảnh nhạy cảm thiếu consent riêng.
- **Ảnh hưởng:** Khách, platform, salon; rủi ro riêng tư và vận hành thủ công.
- **Bằng chứng:** `src/privacy/privacy-center.service.ts`, `privacy.controller.ts`, `consultation.service.ts`; enums `DataSubjectRequest*`, `ConsentScope`; `MediaFile`.
- **Business rule:** Chốt retention theo category; consent ảnh riêng cho chăm sóc và marketing; DSR có verify → assess hold → execute → QA → complete/reject.
- **UI:** Customer thấy tiến độ/lý do; admin queue deadline; preview dữ liệu bị xóa/giữ và bằng chứng hoàn tất.
- **Backend/data:** Worker idempotent anonymize/purge; legal hold; immutable execution log; liên kết media-consent-purpose; retry/rollback plan.
- **Acceptance criteria:** Mỗi type có executor hoặc bị ẩn; request không quá deadline; revoke consent chặn truy cập tương lai; hết retention được purge/anonymize trừ legal hold.
- **Test:** export one-time; delete with active booking/payment; legal hold; repeated request; worker partial failure; photo consent revoke.
- **Độ chắc chắn:** **Confirmed gap; quy tắc retention cần legal/product decision**.

### BB-BIZ-010 — Thiếu hồ sơ khiếu nại/sự cố/tranh chấp end-to-end

- **Nhóm / loại:** A, E, H, J / Loại 1.
- **Tình huống:** Khách bị phản ứng da, yêu cầu hoàn tiền và salon phản bác bằng ảnh/biên bản.
- **Hiện trạng:** Có ReviewReport, RefundRequest và TrustAction độc lập; không có complaint/case/incident/evidence/SLA/appeal model.
- **Điểm thiếu:** Không liên kết customer statement, salon response, health incident, evidence, refund, trust decision và communication timeline.
- **Ảnh hưởng:** Khách, salon, support, trust, finance; xử lý ngoài hệ thống, thiếu công bằng và khó kiểm toán.
- **Bằng chứng:** `prisma/schema.prisma`; modules `reviews`, `payments`, `admin/trust-snapshot`.
- **Business rule:** Case type/severity/owner/SLA; conflict-of-interest; evidence retention; decision + appeal; refund/trust action chỉ phát sinh từ case khi phù hợp.
- **UI:** Customer mở case; salon phản hồi; support timeline; trust/finance subtask; trạng thái và deadline rõ.
- **Backend/data:** `Case`, `CaseParty`, `Evidence`, `CaseEvent`, `CaseDecision`, `Appeal`, links booking/payment/review/trust.
- **Acceptance criteria:** Một case truy được toàn bộ sự kiện; không mất evidence; action tiền/trust có actor/reason/approval; hai tenant không đọc chéo.
- **Test:** injury, service quality, no-show dispute, duplicate case, appeal, sensitive evidence access.
- **Độ chắc chắn:** **Confirmed gap**.

### BB-BIZ-011 — Khách vãng lai không thể tự đặt lịch; tên endpoint/DTO dễ gây hiểu nhầm

- **Nhóm / loại:** A / Loại 3 và 8.
- **Tình huống:** Khách vãng lai từ trang explore nhấn đặt lịch và phải đăng nhập/đăng ký; salon vẫn có thể tạo walk-in tại quầy.
- **Hiện trạng:** `App.jsx` bọc `/book` và mọi bước bằng `ProtectedRoute roles=['customer']`. Endpoint `POST /bookings/guest` được giữ để tương thích nhưng cũng có `@Roles('CUSTOMER')`; walk-in thật được tạo bởi salon qua endpoint thường khi có `guestName`.
- **Điểm thiếu:** Sản phẩm chưa có guest self-checkout. Tên DTO/endpoint “guest” dễ khiến frontend/QA/đối tác hiểu nhầm rằng API là public; đây chưa phải bug nếu PO chủ động yêu cầu account.
- **Ảnh hưởng:** Guest, marketing, salon; giảm conversion và gây nhầm.
- **Bằng chứng:** frontend `src/App.jsx`; backend `src/bookings/bookings.controller.ts` (`createGuest`, `create`), DTO guest.
- **Business rule:** PO chọn một: guest booking thật với OTP/contact ownership, hoặc account required và xóa/khóa endpoint guest.
- **UI:** Nếu guest: form contact + OTP + consent + claim booking; nếu account required: thông báo trước CTA và resume state sau login.
- **Backend/data:** Nếu chọn guest: guest identity/dedup/rate limit/claim token và chống lộ booking theo phone. Nếu chọn account: đổi tên/retire compatibility endpoint và contract gây hiểu nhầm.
- **Acceptance criteria:** CTA public có kết quả nhất quán; không mất branch/service/time khi login; guest không xem booking người khác.
- **Test:** unauthenticated CTA, register/login resume, duplicate phone, claim, rate-limit, expired token.
- **Độ chắc chắn:** **Confirmed current limitation; Product decision needed để kết luận có phải gap của MVP**.

### BB-BIZ-012 — Không vận hành được từng dịch vụ sau check-in

- **Nhóm / loại:** A, C, D, E / Loại 2 và 5.
- **Tình huống:** Khách đến nơi đổi dịch vụ, thêm add-on, bỏ một item hoặc combo cần hai chuyên viên khác nhau.
- **Hiện trạng:** Schema có `BookingServiceStatus` và per-item staff/timeline; API status chính điều khiển booking. Assign staff hiện validate service đầu rồi update cùng một staff cho tất cả item; không thấy flow add/remove/reprice/per-item completion.
- **Điểm sai:** Data model gợi ý multi-step nhưng thao tác vận hành lại ở cấp booking toàn phần.
- **Ảnh hưởng:** Lễ tân, staff, customer, finance; lịch và hóa đơn không phản ánh dịch vụ thực tế.
- **Bằng chứng:** `src/bookings/bookings.service.ts` (`assignStaff`); `bookings.controller.ts`; model `BookingService`.
- **Business rule:** Booking item có lifecycle riêng; thay đổi sau confirm/check-in cần quyền, lý do, reprice, consent và payment delta; booking complete khi mọi item resolved.
- **UI:** Drawer từng item, staff/timeline/resource, add/remove/skip/complete, estimate chênh lệch và xác nhận khách.
- **Backend/data:** Item mutation API với optimistic version; pricing snapshot delta; per-item staff validation; allocation payment/refund/commission.
- **Acceptance criteria:** Có thể gán nhân viên khác nhau; một item skipped không làm mất item khác; total/ledger/report khớp service thực hiện.
- **Test:** combo 2 staff; add-on after check-in; remove paid item; partial completion/refund; concurrent edit.
- **Độ chắc chắn:** **Confirmed gap**.

### BB-BIZ-013 — Mô hình dịch vụ chưa đủ cho giá/thời lượng thực tế

- **Nhóm / loại:** B / Loại 1 và 3.
- **Tình huống:** Nhuộm tóc có giá theo độ dài, chuyên viên senior phụ thu, thời lượng là khoảng và cần dọn ghế 15 phút.
- **Hiện trạng:** Business service và branch offering có một price/duration; staff-service chỉ là skill mapping; không có variant, price type, staff grade price, time surcharge, pre/post buffer, age/gender/contraindication rule.
- **Điểm thiếu:** Không thể báo “từ”, quote sau consultation hoặc tính surcharge minh bạch.
- **Ảnh hưởng:** Customer, staff, reception, owner; sai giá và sai lịch.
- **Bằng chứng:** models `BusinessService`, `BranchServiceOffering`, `StaffService`; frontend `SalonServices.jsx`.
- **Business rule:** Chốt variant dimension, fixed/from/quote, duration range, surcharge precedence, eligibility/consent và historical version.
- **UI:** Variant picker, estimate range, explanation surcharge, consultation-required badge, buffer không hiển thị như thời gian làm dịch vụ.
- **Backend/data:** `ServiceVariant`, `PriceRule`, `DurationRule`, `BufferRule`, `EligibilityRule`; snapshot input/output.
- **Acceptance criteria:** Customer thấy estimate đúng; staff/branch/time rule áp nhất quán; booking cũ không đổi khi catalog sửa.
- **Test:** long hair + senior + weekend; quote required; branch override; old booking after price update.
- **Độ chắc chắn:** **Confirmed gap; chi tiết rule cần Product decision**.

### BB-BIZ-014 — Không có waitlist và controlled overbooking

- **Nhóm / loại:** C / Loại 1.
- **Tình huống:** Slot kín, khách muốn chờ; khi có người hủy lễ tân đang phải gọi thủ công.
- **Hiện trạng:** Không thấy waitlist/offer/expiry model; conflict check chỉ reject. Không có policy overbooking có quota/lý do/audit.
- **Điểm thiếu:** Mất nhu cầu và dễ overbook ngoài hệ thống.
- **Ảnh hưởng:** Customer, reception, manager; mất doanh thu và tăng thao tác thủ công.
- **Bằng chứng:** schema và module booking/scheduler.
- **Business rule:** Waitlist theo branch/service/staff/time window; offer theo thứ tự ưu tiên, TTL và atomic claim. Overbooking chỉ manager, giới hạn, lý do và capacity check.
- **UI:** “Tham gia danh sách chờ”, queue, offer countdown, manager override banner.
- **Backend/data:** `WaitlistEntry`, `SlotOffer`, `OverbookingPolicy`, audit/outbox.
- **Acceptance criteria:** Một slot chỉ một người claim; offer hết hạn chuyển người kế; override luôn có reason.
- **Test:** cancel triggers offer; concurrent accept; preference staff; no response; resource capacity.
- **Độ chắc chắn:** **Confirmed gap**.

### BB-BIZ-015 — Review bị report vẫn hiển thị public và moderation thiếu reason bắt buộc

- **Nhóm / loại:** H / Loại 2 và 5.
- **Tình huống:** Review bị báo cáo vì lộ thông tin cá nhân vẫn xuất hiện công khai trong thời gian chờ admin.
- **Hiện trạng:** Query public lấy `APPROVED` và `REPORTED`; create review đặt thẳng `APPROVED`; UI admin cho approve/hide nhưng action model không thể hiện moderation reason bắt buộc.
- **Điểm thiếu:** Không có quarantine/risk rule, moderator decision metadata, appeal và SLA.
- **Ảnh hưởng:** Customer, staff, salon, platform; nội dung có hại tiếp tục hiển thị, tranh chấp moderation.
- **Bằng chứng:** `src/reviews/reviews.service.ts`; `AdminReviewsModeration.jsx`; model `Review`, `ReviewReport`.
- **Business rule:** Report category/severity; high-risk auto quarantine; moderator phải có reason/code; owner/customer được thông báo và có appeal.
- **UI:** Preview redacted, report counts/categories, decision reason, timeline.
- **Backend/data:** `ReviewModerationDecision`, visibility tách khỏi workflow status; policy threshold.
- **Acceptance criteria:** Review high-risk report không public; mọi hide/restore có reason/actor/time; aggregate rating dùng đúng visibility.
- **Test:** duplicate report; PII report; malicious mass report; hide/restore; anonymous review.
- **Độ chắc chắn:** **Confirmed gap**.

### BB-BIZ-016 — Hai trạng thái branch có thể lệch nhau

- **Nhóm / loại:** G, H / Loại 5 và 7.
- **Tình huống:** Trust action đặt `branch.status=INACTIVE` nhưng `operationalStatus` vẫn ACTIVE; các màn hình/query khác nhau có thể kết luận khác nhau.
- **Hiện trạng:** Branch có `status` và `operationalStatus`; onboarding service thường cập nhật cả hai, trust action chỉ cập nhật status.
- **Điểm sai:** Không có invariant/state transition service duy nhất cho mọi tác nhân.
- **Ảnh hưởng:** Customer, manager, platform; listing, booking và dashboard lệch nhau.
- **Bằng chứng:** `src/admin/trust-snapshot.service.ts`; `src/branches/branches.service.ts`; model `Branch`.
- **Business rule:** Tách rõ review status và operation status, định nghĩa derived public/bookable state; mọi transition qua một domain service.
- **UI:** Hiển thị hai khái niệm với lý do; không dùng badge mơ hồ “ACTIVE”.
- **Backend/data:** Constraint/invariant checker; event-driven transition; migration sửa bản ghi lệch.
- **Acceptance criteria:** Không state combination bất hợp lệ; suspend/restore đồng bộ; public readiness dùng một hàm canonical.
- **Test:** approve/publish/pause/suspend/restore/reject; legacy inconsistent row; concurrent admin-owner action.
- **Độ chắc chắn:** **Confirmed gap**.

### Medium

### BB-BIZ-017 — Không hỗ trợ đặt cho người khác hoặc đặt nhóm

- **Nhóm / loại:** A / Loại 1.
- **Tình huống:** Phụ huynh đặt cho con hoặc nhóm 3 người cùng khung giờ.
- **Hiện trạng:** Booking gắn một CustomerProfile và optional BookingContact; không có participant/dependent/group và capacity per participant.
- **Điểm thiếu:** Lịch sử/consent/health data dễ gắn sai chủ thể; group phải tạo nhiều booking thủ công.
- **Ảnh hưởng:** Customer, reception, staff.
- **Bằng chứng:** models `Booking`, `BookingContact`; create DTO.
- **Business rule:** Booker khác service recipient; mỗi recipient có contact/consent/age; group có shared reference nhưng slot/resource độc lập.
- **UI:** “Đặt cho ai?”, quản lý người thân, group summary.
- **Backend/data:** `CustomerDependent`, `BookingParticipant`, groupId; authorization và consent guardian.
- **Acceptance criteria:** Dữ liệu sức khỏe/review gắn đúng người; booker quản lý được trong phạm vi cho phép.
- **Test:** minor/guardian, adult friend, mixed services/staff, cancellation one member.
- **Độ chắc chắn:** **Confirmed gap**.

### BB-BIZ-018 — Timezone toàn hệ thống, booking qua ngày và slot tối thiểu cứng

- **Nhóm / loại:** B, C, J / Loại 2, 3 và 7.
- **Tình huống:** Dịch vụ 15 phút bị từ chối; ca kéo qua nửa đêm không tạo được; báo cáo lệch ngày tại branch khác timezone.
- **Hiện trạng:** Validation dùng timezone ứng dụng dù Branch có timezone; cross-midnight bị reject; minimum slot 30 phút hard-coded; report dùng UTC `toISOString().slice(0,10)`.
- **Điểm thiếu:** Rule không theo branch/service và không nhất quán giữa booking/report.
- **Ảnh hưởng:** Chuỗi nhiều vùng, nail express, spa/hotel hoạt động muộn.
- **Bằng chứng:** `src/common/utils/booking-datetime.ts`, `bookings.validation.ts`, `reports.service.ts`; field `Branch.timezone`.
- **Business rule:** Timezone theo branch immutable cho booking snapshot; min slot configurable; interval cho phép qua ngày nếu giờ hoạt động hỗ trợ.
- **UI:** Luôn ghi timezone khi cần, cảnh báo lịch qua ngày.
- **Backend/data:** Zoned datetime/UTC instant + local date snapshot; timezone-aware aggregation.
- **Acceptance criteria:** Booking/report cùng local date; DST nếu mở rộng thị trường; dịch vụ 15 phút hợp lệ khi policy cho phép.
- **Test:** 23:30–00:30; two timezone branches; month boundary; 15/20/30-minute services.
- **Độ chắc chắn:** **Confirmed gap; mức ưu tiên phụ thuộc thị trường**.

### BB-BIZ-019 — Chưa có loyalty, gift card và membership

- **Nhóm / loại:** F / Loại 1.
- **Tình huống:** Salon muốn tích điểm, hoàn điểm khi refund hoặc bán thẻ quà tặng/gói hội viên.
- **Hiện trạng:** Có voucher và treatment package nhưng không có loyalty account/transaction, gift card hoặc membership benefits.
- **Điểm thiếu:** Growth phải xử lý ngoài hệ thống; voucher không thay thế ledger điểm.
- **Ảnh hưởng:** Customer, owner, marketing.
- **Bằng chứng:** schema không có các entity trên; module promotions/payments.
- **Business rule:** PO chốt earn/burn/expiry/refund/transfer/fraud và scope tenant/branch.
- **UI:** Ví điểm, lịch sử giao dịch, expiry, membership benefits.
- **Backend/data:** Append-only loyalty ledger; gift card balance ledger; membership subscription/version.
- **Acceptance criteria:** Điểm không âm; refund đảo đúng earning/redemption; concurrent burn không double spend.
- **Test:** earn, expire, partial refund, branch scope, account merge.
- **Độ chắc chắn:** **Confirmed missing capability; Product decision needed về roadmap**.

### BB-BIZ-020 — Thiếu hóa đơn/VAT, tip và đối soát tiền mặt cuối ca

- **Nhóm / loại:** D, E / Loại 1 và 3.
- **Tình huống:** Lễ tân thu cash nhiều lần, khách cần hóa đơn, tip cho hai staff, cuối ca thừa/thiếu tiền.
- **Hiện trạng:** Có payment/ledger/refund và split collection; không thấy invoice/tax line, cash drawer/shift close, tip/allocation.
- **Điểm thiếu:** Không thể vận hành quầy và commission/tip đầy đủ; nghĩa vụ hóa đơn/thuế chưa được chốt.
- **Ảnh hưởng:** Customer, reception, staff, owner.
- **Bằng chứng:** schema/payments/workforce; compensation có commission nhưng không tip.
- **Business rule:** Chốt tax inclusive/exclusive, invoice timing, cash opening/closing variance, tip ownership/allocation.
- **UI:** Receipt/invoice request; cash shift screen; tip split.
- **Backend/data:** Invoice/version/line/tax snapshot; CashShift/CashMovement; TipAllocation.
- **Acceptance criteria:** Payment, invoice, ledger và drawer reconcile; refund tạo adjustment/credit note theo policy.
- **Test:** split cash+bank; tip 2 staff; partial refund; shift variance; invoice reissue.
- **Độ chắc chắn:** **Confirmed gap; yêu cầu pháp lý phải xác minh riêng**.

### BB-BIZ-021 — Chưa có chuyển ownership/pháp nhân/tài khoản nhận tiền

- **Nhóm / loại:** G / Loại 1 và 7.
- **Tình huống:** Chủ bán salon hoặc đổi công ty/tài khoản payout nhưng phải giữ booking và lịch sử.
- **Hiện trạng:** Có ownerId, member và onboarding documents; không thấy ownership transfer, effective date, dual approval hoặc payout destination history.
- **Điểm thiếu:** Dễ sửa trực tiếp dữ liệu, mất chuỗi trách nhiệm tài chính và pháp lý.
- **Ảnh hưởng:** Owner cũ/mới, platform, finance, customer.
- **Bằng chứng:** `Business`, `BusinessOwnerProfile`, onboarding/review documents.
- **Business rule:** Transfer case có identity/KYB review, old+new approval, effective date, liabilities/payout split và rollback.
- **UI:** Wizard chuyển giao, impact preview, trạng thái approval.
- **Backend/data:** `OwnershipTransfer`, `LegalEntityVersion`, `PayoutAccountVersion`; immutable history.
- **Acceptance criteria:** Booking lịch sử không đổi owner ghi nhận; payout trước/sau effective date đúng; session/scope được rotate.
- **Test:** pending payment/refund, scheduled transfer, reject/cancel, former owner access.
- **Độ chắc chắn:** **Confirmed gap**.

### BB-BIZ-022 — Notification phụ thuộc in-app/email, chưa có bảo đảm giao nhận

- **Nhóm / loại:** C, J / Loại 2 và 8.
- **Tình huống:** Booking bị đổi/hủy khi customer không mở app và SMTP chưa cấu hình.
- **Hiện trạng:** Có in-app notification, mail optional và device token; chưa thấy provider SMS/push production, delivery status, retry/outbox đầy đủ cho mọi critical event.
- **Điểm thiếu:** Business transaction có thể commit trong khi gửi notification thất bại; không có escalation theo kênh.
- **Ảnh hưởng:** Customer, staff, reception; no-show và khiếu nại.
- **Bằng chứng:** modules `notifications`, `mail`, scheduler reminder; settings UI mô tả provider chưa tích hợp.
- **Business rule:** Phân loại critical/marketing; consent/channel preference; retry, fallback, quiet hours và delivery SLA.
- **UI:** Trạng thái gửi, resend có kiểm soát, contact invalid banner.
- **Backend/data:** Transactional outbox, provider delivery event, template version, dedupe key.
- **Acceptance criteria:** Booking cancel luôn có outbox; retry không gửi trùng; marketing tuân preference; content nhạy cảm được tối thiểu hóa.
- **Test:** SMTP down, invalid phone/email, duplicate worker, preference opt-out, last-minute cancel.
- **Độ chắc chắn:** **Likely gap** vì cần xác minh cấu hình runtime/provider ngoài source.

### BB-BIZ-023 — Cờ allowWalkIn/allowCounterBooking chỉ có ở cấu hình

- **Nhóm / loại:** C, D / Loại 4 và 5.
- **Tình huống:** Owner tắt đặt tại quầy nhưng receptionist/API vẫn có thể tạo nguồn tương ứng.
- **Hiện trạng:** Fields và onboarding UI tồn tại; tìm kiếm backend không thấy enforcement trong booking creation.
- **Điểm sai:** Policy có giao diện nhưng không bảo vệ ở server.
- **Ảnh hưởng:** Reception, manager, owner; dữ liệu không tuân cấu hình.
- **Bằng chứng:** `BranchBookingPolicy.allowWalkIn/allowCounterBooking`; `BranchOnboardingWizard.jsx`; booking services/controllers.
- **Business rule:** Source `WALK_IN/COUNTER/ONLINE` phải được server kiểm tra theo branch policy; override chỉ manager với reason.
- **UI:** Disable action và nêu policy; manager override modal.
- **Backend/data:** Central policy guard; audit override; source enum canonical.
- **Acceptance criteria:** API trực tiếp cũng bị chặn; policy change không làm hỏng booking cũ.
- **Test:** each source; manager override; owner disable while form open; cross-branch.
- **Độ chắc chắn:** **Confirmed gap qua static source; nên xác minh thêm e2e runtime**.

### BB-BIZ-024 — Health consultation thu dữ liệu nhưng chưa có eligibility engine

- **Nhóm / loại:** A, B, I / Loại 2, 3 và 9.
- **Tình huống:** Khách khai dị ứng thành phần chống chỉ định nhưng vẫn hoàn tất booking/service nếu staff không đọc hoặc bỏ qua.
- **Hiện trạng:** Consent, encrypted answers, review flag, scoped access và break-glass khá mạnh; không thấy service contraindication rule tự động block/require clinical review.
- **Điểm thiếu:** Thu dữ liệu nhạy cảm nhưng quyết định suitability chưa được mô hình hóa; trách nhiệm phụ thuộc thao tác người dùng.
- **Ảnh hưởng:** Customer, staff, salon; rủi ro an toàn và tranh chấp.
- **Bằng chứng:** module `privacy/consultation`, `bookings/health-records`; service catalog không có contraindication rule.
- **Business rule:** Mỗi service/version có rule: informational, warning, staff review required, hard block; override phải có qualified role, reason và fresh consent.
- **UI:** Cảnh báo tối thiểu, không lộ thông tin cho receptionist; staff checklist/acknowledgement.
- **Backend/data:** `ServiceEligibilityRule`, evaluation snapshot, reviewer qualification, override audit.
- **Acceptance criteria:** Hard-block condition không thể bypass bằng API thường; rule version lưu cùng booking; revoke consent chặn access.
- **Test:** allergy match, pregnancy, medication, unknown answer, rule update, authorized override.
- **Độ chắc chắn:** **Likely gap; clinical/product policy cần chuyên gia xác minh**.

### BB-BIZ-025 — Compensation có PRODUCT_COMMISSION nhưng không có product/inventory sale

- **Nhóm / loại:** D, E / Loại 4 và 5.
- **Tình huống:** Owner tạo commission bán sản phẩm nhưng hệ thống không có sale line để phát sinh earnings.
- **Hiện trạng:** Enum compensation có `PRODUCT_COMMISSION`; schema không thấy product, stock, sale item hoặc inventory transaction.
- **Điểm sai:** Rule không có nguồn sự kiện đáng tin cậy.
- **Ảnh hưởng:** Staff, owner; kỳ lương sai hoặc phải nhập tay.
- **Bằng chứng:** enum `CompensationRuleType`; module workforce; schema.
- **Business rule:** Hoặc ẩn/loại type đến khi có retail module, hoặc xây inventory/POS và định nghĩa trả commission sau sale/refund.
- **UI:** Không cho chọn capability chưa hoạt động; earnings có source link.
- **Backend/data:** Product/SKU/Stock/SaleLine/Return + commission reversal.
- **Acceptance criteria:** Không tạo rule không thể tính; refund sản phẩm đảo commission đúng pay run.
- **Test:** create unsupported rule; sale/return if implemented; locked pay run adjustment.
- **Độ chắc chắn:** **Confirmed gap**.

### Low

### BB-BIZ-026 — Không có frontend automated test trong source

- **Nhóm / loại:** J / Loại 8.
- **Tình huống:** Thay route/permission/booking wizard làm guest hoặc role khác bị redirect sai mà backend unit test vẫn xanh.
- **Hiện trạng:** Backend có khoảng 48 spec files; tìm kiếm frontend không thấy `.test`/`.spec`.
- **Điểm thiếu:** Không có regression cho route guard, form pricing, scheduler, permission visibility và error recovery.
- **Ảnh hưởng:** Toàn bộ role; lỗi UI quay lại sau redesign.
- **Bằng chứng:** cây file frontend/backend tại thời điểm audit.
- **Business rule:** Xác định critical journey phải có e2e; UI permission không thay server authorization nhưng phải nhất quán.
- **UI/QA đề xuất:** Component tests cho guard/form; Playwright/Cypress cho critical flows; accessibility checks.
- **Backend/data:** Seed fixture cô lập hoặc API test factory, không dùng dữ liệu thật.
- **Acceptance criteria:** CI chặn merge khi login/booking/payment/RBAC smoke fail; có test desktop/mobile.
- **Test:** guest CTA, all role landing, booking create/change/cancel, payment/refund, staff offboard impact, privacy export.
- **Độ chắc chắn:** **Confirmed gap**.

## 5. State machine thiếu hoặc transition chưa an toàn

| Domain | Hiện có | Thiếu/sai cần xử lý | Mức |
|---|---|---|---|
| Booking | Top-level lifecycle rõ | Per-item lifecycle, add/remove/skip/reprice; transfer branch; paid-cancel orchestration | P0 |
| Cancellation/no-show | Booking lưu fee | Fee settlement/waive/debt/refund state | P0 |
| Resource reservation | Không có | HELD → CONFIRMED → RELEASED/EXPIRED/MAINTENANCE | P0 |
| Promotion redemption | Campaign CRUD | ELIGIBLE → RESERVED → APPLIED → RELEASED/REVERSED | P0 |
| Staff/branch closure | Impact preview | OPEN → RESOLUTION_REQUIRED → RESOLVED → CLOSED | P0 |
| Payment gateway | Intent/transaction enums có | Provider callback inbox, UNKNOWN/RECONCILING, dispute/chargeback | P0/P1 |
| Privacy request | RECEIVED → ... → COMPLETED/REJECTED enum | Không có admin transition/executor/evidence | P0 |
| Complaint | Không có | OPEN → TRIAGE → INVESTIGATING → DECIDED → APPEALED → CLOSED | P1 |
| Review moderation | APPROVED/REPORTED/HIDDEN | Visibility tách workflow, reason/appeal/SLA | P1 |
| Trust action | Warning/restrict/suspend/restore | Case/evidence/approval/appeal + future booking resolution | P0 |
| Branch | `status` + `operationalStatus` | Canonical invariant và transition service | P0 |
| Voucher | ACTIVE/RESERVED/USED... | Redemption nhiều lượt và atomic counters theo customer | P0 |
| Waitlist | Không có | WAITING → OFFERED → ACCEPTED/EXPIRED/CANCELLED | P1 |
| Ownership transfer | Không có | DRAFT → VERIFYING → APPROVED → SCHEDULED → EFFECTIVE/ROLLED_BACK | P1 |

## 6. Quyết định Product Owner phải chốt

| ID | Quyết định | Phương án cần chọn | Hậu quả nếu chưa chốt |
|---|---|---|---|
| PO-01 | Guest checkout | Guest+OTP+claim hoặc bắt buộc account | CTA/API tiếp tục mâu thuẫn |
| PO-02 | Platform operating model | Một super-admin hay Support/Trust/Finance/Marketing tách biệt | Không thiết kế được SoD/approval |
| PO-03 | Definition of revenue | Cash received, accrual hay service recognized; kỳ refund | KPI và payout không thống nhất |
| PO-04 | Promotion stacking | Promotion+voucher+package thứ tự nào, cap nào | Sai giá và abuse |
| PO-05 | Late cancel/no-show | Mức phí, cap, deposit offset, waiver, salon cancel | Tranh chấp và tiền treo |
| PO-06 | Resource/capacity | Resource bắt buộc theo service/step, shared capacity | Overbooking vật lý |
| PO-07 | Service pricing | Fixed/from/quote, variant, surcharge, buffer | Lịch và giá không dùng được cho salon phức tạp |
| PO-08 | Post check-in change | Ai được add/remove/reprice, cần khách xác nhận thế nào | POS và booking lệch |
| PO-09 | Privacy retention | Category, thời hạn, legal hold, photo consent purpose | Không thể xây DSR executor đúng |
| PO-10 | Trust governance | Evidence threshold, auto suspend, two-person approval, appeal | Quyết định thiếu công bằng |
| PO-11 | Invoice/tax/cash | Thị trường, tích hợp hóa đơn, tax mode, shift close | Không sẵn sàng vận hành quầy |
| PO-12 | Loyalty/POS retail | Có thuộc MVP/P1 hay tích hợp bên thứ ba | Tránh để enum/UI nửa vời |

## 7. Quick wins

1. Sửa report category/service/top branch lọc rõ status; bỏ nhãn “revenue” ở dữ liệu price snapshot chưa thu.
2. Ẩn/tắt UI field promotion/voucher chưa có enforcement và ghi rõ capability hiện hỗ trợ.
3. Ẩn method MoMo/VNPay/ZaloPay/card khi provider chưa READY.
4. Chặn deactivate staff/branch nếu còn booking active thay vì chỉ checkbox acknowledge.
5. Tạm loại `REPORTED` khỏi public review query cho đến khi có moderation policy.
6. Enforce `allowWalkIn` và `allowCounterBooking` ở backend.
7. Đổi route/CTA guest theo quyết định PO-01; thêm resume-after-login test.
8. Bắt buộc reason cho hide/restore review và action nhạy cảm.
9. Ẩn `PRODUCT_COMMISSION` nếu chưa có retail source.
10. Thêm metric dictionary và tooltip; rating average/distribution dùng cùng population.
11. Thêm cảnh báo “fee mới được ghi nhận, chưa thu” nếu chưa có fee ledger.
12. Thêm CI e2e smoke cho role landing và booking wizard.

## 8. Roadmap đề xuất

### P0 — Trước production

- Metric contract + sửa toàn bộ report tiền/booking/refund.
- Pricing engine thống nhất promotion/voucher/package, snapshot và redemption atomic.
- Resource/capacity reservation tối thiểu cho branch cần máy/phòng/giường.
- Operational impact workflow cho staff/branch/business closure/suspend.
- SoD nền tảng và maker-checker cho refund/trust/settings.
- Cancellation/no-show financial settlement.
- Chỉ công bố payment provider thật; webhook/idempotency/reconciliation nếu có online.
- Voucher enforcement đúng field hoặc loại field không hỗ trợ.
- Canonical branch state/invariant.
- DSR admin workflow tối thiểu và retention/photo-consent decision.
- Guest strategy nhất quán.

### P1 — Sau khi P0 ổn định

- Per-item booking operation, add-on/reprice/split staff.
- Complaint/case/appeal end-to-end.
- Service variant/from/quote/surcharge/buffer/eligibility.
- Waitlist + slot offer.
- Invoice/tax/cash shift/tip theo thị trường.
- Notification outbox và SMS/push provider.
- Ownership/legal entity/payout transfer.
- Loyalty/gift card/membership nếu thuộc product strategy.

### P2 — Cải tiến

- Group/dependent booking.
- Multi-timezone/cross-midnight mở rộng thị trường.
- Advanced capacity optimization và controlled overbooking.
- Forecasting/no-show prediction nhưng không dùng customer no-show để phạt salon.
- Retail inventory/POS và product commission.

## 9. Bộ scenario QA thực tế

### 9.1 Booking và capacity

1. Hai customer đồng thời giữ staff cuối cùng cùng slot; đúng một booking thành công.
2. Hai staff khác nhau đặt cùng máy độc quyền; đúng một booking thành công sau khi có resource model.
3. Combo 3 bước, hai staff, một transition buffer; timeline không overlap.
4. Customer add dịch vụ sau check-in; total, duration, staff, resource, payment delta cùng cập nhật.
5. Customer bỏ một item đã trả; partial refund và commission reversal đúng item.
6. Staff nghỉ đột xuất có 10 lịch; hệ thống không cho close case đến khi 10 lịch resolved.
7. Branch suspend có booking paid; public listing đóng, lịch được reassign/cancel/refund và notification có delivery record.
8. Dịch vụ 15 phút và booking 23:30–00:30 theo branch policy/timezone.
9. Customer đặt cho con; consent và health record thuộc recipient, không thuộc booker.
10. Guest explore → booking/login → quay lại đúng slot và không mất selection.

### 9.2 Pricing, voucher và payment

11. Promotion service+branch đúng thời gian; giá public=preview=booking=payment.
12. Promotion hết hạn sau khi slot đã giữ; booking vẫn giữ snapshot hợp lệ.
13. Voucher NEW_CUSTOMER bị từ chối với khách đã completed booking.
14. Hai tab dùng voucher cuối cùng; chỉ một redemption thành công.
15. Booking expire/cancel release voucher đúng policy; refund không tự restore nếu policy không cho.
16. Deposit 200k, late fee 300k; ledger thể hiện giữ 200k và còn thu 100k/waiver.
17. Salon cancel booking paid; full refundable được tạo idempotent, voucher/package restore đúng.
18. Gateway callback success lặp 5 lần; chỉ một verified transaction/ledger entry.
19. Callback amount mismatch hoặc đến sau timeout; vào reconciliation, không auto-complete booking sai.
20. Partial refund qua hai request song song; tổng không vượt refundable balance.

### 9.3 RBAC, multi-tenant và governance

21. Receptionist branch A không đọc/tạo/sửa booking branch B bằng API trực tiếp.
22. Staff chỉ đọc health field được consent, đúng booking được phân công và trong access window.
23. Former staff sau offboarding dùng refresh token cũ; session bị revoke và không đọc dữ liệu.
24. Support read-only không refund/suspend; Finance không đọc health; Trust không đổi platform payment policy.
25. Người tạo refund/trust action không tự duyệt khi maker-checker bật.
26. Branch `status`/`operationalStatus` ở mọi transition không rơi vào combination bất hợp lệ.
27. Ownership transfer effective giữa kỳ; payout trước/sau ngày đúng owner/legal entity.

### 9.4 Privacy, review và support

28. Export yêu cầu password, token tải một lần và hết hạn; người khác không tải được.
29. Erasure có active booking/payment/legal hold; executor giữ đúng phần bắt buộc, anonymize phần còn lại và ghi evidence.
30. Consent health bị revoke trước dịch vụ; staff mất quyền đọc ngay, access attempt được log.
31. Ảnh trước/sau chỉ dùng chăm sóc; không xuất hiện marketing khi thiếu consent marketing riêng.
32. Review chứa PII bị report; lập tức quarantine, moderator decision có reason, appeal được theo dõi.
33. Injury complaint liên kết booking, consultation, evidence, refund và trust action; tenant khác không đọc được.
34. Notification worker lỗi giữa chừng; transaction nghiệp vụ không mất outbox, retry không gửi trùng.

### 9.5 Reporting reconciliation

35. Pending/cancel/no-show không tăng recognized revenue.
36. Completed nhưng chưa trả phân biệt service completion với cash collected.
37. Partial refund ở tháng sau phản ánh gross/refund/net đúng kỳ và drill-down.
38. Voucher/promotion allocation làm tổng item bằng final booking amount.
39. Report owner bằng tổng branch cùng scope/timezone; user không thuộc tenant không xem được.
40. Rating average, distribution, count và public visibility dùng cùng policy.

## 10. Điểm hệ thống đã làm tốt

- Booking có kiểm tra giờ làm, nghỉ, kỹ năng, overlap và transaction serializable chống race staff.
- Giá/thời lượng được snapshot vào booking item, giúp lịch sử không phụ thuộc catalog hiện tại.
- Refund có reserved balance, transition, transaction và cấm creator tự approve ở service hiện có.
- Health data có mã hóa, consent theo field/scope, scoped access, access log và break-glass.
- Privacy export có re-authentication, mã hóa, TTL và token tải một lần.
- Workforce đã có attendance exception, timesheet, compensation, pay run và audit tương đối sâu.
- Public branch readiness đã kiểm tra business/branch/service/staff trước khi cho book.
- Backend test hiện chạy xanh 50 suites/266 tests; nhiều domain quan trọng đã có unit/integration spec.

Những điểm tốt này là nền tảng để vá nghiệp vụ; vấn đề lớn nhất không phải “thiếu mọi thứ”, mà là một số module đã có data model/UI nhưng chưa được nối thành một transaction và state machine vận hành xuyên suốt.
