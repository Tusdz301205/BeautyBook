# BeautyBook — Database/schema audit, cập nhật tăng dần sau booking policy

> **Đã được thay thế bởi audit final ngày 21/09/2026:** main đã nhận đủ 5 migration; 12 bảng health đã archive; 2 consent giữ nguyên; 395 FK/0 orphan; active Prisma 121 model/92 enum. Final regression đạt 103 suite/943 test BE+PostgreSQL, 58 FE, 66 browser actor/RBAC/booking/responsive và 12 concurrency/negative. Xem `DATABASE_SCHEMA_AUDIT_FINAL.md`. Nội dung bên dưới là lịch sử phân tích, không phải trạng thái hiện hành.

> Rehearsal cleanup mới nhất 19/09: active source **121 model /92 enum**, 12 model và 10 enum exclusive chuyển sang archive trên copy1903; DB chính vẫn chưa đổi. Đây chưa phải audit FINAL đã được user duyệt. Xem `HEALTH_ARCHIVE_REHEARSAL_RESULT.md`. Số133 và quyết định bên dưới là baseline ngay trước archive, được giữ nguyên để truy nguyên; sẽ finalize sau khi kết quả rehearsal được xác nhận.

## Delta hiện hành ngày 19/09/2026

Phần baseline ngày 15/09 phía dưới được giữ làm bằng chứng lịch sử, không coi số liệu/callsite cũ là snapshot hiện hành. Đã đối chiếu phần thay đổi account/cancellation/violation, không audit lại toàn bộ 131 model từ đầu.

| Phân loại | Baseline | Hiện tại |
|---|---:|---:|
| Tổng model | 131 | 133 |
| KEEP | 91 | 93 |
| REMOVE_CANDIDATE | 12 | 12 |
| MERGE_CANDIDATE | 2 | 1 |
| REFACTOR | 24 | 25 |
| NEEDS_REVIEW | 2 | 2 |

Schema có 102 enum (thêm BookingViolationKind: LATE_CANCELLATION/NO_SHOW). Hash source hiện tại: `76c01a6018f921ea6d49705f3cd6b80ca13569c340e44c8ac0ff0697300a4997`. Không suy ra catalog DB chính đã có các model mới.

| Model | Kết luận sau đối chiếu | Bằng chứng / ảnh hưởng |
|---|---|---|
| BookingViolationEvent | KEEP, mới | booking-violation-policy.ts; history immutable, partial unique một valid event/booking, requestedAt snapshot, VOID có audit; điểm rolling Customer+Business. Không drop/recompute từ Booking.status. |
| CustomerBookingPolicy | KEEP, mới | customer-booking-policy.ts; unique pair; 3 FK Restrict; revision fence SERIALIZABLE; restriction 30 ngày theo event; audit before/after. Không phải điểm cộng dồn hoặc account blacklist. |
| CancellationPolicy | MERGE_CANDIDATE → REFACTOR | Hủy đúng giờ cố định 4h, phí bỏ; reschedule resolver riêng vẫn hoạt động. Không merge vội với BranchBookingPolicy hoặc policy hạn chế mới. |
| AppointmentChangeRequest | KEEP, lý do cập nhật | Source FK của valid late event; hết hạn/approve không xóa +1. Giữ requestedAt/expiry/history; không tạo model trùng CancellationRequest. |
| CustomerProfile | REFACTOR, giữ | Định danh lịch sử khách, thêm event/policy relations. Không dùng tồn tại profile để cấp quyền Customer cho account vận hành; không merge/xóa profile. |
| Booking / BookingStatusHistory | REFACTOR / KEEP | Giữ ngày giờ, trạng thái và lịch sử; vi phạm là entity riêng, không suy mọi CANCELLED thành +1. |
| UserRole / UserSession / StaffInvitation / OwnershipTransfer | Giữ phân loại hiện tại | Account separation ở guard/service và migration 16; không được cấp Customer kèm operational. Không lặp chuyển Manager. |
| Branch / Business / Notification / AuditLog | Giữ phân loại hiện tại | Tenant scope và public/preview; cảnh báo factual; audit policy và acknowledgment. Không xóa các entity này do thêm restriction. |

READ ONLY DB chính ngày 19/09 xác nhận 4.000 Booking. Ba migration 16/17/18 chưa applied. Fresh-copy rehearsal trước test giữ fingerprint/count 166 bảng và 4.000 bookings. Bản sao test có fixture riêng sau rehearsal, không dùng làm bằng chứng số dòng production.

Đề xuất cleanup và FK chi tiết: [DATABASE_SCHEMA_CLEANUP_APPROVAL.md](DATABASE_SCHEMA_CLEANUP_APPROVAL.md). 12 REMOVE vẫn chỉ là ứng viên archive; 1 MERGE giữ compatibility; 25 REFACTOR không cho phép đổi schema hàng loạt. PlatformSetting/PayoutAccountVersion vẫn chờ quyết định. Không drop bảng, không sửa enum/index/legacy permission theo số liệu baseline khi chưa kiểm chứng riêng.

## Baseline 15/09/2026 — lưu để truy nguyên, không phải schema cuối

Ngày đối chiếu: **15/09/2026**. Nguồn: schema Prisma, 158 file production TypeScript, các service/route và PostgreSQL local sau migration loại Manager. Đây là phân loại có bằng chứng và đề xuất thay đổi; không phải xác nhận mọi invariant hoặc mọi workflow đã hoàn hảo.

## 1. Kết luận và số liệu A–G

- A. Model hiện tại: **131** (131 table khớp đủ schema). Chưa xóa/gộp model trong Phase 2.
- B. Enum Prisma: **101**, tổng **462** giá trị; không còn Manager trong enum hoạt động.
- C. KEEP: **91** model.
- D. REMOVE_CANDIDATE: **12** model sức khỏe/consultation đã retired.
- E. MERGE_CANDIDATE: **2**: SalonMember, CancellationPolicy.
- F. REFACTOR: **24**; NEEDS_REVIEW: **2**. Chi tiết đủ 131 dòng ở mục 3.
- G. Các FK ứng viên còn thiếu được liệt kê ở mục 6; 20 phép kiểm orphan chọn lọc đều bằng 0, nhưng điều đó không thay cho FK hoặc bảo đảm tất cả scalar ID đều đã được kiểm tra.

Prisma: 2.074 field (bao gồm 644 relation fields ở hai phía), 322 quan hệ có local FK, 131 PK, 96 unique declarations, 229 index declarations. Không được gọi 644 relation fields là 644 FK.

PostgreSQL: 167 table gồm 131 active model + 36 table ngoài Prisma; 124 enum type bao gồm legacy/archive. Trong 131 table active có 322 FK đã validate, 17 CHECK, 461 index vật lý. Index vật lý bao gồm PK/unique/SQL-only nên không bằng 229 khai báo @@index. PostgreSQL 18 còn thống kê NOT NULL như constraint; không dùng tổng pg_constraint làm số FK.

## 2. Phạm vi và độ tin cậy

- Đã xác nhận: tên model/table/field/enum, PK/unique/FK/index/trigger, số bản ghi tại thời điểm kiểm tra, direct delegate/SQL call và các nested call đã đối chiếu.
- Suy luận/đề xuất: phân loại REFACTOR/MERGE/REMOVE và thiết kế ràng buộc mới. Không tự suy ra dữ liệu rỗng là chức năng thừa.
- Chưa đủ thông tin: retention của dữ liệu cũ, persisted GUEST có cần tương thích bên ngoài, payout account khi chỉ thu tại quầy, và một số field JSON có phải snapshot hay dữ liệu quản trị sống.
- Không thêm HR, health, thanh toán online hoặc phí hủy trở lại. Cash tại quầy, refund, invoice, ledger, package và loyalty vẫn có backend thực; tên gọi tài chính không đủ để xóa.
- Không thấy module/route/model sentiment được tích hợp trong src. Không thêm bảng AI/sentiment chỉ để phù hợp một sơ đồ dự kiến.
- Công cụ quét direct usage không nhận hết query bị ngắt dòng, nested relation hoặc dynamic access. Danh sách này là bằng chứng hỗ trợ, không phải bộ chứng minh dead code tự động.

## 3. Phân loại toàn bộ model

