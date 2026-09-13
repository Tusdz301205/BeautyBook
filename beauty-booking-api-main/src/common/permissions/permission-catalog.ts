/**
 * Permission catalog for Beauty Booking Marketplace.
 *
 * Format: `resource:action:scope` (e.g. `booking:update:branch`).
 *
 * Section 3 of the plan specifies the BOOKINGS matrix in detail; the patterns
 * below extend it to the other modules (branches, services, users, reviews,
 * payments, admin, reports, health records) using the same 3-layer actor model.
 *
 * IMPORTANT: codes in this file are the single source of truth. Both
 *   - runtime guards/policies
 *   - the Prisma `permissions` table seed (see `prisma/seed-permissions.ts`)
 * reference these entries.
 */

export type PermissionCode = string;

export type PermissionScopeKind =
  | 'PLATFORM'
  | 'TENANT'
  | 'BRANCH'
  | 'SELF'
  | 'PUBLIC';

export interface PermissionEntry {
  /** Stable code, also stored in DB as `permissions.code`. */
  code: PermissionCode;
  resource: string;
  action: string;
  /** Default scope when role-level rule resolves. */
  defaultScope: PermissionScopeKind;
  description: string;
}

/**
 * Module-permission matrix. Each permission is identified by a unique
 * `resource:action:scope` triple. The matrix is the contract that
 * `prisma/seed-permissions.ts` and the runtime `policy.can()` use.
 */
