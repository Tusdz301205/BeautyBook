-- User-approved mapping (2026-09-15): the existing scoped Manager becomes
-- Receptionist. Preserve UserRole identity/scope/expiry/grant attribution and all
-- users, StaffProfile, StaffBranchAssignment and Booking/BookingService data.
-- This is not a seed. Read docs/MANAGER_ROLE_REFACTOR_STATUS.md before deploy.
-- Rehearse the full pending chain on an isolated restored database first.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
LOCK TABLE roles, user_roles, user_sessions, role_permissions, permissions,
  user_permissions, salon_members, staff_invitations IN SHARE ROW EXCLUSIVE MODE;

DO $preconditions$
BEGIN
  IF (SELECT count(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id
      WHERE r.code::text='BRANCH_MANAGER') > 1 THEN
    RAISE EXCEPTION 'Manager retirement requires review: more than one existing assignment';
  END IF;
  IF EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id
    LEFT JOIN branches br ON br.id=ur.branch_id
    LEFT JOIN businesses b ON b.id=ur.business_id
    WHERE r.code::text='BRANCH_MANAGER'
      AND (ur.business_id IS NULL OR ur.branch_id IS NULL OR b.id IS NULL
        OR br.id IS NULL OR br.business_id IS DISTINCT FROM ur.business_id)
  ) THEN
    RAISE EXCEPTION 'Manager retirement requires valid business/branch scopes';
  END IF;
  IF EXISTS (
    SELECT 1 FROM user_roles old_grant JOIN roles old_role ON old_role.id=old_grant.role_id
    JOIN user_roles target ON target.user_id=old_grant.user_id
      AND target.business_id IS NOT DISTINCT FROM old_grant.business_id
      AND target.branch_id IS NOT DISTINCT FROM old_grant.branch_id
    JOIN roles target_role ON target_role.id=target.role_id
    WHERE old_role.code::text='BRANCH_MANAGER' AND target_role.code::text='RECEPTIONIST'
  ) THEN
    RAISE EXCEPTION 'Manager retirement requires review of duplicate receptionist scope';
  END IF;
  IF EXISTS (SELECT 1 FROM salon_members WHERE role::text='MANAGER')
     OR EXISTS (SELECT 1 FROM staff_invitations WHERE role_code::text='BRANCH_MANAGER') THEN
    RAISE EXCEPTION 'Manager membership/invitation appeared after approval: review before conversion';
  END IF;
END
$preconditions$;

-- Kept outside the active Prisma model set, like the existing HR archives.
-- Before-images are local database records, never exported to tracked files.
CREATE TABLE archive_20260915_manager_retirement (
  entity_table text NOT NULL,
  entity_key text NOT NULL,
  snapshot jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_table, entity_key)
);
REVOKE ALL ON archive_20260915_manager_retirement FROM PUBLIC;

CREATE TEMP TABLE _manager_grants ON COMMIT DROP AS
SELECT ur.* FROM user_roles ur JOIN roles r ON r.id=ur.role_id
WHERE r.code::text='BRANCH_MANAGER';
INSERT INTO archive_20260915_manager_retirement(entity_table,entity_key,snapshot)
SELECT 'user_roles', id, to_jsonb(g) FROM _manager_grants g;
INSERT INTO archive_20260915_manager_retirement(entity_table,entity_key,snapshot)
SELECT 'roles', id, to_jsonb(r) FROM roles r;
INSERT INTO archive_20260915_manager_retirement(entity_table,entity_key,snapshot)
SELECT 'role_permissions', role_id || ':' || permission_id, to_jsonb(rp) FROM role_permissions rp;
INSERT INTO archive_20260915_manager_retirement(entity_table,entity_key,snapshot)
SELECT 'permissions', id, to_jsonb(p) FROM permissions p;
-- Never restore an old session as part of a rollback. Only metadata is archived.
INSERT INTO archive_20260915_manager_retirement(entity_table,entity_key,snapshot)
SELECT 'user_sessions', s.id, jsonb_build_object('id',s.id,'user_id',s.user_id,
  'workspace',s.workspace,'revoked_at',s.revoked_at,'expires_at',s.expires_at)
FROM user_sessions s
WHERE s.user_id IN (SELECT user_id FROM _manager_grants)
  AND s.workspace::text='SALON' AND s.revoked_at IS NULL;