| Model / table | Domain | Số dòng DB | Được dùng ở đâu | Hành động | Lý do / lưu ý |
| --- | --- | ---: | --- | --- | --- |
| User / `users` | AUTH / USER | 1038 | src/auth/auth.service.ts:55; src/auth/auth.service.ts:81; schema.prisma:9 | **KEEP** | Tài khoản đăng nhập; soft delete giữ lịch sử, isActive khóa đăng nhập không đồng nghĩa đã xóa. |
| AccountToken / `account_tokens` | AUTH / USER | 0 | src/auth/auth.service.ts:602; src/auth/auth.service.ts:607; schema.prisma:78 | **KEEP** | Token xác minh/khôi phục có hash, hạn dùng và dấu đã sử dụng; không gộp với phiên đăng nhập. |
| UserSession / `user_sessions` | AUTH / USER | 76 | src/auth/auth.service.ts:298; src/auth/auth.service.ts:316; schema.prisma:93 | **REFACTOR** | Giữ quản lý phiên/thu hồi. businessId và branchId là scalar không FK; cần xác nhận snapshot scope hay tham chiếu sống trước khi thêm FK. |
| PlatformSetting / `platform_settings` | SYSTEM / INFRASTRUCTURE | 0 | src/platform-settings/platform-settings.service.ts:98; src/platform-settings/platform-settings.service.ts:114; schema.prisma:114 | **NEEDS_REVIEW** | Key/value JSON đang dùng qua PlatformSettingsService. Kiểm kê từng key và quyền sửa; updatedBy chưa là FK, không thêm schema theo suy đoán. |
| StaffInvitation / `staff_invitations` | AUTH / USER | 0 | src/staff/staff-invitations.service.ts:65; src/staff/staff-invitations.service.ts:72; schema.prisma:125 | **REFACTOR** | Giữ invitation chỉ Receptionist/Staff; businessId, branchId, invitedBy, acceptedBy chưa có FK trong Prisma. |
| Role / `roles` | AUTH / USER | 6 | src/auth/auth.service.ts:167; src/common/utils/policy.ts:138; schema.prisma:149 | **REFACTOR** | Manager đã loại; GUEST còn definition nhưng 0 assignment. Public access không tự chứng minh cần persisted GUEST. |
| Permission / `permissions` | AUTH / USER | 137 | src/users/users.service.ts:365; schema.prisma:161 | **REFACTOR** | 113 code runtime nhưng DB có 137 definitions: 24 code ngoài catalog cần archive/dọn riêng sau kiểm tra grant. |
| RolePermission / `role_permissions` | AUTH / USER | 138 | src/auth/auth.service.ts (nested role.rolePermissions), src/common/utils/policy.ts; schema.prisma:176 | **KEEP** | Bảng nối role–permission; được dùng qua nested rolePermissions, không được xóa vì không gọi delegate trực tiếp. |
| UserPermission / `user_permissions` | AUTH / USER | 69 | src/users/users.service.ts:393; src/users/users.service.ts:437; schema.prisma:188 | **REFACTOR** | Có 69 bản ghi; 8 grant trỏ code ngoài catalog. Runtime fail closed với code lạ, cần lưu lịch sử trước khi dọn. |
| UserRole / `user_roles` | AUTH / USER | 1038 | src/auth/auth.service.ts:201; src/branches/branches.service.ts:1200; schema.prisma:211 | **KEEP** | Cấp vai trò theo scope và thời hạn; unique theo scope nullable và trigger kiểm tra branch/business đã tồn tại. |
| CustomerProfile / `customer_profiles` | AUTH / USER | 1000 | src/auth/auth.service.ts:213; src/bookings/bookings-access.service.ts:216; schema.prisma:234 | **REFACTOR** | Giữ định danh khách cho booking. address có ở cả User và CustomerProfile; cần chốt nguồn chuẩn và ý nghĩa note. |
| BookingContact / `booking_contacts` | BOOKING | 0 | src/bookings/bookings.service.ts:1348; schema.prisma:271 | **KEEP** | Snapshot người liên hệ theo booking, có thể khác hồ sơ khách đăng nhập. |
| BusinessOwnerProfile / `business_owner_profiles` | AUTH / USER | 5 | src/auth/auth.service.ts:188; src/business/business-onboarding.service.ts:329; schema.prisma:284 | **KEEP** | Danh tính chủ doanh nghiệp khác tài khoản và khác pháp nhân theo phiên bản. |
| StaffProfile / `staff_profiles` | STAFF | 29 | src/bookings/booking-items.service.ts:109; src/bookings/bookings-access.service.ts:93; schema.prisma:301 | **REFACTOR** | Giữ nhân sự cung cấp dịch vụ và lịch sử booking. branchId là chi nhánh gốc, StaffBranchAssignment là phân công có thời hạn; cần chốt primary branch khi đa chi nhánh. |
| DeviceToken / `device_tokens` | AUTH / USER | 0 | src/notifications/notifications.service.ts:187; src/notifications/notifications.service.ts:198; schema.prisma:339 | **KEEP** | Định danh thiết bị nhận thông báo; hiện rỗng không có nghĩa là dead. |
| Province / `provinces` | BUSINESS / BRANCH | 5 | src/services/services.service.ts:452; schema.prisma:352 | **KEEP** | Danh mục vùng cho tìm kiếm/địa chỉ; không phải bảng HR. |
| District / `districts` | BUSINESS / BRANCH | 30 | src/branches/branches.service.ts:47; src/services/services.service.ts:451; schema.prisma:362 | **KEEP** | Địa chỉ theo Province; FK và dữ liệu thực đang dùng. |
| Business / `businesses` | BUSINESS / BRANCH | 5 | src/admin/admin.controller.ts:131; src/admin/admin.controller.ts:132; schema.prisma:376 | **REFACTOR** | Giữ entity tenant. legalDocuments/onboardingData JSON có thể chồng với Document/Version; cần xác định canonical fields và compatibility. |
| Branch / `branches` | BUSINESS / BRANCH | 11 | src/admin/admin.controller.ts:205; src/admin/admin.controller.ts:206; schema.prisma:453 | **REFACTOR** | Giữ scope. status/reviewStatus/operationalStatus biểu diễn ba khía cạnh; cần chốt state matrix, không gộp thành một status. managerName chỉ là người liên hệ. |
| BranchWorkingHour / `branch_working_hours` | BUSINESS / BRANCH | 77 | src/bookings/bookings.service.ts:1879; src/bookings/bookings.validation.ts:181; schema.prisma:549 | **KEEP** | Giờ mở cửa chi nhánh phục vụ availability; không phải phân ca nhân viên. |
| BranchOnboardingProgress / `branch_onboarding_progress` | BUSINESS / BRANCH | 11 | src/branches/branches.service.ts:943; schema.prisma:562 | **KEEP** | Tiến độ/draft onboarding chi nhánh, không đồng nghĩa hồ sơ đã duyệt. |
| BranchBookingPolicy / `branch_booking_policies` | BUSINESS / BRANCH | 11 | src/bookings/bookings.controller.ts:229; src/branches/branches.service.ts:934; schema.prisma:575 | **REFACTOR** | Giữ lead time, horizon, buffer, walk-in và cutoff cấp branch. depositPolicy là JSON legacy cần tách khỏi phạm vi online đã bỏ. |
| OverbookingOverride / `overbooking_overrides` | BOOKING | 0 | src/bookings/bookings.service.ts:1155; src/bookings/bookings.service.ts:1300; schema.prisma:599 | **REFACTOR** | Bằng chứng override có lý do/actor; không xóa bảo vệ concurrency. branchId/actorId hiện chưa FK. |
| BranchHoliday / `branch_holidays` | BUSINESS / BRANCH | 0 | src/bookings/bookings.service.ts:985; src/bookings/bookings.service.ts:1873; schema.prisma:615 | **KEEP** | Ngoại lệ ngày đóng cửa phục vụ booking; không phải nghỉ phép nhân viên. |
| SpecialWorkingDay / `special_working_days` | BUSINESS / BRANCH | 0 | src/bookings/bookings.service.ts:993; src/bookings/bookings.service.ts:1876; schema.prisma:627 | **KEEP** | Giờ mở cửa đặc biệt của chi nhánh; giữ để kiểm tra availability. |
| StaffBranchAssignment / `staff_branch_assignments` | STAFF | 30 | src/staff/staff-invitations.service.ts:310; src/staff/staff.service.ts:428; schema.prisma:639 | **KEEP** | Nhân sự–chi nhánh có hiệu lực, status, bookability; không phải ca làm/attendance. |
| MediaFile / `media_files` | MEDIA | 0 | src/branches/branches.service.ts:1033; src/business/business-onboarding.service.ts:242; schema.prisma:660 | **REFACTOR** | Giữ tệp/visibility. entityType/entityId là polymorphic; businessId/branchId chưa FK. Không thêm FK entityId cố định; kiểm tra scope tại service. |
| BusinessImage / `business_images` | MEDIA | 0 | src/media/media.service.ts:160; src/media/media.service.ts:255; schema.prisma:695 | **KEEP** | Bảng nối ảnh doanh nghiệp, có cover/sort order. |
| BranchImage / `branch_images` | MEDIA | 0 | src/media/media.service.ts:161; src/media/media.service.ts:256; schema.prisma:709 | **KEEP** | Bảng nối ảnh chi nhánh và thứ tự. |
| ServiceImage / `service_images` | MEDIA | 0 | src/media/media.service.ts:162; src/media/media.service.ts:257; schema.prisma:723 | **KEEP** | Ảnh offering; không cùng nghĩa ảnh doanh nghiệp. |
| ComboImage / `combo_images` | MEDIA | 0 | src/media/media.service.ts:163; src/media/media.service.ts:258; schema.prisma:736 | **KEEP** | Ảnh combo đang có endpoint media. |
| StaffImage / `staff_images` | MEDIA | 0 | src/media/media.service.ts:164; src/media/media.service.ts:259; schema.prisma:749 | **KEEP** | Ảnh hồ sơ người cung cấp dịch vụ. |
| ServiceCategory / `service_categories` | SERVICE | 56 | src/reports/reports.service.ts:49; src/services/services.service.ts:125; schema.prisma:762 | **KEEP** | Danh mục riêng business có cây parent; không gộp với taxonomy chuẩn. |
| CanonicalService / `canonical_services` | SERVICE | 12 | src/services/services.service.ts:146; src/services/services.service.ts:173; schema.prisma:785 | **KEEP** | Taxonomy nền tảng, có merge/replacement; dùng chuẩn hóa và tìm kiếm. |
| BusinessService / `business_services` | SERVICE | 83 | src/services/services.controller.ts:206; src/services/services.controller.ts:219; schema.prisma:812 | **KEEP** | Định nghĩa dịch vụ cấp tenant; khác offering/giá triển khai tại branch. |
| BranchServiceOffering / `services` | SERVICE | 116 | src/bookings/booking-items.service.ts:36; src/bookings/bookings.controller.ts:329; schema.prisma:841 | **KEEP** | Offering cấp branch. Giá/thời lượng riêng là chủ đích, có trigger branch–business service cùng tenant. |
| StaffService / `staff_services` | STAFF | 195 | src/operations/waitlist.service.ts:37; src/services/services.service.ts:467; schema.prisma:885 | **KEEP** | Năng lực nhân sự đối với offering cụ thể, khác StaffBranchAssignment; bắt buộc cho phân công booking. |
| Combo / `combos` | SERVICE | 1 | src/bookings/bookings.controller.ts:300; src/bookings/bookings.service.ts:764; schema.prisma:897 | **KEEP** | Gói nhiều dịch vụ cùng lần đặt, không phải TreatmentPackage nhiều buổi. |
| ComboService / `combo_services` | SERVICE | 2 | src/bookings/bookings.controller.ts:305; src/combos/combos.service.ts:109; schema.prisma:930 | **KEEP** | Cấu phần combo với quantity, sort, snapshot và transition; quan hệ N–N có thuộc tính. |
| Promotion / `promotions` | PROMOTION / VOUCHER | 3 | src/admin/admin.controller.ts:339; src/promotions/pricing-engine.service.ts:45; schema.prisma:947 | **KEEP** | Khuyến mãi tự áp dụng, quota/audience/stacking/version có backend pricing. |
| PromotionBusiness / `promotion_businesses` | PROMOTION / VOUCHER | 1 | src/promotions/promotions.service.ts:164 (nested businessLinks); schema.prisma:980 | **KEEP** | Scope đa business tạo/đọc qua nested businessLinks; hiện có 1 dòng, không phải dead table. |
| PromotionBranch / `promotion_branches` | PROMOTION / VOUCHER | 1 | src/promotions/promotions.service.ts:287; src/promotions/promotions.service.ts:288; schema.prisma:991 | **KEEP** | Giới hạn branch cho promotion. |
| PromotionService / `promotion_services` | PROMOTION / VOUCHER | 0 | src/promotions/promotions.service.ts:291; src/promotions/promotions.service.ts:292; schema.prisma:1002 | **KEEP** | Giới hạn offering cho promotion. |
| PromotionCombo / `promotion_combos` | PROMOTION / VOUCHER | 0 | src/promotions/promotions.service.ts:295; src/promotions/promotions.service.ts:296; schema.prisma:1013 | **KEEP** | Giới hạn combo cho promotion. |
| Booking / `bookings` | BOOKING | 4000 | src/admin/admin.controller.ts:152; src/admin/admin.controller.ts:235; schema.prisma:1024 | **REFACTOR** | Giữ aggregate, ngày/giờ wall-clock, nguồn, hold và status. cancellationFeeAmount/sensitiveDataConsent là cột legacy cần archive hoặc compatibility có chủ đích. |
| BookingService / `booking_services` | BOOKING | 4000 | src/bookings/booking-item-lifecycle.ts:14; src/bookings/booking-items.service.ts:59; schema.prisma:1095 | **REFACTOR** | Giữ từng dịch vụ, giá/tên/thời lượng snapshot, assignment và slot. variantId hiện chưa FK; cần kiểm tra orphan trước khi ràng buộc. |
| BookingStatusHistory / `booking_status_histories` | BOOKING | 7268 | src/bookings/bookings.service.ts:584; src/bookings/bookings.service.ts:1403; schema.prisma:1137 | **KEEP** | Timeline trạng thái bất biến theo sự kiện, không gộp vào Booking.updatedAt. |
| RecurringBookingPlan / `recurring_booking_plans` | BOOKING | 0 | src/bookings/bookings.service.ts:1708; src/recurring/recurring-creation-fence.ts:13; schema.prisma:1151 | **REFACTOR** | Luồng định kỳ có recovery worker. serviceIds JSON cần validation và snapshot/version rõ; không coi là join table tự do. |
| Payment / `payments` | PAYMENT / FINANCE | 4000 | src/admin/admin.controller.ts:311; src/bookings/bookings.controller.ts:1258; schema.prisma:1183 | **KEEP** | Thanh toán gắn booking vẫn dùng cho thu tiền tại quầy/báo cáo; không xóa 4.000 dòng vì online retired. |
| RefundRequest / `refund_requests` | PAYMENT / FINANCE | 0 | src/ownership/ownership.service.ts:146; src/ownership/ownership.service.ts:339; schema.prisma:1205 | **REFACTOR** | Luồng hoàn thủ công còn hoạt động; requestedBy/reviewedBy/processedBy chưa FK, cần bảo toàn bằng chứng cũ. |
| PricingSnapshot / `pricing_snapshots` | PAYMENT / FINANCE | 4000 | src/payments/payments.service.ts:593; schema.prisma:1236 | **KEEP** | Snapshot bất biến giá lúc phát sinh thanh toán; khác giá hiện tại của service. |
| PaymentPolicy / `payment_policies` | PAYMENT / FINANCE | 0 | src/payments/payments.service.ts:627; src/payments/payments.service.ts:1086; schema.prisma:1256 | **REFACTOR** | Chính sách deposit/split/installment còn API nhưng phạm vi online đã bỏ; cần phân biệt chính sách thu tại quầy và cấu hình cũ. |
| PaymentPolicySnapshot / `payment_policy_snapshots` | PAYMENT / FINANCE | 4000 | src/payments/payments.service.ts:604; schema.prisma:1283 | **REFACTOR** | 4.000 snapshot lịch sử phải giữ kể cả policy online ngừng sử dụng. |
| PaymentIntent / `payment_intents` | PAYMENT / FINANCE | 4000 | src/payments/payments.service.ts:211; src/payments/payments.service.ts:235; schema.prisma:1305 | **REFACTOR** | Không chỉ online: đang tạo qua luồng quầy và có 4.000 dòng. provider/metadata/expiry cần phân loại legacy, không drop. |
| PaymentTransaction / `payment_transactions` | PAYMENT / FINANCE | 4000 | src/ownership/ownership.service.ts:143; src/ownership/ownership.service.ts:338; schema.prisma:1339 | **REFACTOR** | Giao dịch kiểm chứng, có trigger immutable; verifiedBy/createdBy-related metadata cần ràng buộc actor rõ. |
| FinancialLedgerEntry / `financial_ledger_entries` | PAYMENT / FINANCE | 2179 | src/payments/payments.service.ts:872; src/payments/payments.service.ts:911; schema.prisma:1382 | **KEEP** | Sổ bút toán CREDIT/DEBIT append-only có idempotency; không bỏ theo tên payment. |
| RefundAllocation / `refund_allocations` | PAYMENT / FINANCE | 0 | src/payments/payments.service.ts:98 (nested allocations); schema.prisma:1415 | **KEEP** | Phân bổ hoàn theo dịch vụ dùng qua nested allocations; tránh hoàn vượt phần được trả. |
| PlatformFeeEntry / `platform_fee_entries` | PAYMENT / FINANCE | 0 | src/payments/payments.service.ts:994; src/payments/payments.service.ts:1190; schema.prisma:1429 | **KEEP** | Phí nền tảng theo booking, khác phí hủy; nghiệp vụ tài chính đang có service. |
| PlatformFeeAdjustment / `platform_fee_adjustments` | PAYMENT / FINANCE | 0 | src/payments/payments.service.ts:1043; src/payments/payments.service.ts:1046; schema.prisma:1452 | **KEEP** | Điều chỉnh phí nền tảng liên quan refund, giữ dấu vết. |
| PlatformStatement / `platform_statements` | PAYMENT / FINANCE | 0 | src/payments/payments.service.ts:1178; src/payments/payments.service.ts:1184; schema.prisma:1472 | **KEEP** | Kỳ đối soát/phát hành/khóa; có trigger bảo vệ sau phát hành. |
| PlatformStatementLine / `platform_statement_lines` | PAYMENT / FINANCE | 0 | src/payments/payments.service.ts:1208 (nested lines); schema.prisma:1496 | **KEEP** | Dòng bảng kê tạo/đọc qua nested lines; không có delegate call không phải không dùng. |
| TreatmentPackage / `treatment_packages` | PAYMENT / FINANCE | 0 | src/payments/payments.service.ts:1294; src/payments/payments.service.ts:1325; schema.prisma:1514 | **KEEP** | Gói nhiều buổi/liệu trình; khác Combo cùng booking, có route thực. |
| PackagePurchase / `package_purchases` | PAYMENT / FINANCE | 0 | src/payments/payments.service.ts:1399; src/payments/payments.service.ts:1467; schema.prisma:1536 | **KEEP** | Quyền mua gói theo khách/business, snapshot giá và hạn dùng. |
| PackageInstallment / `package_installments` | PAYMENT / FINANCE | 0 | src/payments/payments.service.ts:811; src/payments/payments.service.ts:891; schema.prisma:1563 | **REFACTOR** | Trả góp gói tại quầy vẫn có service; paymentIntentId chưa FK dù tồn tại PaymentIntent.packageInstallmentId. |
| PackageSessionEntitlement / `package_session_entitlements` | PAYMENT / FINANCE | 0 | src/payments/payments.service.ts:1639; src/payments/payments.service.ts:1644; schema.prisma:1581 | **KEEP** | Quyền sử dụng từng buổi, trạng thái reserve/redeem theo booking item. |
| Review / `reviews` | REVIEW / TRUST | 871 | src/admin/admin.controller.ts:236; src/branches/branches.service.ts:172; schema.prisma:1599 | **KEEP** | Đánh giá sau booking, gắn CustomerProfile và Booking; không có model sentiment đã tích hợp. |
| ReviewServiceRating / `review_service_ratings` | REVIEW / TRUST | 871 | src/reviews/reviews.service.ts:198; src/reviews/reviews.service.ts:246; schema.prisma:1624 | **KEEP** | Điểm theo dịch vụ/nhân sự trong booking; không gộp mất chi tiết. |
| BusinessComment / `business_comments` | REVIEW / TRUST | 200 | src/reviews/reviews.service.ts:458; schema.prisma:1641 | **KEEP** | Bình luận/phản hồi business, có parent và review optional; khác review sau mua. |
| Notification / `notifications` | NOTIFICATION / AUDIT | 1065 | src/admin/trust-snapshot.service.ts:279; src/branches/branches.service.ts:1206; schema.prisma:1663 | **KEEP** | Thông báo in-app theo người dùng với read state và target. |
| NotificationOutbox / `notification_outbox` | NOTIFICATION / AUDIT | 0 | src/notifications/notification-outbox.worker.ts:36; src/notifications/notification-outbox.worker.ts:38; schema.prisma:1691 | **KEEP** | Hàng đợi durable có dedupe/retry; không gộp với Notification vì trạng thái giao nhận khác. |
| AuditLog / `audit_logs` | NOTIFICATION / AUDIT | 281 | src/admin/admin.controller.ts:95; src/auth/auth.service.ts:520; schema.prisma:1721 | **KEEP** | Lịch sử thao tác actor/entity và before/after; giữ cả khi ẩn menu audit. |
| SalonMember / `salon_members` | BUSINESS / BRANCH | 0 | src/admin/trust-snapshot.service.ts:278; src/business/salon-members.service.ts:12; schema.prisma:1739 | **MERGE_CANDIDATE** | Metadata membership cũ, không còn là nguồn phân quyền. Sau refactor thông báo, chỉ còn service compatibility; cần rà route/caller trước khi hợp nhất vào UserRole. |
| CancellationPolicy / `cancellation_policies` | BUSINESS / BRANCH | 0 | src/business/cancellation-policies.service.ts:50; src/business/cancellation-policies.service.ts:54; schema.prisma:1759 | **MERGE_CANDIDATE** | Cutoff cấp business vẫn được đọc; phần fee đã retired. Có thể hợp nhất với BranchBookingPolicy nhưng phải giữ precedence business/branch, không đổi booking ngầm. |
| Voucher / `vouchers` | PROMOTION / VOUCHER | 0 | src/admin/admin.controller.ts:334; src/bookings/bookings.service.ts:1512; schema.prisma:1777 | **KEEP** | Mã ưu đãi và điều kiện phát hành/áp dụng; khác promotion tự động. |
| CustomerVoucher / `customer_vouchers` | PROMOTION / VOUCHER | 0 | src/bookings/vouchers.service.ts:62; src/bookings/vouchers.service.ts:108; schema.prisma:1815 | **REFACTOR** | Quyền sở hữu voucher của khách, có reserve/use; usedBookingId chưa FK. Cần kiểm tra state/expiry riêng với trạng thái voucher định nghĩa. |
| AppointmentChangeRequest / `appointment_change_requests` | BOOKING | 0 | src/bookings/bookings.controller.ts:1197; src/bookings/bookings.controller.ts:1215; schema.prisma:1834 | **KEEP** | Yêu cầu đổi/hủy có đề xuất, duyệt, expiry; khác thay đổi booking trực tiếp. |
| SalonTrustSnapshot / `salon_trust_snapshots` | REVIEW / TRUST | 5 | src/admin/trust-snapshot.service.ts:134; src/admin/trust-snapshot.service.ts:146; schema.prisma:1861 | **KEEP** | Ảnh chụp chỉ số vận hành/trust, không phải sentiment AI. |
| TrustAction / `trust_actions` | REVIEW / TRUST | 0 | src/admin/trust-snapshot.service.ts:207; src/admin/trust-snapshot.service.ts:226; schema.prisma:1877 | **KEEP** | Hành động Trust & Safety và restore link, không đồng nghĩa state business hiện tại. |
| BusinessReviewEvent / `business_review_events` | BUSINESS / BRANCH | 0 | src/business/business-onboarding.service.ts:472; src/business/business-onboarding.service.ts:522; schema.prisma:1900 | **KEEP** | Lịch sử xét duyệt doanh nghiệp; khác bản ghi trạng thái hiện tại. |
| BusinessDocument / `business_documents` | BUSINESS / BRANCH | 0 | src/business/business-onboarding.service.ts:254; src/business/business-onboarding.service.ts:263; schema.prisma:1916 | **KEEP** | Thông tin tài liệu và con trỏ phiên bản; có backend onboarding. |
| BusinessDocumentVersion / `business_document_versions` | BUSINESS / BRANCH | 0 | src/business/business-onboarding.service.ts:272 (nested versions); schema.prisma:1934 | **KEEP** | Nội dung từng lần nộp dùng qua nested versions; không gộp mất lịch sử. |
| BranchDocument / `branch_documents` | BUSINESS / BRANCH | 0 | src/branches/branches.service.ts:1046; src/branches/branches.service.ts:1051; schema.prisma:1952 | **KEEP** | Tài liệu riêng chi nhánh; không gộp với giấy tờ doanh nghiệp. |
| BranchDocumentVersion / `branch_document_versions` | BUSINESS / BRANCH | 0 | src/branches/branches.service.ts:1080 (nested versions); schema.prisma:1970 | **KEEP** | Phiên bản tài liệu chi nhánh được tạo/đọc nested versions. |
| BranchReviewRequest / `branch_review_requests` | BUSINESS / BRANCH | 0 | src/branches/branches.service.ts:1173; src/branches/branches.service.ts:1264; schema.prisma:1988 | **KEEP** | Yêu cầu duyệt với snapshot hồ sơ, tài liệu, phân công và thời hạn. |
| BranchReviewEvent / `branch_review_events` | BUSINESS / BRANCH | 0 | src/branches/branches.service.ts:1187; src/branches/branches.service.ts:1273; schema.prisma:2009 | **KEEP** | Lịch sử thay đổi xét duyệt chi nhánh. |
| DocumentReviewEvent / `document_review_events` | BUSINESS / BRANCH | 0 | src/business/business-onboarding.service.ts:481; src/business/business-onboarding.service.ts:540; schema.prisma:2027 | **KEEP** | Lịch sử xét duyệt tài liệu doanh nghiệp; không chỉ audit tổng quát. |
| ReviewReport / `review_reports` | REVIEW / TRUST | 0 | src/reviews/reviews.service.ts:374; src/reviews/reviews.service.ts:383; schema.prisma:2043 | **KEEP** | Báo cáo review, unique người báo cáo/review. |
| SensitiveConsent / `sensitive_consents` | HEALTH (RETIRED) | 2 | Không direct call; privacy-center.service.ts:78 trả rỗng phần health; kiểm nested graph trước archive; schema.prisma:2057 | **REMOVE_CANDIDATE** | Feature đã bỏ; hiện còn 2 dòng consent. Chỉ đề xuất chuyển archive bảo toàn dữ liệu, không xóa cứng. |
| BookingHealthRecord / `booking_health_records` | HEALTH (RETIRED) | 0 | Không direct call; privacy-center.service.ts:78 trả rỗng phần health; kiểm nested graph trước archive; schema.prisma:2074 | **REMOVE_CANDIDATE** | Không có runtime delegate hoặc API nghiệp vụ sức khỏe, hiện 0 dòng; kiểm tra quan hệ trước archive. |
| HealthRecordAccessLog / `health_record_access_logs` | HEALTH (RETIRED) | 0 | Không direct call; privacy-center.service.ts:78 trả rỗng phần health; kiểm nested graph trước archive; schema.prisma:2096 | **REMOVE_CANDIDATE** | 0 dòng nhưng có trigger cấm UPDATE/DELETE; archive nguyên bảng/trigger, không vô hiệu bảo vệ để dọn. |
| ConsultationFormTemplate / `consultation_form_templates` | HEALTH (RETIRED) | 0 | Không direct call; privacy-center.service.ts:78 trả rỗng phần health; kiểm nested graph trước archive; schema.prisma:2120 | **REMOVE_CANDIDATE** | 0 dòng; domain consultation đã retired. Archive cùng graph, không đụng core booking. |
| ConsultationFormVersion / `consultation_form_versions` | HEALTH (RETIRED) | 0 | Không direct call; privacy-center.service.ts:78 trả rỗng phần health; kiểm nested graph trước archive; schema.prisma:2140 | **REMOVE_CANDIDATE** | 0 dòng; phiên bản form retired, giữ quan hệ nội bộ khi archive. |
| ConsultationFormField / `consultation_form_fields` | HEALTH (RETIRED) | 0 | Không direct call; privacy-center.service.ts:78 trả rỗng phần health; kiểm nested graph trước archive; schema.prisma:2161 | **REMOVE_CANDIDATE** | 0 dòng; field definition consultation retired. |
| ServiceConsultationRequirement / `service_consultation_requirements` | HEALTH (RETIRED) | 0 | Không direct call; privacy-center.service.ts:78 trả rỗng phần health; kiểm nested graph trước archive; schema.prisma:2182 | **REMOVE_CANDIDATE** | 0 dòng; yêu cầu consultation không còn gate booking; bỏ khỏi active schema sau kiểm chứng nested refs. |
| ConsultationSubmission / `consultation_submissions` | HEALTH (RETIRED) | 0 | Không direct call; privacy-center.service.ts:78 trả rỗng phần health; kiểm nested graph trước archive; schema.prisma:2197 | **REMOVE_CANDIDATE** | 0 dòng; có retention/legalHold nên không áp dụng xóa payload tự động trên DB khác. |
| SensitiveAnswer / `sensitive_answers` | HEALTH (RETIRED) | 0 | Không direct call; privacy-center.service.ts:78 trả rỗng phần health; kiểm nested graph trước archive; schema.prisma:2229 | **REMOVE_CANDIDATE** | 0 dòng; cấu trúc mã hóa/phiên bản key phải giữ nguyên nếu archive có dữ liệu. |
| ConsentEvent / `consent_events` | HEALTH (RETIRED) | 0 | Không direct call; privacy-center.service.ts:78 trả rỗng phần health; kiểm nested graph trước archive; schema.prisma:2250 | **REMOVE_CANDIDATE** | 0 dòng; consent append/history của feature retired, không gộp với marketing. |
| SensitiveDataAccessEvent / `sensitive_data_access_events` | HEALTH (RETIRED) | 0 | Không direct call; privacy-center.service.ts:78 trả rỗng phần health; kiểm nested graph trước archive; schema.prisma:2289 | **REMOVE_CANDIDATE** | 0 dòng; lịch sử truy cập consultation retired. |
| SensitiveBreakGlassGrant / `sensitive_break_glass_grants` | HEALTH (RETIRED) | 0 | Không direct call; privacy-center.service.ts:78 trả rỗng phần health; kiểm nested graph trước archive; schema.prisma:2317 | **REMOVE_CANDIDATE** | 0 dòng; quyền truy cập khẩn cấp health đã bỏ, không còn cấp runtime. |
| DataSubjectRequest / `data_subject_requests` | PRIVACY | 0 | src/privacy/privacy-center.service.ts:40; src/privacy/privacy-center.service.ts:102; schema.prisma:2339 | **KEEP** | Yêu cầu dữ liệu cá nhân nói chung; không phải hồ sơ sức khỏe. |
| BranchStateTransition / `branch_state_transitions` | BUSINESS / BRANCH | 0 | src/branches/branch-state.service.ts:120; src/branches/branch-state.service.ts:132; schema.prisma:2366 | **KEEP** | Chuyển trạng thái có actor, lý do, version; phục vụ kiểm tra tác động booking. |
| PriceAdjustment / `price_adjustments` | PROMOTION / VOUCHER | 0 | src/bookings/booking-items.service.ts:280; src/bookings/bookings.service.ts:603; schema.prisma:2387 | **KEEP** | Snapshot mức giảm và allocation ở booking; không thay thế bản định nghĩa promotion/voucher. |
| PromotionRedemption / `promotion_redemptions` | PROMOTION / VOUCHER | 0 | src/bookings/bookings.service.ts:599; src/bookings/bookings.service.ts:1518; schema.prisma:2415 | **KEEP** | Giữ reservation/usage/release/reversal chống vượt quota; không chỉ đếm usedCount. |
| VoucherRedemption / `voucher_redemptions` | PROMOTION / VOUCHER | 0 | src/bookings/bookings.service.ts:595; src/bookings/bookings.service.ts:1507; schema.prisma:2440 | **KEEP** | Lịch sử áp dụng voucher theo booking/khách; hỗ trợ reserve/release. |
| ServiceVariant / `service_variants` | SERVICE | 0 | src/bookings/booking-items.service.ts:42; src/bookings/bookings.controller.ts:342; schema.prisma:2467 | **REFACTOR** | Biến thể giá/thời lượng/buffer có backend. consultationRequired đang bị ép false; eligibilityRules cần phân biệt với sức khỏe đã bỏ. |
| ServicePriceRule / `service_price_rules` | SERVICE | 0 | src/bookings/bookings.controller.ts:357; src/bookings/bookings.service.ts:924; schema.prisma:2495 | **KEEP** | Quy tắc giá động, priority/conditions/version; không gộp giá lịch sử vào đây. |
| ServiceDependency / `service_dependencies` | SERVICE | 0 | src/bookings/bookings.service.ts:820; src/services/services.service.ts:970; schema.prisma:2517 | **KEEP** | Dịch vụ tiên quyết/xung đột có backend kiểm tra; cần giữ quan hệ có kiểu. |
| BookingServiceAdjustment / `booking_service_adjustments` | BOOKING | 0 | src/bookings/booking-items.service.ts:257; src/bookings/booking-items.service.ts:258; schema.prisma:2530 | **KEEP** | Before/after snapshot từng thao tác item và số lần sửa, cần cho audit. |
| OperationalImpactCase / `operational_impact_cases` | OPERATIONS | 0 | src/branches/branch-state.service.ts:49; src/branches/branch-state.service.ts:64; schema.prisma:2551 | **KEEP** | Điều phối booking bị ảnh hưởng khi khóa staff/branch/service, không phải HR. |
| OperationalImpactItem / `operational_impact_items` | OPERATIONS | 0 | src/branches/branch-state.service.ts:82; src/operations/impact.service.ts:35; schema.prisma:2577 | **KEEP** | Phương án giải quyết từng booking, linked với case và replacement. |
| WaitlistEntry / `waitlist_entries` | OPERATIONS | 0 | src/operations/waitlist.controller.ts:70; src/operations/waitlist.service.ts:43; schema.prisma:2604 | **KEEP** | Danh sách chờ/offer có hạn, token hash và booking được nhận; khác recurring. |
| ReviewModerationEvent / `review_moderation_events` | REVIEW / TRUST | 0 | src/reviews/reviews.service.ts:182; src/reviews/reviews.service.ts:389; schema.prisma:2636 | **KEEP** | Lịch sử moderation với actor, lý do và state trước/sau. |
| ReviewAppeal / `review_appeals` | REVIEW / TRUST | 0 | src/reviews/reviews.service.ts:178; src/reviews/reviews.service.ts:528; schema.prisma:2655 | **KEEP** | Khiếu nại review có workflow và thời điểm giải quyết. |
| LoyaltyRule / `loyalty_rules` | LOYALTY / CUSTOMER | 0 | src/loyalty/loyalty.controller.ts:38; src/loyalty/loyalty.service.ts:21; schema.prisma:2675 | **KEEP** | Quy tắc điểm theo business/branch có version; không phải HR thưởng lương. |
| LoyaltyAccount / `loyalty_accounts` | LOYALTY / CUSTOMER | 0 | src/loyalty/loyalty.controller.ts:37; src/loyalty/loyalty.service.ts:37; schema.prisma:2698 | **KEEP** | Số dư điểm theo customer–business và version chống cập nhật mất. |
| LoyaltyTransaction / `loyalty_transactions` | LOYALTY / CUSTOMER | 0 | src/loyalty/loyalty.service.ts:41; src/loyalty/loyalty.service.ts:84; schema.prisma:2715 | **KEEP** | Lịch sử điểm có idempotency/reversal và số dư sau; không gộp với account. |
| Invoice / `invoices` | PAYMENT / FINANCE | 0 | src/finance/finance.controller.ts:93; src/finance/finance.controller.ts:102; schema.prisma:2747 | **KEEP** | Chứng từ của hệ thống có phiên bản/replaces; không khẳng định là hóa đơn điện tử hợp pháp. |
| InvoiceInformationRequest / `invoice_information_requests` | PAYMENT / FINANCE | 0 | src/finance/finance.controller.ts:71; src/finance/finance.service.ts:20; schema.prisma:2788 | **REFACTOR** | Yêu cầu thông tin hóa đơn có openKey/idempotency; resolvedBy chưa FK. |
| InvoiceLine / `invoice_lines` | PAYMENT / FINANCE | 0 | src/finance/finance.service.ts:91; src/finance/finance.service.ts:117; schema.prisma:2817 | **KEEP** | Dòng chứng từ theo booking service, thuế và chiết khấu snapshot. |
| InvoiceEvent / `invoice_events` | PAYMENT / FINANCE | 0 | src/finance/finance.service.ts:110; src/finance/finance.service.ts:232; schema.prisma:2836 | **KEEP** | Lịch sử phát hành/hủy/thay thế chứng từ, khác AuditLog tổng quát. |
| OwnershipTransfer / `ownership_transfers` | OWNERSHIP | 0 | src/ownership/ownership.service.ts:24; src/ownership/ownership.service.ts:27; schema.prisma:2851 | **KEEP** | Chuyển chủ có approval/effectiveAt/snapshot, không dùng sửa thẳng ownerId. |
| OwnershipHistory / `ownership_history` | OWNERSHIP | 0 | src/ownership/ownership.service.ts:165; src/ownership/ownership.service.ts:166; schema.prisma:2886 | **KEEP** | Khoảng hiệu lực chủ sở hữu, giữ trách nhiệm lịch sử. |
| LegalEntityVersion / `legal_entity_versions` | OWNERSHIP | 0 | src/ownership/ownership.service.ts:74; src/ownership/ownership.service.ts:186; schema.prisma:2902 | **KEEP** | Phiên bản pháp nhân, khác tài khoản owner và giấy tờ onboarding. |
| PayoutAccountVersion / `payout_account_versions` | OWNERSHIP | 0 | src/ownership/ownership.service.ts:75; src/ownership/ownership.service.ts:194; schema.prisma:2925 | **NEEDS_REVIEW** | Tài khoản nhận tiền mã hóa còn dùng trong ownership. Bỏ online không tự động đồng nghĩa bỏ thông tin đối soát; chưa drop. |
| CustomerSavedService / `customer_saved_services` | LOYALTY / CUSTOMER | 0 | src/saved-services/saved-services.service.ts:19; src/saved-services/saved-services.service.ts:72; schema.prisma:2951 | **KEEP** | Dịch vụ khách lưu xem sau, unique customer–offering; có API thực. |
| VoucherBranchScope / `voucher_branch_scopes` | PROMOTION / VOUCHER | 0 | src/common/utils/voucher.ts:52; src/promotions/vouchers-admin.service.ts:204; schema.prisma:2965 | **KEEP** | Bảng nối phạm vi chi nhánh; composite PK. |
| VoucherServiceScope / `voucher_service_scopes` | PROMOTION / VOUCHER | 0 | src/common/utils/voucher.ts:53; src/promotions/vouchers-admin.service.ts:205; schema.prisma:2976 | **KEEP** | Bảng nối phạm vi dịch vụ; composite PK. |
| VoucherComboScope / `voucher_combo_scopes` | PROMOTION / VOUCHER | 0 | src/common/utils/voucher.ts:54; src/promotions/vouchers-admin.service.ts:206; schema.prisma:2987 | **KEEP** | Bảng nối phạm vi combo; composite PK. |
| CustomerBusinessSegment / `customer_business_segments` | PROMOTION / VOUCHER | 0 | src/common/utils/voucher.ts:108; src/common/utils/voucher.ts:115; schema.prisma:2998 | **KEEP** | Phân nhóm khách theo tenant phục vụ audience; không phải profile toàn hệ thống. |
| MarketingPreference / `marketing_preferences` | PRIVACY | 0 | src/privacy/privacy-center.service.ts:54; src/privacy/privacy-center.service.ts:157; schema.prisma:3015 | **KEEP** | Tùy chọn tiếp thị của khách, không phải consent sức khỏe. |
| PrivacyExportPackage / `privacy_export_packages` | PRIVACY | 0 | src/privacy/privacy-center.service.ts:242; src/privacy/privacy-center.service.ts:289; schema.prisma:3029 | **KEEP** | Gói xuất dữ liệu mã hóa/one-time download; giữ công cụ bảo vệ dữ liệu dù health retired. |

