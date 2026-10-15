import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootTabParamList } from '../navigation/RootTabs';
import { HoatDongStackParamList } from '../navigation/HoatDongStack';
import { TAB_BAR_CLEARANCE } from '../navigation/CustomTabBar';
import { colors, layout, radius, space, type, fw } from '../theme';
import { formatCurrency } from '../data/catalogModels';
import { useAppointments } from '../hooks/useAppointments';
import { Appointment, apptTimestamp, bookingStatusMeta, formatGroupHeader, getCountdownLabel, groupByDate, isPastUpcoming } from '../data/appointments';
import AppointmentCard from '../components/AppointmentCard';
import { useBookings } from '../context/BookingsContext';
import { AppButton, BrandGradient, EmptyState, LoadingState, Notice, ScreenHeader, Segmented, StatusPill } from '../ui';
import SelectListSheet from '../components/SelectListSheet';
import { filterHistory, historySummary, historyYears } from '../utils/bookingHistory';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HoatDongStackParamList, 'HoatDongMain'>,
  BottomTabScreenProps<RootTabParamList>
>;

type SubTab = 'upcoming' | 'history';

const SUB_TAB_EMPTY: Record<SubTab, { icon: 'calendar-outline' | 'time-outline'; title: string; subtitle: string }> = {
  upcoming: { icon: 'calendar-outline', title: 'Chưa có lịch hẹn sắp tới', subtitle: 'Tìm dịch vụ phù hợp và đặt lịch chỉ trong vài bước.' },
  history: { icon: 'time-outline', title: 'Chưa có lịch sử lịch hẹn', subtitle: 'Các lịch đã qua hoặc đã hủy xuất hiện ở đây.' },
};

