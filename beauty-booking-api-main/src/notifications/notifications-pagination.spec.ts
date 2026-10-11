import { BadRequestException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

describe('notification pagination boundaries and isolation', () => {
  const user = { id: 'own-user' } as AuthUser;
  it.each(['NaN', '0', '-1', '1.5', '2abc', '', '100001', '9007199254740993'])('rejects invalid page before service: %s', (page) => {
    const findByUser = jest.fn();
    const controller = new NotificationsController({ findByUser } as unknown as NotificationsService);
    expect(() => controller.findMy(user, page)).toThrow(BadRequestException);
    expect(findByUser).not.toHaveBeenCalled();
  });
  it.each(['0', '-2', '1.5', '101', '20abc', ''])('rejects invalid limit before service: %s', (limit) => {
    const findByUser = jest.fn();
    const controller = new NotificationsController({ findByUser } as unknown as NotificationsService);
    expect(() => controller.findMy(user, '1', limit)).toThrow(BadRequestException);
    expect(findByUser).not.toHaveBeenCalled();
  });
  it('uses defaults and preserves authenticated account scope', () => {
    const findByUser = jest.fn();
    const controller = new NotificationsController({ findByUser } as unknown as NotificationsService);
    controller.findMy(user);
    expect(findByUser).toHaveBeenCalledWith('own-user', expect.objectContaining({ page: 1, limit: 20 }));
  });
  it('applies stable ordering, bounded pagination and account isolation', async () => {
    const prisma = { notification: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    const service = new NotificationsService(prisma as never);
    await service.findByUser('own-user', { page: 2, limit: 100, state: 'unread' });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'own-user', isRead: false }, take: 100, skip: 100, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }));
  });
  it('rejects invalid options even when called without controller', async () => {
    const prisma = { notification: { findMany: jest.fn() } };
    const service = new NotificationsService(prisma as never);
    for (const options of [{ page: NaN }, { limit: -1 }, { state: 'invalid' }, { type: 'invalid' }, { severity: 'invalid' }]) {
      await expect(service.findByUser('own-user', options as never)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });
});
