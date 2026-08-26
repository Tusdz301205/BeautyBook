import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { WaitlistService } from './waitlist.service';

function waitlistPrisma(overlap: boolean) {
  const entry = {
    id: 'wait-1', customerId: 'customer-1', businessId: 'business-1', branchId: 'branch-1', serviceId: 'service-1',
    staffId: null, status: 'WAITING', windowStart: new Date('2030-01-01T08:00:00Z'), windowEnd: new Date('2030-01-01T12:00:00Z'),
  };
  const prisma: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    waitlistEntry: {
      findUnique: jest.fn().mockResolvedValue(entry),
      update: jest.fn().mockImplementation(({ data }) => ({ ...entry, ...data })),
    },
    branchServiceOffering: { findUniqueOrThrow: jest.fn().mockResolvedValue({ durationMinutes: 60 }) },
    bookingService: { findFirst: jest.fn().mockResolvedValue(overlap ? { id: 'busy-item' } : null) },
    customerProfile: { findUniqueOrThrow: jest.fn().mockResolvedValue({ userId: 'customer-user' }) },
    notification: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  prisma.$transaction = jest.fn(async (operation: (tx: any) => unknown) => operation(prisma));
  return prisma;
}

describe('Waitlist offer claiming', () => {
  it('creates one expiring offer with a hashed claim token and slot key', async () => {
    const prisma = waitlistPrisma(false);
    const result = await new WaitlistService(prisma as PrismaService, {} as any).offer('wait-1', 'manager-1', {
      startAt: '2030-01-01T09:00:00Z', staffId: 'staff-1', ttlMinutes: 10,
    });
    expect(result.claimToken).toHaveLength(64);
    expect(prisma.waitlistEntry.update).toHaveBeenCalledWith({ where: { id: 'wait-1' }, data: expect.objectContaining({
      status: 'OFFERED', offerSlotKey: 'branch-1:staff-1:2030-01-01T09:00:00.000Z',
      offerTokenHash: expect.not.stringMatching(result.claimToken),
    }) });
  });

  it('does not offer a slot that conflicts with staff capacity', async () => {
    const prisma = waitlistPrisma(true);
    await expect(new WaitlistService(prisma as PrismaService, {} as any).offer('wait-1', 'manager-1', {
      startAt: '2030-01-01T09:00:00Z', staffId: 'staff-1',
    })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.waitlistEntry.update).not.toHaveBeenCalled();
  });
});