export default function LichHenScreen({ navigation }: Props) {
  const appointments = useAppointments();
  const { isLoading, isRefreshing, error, reload } = useBookings();
  const [isPullRefreshing, setPullRefreshing] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>('upcoming');
  const [historyMonth, setHistoryMonth] = useState<number | null>(null);
  const [historyYear, setHistoryYear] = useState<number | null>(null);
  const [periodPicker, setPeriodPicker] = useState<'month' | 'year' | null>(null);

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  const history = useMemo(() => appointments.filter(item => item.status !== 'upcoming' || isPastUpcoming(item)), [appointments]);
  const filteredHistory = useMemo(() => filterHistory(history, { month: historyMonth, year: historyYear }), [history, historyMonth, historyYear]);
  const summary = useMemo(() => historySummary(filteredHistory), [filteredHistory]);
  const years = useMemo(() => historyYears(history, new Date().getFullYear()), [history]);
  const monthLabel = historyMonth === null ? 'Tất cả tháng' : `Tháng ${historyMonth}`;
  const yearLabel = historyYear === null ? 'Tất cả năm' : `Năm ${historyYear}`;
  const subAppointments = useMemo(() => {
    const filtered = subTab === 'upcoming'
      ? appointments.filter(item => item.status === 'upcoming' && !isPastUpcoming(item))
      : filteredHistory;
    const sorted = [...filtered].sort((a, b) => apptTimestamp(a) - apptTimestamp(b));
    return subTab === 'upcoming' ? sorted : sorted.reverse();
  }, [appointments, subTab, filteredHistory]);

  const heroItem = subTab === 'upcoming' ? subAppointments[0] : undefined;
  const restItems = subTab === 'upcoming' ? subAppointments.slice(1) : subAppointments;
  const dateGroups = useMemo(() => groupByDate(restItems), [restItems]);

  const navigateToDetail = (item: Appointment) =>
    navigation.navigate('AppointmentDetail', {
      id: item.id,
      isReal: item.isReal,
      shopName: item.shopName,
      address: item.address,
      title: item.comboTitle,
      staffName: item.staffName,
      imageUri: item.imageUri,
      date: item.date,
      time: item.time,
      price: item.price,
      status: item.status,
      comboId: item.comboId,
    });

  const empty = SUB_TAB_EMPTY[subTab];
  return (
    <View style={styles.screen}>
      <ScreenHeader brand title="Lịch hẹn" right={<AppButton compact variant="onDark" icon="calendar-number-outline" label="Theo lịch" accessibilityLabel="Xem lịch hẹn theo tháng" onPress={() => navigation.navigate('CalendarView')} />} />
      <Segmented style={styles.segment} value={subTab} onChange={setSubTab} options={[{ key: 'upcoming', label: 'Sắp tới' }, { key: 'history', label: 'Lịch sử' }]} />
      {subTab === 'history' && <View style={styles.historyPanel}>
        <View style={styles.historyFilters}>
          <AppButton compact variant="outline" icon="calendar-outline" label={monthLabel} accessibilityLabel={`Lọc lịch sử: ${monthLabel}`} onPress={() => setPeriodPicker('month')} style={styles.flex} />
          <AppButton compact variant="outline" icon="chevron-down" label={yearLabel} accessibilityLabel={`Lọc lịch sử: ${yearLabel}`} onPress={() => setPeriodPicker('year')} style={styles.flex} />
        </View>
        {!isLoading && (!error || appointments.length > 0) && <>
          <View style={styles.historyStats} accessibilityLiveRegion="polite">
            {[{ label: 'Tổng số lịch', value: summary.total, color: colors.primary }, { label: 'Đã hoàn thành', value: summary.completed, color: colors.success }, { label: 'Đã hủy', value: summary.cancelled, color: colors.error }].map(stat => (
              <View key={stat.label} accessible accessibilityLabel={`${stat.label}: ${stat.value}`} style={styles.historyStat}>
                <Text style={[styles.statNumber, { color: stat.color }]}>{stat.value}</Text><Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.historyHint}>Thống kê theo ngày hẹn. Lịch chỉ qua giờ chưa được tính là hoàn thành.</Text>
        </>}
      </View>}

      {isLoading && appointments.length === 0 ? <LoadingState message="Đang tải lịch hẹn…" /> : subAppointments.length === 0 ? (
        error
          ? <EmptyState icon="cloud-offline-outline" tone="warning" title="Không tải được lịch hẹn" message={error} actionLabel="Thử lại" onAction={() => void reload()} />
          : <EmptyState icon={empty.icon} tone={subTab === 'upcoming' ? 'request' : 'neutral'} title={subTab === 'history' && (historyMonth !== null || historyYear !== null) ? 'Không có lịch trong kỳ đã chọn' : empty.title} message={empty.subtitle} actionLabel={subTab === 'upcoming' ? 'Tìm dịch vụ' : undefined} onAction={() => navigation.navigate('TimKiem')} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isPullRefreshing && isRefreshing} onRefresh={() => { setPullRefreshing(true); void reload().finally(() => setPullRefreshing(false)); }} colors={[colors.primary]} tintColor={colors.primary} />}
        >
          {error ? <Notice tone="warning" title="Danh sách có thể chưa mới nhất" message={error} actionLabel="Tải lại" onAction={() => void reload()} style={styles.notice} /> : null}
          {heroItem && <HeroCard item={heroItem} countdown={getCountdownLabel(heroItem)} onPress={() => navigateToDetail(heroItem)} onDirections={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(heroItem.address)}`)} />}
          {dateGroups.map((group) => (
            <View key={group.key} style={styles.dateGroup}>
              <Text accessibilityRole="header" style={styles.dateGroupHeader}>{formatGroupHeader(group.date)}</Text>
              {group.items.map((item) => (
                <AppointmentCard key={item.id} item={item} onPress={() => navigateToDetail(item)} onRebook={item.status !== 'upcoming' ? () => navigateToDetail(item) : undefined} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
      <SelectListSheet visible={periodPicker !== null} title={periodPicker === 'month' ? 'Chọn tháng' : 'Chọn năm'}
        options={periodPicker === 'month' ? ['Tất cả tháng', ...Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`)] : ['Tất cả năm', ...years.map(year => `Năm ${year}`)]}
        selectedValue={periodPicker === 'month' ? monthLabel : yearLabel} onClose={() => setPeriodPicker(null)} columns={2}
        onSelect={label => {
          const value = Number(label.split(' ')[1]);
          if (periodPicker === 'month') setHistoryMonth(Number.isFinite(value) ? value : null);
          else setHistoryYear(Number.isFinite(value) ? value : null);
          setPeriodPicker(null);
        }} />
    </View>
  );
}

