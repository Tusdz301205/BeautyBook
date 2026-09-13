import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { SaveBranchOnboardingDto } from './dto/branch.dto';

const onboardingPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const validateBody = (body: unknown) => onboardingPipe.transform(body, {
  type: 'body',
  metatype: SaveBranchOnboardingDto,
});

function setup() {
  const tx = {
    branch: {
      findFirst: jest.fn().mockResolvedValue({ id: 'branch-1', businessId: 'business-1' }),
      update: jest.fn().mockResolvedValue({ id: 'branch-1' }),
    },
    branchWorkingHour: { deleteMany: jest.fn(), createMany: jest.fn() },
    branchBookingPolicy: { upsert: jest.fn() },
    branchOnboardingProgress: { upsert: jest.fn().mockResolvedValue({ currentStep: 8 }) },
  };
  const prisma = {
    branch: { update: jest.fn() },
    $transaction: jest.fn((callback) => callback(tx)),
  };
  return {
    service: new BranchesService(prisma as any, {} as any, {} as any),
    prisma,
    tx,
  };
}

describe('Branch onboarding settings safety', () => {
  test.each([
    { bookingPolicy: { branchId: 'another-branch' } },
    { bookingPolicy: { branch: { connect: { id: 'another-branch' } } } },
    { bookingPolicy: { confirmedAt: '2026-01-01T00:00:00Z' } },
    { bookingPolicy: { leadTimeMinutes: { increment: 1 } } },
    { branch: { businessId: 'another-business' } },
    { branch: { status: 'ACTIVE', reviewStatus: 'APPROVED' } },
  ])('rejects protected fields and nested database operations: %j', async (payload) => {
    const body = { currentStep: 8, ...payload };
    await expect(validateBody(body)).rejects.toBeInstanceOf(BadRequestException);

    const { service, prisma } = setup();
    await expect(service.saveOnboarding('branch-1', body as any))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.branch.update).not.toHaveBeenCalled();
  });

  test.each([
    { leadTimeMinutes: -1 },
    { bookingHorizonDays: 0 },
    { cancellationHours: 0.5 },
    { rescheduleHours: null },
    { defaultBufferMinutes: 2147483648 },
    { maxOverbookedSlots: 6 },
    { allowWalkIn: 'false' },
    { allowCounterBooking: 'true' },
    { overbookingEnabled: 1 },
  ])('rejects malformed policy values before persisting a branch change: %j', async (bookingPolicy) => {
    const body = { currentStep: 8, branch: { name: 'Valid branch' }, bookingPolicy };
    await expect(validateBody(body)).rejects.toBeInstanceOf(BadRequestException);
    const { service, prisma } = setup();
    await expect(service.saveOnboarding('branch-1', body as any))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test.each([
    [{ dayOfWeek: 1, openTime: '24:00', closeTime: '25:00' }],
    [{ dayOfWeek: 1, openTime: '09:00', closeTime: '08:00' }],
    [{ dayOfWeek: 1, openTime: '09:00', closeTime: '09:00' }],
    [
      { dayOfWeek: 1, openTime: '09:00', closeTime: '18:00' },
      { dayOfWeek: 1, openTime: '10:00', closeTime: '18:00' },
    ],
  ])('rejects invalid or duplicate opening hours before any write: %j', async (...workingHours) => {
    const { service, prisma } = setup();
    await expect(service.saveOnboarding('branch-1', {
      currentStep: 4,
      branch: { name: 'Valid branch' },
      workingHours,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('accepts current frontend fields and writes only the authorized branch inside one transaction', async () => {
    const bookingPolicy = {
      leadTimeMinutes: 120,
      bookingHorizonDays: 90,
      cancellationHours: 24,
      rescheduleHours: 12,
      noShowHandling: 'Liên hệ khách khi khách không đến.',
      earlyCheckInMinutes: 0,
      gracePeriodMinutes: 10,
      allowWalkIn: false,
      allowCounterBooking: false,
      defaultBufferMinutes: 0,
      overbookingEnabled: true,
      maxOverbookedSlots: 2,
    };
    const body = await validateBody({
      currentStep: 8,
      completedSteps: [1, 2, 3, 4, 8],
      branch: {
        name: 'Chi nhánh mới',
        serviceMode: 'AT_LOCATION',
        serviceAreas: [],
        excludedServiceAreas: [],
        serviceRadiusKm: 10,
        travelFee: 0,
        timezone: 'Asia/Ho_Chi_Minh',
        bookingConfirmationMode: 'MANUAL_CONFIRMATION',
        staffAssignmentMode: 'AUTO_ASSIGN_IF_ANY_STAFF',
        pendingHoldMinutes: 30,
      },
      draftData: { wizardVersion: 2, serviceAreas: '', excludedServiceAreas: '' },
      workingHours: [{ dayOfWeek: 0, openTime: '09:00', closeTime: '18:00', isClosed: false }],
      bookingPolicy,
    });
    const { service, prisma, tx } = setup();
    await service.saveOnboarding('branch-1', body);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.branch.update).not.toHaveBeenCalled();
    expect(tx.branch.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'branch-1' } }));
    expect(tx.branchBookingPolicy.upsert).toHaveBeenCalledWith({
      where: { branchId: 'branch-1' },
      create: { branchId: 'branch-1', ...bookingPolicy, confirmedAt: expect.any(Date) },
      update: { ...bookingPolicy, confirmedAt: expect.any(Date) },
    });
    expect(tx.branchWorkingHour.createMany).toHaveBeenCalledWith({
      data: [{
        branchId: 'branch-1', dayOfWeek: 0,
        openTime: new Date('1970-01-01T09:00:00Z'),
        closeTime: new Date('1970-01-01T18:00:00Z'),
        isClosed: false,
      }],
    });
  });

  test('propagates a policy write failure from the shared onboarding transaction', async () => {
    const { service, prisma, tx } = setup();
    tx.branchBookingPolicy.upsert.mockRejectedValue(new Error('database unavailable'));

    await expect(service.saveOnboarding('branch-1', {
      currentStep: 8,
      branch: { name: 'Chi nhánh mới' },
      bookingPolicy: { allowWalkIn: false },
    })).rejects.toThrow('database unavailable');
    expect(prisma.branch.update).not.toHaveBeenCalled();
    expect(tx.branchOnboardingProgress.upsert).not.toHaveBeenCalled();
  });
});
