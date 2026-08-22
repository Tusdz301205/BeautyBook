import { SetMetadata } from '@nestjs/common';

export const REQUIRES_PERMISSION_KEY = 'requires_permission';

/**
 * Apply to a controller method that needs a specific permission code,
 * e.g. `@RequirePermission('booking:cancel:platform')`. The PolicyGuard
 * (paired via `@UseGuards(PolicyGuard)`) calls `policy.ts#can` at runtime.
 */
export const RequirePermission = (...codes: string[]) =>
  SetMetadata(REQUIRES_PERMISSION_KEY, codes);
