import { BadRequestException, ConflictException } from '@nestjs/common';
import { StaffService } from './staff.service';

const owner = {
  id: 'owner-1',
  email: 'owner@example.com',
  roles: ['BUSINESS_OWNER'],
  permissions: ['staff_schedule:manage:branch'],
  scopes: [],
};

const selfManager = {
  id: 'staff-user-1',
  email: 'staff@example.com',
  roles: ['STAFF'],
  permissions: ['staff_schedule:manage:self'],
  scopes: [],
};

describe('StaffService schedule versioning', () => {
  test('accepts multiple non-overlapping time ranges and writes a new immutable version', async () => {
    const created = {
      id: 'version-2',
      staffId: 'staff-1',
      branchId: 'branch-1',
      version: 2,
      segments: [{ id: 'segment-1' }, { id: 'segment-2' }],
    };
    const tx = {
      staffScheduleVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'version-1',
          version: 1,
          effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
        }),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue(created),
      },
      staffWorkingHour: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      staffProfile: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'staff-1',
          userId: 'staff-user-1',
          branchId: 'branch-1',
        }),
      },
      branchWorkingHour: {
        findMany: jest.fn().mockResolvedValue([
          {
            dayOfWeek: 2,
            openTime: new Date('1970-01-01T08:00:00.000Z'),
            closeTime: new Date('1970-01-01T20:00:00.000Z'),
            isClosed: false,
          },
        ]),
      },
      booking: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new StaffService(prisma as any, {} as any);

    const result = await service.saveScheduleVersion('staff-1', {
      branchId: 'branch-1',
      effectiveFrom: '2026-08-01',
      segments: [
        { dayOfWeek: 2, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 2, startTime: '13:00', endTime: '19:00' },
      ],
    }, owner as any);

    expect(result).toMatchObject({ id: 'version-2', version: 2 });
    expect(tx.staffScheduleVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        version: 2,
        segments: {
          create: expect.arrayContaining([
            expect.objectContaining({ dayOfWeek: 2 }),
            expect.objectContaining({ dayOfWeek: 2 }),
          ]),
        },
      }),
    }));
    expect(tx.staffScheduleVersion.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'version-1' },
    }));
  });

  test('rejects overlapping ranges before writing data', async () => {
    const service = new StaffService({} as any, {} as any);
    await expect(service.saveScheduleVersion('staff-1', {
      branchId: 'branch-1',
      effectiveFrom: '2026-08-01',
      segments: [
        { dayOfWeek: 2, startTime: '09:00', endTime: '13:00' },
        { dayOfWeek: 2, startTime: '12:00', endTime: '19:00' },
      ],
    }, owner as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  test('never lets a self-managed staff override an impacted future booking', async () => {
    const prisma = {
      staffProfile: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'staff-1',
          userId: 'staff-user-1',
          branchId: 'branch-1',
        }),
      },
      branchWorkingHour: {
        findMany: jest.fn().mockResolvedValue([
          {
            dayOfWeek: 2,
            openTime: new Date('1970-01-01T08:00:00.000Z'),
            closeTime: new Date('1970-01-01T20:00:00.000Z'),
            isClosed: false,
          },
        ]),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'booking-1',
            bookingCode: 'BB-2026-00001',
            appointmentDate: new Date('2026-08-04T00:00:00.000Z'),
            appointmentStartTime: new Date('1970-01-01T18:00:00.000Z'),
            appointmentEndTime: new Date('1970-01-01T19:00:00.000Z'),
            status: 'CONFIRMED',
          },
        ]),
      },
    };
    const service = new StaffService(prisma as any, {} as any);

    await expect(service.saveScheduleVersion('staff-1', {
      branchId: 'branch-1',
      effectiveFrom: '2026-08-01',
      acknowledgeImpact: true,
      segments: [{ dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }],
    }, selfManager as any)).rejects.toBeInstanceOf(ConflictException);
  });

  test('creates a staff change request without mutating the schedule', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'request-1', status: 'PENDING' });
    const prisma = {
      staffProfile: {
        findFirst: jest.fn().mockResolvedValue({ id: 'staff-1', userId: 'staff-user-1' }),
      },
      staffScheduleChangeRequest: { create },
    };
    const service = new StaffService(prisma as any, {} as any);

    await expect(service.requestScheduleChange('staff-1', {
      branchId: 'branch-1',
      type: 'SINGLE_DAY',
      effectiveFrom: '2026-08-04',
      proposedData: { note: 'Bắt đầu muộn hơn' },
      reason: 'Có lịch khám',
    }, selfManager as any)).resolves.toMatchObject({ status: 'PENDING' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        staffId: 'staff-1',
        requestedBy: 'staff-user-1',
        type: 'SINGLE_DAY',
      }),
    }));
  });
});
