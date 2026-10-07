import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useOperationalTime } from '../../hooks/useOperationalTime';
import { operationalTimeLabel } from '../../utils/bookingOperationalTime';
import { OperationButton } from '../OperationPrimitives';
import { actionFor, actionLabel, appointmentClock, arrivalLabel, elapsedLabel, elapsedSeconds, statusLabel, type WorkAction, type WorkItem } from './workModel';

export function WorkState({ item }: { item: WorkItem }) {
  const active = item.status === 'IN_PROGRESS', completed = item.status === 'COMPLETED';
  const arrived = ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(item.bookingStatus);
  const label = active ? 'Đang thực hiện' : completed ? 'Hoàn tất' : item.status === 'SCHEDULED' ? arrivalLabel(item.bookingStatus) : statusLabel(item.status);
  return <View style={styles.state}>
    <Ionicons accessible={false} name={active ? 'ellipse' : arrived || completed ? 'checkmark-circle-outline' : 'ellipse-outline'} size={18} color={active ? colors.primary : arrived || completed ? colors.ratingGreen : colors.textGray} />
    <Text style={[styles.stateLabel, (arrived || completed) && { color: colors.ratingGreen }, active && { color: colors.primary }]}>{label}</Text>
  </View>;
}

export function WorkTimeNotice({ item, serverNow, fresh }: { item: WorkItem; serverNow: number; fresh: boolean }) {
  const now = useOperationalTime(serverNow, fresh);
  const label = operationalTimeLabel(item, item.bookingStatus, now);
  return label ? <Text style={styles.warning}>{label}{!fresh ? ' · Theo lần cập nhật gần nhất' : ''}</Text> : null;
}

function serviceClock(value: string, zone?: string | null) {
  if (!zone || !Number.isFinite(Date.parse(value))) return 'Chưa có giờ dịch vụ';
  try { return new Intl.DateTimeFormat('vi-VN', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)); }
  catch { return 'Múi giờ chưa hợp lệ'; }
}
function PlannedTime({ item, compact = false }: { item: WorkItem; compact?: boolean }) {
  if (!item.itemStartAt) return <Text style={styles.meta}>Giờ hẹn {appointmentClock(item.appointmentStartTime)}{compact ? '' : ' · Chưa có giờ dịch vụ'}</Text>;
  return <Text style={compact ? styles.clock : styles.planned}>{compact ? '' : 'Dự kiến '}{serviceClock(item.itemStartAt, item.branch.timezone)}{!compact && item.itemEndAt ? ` – ${serviceClock(item.itemEndAt, item.branch.timezone)}` : ''}</Text>;
}

/** Only active cards tick; the full FlatList does not re-render every second. */
export function ActualElapsed({ item, serverNow, receivedAt, fresh = true }: { item: WorkItem; serverNow: number; receivedAt: number; fresh?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!fresh || item.status !== 'IN_PROGRESS' || item.actualTimingSource !== 'SERVICE_ADJUSTMENT' || !item.actualStartedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [fresh, item.id, item.status, item.actualTimingSource, item.actualStartedAt, serverNow, receivedAt]);
  const seconds = elapsedSeconds(item, serverNow, receivedAt, fresh ? now : receivedAt);
  return <Text style={[styles.timing, seconds === null && { color: colors.textGray }]}>{!fresh && item.status === 'IN_PROGRESS' ? 'Lúc cập nhật: ' : ''}{elapsedLabel(seconds)}</Text>;
}

