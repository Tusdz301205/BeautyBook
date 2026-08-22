import { BadRequestException } from '@nestjs/common';
import { CombosService } from './combos.service';

const baseInput = {
  branchId: '11111111-1111-4111-8111-111111111111',
  name: 'Gội + Cắt',
  comboPrice: 350_000,
  staffAssignmentMode: 'SINGLE_PROVIDER' as const,
  services: [
    { serviceId: '22222222-2222-4222-8222-222222222222', quantity: 1, sortOrder: 1, transitionMinutes: 5 },
    { serviceId: '33333333-3333-4333-8333-333333333333', quantity: 1, sortOrder: 0, transitionMinutes: 0 },
  ],
};

describe('CombosService domain validation', () => {
  it('rejects a bundle with fewer than two distinct services', async () => {
    const service = new CombosService({} as any);
    await expect((service as any).validate({
      ...baseInput,
      services: [baseInput.services[0]],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a service outside the selected branch', async () => {
    const prisma = {
      branch: {
        findFirst: jest.fn().mockResolvedValue({
          businessId: 'business-1',
          reviewStatus: 'APPROVED',
          operationalStatus: 'ACTIVE',
        }),
      },
      branchServiceOffering: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: baseInput.services[0].serviceId,
            price: 200_000,
            durationMinutes: 45,
            staffServices: [{ staffId: 'staff-1' }],
          },
        ]),
      },
    };
    const service = new CombosService(prisma as any);
    await expect((service as any).validate(baseInput)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes item order and snapshots price and duration from the server', async () => {
    const prisma = {
      branch: {
        findFirst: jest.fn().mockResolvedValue({
          businessId: 'business-1',
          reviewStatus: 'APPROVED',
          operationalStatus: 'ACTIVE',
        }),
      },
      branchServiceOffering: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: baseInput.services[0].serviceId,
            price: 200_000,
            durationMinutes: 45,
            staffServices: [{ staffId: 'staff-1' }],
          },
          {
            id: baseInput.services[1].serviceId,
            price: 250_000,
            durationMinutes: 60,
            staffServices: [{ staffId: 'staff-1' }],
          },
        ]),
      },
    };
    const service = new CombosService(prisma as any);
    const result = await (service as any).validate(baseInput);
    expect(result.businessId).toBe('business-1');
    expect(result.items).toEqual([
      expect.objectContaining({
        serviceId: baseInput.services[1].serviceId,
        sortOrder: 0,
        priceSnapshot: 250_000,
        durationSnapshot: 60,
      }),
      expect.objectContaining({
        serviceId: baseInput.services[0].serviceId,
        sortOrder: 1,
        transitionMinutes: 5,
        priceSnapshot: 200_000,
        durationSnapshot: 45,
      }),
    ]);
  });

  it('rejects a combo for an inactive branch', async () => {
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new CombosService(prisma as any);
    await expect((service as any).validate(baseInput)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('presents snapshot totals even after a service catalog price changes', () => {
    const service = new CombosService({} as any);
    const result = (service as any).present({
      comboPrice: 350_000,
      comboServices: [
        { quantity: 1, priceSnapshot: 200_000, durationSnapshot: 45, transitionMinutes: 5, service: { price: 900_000, durationMinutes: 90 } },
        { quantity: 1, priceSnapshot: 250_000, durationSnapshot: 60, transitionMinutes: 0, service: { price: 900_000, durationMinutes: 90 } },
      ],
    });
    expect(result.originalPrice).toBe(450_000);
    expect(result.durationMinutes).toBe(110);
    expect(result.savingAmount).toBe(100_000);
  });
});