CREATE TEMP TABLE _retired_permissions(code text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _retired_permissions VALUES
  ('branch:update:branch'),
  ('branch_service_offering:status:branch'),
  ('staff_service:assign:branch'),
  ('user:role_assign:branch'),
  ('review:report:branch'),
  ('review:moderate:branch'),
  ('report:overview:branch'),
  ('audit:read:branch');
INSERT INTO archive_20260915_manager_retirement(entity_table,entity_key,snapshot)
SELECT 'user_permissions', up.id, to_jsonb(up) FROM user_permissions up
JOIN permissions p ON p.id=up.permission_id JOIN _retired_permissions retired ON retired.code=p.code;

-- The static catalog below is verified against permission-catalog.ts by tests.
CREATE TEMP TABLE _target_roles(code text PRIMARY KEY,name text,level text) ON COMMIT DROP;
INSERT INTO _target_roles VALUES
  ('PLATFORM_ADMIN','Quản trị nền tảng','PLATFORM'),
  ('BUSINESS_OWNER','Chủ doanh nghiệp','TENANT'),
  ('RECEPTIONIST','Lễ tân','BRANCH'),
  ('STAFF','Nhân viên','BRANCH'),
  ('CUSTOMER','Khách hàng','CUSTOMER'),
  ('GUEST','Khách vãng lai','CUSTOMER');
INSERT INTO roles(id,code,name,level)
SELECT gen_random_uuid()::text,t.code::"RoleCode",t.name,t.level::"RoleLevel"
FROM _target_roles t
ON CONFLICT(code) DO UPDATE SET level=EXCLUDED.level;

UPDATE user_roles ur SET role_id=destination.id
FROM _manager_grants old_grant, roles destination
WHERE ur.id=old_grant.id AND destination.code::text='RECEPTIONIST';
UPDATE user_sessions SET revoked_at=CURRENT_TIMESTAMP, refresh_token_hash=NULL
WHERE user_id IN (SELECT user_id FROM _manager_grants)
  AND workspace::text='SALON' AND revoked_at IS NULL;

-- Explicitly remove only retired authorization rows after their before-images.
DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE code::text='BRANCH_MANAGER');
DELETE FROM roles WHERE code::text='BRANCH_MANAGER';
DELETE FROM user_permissions WHERE permission_id IN (
  SELECT p.id FROM permissions p JOIN _retired_permissions r ON r.code=p.code
);
DELETE FROM role_permissions WHERE permission_id IN (
  SELECT p.id FROM permissions p JOIN _retired_permissions r ON r.code=p.code
);
DELETE FROM permissions WHERE code IN (SELECT code FROM _retired_permissions);

