export type OperationalItem = {
  status?: string; itemStartAt?: string | null; itemEndAt?: string | null;
  actualStartedAt?: string | null;
};
const instant = (value: string | null | undefined) => value && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
export function operationalTimeLabel(item: OperationalItem, bookingStatus: string, serverNow: number): string | null {
  if (!Number.isFinite(serverNow) || ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'REJECTED', 'EXPIRED'].includes(bookingStatus)) return null;
  const start = instant(item.itemStartAt), end = instant(item.itemEndAt);
  if (item.status === 'IN_PROGRESS' && Number.isFinite(end) && serverNow > end) return 'Đang phục vụ quá giờ dự kiến';
  if (item.status !== 'SCHEDULED' || item.actualStartedAt) return null;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  if (Number.isFinite(end) && serverNow > end) return 'Quá giờ dự kiến — cần kiểm tra';
  return Number.isFinite(start) && serverNow >= start ? 'Đã đến giờ — chưa bắt đầu' : null;
}
export function advanceServerClock(server: number, observed: number, monotonicNow: number): number {
  return Number.isFinite(server) && Number.isFinite(observed) && Number.isFinite(monotonicNow)
    ? server + Math.max(0, monotonicNow - observed) : NaN;
}
