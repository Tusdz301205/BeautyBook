import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../constants/colors';
import { formatServiceTimestamp, serviceTimingLines } from '../../utils/bookingTiming';
import { BranchPicker, OperationButton, OperationPage, OperationState } from '../OperationPrimitives';
import { useOperations } from '../OperationsContext';
import { useStaffWork } from './useStaffWork';
import { useWorkActions } from './useWorkActions';
import WorkCard, { ActualElapsed } from './WorkCard';
import { actionFor, actionLabel, allWorkCompleted, appointmentClock, branchDate, shiftDate, todayRows, type TodayRow } from './workModel';

export type StaffWorkStackParams = {
  WorkList: undefined; WorkDetail: { itemId: string }; BookingWork: { bookingId: string };
};
export type WorkScreenProps = NativeStackScreenProps<StaffWorkStackParams, 'WorkList'>;
function useClock() {
  const [now, setNow] = useState(performance.now());
  useEffect(() => { const timer = setInterval(() => setNow(performance.now()), 1000); return () => clearInterval(timer); }, []);
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
  const liveNow = anchor?.key === ops.contextKey ? anchor.server + Math.max(0, now - anchor.local) : Date.now();
  const today = branchDate(liveNow, branch?.timezone);
  const initializedBranch = useRef<string | null>(null);
  useEffect(() => {
    if (agenda && today && ops.branchId && initializedBranch.current !== ops.branchId) {
      initializedBranch.current = ops.branchId;
      ops.setDate(today);
    }
  }, [agenda, today, ops.branchId, ops.setDate]);
  const day = agenda ? ops.date : today;
  const work = useStaffWork({ day, bookingId, includeUnresolved: !agenda && !bookingId });
  useEffect(() => { if (Number.isFinite(work.serverNow)) setAnchor({ server: work.serverNow, local: performance.now(), key: ops.contextKey }); }, [work.serverNow, work.receivedAt, ops.contextKey]);
  const actions = useWorkActions({ identity: work.identity, fresh: work.fresh && !ops.loading && !ops.error, staffId: ops.staffProfile?.id, reload: work.load, refresh: ops.refresh });
  const planning = agenda || !!bookingId;
  const rows = useMemo<TodayRow[]>(() => planning ? [...work.items].sort((a, b) =>
    (a.itemStartAt ?? appointmentClock(a.appointmentStartTime)).localeCompare(b.itemStartAt ?? appointmentClock(b.appointmentStartTime)) || a.id.localeCompare(b.id))
    .map(item => ({ item, kind: 'later' })) : todayRows(work.items, ops.staffProfile?.id), [work.items, planning, ops.staffProfile?.id]);
  const activeCount = work.items.filter(item => item.status === 'IN_PROGRESS').length;
  const unavailable = ops.loading || !ops.canWorkAsStaff || !ops.branchId;
  return <OperationPage title={bookingId ? 'Dịch vụ được giao trong lịch' : agenda ? 'Lịch của tôi' : 'Hôm nay'}>
    <BranchPicker />
    <AccessState />
    {!unavailable && <FlatList data={rows} keyExtractor={row => row.item.id} contentContainerStyle={local.list}
      refreshing={work.loading} onRefresh={() => { void actions.reconcile(); }}
      ListHeaderComponent={<View style={local.header}>
        <Text style={local.date}>{day ?? 'Chưa có múi giờ chi nhánh'}</Text>
        <Text style={local.subtitle}>{agenda ? 'Lên kế hoạch theo ngày · Giờ tại chi nhánh' : 'BeautyBook · Công việc của tôi'}</Text>
        {!agenda && !bookingId && <Text style={local.meta}>Bao gồm công việc chưa xử lý từ ngày trước. Quá giờ không đồng nghĩa khách không đến; kiểm tra tại quầy trước khi thao tác.</Text>}
        {today && agenda && <>
          <OperationButton label="Hôm nay" secondary onPress={() => ops.setDate(today)} />
          <View style={local.weekNav}><OperationButton label="Tuần trước" secondary onPress={() => ops.setDate(shiftDate(ops.date, -7))} />
            <OperationButton label="Tuần sau" secondary onPress={() => ops.setDate(shiftDate(ops.date, 7))} /></View>
          <ScrollView horizontal contentContainerStyle={local.days} showsHorizontalScrollIndicator={false}>
            {Array.from({ length: 7 }, (_, i) => shiftDate(ops.date, i - 3)).map(date => <OperationButton key={date}
              label={`${date.slice(8)} / ${date.slice(5, 7)}`} secondary={date !== ops.date} onPress={() => ops.setDate(date)} />)}
          </ScrollView>
          <Text style={local.meta}>Giờ hiện tại: {formatServiceTimestamp(new Date(liveNow).toISOString(), branch?.timezone)}</Text>
        </>}
        {!today && <OperationState message="Chưa có múi giờ chi nhánh hợp lệ. Không thể xác định ngày làm việc; hãy liên hệ quản lý." />}
        {work.loading && <Text style={local.meta}>Đang cập nhật công việc…</Text>}
        {work.error && <OperationState message={work.error} onRetry={() => { void actions.reconcile(); }} />}
        {actions.message && <OperationState message={actions.message} onRetry={actions.blocked ? () => { void actions.reconcile(); } : undefined} />}
        {!planning && activeCount > 1 && <Text style={local.subtitle}>{activeCount} dịch vụ đang thực hiện</Text>}
        {!planning && allWorkCompleted(work.items, work.fresh && !ops.loading && !ops.error) && <View style={local.done}><Text accessibilityRole="header" style={local.doneTitle}>Bạn đã hoàn thành công việc hôm nay</Text><Text style={local.subtitle}>Các dịch vụ đã hoàn tất vẫn ở bên dưới để bạn xem lại.</Text></View>}
      </View>}
      ListEmptyComponent={!work.loading && !work.error && day ? <OperationState message={bookingId ? 'Không có dịch vụ được giao cho bạn trong lịch này.' : agenda ? 'Bạn chưa có dịch vụ được phân công trong ngày này.' : 'Hôm nay bạn chưa có dịch vụ được phân công.'} /> : null}
      renderItem={({ item: row }) => <View>
        {row.heading && <Text accessibilityRole="header" style={local.section}>{row.heading}</Text>}
        <WorkCard item={row.item} staffId={ops.staffProfile?.id} serverNow={work.serverNow} receivedAt={work.receivedAt}
          variant={planning || row.kind === 'later' || row.kind === 'finished' ? 'compact' : row.kind} primary={row.primary} fresh={work.fresh && !ops.error}
          disabled={!work.fresh || actions.blocked || unavailable || !!ops.error} busy={actions.busyId === row.item.id} onAction={actions.action}
          onOpen={() => navigation.navigate('WorkDetail', { itemId: row.item.id })} />
      </View>} />}
  </OperationPage>;
}

