import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audited_action';

/**
 * Mark a controller method for automatic audit logging.
 *
 * Usage:
 *   @Audited({ action: AuditAction.FORCE_CANCEL, entityType: 'Booking' })
 *   @Delete('bookings/:id')
 *   forceCancel() { ... }
 *
 * The AuditInterceptor resolves `entityId` from route params (default: 'id')
 * and records before/after JSON if available.
 */
export interface AuditSpec {
  action: string;
  entityType: string;
  /** Route param that holds the entity id. Defaults to 'id'. */
  idParam?: string;
  /** Optional reason / note for the audit row. */
  note?: string;
}
export const Audited = (spec: AuditSpec) => SetMetadata(AUDIT_KEY, spec);