export const PERMISSIONS: readonly PermissionEntry[] = Object.freeze([
  // -----------------------------------------------------------
  // BOOKINGS — extends plan §3.1
  // -----------------------------------------------------------
  { code: 'booking:create:self', resource: 'booking', action: 'create', defaultScope: 'SELF',
    description: 'Customer tạo lịch cho chính mình' },
  { code: 'booking:create:branch', resource: 'booking', action: 'create', defaultScope: 'BRANCH',
    description: 'Receptionist/Manager tạo lịch hộ khách trong chi nhánh' },
  { code: 'booking:create:tenant', resource: 'booking', action: 'create', defaultScope: 'TENANT',
    description: 'Owner tạo lịch thuộc bất kỳ chi nhánh nào trong tenant' },

  { code: 'booking:read:self', resource: 'booking', action: 'read', defaultScope: 'SELF',
    description: 'Customer xem lịch của chính mình' },
  { code: 'booking:read:branch', resource: 'booking', action: 'read', defaultScope: 'BRANCH',
    description: 'Staff/Manager/Receptionist xem lịch thuộc chi nhánh' },
  { code: 'booking:read:tenant', resource: 'booking', action: 'read', defaultScope: 'TENANT',
    description: 'Owner xem tất cả lịch trong tenant' },
  { code: 'booking:read:platform', resource: 'booking', action: 'read', defaultScope: 'PLATFORM',
    description: 'Platform xem tất cả lịch toàn hệ thống' },

  { code: 'booking:update:self', resource: 'booking', action: 'update', defaultScope: 'SELF',
    description: 'Customer cập nhật lịch của mình (giờ, ghi chú)' },
  { code: 'booking:update:branch', resource: 'booking', action: 'update', defaultScope: 'BRANCH',
    description: 'Staff/Manager cập nhật lịch trong chi nhánh' },
  { code: 'booking:update:tenant', resource: 'booking', action: 'update', defaultScope: 'TENANT',
    description: 'Owner cập nhật lịch trong tenant' },

  { code: 'booking:assign:branch', resource: 'booking', action: 'assign', defaultScope: 'BRANCH',
    description: 'Manager gán staff cho booking trong chi nhánh' },
  { code: 'booking:assign:tenant', resource: 'booking', action: 'assign', defaultScope: 'TENANT',
    description: 'Owner gán staff cho booking trong tenant' },

  { code: 'booking:cancel:self', resource: 'booking', action: 'cancel', defaultScope: 'SELF',
    description: 'Customer huỷ lịch của chính mình' },
  { code: 'booking:cancel:branch', resource: 'booking', action: 'cancel', defaultScope: 'BRANCH',
    description: 'Salon huỷ lịch trong chi nhánh' },
  { code: 'booking:cancel:tenant', resource: 'booking', action: 'cancel', defaultScope: 'TENANT',
    description: 'Owner huỷ lịch trong tenant' },
  { code: 'booking:cancel:platform', resource: 'booking', action: 'cancel', defaultScope: 'PLATFORM',
    description: 'Platform ép huỷ (ghi log FORCE_CANCEL)' },

  { code: 'booking:check_in:branch', resource: 'booking', action: 'check_in', defaultScope: 'BRANCH',
    description: 'Receptionist check-in khách' },
  { code: 'booking:check_in:tenant', resource: 'booking', action: 'check_in', defaultScope: 'TENANT',
    description: 'Owner check-in khách trong tenant' },
  { code: 'booking:complete:branch', resource: 'booking', action: 'complete', defaultScope: 'BRANCH',
    description: 'Staff đánh dấu hoàn thành dịch vụ' },

  { code: 'booking:reschedule:self', resource: 'booking', action: 'reschedule', defaultScope: 'SELF',
    description: 'Customer yêu cầu đổi lịch' },
  { code: 'booking:reschedule:branch', resource: 'booking', action: 'reschedule', defaultScope: 'BRANCH',
    description: 'Salon xử lý yêu cầu đổi lịch trong chi nhánh' },

  { code: 'booking:read_internal_note:branch', resource: 'booking', action: 'read_internal_note', defaultScope: 'BRANCH',
    description: 'Salon đọc ghi chú nội bộ của booking' },

  // -----------------------------------------------------------
  // BRANCHES
  // -----------------------------------------------------------
  { code: 'business:create:self', resource: 'business', action: 'create', defaultScope: 'SELF',
    description: 'Owner tạo hồ sơ onboarding doanh nghiệp' },
  { code: 'business:update:tenant', resource: 'business', action: 'update', defaultScope: 'TENANT',
    description: 'Owner cập nhật hồ sơ doanh nghiệp trong tenant' },
  { code: 'business:review:platform', resource: 'business', action: 'review', defaultScope: 'PLATFORM',
    description: 'Platform Admin duyệt hoặc yêu cầu bổ sung hồ sơ doanh nghiệp' },
  { code: 'branch:read:public', resource: 'branch', action: 'read', defaultScope: 'PUBLIC',
    description: 'Guest xem thông tin chi nhánh công khai' },
  { code: 'branch:read:platform', resource: 'branch', action: 'read', defaultScope: 'PLATFORM',
    description: 'Platform xem tất cả chi nhánh, bao gồm hàng đợi tuân thủ' },
  { code: 'branch:read:tenant', resource: 'branch', action: 'read', defaultScope: 'TENANT',
    description: 'Salon xem tất cả chi nhánh thuộc tenant' },
  { code: 'branch:read:branch', resource: 'branch', action: 'read', defaultScope: 'BRANCH',
    description: 'Nhân sự chi nhánh xem chi nhánh được phân công' },
  { code: 'branch:create:tenant', resource: 'branch', action: 'create', defaultScope: 'TENANT',
    description: 'Owner tạo chi nhánh mới trong tenant của mình' },
  { code: 'branch:update:tenant', resource: 'branch', action: 'update', defaultScope: 'TENANT',
    description: 'Owner cập nhật thông tin chi nhánh' },
  { code: 'branch:update:branch', resource: 'branch', action: 'update', defaultScope: 'BRANCH',
    description: 'Manager cập nhật thông tin chi nhánh được phân công' },
  { code: 'branch:status:platform', resource: 'branch', action: 'status', defaultScope: 'PLATFORM',
    description: 'Platform duyệt/từ chối chi nhánh' },

  // -----------------------------------------------------------
  // SERVICES — taxonomy, business catalog and concrete branch offering
  // -----------------------------------------------------------
  { code: 'service:read:public', resource: 'service', action: 'read', defaultScope: 'PUBLIC',
    description: 'Khách xem dịch vụ' },
  { code: 'service:read:platform', resource: 'service', action: 'read', defaultScope: 'PLATFORM',
    description: 'Platform đọc catalog và offering để quản trị/điều tra' },
  { code: 'canonical_service:read:public', resource: 'canonical_service', action: 'read', defaultScope: 'PUBLIC',
    description: 'Đọc taxonomy dịch vụ đang hoạt động để tìm kiếm' },
  { code: 'canonical_service:manage:platform', resource: 'canonical_service', action: 'manage', defaultScope: 'PLATFORM',
    description: 'Platform quản lý taxonomy chuẩn, deprecate và merge' },
  { code: 'service_category:manage:tenant', resource: 'service_category', action: 'manage', defaultScope: 'TENANT',
    description: 'Owner tổ chức menu dịch vụ riêng của doanh nghiệp' },
  { code: 'business_service:create:tenant', resource: 'business_service', action: 'create', defaultScope: 'TENANT',
    description: 'Owner tạo dịch vụ cấp doanh nghiệp' },
  { code: 'business_service:update:tenant', resource: 'business_service', action: 'update', defaultScope: 'TENANT',
    description: 'Owner sửa tên, mapping, giá và thời lượng mặc định' },
  { code: 'business_service:archive:tenant', resource: 'business_service', action: 'archive', defaultScope: 'TENANT',
    description: 'Owner lưu trữ dịch vụ cấp doanh nghiệp sau khi xử lý booking tương lai' },
  { code: 'branch_service_offering:status:tenant', resource: 'branch_service_offering', action: 'status', defaultScope: 'TENANT',
    description: 'Owner bật, tắt và đặt bookable cho offering trong doanh nghiệp' },
  { code: 'branch_service_offering:status:branch', resource: 'branch_service_offering', action: 'status', defaultScope: 'BRANCH',
    description: 'Manager vận hành trạng thái offering tại chi nhánh được phân công' },
  { code: 'branch_service_offering:pricing:tenant', resource: 'branch_service_offering', action: 'pricing', defaultScope: 'TENANT',
    description: 'Chỉ Owner sửa giá/thời lượng offering tại chi nhánh' },
  { code: 'staff_service:assign:tenant', resource: 'staff_service', action: 'assign', defaultScope: 'TENANT',
    description: 'Owner phân công năng lực dịch vụ cho nhân sự trong doanh nghiệp' },
  { code: 'staff_service:assign:branch', resource: 'staff_service', action: 'assign', defaultScope: 'BRANCH',
    description: 'Manager phân công năng lực dịch vụ cho nhân sự trong chi nhánh' },
  { code: 'combo:read:public', resource: 'combo', action: 'read', defaultScope: 'PUBLIC',
    description: 'Khách xem combo đang bán công khai' },
  { code: 'combo:read:platform', resource: 'combo', action: 'read', defaultScope: 'PLATFORM',
    description: 'Platform đọc combo phục vụ quản trị và điều tra' },
  { code: 'combo:manage:tenant', resource: 'combo', action: 'manage', defaultScope: 'TENANT',
    description: 'Owner quản lý combo thương mại của doanh nghiệp' },

  // -----------------------------------------------------------
  // USERS
  // -----------------------------------------------------------
  { code: 'user:read:self', resource: 'user', action: 'read', defaultScope: 'SELF',
    description: 'User xem profile của chính mình' },
  { code: 'user:update:self', resource: 'user', action: 'update', defaultScope: 'SELF',
    description: 'User cập nhật profile của chính mình' },
  { code: 'user:read:tenant', resource: 'user', action: 'read', defaultScope: 'TENANT',
    description: 'Owner xem nhân viên thuộc tenant' },
  { code: 'user:read:branch', resource: 'user', action: 'read', defaultScope: 'BRANCH',
    description: 'Manager/Receptionist xem nhân viên thuộc chi nhánh' },
  { code: 'user:read:platform', resource: 'user', action: 'read', defaultScope: 'PLATFORM',
    description: 'Admin xem tất cả user' },
  { code: 'user:role_assign:tenant', resource: 'user', action: 'role_assign', defaultScope: 'TENANT',
    description: 'Owner gán role cho nhân viên thuộc tenant' },
  { code: 'user:role_assign:branch', resource: 'user', action: 'role_assign', defaultScope: 'BRANCH',
    description: 'Manager mời và quản lý nhân viên thuộc chi nhánh' },
  { code: 'user:role_assign:platform', resource: 'user', action: 'role_assign', defaultScope: 'PLATFORM',
    description: 'Admin gán role cho user' },
  { code: 'user:suspend:platform', resource: 'user', action: 'suspend', defaultScope: 'PLATFORM',
    description: 'Admin khoá tài khoản' },
  // -----------------------------------------------------------
  // REVIEWS
  // -----------------------------------------------------------
  { code: 'promotion:manage:platform', resource: 'promotion', action: 'manage', defaultScope: 'PLATFORM',
    description: 'Platform Admin quản lý campaign do nền tảng sở hữu' },
  { code: 'promotion:manage:tenant', resource: 'promotion', action: 'manage', defaultScope: 'TENANT',
    description: 'Owner quản lý campaign trong tenant' },
  { code: 'voucher:manage:platform', resource: 'voucher', action: 'manage', defaultScope: 'PLATFORM',
    description: 'Platform Admin quản lý voucher do nền tảng sở hữu' },
  { code: 'voucher:manage:tenant', resource: 'voucher', action: 'manage', defaultScope: 'TENANT',
    description: 'Owner quản lý voucher tenant' },
  { code: 'voucher:read:self', resource: 'voucher', action: 'read', defaultScope: 'SELF',
    description: 'Customer xem voucher đã được cấp cho chính mình' },
  { code: 'review:create:self', resource: 'review', action: 'create', defaultScope: 'SELF',
    description: 'Customer đánh giá booking của mình' },
  { code: 'review:read:public', resource: 'review', action: 'read', defaultScope: 'PUBLIC',
    description: 'Xem review công khai' },
  { code: 'review:report:tenant', resource: 'review', action: 'report', defaultScope: 'TENANT',
    description: 'Owner báo cáo review thuộc doanh nghiệp để Platform kiểm duyệt' },
  { code: 'review:report:branch', resource: 'review', action: 'report', defaultScope: 'BRANCH',
    description: 'Manager báo cáo review thuộc chi nhánh để Platform kiểm duyệt' },
  { code: 'review:moderate:tenant', resource: 'review', action: 'moderate', defaultScope: 'TENANT',
    description: 'Owner duyệt/ẩn review thuộc tenant' },
  { code: 'review:moderate:branch', resource: 'review', action: 'moderate', defaultScope: 'BRANCH',
    description: 'Manager phản hồi và quản lý review thuộc chi nhánh' },
  { code: 'review:moderate:platform', resource: 'review', action: 'moderate', defaultScope: 'PLATFORM',
    description: 'Admin duyệt/ẩn review toàn hệ thống' },

  // -----------------------------------------------------------
  // PAYMENTS
  // -----------------------------------------------------------
  { code: 'payment:create:branch', resource: 'payment', action: 'create', defaultScope: 'BRANCH',
    description: 'Receptionist thu tiền tại chi nhánh' },
  { code: 'payment:create:tenant', resource: 'payment', action: 'create', defaultScope: 'TENANT',
    description: 'Chủ doanh nghiệp ghi nhận thanh toán trong doanh nghiệp' },
  { code: 'payment:read:self', resource: 'payment', action: 'read', defaultScope: 'SELF',
    description: 'Customer xem thanh toán của mình' },
  { code: 'payment:read:branch', resource: 'payment', action: 'read', defaultScope: 'BRANCH',
    description: 'Salon xem thanh toán thuộc chi nhánh' },
  { code: 'payment:read:tenant', resource: 'payment', action: 'read', defaultScope: 'TENANT',
    description: 'Owner xem thanh toán thuộc tenant' },
  { code: 'payment:read:platform', resource: 'payment', action: 'read', defaultScope: 'PLATFORM',
    description: 'Platform Admin xem thanh toán phục vụ governance' },
  { code: 'payment:refund:tenant', resource: 'payment', action: 'refund', defaultScope: 'TENANT',
    description: 'Owner hoàn tiền trong tenant' },
  { code: 'payment:refund:platform', resource: 'payment', action: 'refund', defaultScope: 'PLATFORM',
    description: 'Platform Admin hoàn tiền ngoại lệ có audit' },
  { code: 'refund:create:tenant', resource: 'refund', action: 'create', defaultScope: 'TENANT',
    description: 'Owner tạo yêu cầu refund trong tenant' },
  { code: 'refund:create:platform', resource: 'refund', action: 'create', defaultScope: 'PLATFORM',
    description: 'Platform Admin tạo yêu cầu refund ngoại lệ' },
  { code: 'refund:approve:tenant', resource: 'refund', action: 'approve', defaultScope: 'TENANT',
    description: 'Owner duyệt refund trong tenant' },
  { code: 'refund:approve:platform', resource: 'refund', action: 'approve', defaultScope: 'PLATFORM',
    description: 'Platform Admin duyệt refund toàn hệ thống' },
  { code: 'refund:process:platform', resource: 'refund', action: 'process', defaultScope: 'PLATFORM',
    description: 'Platform Admin xử lý refund đã được duyệt' },

  // -----------------------------------------------------------
  // ADMIN / REPORTS / AUDIT
  // -----------------------------------------------------------
  { code: 'admin:trust_snapshot:read', resource: 'admin', action: 'trust_snapshot:read', defaultScope: 'PLATFORM',
    description: 'Xem trust snapshot salon' },
  { code: 'admin:trust_snapshot:manage', resource: 'admin', action: 'trust_snapshot:manage', defaultScope: 'PLATFORM',
    description: 'Tạo snapshot và thực hiện Trust & Safety action' },
  { code: 'platform_setting:manage:platform', resource: 'platform_setting', action: 'manage', defaultScope: 'PLATFORM',
    description: 'Quản lý cấu hình vận hành toàn nền tảng' },
  { code: 'report:overview:platform', resource: 'report', action: 'overview', defaultScope: 'PLATFORM',
    description: 'Xem dashboard tổng quan platform' },
  { code: 'report:overview:tenant', resource: 'report', action: 'overview', defaultScope: 'TENANT',
    description: 'Owner xem dashboard vận hành trong tenant' },
  { code: 'report:overview:branch', resource: 'report', action: 'overview', defaultScope: 'BRANCH',
    description: 'Manager xem dashboard vận hành trong chi nhánh' },
  { code: 'report:revenue:branch', resource: 'report', action: 'revenue', defaultScope: 'BRANCH',
    description: 'Manager xem doanh thu trong chi nhánh' },
  { code: 'report:revenue:tenant', resource: 'report', action: 'revenue', defaultScope: 'TENANT',
    description: 'Owner xem doanh thu thuộc tenant' },
  { code: 'report:revenue:platform', resource: 'report', action: 'revenue', defaultScope: 'PLATFORM',
    description: 'Platform xem doanh thu toàn hệ thống' },
  { code: 'report:user_growth:platform', resource: 'report', action: 'user_growth', defaultScope: 'PLATFORM',
    description: 'Xem tăng trưởng user' },
  { code: 'audit:read:platform', resource: 'audit', action: 'read', defaultScope: 'PLATFORM',
    description: 'Admin đọc audit log' },
  { code: 'audit:read:tenant', resource: 'audit', action: 'read', defaultScope: 'TENANT',
    description: 'Owner đọc audit log trong tenant' },
  { code: 'audit:read:branch', resource: 'audit', action: 'read', defaultScope: 'BRANCH',
    description: 'Manager đọc audit vận hành của chi nhánh' },

  { code: 'privacy_request:manage:self', resource: 'privacy_request', action: 'manage', defaultScope: 'SELF',
    description: 'Customer tạo và theo dõi yêu cầu dữ liệu của mình' },
  { code: 'marketing_preference:manage:self', resource: 'marketing_preference', action: 'manage', defaultScope: 'SELF',
    description: 'Customer quản lý opt-in marketing tách biệt consent dịch vụ' },
  { code: 'legal_document:read:tenant', resource: 'legal_document', action: 'read', defaultScope: 'TENANT',
    description: 'Chủ doanh nghiệp đọc hồ sơ pháp lý trong tenant của mình' },
  { code: 'legal_document:delete:tenant', resource: 'legal_document', action: 'delete', defaultScope: 'TENANT',
    description: 'Chủ doanh nghiệp xóa hồ sơ pháp lý trong tenant của mình' },
  { code: 'legal_document:read:platform', resource: 'legal_document', action: 'read', defaultScope: 'PLATFORM',
    description: 'Platform reviewer đọc hồ sơ pháp lý' },
  { code: 'legal_document:delete:platform', resource: 'legal_document', action: 'delete', defaultScope: 'PLATFORM',
    description: 'Platform xóa hồ sơ pháp lý theo quy trình được kiểm toán' },

  // -----------------------------------------------------------
  // CHANGE REQUESTS, NOTIFICATIONS, REPORTS
  // -----------------------------------------------------------
  { code: 'change_request:create:self', resource: 'change_request', action: 'create', defaultScope: 'SELF',
    description: 'Tạo yêu cầu đổi lịch/huỷ' },
  { code: 'change_request:approve:branch', resource: 'change_request', action: 'approve', defaultScope: 'BRANCH',
    description: 'Salon duyệt yêu cầu trong chi nhánh' },
  { code: 'change_request:approve:tenant', resource: 'change_request', action: 'approve', defaultScope: 'TENANT',
    description: 'Owner duyệt yêu cầu trong tenant' },

  { code: 'notification:read:self', resource: 'notification', action: 'read', defaultScope: 'SELF',
    description: 'Đọc thông báo của chính mình' },

  // -----------------------------------------------------------
  // PAYMENT CORE / FINANCIAL LEDGER
  // -----------------------------------------------------------
  { code: 'payment_transaction:verify:branch', resource: 'payment_transaction', action: 'verify', defaultScope: 'BRANCH', description: 'Lễ tân xác minh chuyển khoản thủ công tại chi nhánh' },
  { code: 'payment_transaction:verify:tenant', resource: 'payment_transaction', action: 'verify', defaultScope: 'TENANT', description: 'Chủ doanh nghiệp xác minh giao dịch thủ công' },
  { code: 'payment_policy:manage:tenant', resource: 'payment_policy', action: 'manage', defaultScope: 'TENANT', description: 'Chủ doanh nghiệp quản lý chính sách cọc và trả trước có phiên bản' },
  { code: 'financial_ledger:read:tenant', resource: 'financial_ledger', action: 'read', defaultScope: 'TENANT', description: 'Chủ doanh nghiệp xem sổ tài chính có thể truy vết' },
  { code: 'financial_ledger:read:platform', resource: 'financial_ledger', action: 'read', defaultScope: 'PLATFORM', description: 'Platform Admin xem sổ tài chính toàn nền tảng' },
  { code: 'platform_statement:read:tenant', resource: 'platform_statement', action: 'read', defaultScope: 'TENANT', description: 'Chủ doanh nghiệp xem đối soát phí nền tảng' },
  { code: 'platform_statement:manage:platform', resource: 'platform_statement', action: 'manage', defaultScope: 'PLATFORM', description: 'Platform Admin phát hành và quản lý đối soát phí nền tảng' },
  { code: 'treatment_package:manage:tenant', resource: 'treatment_package', action: 'manage', defaultScope: 'TENANT', description: 'Chủ doanh nghiệp quản lý gói liệu trình' },
  { code: 'package_purchase:create:branch', resource: 'package_purchase', action: 'create', defaultScope: 'BRANCH', description: 'Lễ tân tạo giao dịch mua gói tại chi nhánh' },
  { code: 'package_purchase:create:tenant', resource: 'package_purchase', action: 'create', defaultScope: 'TENANT', description: 'Chủ doanh nghiệp tạo giao dịch mua gói trong doanh nghiệp' },
  { code: 'package_purchase:create:self', resource: 'package_purchase', action: 'create', defaultScope: 'SELF', description: 'Khách hàng sử dụng gói liệu trình đã mua' },
  { code: 'package_purchase:read:self', resource: 'package_purchase', action: 'read', defaultScope: 'SELF', description: 'Khách hàng xem gói liệu trình của chính mình' },
  { code: 'package_purchase:read:tenant', resource: 'package_purchase', action: 'read', defaultScope: 'TENANT', description: 'Chủ doanh nghiệp xem giao dịch gói trong doanh nghiệp' },

  // -----------------------------------------------------------
  // Platform campaigns
  // -----------------------------------------------------------
  { code: 'voucher:read:platform', resource: 'voucher', action: 'read', defaultScope: 'PLATFORM',
    description: 'Platform Admin xem voucher toàn hệ thống' },
  { code: 'treatment_package:read:public', resource: 'treatment_package', action: 'read', defaultScope: 'PUBLIC',
    description: 'Xem danh mục gói liệu trình đang được bán' },
]);