## 4. Bảng ngoài Prisma / lịch sử không được bỏ quên

| Table | Số dòng | Phân loại | Xử lý đề xuất |
| --- | ---: | --- | --- |
| `_prisma_migrations` | 43 | KEEP | Lịch sử migration; số record có thể khác số migration folder nếu có lần rollback trước. |
| `archive_20260829_attendance_events` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_attendance_exception_requests` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_attendance_qr_tokens` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_attendance_qr_uses` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_branch_attendance_policies` | 11 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_branch_onboarding_progress` | 11 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_compensation_adjustments` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_compensation_assignments` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_compensation_entries` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_compensation_rules` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_pay_run_items` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_pay_runs` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_permissions` | 26 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_platform_settings` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_role_permissions` | 29 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_special_working_days` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_staff_attendances` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_staff_availabilities` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_staff_breaks` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_staff_leaves` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_staff_profiles_on_leave` | 1 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_staff_schedule_change_requests` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_staff_schedule_segments` | 168 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_staff_schedule_versions` | 28 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_staff_working_hours` | 196 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_timesheet_adjustments` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_timesheets` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260829_user_permissions` | 2 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260911_staff_profiles_on_leave` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `archive_20260915_manager_retirement` | 289 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `cash_movements` | 0 | REMOVE_CANDIDATE | Không có model/controller/service active; hiện rỗng. Archive hoặc drop có precondition riêng, không nhầm cash-shift với toàn bộ thu tiền. |
| `cash_shifts` | 0 | REMOVE_CANDIDATE | Không có model/controller/service active; hiện rỗng. Archive hoặc drop có precondition riêng, không nhầm cash-shift với toàn bộ thu tiền. |
| `legacy_role_migration_audit` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `legacy_role_reference_audit` | 0 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |
| `legacy_service_category_migration_audit` | 56 | KEEP | Lưu lịch sử/backup migration, không tham gia ORM. Không xóa theo số dòng; giữ retention và kiểm FK tới active tables. |

