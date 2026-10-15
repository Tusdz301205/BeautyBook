import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, space, tones, type, type Tone, fw } from '../../theme';
import { useOperationalTime } from '../../hooks/useOperationalTime';
import { operationalTimeLabel } from '../../utils/bookingOperationalTime';
import { appointmentClock, arrivalLabel, elapsedLabel, elapsedSeconds, statusLabel, workArrivalLabel, workStatusLabel, type WorkItem } from './workModel';

function stateLook(item: WorkItem): { label: string; tone: Tone; icon: keyof typeof Ionicons.glyphMap } {
  if (item.status === 'CANCELLED') return { label: statusLabel(item.status), tone: 'danger', icon: 'close-circle-outline' };
  if (item.status === 'SKIPPED') return { label: statusLabel(item.status), tone: 'neutral', icon: 'remove-circle-outline' };
  if (item.status === 'COMPLETED') return { label: statusLabel(item.status), tone: 'success', icon: 'checkmark-done-outline' };
  if (item.bookingStatus === 'CHECKED_IN') return { label: workStatusLabel(item), tone: 'arrived', icon: 'enter-outline' };
  if (item.status === 'IN_PROGRESS') return { label: 'Đang thực hiện', tone: 'brand', icon: 'play-circle-outline' };
  if (item.status === 'SCHEDULED') {
    const arrived = ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(item.bookingStatus);
    return arrived
      ? { label: arrivalLabel(item.bookingStatus), tone: 'arrived', icon: 'enter-outline' }
      : { label: ['PENDING', 'CONFIRMED'].includes(item.bookingStatus) ? statusLabel(item.status) : arrivalLabel(item.bookingStatus), tone: ['CANCELLED', 'NO_SHOW', 'REJECTED'].includes(item.bookingStatus) ? 'danger' : 'neutral', icon: 'hourglass-outline' };
  }
  return { label: statusLabel(item.status), tone: 'neutral', icon: 'remove-circle-outline' };
}

export function WorkState({ item }: { item: WorkItem }) {
  const look = stateLook(item);
  const palette = tones[look.tone];
  return <View style={[styles.state, { backgroundColor: palette.bg }]}>
    <Ionicons accessible={false} name={look.icon} size={16} color={palette.fg} />
    <Text style={[styles.stateLabel, { color: palette.fg }]}>{look.label}</Text>
  </View>;
}

export function WorkTimeNotice({ item, serverNow, fresh }: { item: WorkItem; serverNow: number; fresh: boolean }) {
  const now = useOperationalTime(serverNow, fresh);
  const label = operationalTimeLabel(item, item.bookingStatus, now);
  return label ? <View style={styles.warning}>
    <Ionicons accessible={false} name="warning-outline" size={16} color={tones.warning.fg} />
    <Text style={styles.warningText}>{label}{!fresh ? ' · Theo lần cập nhật gần nhất' : ''}</Text>
  </View> : null;
}

function serviceClock(value: string, zone?: string | null) {
  if (!zone || !Number.isFinite(Date.parse(value))) return 'Chưa có giờ dịch vụ';
  try { return new Intl.DateTimeFormat('vi-VN', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)); }
  catch { return 'Múi giờ chưa hợp lệ'; }
}
function PlannedTime({ item, compact = false }: { item: WorkItem; compact?: boolean }) {
  if (!item.itemStartAt) return <Text style={compact ? styles.clockMuted : styles.meta}>{compact ? appointmentClock(item.appointmentStartTime) : `Giờ hẹn ${appointmentClock(item.appointmentStartTime)} · Chưa có giờ dịch vụ`}</Text>;
  if (compact) return <Text style={styles.clock}>{serviceClock(item.itemStartAt, item.branch.timezone)}</Text>;
  return <View style={styles.planned}>
    <Ionicons accessible={false} name="time-outline" size={16} color={colors.secondaryText} />
    <Text style={styles.plannedText}>Dự kiến {serviceClock(item.itemStartAt, item.branch.timezone)}{item.itemEndAt ? ` – ${serviceClock(item.itemEndAt, item.branch.timezone)}` : ''}</Text>
    <Text style={styles.meta}>· {item.durationMinutes} phút</Text>
  </View>;
}

/** Only active cards tick; the full FlatList does not re-render every second. */
export function ActualElapsed({ item, serverNow, receivedAt, fresh = true }: { item: WorkItem; serverNow: number; receivedAt: number; fresh?: boolean }) {
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    setNow(performance.now());
    if (!fresh || item.status !== 'IN_PROGRESS' || item.actualTimingSource !== 'SERVICE_ADJUSTMENT' || !item.actualStartedAt) return;
    const timer = setInterval(() => setNow(performance.now()), 1000);
    return () => clearInterval(timer);
  }, [fresh, item.id, item.status, item.actualTimingSource, item.actualStartedAt, serverNow, receivedAt]);
  const seconds = elapsedSeconds(item, serverNow, receivedAt, fresh ? now : receivedAt);
  return <View style={styles.elapsed}>
    <Ionicons accessible={false} name="stopwatch-outline" size={18} color={seconds === null ? colors.secondaryText : colors.primary} />
    <Text style={[styles.timing, seconds === null && styles.timingUnknown]}>{!fresh && item.status === 'IN_PROGRESS' ? 'Lúc cập nhật: ' : ''}{elapsedLabel(seconds)}</Text>
  </View>;
}

