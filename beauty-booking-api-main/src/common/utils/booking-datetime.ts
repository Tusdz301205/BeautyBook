/**
 * Canonical conversion for the legacy booking schema:
 *
 * - appointmentDate      PostgreSQL DATE (calendar day)
 * - appointmentStartTime PostgreSQL TIME (local wall clock)
 * - appointmentEndTime   PostgreSQL TIME (local wall clock)
 *
 * Prisma exposes DATE/TIME values as JavaScript Date objects. A TIME value is
 * not an instant and must never be compared directly with Date.now(). These
 * helpers are the only place that combines the two database columns into a
 * real instant.
 */
export const BOOKING_TIME_ZONE = process.env.BOOKING_TIME_ZONE ?? 'Asia/Ho_Chi_Minh';

export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  formatterCache.set(timeZone, created);
  return created;
}

export function getZonedDateTimeParts(
  instant: Date,
  timeZone: string = BOOKING_TIME_ZONE,
): ZonedDateTimeParts {
  if (Number.isNaN(instant.getTime())) throw new RangeError('Invalid appointment instant');
  const values: Record<string, number> = {};
  for (const part of formatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
    millisecond: instant.getUTCMilliseconds(),
  };
}

function partsStamp(parts: ZonedDateTimeParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
}

/** Interpret calendar/wall-clock parts in `timeZone` and return the real UTC instant. */
export function zonedDateTimeToInstant(
  desired: ZonedDateTimeParts,
  timeZone: string = BOOKING_TIME_ZONE,
): Date {
  const requestedStamp = partsStamp(desired);
  let guess = new Date(requestedStamp);

  // Two passes cover normal zones and DST offset boundaries. A third pass is
  // retained to make the equality check deterministic for unusual transitions.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getZonedDateTimeParts(guess, timeZone);
    const difference = requestedStamp - partsStamp(actual);
    if (difference === 0) return guess;
    guess = new Date(guess.getTime() + difference);
  }

  const actual = getZonedDateTimeParts(guess, timeZone);
  if (partsStamp(actual) !== requestedStamp) {
    throw new RangeError(`Local appointment time does not exist in ${timeZone}`);
  }
  return guess;
}

export function appointmentDateFromInstant(
  instant: Date,
  timeZone: string = BOOKING_TIME_ZONE,
): Date {
  const parts = getZonedDateTimeParts(instant, timeZone);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function appointmentTimeFromInstant(
  instant: Date,
  timeZone: string = BOOKING_TIME_ZONE,
): Date {
  const parts = getZonedDateTimeParts(instant, timeZone);
  return new Date(
    Date.UTC(1970, 0, 1, parts.hour, parts.minute, parts.second, parts.millisecond),
  );
}

export function combineAppointmentDateTime(
  appointmentDate: Date,
  appointmentTime: Date,
  timeZone: string = BOOKING_TIME_ZONE,
): Date {
  if (
    Number.isNaN(appointmentDate.getTime()) ||
    Number.isNaN(appointmentTime.getTime())
  ) {
    throw new RangeError('Invalid booking date/time value');
  }
  return zonedDateTimeToInstant(
    {
      year: appointmentDate.getUTCFullYear(),
      month: appointmentDate.getUTCMonth() + 1,
      day: appointmentDate.getUTCDate(),
      hour: appointmentTime.getUTCHours(),
      minute: appointmentTime.getUTCMinutes(),
      second: appointmentTime.getUTCSeconds(),
      millisecond: appointmentTime.getUTCMilliseconds(),
    },
    timeZone,
  );
}

export function normalizeAppointmentForStorage(
  start: Date,
  end: Date,
  timeZone: string = BOOKING_TIME_ZONE,
): {
  appointmentDate: Date;
  appointmentStartTime: Date;
  appointmentEndTime: Date;
} {
  return {
    appointmentDate: appointmentDateFromInstant(start, timeZone),
    appointmentStartTime: appointmentTimeFromInstant(start, timeZone),
    appointmentEndTime: appointmentTimeFromInstant(end, timeZone),
  };
}

export function toBookingInterval(
  appointmentDate: Date,
  appointmentStartTime: Date,
  appointmentEndTime: Date,
  timeZone: string = BOOKING_TIME_ZONE,
): { start: Date; end: Date } {
  const start = combineAppointmentDateTime(appointmentDate, appointmentStartTime, timeZone);
  let end = combineAppointmentDateTime(appointmentDate, appointmentEndTime, timeZone);
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function sameAppointmentDate(
  first: Date,
  second: Date,
  timeZone: string = BOOKING_TIME_ZONE,
): boolean {
  return (
    appointmentDateFromInstant(first, timeZone).getTime() ===
    appointmentDateFromInstant(second, timeZone).getTime()
  );
}

export function timeValueMinutes(value: Date): number {
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}
