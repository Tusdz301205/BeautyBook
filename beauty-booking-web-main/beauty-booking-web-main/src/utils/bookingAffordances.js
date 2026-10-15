// Counter-service addition always derives commercial terms on the server.
export function counterServicePayload({ serviceId, reason }) {
  return { serviceId, reason: reason.trim() };
}

export function rowsInBranches(rows, branchIds) {
  const allowed = new Set(branchIds);
  return rows.filter((row) => allowed.has(row.branchId ?? row.branch_id ?? row.branch?.id
    ?? row.booking?.branchId ?? row.booking?.branch?.id));
}

export function noShowAvailability(booking, capabilities, now = Date.now()) {
  if (!capabilities.frontDesk || !capabilities.canUpdate || booking?.status !== 'CONFIRMED') return false;
  const start = new Date(booking.startAt).getTime();
  if (!Number.isFinite(start) || now <= start + 15 * 60_000) return false;
  if (booking.raw?.changeRequests?.some((request) => request.requestType === 'CANCEL' && !request.violationEvent?.voidedAt)) return false;
  if (booking.raw?.statusHistory?.some((entry) => ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(entry.status))) return false;
  return !(booking.services || []).some((item) => ['IN_PROGRESS', 'COMPLETED'].includes(item.status));
}

// Schedule history never changes persisted attendance or actual execution facts.
export function elapsedCheckIn(booking) {
  return (booking?.statusEnum || booking?.status) === 'CHECKED_IN'
    && (booking.scheduleElapsed === true || booking.scheduleBucket === 'HISTORY');
}

export function attendanceLabel(booking, fallback) {
  if ((booking?.statusEnum || booking?.status) !== 'CHECKED_IN') return fallback;
  return elapsedCheckIn(booking) ? 'Đã đến · Lịch đã qua' : 'Khách đã đến';
}

export function reviewEligible(booking) {
  if (booking?.review) return false;
  return typeof booking?.canReview === 'boolean' ? booking.canReview
    : (booking?.statusEnum || booking?.status) === 'COMPLETED';
}

export function unfinishedBooking(booking) {
  const status = booking?.statusEnum || booking?.status;
  if (elapsedCheckIn(booking) || ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'REJECTED', 'EXPIRED'].includes(status)) return false;
  return status === 'IN_PROGRESS' || (booking?.services || []).some((item) => ['SCHEDULED', 'IN_PROGRESS'].includes(item.status));
}