export default function WorkCard({ item, staffId, serverNow, receivedAt, onOpen, variant = 'next', primary = false, fresh = true }:
  { item: WorkItem; staffId?: string; serverNow: number; receivedAt: number; onOpen?: () => void;
    variant?: 'current' | 'next' | 'compact' | 'detail'; primary?: boolean; fresh?: boolean }) {
  const timeLabel = item.itemStartAt ? `Dự kiến ${serviceClock(item.itemStartAt, item.branch.timezone)}` : `Giờ hẹn ${appointmentClock(item.appointmentStartTime)}`;
  const arrival = workArrivalLabel(item);
  const terminal = ['CANCELLED', 'SKIPPED', 'COMPLETED'].includes(item.status);
  if (variant === 'compact') return <Pressable accessibilityRole="button"
    accessibilityLabel={`${timeLabel}. ${item.customer.fullName}, ${item.serviceNameSnapshot}, ${workStatusLabel(item)}, ${arrival}. Xem chi tiết công việc`}
    disabled={!onOpen} onPress={onOpen} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <View style={styles.timeColumn}><PlannedTime item={item} compact /></View>
    <View style={styles.rowContent}>
      <Text style={styles.rowCustomer}>{item.customer.fullName || 'Khách hàng'}</Text>
      <Text style={styles.rowService}>{item.serviceNameSnapshot}</Text>
      <WorkState item={item} />
      {terminal && <Text style={styles.meta}>{arrival}</Text>}
      <WorkTimeNotice item={item} serverNow={serverNow} fresh={fresh} />
    </View>
    <Ionicons accessible={false} name="chevron-forward" size={18} color={colors.secondaryText} />
  </Pressable>;
  return <View style={[styles.card, variant === 'current' && styles.active]}>
    <Text style={[styles.customer, primary && styles.primaryCustomer]}>{item.customer.fullName || 'Khách hàng'}</Text>
    <Text style={styles.service}>{item.serviceNameSnapshot}</Text>
    <View style={styles.badges}><WorkState item={item} /></View>
    {terminal && <Text style={styles.meta}>{arrival}</Text>}
    <WorkTimeNotice item={item} serverNow={serverNow} fresh={fresh} />
    {variant !== 'detail' && <PlannedTime item={item} />}
    {item.status === 'IN_PROGRESS' && variant !== 'detail' && <ActualElapsed item={item} serverNow={serverNow} receivedAt={receivedAt} fresh={fresh} />}
    {onOpen && <Pressable accessibilityRole="button" accessibilityLabel={`Xem công việc ${item.serviceNameSnapshot} của ${item.customer.fullName}, ${workStatusLabel(item)}, ${arrival}`}
      style={({ pressed }) => [styles.open, pressed && styles.pressed]} onPress={onOpen}>
      <Text style={styles.link}>Chi tiết công việc</Text>
      <Ionicons accessible={false} name="chevron-forward" size={16} color={colors.primary} />
    </Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.surfacePressed },
  card: { padding: space.lg, marginBottom: space.md, gap: space.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  active: { borderColor: '#E3C3D2', borderLeftWidth: 4, borderLeftColor: colors.primary, backgroundColor: colors.primarySoft },
  customer: { ...type.h2 },
  primaryCustomer: { ...type.display },
  service: { ...type.body, color: colors.body, ...fw.medium },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  state: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', flexShrink: 1, borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: space.xs },
  stateLabel: { ...type.caption, fontSize: 13, ...fw.semibold, flexShrink: 1 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs + 2, alignSelf: 'flex-start', borderRadius: radius.sm, backgroundColor: tones.warning.bg, paddingHorizontal: space.sm, paddingVertical: space.xs },
  warningText: { ...type.secondaryStrong, color: tones.warning.fg, flexShrink: 1 },
  planned: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xs + 2 },
  plannedText: { ...type.clock },
  meta: { ...type.secondary, flexShrink: 1 },
  elapsed: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  timing: { ...type.clock, fontSize: 17, color: colors.primary },
  timingUnknown: { color: colors.secondaryText, ...fw.medium },
  open: { minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, borderRadius: radius.sm, paddingRight: space.sm },
  link: { ...type.secondaryStrong, color: colors.primary },
  row: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.md, marginBottom: space.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  timeColumn: { minWidth: 56, flexShrink: 0, alignSelf: 'flex-start', paddingTop: 2 },
  clock: { ...type.clock },
  clockMuted: { ...type.clock, color: colors.secondaryText },
  rowContent: { flex: 1, gap: space.xs },
  rowCustomer: { ...type.bodyStrong },
  rowService: { ...type.secondary, color: colors.body },
});
