// Explicit allowlist: never spread database booking/customer/service/staff rows.
// Legacy envelopes and UUIDs are retained; contact, financial and profile data
// are deliberately omitted for the personal STAFF authority at this resource.
export function staffBookingView(booking: any, staffId: string) {
  return {
    id: booking.id, bookingId: booking.bookingId ?? booking.id, bookingCode: booking.bookingCode,
    branchId: booking.branchId, status: booking.status, statusEnum: booking.statusEnum,
    appointmentDate: booking.appointmentDate, appointmentStartTime: booking.appointmentStartTime,
    appointmentEndTime: booking.appointmentEndTime, appointment_time: booking.appointment_time,
    appointment_start: booking.appointment_start, appointment_end: booking.appointment_end,
    customer_name: booking.customer_name, branch_name: booking.branch_name,
    serverNow: booking.serverNow ?? new Date(),
    customer: booking.customer ? { user: { fullName: booking.customer.user?.fullName, email: null, phone: null } } : undefined,
    branch: booking.branch ? { id: booking.branch.id, name: booking.branch.name, timezone: booking.branch.timezone } : undefined,
    bookingServices: (booking.bookingServices ?? []).filter((item: any) => item.staffId === staffId).map((item: any) => ({
      id: item.id, bookingId: item.bookingId, serviceId: item.serviceId, staffId: item.staffId,
      status: item.status, revision: item.revision, serviceNameSnapshot: item.serviceNameSnapshot,
      durationMinutes: item.durationMinutes, itemStartAt: item.itemStartAt, itemEndAt: item.itemEndAt,
      actualStartedAt: item.actualStartedAt ?? null, actualCompletedAt: item.actualCompletedAt ?? null,
      actualStoppedAt: item.actualStoppedAt ?? null, actualTimingSource: item.actualTimingSource ?? 'UNAVAILABLE',
      service: { id: item.serviceId, name: item.serviceNameSnapshot ?? item.service?.name },
      staff: item.staff ? { id: item.staff.id, fullName: item.staff.fullName } : undefined,
    })),
    services: (booking.services ?? []).map((item: any) => ({ bookingServiceId: item.bookingServiceId,
      name: item.name, duration: item.duration, staff: item.staff,
      actualStartedAt: item.actualStartedAt ?? null, actualCompletedAt: item.actualCompletedAt ?? null,
      actualStoppedAt: item.actualStoppedAt ?? null, actualTimingSource: item.actualTimingSource ?? 'UNAVAILABLE' })),
  };
}
