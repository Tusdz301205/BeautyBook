import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { AttendanceService } from './attendance.service';

const USER: AuthUser = {
  id: 'user-1', email: 'staff@example.com', roles: ['STAFF'], permissions: ['attendance:checkin:self'],
  scopes: [{ code: 'STAFF', businessId: 'business-1', branchId: 'branch-1' }], sessionType: 'salon',
};

const policy = {
  attendanceQrTtlSeconds: 30, checkInEarlyWindowMinutes: 30, lateGraceMinutes: 10,
  checkOutEarlyGraceMinutes: 5, overtimeGraceMinutes: 15,
};

function createService(prisma: any = {}) {
  let issuedToken: any;
  const merged: any = {
    ...prisma,
    attendanceQrToken: {
      create: jest.fn(async ({ data }) => { issuedToken = data; return data; }),
      findUnique: jest.fn(async () => issuedToken),
      ...(prisma.attendanceQrToken || {}),
    },
    attendanceQrUse: { create: jest.fn().mockResolvedValue({ id: 'qr-use-1' }), ...(prisma.attendanceQrUse || {}) },
    attendanceEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1' }), ...(prisma.attendanceEvent || {}) },
  };
  merged.$transaction = prisma.$transaction || jest.fn(async (callback) => callback(merged));
  const service = new AttendanceService(
    merged,
    { get: () => 'attendance-test-secret' } as any,
    { getEffective: jest.fn().mockResolvedValue(policy) } as any,
    {} as any,
    { create: jest.fn(), createBulk: jest.fn() } as any,
  );
  jest.spyOn(service, 'boardContext').mockResolvedValue({
    id: 'branch-1', businessId: 'business-1', name: 'Chi nhánh 1', status: 'ACTIVE', business: { name: 'Beauty' },
  } as any);
  return service;
}

function activeStaff(branchId = 'branch-1') {
  return { id: 'staff-1', userId: USER.id, branchId, status: 'ACTIVE', deletedAt: null, fullName: 'Nhân viên', branch: { id: branchId, businessId: 'business-1', name: 'Chi nhánh' } };
}

describe('AttendanceService QR workflow', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-07-17T10:00:00.000Z')); });
  afterEach(() => jest.useRealTimers());

  it('rejects an expired dynamic QR token', async () => {
    const service = createService();
    const qr = await service.generateQr(USER, 'branch-1');
    jest.setSystemTime(new Date('2026-07-17T10:00:31.000Z'));
    expect(() => service.verifyToken(qr.token, 'CHECK_IN')).toThrow(BadRequestException);
  });

  it('rejects a QR from another branch', async () => {
    const prisma = { staffProfile: { findUnique: jest.fn().mockResolvedValue(activeStaff('branch-2')) } };
    const service = createService(prisma);
    const qr = await service.generateQr(USER, 'branch-1');
    await expect(service.checkIn(USER, qr.token)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects normal check-in when there is no shift today', async () => {
    const prisma = {
      staffProfile: { findUnique: jest.fn().mockResolvedValue(activeStaff()) },
      specialWorkingDay: { findFirst: jest.fn().mockResolvedValue(null) },
      staffWorkingHour: { findUnique: jest.fn().mockResolvedValue(null) },
      branchHoliday: { findFirst: jest.fn().mockResolvedValue(null) },
      staffLeave: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = createService(prisma);
    const qr = await service.generateQr(USER, 'branch-1');
    await expect(service.checkIn(USER, qr.token)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a QR attendance record for a valid shift', async () => {
    jest.setSystemTime(new Date('2026-07-17T11:00:00.000Z'));
    const attendance = { id: 'attendance-1', status: 'LATE', checkInMethod: 'QR' };
    const prisma = {
      staffProfile: { findUnique: jest.fn().mockResolvedValue(activeStaff()) },
      specialWorkingDay: { findFirst: jest.fn().mockResolvedValue(null) },
      staffWorkingHour: { findUnique: jest.fn().mockResolvedValue({ isOff: false, startTime: new Date('1970-01-01T10:00:00.000Z'), endTime: new Date('1970-01-01T01:00:00.000Z') }) },
      branchHoliday: { findFirst: jest.fn().mockResolvedValue(null) }, staffLeave: { findFirst: jest.fn().mockResolvedValue(null) },
      staffAttendance: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue(attendance) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = createService(prisma);
    const qr = await service.generateQr(USER, 'branch-1');
    await expect(service.checkIn(USER, qr.token)).resolves.toEqual(attendance);
    expect(prisma.staffAttendance.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ checkInMethod: 'QR', lateMinutes: 60 }) }));
  });

  it('rejects replay of the same QR, staff and action', async () => {
    const replay = new Prisma.PrismaClientKnownRequestError('duplicate QR use', {
      code: 'P2002',
      clientVersion: '7.8.0',
    });
    const prisma = {
      staffProfile: { findUnique: jest.fn().mockResolvedValue(activeStaff()) },
      specialWorkingDay: { findFirst: jest.fn().mockResolvedValue(null) },
      staffWorkingHour: { findUnique: jest.fn().mockResolvedValue({ isOff: false, startTime: new Date('1970-01-01T09:00:00.000Z'), endTime: new Date('1970-01-01T18:00:00.000Z') }) },
      branchHoliday: { findFirst: jest.fn().mockResolvedValue(null) },
      staffLeave: { findFirst: jest.fn().mockResolvedValue(null) },
      staffAttendance: { findUnique: jest.fn().mockResolvedValue(null) },
      attendanceQrUse: { create: jest.fn().mockRejectedValue(replay) },
    };
    const service = createService(prisma);
    const qr = await service.generateQr(USER, 'branch-1');
    await expect(service.checkIn(USER, qr.token)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects check-out before check-in', async () => {
    const prisma = {
      staffProfile: { findUnique: jest.fn().mockResolvedValue(activeStaff()) },
      specialWorkingDay: { findFirst: jest.fn().mockResolvedValue(null) },
      staffWorkingHour: { findUnique: jest.fn().mockResolvedValue({ isOff: false, startTime: new Date('1970-01-01T09:00:00.000Z'), endTime: new Date('1970-01-01T18:00:00.000Z') }) },
      branchHoliday: { findFirst: jest.fn().mockResolvedValue(null) }, staffLeave: { findFirst: jest.fn().mockResolvedValue(null) },
      staffAttendance: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = createService(prisma);
    const qr = await service.generateQr(USER, 'branch-1');
    await expect(service.checkOut(USER, qr.token)).rejects.toBeInstanceOf(ConflictException);
  });
});
