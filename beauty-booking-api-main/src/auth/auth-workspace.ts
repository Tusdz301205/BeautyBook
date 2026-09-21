import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { OPERATIONAL_ROLES } from './account-separation';

export type AuthWorkspaceName = 'CUSTOMER' | 'SALON' | 'PLATFORM';

export const WORKSPACE_ROLES: Record<AuthWorkspaceName, ReadonlySet<string>> = {
  CUSTOMER: new Set(['CUSTOMER']),
  SALON: new Set(['BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF']),
  PLATFORM: new Set(['PLATFORM_ADMIN']),
};

export const sessionTypeForWorkspace = (
  workspace: AuthWorkspaceName,
): 'admin' | 'salon' | 'customer' =>
  workspace === 'PLATFORM' ? 'admin' : workspace === 'SALON' ? 'salon' : 'customer';

export interface WorkspaceRoleAssignment {
  businessId: string | null;
  branchId: string | null;
  expiresAt: Date | null;
  role: { code: string };
}

export interface WorkspaceRequest {
  workspace?: AuthWorkspaceName;
  businessId?: string;
  branchId?: string;
}

function isUsableAssignment(assignment: WorkspaceRoleAssignment): boolean {
  if (assignment.expiresAt && !(assignment.expiresAt.getTime() > Date.now())) return false;
  if (assignment.role.code === 'RECEPTIONIST' || assignment.role.code === 'STAFF') {
    return Boolean(assignment.businessId && assignment.branchId);
  }
  return true;
}

export function availableWorkspaces(
  assignments: WorkspaceRoleAssignment[],
  _hasCustomerProfile = false,
): AuthWorkspaceName[] {
  const active = assignments.filter(isUsableAssignment);
  // Even a malformed operational scope must not fall back to CUSTOMER.
  const operational = assignments.some((assignment) =>
    OPERATIONAL_ROLES.has(assignment.role.code) &&
    (!assignment.expiresAt || assignment.expiresAt.getTime() > Date.now()));
  return (['CUSTOMER', 'SALON', 'PLATFORM'] as AuthWorkspaceName[]).filter((workspace) =>
    workspace === 'CUSTOMER'
      ? !operational && active.some((assignment) => WORKSPACE_ROLES.CUSTOMER.has(assignment.role.code))
      : active.some((assignment) => WORKSPACE_ROLES[workspace].has(assignment.role.code)),
  );
}

export function resolveWorkspaceAssignments(
  assignments: WorkspaceRoleAssignment[],
  request: WorkspaceRequest,
  hasCustomerProfile = false,
) {
  const available = availableWorkspaces(assignments, hasCustomerProfile);
  if (!available.length) throw new UnauthorizedException('Tài khoản chưa có không gian làm việc hợp lệ');
  if (!request.workspace && available.length > 1) {
    throw new BadRequestException({
      message: 'Tài khoản có nhiều không gian làm việc; hãy chọn CUSTOMER, SALON hoặc PLATFORM',
      code: 'WORKSPACE_REQUIRED',
      availableWorkspaces: available,
    });
  }
  const workspace = request.workspace ?? available[0];
  if (!available.includes(workspace)) {
    throw new UnauthorizedException('Tài khoản không có quyền truy cập không gian đã chọn');
  }

  let filtered = assignments.filter(
    (assignment) =>
      isUsableAssignment(assignment) &&
      WORKSPACE_ROLES[workspace].has(assignment.role.code),
  );

  let businessId = request.businessId ?? null;
  let branchId = request.branchId ?? null;
  if (workspace === 'SALON') {
    const businesses = [...new Set(filtered.map((item) => item.businessId).filter(Boolean))] as string[];
    if (!businessId && businesses.length === 1) businessId = businesses[0];
    if (!businessId && businesses.length > 1) {
      throw new BadRequestException({
        message: 'Hãy chọn doanh nghiệp cần làm việc',
        code: 'BUSINESS_REQUIRED',
        businessIds: businesses,
      });
    }
    if (businessId && !filtered.some((item) => item.businessId === businessId)) {
      throw new UnauthorizedException('Không có quyền truy cập doanh nghiệp đã chọn');
    }
    if (businessId) filtered = filtered.filter((item) => item.businessId === businessId);
    if (branchId && !filtered.some((item) =>
      (item.role.code === 'BUSINESS_OWNER' && item.branchId === null) || item.branchId === branchId,
    )) {
      throw new UnauthorizedException('Không có quyền truy cập chi nhánh đã chọn');
    }
  } else {
    businessId = null;
    branchId = null;
  }

  return { workspace, businessId, branchId, assignments: filtered, availableWorkspaces: available };
}