CREATE TEMP TABLE _target_permissions(
  code text PRIMARY KEY,resource text,action text,scope text,description text
) ON COMMIT DROP;
INSERT INTO _target_permissions VALUES
  ('booking:create:self','booking','create','SELF','Customer tạo lịch cho chính mình'),
  ('booking:create:branch','booking','create','BRANCH','Receptionist tạo lịch hộ khách trong chi nhánh'),
  ('booking:create:tenant','booking','create','TENANT','Owner tạo lịch thuộc bất kỳ chi nhánh nào trong tenant'),
  ('booking:read:self','booking','read','SELF','Customer xem lịch của chính mình'),
  ('booking:read:branch','booking','read','BRANCH','Staff/Receptionist xem lịch thuộc chi nhánh'),
  ('booking:read:tenant','booking','read','TENANT','Owner xem tất cả lịch trong tenant'),
  ('booking:read:platform','booking','read','PLATFORM','Platform xem tất cả lịch toàn hệ thống'),
  ('booking:update:self','booking','update','SELF','Customer cập nhật lịch của mình (giờ, ghi chú)'),
  ('booking:update:branch','booking','update','BRANCH','Staff/Receptionist cập nhật lịch trong chi nhánh'),
  ('booking:update:tenant','booking','update','TENANT','Owner cập nhật lịch trong tenant'),
  ('booking:assign:branch','booking','assign','BRANCH','Receptionist gán staff cho booking trong chi nhánh'),
  ('booking:assign:tenant','booking','assign','TENANT','Owner gán staff cho booking trong tenant'),
  ('booking:cancel:self','booking','cancel','SELF','Customer huỷ lịch của chính mình'),
  ('booking:cancel:branch','booking','cancel','BRANCH','Salon huỷ lịch trong chi nhánh'),
  ('booking:cancel:tenant','booking','cancel','TENANT','Owner huỷ lịch trong tenant'),
  ('booking:cancel:platform','booking','cancel','PLATFORM','Platform ép huỷ (ghi log FORCE_CANCEL)'),
  ('booking:check_in:branch','booking','check_in','BRANCH','Receptionist check-in khách'),
  ('booking:check_in:tenant','booking','check_in','TENANT','Owner check-in khách trong tenant'),
  ('booking:complete:branch','booking','complete','BRANCH','Staff đánh dấu hoàn thành dịch vụ'),
  ('booking:reschedule:self','booking','reschedule','SELF','Customer yêu cầu đổi lịch'),
  ('booking:reschedule:branch','booking','reschedule','BRANCH','Salon xử lý yêu cầu đổi lịch trong chi nhánh'),
  ('booking:read_internal_note:branch','booking','read_internal_note','BRANCH','Salon đọc ghi chú nội bộ của booking'),
  ('business:create:self','business','create','SELF','Owner tạo hồ sơ onboarding doanh nghiệp'),
  ('business:update:tenant','business','update','TENANT','Owner cập nhật hồ sơ doanh nghiệp trong tenant'),
  ('business:review:platform','business','review','PLATFORM','Platform Admin duyệt hoặc yêu cầu bổ sung hồ sơ doanh nghiệp'),
  ('branch:read:public','branch','read','PUBLIC','Guest xem thông tin chi nhánh công khai'),
  ('branch:read:platform','branch','read','PLATFORM','Platform xem tất cả chi nhánh, bao gồm hàng đợi tuân thủ'),
  ('branch:read:tenant','branch','read','TENANT','Salon xem tất cả chi nhánh thuộc tenant'),
  ('branch:read:branch','branch','read','BRANCH','Nhân sự chi nhánh xem chi nhánh được phân công'),
  ('branch:create:tenant','branch','create','TENANT','Owner tạo chi nhánh mới trong tenant của mình'),
  ('branch:update:tenant','branch','update','TENANT','Owner cập nhật thông tin chi nhánh'),
  ('branch:status:platform','branch','status','PLATFORM','Platform duyệt/từ chối chi nhánh'),
  ('service:read:public','service','read','PUBLIC','Khách xem dịch vụ'),
  ('service:read:platform','service','read','PLATFORM','Platform đọc catalog và offering để quản trị/điều tra'),
  ('canonical_service:read:public','canonical_service','read','PUBLIC','Đọc taxonomy dịch vụ đang hoạt động để tìm kiếm'),
  ('canonical_service:manage:platform','canonical_service','manage','PLATFORM','Platform quản lý taxonomy chuẩn, deprecate và merge'),
  ('service_category:manage:tenant','service_category','manage','TENANT','Owner tổ chức menu dịch vụ riêng của doanh nghiệp'),
  ('business_service:create:tenant','business_service','create','TENANT','Owner tạo dịch vụ cấp doanh nghiệp'),
  ('business_service:update:tenant','business_service','update','TENANT','Owner sửa tên, mapping, giá và thời lượng mặc định'),
  ('business_service:archive:tenant','business_service','archive','TENANT','Owner lưu trữ dịch vụ cấp doanh nghiệp sau khi xử lý booking tương lai'),
  ('branch_service_offering:status:tenant','branch_service_offering','status','TENANT','Owner bật, tắt và đặt bookable cho offering trong doanh nghiệp'),
  ('branch_service_offering:pricing:tenant','branch_service_offering','pricing','TENANT','Chỉ Owner sửa giá/thời lượng offering tại chi nhánh'),
  ('staff_service:assign:tenant','staff_service','assign','TENANT','Owner phân công năng lực dịch vụ cho nhân sự trong doanh nghiệp'),
  ('combo:read:public','combo','read','PUBLIC','Khách xem combo đang bán công khai'),
  ('combo:read:platform','combo','read','PLATFORM','Platform đọc combo phục vụ quản trị và điều tra'),
  ('combo:manage:tenant','combo','manage','TENANT','Owner quản lý combo thương mại của doanh nghiệp'),
  ('user:read:self','user','read','SELF','User xem profile của chính mình'),
  ('user:update:self','user','update','SELF','User cập nhật profile của chính mình'),
  ('user:read:tenant','user','read','TENANT','Owner xem nhân viên thuộc tenant'),
  ('user:read:branch','user','read','BRANCH','Receptionist xem nhân viên thuộc chi nhánh'),
  ('user:read:platform','user','read','PLATFORM','Admin xem tất cả user'),
  ('user:role_assign:tenant','user','role_assign','TENANT','Owner gán role cho nhân viên thuộc tenant'),
  ('user:role_assign:platform','user','role_assign','PLATFORM','Admin gán role cho user'),
  ('user:suspend:platform','user','suspend','PLATFORM','Admin khoá tài khoản'),
  ('promotion:manage:platform','promotion','manage','PLATFORM','Platform Admin quản lý campaign do nền tảng sở hữu'),
  ('promotion:manage:tenant','promotion','manage','TENANT','Owner quản lý campaign trong tenant'),
  ('voucher:manage:platform','voucher','manage','PLATFORM','Platform Admin quản lý voucher do nền tảng sở hữu'),
  ('voucher:manage:tenant','voucher','manage','TENANT','Owner quản lý voucher tenant'),
  ('voucher:read:self','voucher','read','SELF','Customer xem voucher đã được cấp cho chính mình'),
  ('review:create:self','review','create','SELF','Customer đánh giá booking của mình'),
  ('review:read:public','review','read','PUBLIC','Xem review công khai'),
  ('review:report:tenant','review','report','TENANT','Owner báo cáo review thuộc doanh nghiệp để Platform kiểm duyệt'),
  ('review:moderate:tenant','review','moderate','TENANT','Owner duyệt/ẩn review thuộc tenant'),
  ('review:moderate:platform','review','moderate','PLATFORM','Admin duyệt/ẩn review toàn hệ thống'),
  ('payment:create:branch','payment','create','BRANCH','Receptionist thu tiền tại chi nhánh'),
  ('payment:create:tenant','payment','create','TENANT','Chủ doanh nghiệp ghi nhận thanh toán trong doanh nghiệp'),
  ('payment:read:self','payment','read','SELF','Customer xem thanh toán của mình'),
  ('payment:read:branch','payment','read','BRANCH','Salon xem thanh toán thuộc chi nhánh'),
  ('payment:read:tenant','payment','read','TENANT','Owner xem thanh toán thuộc tenant'),
  ('payment:read:platform','payment','read','PLATFORM','Platform Admin xem thanh toán phục vụ governance'),
  ('payment:refund:tenant','payment','refund','TENANT','Owner hoàn tiền trong tenant'),
  ('payment:refund:platform','payment','refund','PLATFORM','Platform Admin hoàn tiền ngoại lệ có audit'),
  ('refund:create:tenant','refund','create','TENANT','Owner tạo yêu cầu refund trong tenant'),
  ('refund:create:platform','refund','create','PLATFORM','Platform Admin tạo yêu cầu refund ngoại lệ'),
  ('refund:approve:tenant','refund','approve','TENANT','Owner duyệt refund trong tenant'),
  ('refund:approve:platform','refund','approve','PLATFORM','Platform Admin duyệt refund toàn hệ thống'),
  ('refund:process:platform','refund','process','PLATFORM','Platform Admin xử lý refund đã được duyệt'),
  ('admin:trust_snapshot:read','admin','trust_snapshot:read','PLATFORM','Xem trust snapshot salon'),
  ('admin:trust_snapshot:manage','admin','trust_snapshot:manage','PLATFORM','Tạo snapshot và thực hiện Trust & Safety action'),
  ('platform_setting:manage:platform','platform_setting','manage','PLATFORM','Quản lý cấu hình vận hành toàn nền tảng'),
  ('report:overview:platform','report','overview','PLATFORM','Xem dashboard tổng quan platform'),
  ('report:overview:tenant','report','overview','TENANT','Owner xem dashboard vận hành trong tenant'),
  ('report:revenue:branch','report','revenue','BRANCH','Owner xem doanh thu trong chi nhánh'),
  ('report:revenue:tenant','report','revenue','TENANT','Owner xem doanh thu thuộc tenant'),
  ('report:revenue:platform','report','revenue','PLATFORM','Platform xem doanh thu toàn hệ thống'),
  ('report:user_growth:platform','report','user_growth','PLATFORM','Xem tăng trưởng user'),
  ('audit:read:platform','audit','read','PLATFORM','Admin đọc audit log'),
  ('audit:read:tenant','audit','read','TENANT','Owner đọc audit log trong tenant'),
  ('privacy_request:manage:self','privacy_request','manage','SELF','Customer tạo và theo dõi yêu cầu dữ liệu của mình'),
  ('marketing_preference:manage:self','marketing_preference','manage','SELF','Customer quản lý opt-in marketing tách biệt consent dịch vụ'),
  ('legal_document:read:tenant','legal_document','read','TENANT','Chủ doanh nghiệp đọc hồ sơ pháp lý trong tenant của mình'),
  ('legal_document:delete:tenant','legal_document','delete','TENANT','Chủ doanh nghiệp xóa hồ sơ pháp lý trong tenant của mình'),
  ('legal_document:read:platform','legal_document','read','PLATFORM','Platform reviewer đọc hồ sơ pháp lý'),
  ('legal_document:delete:platform','legal_document','delete','PLATFORM','Platform xóa hồ sơ pháp lý theo quy trình được kiểm toán'),
  ('change_request:create:self','change_request','create','SELF','Tạo yêu cầu đổi lịch/huỷ'),
  ('change_request:approve:branch','change_request','approve','BRANCH','Salon duyệt yêu cầu trong chi nhánh'),
  ('change_request:approve:tenant','change_request','approve','TENANT','Owner duyệt yêu cầu trong tenant'),
  ('notification:read:self','notification','read','SELF','Đọc thông báo của chính mình'),
  ('payment_transaction:verify:branch','payment_transaction','verify','BRANCH','Lễ tân xác minh chuyển khoản thủ công tại chi nhánh'),
  ('payment_transaction:verify:tenant','payment_transaction','verify','TENANT','Chủ doanh nghiệp xác minh giao dịch thủ công'),
  ('payment_policy:manage:tenant','payment_policy','manage','TENANT','Chủ doanh nghiệp quản lý chính sách cọc và trả trước có phiên bản'),
  ('financial_ledger:read:tenant','financial_ledger','read','TENANT','Chủ doanh nghiệp xem sổ tài chính có thể truy vết'),
  ('financial_ledger:read:platform','financial_ledger','read','PLATFORM','Platform Admin xem sổ tài chính toàn nền tảng'),
  ('platform_statement:read:tenant','platform_statement','read','TENANT','Chủ doanh nghiệp xem đối soát phí nền tảng'),
  ('platform_statement:manage:platform','platform_statement','manage','PLATFORM','Platform Admin phát hành và quản lý đối soát phí nền tảng'),
  ('treatment_package:manage:tenant','treatment_package','manage','TENANT','Chủ doanh nghiệp quản lý gói liệu trình'),
  ('package_purchase:create:branch','package_purchase','create','BRANCH','Lễ tân tạo giao dịch mua gói tại chi nhánh'),
  ('package_purchase:create:tenant','package_purchase','create','TENANT','Chủ doanh nghiệp tạo giao dịch mua gói trong doanh nghiệp'),
  ('package_purchase:create:self','package_purchase','create','SELF','Khách hàng sử dụng gói liệu trình đã mua'),
  ('package_purchase:read:self','package_purchase','read','SELF','Khách hàng xem gói liệu trình của chính mình'),
  ('package_purchase:read:tenant','package_purchase','read','TENANT','Chủ doanh nghiệp xem giao dịch gói trong doanh nghiệp'),
  ('voucher:read:platform','voucher','read','PLATFORM','Platform Admin xem voucher toàn hệ thống'),
  ('treatment_package:read:public','treatment_package','read','PUBLIC','Xem danh mục gói liệu trình đang được bán');