48 FK từ bảng archive/legacy tới table active vẫn tồn tại; nhiều FK có ON DELETE CASCADE. Vì vậy archive bằng đổi tên bảng chưa tự bảo đảm giữ lịch sử khi hard-delete parent. Hiện luồng tài khoản chủ yếu soft-delete; trước khi triển khai bất kỳ hard delete phải chốt retention và hành vi archive, không drop FK hàng loạt.

## 5. Model dư, trùng và khác nghĩa

### 5.1 Health / consultation

12 model ứng viên: SensitiveConsent, BookingHealthRecord, HealthRecordAccessLog, ConsultationFormTemplate, ConsultationFormVersion, ConsultationFormField, ServiceConsultationRequirement, ConsultationSubmission, SensitiveAnswer, ConsentEvent, SensitiveDataAccessEvent, SensitiveBreakGlassGrant.

Live DB có 2 SensitiveConsent; 11 model còn lại trong nhóm có 0 dòng. Có trigger ngăn UPDATE/DELETE trên HealthRecordAccessLog. Product đã bỏ feature, PrivacyCenter không thu/hiển thị các hồ sơ này. Đề xuất chuyển nguyên graph sang tên archive và bỏ model khỏi Prisma active, giữ 2 consent cùng khóa/quan hệ/encryption metadata. Đây là đề xuất, chưa thực thi trong bản audit này. Không DROP CASCADE, không reset hay làm rỗng bảng để migration qua.

