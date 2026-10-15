import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ownerOperationsApi } from '../../api/ownerOperations';
import { useOperationalTime } from '../../hooks/useOperationalTime';
import { operationalTimeLabel } from '../../utils/bookingOperationalTime';
import { nextScheduleRefresh } from '../../utils/bookingSchedule';
import type { OwnerBooking } from '../../types/ownerOperations';
import { radius, space, tones, type } from '../../theme';
import { OperationButton, OperationState, opStyles } from '../OperationPrimitives';
import { useOwnerData } from './hooks';
import { useOperations } from '../OperationsContext';
import { BookingSummary, Card, Meta } from './OwnerUI';

function BookingRow({ booking, fresh, onOpen }: { booking: OwnerBooking; fresh: boolean; onOpen: () => void }) {
  const now = useOperationalTime(booking.serverNow, fresh);
  const labels = [...new Set(booking.items.map(item => operationalTimeLabel(item, booking.status, now)).filter(Boolean))];
  return <Card tone={labels.length ? 'warning' : undefined}>
    <BookingSummary booking={booking} />
    {labels.map(label => <View key={label} style={styles.warning}><Ionicons accessible={false} name="warning-outline" size={16} color={tones.warning.fg} /><Text style={styles.warningText}>{label}</Text></View>)}
    <OperationButton secondary label={`Xem lịch ${booking.code}`} onPress={onOpen} />
  </Card>;
}

/** Includes carried-over bookings; an overdue planned time is a prompt to verify, never an automatic no-show. */
export function UnfinishedBookings({ onOpen }: { onOpen: (id: string) => void }) {
  const operations = useOperations();
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [operations.branchId]);
  const data = useOwnerData(async scope => scope.branchId ? ownerOperationsApi.unfinished(scope, page) : null, `unfinished:${page}`);
  const stamp = `${operations.contextKey}:${operations.revision}:${operations.branchId}:${data.stamp}`;
  const current = useRef(stamp); current.current = stamp;
  useEffect(() => {
    if (!operations.branchId || operations.loading || operations.error || data.loading || data.error || !data.data ||
      data.receivedAt === undefined || data.scope.isCurrent?.() === false) return;
    const delay = nextScheduleRefresh(data.data.data);
    if (delay === null) return;
    let alive = true;
    const timer = setTimeout(() => {
      if (alive && current.current === stamp && data.scope.isCurrent?.() !== false) data.reload();
    }, Math.max(0, delay - Math.max(0, performance.now() - data.receivedAt)));
    return () => { alive = false; clearTimeout(timer); };
  }, [stamp, operations.branchId, operations.loading, operations.error, data.data, data.receivedAt, data.loading, data.error, data.reload]);
  return <View>
    <Text accessibilityRole="header" style={opStyles.section}>Lịch chưa kết thúc</Text>
    <Meta>Bao gồm lịch từ ngày trước. Giờ dự kiến đã qua vẫn cần kiểm tra — không tự kết luận khách vắng mặt.</Meta>
    <View style={styles.body}>
      {!operations.branchId ? <OperationState message="Chọn một chi nhánh để xem và xử lý lịch chưa kết thúc." /> : <>
        {data.loading && <OperationState message="Đang cập nhật lịch chưa kết thúc…" />}
        {data.error && <OperationState tone="error" message={data.error} onRetry={data.reload} />}
        {data.data?.data.map(booking => <BookingRow key={booking.id} booking={booking} fresh={!data.loading && !data.error} onOpen={() => onOpen(booking.id)} />)}
        {!data.loading && !data.error && data.data && !data.data.total && <OperationState message="Không có lịch chưa kết thúc trong chi nhánh này." />}
        {data.data && data.data.total > 0 && <>
          <Meta>Trang {page} · tổng {data.data.total} lịch chưa kết thúc trong chi nhánh này</Meta>
          <View style={styles.pager}>
            <View style={styles.flex}><OperationButton secondary label="Trang trước" disabled={page === 1 || data.loading} onPress={() => setPage(value => value - 1)} /></View>
            <View style={styles.flex}><OperationButton secondary label="Trang sau" disabled={page * 20 >= data.data.total || data.loading} onPress={() => setPage(value => value + 1)} /></View>
          </View>
        </>}
      </>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { marginTop: space.md },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs + 2, borderRadius: radius.sm, backgroundColor: tones.warning.bg, paddingHorizontal: space.sm, paddingVertical: space.xs },
  warningText: { ...type.secondaryStrong, color: tones.warning.fg, flexShrink: 1 },
  pager: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
});
