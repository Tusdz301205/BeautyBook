import type { ApiBooking } from '../types/api';
import type { ConfirmedBooking, BookingStatus } from '../context/BookingsContext';

export function mapBookingStatus(status: string): BookingStatus {
  if (status === 'COMPLETED') return 'completed';
  if (['CANCELLED', 'NO_SHOW', 'REJECTED', 'EXPIRED'].includes(status)) return 'cancelled';
  return 'upcoming';
}

/** PostgreSQL DATE + TIME are separate calendar and wall-clock values. */
export function bookingDateTime(dateValue: string, timeValue: string): Date | null {
  const day = dateValue.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  const time = timeValue.match(/(?:T|\s)(\d{2}):(\d{2})/) || timeValue.match(/^(\d{2}):(\d{2})/);
  if (!day || !time) return null;
  const instant = new Date(`${day}T${time[1]}:${time[2]}:00+07:00`);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

export function mapBooking(booking: ApiBooking): ConfirmedBooking {
  const start = bookingDateTime(booking.appointmentDate, booking.appointmentStartTime);
  const day = booking.appointmentDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const clock = booking.appointmentStartTime.match(/(?:T|\s)(\d{2}):(\d{2})/) || booking.appointmentStartTime.match(/^(\d{2}):(\d{2})/);
  const services = booking.bookingServices ?? [];
  const seenStaff = new Set<string>();
  const staffNames = services.flatMap(({ staff }) => {
    if (!staff?.fullName) return [];
    const key = staff.id || staff.fullName;
    if (seenStaff.has(key)) return [];
    seenStaff.add(key);
    return [staff.fullName];
  });
  const pendingCancellationRequest = booking.changeRequests?.find((request) =>
    request.requestType === 'CANCEL' && request.status === 'PENDING');
  return {
    id: booking.id,
    bookingCode: booking.bookingCode,
    branchId: booking.branch?.id ?? '',
    serviceIds: services.map((item) => item.service?.id).filter((id): id is string => Boolean(id)),
    variantSelections: Object.fromEntries(services.filter((item) => item.service?.id && item.variantId).map((item) => [item.service!.id, item.variantId!])),
    shopName: booking.branch?.name || booking.branch?.business?.name || 'Cơ sở làm đẹp',
    address: booking.branch?.addressLine || 'Chưa cập nhật địa chỉ',
    serviceName: services.map((item) => item.service?.name).filter(Boolean).join(', ') || 'Dịch vụ làm đẹp',
    staffName: staffNames.join(', ') || 'Bất kỳ',
    date: day ? `${day[3]}/${day[2]}/${day[1]}` : booking.appointmentDate,
    time: clock ? `${clock[1]}:${clock[2]}` : '',
    appointmentStartAt: start?.toISOString() ?? '',
    serverNow: booking.serverNow,
    branchTimezone: booking.branch?.timezone,
    totalPrice: Number(booking.finalAmount ?? booking.totalAmount ?? 0),
    status: mapBookingStatus(booking.status),
    rawStatus: booking.status,
    reviewed: Boolean(booking.review),
    hasPendingCancellationRequest: Boolean(pendingCancellationRequest),
    cancellationRequestExpiresAt: pendingCancellationRequest?.expiresAt ?? undefined,
    bookingServices: services.map((item) => ({
      id: item.id,
      serviceId: item.service?.id,
      staffId: item.staffId || item.staff?.id || undefined,
      serviceName: item.service?.name || 'Dịch vụ',
      staffName: item.staff?.fullName,
      durationMinutes: item.durationMinutes,
      status: item.status,
      itemStartAt: item.itemStartAt,
      itemEndAt: item.itemEndAt,
      actualStartedAt: item.actualStartedAt,
      actualCompletedAt: item.actualCompletedAt,
      actualStoppedAt: item.actualStoppedAt,
      actualTimingSource: item.actualTimingSource,
    })),
  };
}
