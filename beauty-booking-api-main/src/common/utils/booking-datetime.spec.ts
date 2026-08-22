import {
  appointmentDateFromInstant,
  appointmentTimeFromInstant,
  combineAppointmentDateTime,
  normalizeAppointmentForStorage,
  sameAppointmentDate,
  toBookingInterval,
} from './booking-datetime';

describe('booking datetime canonical helpers', () => {
  test('round-trips a Vietnam local appointment without timezone drift', () => {
    const instant = new Date('2026-07-15T02:00:00.000Z'); // 09:00 in Vietnam
    const date = appointmentDateFromInstant(instant);
    const time = appointmentTimeFromInstant(instant);

    expect(date.toISOString()).toBe('2026-07-15T00:00:00.000Z');
    expect(time.toISOString()).toBe('1970-01-01T09:00:00.000Z');
    expect(combineAppointmentDateTime(date, time).toISOString()).toBe(
      '2026-07-15T02:00:00.000Z',
    );
  });

  test('keeps equal wall-clock times on different dates distinct', () => {
    const first = new Date('2026-07-15T02:00:00.000Z');
    const second = new Date('2026-07-20T02:00:00.000Z');
    expect(appointmentTimeFromInstant(first)).toEqual(appointmentTimeFromInstant(second));
    expect(sameAppointmentDate(first, second)).toBe(false);
  });

  test('adjacent booking intervals do not overlap', () => {
    const first = normalizeAppointmentForStorage(
      new Date('2026-07-15T02:00:00.000Z'),
      new Date('2026-07-15T03:00:00.000Z'),
    );
    const second = normalizeAppointmentForStorage(
      new Date('2026-07-15T03:00:00.000Z'),
      new Date('2026-07-15T04:00:00.000Z'),
    );
    const firstInterval = toBookingInterval(
      first.appointmentDate,
      first.appointmentStartTime,
      first.appointmentEndTime,
    );
    const secondInterval = toBookingInterval(
      second.appointmentDate,
      second.appointmentStartTime,
      second.appointmentEndTime,
    );

    expect(firstInterval.end <= secondInterval.start).toBe(true);
  });

  test('supports reading an existing cross-midnight interval', () => {
    const interval = toBookingInterval(
      new Date('2026-07-15T00:00:00.000Z'),
      new Date('1970-01-01T23:30:00.000Z'),
      new Date('1970-01-01T00:30:00.000Z'),
    );
    expect(interval.end.getTime() - interval.start.getTime()).toBe(60 * 60 * 1000);
  });
});
