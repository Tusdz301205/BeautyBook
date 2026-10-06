import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { formatServiceTimestamp } from '../../utils/bookingTiming';
import { OperationButton } from '../OperationPrimitives';
import { actionFor, appointmentClock, arrivalLabel, elapsedLabel, elapsedSeconds, statusLabel, type WorkAction, type WorkItem } from './workModel';

export default function WorkCard({ item, staffId, now, serverNow, receivedAt, onOpen, onAction, disabled, busy }:
  { item: WorkItem; staffId?: string; now: number; serverNow: number; receivedAt: number; onOpen?: () => void;
    onAction?: (item: WorkItem, action: WorkAction) => void; disabled?: boolean; busy?: boolean }) {
  const action = actionFor(item, staffId);
  return <View style={[styles.card, item.status === 'IN_PROGRESS' && styles.active]}>
    <Text style={styles.status}>{statusLabel(item.status)}</Text>
    <Text style={styles.customer}>{item.customer.fullName || 'Khách hàng'}</Text>
    <Text style={styles.service}>{item.serviceNameSnapshot}</Text>
    <Text style={styles.meta}>{arrivalLabel(item.bookingStatus)}</Text>
    <Text style={styles.meta}>{item.itemStartAt ? `Dự kiến: ${formatServiceTimestamp(item.itemStartAt, item.branch.timezone ?? undefined)}` : `Giờ hẹn: ${appointmentClock(item.appointmentStartTime)} · Giờ dịch vụ chưa có dữ liệu`}</Text>
    <Text style={styles.meta}>{item.durationMinutes} phút dự kiến · {item.branch.name}</Text>
    {item.status === 'IN_PROGRESS' && <Text style={styles.timing}>{elapsedLabel(elapsedSeconds(item, serverNow, receivedAt, now))}</Text>}
    {onOpen && <Pressable accessibilityRole="button" accessibilityLabel={`Xem công việc ${item.serviceNameSnapshot} của ${item.customer.fullName}`}
      style={({ pressed }) => [styles.open, pressed && { opacity: 0.7 }]} onPress={onOpen}><Text style={styles.link}>Xem chi tiết công việc</Text></Pressable>}
    {onAction && action && <OperationButton label={action === 'START' ? 'Bắt đầu dịch vụ' : 'Hoàn tất dịch vụ'}
      onPress={() => onAction(item, action)} busy={busy} disabled={disabled || busy} />}
  </View>;
}
export const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12, gap: 8, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  active: { borderColor: colors.primary, borderLeftWidth: 4 },
  customer: { fontSize: 20, fontWeight: '700', color: colors.textDark },
  service: { fontSize: 17, fontWeight: '600', color: colors.textBody },
  status: { fontSize: 14, color: colors.primary, fontWeight: '700' },
  meta: { fontSize: 16, lineHeight: 24, color: colors.textBody },
  timing: { fontSize: 16, fontWeight: '600', color: colors.ratingGreen },
  open: { minHeight: 48, justifyContent: 'center' },
  link: { fontSize: 16, color: colors.primary, fontWeight: '600' },
});
