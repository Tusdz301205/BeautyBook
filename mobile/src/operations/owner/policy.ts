import type { OwnerImpact, OwnerRequest, OwnerScope } from '../../types/ownerOperations';

export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function ownsBusiness(scope: OwnerScope, now = Date.now()): boolean {
  return scope.workspace === 'SALON' && scope.sessionType === 'salon' && isUuid(scope.businessId) &&
    scope.roles.includes('BUSINESS_OWNER') && scope.scopes.some(grant =>
      grant.code === 'BUSINESS_OWNER' && grant.businessId === scope.businessId && !grant.branchId &&
      (!grant.expiresAt || new Date(grant.expiresAt).getTime() > now));
}
export function ownerBranches(scope: OwnerScope) {
  if (!ownsBusiness(scope)) return [];
  return scope.branches.filter(branch => isUuid(branch.id) && branch.businessId === scope.businessId);
}
export function permitsResource(scope: OwnerScope, businessId: string, branchId: string | null): boolean {
  return ownsBusiness(scope) && businessId === scope.businessId &&
    (branchId === null ? scope.branchId === null : ownerBranches(scope).some(branch => branch.id === branchId) && (!scope.branchId || scope.branchId === branchId));
}
export function reviewAllowed(request: OwnerRequest, now = Date.now()): boolean {
  return request.status === 'PENDING' && !!request.expiresAt && new Date(request.expiresAt).getTime() > now &&
    ['PENDING', 'CONFIRMED'].includes(request.booking.status) && !request.invalidated;
}
export function ordinaryRescheduleAllowed(request: OwnerRequest): boolean {
  return request.type === 'RESCHEDULE' && !!request.proposedStart && !!request.proposedEnd &&
    (!request.proposedStaffId || (request.booking.items.length > 0 && request.booking.items.every(item => item.staffId === request.proposedStaffId)));
}
export function completeImpactAllowed(impact: OwnerImpact): boolean {
  return impact.status === 'READY_TO_COMPLETE' && !!impact.items && impact.items.every(item => item.status === 'RESOLVED');
}
export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function shiftDate(value: string, days: number): string {
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
export function ownerError(error: unknown): string {
  const payload = error && typeof error === 'object' && 'payload' in error ? error.payload : null;
  if (payload && typeof payload === 'object' && 'code' in payload && payload.code === 'MOBILE_FINANCE_REVIEW_REQUIRED') return 'Lịch có thanh toán hoặc quyền lợi liên quan. Vui lòng xử lý tại phiên bản quản trị; chưa có thay đổi được áp dụng.';
  const status = error && typeof error === 'object' && 'status' in error ? error.status : null;
  if (status === 401 || status === 403) return 'Phiên hoặc quyền truy cập đã thay đổi. Vui lòng kiểm tra lại tài khoản và chi nhánh.';
  if (status === 404) return 'Nội dung không còn tồn tại hoặc không còn được phép xem.';
  if (status === 409 || status === 400) return 'Dữ liệu hoặc điều kiện xử lý đã thay đổi. Tải lại để kiểm tra thời hạn, trạng thái và lịch trống.';
  if (status === 422) return 'Thao tác có điều kiện tài chính hoặc ngoại lệ phức tạp. Vui lòng xử lý trên phiên bản quản trị.';
  if (status === 0) return 'Mất kết nối. Kết quả thao tác có thể chưa rõ; tải lại trạng thái trước khi thử tiếp.';
  return 'Chưa tải hoặc xử lý được dữ liệu. Vui lòng thử tải lại.';
}
export function bookingFingerprint(booking: import('../../types/ownerOperations').OwnerBooking): string {
  return JSON.stringify([booking.id, booking.businessId, booking.branchId, booking.customerName, booking.status, booking.date, booking.start, booking.end, booking.items]);
}
export function requestFingerprint(request: OwnerRequest): string {
  return JSON.stringify([request.id, request.type, request.status, request.expiresAt, request.proposedStart, request.proposedEnd, request.proposedStaffId, request.lateCancellation, request.invalidated, bookingFingerprint(request.booking)]);
}
