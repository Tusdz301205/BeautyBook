# BeautyBook — loại bỏ Manager: trạng thái triển khai

Ngày cập nhật: 15/09/2026. Đây là tài liệu của đợt refactor đang thực hiện, không phải biên bản hoàn thành toàn bộ yêu cầu.

## Phạm vi và điểm dừng dữ liệu

- Quyết định sản phẩm: bỏ Manager; giữ Customer, Staff, Receptionist, Business Owner và Platform Admin. Không đưa HR/phân ca/chấm công/tính lương trở lại.
- Mã nguồn đang chuyển sang mô hình trên. Bỏ vai trò không có nghĩa bỏ kiểm soát chi nhánh.
- **Đã apply migration `20260915_remove_manager_role` trên database local ngày 15/09/2026**, sau hai lần backup/restore rehearsal. Không seed/reset. Một Manager đã chuyển sang Receptionist theo phê duyệt; 9 phiên SALON cũ được thu hồi.
- Chuỗi migration pending được chạy đúng thứ tự: `20260906_retire_cancellation_fees`, `20260909_audit_integrity`, `20260911_normalize_legacy_staff_status`, `20260915_remove_manager_role`. Preflight 95/95 không có vi phạm; không có policy phí khác 0 hay Staff ON_LEAVE cần sửa tại thời điểm deploy.
- Kiểm tra sau deploy: 1.038 users, 29 StaffProfile, 30 StaffBranchAssignment, 4.000 Booking, 4.000 BookingService không đổi. Fingerprint toàn bộ JSON hồ sơ/phân công/booking/service liên quan Manager khớp trước–sau; UserRole giữ nguyên ID/scope/expiry/attribution, chỉ đổi role_id. Tài khoản cần đăng nhập lại.
- Phase 2 chưa chốt phân loại/điều chỉnh schema. Phase 3–4 chưa bắt đầu; chưa có sơ đồ cuối cùng hay SVG được xác minh.

## Kiểm kê database thực tế (chỉ đọc)

Nguồn: `beauty-booking-api-main/scripts/audit-manager-data.sql`; chạy trong transaction READ ONLY, kết thúc ROLLBACK trên PostgreSQL local `glowbook_db`.

| Hạng mục | Kết quả |
|---|---|
| UserRole BRANCH_MANAGER | 1 assignment / 1 người dùng, còn hạn và tài khoản hoạt động |
| Scope Manager | Có business và branch; không thiếu, không lệch business/branch |
| Chồng lấp vai trò hiện hữu của Manager | Không tìm thấy vai trò khác để dùng làm mapping chắc chắn |
| SalonMember MANAGER | 0 |
| StaffInvitation BRANCH_MANAGER | 0 |
| Hồ sơ nhân sự liên quan | 1 ACTIVE; isBookable=false; publicVisible=true |
| BookingService liên quan | 77 dòng; 33 dòng thuộc các trạng thái lịch chưa kết thúc |
| Phiên SALON của tài khoản liên quan | 9 phiên chưa thu hồi/chưa hết hạn ở thời điểm kiểm kê |
| GUEST assignments | 0 (vẫn có role definition) |

**Quyết định đã được người dùng xác nhận ngày 15/09/2026:** “Chuyển sang Lễ tân”. Mapping được duyệt: BRANCH_MANAGER → RECEPTIONIST, giữ nguyên business/branch, tài khoản và lịch sử. Không nâng thành Owner. Receptionist không phải tập con tuyệt đối của Manager vì có một số quyền thu tiền/gói dịch vụ riêng; người dùng đã chọn mapping này sau khi được hỏi trực tiếp. Không tự đổi bookability, xóa StaffProfile hoặc phân công lại 33 dòng dịch vụ đang mở. Phê duyệt mapping không phải phê duyệt xóa model/dữ liệu khác ở Phase 2.

Migration đã lưu before-image trong `archive_20260915_manager_retirement`, kiểm tra trùng/thiếu scope, bảo toàn dữ liệu liên quan và đồng bộ catalog. Không sao chép mọi quyền Manager thành quyền trực tiếp. Dump/manifest được giữ trong `docs/db-backups/` (gitignored, có dữ liệu nhạy cảm, không đưa lên GitHub).

