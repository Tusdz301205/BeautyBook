import { SetMetadata } from '@nestjs/common';

export const REQUIRES_PERMISSION_KEY = 'requires_permission';
export const ACTUAL_TIME_DELEGATION_KEY = 'actual_time:delegation';
export const ActualTimeDelegation = () => SetMetadata(ACTUAL_TIME_DELEGATION_KEY, true);

/**
 * Apply to a controller method that needs a specific permission code,
 * e.g. `@RequirePermission('booking:cancel:platform')`. The PolicyGuard
 * (paired via `@UseGuards(PolicyGuard)`) calls `policy.ts#can` at runtime.
 */
export const RequirePermission = (...codes: string[]) =>
  SetMetadata(REQUIRES_PERMISSION_KEY, codes);
