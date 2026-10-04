import React from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NavigationProp } from '@react-navigation/native';
import { colors } from '../constants/colors';
import { formatCurrency } from '../data/catalogModels';
import { categoryArt, heroArt } from '../components/categoryArt';
import { TAB_BAR_CLEARANCE } from '../navigation/CustomTabBar';
import { useCatalog } from '../hooks/useCatalog';
import { useDistrict } from '../context/DistrictContext';
import { useBookings } from '../context/BookingsContext';
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

  if (isLoading && venues.length === 0) {
    return <SafeAreaView style={styles.center} edges={['top']}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.muted}>Đang tải dịch vụ và cơ sở...</Text></SafeAreaView>;
  }
  if (error && venues.length === 0) {
    return <SafeAreaView style={styles.center} edges={['top']}><Ionicons name="cloud-offline-outline" size={34} color={colors.primary} /><Text style={styles.stateTitle}>Chưa thể tải thông tin</Text><Text style={styles.muted}>{error}</Text><Pressable accessibilityRole="button" style={styles.retry} onPress={() => void reload()}><Text style={styles.retryText}>Thử lại</Text></Pressable></SafeAreaView>;
  }

  return <SafeAreaView style={styles.screen} edges={['top']}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void reload()} colors={[colors.primary]} />}>
      <View style={styles.top}>
        <Text style={styles.wordmark}>BeautyBook</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Chọn khu vực: ${selectedDistrict}`} onPress={openPicker} style={styles.location}><Ionicons name="location-outline" size={18} color={colors.primary} /><Text style={styles.locationText} numberOfLines={1}>{selectedDistrict}</Text><Ionicons name="chevron-down" size={16} color={colors.primary} /></Pressable>
      </View>
      <Text style={styles.greeting}>Hôm nay, bạn muốn chăm sóc điều gì?</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Tìm dịch vụ hoặc cơ sở" style={styles.search} onPress={() => openSearch()}><Ionicons name="search-outline" size={20} color={colors.textGray} /><Text style={styles.searchText}>Tìm dịch vụ hoặc cơ sở</Text><Ionicons name="arrow-forward" size={18} color={colors.primary} /></Pressable>

      {nextBooking ? <Pressable accessibilityRole="button" onPress={() => tabs?.navigate('LichHen')} style={styles.upcoming}><View style={styles.upcomingIcon}><Ionicons name="calendar-outline" size={23} color={colors.primary} /></View><View style={styles.flex}><Text style={styles.eyebrow}>LỊCH SẮP TỚI</Text><Text style={styles.upcomingTitle}>{nextBooking.serviceName}</Text><Text style={styles.upcomingMeta}>{nextBooking.date} · {nextBooking.time} · {nextBooking.shopName}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.primary} /></Pressable> : null}

      <Pressable accessibilityRole="button" accessibilityLabel="Khám phá các dịch vụ chăm sóc da" onPress={() => openSearch('da')} style={styles.editorial}>
        <Image source={heroArt} style={styles.editorialImage} resizeMode="cover" accessibilityLabel="Ảnh minh họa sản phẩm chăm sóc da" />
        <View style={styles.editorialText}><Text style={styles.editorialKicker}>KHÁM PHÁ BEAUTYBOOK</Text><Text style={styles.editorialTitle}>Chọn khoảng thời gian cho mình</Text><Text style={styles.editorialLink}>Khám phá dịch vụ  →</Text></View>
        <Text style={styles.illustrationTag}>Ảnh minh họa</Text>
      </Pressable>

      {categories.length > 0 ? <View style={styles.section}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>Theo nhu cầu của bạn</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>{categories.map((item) => {
        const artwork = categoryArt(item.label);
        return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Tìm ${item.label}`} onPress={() => openSearch(item.label)} style={styles.category}>
          {artwork ? <Image source={artwork} style={styles.categoryImage} resizeMode="cover" accessibilityLabel={`Ảnh minh họa ${item.label}`} /> : <View style={styles.categoryFallback}><Ionicons name="sparkles-outline" size={28} color={colors.primary} /></View>}
          <View style={styles.categoryFooter}><Text style={styles.categoryName} numberOfLines={2}>{item.label}</Text><Ionicons name="arrow-forward" size={16} color={colors.primary} /></View>
          {artwork ? <Text style={styles.categoryTag}>MINH HỌA</Text> : null}
        </Pressable>;
      })}</ScrollView></View> : null}

      <View style={styles.section}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>Cơ sở đang có dịch vụ</Text><Pressable accessibilityRole="button" onPress={() => openSearch()} style={styles.sectionAction}><Text style={styles.sectionActionText}>Xem tất cả</Text><Ionicons name="arrow-forward" size={16} color={colors.primary} /></Pressable></View>
        {venues.length === 0 ? <View style={styles.empty}><Text style={styles.stateTitle}>Chưa có cơ sở phù hợp</Text><Text style={styles.muted}>Thử chọn khu vực khác hoặc tìm theo tên dịch vụ.</Text><Pressable accessibilityRole="button" onPress={openPicker} style={styles.emptyAction}><Text style={styles.sectionActionText}>Đổi khu vực</Text></Pressable></View> : venues.slice(0, 8).map((venue) => <Pressable key={venue.id} accessibilityRole="button" accessibilityLabel={`Xem ${venue.name}`} onPress={() => navigation.navigate('VenueDetail', { venueId: venue.id })} style={styles.venue}>
          {venue.imageUrls?.[0] ? <Image source={{ uri: venue.imageUrls[0] }} style={styles.venueImage} resizeMode="cover" accessibilityLabel={`Ảnh cơ sở ${venue.name}`} /> : <View style={styles.venuePlaceholder}><Ionicons name="storefront-outline" size={31} color={colors.primary} /><Text style={styles.noPhoto}>Cơ sở chưa có ảnh</Text></View>}
          <View style={styles.venueBody}><View style={styles.venueTitleRow}><Text style={styles.venueName}>{venue.name}</Text>{venue.rating > 0 ? <Text style={styles.rating}>★ {venue.rating.toFixed(1)}</Text> : null}</View><Text style={styles.venueAddress}>{venue.address}</Text><Text style={styles.venueAction}>Xem dịch vụ và thông tin  →</Text></View>
        </Pressable>)}
      </View>

      {combos.length > 0 ? <View style={styles.section}><Text style={styles.sectionTitle}>Gói dịch vụ đang áp dụng</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.comboList}>{combos.slice(0, 6).map((combo) => <Pressable key={combo.id} accessibilityRole="button" onPress={() => navigation.navigate('ComboDetail', { comboId: combo.id })} style={styles.combo}><Text style={styles.comboName}>{combo.title}</Text><Text style={styles.comboPlace}>{combo.shopName}</Text><Text style={styles.comboPrice}>{formatCurrency(combo.price)}</Text><Text style={styles.comboLink}>Xem chi tiết  →</Text></Pressable>)}</ScrollView></View> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 12 },
  content: { paddingBottom: TAB_BAR_CLEARANCE + 8 },
  top: { paddingHorizontal: 20, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  wordmark: { fontSize: 24, fontWeight: '800', color: colors.primary, letterSpacing: -0.6 },
  location: { minHeight: 48, maxWidth: '51%', flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { flexShrink: 1, fontSize: 13, color: colors.primary, fontWeight: '600' },
  greeting: { marginHorizontal: 20, marginTop: 20, marginBottom: 16, fontSize: 28, lineHeight: 35, fontWeight: '700', color: colors.textDark },
  search: { marginHorizontal: 20, minHeight: 56, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 11 },
  searchText: { flex: 1, color: colors.textGray, fontSize: 15 },
  upcoming: { marginHorizontal: 20, marginTop: 18, borderRadius: 18, backgroundColor: '#F4E8E7', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  upcomingIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 11, color: colors.primary, fontWeight: '700', letterSpacing: 1 },
  upcomingTitle: { color: colors.textDark, fontWeight: '700', fontSize: 16, marginTop: 4 },
  upcomingMeta: { color: colors.textBody, fontSize: 13, lineHeight: 18, marginTop: 3 },
  editorial: { height: 204, marginHorizontal: 20, marginTop: 22, borderRadius: 23, overflow: 'hidden', backgroundColor: '#422737' },
  editorialImage: { position: 'absolute', right: 0, top: 0, width: '54%', height: '100%' },
  editorialText: { width: '67%', minHeight: 204, paddingLeft: 19, paddingRight: 28, paddingVertical: 23, justifyContent: 'center', backgroundColor: '#422737' },
  editorialKicker: { color: '#F1C9CF', fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  editorialTitle: { color: '#FFF8F5', fontSize: 22, lineHeight: 27, fontWeight: '700', marginTop: 9 },
  editorialLink: { color: '#FFE0DB', fontSize: 13, fontWeight: '600', marginTop: 12 },
  illustrationTag: { position: 'absolute', right: 7, bottom: 8, fontSize: 10, color: '#FFF', backgroundColor: '#422737BB', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  section: { marginTop: 30 },
  sectionHead: { marginHorizontal: 20, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { color: colors.textDark, fontSize: 20, lineHeight: 26, fontWeight: '700', marginHorizontal: 20, marginBottom: 14 },
  sectionAction: { minHeight: 44, alignItems: 'center', flexDirection: 'row', gap: 5 },
  sectionActionText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  categories: { paddingHorizontal: 20, gap: 11 },
  category: { width: 126, minHeight: 150, borderRadius: 17, backgroundColor: colors.card, overflow: 'hidden' },
  categoryImage: { width: '100%', height: 100 },
  categoryFallback: { width: '100%', height: 100, backgroundColor: '#E9E3DA', alignItems: 'center', justifyContent: 'center' },
  categoryFooter: { minHeight: 52, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  categoryName: { flex: 1, color: colors.textDark, fontSize: 13, lineHeight: 17, fontWeight: '600' },
  categoryTag: { position: 'absolute', right: 5, top: 80, color: '#FFF', backgroundColor: '#422737BB', fontSize: 9, paddingHorizontal: 4 },
  venue: { marginHorizontal: 20, marginBottom: 16, borderRadius: 19, backgroundColor: colors.card, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  venueImage: { width: '100%', height: 156 },
  venuePlaceholder: { width: '100%', height: 114, backgroundColor: '#EEE6E0', alignItems: 'center', justifyContent: 'center', gap: 6 },
  noPhoto: { color: colors.textGray, fontSize: 12 },
  venueBody: { padding: 16 },
  venueTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  venueName: { flex: 1, color: colors.textDark, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  rating: { color: '#7C572B', fontSize: 13, fontWeight: '700' },
  venueAddress: { color: colors.textGray, lineHeight: 19, fontSize: 13, marginTop: 5 },
  venueAction: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 10 },
  empty: { marginHorizontal: 20, padding: 20, borderRadius: 18, backgroundColor: colors.card, gap: 8 },
  emptyAction: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  stateTitle: { color: colors.textDark, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  muted: { color: colors.textGray, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  retry: { minHeight: 50, paddingHorizontal: 20, borderRadius: 14, backgroundColor: colors.primary, justifyContent: 'center' },
  retryText: { color: '#FFF', fontWeight: '700' },
  comboList: { paddingHorizontal: 20, gap: 11 },
  combo: { width: 225, borderRadius: 17, padding: 17, backgroundColor: '#F3E7E5', minHeight: 155 },
  comboName: { color: colors.textDark, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  comboPlace: { color: colors.textGray, fontSize: 13, marginTop: 6 },
  comboPrice: { color: colors.primary, fontSize: 17, fontWeight: '700', marginTop: 10 },
  comboLink: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 8 },
});