10 enum chỉ còn dùng trong nhóm này: ConsentScope, ConsultationTemplateStatus, ConsultationFieldType, ConsultationCompletionTiming, ConsultationSubmissionStatus, SensitiveAnswerValueType, ConsentEventAction, ConsentRecipientType, SensitiveAccessResult, SensitiveDataField. Nếu archive, enum PostgreSQL vẫn phải giữ cho cột lịch sử; chỉ bỏ khỏi schema ORM khi không còn active caller.

### 5.2 Các cấu trúc không được gộp cơ học

- StaffProfile = con người cung cấp dịch vụ; StaffBranchAssignment = nơi/thời hạn được phân công; StaffService = năng lực cung cấp offering. Ba ý nghĩa khác nhau, không phải ba bảng trùng nhau.
- CanonicalService = taxonomy chuẩn; BusinessService = định nghĩa dịch vụ của tenant; BranchServiceOffering (SQL services) = triển khai/giá tại chi nhánh.
- Combo/ComboService = nhiều dịch vụ cùng lần booking; TreatmentPackage/Entitlement = quyền sử dụng nhiều buổi.
- Promotion/Voucher = định nghĩa; CustomerVoucher = quyền được cấp; Redemption/PriceAdjustment = reservation/snapshot/usage tại booking.
- Payment/Intent/Transaction/Ledger/Refund/Invoice/Statement khác nhau về chứng cứ, trạng thái và nguồn tiền. Không gộp vì cùng chứa amount.
- NotificationOutbox có retry/dedupe trước giao; Notification là dữ liệu khách đã nhận/đọc.
- Document và Version/Event giữ nội dung từng lần nộp/xét duyệt; không gộp vào JSON hoặc currentVersion rồi xóa bản cũ.

