import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import { PrivacyCenterService } from './privacy-center.service';
import type { SensitiveDataCipherService } from './sensitive-data-cipher.service';

describe('PrivacyCenterService export isolation', () => {
  test('every exported domain is filtered by the authenticated customer or user', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'customer@example.com',
        }),
      },
      booking: { findMany: jest.fn().mockResolvedValue([]) },
      consultationSubmission: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      sensitiveDataAccessEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      bookingHealthRecord: { findMany: jest.fn().mockResolvedValue([]) },
      review: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { findMany: jest.fn().mockResolvedValue([]) },
      dataSubjectRequest: { findMany: jest.fn().mockResolvedValue([]) },
      marketingPreference: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new PrivacyCenterService(
      prisma,
      { decrypt: jest.fn() } as unknown as SensitiveDataCipherService,
      { get: jest.fn() } as unknown as ConfigService,
    );

    const payload = await (
      service as unknown as {
        buildExportPayload(
          customerId: string,
          userId: string,
        ): Promise<Record<string, unknown>>;
      }
    ).buildExportPayload('customer-1', 'user-1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: 'customer-1' } }),
    );
    expect(prisma.consultationSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: 'customer-1' } }),
    );
    expect(prisma.sensitiveDataAccessEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { submission: { customerId: 'customer-1' } },
      }),
    );
    expect(prisma.bookingHealthRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: 'customer-1' } }),
    );
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: 'customer-1' } }),
    );
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
    expect(prisma.dataSubjectRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: 'customer-1' } }),
    );
    expect(prisma.marketingPreference.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: 'customer-1' } }),
    );
    expect(payload).toMatchObject({
      formatVersion: 'beautybook-privacy-export-v1',
      bookings: [],
      consultationSubmissions: [],
    });
  });
});