/**
 * Lookup helper: returns the catalog entry for a permission code (or null).
 */
export function findPermission(code: PermissionCode): PermissionEntry | null {
  return PERMISSIONS.find((p) => p.code === code) ?? null;
}

/**
 * Build a Set for fast membership checks (used by policy.can).
 */
export const PERMISSION_CODE_SET: ReadonlySet<string> = new Set(
  PERMISSIONS.map((p) => p.code),
);

/**
 * Role-to-permission mapping. Mirrors the matrix in the plan; new roles
 * added here MUST also be added to the seed script and have a matching
 * level in `RoleLevel` (platform/tenant/branch/customer).
 *
 * The mapping is **catalog-only** — runtime enforcement still requires
 * (a) a row in `roles`, (b) `user_roles` with optional tenant/branch scope,
 * (c) the matching row in `role_permissions`.
 */
export const ROLE_PERMISSIONS: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    // Platform layer
    PLATFORM_ADMIN: [
      'user:read:self', 'user:update:self', 'notification:read:self',
      'branch:read:platform', 'branch:status:platform',
      'business:review:platform',
      'booking:read:platform', 'booking:cancel:platform',
      'user:read:platform', 'user:role_assign:platform', 'user:suspend:platform',
      'payment:read:platform', 'payment:refund:platform',
      'refund:create:platform', 'refund:approve:platform', 'refund:process:platform',
      'review:moderate:platform', 'service:read:platform',
      'combo:read:platform',
      'canonical_service:read:public', 'canonical_service:manage:platform',
      'promotion:manage:platform', 'voucher:manage:platform', 'voucher:read:platform',
      'audit:read:platform', 'admin:trust_snapshot:read', 'admin:trust_snapshot:manage',
      'platform_setting:manage:platform',
      'report:overview:platform', 'report:user_growth:platform',
      'report:revenue:platform',
      'financial_ledger:read:platform', 'platform_statement:manage:platform',
      'legal_document:read:platform', 'legal_document:delete:platform',
    ],

    // Tenant layer
    BUSINESS_OWNER: [
      'user:read:self', 'user:update:self', 'notification:read:self',
      'business:create:self', 'business:update:tenant',
      'booking:create:tenant', 'booking:read:tenant', 'booking:update:tenant',
      'booking:cancel:tenant', 'booking:assign:tenant',
      'booking:check_in:tenant',
      'branch:read:tenant', 'branch:create:tenant', 'branch:update:tenant',
      'business_service:create:tenant', 'business_service:update:tenant',
      'business_service:archive:tenant', 'service_category:manage:tenant',
      'branch_service_offering:status:tenant', 'branch_service_offering:pricing:tenant',
      'staff_service:assign:tenant', 'combo:manage:tenant', 'combo:read:public',
      'promotion:manage:tenant', 'voucher:manage:tenant',
      'user:read:tenant', 'user:role_assign:tenant',
      'review:moderate:tenant', 'review:report:tenant',
      'payment:read:tenant', 'payment:create:tenant', 'payment:refund:tenant',
      'refund:create:tenant', 'refund:approve:tenant',
      'report:revenue:tenant', 'report:revenue:branch',
      'report:overview:tenant',
      'audit:read:tenant',
      'change_request:approve:tenant',
      'legal_document:read:tenant', 'legal_document:delete:tenant',
      'payment_transaction:verify:tenant',
      'payment_policy:manage:tenant', 'financial_ledger:read:tenant',
      'platform_statement:read:tenant',
      'treatment_package:manage:tenant', 'treatment_package:read:public',
      'package_purchase:create:tenant',
      'package_purchase:read:tenant',
    ],

    // Branch layer
    BRANCH_MANAGER: [
      'user:read:self', 'user:update:self', 'notification:read:self',
      'user:read:branch', 'user:role_assign:branch',
      'branch:read:branch',
      'branch:update:branch',
      'booking:create:branch', 'booking:read:branch', 'booking:update:branch',
      'booking:cancel:branch', 'booking:assign:branch',
      'booking:check_in:branch', 'booking:complete:branch',
      'booking:reschedule:branch',
      'booking:read_internal_note:branch',
      'payment:read:branch', 'payment:create:branch',
      'branch_service_offering:status:branch',
      'staff_service:assign:branch',
      'review:moderate:branch', 'review:report:branch',
      'report:overview:branch', 'report:revenue:branch',
      'audit:read:branch',
      'change_request:approve:branch',
    ],
    RECEPTIONIST: [
      'user:read:self', 'user:update:self', 'notification:read:self',
      'user:read:branch',
      'branch:read:branch',
      'booking:create:branch', 'booking:read:branch', 'booking:update:branch',
      'booking:check_in:branch',
      'booking:read_internal_note:branch',
      'payment:read:branch', 'payment:create:branch',
      'payment_transaction:verify:branch',
      'treatment_package:read:public', 'package_purchase:create:branch',
    ],
    STAFF: [
      'user:read:self', 'user:update:self', 'notification:read:self',
      'branch:read:branch',
      'booking:read:branch', 'booking:update:branch',
      'booking:complete:branch',
      'booking:read_internal_note:branch',
    ],

    // Customer layer
    CUSTOMER: [
      'user:read:self', 'user:update:self',
      'booking:create:self', 'booking:read:self', 'booking:update:self',
      'booking:cancel:self', 'booking:reschedule:self',
      'service:read:public', 'canonical_service:read:public', 'branch:read:public', 'combo:read:public',
      'review:create:self', 'review:read:public',
      'payment:read:self',
      'treatment_package:read:public',
      'package_purchase:create:self', 'package_purchase:read:self',
      'voucher:read:self',
      'notification:read:self',
      'change_request:create:self',
      'privacy_request:manage:self', 'marketing_preference:manage:self',
    ],
    GUEST: [
      'service:read:public', 'canonical_service:read:public', 'branch:read:public', 'combo:read:public', 'review:read:public',
    ],
  });

/** Role-level hint for each system role (matches `roles.level`). */
export const ROLE_LEVELS: Readonly<Record<string, 'PLATFORM' | 'TENANT' | 'BRANCH' | 'CUSTOMER'>> =
  Object.freeze({
    PLATFORM_ADMIN: 'PLATFORM',
    BUSINESS_OWNER: 'TENANT',
    BRANCH_MANAGER: 'BRANCH',
    RECEPTIONIST: 'BRANCH',
    STAFF: 'BRANCH',
    CUSTOMER: 'CUSTOMER',
    GUEST: 'CUSTOMER',
  });
