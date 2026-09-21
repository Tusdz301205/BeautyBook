import { UnauthorizedException } from '@nestjs/common';
import { resolveWorkspaceAssignments } from './auth-workspace';

const assignment = (code: string, businessId: string | null = null, branchId: string | null = null) => ({
  role: { code },
  businessId,
  branchId,
  expiresAt: null,
});

describe('workspace-bound authentication', () => {
  it('rejects a persisted retired Manager assignment without silently upgrading it', () => {
    expect(() => resolveWorkspaceAssignments([
      assignment('BRANCH_MANAGER', 'business-1', 'branch-1'),
    ], { workspace: 'SALON' })).toThrow(UnauthorizedException);
  });

  it.each(['RECEPTIONIST', 'STAFF'])('requires exact branch scope for %s', (role) => {
    expect(() => resolveWorkspaceAssignments([
      assignment(role, 'business-1'),
    ], { workspace: 'SALON' })).toThrow(UnauthorizedException);
    expect(() => resolveWorkspaceAssignments([
      assignment(role, 'business-1', 'branch-1'),
    ], { workspace: 'SALON', branchId: 'branch-2' })).toThrow(UnauthorizedException);
  });

  it('legacy mixed accounts only resolve their operational workspace', () => {
    expect(resolveWorkspaceAssignments([
      assignment('CUSTOMER'),
      assignment('STAFF', 'business-1', 'branch-1'),
    ], {}, true).workspace).toBe('SALON');
  });

  it('cannot select CUSTOMER to bypass an operational role', () => {
    expect(() => resolveWorkspaceAssignments([
      assignment('CUSTOMER'),
      assignment('STAFF', 'business-1', 'branch-1'),
    ], { workspace: 'CUSTOMER' }, true)).toThrow(UnauthorizedException);
  });

  it('does not infer a Customer role from CustomerProfile', () => {
    expect(() => resolveWorkspaceAssignments([], { workspace: 'CUSTOMER' }, true)).toThrow(UnauthorizedException);
  });

  it('does not fall back to Customer when an operational grant has an invalid scope', () => {
    expect(() => resolveWorkspaceAssignments([
      assignment('CUSTOMER'), assignment('STAFF', 'business-1'),
    ], {}, true)).toThrow(UnauthorizedException);
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
