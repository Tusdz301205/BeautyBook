import type { ApiNotification } from '../api/notifications';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function operationNotificationTarget(notification: ApiNotification, mode: 'STAFF' | 'OWNER'): { kind: 'BOOKING' | 'IMPACT'; id: string } | null {
  // Never follow actionUrl, external URLs, or use a human-readable booking code.
  if (notification.relatedBooking?.id && UUID.test(notification.relatedBooking.id)) return { kind: 'BOOKING', id: notification.relatedBooking.id };
  // Provider outboxes omit the live booking relation. This ID is only a
  // navigation hint; the destination still fetches through its authorized API.
  if (notification.targetType === 'BOOKING' && notification.targetId && UUID.test(notification.targetId)) return { kind: 'BOOKING', id: notification.targetId };
  if (mode === 'OWNER' && (notification.targetType === 'OPERATIONAL_IMPACT' || notification.targetType === 'OperationalImpactCase') && notification.targetId && UUID.test(notification.targetId)) return { kind: 'IMPACT', id: notification.targetId };
  return null;
}
