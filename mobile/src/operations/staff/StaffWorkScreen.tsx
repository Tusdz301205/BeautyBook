import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../constants/colors';
import { formatServiceTimestamp, serviceTimingLines } from '../../utils/bookingTiming';
import { BranchPicker, OperationButton, OperationPage, OperationState } from '../OperationPrimitives';
import { useOperations } from '../OperationsContext';
import { useStaffWork } from './useStaffWork';
import { useWorkActions } from './useWorkActions';
import WorkCard from './WorkCard';
import { appointmentClock, branchDate, orderWork, shiftDate, elapsedLabel, elapsedSeconds } from './workModel';

export type StaffWorkStackParams = {
  WorkList: undefined; WorkDetail: { itemId: string }; BookingWork: { bookingId: string };
};
export type WorkScreenProps = NativeStackScreenProps<StaffWorkStackParams, 'WorkList'>;
function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return now;
}
function AccessState() {
  const ops = useOperations();
  if (ops.loading) return <OperationState message="Đang tải ngữ cảnh làm việc…" />;
  if (ops.error) return <OperationState message={ops.error} onRetry={ops.refresh} />;
  if (!ops.staffProfile || ops.staffProfile.status !== 'ACTIVE') return <OperationState message="Hồ sơ nhân viên chưa được liên kết hoặc không còn hoạt động. Hãy liên hệ quản lý để tiếp tục." onRetry={ops.refresh} />;
  if (!ops.canWorkAsStaff) return <OperationState message="Bạn chưa có quyền thực hiện công việc trong chi nhánh này." onRetry={ops.refresh} />;
  if (!ops.branchId) return <OperationState message="Chọn chi nhánh có quyền để xem công việc." />;
  return null;
}

export function StaffListScreen({ navigation, agenda = false, bookingId }: { navigation: Pick<NativeStackNavigationProp<StaffWorkStackParams>, 'navigate'>; agenda?: boolean; bookingId?: string }) {
  const ops = useOperations(), now = useClock();
  const branch = ops.branches.find(value => value.id === ops.branchId);
  const [anchor, setAnchor] = useState<{ server: number; local: number; key: string } | null>(null);
  const today = branchDate(anchor?.key === ops.contextKey ? anchor.server + now - anchor.local : now, branch?.timezone);
  const initializedBranch = useRef<string | null>(null);
  useEffect(() => {
    if (agenda && today && ops.branchId && initializedBranch.current !== ops.branchId) {
      initializedBranch.current = ops.branchId;
      ops.setDate(today);
    }
  }, [agenda, today, ops.branchId, ops.setDate]);
  const day = agenda ? ops.date : today;
  const work = useStaffWork({ day, bookingId });
  useEffect(() => { if (Number.isFinite(work.serverNow)) setAnchor({ server: work.serverNow, local: work.receivedAt, key: ops.contextKey }); }, [work.serverNow, work.receivedAt, ops.contextKey]);
  const actions = useWorkActions({ identity: work.identity, fresh: work.fresh && !ops.loading && !ops.error, staffId: ops.staffProfile?.id, reload: work.load, refresh: ops.refresh });
  const ordered = useMemo(() => agenda ? [...work.items].sort((a, b) => (a.itemStartAt ?? a.appointmentStartTime).localeCompare(b.itemStartAt ?? b.appointmentStartTime)) : orderWork(work.items), [work.items, agenda]);
  const activeCount = ordered.filter(item => item.status === 'IN_PROGRESS').length;
  const nextId = ordered.find(item => item.status === 'SCHEDULED')?.id;
  const unavailable = ops.loading || !ops.canWorkAsStaff || !ops.branchId;
  return <OperationPage title={bookingId ? 'Dịch vụ được giao trong lịch' : agenda ? 'Lịch của tôi' : 'Hôm nay'}>
    <BranchPicker />
    <AccessState />
    {!unavailable && <FlatList data={ordered} keyExtractor={item => item.id} contentContainerStyle={local.list}
      refreshing={work.loading} onRefresh={() => { void actions.reconcile(); }}
      ListHeaderComponent={<View style={local.header}>
        <Text style={local.date}>{day ?? 'Chưa có múi giờ chi nhánh'} · {branch?.name}</Text>
        {today && agenda && <>
          <OperationButton label="Hôm nay" secondary onPress={() => ops.setDate(today)} />
          <View style={local.weekNav}><OperationButton label="Tuần trước" secondary onPress={() => ops.setDate(shiftDate(ops.date, -7))} />
            <OperationButton label="Tuần sau" secondary onPress={() => ops.setDate(shiftDate(ops.date, 7))} /></View>
          <ScrollView horizontal contentContainerStyle={local.days} showsHorizontalScrollIndicator={false}>
            {Array.from({ length: 7 }, (_, i) => shiftDate(ops.date, i - 3)).map(date => <OperationButton key={date}
              label={`${date.slice(8)} / ${date.slice(5, 7)}`} secondary={date !== ops.date} onPress={() => ops.setDate(date)} />)}
          </ScrollView>
          <Text style={local.meta}>Giờ hiện tại: {formatServiceTimestamp(new Date(Number.isFinite(work.serverNow) ? work.serverNow + now - work.receivedAt : now).toISOString(), branch?.timezone)}</Text>
        </>}
        {!today && <OperationState message="Chưa có múi giờ chi nhánh hợp lệ. Không thể xác định ngày làm việc; hãy liên hệ quản lý." />}
        {work.loading && <Text style={local.meta}>Đang cập nhật công việc…</Text>}
        {work.error && <OperationState message={work.error} onRetry={() => { void actions.reconcile(); }} />}
        {actions.message && <OperationState message={actions.message} onRetry={actions.blocked ? () => { void actions.reconcile(); } : undefined} />}
        {!agenda && activeCount > 1 && <Text style={local.meta}>Có {activeCount} dịch vụ đang thực hiện. Tất cả được hiển thị bên dưới.</Text>}
      </View>}
      ListEmptyComponent={!work.loading && !work.error && day ? <OperationState message={bookingId ? 'Không có dịch vụ được giao cho bạn trong lịch này.' : 'Chưa có công việc được giao trong ngày này.'} /> : null}
      renderItem={({ item, index }) => <View>
        {!agenda && (index === 0 || item.id === nextId || (index > 0 && ordered[index - 1].id === nextId)) &&
          <Text accessibilityRole="header" style={local.section}>{item.status === 'IN_PROGRESS' ? 'Đang thực hiện' : item.id === nextId ? 'Dịch vụ tiếp theo' : 'Công việc trong ngày'}</Text>}
        <WorkCard item={item} staffId={ops.staffProfile?.id} now={now} serverNow={work.serverNow} receivedAt={work.receivedAt}
          disabled={!work.fresh || actions.blocked || unavailable || !!ops.error} busy={actions.busyId === item.id} onAction={actions.action}
          onOpen={() => navigation.navigate('WorkDetail', { itemId: item.id })} />
      </View>} />}
  </OperationPage>;
}

