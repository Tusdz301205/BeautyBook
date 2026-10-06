import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootTabParamList } from '../navigation/RootTabs';
import { HoatDongStackParamList } from '../navigation/HoatDongStack';
import { TAB_BAR_CLEARANCE } from '../navigation/CustomTabBar';
import { colors } from '../constants/colors';
import { formatCurrency } from '../data/catalogModels';
import { useAppointments } from '../hooks/useAppointments';
import { Appointment, apptTimestamp, formatGroupHeader, getCountdownLabel, groupByDate, isPastUpcoming } from '../data/appointments';
import AppointmentCard from '../components/AppointmentCard';
import { useBookings } from '../context/BookingsContext';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HoatDongStackParamList, 'HoatDongMain'>,
  BottomTabScreenProps<RootTabParamList>
>;

type SubTab = 'upcoming' | 'history';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'upcoming', label: 'Sắp tới' },
  { key: 'history', label: 'Lịch sử' },
];

const SUB_TAB_EMPTY: Record<SubTab, { emoji: string; title: string; subtitle: string }> = {
  upcoming: {
    emoji: '🗓️',
    title: 'Không có lịch hẹn sắp tới',
    subtitle: 'Đặt lịch ngay để trải nghiệm dịch vụ làm đẹp yêu thích',
  },
  history: {
    emoji: '🕘',
    title: 'Chưa có lịch sử lịch hẹn',
    subtitle: 'Các lịch hẹn đã hoàn thành hoặc đã hủy sẽ xuất hiện ở đây',
  },
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

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <Text style={styles.headerTitle}>Lịch hẹn</Text>
      </SafeAreaView>

        <>
          <View style={styles.subTabsRow}>
            <View style={styles.subTabsGroup}>
              {SUB_TABS.map((tab) => {
                const isActive = tab.key === subTab;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.subTabButton, isActive && styles.subTabButtonActive]}
                    activeOpacity={0.8}
                    onPress={() => setSubTab(tab.key)}
                  >
                    <Text style={[styles.subTabText, isActive && styles.subTabTextActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.calendarButton}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('CalendarView')}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={styles.calendarButtonText}>Xem theo lịch</Text>
            </TouchableOpacity>
          </View>

          {isLoading && appointments.length === 0 ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.emptySubtitle}>Đang tải lịch hẹn...</Text>
            </View>
          ) : subAppointments.length === 0 ? (
            <EmptyState
              emoji={SUB_TAB_EMPTY[subTab].emoji}
              title={error ? 'Không tải được lịch hẹn' : SUB_TAB_EMPTY[subTab].title}
              subtitle={error || SUB_TAB_EMPTY[subTab].subtitle}
              actionLabel={error ? 'Thử lại' : undefined}
              onPressAction={() => {
                if (error) {
                  void reload();
                  return;
                }
                navigation.navigate('TimKiem');
              }}
            />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.content}
              refreshControl={<RefreshControl refreshing={isPullRefreshing && isRefreshing} onRefresh={() => {
                setPullRefreshing(true);
                void reload().finally(() => setPullRefreshing(false));
              }} colors={[colors.primary]} />}
            >
              {heroItem && (
                <HeroCard
                  item={heroItem}
                  countdown={getCountdownLabel(heroItem)}
                  onPress={() => navigateToDetail(heroItem)}
                  onDirections={() =>
                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(heroItem.address)}`)
                  }
                />
              )}

              {dateGroups.map((group) => (
                <View key={group.key} style={styles.dateGroup}>
                  <Text style={styles.dateGroupHeader}>{formatGroupHeader(group.date)}</Text>
                  {group.items.map((item) => {
                    const comboId = item.comboId;
                    return (
                      <AppointmentCard
                        key={item.id}
                        item={item}
                        onPress={() => navigateToDetail(item)}
                        onRebook={
                          item.status === 'completed' && comboId
                            ? () => navigation.navigate('DiaDiem', { screen: 'ComboDetail', params: { comboId } })
                            : undefined
                        }
                      />
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          )}
        </>
    </View>
  );
}

function HeroCard({
  item,
  countdown,
  onPress,
  onDirections,
}: {
  item: Appointment;
  countdown: string;
  onPress: () => void;
  onDirections: () => void;
}) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroHeaderRow}>
        <Text style={styles.heroLabel}>{item.rawStatus === 'PENDING' ? 'YÊU CẦU CHỜ XÁC NHẬN' : 'LỊCH HẸN TIẾP THEO'}</Text>
        <View style={styles.heroCountdownBadge}>
          <Text style={styles.heroCountdownText}>{item.rawStatus === 'PENDING' ? 'Chờ cơ sở' : countdown}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.heroBody} activeOpacity={0.85} onPress={onPress}>
        <View style={styles.heroInfo}>
          <Text style={styles.heroShopName}>
            {item.shopName}
          </Text>
          <Text style={styles.heroComboTitle}>
            {item.comboTitle}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.textGray} />
            <Text style={styles.metaText}>
              {item.date} • {item.time}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={13} color={colors.textGray} />
            <Text style={styles.metaText}>{item.staffName}</Text>
          </View>
          <Text style={styles.heroPrice}>{formatCurrency(item.price)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.heroDirectionsButton} activeOpacity={0.8} onPress={onDirections}>
        <Ionicons name="navigate-outline" size={15} color={colors.primary} />
        <Text style={styles.heroDirectionsText}>Chỉ đường</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyState({
  emoji,
  title,
  subtitle,
  onPressAction,
  actionLabel = 'Tìm kiếm địa điểm',
}: {
  emoji: string;
  title: string;
  subtitle: string;
  onPressAction: () => void;
  actionLabel?: string;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      <TouchableOpacity style={styles.emptyButton} activeOpacity={0.7} onPress={onPressAction}>
        <Text style={styles.emptyButtonText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.card,
  },
  header: {
    backgroundColor: colors.card,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textDark,
    paddingHorizontal: 20,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  tabPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  tabPillTextActive: {
    color: colors.white,
  },
  subTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subTabsGroup: {
    flexDirection: 'row',
    gap: 24,
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginBottom: 10,
  },
  calendarButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  subTabButton: {
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabButtonActive: {
    borderBottomColor: colors.primary,
  },
  subTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textGray,
  },
  subTabTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  heroCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  heroCountdownBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroCountdownText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroInfo: {
    flex: 1,
    gap: 4,
  },
  heroShopName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textDark,
  },
  heroComboTitle: {
    fontSize: 15,
    color: colors.textBody,
  },
  heroPrice: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
  },
  heroDirectionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  heroDirectionsText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  dateGroup: {
    marginBottom: 4,
  },
  dateGroupHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textGray,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 14,
    color: colors.textGray,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: TAB_BAR_CLEARANCE,
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textDark,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
