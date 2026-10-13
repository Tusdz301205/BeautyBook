import { NotificationsService } from './notifications.service';

describe('review report notice presentation and search', () => {
  test('shows human impact deadline labels while preserving the historical stored reason and target', async () => {
    const stored = { id: 'impact-notice', userId: 'own-user', type: 'SYSTEM', targetType: 'OPERATIONAL_IMPACT',
      title: 'Hồ sơ lịch bị ảnh hưởng đã quá hạn', body: 'BRANCH · PAUSE: Lý do riêng\nBRANCH · PAUSE giữ trong ghi chú', targetId: 'case-id' };
    const prisma = { notification: { findMany: jest.fn().mockResolvedValue([stored]), count: jest.fn().mockResolvedValue(1) } };
    const result = await new NotificationsService(prisma as never).findByUser('own-user');
    expect(result.data[0].body).toBe('Chi nhánh — Tạm ngừng hoạt động: Lý do riêng\nBRANCH · PAUSE giữ trong ghi chú');
    expect(stored.body).toBe('BRANCH · PAUSE: Lý do riêng\nBRANCH · PAUSE giữ trong ghi chú');
    expect(result.data[0].targetId).toBe('case-id');
  });

  test('uses the same human impact prefix for account-scoped search before paging', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ id: 'own-impact-notice' }]),
      notification: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(1) } };
    await new NotificationsService(prisma as never).findByUser('own-user', { search: 'tam ngung', state: 'unread', type: 'SYSTEM', limit: 1 });
    const sql = prisma.$queryRaw.mock.calls[0][0];
    expect(sql.values).toContain('OPERATIONAL_IMPACT');
    expect(sql.values).toContain('Chi nhánh — Tạm ngừng hoạt động:');
    expect(sql.values).toContain('%tam ngung%');
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      userId: 'own-user', isRead: false, type: 'SYSTEM', id: { in: ['own-impact-notice'] },
    }, take: 1 }));
  });
  test('returns human labels without rewriting stored historical body', async () => {
    const stored = { id: 'notice', userId: 'own-user', type: 'SYSTEM', targetType: 'REVIEW',
      title: 'Đánh giá đã được báo cáo', body: 'Phân loại: OTHER — mức độ: MEDIUM' };
    const prisma = { notification: { findMany: jest.fn().mockResolvedValue([stored]), count: jest.fn().mockResolvedValue(1) } };
    const result = await new NotificationsService(prisma as never).findByUser('own-user');
    expect(result.data[0].body).toBe('Phân loại: Khác — mức độ: Trung bình');
    expect(stored.body).toBe('Phân loại: OTHER — mức độ: MEDIUM');
    expect(result.data[0].targetType).toBe('REVIEW');
  });

  test('searches presented text before paging while retaining actor and exact filters', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ id: 'own-notice' }]),
      notification: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(1) } };
    await new NotificationsService(prisma as never).findByUser('own-user', { search: 'TRUNG BINH', state: 'unread', type: 'SYSTEM', limit: 1 });
    const sql = prisma.$queryRaw.mock.calls[0][0];
    expect(sql.sql).toContain('CASE'); expect(sql.sql).toContain('n.user_id');
    expect(sql.values).toContain('Phân loại: Khác — mức độ: Trung bình');
    expect(sql.values).toContain('%trung binh%'); expect(sql.values).toContain('own-user');
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      userId: 'own-user', isRead: false, type: 'SYSTEM', id: { in: ['own-notice'] },
    }, take: 1 }));
  });

  test('ordinary user text, another event title and null body remain unchanged', async () => {
    const rows = [
      { id: 'a', type: 'SYSTEM', targetType: 'BOOKING', title: 'Ghi chú lịch hẹn', body: 'Phân loại: OTHER — mức độ: MEDIUM' },
      { id: 'b', type: 'SYSTEM', targetType: 'REVIEW', title: 'Đánh giá đã bị ẩn', body: 'Giải thích dành cho tác giả.' },
      { id: 'c', type: 'SYSTEM', targetType: null, title: 'Thông báo', body: null },
    ];
    const prisma = { notification: { findMany: jest.fn().mockResolvedValue(rows), count: jest.fn().mockResolvedValue(3) } };
    expect((await new NotificationsService(prisma as never).findByUser('own-user')).data).toEqual(rows);
  });
});