### 5.3 Hai ứng viên hợp nhất

SalonMember hiện 0 dòng, không còn cấp quyền. Hai điểm thông báo Trust/Review đã được đổi từ membership cũ sang UserRole Owner còn hạn/hoạt động trong đợt này; không gửi rộng sang lễ tân ở branch khác. Service compatibility vẫn còn nên chưa xóa model. Cần xác nhận API membership có consumer bên ngoài, sau đó deprecate hoặc chuyển sang query UserRole.

CancellationPolicy hiện 0 dòng nhưng resolveCancellationPolicy/resolveRescheduleCutoffHours vẫn đọc cutoff business; BranchBookingPolicy có 11 dòng cutoff branch. Cần test precedence và chốt một resolver trước khi hợp nhất. Bỏ fee không đồng nghĩa bỏ điều kiện hủy/đổi lịch.

## 6. Chất lượng quan hệ, FK và dữ liệu

### 6.1 FK ứng viên chưa có

| Nhóm field | Parent dự kiến | Kiểm tra hiện tại | Quyết định trước migration |
| --- | --- | --- | --- |
| UserSession.businessId / branchId | Business / Branch | 37 business ID có dữ liệu, 0 orphan; branch 0 | Session scope là snapshot hay reference sống? Không CASCADE mất bằng chứng phiên. |
| StaffInvitation.businessId / branchId / invitedBy / acceptedBy | Business / Branch / User | Hiện 0 dòng | Kiểm expiry/revocation và preserve invite history. |
| BookingService.variantId | ServiceVariant | 0 populated / 0 orphan | Variant phải thuộc cùng service; FK đơn chỉ bảo đảm tồn tại, không bảo đảm tenant. |
| OverbookingOverride.branchId / actorId | Branch / User | Hiện 0 dòng | Bằng chứng override phải giữ sau soft delete. |
| MediaFile.businessId / branchId | Business / Branch | Hiện 0 dòng | entityId là polymorphic; không thêm một FK cố định cho mọi entity. |
| RefundRequest.requestedBy / reviewedBy / processedBy | User | Hiện 0 dòng | Actor hệ thống hay tài khoản? Không ép string hệ thống sang user giả. |
| PaymentIntent.createdBy | User | 4.000 populated / 0 orphan | Chốt system actor và import history trước FK. |
| PaymentTransaction.verifiedBy, FinancialLedgerEntry.actorId | User | 0 populated | Giữ immutable transaction/ledger, không backfill dữ liệu giả. |
| CustomerVoucher.usedBookingId | Booking | 0 populated | Đồng bộ used/reserved/released và lịch sử refund. |
| PackageInstallment.paymentIntentId | PaymentIntent | 0 populated | Tránh hai chiều tham chiếu không thống nhất với Intent.packageInstallmentId. |
| InvoiceInformationRequest.resolvedBy | User | 0 populated | Giữ attribution lịch sử sau khóa/xóa mềm user. |

