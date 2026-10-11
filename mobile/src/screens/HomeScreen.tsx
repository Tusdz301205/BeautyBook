import React from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NavigationProp } from '@react-navigation/native';
import { colors, layout, radius, space, type } from '../theme';
import { categoryArt } from '../components/categoryArt';
import ComboCard from '../components/home/ComboCard';
import { TAB_BAR_CLEARANCE } from '../navigation/CustomTabBar';
import { useCatalog } from '../hooks/useCatalog';
import { useDistrict } from '../context/DistrictContext';
import { useBookings } from '../context/BookingsContext';
import { bookingStatusMeta } from '../data/appointments';
import { EmptyState, LoadingState, Notice, SectionHeader, StatusPill } from '../ui';
import type { HomeStackParamList } from '../navigation/HomeStack';
import type { RootTabParamList } from '../navigation/RootTabs';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

export default function HomeScreen({ navigation }: Props) {
  const { selectedDistrict, openPicker } = useDistrict();
  const location = selectedDistrict === 'Tất cả khu vực' ? undefined : selectedDistrict;
  const { venues, combos, categories, isLoading, error, reload } = useCatalog(location);
  const { bookings } = useBookings();
  const nextBooking = bookings
    .filter((item) => item.status === 'upcoming' && new Date(item.appointmentStartAt).getTime() > Date.now())
    .sort((a, b) => new Date(a.appointmentStartAt).getTime() - new Date(b.appointmentStartAt).getTime())[0];
  const tabs = navigation.getParent<NavigationProp<RootTabParamList>>();
  const openSearch = (query?: string) => tabs?.navigate('TimKiem', query ? { initialQuery: query } : undefined);
  const nextMeta = nextBooking ? bookingStatusMeta(nextBooking.status, nextBooking.rawStatus) : null;

  if (isLoading && venues.length === 0) {
    return <SafeAreaView style={styles.screen} edges={['top']}><LoadingState message="Đang tải dịch vụ và cơ sở…" /></SafeAreaView>;
  }
  if (error && venues.length === 0) {
    return <SafeAreaView style={styles.screen} edges={['top']}><EmptyState icon="cloud-offline-outline" title="Chưa thể tải thông tin" message={error} actionLabel="Thử lại" onAction={() => void reload()} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void reload()} colors={[colors.primary]} tintColor={colors.primary} />}>
        <View style={styles.top}>
          <Text style={styles.wordmark}>BeautyBook</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Khu vực: ${selectedDistrict}. Đổi khu vực`} onPress={openPicker} style={({ pressed }) => [styles.location, pressed && styles.pressed]}>
            <Ionicons accessible={false} name="location-outline" size={16} color={colors.primary} />
            <Text style={styles.locationText} numberOfLines={1}>{selectedDistrict}</Text>
            <Ionicons accessible={false} name="chevron-down" size={16} color={colors.primary} />
          </Pressable>
        </View>
        <Text accessibilityRole="header" style={styles.greeting}>Hôm nay bạn muốn chăm sóc gì?</Text>
        <Pressable accessibilityRole="search" accessibilityLabel="Tìm dịch vụ hoặc cơ sở" onPress={() => openSearch()} style={({ pressed }) => [styles.search, pressed && styles.pressed]}>
          <Ionicons accessible={false} name="search-outline" size={20} color={colors.secondaryText} />
          <Text style={styles.searchText}>Tìm dịch vụ, cơ sở…</Text>
        </Pressable>

        {nextBooking && nextMeta ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Lịch hẹn kế tiếp: ${nextBooking.serviceName}, ${nextBooking.date} lúc ${nextBooking.time} tại ${nextBooking.shopName}, ${nextMeta.label}`}
            onPress={() => tabs?.navigate('LichHen')}
            style={({ pressed }) => [styles.upcoming, pressed && styles.upcomingPressed]}
          >
            <View style={styles.upcomingHead}>
              <Text style={styles.upcomingEyebrow}>Lịch hẹn kế tiếp</Text>
              <StatusPill label={nextMeta.label} tone={nextMeta.tone} icon={nextMeta.icon} />
            </View>
            <Text style={styles.upcomingTitle}>{nextBooking.serviceName}</Text>
            <View style={styles.upcomingFoot}>
              <Text style={styles.upcomingMeta}>{nextBooking.date} · {nextBooking.time} · {nextBooking.shopName}</Text>
              <Ionicons accessible={false} name="chevron-forward" size={18} color={colors.secondarySoft} />
            </View>
          </Pressable>
        ) : null}

        {categories.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Theo nhu cầu" style={styles.gutter} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {categories.map((item) => {
                const artwork = categoryArt(item.label);
                return (
                  <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Tìm ${item.label}`} onPress={() => openSearch(item.label)} style={({ pressed }) => [styles.category, pressed && styles.pressed]}>
                    {artwork ? (
                      <View>
                        <Image source={artwork} style={styles.categoryImage} resizeMode="cover" accessibilityLabel={`Ảnh minh họa ${item.label}`} />
                        <Text style={styles.illustration}>Minh họa</Text>
                      </View>
                    ) : <View style={styles.categoryFallback}><Ionicons accessible={false} name="sparkles-outline" size={26} color={colors.primary} /></View>}
                    <Text style={styles.categoryName} numberOfLines={2}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={[styles.section, styles.gutter]}>
          <SectionHeader title="Cơ sở đang nhận lịch" actionLabel="Xem tất cả" onAction={() => openSearch()} />
          {error ? <Notice tone="warning" message={`Danh sách có thể chưa mới nhất: ${error}`} actionLabel="Tải lại" onAction={() => void reload()} style={styles.notice} /> : null}
          {venues.length === 0 ? (
            <EmptyState icon="storefront-outline" title="Chưa có cơ sở phù hợp" message="Thử chọn khu vực khác hoặc tìm theo tên dịch vụ." actionLabel="Đổi khu vực" onAction={openPicker} />
          ) : venues.slice(0, 8).map((venue) => (
            <Pressable key={venue.id} accessibilityRole="button" accessibilityLabel={`Xem ${venue.name}, ${venue.address}${venue.rating > 0 ? `, đánh giá ${venue.rating.toFixed(1)} sao` : ''}`} onPress={() => navigation.navigate('VenueDetail', { venueId: venue.id })} style={({ pressed }) => [styles.venue, pressed && styles.pressed]}>
              {venue.imageUrls?.[0] ? <Image source={{ uri: venue.imageUrls[0] }} style={styles.venueImage} resizeMode="cover" accessibilityLabel={`Ảnh cơ sở ${venue.name}`} /> : null}
              <View style={styles.venueBody}>
                {!venue.imageUrls?.[0] ? <View style={styles.venueIcon}><Ionicons accessible={false} name="storefront-outline" size={22} color={colors.primary} /></View> : null}
                <View style={styles.flex}>
                  <View style={styles.venueTitleRow}>
                    <Text style={styles.venueName}>{venue.name}</Text>
                    {venue.rating > 0 ? <View style={styles.rating}><Ionicons accessible={false} name="star" size={13} color={colors.warning} /><Text style={styles.ratingText}>{venue.rating.toFixed(1)}</Text></View> : null}
                  </View>
                  <Text style={styles.venueAddress}>{venue.address}</Text>
                  {!venue.imageUrls?.[0] ? <Text style={styles.noPhoto}>Cơ sở chưa cập nhật ảnh</Text> : null}
                </View>
                <Ionicons accessible={false} name="chevron-forward" size={18} color={colors.secondaryText} />
              </View>
            </Pressable>
          ))}
        </View>

        {combos.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Gói dịch vụ đang áp dụng" style={styles.gutter} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {combos.slice(0, 6).map((combo) => <ComboCard key={combo.id} combo={combo} onPress={() => navigation.navigate('ComboDetail', { comboId: combo.id })} />)}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: TAB_BAR_CLEARANCE + space.lg },
  gutter: { marginHorizontal: layout.gutter },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },
  top: { minHeight: layout.headerMinHeight, paddingHorizontal: layout.gutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  wordmark: { ...type.h2, color: colors.primary, letterSpacing: -0.4 },
  location: { minHeight: 40, maxWidth: '55%', flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  locationText: { ...type.secondaryStrong, color: colors.primary, flexShrink: 1 },
  greeting: { ...type.h1, marginHorizontal: layout.gutter, marginTop: space.xs, marginBottom: space.md },
  search: { marginHorizontal: layout.gutter, minHeight: layout.inputMinHeight, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md },
  searchText: { ...type.body, color: colors.secondaryText, flex: 1 },
  upcoming: { marginHorizontal: layout.gutter, marginTop: space.lg, borderRadius: radius.lg, backgroundColor: colors.secondary, padding: space.lg, gap: space.sm },
  upcomingPressed: { backgroundColor: '#2E1A27' },
  upcomingHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  upcomingEyebrow: { ...type.overline, color: colors.secondarySoft },
  upcomingTitle: { ...type.h2, color: colors.white },
  upcomingFoot: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  upcomingMeta: { ...type.secondary, color: colors.secondarySoft, flex: 1 },
  section: { marginTop: layout.sectionGap },
  rail: { paddingHorizontal: layout.gutter, gap: space.md, paddingTop: space.md },
  category: { width: 112, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  categoryImage: { width: '100%', height: 84 },
  categoryFallback: { width: '100%', height: 84, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  illustration: { position: 'absolute', left: space.xs, bottom: space.xs, ...type.caption, color: colors.white, backgroundColor: 'rgba(42,31,38,0.72)', borderRadius: radius.sm, paddingHorizontal: space.xs + 1, overflow: 'hidden' },
  categoryName: { ...type.secondaryStrong, color: colors.heading, padding: space.sm, minHeight: 52 },
  notice: { marginTop: space.md },
  venue: { marginTop: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  venueImage: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.surfaceMuted },
  venueBody: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  venueIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  venueTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  venueName: { ...type.h3, flex: 1 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.warningSoft, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  ratingText: { ...type.caption, fontWeight: '700', color: colors.warning },
  venueAddress: { ...type.secondary, marginTop: space.xs },
  noPhoto: { ...type.caption, marginTop: space.xs },
});