export default function WorkCard({ item, staffId, serverNow, receivedAt, onOpen, onAction, disabled, busy, variant = 'next', primary = false, fresh = true }:
  { item: WorkItem; staffId?: string; serverNow: number; receivedAt: number; onOpen?: () => void;
    onAction?: (item: WorkItem, action: WorkAction) => void; disabled?: boolean; busy?: boolean;
    variant?: 'current' | 'next' | 'compact' | 'detail'; primary?: boolean; fresh?: boolean }) {
  const action = actionFor(item, staffId);
  const timeLabel = item.itemStartAt ? `Dự kiến ${serviceClock(item.itemStartAt, item.branch.timezone)}` : `Giờ hẹn ${appointmentClock(item.appointmentStartTime)}`;
  if (variant === 'compact') return <Pressable accessibilityRole="button"
    accessibilityLabel={`${timeLabel}. ${item.customer.fullName}, ${item.serviceNameSnapshot}, ${statusLabel(item.status)}, ${arrivalLabel(item.bookingStatus)}. Xem chi tiết công việc`}
    disabled={!onOpen} onPress={onOpen} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
    <View style={styles.timeColumn}><PlannedTime item={item} compact /></View>
    <View style={styles.rowContent}><Text style={styles.rowCustomer}>{item.customer.fullName || 'Khách hàng'}</Text><Text style={styles.rowService}>{item.serviceNameSnapshot}</Text><WorkState item={item} /><WorkTimeNotice item={item} serverNow={serverNow} fresh={fresh} /></View>
    <Ionicons accessible={false} name="chevron-forward" size={18} color={colors.textGray} />
  </Pressable>;
  return <View style={[styles.card, variant === 'current' && styles.active]}>
    <Text style={[styles.customer, primary && styles.primaryCustomer]}>{item.customer.fullName || 'Khách hàng'}</Text>
    <Text style={styles.service}>{item.serviceNameSnapshot}</Text>
    <WorkState item={item} />
    <WorkTimeNotice item={item} serverNow={serverNow} fresh={fresh} />
    {variant !== 'detail' && <><PlannedTime item={item} /><Text style={styles.meta}>{item.durationMinutes} phút dự kiến</Text></>}
    {item.status === 'IN_PROGRESS' && variant !== 'detail' && <ActualElapsed item={item} serverNow={serverNow} receivedAt={receivedAt} fresh={fresh} />}
    {onAction && action && <OperationButton label={actionLabel(action)} onPress={() => onAction(item, action)} busy={busy} disabled={disabled || busy} />}
    {onOpen && <Pressable accessibilityRole="button" accessibilityLabel={`Xem công việc ${item.serviceNameSnapshot} của ${item.customer.fullName}`}
      style={({ pressed }) => [styles.open, pressed && { opacity: 0.7 }]} onPress={onOpen}><Text style={styles.link}>Chi tiết công việc</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  warning: { fontSize: 14, lineHeight: 21, color: '#8A4914', fontWeight: '600', flexShrink: 1 },
  card: { padding: 18, marginBottom: 12, gap: 10, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  active: { borderColor: colors.primary, borderLeftWidth: 4, backgroundColor: colors.primaryLight },
  customer: { fontSize: 21, fontWeight: '700', color: colors.textDark }, primaryCustomer: { fontSize: 25 },
  service: { fontSize: 17, fontWeight: '600', color: colors.textBody },
  state: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', flexShrink: 1, paddingVertical: 4 },
  stateLabel: { fontSize: 15, lineHeight: 21, color: colors.textGray, fontWeight: '600', flexShrink: 1 },
  planned: { fontSize: 18, fontWeight: '600', color: colors.textDark },
  meta: { fontSize: 14, lineHeight: 21, color: colors.textGray, flexShrink: 1 },
  timing: { fontSize: 18, fontWeight: '700', color: colors.ratingGreen, lineHeight: 26 },
  open: { minHeight: 48, justifyContent: 'center' }, link: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  row: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  timeColumn: { width: 64, flexShrink: 0, alignSelf: 'flex-start', paddingTop: 3 }, clock: { fontSize: 16, fontWeight: '700', color: colors.textDark },
  rowContent: { flex: 1, gap: 4 }, rowCustomer: { fontSize: 17, fontWeight: '600', color: colors.textDark }, rowService: { fontSize: 15, lineHeight: 21, color: colors.textBody },
});