Các phép kiểm ở bảng trên là read-only. Chưa thêm FK trong Phase 2. Không coi toàn bộ field kết thúc bằng Id là FK: sourceId/entityId có thể đa hình, snapshot hoặc external identifier.

### 6.2 Tenant, cardinality và unique

- UserRole: giữ các unique partial cho tổ hợp scope nullable. @@unique thông thường không tự giải quyết NULL trùng nhau; DB đã có SQL-only indexes, không thêm nhầm duplicate.
- BranchServiceOffering có trigger `services_business_scope_guard` buộc branch và business service cùng tenant.
- StaffService và các FK tài chính riêng lẻ chưa tự chứng minh mọi trường business/branch/customer thuộc cùng aggregate. Service validation/action-specific authorization vẫn là phần bắt buộc.
- CustomerProfile/BusinessOwnerProfile → User đã RESTRICT; xóa user qua workflow phải soft-delete. Test PostgreSQL xác nhận đúng FK chặn hard-delete.
- Tất cả FK đang có trong snapshot catalog đều validated; không có constraint NOT VALID đang bị bỏ dở.
- Không phát hiện cần thêm model chỉ để có Booking/Staff/Review/Promotion: các khái niệm lõi đã có cấu trúc thực. Các vấn đề cần xử lý chủ yếu là invariant/compatibility, không phải thiếu entity tổng quát.

## 7. Index và enum có thể dọn ít rủi ro

### 7.1 Bốn enum không có chỗ dùng

TenantStatus, SubscriptionTier, UserStatus, BookingLifecycleStatus: không field Prisma, không tham chiếu production TypeScript, không cột PostgreSQL active/archive. pg_depend chỉ còn array type phụ thuộc nội bộ. Đề xuất migration forward DROP TYPE mặc định RESTRICT (không CASCADE), xóa declaration Prisma và build lại; phải kiểm tra external SQL/functions trước apply.

### 7.2 Ba index trùng chính xác

