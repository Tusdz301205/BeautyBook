import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export function prismaErrorCode(error: unknown): string | null {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
}

function isDatabaseConflict(error: unknown): boolean {
  const code = prismaErrorCode(error);
  if (code === 'P2002') return true;
  if (!error || typeof error !== 'object') return false;

  const candidate = error as {
    message?: unknown;
    code?: unknown;
    meta?: { code?: unknown; constraint?: unknown; driverAdapterError?: unknown };
  };
  const details = [
    candidate.message,
    candidate.code,
    candidate.meta?.code,
    candidate.meta?.constraint,
    candidate.meta?.driverAdapterError,
  ]
    .map((value) => String(value ?? ''))
    .join(' ');

  return (
    details.includes('23P01') ||
    details.includes('booking_services_staff_slot_no_overlap')
  );
}

export async function withSerializableTransaction<T>(
  prisma: PrismaService,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { maxRetries?: number; conflictMessage?: string } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      if (isDatabaseConflict(error)) {
        throw new ConflictException(
          options.conflictMessage ??
            'Dá»¯ liá»‡u vá»«a Ä‘Æ°á»£c thay Ä‘á»•i bá»Ÿi yÃªu cáº§u khÃ¡c, vui lÃ²ng thá»­ láº¡i',
        );
      }
      if (prismaErrorCode(error) !== 'P2034') throw error;
      if (attempt === maxRetries) {
        throw new ConflictException(
          options.conflictMessage ??
            'Dữ liệu vừa được thay đổi bởi yêu cầu khác, vui lòng thử lại',
        );
      }
      // Short bounded jitter reduces immediate retry collisions. Never retry
      // external provider calls inside this helper.
      await new Promise((resolve) => setTimeout(resolve, 10 + Math.floor(Math.random() * 20)));
    }
  }
  throw new ConflictException(options.conflictMessage ?? 'Transaction conflict');
}
