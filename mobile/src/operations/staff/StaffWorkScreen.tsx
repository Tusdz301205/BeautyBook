import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, layout, radius, space, type, fw } from '../../theme';
import { IconButton } from '../../ui';
import { formatServiceTimestamp, serviceTimingLines } from '../../utils/bookingTiming';
import { BranchPicker, OperationButton, OperationPage, OperationState } from '../OperationPrimitives';
import { useOperations } from '../OperationsContext';
import { useStaffWork } from './useStaffWork';
import WorkCard, { ActualElapsed } from './WorkCard';
import { appointmentClock, branchDate, shiftDate, todayRows, type TodayRow } from './workModel';

export type StaffWorkStackParams = {
  WorkList: undefined; WorkDetail: { itemId: string }; BookingWork: { bookingId: string };
};
export type WorkScreenProps = NativeStackScreenProps<StaffWorkStackParams, 'WorkList'>;
function useClock() {
  const [now, setNow] = useState(performance.now());
  useEffect(() => { const timer = setInterval(() => setNow(performance.now()), 1000); return () => clearInterval(timer); }, []);
  return now;
}
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEKDAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
/** Branch calendar date (YYYY-MM-DD) to a Vietnamese label; noon UTC keeps the weekday stable. */
function dayLabel(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return `${WEEKDAY_NAMES[weekday] ?? ''}, ${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}
function AccessState() {
  const ops = useOperations();
  if (ops.loading) return <OperationState message="Đang tải thông tin làm việc…" />;
  if (ops.error) return <OperationState tone="error" message={ops.error} onRetry={ops.refresh} />;
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
  const rows = useMemo<TodayRow[]>(() => todayRows(work.items), [work.items]);
  const unavailable = ops.loading || !ops.canWorkAsStaff || !ops.branchId;
  const title = bookingId ? 'Dịch vụ trong lịch hẹn' : agenda ? 'Lịch của tôi' : 'Hôm nay';
  return <OperationPage title={title} subtitle={day ? `${dayLabel(day)} · giờ chi nhánh` : undefined} inStack={!!bookingId}>
    <View style={local.context}><BranchPicker inset={false} /></View>
    <View style={local.gutter}><AccessState /></View>
    {!unavailable && <FlatList data={rows} keyExtractor={row => row.item.id} contentContainerStyle={local.list}
      refreshing={work.loading} onRefresh={() => { void work.load(); }}
      ListHeaderComponent={<View style={local.header}>
        {today && agenda && <View style={local.planner}>
          <View style={local.weekNav}>
            <IconButton icon="chevron-back" label="Tuần trước" onPress={() => ops.setDate(shiftDate(ops.date, -7))} />
            <Text style={local.weekLabel}>Tháng {ops.date.slice(5, 7)}/{ops.date.slice(0, 4)}</Text>
            <IconButton icon="chevron-forward" label="Tuần sau" onPress={() => ops.setDate(shiftDate(ops.date, 7))} />
          </View>
          <ScrollView horizontal contentContainerStyle={local.days} showsHorizontalScrollIndicator={false}>
            {Array.from({ length: 7 }, (_, i) => shiftDate(ops.date, i - 3)).map(date => {
              const selected = date === ops.date;
              const isToday = date === today;
              return <Pressable key={date} accessibilityRole="button" accessibilityLabel={`${dayLabel(date)}${isToday ? ', hôm nay' : ''}`} accessibilityState={{ selected }}
                onPress={() => ops.setDate(date)} style={[local.day, selected && local.daySelected]}>
                <Text style={[local.dayName, selected && local.daySelectedText]}>{WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]}</Text>
                <Text style={[local.dayNumber, selected && local.daySelectedText]}>{date.slice(8)}</Text>
                {isToday ? <View style={[local.todayDot, selected && local.todayDotSelected]} /> : null}
              </Pressable>;
            })}
          </ScrollView>
          {ops.date !== today && <OperationButton label="Về hôm nay" secondary icon="today-outline" onPress={() => ops.setDate(today)} />}
          <Text style={local.meta}>Giờ hiện tại tại chi nhánh: {formatServiceTimestamp(new Date(liveNow).toISOString(), branch?.timezone)}</Text>
        </View>}
        {!agenda && !bookingId && <Text style={local.meta}>Lịch dự kiến theo giờ chi nhánh. Quầy ghi nhận khách đến; lịch đã qua không xác nhận thời gian thực tế.</Text>}
        {!today && <OperationState tone="warning" message="Chưa có múi giờ chi nhánh hợp lệ. Không thể xác định ngày làm việc; hãy liên hệ quản lý." />}
        {work.loading && <Text style={local.meta} accessibilityLiveRegion="polite">Đang cập nhật công việc…</Text>}
        {work.error && <OperationState tone="error" message={work.error} onRetry={() => { void work.load(); }} />}
      </View>}
      ListEmptyComponent={!work.loading && !work.error && day ? <OperationState message={bookingId ? 'Không có dịch vụ được giao cho bạn trong lịch này.' : agenda ? 'Bạn chưa có dịch vụ được phân công trong ngày này.' : 'Hôm nay bạn chưa có dịch vụ được phân công.'} /> : null}
      renderItem={({ item: row }) => <View>
        <WorkCard item={row.item} staffId={ops.staffProfile?.id} serverNow={work.serverNow} receivedAt={work.receivedAt}
          variant="compact" fresh={work.fresh && !ops.error}
          onOpen={() => navigation.navigate('WorkDetail', { itemId: row.item.id })} />
      </View>} />}
  </OperationPage>;
}

export function StaffDetailScreen({ route }: NativeStackScreenProps<StaffWorkStackParams, 'WorkDetail'>) {
  const work = useStaffWork({ itemId: route.params.itemId });
  const item = work.items[0];
  return <OperationPage title="Chi tiết công việc" inStack><View style={local.gutter}><AccessState /></View>
    <ScrollView contentContainerStyle={local.list}>
      {work.loading && <OperationState message="Đang đọc lại công việc…" />}
      {work.error && <OperationState tone="error" message={work.error} onRetry={() => { void work.load(); }} />}
      {item && <>
        <WorkCard item={item} variant="detail" primary serverNow={work.serverNow} receivedAt={work.receivedAt} fresh={work.fresh && !work.ops.error} />
        <View style={local.detailBlock}><Text accessibilityRole="header" style={local.blockTitle}>Thời gian dự kiến</Text>
          {serviceTimingLines(item, item.branch.timezone ?? undefined).filter(line => !line.includes('thực tế') && !line.startsWith('Thời lượng')).map(line => <Text key={line} style={local.line}>{line}</Text>)}
          <Text style={local.line}>{item.durationMinutes} phút · {item.branch.name}</Text></View>
        <View style={local.detailBlock}><Text accessibilityRole="header" style={local.blockTitle}>Thời gian thực tế</Text>
          {serviceTimingLines(item, item.branch.timezone ?? undefined).filter(line => line.includes('thực tế')).map(line => <Text key={line} style={local.line}>{line}</Text>)}
          {item.actualTimingSource === 'SERVICE_ADJUSTMENT' && item.actualStartedAt && <ActualElapsed item={item} serverNow={work.serverNow} receivedAt={work.receivedAt} fresh={work.fresh && !work.ops.error} />}</View>
        <View style={local.detailBlock}><Text accessibilityRole="header" style={local.blockTitle}>Lịch hẹn</Text>
          <Text selectable style={local.line}>Mã lịch: {item.bookingCode}</Text>
          <Text style={local.line}>Ngày tại chi nhánh: {dayLabel(item.appointmentDate.slice(0, 10))}</Text>
          <Text style={local.line}>Giờ hẹn: {appointmentClock(item.appointmentStartTime)} – {appointmentClock(item.appointmentEndTime)}</Text></View>
      </>}
      {!item && !work.loading && !work.error && work.ops.canWorkAsStaff && <OperationState message="Công việc không còn khả dụng cho tài khoản này." onRetry={() => { void work.load(); }} />}
    </ScrollView>
  </OperationPage>;
}
const local = StyleSheet.create({
  gutter: { paddingHorizontal: layout.gutter },
  context: { paddingHorizontal: layout.gutter, paddingBottom: space.xs },
  list: { paddingHorizontal: layout.gutter, paddingBottom: space.xxxl, flexGrow: 1 },
  header: { gap: space.md, marginBottom: space.xs, paddingTop: space.sm },
  meta: { ...type.secondary },
  planner: { gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.sm },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekLabel: { ...type.secondaryStrong, color: colors.heading },
  days: { gap: space.xs + 2, paddingHorizontal: space.xs },
  day: { width: 48, minHeight: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  daySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayName: { ...type.caption, ...fw.semibold },
  dayNumber: { ...type.clock, fontSize: 17 },
  daySelectedText: { color: colors.onPrimary },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  todayDotSelected: { backgroundColor: colors.onPrimary },
  detailBlock: { backgroundColor: colors.surface, padding: space.lg, borderRadius: radius.lg, marginBottom: space.md, borderWidth: 1, borderColor: colors.border, gap: space.xs },
  blockTitle: { ...type.h3, marginBottom: space.xs },
  line: { ...type.body },
});