| Index thường | Unique index đã bao phủ cùng biểu thức | Đề xuất |
| --- | --- | --- |
| users_email_idx | users_email_key — btree(email) | Bỏ @@index([email]) và index thường, giữ unique. |
| users_phone_idx | users_phone_key — btree(phone) | Bỏ @@index([phone]) và index thường, giữ unique. |
| special_working_days_branch_id_date_idx | special_working_days_branch_id_date_key — btree(branch_id,date) | Bỏ index thường, giữ unique. |

Không drop index theo tần suất quét bằng 0: thống kê có thể vừa reset, DB demo không đại diện tải thật. Ở đây chỉ ba cặp cùng biểu thức đã đối chiếu. Chưa có EXPLAIN/workload benchmark cho các đề xuất index khác.

## 8. Booking concurrency và dữ liệu trạng thái

- Ngày booking (`appointmentDate`) và TIME (`appointmentStartTime`, `appointmentEndTime`) là wall-clock; ghép qua booking-datetime và timezone chi nhánh. Không coi 1970 trong TIME là ngày hẹn.
- BookingService giữ itemStartAt/itemEndAt, staffId nullable cho trường hợp chưa phân công, transition/buffer/giá/tên snapshot. Không thay nullable bằng bắt buộc trước khi xét booking any-staff/pending.
- `bookings.service.ts` tạo trong transaction SERIALIZABLE, revalidate backend và khóa tài nguyên/customer. Availability preview không phải cam kết giữ chỗ.
- DB dùng trigger `booking_services_staff_slot_guard` và `bookings_customer_slot_guard` cùng advisory locks; **không có exclusion constraint trong catalog hiện tại**. Không vẽ hoặc mô tả rằng hệ thống dùng exclusion constraint.
- `src/common/utils/serializable-transaction.ts` xử lý retry/conflict; `src/common/filters/prisma-exception.filter.ts` ánh xạ lỗi. Integration trên database sao chép đã kiểm 5/10 yêu cầu cùng staff-slot và race create/reschedule.
- Giờ mở cửa, holiday, special day, membership hiệu lực, StaffService và hold expiry vẫn được kiểm tra. Bỏ HR không được bỏ các invariant này.
- Snapshot hiện có Booking: PENDING 732, CONFIRMED 1.084, COMPLETED 1.436, CANCELLED 379, NO_SHOW 369. Trạng thái khác không có dữ liệu hiện tại không có nghĩa dead; phải kiểm controller/service transition.
- Review được tạo sau booking và có ReviewServiceRating cho từng dịch vụ; kiểm cùng booking/khách/staff. Chưa xác nhận sentiment pipeline.
- Promotion/Voucher giữ reservation/release/reversal qua Redemption và PriceAdjustment; không bỏ các bảng này để chỉ dùng usedQuantity.

## 9. JSON, nullable, naming và field legacy

- JSON snapshot (PricingSnapshot.items, invoice buyer/seller, ownership impact, ruleSnapshot) có ý nghĩa lịch sử; không ép chuẩn hóa làm mất bằng chứng giá/điều kiện đã chốt.
- JSON quản trị sống (Business.onboardingData/legalDocuments, Branch.serviceAreas, RecurringBookingPlan.serviceIds, ServicePriceRule.conditions, eligibilityRules) cần shape/version/validation; source không bảo đảm JSON tự có FK.
- Branch.managerName là chuỗi liên hệ, không cấp vai trò Manager. Staff.employeeCode/hiredAt/emergencyContact là metadata; hiredAt và emergencyContact còn caller thực, không xóa chỉ vì liên quan nhân sự.
- Booking.sensitiveDataConsent, cancellationFeeAmount, ServiceVariant.consultationRequired, policy fee fields là compatibility legacy. Booking writes đặt fee null, variant writes ép consultationRequired=false, report fee=0. Nếu bỏ cột phải archive before-image và bỏ seed/test/DTO references trước.
- Nhiều event/status có String thay enum (TrustAction before/after, BranchStateTransition, Legal/Payout verification). Cần chốt state machine và dữ liệu cũ trước khi siết enum, không tự tạo tập trạng thái.
- Các quan hệ `refs_*` / `Audit_*` là tên kỹ thuật do migration audit, không phải domain mới. Naming có thể cải thiện trong code-only refactor sau khi chốt API, không đổi table vật lý để làm đẹp.
- createdAt/updatedAt phù hợp entity thay đổi; event append-only dùng createdAt/occurredAt. Không thêm updatedAt cho mọi event chỉ vì thiếu.

## 10. Permission và code ngoài catalog

DB sau migration Manager có 137 permission definitions: 113 trong runtime catalog và 24 ngoài catalog. 24 code này có 0 role-permission mappings, nhưng 8 UserPermission rows còn tham chiếu. `can()` fail closed khi code không nằm trong PERMISSION_CODE_SET. Không được ghi sai rằng DB chỉ có 113 dòng.

Các nhóm ngoài catalog: health_record:* (8), payment_intent:create:* (3), booking:create/update:platform (2), branch:create:platform (1), change_request:approve:platform (1), promotion:manage:branch (1), service:create/delete/update theo scope cũ (7), voucher:grant:branch (1). Đề xuất archive nguyên definitions/grants rồi xóa active references trong migration riêng; không chuyển thành quyền hợp lệ tương đương để tránh tăng quyền.

## 11. Kế hoạch thay đổi có kiểm soát

1. Hoàn tất kiểm thử thông báo Owner và kiểm chứng UI role sau migration Manager.
2. Dọn bốn enum không dùng và ba index trùng bằng migration forward, không thay số model hoặc xóa row. Rehearse rồi mới apply.
3. Với 12 health models và cash_shifts/cash_movements ngoài Prisma: lập migration archive (rename nguyên bảng, giữ PK/FK/trigger/type và rows), đồng thời bỏ ORM models/relations/enums chỉ dùng trong retired domain. Không DROP dữ liệu. Kiểm dependency/bộ seed và generator trước commit/apply.
4. Dọn 24 permission ngoài catalog sau khi lưu before-images của 8 direct grants. Không gộp role hoặc cấp thêm capability.
5. Không tự merge SalonMember/CancellationPolicy, bỏ GUEST hay PayoutAccountVersion, đổi timezone/status/booking concurrency hoặc thêm toàn bộ FK ứng viên khi chưa rõ compatibility. Giữ NEEDS_REVIEW và ghi lý do trong schema chốt nếu chưa đủ bằng chứng.
6. Chạy Prisma validate/generate, build/unit/integration, FE tests/build, diff check và browser E2E. Back up rồi restore trên database riêng; không reset/seed dữ liệu chính.
7. Chỉ sau schema/role chốt mới tạo evidence table và draw.io/SVG. Sơ đồ phải phản ánh đúng state cuối, không đưa các ứng viên chưa triển khai thành kết quả đã hoàn tất.

## 12. Kết quả và phần chưa làm

- Manager migration đã apply trên local: 1 Manager → Receptionist, 9 phiên SALON revoked; counts và fingerprint history giữ nguyên.
- Backend đã đạt 651 unit tests, 111 PostgreSQL integration tests (chạy riêng trên restored copy), build/schema PASS tại checkpoint trước sửa 2 điểm notification mới. Nhóm notification/trust/review mới: 9/9 PASS; cần chạy lại full suite sau mọi thay đổi.
- Frontend checkpoint: 44 tests và build PASS. Chưa có xác minh browser E2E hoàn chỉnh sau deploy.
- Lint toàn repo chưa sạch; không dùng build/test pass để tuyên bố không còn lỗi. Không tự chạy lint --fix toàn bộ.
- Phân loại đủ 131/131 model đã hoàn thành; thay đổi Phase 2 ở mục 11 chưa thực thi trong bản audit này.
- Chưa vẽ/verify/export sơ đồ cuối cùng. Không coi các file PlantUML cũ là deliverable draw.io của đợt này.

## 13. Nguồn tái tạo

- `beauty-booking-api-main/prisma/schema.prisma`.
- `beauty-booking-api-main/scripts/build-schema-inventory.mjs` (full mechanical schema inventory).
- `beauty-booking-api-main/scripts/audit-schema-usage.mjs` (read-only direct/nested evidence và PostgreSQL catalog/counts).
- `docs/schema-audit-decisions.json` (131 quyết định có lý do; candidate không phải lệnh xóa).
- `docs/DATABASE_SCHEMA_INVENTORY.md` (model/field/PK/FK/index/enum appendix).
- `tmp/manager-refactor/usage-evidence.json`, `database-evidence.json` (local snapshot, gitignored).
- `beauty-booking-api-main/scripts/audit-integrity-preflight.sql` và các integration spec trong `src/prisma/`, `src/bookings/`.
- `docs/MANAGER_ROLE_REFACTOR_STATUS.md` và migration `20260915_remove_manager_role`.