export function StaffDetailScreen({ route }: NativeStackScreenProps<StaffWorkStackParams, 'WorkDetail'>) {
  const work = useStaffWork({ itemId: route.params.itemId });
  const actions = useWorkActions({ identity: work.identity, fresh: work.fresh && !work.ops.loading && !work.ops.error, staffId: work.ops.staffProfile?.id, reload: work.load, refresh: work.ops.refresh });
  const item = work.items[0];
  const action = item ? actionFor(item, work.ops.staffProfile?.id) : null;
  return <OperationPage title="Chi tiết công việc" inStack><AccessState />
    <ScrollView contentContainerStyle={local.list}>
      {work.loading && <OperationState message="Đang đọc lại công việc…" />}
      {work.error && <OperationState message={work.error} onRetry={() => { void actions.reconcile(); }} />}
      {actions.message && <OperationState message={actions.message} onRetry={actions.blocked ? () => { void actions.reconcile(); } : undefined} />}
      {item && <>
        <WorkCard item={item} variant="detail" primary serverNow={work.serverNow} receivedAt={work.receivedAt} fresh={work.fresh && !work.ops.error} />
        <View style={local.detailBlock}><Text accessibilityRole="header" style={local.section}>Thời gian dự kiến</Text>
          {serviceTimingLines(item, item.branch.timezone ?? undefined).filter(line => !line.includes('thực tế') && !line.startsWith('Thời lượng')).map(line => <Text key={line} style={local.meta}>{line}</Text>)}
          <Text style={local.meta}>{item.durationMinutes} phút · {item.branch.name}</Text></View>
        <View style={local.detailBlock}><Text accessibilityRole="header" style={local.section}>Thời gian thực tế</Text>
          {serviceTimingLines(item, item.branch.timezone ?? undefined).filter(line => line.includes('thực tế')).map(line => <Text key={line} style={local.meta}>{line}</Text>)}
          {item.actualTimingSource === 'SERVICE_ADJUSTMENT' && item.actualStartedAt && <ActualElapsed item={item} serverNow={work.serverNow} receivedAt={work.receivedAt} fresh={work.fresh && !work.ops.error} />}</View>
        <View style={local.detailBlock}><Text accessibilityRole="header" style={local.section}>Lịch hẹn</Text>
          <Text style={local.meta}>Mã lịch: {item.bookingCode}</Text>
          <Text style={local.meta}>Ngày tại chi nhánh: {item.appointmentDate.slice(0, 10)}</Text>
          <Text style={local.meta}>Giờ hẹn: {appointmentClock(item.appointmentStartTime)} – {appointmentClock(item.appointmentEndTime)}</Text></View>
        {action && <OperationButton label={actionLabel(action)} onPress={() => actions.action(item, action)} disabled={!work.fresh || actions.blocked || work.ops.loading || !!work.ops.error} busy={!!actions.busyId} />}
      </>}
      {!item && !work.loading && !work.error && work.ops.canWorkAsStaff && <OperationState message="Công việc không còn khả dụng trong ngữ cảnh này." onRetry={() => { void actions.reconcile(); }} />}
    </ScrollView>
  </OperationPage>;
}
const local = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 }, header: { gap: 12, marginBottom: 16 },
  date: { fontSize: 18, fontWeight: '600', color: colors.textDark },
  subtitle: { fontSize: 14, lineHeight: 21, color: colors.textGray },
  done: { padding: 16, gap: 8, backgroundColor: colors.primaryLight, borderRadius: 16 }, doneTitle: { fontSize: 19, fontWeight: '700', color: colors.textDark },
  detailBlock: { backgroundColor: colors.card, padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  meta: { fontSize: 16, lineHeight: 24, color: colors.textBody, marginBottom: 8 },
  section: { fontSize: 17, fontWeight: '700', color: colors.textDark, marginTop: 12, marginBottom: 12 },
  weekNav: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, days: { gap: 8, paddingVertical: 4 },
});
