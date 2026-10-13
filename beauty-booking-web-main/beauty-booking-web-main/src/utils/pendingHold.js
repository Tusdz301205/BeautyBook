export const PENDING_HOLD_EXPIRED_MESSAGE = 'Lịch hẹn đã hết thời gian giữ chỗ; muốn tiếp tục, vui lòng đặt lại lịch hẹn.';

export function pendingHoldExpired(booking, serverNow) {
  if (booking?.status !== 'PENDING' || booking.pendingExpiresAt == null || !Number.isFinite(serverNow)) return false;
  if (!Array.isArray(booking.bookingServices)) return false;
  if (booking.bookingServices.some(item => ['IN_PROGRESS', 'COMPLETED'].includes(item.status))) return false;
  const deadline = new Date(booking.pendingExpiresAt).getTime();
  return Number.isFinite(deadline) && deadline <= serverNow;
}

export function pendingHoldItemActions(actions, expired) {
  // An expired unserved parent is still PENDING; START requires check-in.
  return expired ? actions.filter(action => !['REASSIGN', 'RESIZE', 'START'].includes(action)) : actions;
}