INSERT INTO permissions(id,code,resource,action,scope,description)
SELECT gen_random_uuid()::text,code,resource,action,scope::"PermissionScope",description
FROM _target_permissions
ON CONFLICT(code) DO UPDATE SET resource=EXCLUDED.resource,action=EXCLUDED.action,
  scope=EXCLUDED.scope,description=EXCLUDED.description;

CREATE TEMP TABLE _target_grants(role_code text,permission_code text,PRIMARY KEY(role_code,permission_code)) ON COMMIT DROP;
INSERT INTO _target_grants VALUES
  ('PLATFORM_ADMIN','user:read:self'),
  ('PLATFORM_ADMIN','user:update:self'),
  ('PLATFORM_ADMIN','notification:read:self'),
  ('PLATFORM_ADMIN','branch:read:platform'),
  ('PLATFORM_ADMIN','branch:status:platform'),
  ('PLATFORM_ADMIN','business:review:platform'),
  ('PLATFORM_ADMIN','booking:read:platform'),
  ('PLATFORM_ADMIN','booking:cancel:platform'),
  ('PLATFORM_ADMIN','user:read:platform'),
  ('PLATFORM_ADMIN','user:role_assign:platform'),
  ('PLATFORM_ADMIN','user:suspend:platform'),
  ('PLATFORM_ADMIN','payment:read:platform'),
  ('PLATFORM_ADMIN','payment:refund:platform'),
  ('PLATFORM_ADMIN','refund:create:platform'),
  ('PLATFORM_ADMIN','refund:approve:platform'),
  ('PLATFORM_ADMIN','refund:process:platform'),
  ('PLATFORM_ADMIN','review:moderate:platform'),
  ('PLATFORM_ADMIN','service:read:platform'),
  ('PLATFORM_ADMIN','combo:read:platform'),
  ('PLATFORM_ADMIN','canonical_service:read:public'),
  ('PLATFORM_ADMIN','canonical_service:manage:platform'),
  ('PLATFORM_ADMIN','promotion:manage:platform'),
  ('PLATFORM_ADMIN','voucher:manage:platform'),
  ('PLATFORM_ADMIN','voucher:read:platform'),
  ('PLATFORM_ADMIN','audit:read:platform'),
  ('PLATFORM_ADMIN','admin:trust_snapshot:read'),
  ('PLATFORM_ADMIN','admin:trust_snapshot:manage'),
  ('PLATFORM_ADMIN','platform_setting:manage:platform'),
  ('PLATFORM_ADMIN','report:overview:platform'),
  ('PLATFORM_ADMIN','report:user_growth:platform'),
  ('PLATFORM_ADMIN','report:revenue:platform'),
  ('PLATFORM_ADMIN','financial_ledger:read:platform'),
  ('PLATFORM_ADMIN','platform_statement:manage:platform'),
  ('PLATFORM_ADMIN','legal_document:read:platform'),
  ('PLATFORM_ADMIN','legal_document:delete:platform'),
  ('BUSINESS_OWNER','user:read:self'),
  ('BUSINESS_OWNER','user:update:self'),
  ('BUSINESS_OWNER','notification:read:self'),
  ('BUSINESS_OWNER','business:create:self'),
  ('BUSINESS_OWNER','business:update:tenant'),
  ('BUSINESS_OWNER','booking:create:tenant'),
  ('BUSINESS_OWNER','booking:read:tenant'),
  ('BUSINESS_OWNER','booking:update:tenant'),
  ('BUSINESS_OWNER','booking:cancel:tenant'),
  ('BUSINESS_OWNER','booking:assign:tenant'),
  ('BUSINESS_OWNER','booking:check_in:tenant'),
  ('BUSINESS_OWNER','branch:read:tenant'),
  ('BUSINESS_OWNER','branch:create:tenant'),
  ('BUSINESS_OWNER','branch:update:tenant'),
  ('BUSINESS_OWNER','business_service:create:tenant'),
  ('BUSINESS_OWNER','business_service:update:tenant'),
  ('BUSINESS_OWNER','business_service:archive:tenant'),
  ('BUSINESS_OWNER','service_category:manage:tenant'),
  ('BUSINESS_OWNER','branch_service_offering:status:tenant'),
  ('BUSINESS_OWNER','branch_service_offering:pricing:tenant'),
  ('BUSINESS_OWNER','staff_service:assign:tenant'),
  ('BUSINESS_OWNER','combo:manage:tenant'),
  ('BUSINESS_OWNER','combo:read:public'),
  ('BUSINESS_OWNER','promotion:manage:tenant'),
  ('BUSINESS_OWNER','voucher:manage:tenant'),
  ('BUSINESS_OWNER','user:read:tenant'),
  ('BUSINESS_OWNER','user:role_assign:tenant'),
  ('BUSINESS_OWNER','review:moderate:tenant'),
  ('BUSINESS_OWNER','review:report:tenant'),
  ('BUSINESS_OWNER','payment:read:tenant'),
  ('BUSINESS_OWNER','payment:create:tenant'),
  ('BUSINESS_OWNER','payment:refund:tenant'),
  ('BUSINESS_OWNER','refund:create:tenant'),
  ('BUSINESS_OWNER','refund:approve:tenant'),
  ('BUSINESS_OWNER','report:revenue:tenant'),
  ('BUSINESS_OWNER','report:revenue:branch'),
  ('BUSINESS_OWNER','report:overview:tenant'),
  ('BUSINESS_OWNER','audit:read:tenant'),
  ('BUSINESS_OWNER','change_request:approve:tenant'),
  ('BUSINESS_OWNER','legal_document:read:tenant'),
  ('BUSINESS_OWNER','legal_document:delete:tenant'),
  ('BUSINESS_OWNER','payment_transaction:verify:tenant'),
  ('BUSINESS_OWNER','payment_policy:manage:tenant'),
  ('BUSINESS_OWNER','financial_ledger:read:tenant'),
  ('BUSINESS_OWNER','platform_statement:read:tenant'),
  ('BUSINESS_OWNER','treatment_package:manage:tenant'),
  ('BUSINESS_OWNER','treatment_package:read:public'),
  ('BUSINESS_OWNER','package_purchase:create:tenant'),
  ('BUSINESS_OWNER','package_purchase:read:tenant'),
  ('RECEPTIONIST','user:read:self'),
  ('RECEPTIONIST','user:update:self'),
  ('RECEPTIONIST','notification:read:self'),
  ('RECEPTIONIST','user:read:branch'),
  ('RECEPTIONIST','branch:read:branch'),
  ('RECEPTIONIST','booking:create:branch'),
  ('RECEPTIONIST','booking:read:branch'),
  ('RECEPTIONIST','booking:update:branch'),
  ('RECEPTIONIST','booking:check_in:branch'),
  ('RECEPTIONIST','booking:cancel:branch'),
  ('RECEPTIONIST','booking:assign:branch'),
  ('RECEPTIONIST','booking:reschedule:branch'),
  ('RECEPTIONIST','change_request:approve:branch'),
  ('RECEPTIONIST','booking:read_internal_note:branch'),
  ('RECEPTIONIST','payment:read:branch'),
  ('RECEPTIONIST','payment:create:branch'),
  ('RECEPTIONIST','payment_transaction:verify:branch'),
  ('RECEPTIONIST','treatment_package:read:public'),
  ('RECEPTIONIST','package_purchase:create:branch'),
  ('STAFF','user:read:self'),
  ('STAFF','user:update:self'),
  ('STAFF','notification:read:self'),
  ('STAFF','branch:read:branch'),
  ('STAFF','booking:read:branch'),
  ('STAFF','booking:update:branch'),
  ('STAFF','booking:complete:branch'),
  ('STAFF','booking:read_internal_note:branch'),
  ('CUSTOMER','user:read:self'),
  ('CUSTOMER','user:update:self'),
  ('CUSTOMER','booking:create:self'),
  ('CUSTOMER','booking:read:self'),
  ('CUSTOMER','booking:update:self'),
  ('CUSTOMER','booking:cancel:self'),
  ('CUSTOMER','booking:reschedule:self'),
  ('CUSTOMER','service:read:public'),
  ('CUSTOMER','canonical_service:read:public'),
  ('CUSTOMER','branch:read:public'),
  ('CUSTOMER','combo:read:public'),
  ('CUSTOMER','review:create:self'),
  ('CUSTOMER','review:read:public'),
  ('CUSTOMER','payment:read:self'),
  ('CUSTOMER','treatment_package:read:public'),
  ('CUSTOMER','package_purchase:create:self'),
  ('CUSTOMER','package_purchase:read:self'),
  ('CUSTOMER','voucher:read:self'),
  ('CUSTOMER','notification:read:self'),
  ('CUSTOMER','change_request:create:self'),
  ('CUSTOMER','privacy_request:manage:self'),
  ('CUSTOMER','marketing_preference:manage:self'),
  ('GUEST','service:read:public'),
  ('GUEST','canonical_service:read:public'),
  ('GUEST','branch:read:public'),
  ('GUEST','combo:read:public'),
  ('GUEST','review:read:public');