Sau chuyển đổi: Owner 5, Customer 1.000, Platform Admin 5, Receptionist 2, Staff 26, Guest 0 assignments; không còn role definition/assignment Manager hoạt động.

## Capability → vai trò thay thế → nguồn code

Các đường dẫn bên dưới tính từ `beauty-booking-api-main/`.

| Capability | Trước refactor | Vai trò nhận/giữ | Thay đổi và evidence |
|---|---|---|---|
| Đăng nhập không gian doanh nghiệp | Owner/Manager/Receptionist/Staff | Owner/Receptionist/Staff | `src/auth/auth-workspace.ts`; lọc grant còn hạn và scope chi nhánh |
| Tạo/cập nhật/đăng ký chi nhánh | Owner và một số đường Manager | Owner | `src/branches/branches.controller.ts`, `branches.service.ts`; bỏ tự cấp Manager cho người tạo |
| Nhân sự, lời mời, năng lực dịch vụ | Owner/Manager | Owner | `src/staff/staff.controller.ts`, `staff-invitations.service.ts`, `dto/staff-invitation.dto.ts` |
| Quản trị danh mục/giá/trạng thái dịch vụ | Owner/Manager theo permission | Owner | `src/services/services.controller.ts`; giữ quyền tenant |
| Booking tại quầy, walk-in, xác nhận, check-in | Owner/Manager/Receptionist | Owner/Receptionist | `src/bookings/bookings.controller.ts`, `bookings-access.service.ts` |
| Đổi/hủy lịch, phân công và change request | Manager/Owner hoặc kiểm tra rộng booking:update | Receptionist theo branch; Owner theo tenant | Permission catalog và kiểm tra hành động trên tài nguyên thực |
| Bắt đầu/hoàn thành dịch vụ | Staff hoặc Manager/Owner | Staff được giao; Owner | `src/bookings/bookings.validation.ts`, `booking-items.service.ts`; bỏ alias Owner→Manager |
| Báo cáo, phản hồi/khiếu nại review | Owner/Manager | Owner; Platform quản trị nền tảng | `src/reports/reports.controller.ts`, `src/reviews/` |
| Campaign/voucher | Thực tế controller chủ yếu Owner/Platform | Giữ nguyên | `src/promotions/`; bỏ các nhánh lọc Manager cũ, không cấp cho Receptionist |
| Trường hợp ảnh hưởng vận hành cấp doanh nghiệp | Owner/Manager/Platform | Owner/Platform | `src/operations/impact.controller.ts`; không trao quản trị tác động toàn doanh nghiệp cho lễ tân |
| Scope và thông báo | Có fallback/merge SalonMember | UserRole hiện hành, đúng business/branch | `src/common/utils/multi-tenancy.ts`, `notify.ts` |

## Permission catalog

Nguồn chuẩn: `src/common/permissions/permission-catalog.ts`.

- Loại mapping `BRANCH_MANAGER` và level tương ứng khỏi runtime catalog.
- Receptionist nhận `booking:assign:branch`, `booking:cancel:branch`, `booking:reschedule:branch`, `change_request:approve:branch`.
- Bỏ các permission quản trị branch chỉ còn phục vụ Manager: `branch:update:branch`, `branch_service_offering:status:branch`, `staff_service:assign:branch`, `user:role_assign:branch`, `review:report:branch`, `review:moderate:branch`, `report:overview:branch`, `audit:read:branch`.
- Owner giữ các permission tương đương cấp tenant. `report:revenue:branch` vẫn có người dùng hợp lệ là Owner nên không xóa theo tên.
- Đã đồng bộ bằng migration: 113 permission definitions, 138 role-permission mappings; Owner 49, Receptionist 19, Staff 8, Customer 22, Platform Admin 35, Guest 5. Bảo lưu before-image các quyền cũ; không dùng seed.

## Schema và enum: thay đổi đã triển khai

Kiểm kê cơ học `prisma/schema.prisma`: **131 models, 101 enums, 2.074 fields, 644 relation fields, 229 index declarations, 96 unique constraints, 131 primary keys**. Relation field không đồng nghĩa 644 FK; bao gồm cả phía nghịch đảo và danh sách.

