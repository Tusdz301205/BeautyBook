import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootTabParamList } from '../navigation/RootTabs';
import { HoatDongStackParamList } from '../navigation/HoatDongStack';
import { TAB_BAR_CLEARANCE } from '../navigation/CustomTabBar';
import { colors, layout, radius, space, type } from '../theme';
import { formatCurrency } from '../data/catalogModels';
import { useAppointments } from '../hooks/useAppointments';
import { Appointment, apptTimestamp, bookingStatusMeta, formatGroupHeader, getCountdownLabel, groupByDate, isPastUpcoming } from '../data/appointments';
import AppointmentCard from '../components/AppointmentCard';
import { useBookings } from '../context/BookingsContext';
import { AppButton, EmptyState, LoadingState, Notice, ScreenHeader, Segmented, StatusPill } from '../ui';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HoatDongStackParamList, 'HoatDongMain'>,
  BottomTabScreenProps<RootTabParamList>
>;

type SubTab = 'upcoming' | 'history';

const SUB_TAB_EMPTY: Record<SubTab, { icon: 'calendar-outline' | 'time-outline'; title: string; subtitle: string }> = {
  upcoming: { icon: 'calendar-outline', title: 'Chưa có lịch hẹn sắp tới', subtitle: 'Tìm dịch vụ phù hợp và đặt lịch chỉ trong vài bước.' },
  history: { icon: 'time-outline', title: 'Chưa có lịch sử lịch hẹn', subtitle: 'Lịch đã hoàn thành, đã hủy hoặc quá giờ chưa được cập nhật sẽ xuất hiện ở đây.' },
};

export default function LichHenScreen({ navigation }: Props) {
  const appointments = useAppointments();
  const { isLoading, isRefreshing, error, reload } = useBookings();
  const [isPullRefreshing, setPullRefreshing] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>('upcoming');

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  const subAppointments = useMemo(() => {
    const filtered = appointments.filter((item) =>
      subTab === 'upcoming'
        ? item.status === 'upcoming' && !isPastUpcoming(item)
        : item.status !== 'upcoming' || isPastUpcoming(item)
    );
    const sorted = [...filtered].sort((a, b) => apptTimestamp(a) - apptTimestamp(b));
    return subTab === 'upcoming' ? sorted : sorted.reverse();
  }, [appointments, subTab]);

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
      <ScreenHeader large title="Lịch hẹn" right={<AppButton compact variant="tonal" icon="calendar-number-outline" label="Theo lịch" accessibilityLabel="Xem lịch hẹn theo tháng" onPress={() => navigation.navigate('CalendarView')} />} />
      <Segmented style={styles.segment} value={subTab} onChange={setSubTab} options={[{ key: 'upcoming', label: 'Sắp tới' }, { key: 'history', label: 'Lịch sử' }]} />

      {isLoading && appointments.length === 0 ? <LoadingState message="Đang tải lịch hẹn…" /> : subAppointments.length === 0 ? (
        error
          ? <EmptyState icon="cloud-offline-outline" title="Không tải được lịch hẹn" message={error} actionLabel="Thử lại" onAction={() => void reload()} />
          : <EmptyState icon={empty.icon} title={empty.title} message={empty.subtitle} actionLabel={subTab === 'upcoming' ? 'Tìm dịch vụ' : undefined} onAction={() => navigation.navigate('TimKiem')} />
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
    </View>
  );
}

function HeroCard({ item, countdown, onPress, onDirections }: { item: Appointment; countdown: string; onPress: () => void; onDirections: () => void }) {
  const meta = bookingStatusMeta(item.status, item.rawStatus);
  const active = ['CHECKED_IN', 'IN_PROGRESS'].includes(item.rawStatus || '');
  return (
    <View style={styles.hero}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  segment: { marginHorizontal: layout.gutter, marginBottom: space.sm },
  content: { paddingHorizontal: layout.gutter, paddingTop: space.md, paddingBottom: TAB_BAR_CLEARANCE + space.lg },
  notice: { marginBottom: space.md },
  hero: { backgroundColor: colors.secondary, borderRadius: radius.lg, marginBottom: space.xxl, overflow: 'hidden' },
  heroBody: { padding: space.lg, gap: space.sm },
  heroPressed: { backgroundColor: '#2E1A27' },
  heroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  heroEyebrow: { ...type.overline, color: colors.secondarySoft },
  countdown: { ...type.caption, fontWeight: '700', color: colors.secondary, backgroundColor: colors.secondarySoft, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, overflow: 'hidden' },
  heroTitle: { ...type.h2, color: colors.white },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroMeta: { ...type.secondary, color: colors.secondarySoft, flex: 1 },
  heroPrice: { ...type.price, color: colors.white, marginTop: space.xs },
  heroActions: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.lg },
  dateGroup: { marginBottom: space.sm },
  dateGroupHeader: { ...type.overline, marginBottom: space.sm },
});
