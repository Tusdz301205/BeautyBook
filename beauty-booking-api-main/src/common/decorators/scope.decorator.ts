import { SetMetadata } from '@nestjs/common';

export const SCOPE_KEY = 'rbac:scope';
/** @deprecated Use SCOPE_KEY. Kept for older tests and integrations. */
export const SCOPES_KEY = SCOPE_KEY;

/**
 * Coarse-grained scope guard metadata.
 *
 * Two equivalent shapes are supported:
 *
 *   // NEW (preferred) — declaratively describe the required scope.
 *   @RequireScope({ level: 'TENANT', tenantIdParam: 'businessId' })
 *   @RequireScope({ level: 'BRANCH', tenantIdParam: 'businessId',
 *                   branchIdParam: 'branchId' })
 *
 *   // BACK-COMPAT — explicit allow-list of roles + optional permission
 *   // codes + scope level for the early-pass short-circuit.
 *   @RequireScope({ roles: ['OWNER', 'BRANCH_MANAGER'],
 *                   scopeLevel: 'branch',
 *                   permissions: ['booking:read:branch'] })
 */
export interface ScopeRequirement {
  // --- NEW shape ---
  /** Required scope level. */
  level?: 'PLATFORM' | 'TENANT' | 'BRANCH' | 'SELF' | 'PUBLIC';
  /** Route param name carrying the tenant (business) id. */
  tenantIdParam?: string;
  /** Route param name carrying the branch id. */
  branchIdParam?: string;
  /** Optional explicit tenant/branch id values (overrides param lookup). */
  tenantId?: string;
  branchId?: string;

  // --- BACK-COMPAT shape ---
  /** Allowed role codes (early-pass short-circuit). */
  roles?: string[];
  /** Scope level for the back-compat path. */
  scopeLevel?: 'platform' | 'tenant' | 'branch' | 'self';
  /** Permission codes required (any-of pass). */
  permissions?: string[];
}

export const RequireScope = (requirement: ScopeRequirement) =>
  SetMetadata(SCOPE_KEY, requirement);
