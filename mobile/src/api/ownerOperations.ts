import { ApiError, apiRequest, createIdempotencyKey, getApiSessionGeneration, withQuery } from './client';
import type { OwnerActualTimeCorrection, OwnerBooking, OwnerDashboard, OwnerImpact, OwnerRequest, OwnerScope } from '../types/ownerOperations';
import { bookingFingerprint, completeImpactAllowed, isUuid, ordinaryRescheduleAllowed, ownerBranches, ownsBusiness, permitsResource, requestFingerprint, reviewAllowed, validDate } from '../operations/owner/policy';

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const str = (value: unknown): string => typeof value === 'string' ? value : '';
const nullable = (value: unknown) => str(value) || null;
const count = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new ApiError('Dữ liệu thống kê không hợp lệ.', 502);
  return value;
};
function assertScope(scope: OwnerScope) {
  if (!ownsBusiness(scope)) throw new ApiError('Không có quyền chủ doanh nghiệp trong phiên này.', 403);
  if (scope.branchId && !ownerBranches(scope).some(branch => branch.id === scope.branchId)) throw new ApiError('Chi nhánh ngoài phạm vi.', 403);
}
function assertResource(scope: OwnerScope, businessId: string, branchId: string | null) {
  assertScope(scope);
  if (!permitsResource(scope, businessId, branchId)) throw new ApiError('Tài nguyên ngoài phạm vi phiên.', 403);
}
function uuid(value: string) {
  if (!isUuid(value)) throw new ApiError('Định danh không hợp lệ.', 404);
  return encodeURIComponent(value);
}
export function projectBooking(value: unknown, scope: OwnerScope): OwnerBooking {
  const raw = row(value), branch = row(raw.branch), customer = row(raw.customer);
  const branchId = str(raw.branchId) || str(branch.id);
  const known = ownerBranches(scope).find(item => item.id === branchId);
  const businessId = str(branch.businessId) || known?.businessId || '';
  assertResource(scope, businessId, branchId);
  const id = str(raw.bookingId) || str(raw.id);
  uuid(id);
  const availability = row(row(raw.transitionAvailability).CHECKED_IN);
  return {
    id, code: str(raw.bookingCode) || (raw.bookingId ? str(raw.id) : '') || id, businessId, branchId, branchName: known?.name || str(branch.name),
    timezone: str(branch.timezone) || known?.timezone || 'Asia/Ho_Chi_Minh',
    customerName: str(row(customer.user).fullName) || str(customer.fullName) || str(raw.customer_name) || 'Khách hàng',
    status: str(raw.statusEnum) || str(raw.status), date: (str(raw.appointmentDate) || str(raw.appointment_time)).slice(0, 10),
    start: nullable(raw.appointmentStartTime) || nullable(raw.appointment_start), end: nullable(raw.appointmentEndTime) || nullable(raw.appointment_end), note: nullable(raw.note),
    serverNow: typeof raw.serverNow === 'string' ? raw.serverNow : undefined,
    items: rows(raw.bookingServices ?? raw.services).map(value => { const item = row(value), staff = row(item.staff); return {
      id: str(item.bookingServiceId) || str(item.id), name: str(row(item.service).name) || str(item.serviceName) || str(item.name) || 'Dịch vụ',
      staffId: nullable(item.staffId) || nullable(staff.id), staffName: nullable(staff.fullName) || nullable(row(staff.user).fullName) || nullable(item.staff) ||
        (nullable(item.staffId) || nullable(staff.id) ? 'Đã phân công; chưa tải tên nhân viên' : null), status: str(item.status),
      revision: typeof item.revision === 'number' ? item.revision : null,
      itemStartAt: nullable(item.itemStartAt), itemEndAt: nullable(item.itemEndAt), actualStartedAt: nullable(item.actualStartedAt),
      actualCompletedAt: nullable(item.actualCompletedAt), actualStoppedAt: nullable(item.actualStoppedAt),
      actualTimingSource: str(item.actualTimingSource), durationMinutes: typeof item.durationMinutes === 'number' ? item.durationMinutes : undefined,
      canCorrectActualTime: item.canCorrectActualTime === true,
    }; }),
    checkinAllowed: raw.status === 'CONFIRMED' && availability.allowed === true,
  };
}
export function projectRequest(value: unknown, scope: OwnerScope): OwnerRequest {
  const raw = row(value), violation = row(raw.violationEvent);
  return {
    id: str(raw.id), booking: projectBooking(raw.booking, scope), type: str(raw.requestType), status: str(raw.status),
    reason: nullable(raw.reason), expiresAt: nullable(raw.expiresAt), proposedStart: nullable(raw.proposedStartTime),
    proposedEnd: nullable(raw.proposedEndTime), proposedStaff: nullable(row(raw.proposedStaff).fullName) || nullable(row(row(raw.proposedStaff).user).fullName),
    proposedStaffId: nullable(raw.proposedStaffId), lateCancellation: violation.kind === 'LATE_CANCELLATION' && !violation.voidedAt,
    invalidated: !!violation.voidedAt,
  };
}
export function projectImpact(value: unknown, scope: OwnerScope): OwnerImpact {
  const raw = row(value);
  const businessId = str(raw.businessId), branchId = nullable(raw.branchId);
  assertResource(scope, businessId, branchId);
  uuid(str(raw.id));
  return {
    id: str(raw.id), businessId, branchId, reason: str(raw.reason), status: str(raw.status), deadlineAt: nullable(raw.deadlineAt),
    subjectType: str(raw.subjectType), action: str(raw.action),
    ...(Array.isArray(raw.items) ? { items: raw.items.map(value => { const item = row(value); return {
      id: str(item.id), bookingId: str(item.bookingId), status: str(item.status), resolution: nullable(item.resolution), reason: nullable(item.reason),
      booking: item.booking ? projectBooking(item.booking, scope) : null,
    }; }) } : {}),
  };
}
async function requests(scope: OwnerScope): Promise<OwnerRequest[]> {
  assertScope(scope);
  const payload = await apiRequest<unknown>('/bookings/change-requests/pending');
  if (!Array.isArray(payload)) throw new ApiError('Danh sách yêu cầu không hợp lệ.', 502);
  return payload.filter(value => {
    const booking = row(row(value).booking), branch = row(booking.branch);
    return permitsResource(scope, str(branch.businessId), str(booking.branchId) || str(branch.id));
  }).map(value => projectRequest(value, scope));
}
async function booking(scope: OwnerScope, id: string) {
  assertScope(scope);
  return projectBooking(await apiRequest<unknown>(`/bookings/${uuid(id)}`), scope);
}
async function impact(scope: OwnerScope, id: string) {
  assertScope(scope);
  return projectImpact(await apiRequest<unknown>(`/operational-impacts/${uuid(id)}`), scope);
}
function fence(scope: OwnerScope, generation: number) {
  assertScope(scope);
  if (scope.isCurrent && !scope.isCurrent()) throw new ApiError('Ngữ cảnh làm việc đã thay đổi. Vui lòng xem lại trước khi thao tác.', 409);
  if (generation !== getApiSessionGeneration()) throw new ApiError('Phiên đã thay đổi.', 401);
}
async function write(path: string, method: string, body?: object) {
  // Mutation projections are never cached: callers reload authorized read endpoints.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    await apiRequest<unknown>(path, { method, signal: controller.signal, headers: { 'X-Mobile-Owner-V1': 'true', 'Idempotency-Key': createIdempotencyKey('owner') }, ...(body ? { body: JSON.stringify(body) } : {}) });
  } finally { clearTimeout(timer); }
}
export const ownerOperationsApi = {
  requests, booking, impact,
  async actualTimeHistory(scope: OwnerScope, bookingId: string, itemId: string): Promise<OwnerActualTimeCorrection[]> {
    assertScope(scope); const generation = getApiSessionGeneration();
    const payload = row(await apiRequest<unknown>(`/bookings/${uuid(bookingId)}/items/${uuid(itemId)}/actual-time`));
    fence(scope, generation);
    return rows(payload.data).map(value => { const entry = row(value); return {
      id: str(entry.id), version: count(entry.version), actorName: str(row(entry.actor).fullName) || 'Người được cấp quyền',
      correctedAt: str(entry.correctedAt), reason: str(entry.reason),
      oldActualStartedAt: nullable(entry.oldActualStartedAt), oldActualCompletedAt: nullable(entry.oldActualCompletedAt),
      actualStartedAt: nullable(entry.actualStartedAt), actualCompletedAt: nullable(entry.actualCompletedAt), actualTimingStatus: str(entry.actualTimingStatus),
    }; });
  },
  async unfinished(scope: OwnerScope, page = 1) {
    assertScope(scope);
    if (!scope.branchId || !Number.isInteger(page) || page < 1) throw new ApiError('Chọn chi nhánh để xem lịch chưa kết thúc.', 400);
    const payload = row(await apiRequest<unknown>(withQuery('/bookings', { branchId: scope.branchId, status: 'unfinished', sortOrder: 'appointment', page, limit: 20 })));
    return { data: rows(payload.data).map(value => projectBooking(value, scope)), total: count(row(payload.meta).total) };
  },
  async correctActualTime(scope: OwnerScope, bookingId: string, itemId: string, input: {
    expectedRevision: number; actualStartedAt: string | null; actualCompletedAt: string | null; reason: string;
  }) {
    const generation = getApiSessionGeneration();
    const current = await booking(scope, bookingId);
    const item = current.items.find(value => value.id === itemId);
    if (!item?.canCorrectActualTime) throw new ApiError('Bạn chưa được cấp quyền hiệu chỉnh thời gian thực tế của dịch vụ này.', 403);
    if (item.revision !== input.expectedRevision) throw new ApiError('Dịch vụ vừa thay đổi. Tải lại trước khi hiệu chỉnh.', 409);
    fence(scope, generation);
    await write(`/bookings/${uuid(bookingId)}/items/${uuid(itemId)}/actual-time`, 'PATCH', input);
  },
  async impacts(scope: OwnerScope): Promise<OwnerImpact[]> {
    assertScope(scope);
    const payload = await apiRequest<unknown>('/operational-impacts');
    if (!Array.isArray(payload)) throw new ApiError('Danh sách ảnh hưởng không hợp lệ.', 502);
    return payload.filter(value => permitsResource(scope, str(row(value).businessId), nullable(row(value).branchId))).map(value => projectImpact(value, scope));
  },
  async dashboard(scope: OwnerScope, date: string): Promise<OwnerDashboard> {
    assertScope(scope);
    if (!validDate(date)) throw new ApiError('Ngày không hợp lệ.', 400);
    const selected = ownerBranches(scope).filter(branch => !scope.branchId || scope.branchId === branch.id);
    const statuses = new Map<string, number>();
    const branches: OwnerDashboard['branches'] = [];
    // Bounded concurrency; never use unfiltered all-business server totals.
    for (let index = 0; index < selected.length; index += 4) {
      const batch = await Promise.all(selected.slice(index, index + 4).map(async branch => {
        const raw = row(await apiRequest<unknown>(withQuery('/reports/owner-dashboard', { branchId: branch.id, from: date, to: date })));
        if (row(raw.scope).branchId !== branch.id || row(raw.range).from !== date || row(raw.range).to !== date) throw new ApiError('Phạm vi thống kê không hợp lệ.', 502);
        const comparison = rows(row(raw.charts).branchComparison).map(row);
        const stats = comparison.find(item => item.branchId === branch.id);
        if (!stats || comparison.length !== 1) throw new ApiError('Thiếu thống kê chi nhánh.', 502);
        return { branch, stats, statuses: rows(row(raw.charts).bookingStatus).map(row) };
      }));
      for (const item of batch) {
        branches.push({ id: item.branch.id, name: item.branch.name, bookings: count(item.stats.bookingCount), completedBookings: count(item.stats.completedBookings), activeProfiles: count(item.stats.activeStaff) });
        for (const status of item.statuses) statuses.set(str(status.status), (statuses.get(str(status.status)) ?? 0) + count(status.count));
      }
    }
    return { date, branches, statuses: [...statuses].map(([status, count]) => ({ status, count })), bookings: branches.reduce((sum, branch) => sum + branch.bookings, 0), completedBookings: branches.reduce((sum, branch) => sum + branch.completedBookings, 0) };
  },
  async review(scope: OwnerScope, requestId: string, action: 'approve' | 'reject', reviewNote: string, expected?: OwnerRequest) {
    uuid(requestId); const generation = getApiSessionGeneration();
    const current = (await requests(scope)).find(request => request.id === requestId);
    if (!current || !reviewAllowed(current)) throw new ApiError('Yêu cầu không còn hiệu lực.', 409);
    if (expected && requestFingerprint(current) !== requestFingerprint(expected)) throw new ApiError('Nội dung đã thay đổi. Xem lại trước khi duyệt.', 409);
    if (action !== 'approve' && action !== 'reject') throw new ApiError('Thao tác không hợp lệ.', 400);
    if (action === 'reject' && (!reviewNote.trim() || current.lateCancellation)) throw new ApiError('Không thể từ chối yêu cầu này.', 409);
    if (action === 'approve' && !['CANCEL', 'RESCHEDULE'].includes(current.type)) throw new ApiError('Yêu cầu cần xử lý trên quản trị.', 422);
    if (action === 'approve' && current.type === 'RESCHEDULE' && !ordinaryRescheduleAllowed(current)) throw new ApiError('Ngoại lệ cần xử lý trên quản trị.', 422);
    fence(scope, generation);
    await write(`/bookings/change-requests/${uuid(requestId)}/${action}`, 'PATCH', { reviewNote: reviewNote.trim() });
  },
  async bookingAction(scope: OwnerScope, id: string, action: 'confirm' | 'reject' | 'checkin', reason: string, expected?: OwnerBooking) {
    const generation = getApiSessionGeneration(); const current = await booking(scope, id);
    if (expected && bookingFingerprint(current) !== bookingFingerprint(expected)) throw new ApiError('Lịch đã thay đổi. Xem lại trước khi xử lý.', 409);
    if (!['confirm', 'reject', 'checkin'].includes(action)) throw new ApiError('Thao tác ngoài phạm vi.', 403);
    if (action === 'checkin' ? !current.checkinAllowed : current.status !== 'PENDING') throw new ApiError('Trạng thái đã thay đổi.', 409);
    if (action === 'reject' && !reason.trim()) throw new ApiError('Cần lý do từ chối.', 400);
    fence(scope, generation);
    await write(action === 'checkin' ? `/bookings/${uuid(id)}/checkin` : `/bookings/${uuid(id)}`, action === 'checkin' ? 'POST' : 'PUT', action === 'checkin' ? undefined : { action, reason: reason.trim() });
  },
  async approveException(scope: OwnerScope, caseId: string, itemId: string, reason: string) {
    uuid(itemId); const generation = getApiSessionGeneration(); const current = await impact(scope, caseId);
    const item = current.items?.find(item => item.id === itemId);
    if (!['OPEN', 'IN_PROGRESS'].includes(current.status) || item?.status !== 'PENDING' || !item.booking || !reason.trim()) throw new ApiError('Ngoại lệ không còn đủ điều kiện.', 409);
    fence(scope, generation);
    await write(`/operational-impacts/${uuid(caseId)}/items/${uuid(itemId)}`, 'PATCH', { resolution: 'APPROVED_EXCEPTION', reason: reason.trim() });
  },
  async completeImpact(scope: OwnerScope, caseId: string) {
    const generation = getApiSessionGeneration(); const current = await impact(scope, caseId);
    if (!completeImpactAllowed(current)) throw new ApiError('Vẫn còn lịch chưa xử lý.', 409);
    fence(scope, generation);
    await write(`/operational-impacts/${uuid(caseId)}/complete`, 'POST');
  },
};
