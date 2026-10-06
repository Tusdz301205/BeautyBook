export function formatServiceTimestamp(value: string | null | undefined, timezone?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  // Missing/invalid branch configuration must not silently use the device timezone.
  if (!timezone) return `${date.toISOString()} (UTC)`;
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).format(date);
  } catch { return `${date.toISOString()} (UTC)`; }
}

export function serviceTimingLines(item: {
  durationMinutes?: number;
  itemStartAt?: string | null;
  itemEndAt?: string | null;
  actualStartedAt?: string | null;
  actualCompletedAt?: string | null;
  actualStoppedAt?: string | null;
  actualTimingSource?: string;
}, timezone?: string): string[] {
  const lines: string[] = [];
  if (item.durationMinutes != null) lines.push(`Thời lượng dự kiến: ${item.durationMinutes} phút`);
  const plannedStart = formatServiceTimestamp(item.itemStartAt, timezone);
  const plannedEnd = formatServiceTimestamp(item.itemEndAt, timezone);
  if (plannedStart) lines.push(`Bắt đầu dự kiến: ${plannedStart}`);
  if (plannedEnd) lines.push(`Kết thúc dự kiến: ${plannedEnd}`);
  let known = false;
  if (item.actualTimingSource === 'SERVICE_ADJUSTMENT') {
    const start = formatServiceTimestamp(item.actualStartedAt, timezone);
    const complete = formatServiceTimestamp(item.actualCompletedAt, timezone);
    const stop = formatServiceTimestamp(item.actualStoppedAt, timezone);
    if (start) { lines.push(`Bắt đầu thực tế: ${start}`); known = true; }
    if (complete) { lines.push(`Hoàn thành thực tế: ${complete}`); known = true; }
    else if (stop) { lines.push(`Dừng thực tế: ${stop}`); known = true; }
  }
  if (!known) lines.push('Chưa có mốc thời gian thực tế được ghi nhận');
  return lines;
}
