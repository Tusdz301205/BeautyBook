import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { resolveWorkspaceAssignments } from './auth-workspace';

const assignment = (code: string, businessId: string | null = null, branchId: string | null = null) => ({
  role: { code },
  businessId,
  branchId,
  expiresAt: null,
});

describe('workspace-bound authentication', () => {
  it('requires an explicit workspace when one User has customer and salon access', () => {
    expect(() => resolveWorkspaceAssignments([
      assignment('CUSTOMER'),
      assignment('STAFF', 'business-1', 'branch-1'),
    ], {}, true)).toThrow(BadRequestException);
  });

  it('does not leak salon roles into a customer session', () => {
    const result = resolveWorkspaceAssignments([
      assignment('CUSTOMER'),
      assignment('STAFF', 'business-1', 'branch-1'),
    ], { workspace: 'CUSTOMER' }, true);
    expect(result.assignments.map((item) => item.role.code)).toEqual(['CUSTOMER']);
    expect(result.businessId).toBeNull();
  });

  it('does not leak customer or platform roles into a salon session', () => {
    const result = resolveWorkspaceAssignments([
      assignment('CUSTOMER'),
      assignment('STAFF', 'business-1', 'branch-1'),
      assignment('PLATFORM_ADMIN'),
    ], { workspace: 'SALON', businessId: 'business-1' }, true);
    expect(result.assignments.map((item) => item.role.code)).toEqual(['STAFF']);
  });

  it('rejects a salon business outside active scoped assignments', () => {
    expect(() => resolveWorkspaceAssignments([
      assignment('STAFF', 'business-1', 'branch-1'),
    ], { workspace: 'SALON', businessId: 'business-2' })).toThrow(UnauthorizedException);
  });
});
