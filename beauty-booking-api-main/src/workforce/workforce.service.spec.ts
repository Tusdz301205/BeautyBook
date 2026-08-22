import { ConflictException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { WorkforceService } from './workforce.service';

const OWNER: AuthUser = {
  id: 'owner-1',
  email: 'owner@example.com',
  roles: ['BUSINESS_OWNER'],
  permissions: [
    'timesheet:review:tenant',
    'compensation:manage:tenant',
    'pay_run:manage:tenant',
  ],
  scopes: [{ code: 'BUSINESS_OWNER', businessId: 'business-1', branchId: null }],
  sessionType: 'salon',
};

describe('WorkforceService invariants', () => {
  test('raw timesheet sums multi-range shifts without counting the gap', async () => {
    const upsert = jest.fn().mockImplementation(({ create }) => create);
    const prisma: any = {
      staffAttendance: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'attendance-1',
          businessId: 'business-1',
          branchId: 'branch-1',
          staffId: 'staff-1',
          workDate: new Date('2026-07-20T00:00:00.000Z'),
          scheduledStartTime: new Date('1970-01-01T09:00:00.000Z'),
          scheduledEndTime: new Date('1970-01-01T19:00:00.000Z'),
          scheduleSnapshot: {
            segments: [
              {
                startTime: '1970-01-01T09:00:00.000Z',
                endTime: '1970-01-01T12:00:00.000Z',
                roleCode: 'RECEPTIONIST',
              },
              {
                startTime: '1970-01-01T13:00:00.000Z',
                endTime: '1970-01-01T19:00:00.000Z',
                roleCode: 'STAFF',
              },
            ],
          },
          checkInAt: new Date('2026-07-20T09:00:00.000Z'),
          checkOutAt: new Date('2026-07-20T19:00:00.000Z'),
        }),
      },
      attendanceEvent: { findMany: jest.fn().mockResolvedValue([]) },
      timesheet: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert,
      },
    };

    await new WorkforceService(prisma).syncTimesheet('attendance-1');

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        scheduledMinutes: 540,
        actualWorkedMinutes: 600,
      }),
    }));
  });

  test('archived historical rule still calculates the correct role-scoped rate', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'entry-1' });
    const prisma: any = {
      compensationAssignment: {
        findMany: jest.fn().mockResolvedValue([{
          staffId: 'staff-1',
          branchId: 'branch-1',
          roleCode: 'STAFF',
          effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
          effectiveTo: null,
          rule: {
            id: 'rule-1',
            businessId: 'business-1',
            type: 'HOURLY_WAGE',
            status: 'ARCHIVED',
            version: 1,
            rate: 60_000,
            effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
            effectiveTo: new Date('2026-07-31T00:00:00.000Z'),
          },
        }]),
      },
      timesheet: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'timesheet-1',
          staffId: 'staff-1',
          branchId: 'branch-1',
          status: 'APPROVED',
          approvedPaidMinutes: 480,
          approvedBreakdown: null,
          workDate: new Date('2026-07-20T00:00:00.000Z'),
          attendance: {
            scheduleSnapshot: {
              segments: [
                { startTime: '1970-01-01T08:00:00.000Z', endTime: '1970-01-01T12:00:00.000Z', roleCode: 'RECEPTIONIST' },
                { startTime: '1970-01-01T13:00:00.000Z', endTime: '1970-01-01T19:00:00.000Z', roleCode: 'STAFF' },
              ],
            },
          },
        }]),
      },
      bookingService: { findMany: jest.fn().mockResolvedValue([]) },
      compensationEntry: { upsert },
    };

    await new WorkforceService(prisma).calculateCompensation(OWNER, {
      businessId: 'business-1',
      from: '2026-07-01',
      to: '2026-07-31',
    });

    expect(prisma.compensationAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          rule: expect.objectContaining({ status: { in: ['ACTIVE', 'ARCHIVED'] } }),
        }),
      }),
    );
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        amount: 288_000,
        calculationSnapshot: expect.objectContaining({
          ruleVersion: 1,
          roleCode: 'STAFF',
          approvedPaidMinutes: 288,
        }),
      }),
    }));
  });

  test('locked pay run cannot be silently reopened', async () => {
    const prisma: any = {
      payRun: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pay-run-1',
          businessId: 'business-1',
          status: 'LOCKED',
        }),
      },
    };

    await expect(new WorkforceService(prisma).transitionPayRun(
      OWNER,
      'pay-run-1',
      { status: 'APPROVED', reason: 'reopen silently' },
    )).rejects.toBeInstanceOf(ConflictException);
  });
});
