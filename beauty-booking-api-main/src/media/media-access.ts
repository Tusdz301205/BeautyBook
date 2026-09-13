import type { AuthUser } from '../common/decorators/current-user.decorator';
import { can } from '../common/utils/policy';

export interface MediaAccessRecord {
  uploadedBy: string | null;
  businessId: string | null;
  branchId: string | null;
  visibility: string;
}

export function canAccessStoredMedia(user: AuthUser, media: MediaAccessRecord, action: 'read' | 'delete'): boolean {
  const context = { tenantId: media.businessId ?? undefined, branchId: media.branchId ?? undefined };
  const personal = !media.businessId && !media.branchId;
  const currentScope = personal
    ? media.uploadedBy === user.id
    : media.branchId
      ? can(user, 'branch:read:branch', context) || can(user, 'branch:read:tenant', context)
      : can(user, 'business:update:tenant', context);
  if (media.visibility === 'PRIVATE') {
    // Upload attribution is historical; it cannot preserve access after the
    // uploader leaves the company or loses their branch assignment.
    return (media.uploadedBy === user.id && currentScope) ||
      can(user, `legal_document:${action}:platform`, context) ||
      (!personal && can(user, `legal_document:${action}:tenant`, context));
  }
  if (user.roles.includes('PLATFORM_ADMIN')) return true;
  return currentScope;
}
