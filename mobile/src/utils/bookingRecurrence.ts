import type { RecurringPreview, RecurringPreviewInput } from '../api/recurring';
import { BOOKING_ZONE } from './bookingClock';

export function validOccurrenceCount(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const count = Number(value);
  return Number.isInteger(count) && count >= 2 && count <= 52 ? count : null;
}

/** Recurring DTO takes a wall date/time, whereas slots are absolute instants. */
export function recurringInput(input: Omit<RecurringPreviewInput, 'startDate' | 'preferredTime'> & { slot: string }): RecurringPreviewInput | null {
  const { slot, ...rest } = input;
  const instant = new Date(slot);
  if (!Number.isFinite(instant.getTime()) || !Number.isInteger(rest.occurrenceCount)
    || rest.occurrenceCount < 2 || rest.occurrenceCount > 52
    || (rest.staffMode === 'SAME_STAFF' && !rest.staffId)) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BOOKING_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (name: string) => parts.find((item) => item.type === name)?.value;
  return {
    ...rest,
    // ANY_AVAILABLE must search every suitable staff member, even if step 2 selected one.
    staffId: rest.staffMode === 'SAME_STAFF' ? rest.staffId : undefined,
    serviceIds: rest.comboId ? undefined : rest.serviceIds,
    startDate: `${part('year')}-${part('month')}-${part('day')}`,
    preferredTime: `${part('hour')}:${part('minute')}`,
  };
}

export function recurringPreviewReady(preview: RecurringPreview | null, skipConflicts: boolean): boolean {
  return Boolean(preview && preview.availableCount > 0 && (skipConflicts || preview.conflictCount === 0));
}