-- Synchronize official role defaults; custom direct grants unrelated to the
-- eight retired codes remain untouched. Historical role grants were archived.
DELETE FROM role_permissions rp USING roles r
WHERE rp.role_id=r.id AND r.code::text IN (SELECT code FROM _target_roles)
  AND NOT EXISTS (
    SELECT 1 FROM _target_grants target JOIN permissions p ON p.code=target.permission_code
    WHERE target.role_code=r.code::text AND p.id=rp.permission_id
  );
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM _target_grants target
JOIN roles r ON r.code::text=target.role_code JOIN permissions p ON p.code=target.permission_code
ON CONFLICT(role_id,permission_id) DO NOTHING;

-- Keep the old RoleCode type for archived HR columns; never CASCADE/drop them.
ALTER TYPE "RoleCode" RENAME TO "RoleCode_archive_20260915";
CREATE TYPE "RoleCode" AS ENUM ('PLATFORM_ADMIN','BUSINESS_OWNER','RECEPTIONIST','STAFF','CUSTOMER','GUEST');
ALTER TABLE roles ALTER COLUMN code TYPE "RoleCode" USING code::text::"RoleCode";
ALTER TABLE staff_invitations ALTER COLUMN role_code TYPE "RoleCode" USING role_code::text::"RoleCode";
ALTER TYPE "SalonMemberRole" RENAME TO "SalonMemberRole_archive_20260915";
CREATE TYPE "SalonMemberRole" AS ENUM ('OWNER','RECEPTIONIST');
ALTER TABLE salon_members ALTER COLUMN role TYPE "SalonMemberRole" USING role::text::"SalonMemberRole";
DROP TYPE "SalonMemberRole_archive_20260915";

