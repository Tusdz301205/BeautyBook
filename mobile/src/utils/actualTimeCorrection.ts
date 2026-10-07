export function branchActualInstant(day: string, time: string, timezone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const wall = `${day}T${time}:00`, stamp = Date.parse(`${wall}Z`);
  if (!Number.isFinite(stamp)) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const local = (value: number) => {
      const p = Object.fromEntries(formatter.formatToParts(value).map(part => [part.type, part.value]));
      return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
    };
    const candidates = new Set<number>();
    for (const delta of [-86400000, 0, 86400000]) {
      const sample = stamp + delta, offset = Date.parse(`${local(sample)}Z`) - sample;
      const candidate = stamp - offset;
      if (local(candidate) === wall) candidates.add(candidate);
    }
    return candidates.size === 1 ? new Date([...candidates][0]).toISOString() : null;
  } catch { return null; }
}
export function correctionPayload(input: { startDay: string; startTime: string; endDay: string; endTime: string; timezone: string; unknown: boolean; reason: string; expectedRevision: number; serverNow: number }) {
  if (!input.reason.trim()) throw new Error('Nhập lý do bổ sung / hiệu chỉnh.');
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) throw new Error('Tải lại dịch vụ để xác minh phiên bản hiện tại.');
  const start = input.unknown ? null : branchActualInstant(input.startDay, input.startTime, input.timezone);
  const end = input.unknown ? null : branchActualInstant(input.endDay, input.endTime, input.timezone);
  if (!input.unknown && (!start || !end || start >= end)) throw new Error('Nhập giờ thực tế chính xác; bắt đầu phải trước hoàn tất.');
  if (!Number.isFinite(input.serverNow)) throw new Error('Chưa xác minh giờ máy chủ; tải lại trước khi lưu.');
  if (end && Date.parse(end) > input.serverNow) throw new Error('Không được nhập thời gian thực tế trong tương lai.');
  return { expectedRevision: input.expectedRevision, actualStartedAt: start, actualCompletedAt: end, reason: input.reason.trim() };
}
