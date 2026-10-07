/** Staff UI accepts only the personal work projection, never a customer booking. */
export type WorkItem = {
  id: string; bookingId: string; bookingCode: string; branchId: string; businessId: string;
  branch: { id: string; name: string; timezone?: string | null };
  customer: { fullName: string }; serviceId: string; serviceNameSnapshot: string;
  staffId: string; status: string; bookingStatus: string; revision: number;
  durationMinutes: number; itemStartAt: string | null; itemEndAt: string | null;
  appointmentDate: string; appointmentStartTime: string; appointmentEndTime: string;
  actualStartedAt: string | null; actualCompletedAt: string | null; actualStoppedAt: string | null;
  actualTimingSource: string; serverNow: string; canStart: boolean; canComplete: boolean;
};
export type WorkAction = 'START' | 'COMPLETE';
export type WorkPage = { data: WorkItem[]; total: number; page: number; limit: number; serverNow: string };
export const actionLabel = (action: WorkAction) => action === 'START' ? 'Nhận khách' : 'Hoàn tất';

/** Database TIME is a wall clock value, even when serialized with an ISO date. */
export function appointmentClock(value: string | null | undefined): string {
  const match = value?.trim().match(/^(?:\d{4}-\d{2}-\d{2}T)?([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/);
  return match ? `${match[1]}:${match[2]}` : 'Chưa có giờ hẹn';
}

export function actionFor(item: WorkItem, staffId: string | undefined): WorkAction | null {
  if (!staffId || item.staffId !== staffId || !Number.isInteger(item.revision) || item.revision < 1) return null;
  if (!['CHECKED_IN', 'IN_PROGRESS'].includes(item.bookingStatus)) return null;
  if (item.status === 'SCHEDULED' && item.canStart === true) return 'START';
  if (item.status === 'IN_PROGRESS' && item.canComplete === true) return 'COMPLETE';
  return null;
}

export function statusLabel(status: string): string {
  return ({ SCHEDULED: 'Chưa bắt đầu', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Đã hoàn tất',
    CANCELLED: 'Đã hủy', SKIPPED: 'Đã bỏ qua' } as Record<string, string>)[status] ?? 'Trạng thái chưa hỗ trợ';
}
export function arrivalLabel(status: string): string {
  if (['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(status)) return 'Khách đã đến';
  if (['PENDING', 'CONFIRMED'].includes(status)) return 'Chưa ghi nhận khách đến';
  return ({ CANCELLED: 'Lịch đã hủy', NO_SHOW: 'Khách không đến', REJECTED: 'Lịch đã từ chối' } as Record<string, string>)[status] ?? 'Chưa có tình trạng đến';
}
export function orderWork(items: WorkItem[]): WorkItem[] {
  const rank = (item: WorkItem) => item.status === 'IN_PROGRESS' ? 0 : item.canStart ? 1 : item.status === 'SCHEDULED' ? 2 : 3;
  return [...items].sort((a, b) => rank(a) - rank(b) ||
    (a.itemStartAt ?? `${a.appointmentDate.slice(0, 10)}T${a.appointmentStartTime}`).localeCompare(b.itemStartAt ?? `${b.appointmentDate.slice(0, 10)}T${b.appointmentStartTime}`) || a.id.localeCompare(b.id));
}
export type TodayRow = { item: WorkItem; kind: 'current' | 'next' | 'later' | 'finished'; heading?: string; primary?: boolean };
/** Presentation only: keep every assigned item, including parallel work and terminal siblings. */
export function todayRows(items: WorkItem[], staffId?: string): TodayRow[] {
  const ordered = orderWork(items);
  const current = ordered.filter(item => item.status === 'IN_PROGRESS');
  const scheduled = ordered.filter(item => item.status === 'SCHEDULED' && ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(item.bookingStatus));
  const next = scheduled.find(item => actionFor(item, staffId) === 'START') ?? scheduled[0];
  const selected = new Set([...current.map(item => item.id), ...(next ? [next.id] : [])]);
  const terminal = (item: WorkItem) => ['COMPLETED', 'CANCELLED', 'SKIPPED'].includes(item.status) ||
    ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'REJECTED', 'EXPIRED'].includes(item.bookingStatus);
  const later = ordered.filter(item => !selected.has(item.id) && !terminal(item));
  const finished = ordered.filter(item => !selected.has(item.id) && terminal(item));
  return [
    ...current.map((item, index): TodayRow => ({ item, kind: 'current', primary: index === 0, heading: index === 0 ? 'Đang thực hiện' : undefined })),
    ...(next ? [{ item: next, kind: 'next' as const, heading: 'Tiếp theo' }] : []),
    ...later.map((item, index): TodayRow => ({ item, kind: 'later', heading: index === 0 ? 'Còn lại hôm nay' : undefined })),
    ...finished.map((item, index): TodayRow => ({ item, kind: 'finished', heading: index === 0 ? 'Đã kết thúc' : undefined })),
  ];
}
export function allWorkCompleted(items: WorkItem[], fresh: boolean): boolean {
  return fresh && items.length > 0 && items.every(item => item.status === 'COMPLETED');
}
export function branchDate(now: number, timezone?: string | null): string | null {
  if (!timezone || !Number.isFinite(now)) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
    const part = (name: string) => parts.find(p => p.type === name)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch { return null; }
}
export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function elapsedSeconds(item: WorkItem, serverAnchor: number, receivedAt: number, now: number): number | null {
  if (item.actualTimingSource !== 'SERVICE_ADJUSTMENT' || !item.actualStartedAt) return null;
  const start = Date.parse(item.actualStartedAt);
  const stopValue = item.actualCompletedAt ?? item.actualStoppedAt;
  const end = stopValue ? Date.parse(stopValue) : item.status === 'IN_PROGRESS' && Number.isFinite(serverAnchor)
    ? serverAnchor + Math.max(0, now - receivedAt) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.floor((end - start) / 1000);
}
export function elapsedLabel(seconds: number | null): string {
  if (seconds === null) return 'Chưa có thời gian thực tế';
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds / 60) % 60;
  return `${hours ? `${hours} giờ ` : ''}${minutes} phút ${seconds % 60} giây thực tế`;
}
export function workError(error: unknown): { message: string; removeData: boolean } {
  const status = (error as { status?: number })?.status;
  const code = (error as { payload?: { code?: string } })?.payload?.code;
  if (code === 'STAFF_PROFILE_REQUIRED') return { message: 'Hồ sơ nhân viên chưa được liên kết hoặc không còn hoạt động. Hãy liên hệ quản lý.', removeData: true };
  if (status === 401 || status === 403) return { message: 'Bạn không còn quyền xem công việc trong ngữ cảnh này.', removeData: true };
  if (status === 404) return { message: 'Công việc không còn được giao cho bạn hoặc không còn tồn tại.', removeData: true };
  if (status === 400 || status === 409) {
    const detail = error instanceof Error ? error.message : (error as { message?: unknown })?.message;
    return { message: `${typeof detail === 'string' && detail.trim() ? detail : 'Phân công hoặc trạng thái vừa thay đổi.'} Đã đọc lại công việc. Nếu bắt đầu muộn bị trùng lịch, liên hệ quầy/quản lý để điều phối; không tự dời lịch tiếp theo.`, removeData: false };
  }
  return { message: 'Chưa kết nối được để cập nhật. Dữ liệu đang hiển thị có thể đã cũ; hãy thử tải lại.', removeData: false };
}

/** One in-flight lifecycle request; after any outcome a safe read must succeed before retry. */
export function createWorkGate() {
  let busy = false, uncertain = false;
  return {
    get blocked() { return busy || uncertain; },
    async run(mutate: () => Promise<unknown>, read: () => Promise<unknown>) {
      if (busy || uncertain) return false;
      busy = true; uncertain = true;
      try { await mutate(); }
      finally {
        try { await read(); uncertain = false; }
        finally { busy = false; }
      }
      return true;
    },
    async reconcile(read: () => Promise<unknown>) {
      if (busy) return;
      busy = true;
      try { await read(); uncertain = false; }
      finally { busy = false; }
    },
  };
}