CREATE OR REPLACE FUNCTION validate_user_role_scope()
RETURNS trigger AS $scope$
DECLARE
  role_code text;
  branch_business_id text;
BEGIN
  SELECT code::text INTO role_code FROM roles WHERE id=NEW.role_id;
  IF role_code IN ('RECEPTIONIST','STAFF') AND NEW.branch_id IS NULL THEN
    RAISE EXCEPTION 'branch-scoped role % requires branch_id',role_code;
  END IF;
  IF NEW.branch_id IS NOT NULL THEN
    SELECT business_id INTO branch_business_id FROM branches WHERE id=NEW.branch_id;
    IF branch_business_id IS NULL OR NEW.business_id IS DISTINCT FROM branch_business_id THEN
      RAISE EXCEPTION 'user role branch and business scope do not match';
    END IF;
  END IF;
  RETURN NEW;
END;
$scope$ LANGUAGE plpgsql;

DO $postconditions$
BEGIN
  IF EXISTS (
    SELECT 1 FROM _manager_grants old_grant
    LEFT JOIN user_roles current_grant ON current_grant.id=old_grant.id
    LEFT JOIN roles r ON r.id=current_grant.role_id
    WHERE r.code::text IS DISTINCT FROM 'RECEPTIONIST'
      OR (to_jsonb(current_grant)-'role_id') IS DISTINCT FROM (to_jsonb(old_grant)-'role_id')
  ) THEN
    RAISE EXCEPTION 'Manager conversion did not preserve assignment identity/scope/history';
  END IF;
  IF EXISTS (
    SELECT 1 FROM user_sessions s WHERE s.user_id IN (SELECT user_id FROM _manager_grants)
      AND s.workspace::text='SALON' AND s.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Old Manager sessions were not revoked';
  END IF;
  IF EXISTS (SELECT 1 FROM roles WHERE code::text='BRANCH_MANAGER') THEN
    RAISE EXCEPTION 'Retired role remains';
  END IF;
END
$postconditions$;
COMMIT;
