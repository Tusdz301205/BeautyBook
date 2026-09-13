import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { CancellationPoliciesService } from './cancellation-policies.service';
import {
  MAX_CANCELLATION_POLICY_HOURS,
  MAX_CANCELLATION_POLICY_NOTES_LENGTH,
  UpdateCancellationPolicyDto,
} from './dto/cancellation-policy.dto';

const policyPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const validateBody = (body: unknown) => policyPipe.transform(body, {
  type: 'body',
  metatype: UpdateCancellationPolicyDto,
});

function setup() {
  const policy = {
    id: 'policy-1',
    businessId: 'business-1',
    freeCancelHours: 2,
    rescheduleAllowedHours: 1,
    notes: null,
    lateCancelFeePercent: 50,
    noShowFeePercent: 100,
  };
  const prisma = {
    cancellationPolicy: {
      findUnique: jest.fn().mockResolvedValue(policy),
      create: jest.fn().mockResolvedValue(policy),
      upsert: jest.fn().mockImplementation(async ({ update }) => ({ ...policy, ...update })),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return { prisma, service: new CancellationPoliciesService(prisma as any) };
}

async function expectRejectedWithoutPersistence(body: unknown) {
  await expect(validateBody(body)).rejects.toBeInstanceOf(BadRequestException);
  const { service, prisma } = setup();
  await expect(service.update('business-1', 'owner-1', body as any))
    .rejects.toBeInstanceOf(BadRequestException);
  expect(prisma.cancellationPolicy.findUnique).not.toHaveBeenCalled();
  expect(prisma.cancellationPolicy.upsert).not.toHaveBeenCalled();
  expect(prisma.auditLog.create).not.toHaveBeenCalled();
}

describe('Cancellation policy validation', () => {
  it('uses the validated DTO on the API endpoint', () => {
    const parameterTypes = Reflect.getMetadata('design:paramtypes', BusinessController.prototype, 'updatePolicy');
    expect(parameterTypes[1]).toBe(UpdateCancellationPolicyDto);
  });

  describe.each(['freeCancelHours', 'rescheduleAllowedHours'])('%s', (field) => {
    test.each([
      -1,
      0.5,
      '2',
      '',
      NaN,
      Infinity,
      -Infinity,
      MAX_CANCELLATION_POLICY_HOURS + 1,
      null,
      true,
      [],
      { increment: 1 },
    ])('rejects invalid hours %j without database writes', async (value) => {
      await expectRejectedWithoutPersistence({ [field]: value });
    });

    test.each([0, 1, MAX_CANCELLATION_POLICY_HOURS])('accepts integer hours %i', async (value) => {
      const body = await validateBody({ [field]: value });
      const { service, prisma } = setup();
      await service.update('business-1', 'owner-1', body);
      expect(prisma.cancellationPolicy.upsert).toHaveBeenCalledWith({
        where: { businessId: 'business-1' },
        create: { businessId: 'business-1', [field]: value },
        update: { [field]: value },
      });
    });
  });

  test.each([
    { id: 'other-policy' },
    { businessId: 'other-business' },
    { business: { connect: { id: 'other-business' } } },
    { updatedBy: 'other-owner' },
    { createdAt: '2026-01-01T00:00:00Z' },
    { updatedAt: '2026-01-01T00:00:00Z' },
    { lateCancelFeePercent: 10 },
    { noShowFeePercent: 10 },
    { unknownSetting: true },
  ])('rejects protected, retired, or unknown fields: %j', async (extra) => {
    await expectRejectedWithoutPersistence({ freeCancelHours: 2, ...extra });
  });

  test.each([
    10,
    false,
    [],
    { set: 'replacement' },
    'a'.repeat(MAX_CANCELLATION_POLICY_NOTES_LENGTH + 1),
    'before\u0000after',
  ])('rejects malformed notes case %#', async (notes) => {
    await expectRejectedWithoutPersistence({ notes });
  });

  test.each([null, '', 'Liên hệ salon để đổi lịch.\nCảm ơn!', 'a'.repeat(MAX_CANCELLATION_POLICY_NOTES_LENGTH)])(
    'accepts and preserves safe notes case %#',
    async (notes) => {
      const body = await validateBody({ notes });
      const { service, prisma } = setup();
      await service.update('business-1', 'owner-1', body);
      expect(prisma.cancellationPolicy.upsert).toHaveBeenCalledWith({
        where: { businessId: 'business-1' },
        create: { businessId: 'business-1', notes },
        update: { notes },
      });
    },
  );

  test.each([null, undefined, [], 'policy', 1, true])('rejects non-object input at the service boundary: %j', async (body) => {
    const { service, prisma } = setup();
    await expect(service.update('business-1', 'owner-1', body as any))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.cancellationPolicy.findUnique).not.toHaveBeenCalled();
    expect(prisma.cancellationPolicy.upsert).not.toHaveBeenCalled();
  });

  it('keeps omitted fields unchanged, retains legacy fee data privately, and audits the actor', async () => {
    const { service, prisma } = setup();
    const after = await service.update('business-1', 'owner-1', { freeCancelHours: 0 });
    expect(after).toEqual({
      id: 'policy-1', businessId: 'business-1', freeCancelHours: 0,
      rescheduleAllowedHours: 1, notes: null,
    });
    expect(prisma.cancellationPolicy.upsert).toHaveBeenCalledWith({
      where: { businessId: 'business-1' },
      create: { businessId: 'business-1', freeCancelHours: 0 },
      update: { freeCancelHours: 0 },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'owner-1', entityId: 'policy-1', action: 'POLICY_OVERRIDE' }),
    });
    expect(await service.getOrCreate('business-1')).not.toHaveProperty('lateCancelFeePercent');
    expect(await service.getOrCreate('business-1')).not.toHaveProperty('noShowFeePercent');
  });
});