function HeroCard({ item, countdown, onPress, onDirections }: { item: Appointment; countdown: string; onPress: () => void; onDirections: () => void }) {
  const meta = bookingStatusMeta(item.status, item.rawStatus);
  const active = ['CHECKED_IN', 'IN_PROGRESS'].includes(item.rawStatus || '');
  return (
    <BrandGradient decor style={styles.hero}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${item.rawStatus === 'PENDING' ? 'Yêu cầu chờ xác nhận' : 'Lịch hẹn kế tiếp'}: ${item.comboTitle} tại ${item.shopName}, ${item.date} lúc ${item.time}, ${meta.label}. Xem chi tiết`} onPress={onPress} style={({ pressed }) => [styles.heroBody, pressed && styles.heroPressed]}>
        <View style={styles.heroHead}>
          <Text style={styles.heroEyebrow}>{item.rawStatus === 'PENDING' ? 'Yêu cầu chờ xác nhận' : 'Lịch hẹn kế tiếp'}</Text>
          {!active && item.rawStatus !== 'PENDING' ? <Text style={styles.countdown}>{countdown}</Text> : null}
        </View>
        <Text style={styles.heroTitle}>{item.comboTitle}</Text>
        <StatusPill label={meta.label} tone={meta.tone} icon={meta.icon} />
        <View style={styles.heroRow}><Ionicons accessible={false} name="calendar-outline" size={16} color={colors.secondarySoft} /><Text style={styles.heroMeta}>{item.date} · {item.time}</Text></View>
        <View style={styles.heroRow}><Ionicons accessible={false} name="storefront-outline" size={16} color={colors.secondarySoft} /><Text style={styles.heroMeta}>{item.shopName}</Text></View>
        <View style={styles.heroRow}><Ionicons accessible={false} name="person-outline" size={16} color={colors.secondarySoft} /><Text style={styles.heroMeta}>{item.staffName}</Text></View>
        <Text style={styles.heroPrice}>{formatCurrency(item.price)}</Text>
      </Pressable>
      <View style={styles.heroActions}>
        <AppButton compact variant="onDark" icon="navigate-outline" label="Chỉ đường" onPress={onDirections} style={styles.flex} />
        <AppButton compact variant="onDark" iconRight="chevron-forward" label="Chi tiết" onPress={onPress} style={styles.flex} />
      </View>
    </BrandGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  segment: { marginHorizontal: layout.gutter, marginTop: space.lg, marginBottom: space.sm },
  historyPanel: { paddingHorizontal: layout.gutter, paddingBottom: space.md, gap: space.sm },
  historyFilters: { flexDirection: 'row', gap: space.sm },
  historyStats: { flexDirection: 'row', gap: space.sm },
  historyStat: { flex: 1, minWidth: 0, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.sm, paddingVertical: space.md, alignItems: 'center', gap: space.xs },
  statNumber: { ...type.h1, fontVariant: ['tabular-nums'] },
  statLabel: { ...type.caption, textAlign: 'center' },
  historyHint: { ...type.caption },
  content: { paddingHorizontal: layout.gutter, paddingTop: space.md, paddingBottom: TAB_BAR_CLEARANCE + space.lg },
  notice: { marginBottom: space.md },
  hero: { borderRadius: radius.xl, marginBottom: space.xxl },
  heroBody: { padding: space.lg, gap: space.sm },
  heroPressed: { backgroundColor: 'rgba(42,18,48,0.25)' },
  heroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  heroEyebrow: { ...type.overline, color: colors.accentFill },
  countdown: { ...type.caption, ...fw.bold, color: colors.secondary, backgroundColor: colors.secondarySoft, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, overflow: 'hidden' },
  heroTitle: { ...type.h1, fontSize: 23, lineHeight: 31, color: colors.white },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroMeta: { ...type.secondary, color: colors.secondarySoft, flex: 1 },
  heroPrice: { ...type.price, color: colors.white, marginTop: space.xs },
  heroActions: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.lg },
  dateGroup: { marginBottom: space.sm },
  dateGroupHeader: { ...type.overline, marginBottom: space.sm },
});