Inventory đầy đủ được sinh bằng `scripts/build-schema-inventory.mjs`, lưu tạm trong `tmp/manager-refactor/schema-inventory.json` và `.md`. Chưa gán KEEP/REMOVE/MERGE cho toàn bộ model khi Phase 1 chưa hoàn tất.

Hai enum đã chuyển đổi sau khi chốt mapping:

- `RoleCode`: loại BRANCH_MANAGER khỏi type hoạt động dùng bởi `roles.code`, `staff_invitations.role_code`; hai cột HR archive giữ type `RoleCode_archive_20260915` để không sửa lịch sử.
- `SalonMemberRole`: loại MANAGER; type hoạt động còn OWNER/RECEPTIONIST. Không có membership Manager cần chuyển.

Không dùng `DROP TYPE ... CASCADE`, không sửa migration đã apply. Migration mới đổi type sau precondition checks và giữ type lịch sử nếu còn phụ thuộc.

Function `public.validate_user_role_scope()` đã cập nhật chỉ giữ vai trò chi nhánh Receptionist/Staff; vẫn chặn thiếu branch/business và branch không thuộc business. Integration test xác minh cả ba trường hợp.

Hiện tại không thêm/xóa/merge model nào. `Branch.managerName` là chuỗi liên hệ, không phải FK hay quyền; không xóa dữ liệu vì trùng từ khóa. `VoucherScope.COMPENSATION` là bồi hoàn cho khách, không phải payroll. Các bảng HR đã được archive trong migration lịch sử; không tự drop archive.

## Kiểm thử và các mốc còn lại

- Backend build và Prisma validate: PASS sau regenerate client với enum mới.
- Backend unit: 87 suites / 651 tests PASS; 111 integration tests được skip trong lượt unit và chạy riêng trên database sao chép.
- PostgreSQL integration: 3 suites / 111 tests PASS trên bản restore, bao gồm booking concurrency, FK/check constraints và Manager migration. Một test được sửa để nhận mã RESTRICT 23001 hoặc FK 23503 nhưng bắt buộc đúng constraint `customer_profiles_user_id_fkey`; không nới ràng buộc DB.
- Frontend: 44 tests PASS, build PASS. Chưa chạy browser E2E của toàn bộ vai trò sau deploy.
- Lint các test mới/sửa trọng tâm PASS. Lint toàn BE chưa sạch: snapshot có 1.330 errors / 160 warnings; không kết luận là lỗi có sẵn khi chưa so sánh baseline, không chạy lint --fix toàn repo.
- OpenAPI đã sinh từ controller: 231 paths, không còn metadata cho quyền Manager.
- Bổ sung kiểm tra tài khoản đa vai trò: quyền Owner phải đi cùng scope Owner, không mượn scope Staff/Receptionist của business khác. Áp dụng cho quản trị dịch vụ/nhân sự/khuyến mãi/voucher/review/media/onboarding/finance/ownership.
- Frontend Operations lọc đúng branch được phép, hủy phản hồi tải cũ khi đổi scope, chỉ gọi API theo capability; đã bỏ các nút/endpoint cash-shift không có backend thực.
- Phase 1 đã chuyển đổi code/schema/dữ liệu; còn kiểm chứng UI trực tiếp và rà reference cuối. Phase 2 đang phân loại, Phase 3–4 chưa bắt đầu.

## Phân loại reference còn lại

- Production positive Manager authorization: phải bằng 0 trước kết thúc Phase 1.
- Schema enum/DB hoạt động: đã loại Manager. Enum/archive lịch sử được giữ có chủ đích, không tham gia authorization.
- Historical migrations và tài liệu audit/report cũ: giữ nguyên bằng chứng lịch sử; không dùng làm role matrix hiện tại.
- Negative tests và script kiểm kê/migration: được phép nhắc Manager để chứng minh từ chối/kiểm soát dữ liệu cũ.
- `Branch.managerName` và regex nghề nghiệp không nhận booking: dữ liệu liên hệ/phân loại mô tả công việc, không cấp quyền.

Các vấn đề schema khác (archive dependency, cardinality/constraints, legacy health/payment compatibility, từng model chưa dùng) sẽ được phân loại riêng ở Phase 2; chưa tự xóa trong đợt sửa vai trò.