export function StaffDetailScreen({ route }: NativeStackScreenProps<StaffWorkStackParams, 'WorkDetail'>) {
  const work = useStaffWork({ itemId: route.params.itemId }), now = useClock();
  const actions = useWorkActions({ identity: work.identity, fresh: work.fresh && !work.ops.loading && !work.ops.error, staffId: work.ops.staffProfile?.id, reload: work.load, refresh: work.ops.refresh });
  const item = work.items[0];
  return <OperationPage title="Chi tiết công việc"><AccessState />
    <ScrollView contentContainerStyle={local.list}>
      {work.loading && <OperationState message="Đang đọc lại công việc…" />}
      {work.error && <OperationState message={work.error} onRetry={() => { void actions.reconcile(); }} />}
      {actions.message && <OperationState message={actions.message} onRetry={actions.blocked ? () => { void actions.reconcile(); } : undefined} />}
      {item && <>
        <WorkCard item={item} staffId={work.ops.staffProfile?.id} now={now} serverNow={work.serverNow} receivedAt={work.receivedAt}
          onAction={actions.action} disabled={!work.fresh || actions.blocked || work.ops.loading || !!work.ops.error} busy={!!actions.busyId} />
        <Text accessibilityRole="header" style={local.section}>Thời gian dịch vụ</Text>
        {serviceTimingLines(item, item.branch.timezone ?? undefined).map(line => <Text key={line} style={local.meta}>{line}</Text>)}
        {item.status !== 'IN_PROGRESS' && <Text style={local.meta}>{elapsedLabel(elapsedSeconds(item, work.serverNow, work.receivedAt, now))}</Text>}
        <Text accessibilityRole="header" style={local.section}>Lịch hẹn</Text>
        <Text style={local.meta}>Mã lịch: {item.bookingCode}</Text>
        <Text style={local.meta}>Ngày hẹn tại chi nhánh: {item.appointmentDate.slice(0, 10)}</Text>
        <Text style={local.meta}>Giờ hẹn: {appointmentClock(item.appointmentStartTime)} – {appointmentClock(item.appointmentEndTime)}</Text>
      </>}
      {!item && !work.loading && !work.error && work.ops.canWorkAsStaff && <OperationState message="Công việc không còn khả dụng trong ngữ cảnh này." onRetry={() => { void actions.reconcile(); }} />}
    </ScrollView>
  </OperationPage>;
}
const local = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 }, header: { gap: 12, marginBottom: 16 },
  date: { fontSize: 18, fontWeight: '600', color: colors.textDark },
  meta: { fontSize: 16, lineHeight: 24, color: colors.textBody, marginBottom: 8 },
  section: { fontSize: 17, fontWeight: '700', color: colors.textDark, marginTop: 12, marginBottom: 12 },
  weekNav: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, days: { gap: 8, paddingVertical: 4 },
});
