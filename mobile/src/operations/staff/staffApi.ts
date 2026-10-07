import { apiRequest, withQuery, ApiError } from '../../api/client';
import type { WorkItem, WorkPage, WorkAction } from './types';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try { return await apiRequest<T>(path, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}
export const staffApi = {
  page(query: { dateFrom?: string; dateTo?: string; branchId: string; bookingId?: string; includeUnresolved?: boolean; page: number; limit: number }) {
    return request<WorkPage>(withQuery('/bookings/my-work-items', query));
  },
  detail(itemId: string) { return request<WorkItem>(`/bookings/my-work-items/${encodeURIComponent(itemId)}`); },
  update(item: WorkItem, action: WorkAction) {
    return request<unknown>(`/bookings/${encodeURIComponent(item.bookingId)}/items/${encodeURIComponent(item.id)}`, {
      method: 'PATCH', body: JSON.stringify({ action, expectedRevision: item.revision,
        reason: action === 'START' ? 'Nhân viên bắt đầu dịch vụ được phân công trên mobile.' : 'Nhân viên hoàn tất dịch vụ được phân công trên mobile.' }),
    });
  },
};

/** Complete bounded pagination; never present the first page as the entire workday. */
export async function readWorkDay(query: { branchId: string; dateFrom?: string; dateTo?: string; bookingId?: string; includeUnresolved?: boolean },
  isCurrent: () => boolean, readPage = staffApi.page): Promise<WorkPage> {
  const items = new Map<string, WorkItem>();
  let latest: WorkPage | undefined;
  for (let page = 1; page <= 100; page++) {
    if (!isCurrent()) throw new Error('STALE_REQUEST');
    latest = await readPage({ ...query, page, limit: 50 });
    if (!isCurrent()) throw new Error('STALE_REQUEST');
    if (!latest || !Array.isArray(latest.data) || !Number.isInteger(latest.total) || latest.total < 0 || latest.page !== page || latest.limit < 1) {
      throw new ApiError('Không thể xác minh danh sách công việc.', 502);
    }
    latest.data.forEach(item => items.set(item.id, item));
    if (page * latest.limit >= latest.total) {
      if (items.size !== latest.total) throw new ApiError('Danh sách công việc vừa thay đổi; hãy tải lại.', 409);
      return { ...latest, data: [...items.values()] };
    }
    if (!latest.data.length) throw new ApiError('Danh sách công việc chưa đầy đủ.', 502);
  }
  throw new ApiError('Danh sách vượt giới hạn tải an toàn. Hãy chọn ngày hoặc chi nhánh cụ thể.', 413);
}
