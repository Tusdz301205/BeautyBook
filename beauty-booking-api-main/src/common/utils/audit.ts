import { PrismaService } from '../../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

/**
 * Ghi audit log cho mọi can thiệp trực tiếp của admin (ép hủy, hoàn tiền ngoài chính sách,
 * leo thang, ghi đè policy). Lưu oldData + newData để truy vết trách nhiệm.
 *
 * KHÔNG throw nếu ghi log lỗi — không được vì audit fail mà chặn thao tác nghiệp vụ.
 *
 * For automatic logging via interceptor + decorator, see
 *   - `@Audited({...})` from `common/decorators/audit.decorator`
 *   - `AuditInterceptor` from `common/interceptors/audit.interceptor`
 *
 * This helper is for service-layer audit writes that need precise control
 * (e.g. capturing before/after JSON of a specific row).
 */
export async function auditLog(
  prisma: PrismaService,
  params: {
    userId: string | null;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    oldData?: unknown;
    newData?: unknown;
    reason?: string;
  },
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        oldData: params.oldData as any,
        newData: params.newData as any,
        reason: params.reason,
      },
    });
  } catch {
    // eslint-disable-next-line no-console
    // Prisma errors can echo field values; never print the raw error here.
    console.error('[auditLog] write failed');
  }
}
