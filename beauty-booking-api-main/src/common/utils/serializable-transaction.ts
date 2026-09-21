import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export function prismaErrorCode(error: unknown): string | null {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
}

function structuredDatabaseValue(
  error: unknown,
  key: 'originalCode' | 'constraint',
  seen = new Set<object>(),
): string | null {
  if (!error || typeof error !== 'object' || seen.has(error)) return null;
  seen.add(error);

  const record = error as Record<string, unknown>;
  const direct = record[key];
  if (typeof direct === 'string') return direct;

  for (const nestedKey of ['cause', 'meta', 'driverAdapterError', 'originalError']) {
    const nested = structuredDatabaseValue(record[nestedKey], key, seen);
    if (nested) return nested;
  }
  return null;
}

function isRetryableTransactionConflict(error: unknown): boolean {
  const code = prismaErrorCode(error);
  if (code === 'P2034') return true;
  if (code !== 'P2010') return false;
  // Prisma's PostgreSQL adapter wraps SELECT ... FOR UPDATE conflicts as
  // P2010, not P2034. Match structured SQLSTATE only, never message text.
  const meta = (error as Prisma.PrismaClientKnownRequestError).meta as {
    code?: string;
    driverAdapterError?: { cause?: { originalCode?: string; kind?: string } };
  } | undefined;
  const sqlState = meta?.code ?? meta?.driverAdapterError?.cause?.originalCode;
  return sqlState === '40001' || sqlState === '40P01';
}

function isDatabaseConflict(error: unknown): boolean {
  const code = prismaErrorCode(error);
  if (code === 'P2002') return true;
  return (
    structuredDatabaseValue(error, 'originalCode') === '23P01' ||
    structuredDatabaseValue(error, 'constraint') ===
      'booking_services_staff_slot_no_overlap'
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
            'Dữ liệu vừa được thay đổi bởi yêu cầu khác, vui lòng thử lại',
        );
      }
      if (!isRetryableTransactionConflict(error)) throw error;
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
