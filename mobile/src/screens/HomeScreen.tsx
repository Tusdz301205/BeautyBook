import React from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NavigationProp } from '@react-navigation/native';
import { colors, elevation, families, familyOf, fw, gradients, layout, radius, space, type } from '../theme';
import { categoryArt } from '../components/categoryArt';
import { editorial } from '../components/editorialArt';
import ComboCard from '../components/home/ComboCard';
import { TAB_BAR_CLEARANCE } from '../navigation/CustomTabBar';
import { useCatalog } from '../hooks/useCatalog';
import { useDistrict } from '../context/DistrictContext';
import { useBookings } from '../context/BookingsContext';
import { useAuth } from '../context/AuthContext';
import { bookingStatusMeta } from '../data/appointments';
import { formatCurrency } from '../data/catalogModels';
import { ArtCover, BrandGradient, EmptyState, Notice, RatingPill, SectionHeader, SkeletonBlock, StatusBarShade, StatusPill, useStatusBarShade } from '../ui';
import type { HomeStackParamList } from '../navigation/HomeStack';
import type { RootTabParamList } from '../navigation/RootTabs';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const shade = useStatusBarShade(140);
  const { selectedDistrict, openPicker } = useDistrict();
  const { userName, isLoggedIn } = useAuth();
  const location = selectedDistrict === 'Tất cả khu vực' ? undefined : selectedDistrict;
  const { venues, combos, categories, isLoading, error, reload } = useCatalog(location);
  const { bookings } = useBookings();
  const nextBooking = bookings
    .filter((item) => item.status === 'upcoming' && new Date(item.appointmentStartAt).getTime() > Date.now())
    .sort((a, b) => new Date(a.appointmentStartAt).getTime() - new Date(b.appointmentStartAt).getTime())[0];
  const tabs = navigation.getParent<NavigationProp<RootTabParamList>>();
  const openSearch = (query?: string) => tabs?.navigate('TimKiem', query ? { initialQuery: query } : undefined);
  const nextMeta = nextBooking ? bookingStatusMeta(nextBooking.status, nextBooking.rawStatus) : null;
  const givenName = userName.trim().split(/\s+/).pop();
  const featured = venues.slice(0, 8);
  // Real rows from the catalogue search; never invented “popular” claims.
  const services = venues.flatMap((venue) => venue.servicesFromSearch.slice(0, 1).map((service) => ({ service, venue }))).slice(0, 5);
  const anyRating = featured.some((venue) => venue.rating > 0);
  const firstLoad = isLoading && venues.length === 0;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} onScroll={shade.onScroll} scrollEventThrottle={16} refreshControl={<RefreshControl refreshing={isLoading && !firstLoad} onRefresh={() => void reload()} colors={[colors.primary]} tintColor={colors.white} progressViewOffset={insets.top} />}>
        <BrandGradient decor style={[styles.hero, { paddingTop: insets.top + space.sm }]}>
          <View style={styles.top}>
            <Text style={styles.wordmark}>BeautyBook</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Khu vực: ${selectedDistrict}. Đổi khu vực`} onPress={openPicker} style={({ pressed }) => [styles.location, pressed && styles.locationPressed]}>
              <Ionicons accessible={false} name="location" size={15} color={colors.white} />
              <Text style={styles.locationText} numberOfLines={1}>{selectedDistrict}</Text>
              <Ionicons accessible={false} name="chevron-down" size={15} color={colors.white} />
            </Pressable>
          </View>
          {isLoggedIn && givenName ? <Text style={styles.hello}>Chào {givenName},</Text> : null}
          <Text accessibilityRole="header" style={styles.greeting}>Hôm nay bạn muốn chăm sóc gì?</Text>
          <Pressable accessibilityRole="search" accessibilityLabel="Tìm dịch vụ hoặc cơ sở" onPress={() => openSearch()} style={({ pressed }) => [styles.search, pressed && styles.searchPressed]}>
            <Ionicons accessible={false} name="search" size={20} color={colors.primary} />
            <Text style={styles.searchText}>Tìm dịch vụ, cơ sở…</Text>
            <View style={styles.searchGo}><Ionicons accessible={false} name="arrow-forward" size={18} color={colors.onPrimary} /></View>
          </Pressable>
        </BrandGradient>

        {nextBooking && nextMeta ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Lịch hẹn kế tiếp: ${nextBooking.serviceName}, ${nextBooking.date} lúc ${nextBooking.time} tại ${nextBooking.shopName}, ${nextMeta.label}`}
            onPress={() => tabs?.navigate('LichHen')}
            style={({ pressed }) => [styles.upcoming, pressed && styles.pressed]}
          >
            <View style={styles.upcomingDate}>
              <Text style={styles.upcomingDay}>{nextBooking.date.slice(0, 2)}</Text>
              <Text style={styles.upcomingMonth}>Th{Number(nextBooking.date.slice(3, 5))}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.upcomingEyebrow}>Lịch hẹn kế tiếp · {nextBooking.time}</Text>
              <Text style={styles.upcomingTitle} numberOfLines={2}>{nextBooking.serviceName}</Text>
              <Text style={styles.upcomingMeta} numberOfLines={1}>{nextBooking.shopName}</Text>
              <StatusPill label={nextMeta.label} tone={nextMeta.tone} icon={nextMeta.icon} />
            </View>
            <Ionicons accessible={false} name="chevron-forward" size={18} color={colors.secondaryText} />
          </Pressable>
        ) : null}

        {firstLoad ? (
          <View accessibilityLiveRegion="polite" accessibilityLabel="Đang tải dịch vụ và cơ sở" style={styles.skeleton}>
            <SkeletonBlock height={24} width="55%" />
            <View style={styles.skeletonRow}><SkeletonBlock height={150} width={124} /><SkeletonBlock height={150} width={124} /><SkeletonBlock height={150} width={124} /></View>
            <SkeletonBlock height={24} width="65%" />
            <SkeletonBlock height={210} />
          </View>
        ) : error && venues.length === 0 ? (
          <EmptyState icon="cloud-offline-outline" tone="warning" title="Chưa thể tải thông tin" message={error} actionLabel="Thử lại" onAction={() => void reload()} />
        ) : (
          <>
            {categories.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader title="Khám phá theo nhu cầu" style={styles.gutter} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {categories.map((item) => {
                    const artwork = categoryArt(item.label);
                    const look = families[familyOf(item.label)];
                    return (
                      <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Tìm ${item.label}`} onPress={() => openSearch(item.label)} style={({ pressed }) => [styles.category, { backgroundColor: look.soft }, pressed && styles.pressed]}>
                        {artwork ? (
                          <>
                            <Image source={artwork} style={styles.categoryImage} resizeMode="cover" accessibilityLabel={`Ảnh minh họa ${item.label}`} />
                            <LinearGradient pointerEvents="none" colors={['rgba(42,18,48,0)', 'rgba(42,18,48,0.78)']} style={styles.categoryScrim} />
                            <Text style={styles.illustration}>Minh họa</Text>
                            <Text style={styles.categoryNameOnImage} numberOfLines={2}>{item.label}</Text>
                          </>
                        ) : (
                          <>
                            <ArtCover name={item.label} height={96} />
                            <Text style={[styles.categoryName, { color: look.fg }]} numberOfLines={2}>{item.label}</Text>
                          </>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.section}>
              <SectionHeader title={anyRating ? 'Cơ sở được đánh giá cao' : 'Cơ sở đang nhận lịch'} actionLabel="Xem tất cả" onAction={() => openSearch()} style={styles.gutter} />
              {error ? <Notice tone="warning" message={`Danh sách có thể chưa mới nhất: ${error}`} actionLabel="Tải lại" onAction={() => void reload()} style={[styles.gutter, styles.notice]} /> : null}
              {featured.length === 0 ? (
                <EmptyState icon="storefront-outline" title="Chưa có cơ sở phù hợp" message="Thử chọn khu vực khác hoặc tìm theo tên dịch vụ." actionLabel="Đổi khu vực" onAction={openPicker} />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} snapToInterval={272} decelerationRate="fast">
                  {featured.map((venue) => {
                    const lead = venue.servicesFromSearch[0];
                    const photo = venue.imageUrls?.[0];
                    return (
                      <Pressable key={venue.id} accessibilityRole="button" accessibilityLabel={`${venue.name}, ${venue.address}${venue.rating > 0 ? `, đánh giá ${venue.rating.toFixed(1)}` : ''}. Xem cơ sở`} onPress={() => navigation.navigate('VenueDetail', { venueId: venue.id })} style={({ pressed }) => [styles.venue, pressed && styles.pressed]}>
                        <View>
                          {photo ? <Image source={{ uri: photo }} style={styles.venueImage} resizeMode="cover" accessibilityLabel={`Ảnh cơ sở ${venue.name}`} /> : <ArtCover name={lead?.categoryName || lead?.name || venue.name} monogram={venue.logoText} height={132} />}
                          {venue.rating > 0 ? <RatingPill value={venue.rating} count={venue.reviewCount || undefined} style={styles.venueRating} /> : null}
                        </View>
                        <View style={styles.venueBody}>
                          <Text style={styles.venueName} numberOfLines={2}>{venue.name}</Text>
                          <View style={styles.row}><Ionicons accessible={false} name="location-outline" size={14} color={colors.secondaryText} /><Text style={styles.venueAddress} numberOfLines={1}>{venue.address}</Text></View>
                          {lead ? <Text style={styles.venueLead} numberOfLines={1}>{lead.name} · <Text style={styles.venuePrice}>{lead.price > 0 ? formatCurrency(lead.price) : 'Liên hệ'}</Text></Text> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <Pressable accessibilityRole="button" accessibilityLabel="Khám phá tất cả dịch vụ" onPress={() => openSearch()} style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
              <LinearGradient colors={[...gradients.blush]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bannerFill}>
                <View style={styles.bannerText}>
                  <Text style={styles.bannerEyebrow}>Dành cho bạn</Text>
                  <Text style={styles.bannerTitle}>Một khoảng thời gian cho chính mình</Text>
                  <View style={styles.bannerCta}><Text style={styles.bannerCtaText}>Khám phá dịch vụ</Text><Ionicons accessible={false} name="arrow-forward" size={16} color={colors.onPrimary} /></View>
                </View>
                <Image source={editorial.homeHero} accessible={false} style={styles.bannerImage} resizeMode="cover" />
              </LinearGradient>
            </Pressable>

            {services.length > 0 ? (
              <View style={[styles.section, styles.gutter]}>
                <SectionHeader title="Dịch vụ đang nhận lịch" actionLabel="Tìm thêm" onAction={() => openSearch()} />
                <View style={styles.list}>
                  {services.map(({ service, venue }, index) => (
                    <Pressable key={service.id} accessibilityRole="button" accessibilityLabel={`${service.name} tại ${venue.name}, ${service.price > 0 ? formatCurrency(service.price) : 'liên hệ cơ sở'}, ${service.duration}`} onPress={() => navigation.navigate('VenueDetail', { venueId: venue.id, serviceId: service.id })} style={({ pressed }) => [styles.listRow, index < services.length - 1 && styles.listDivider, pressed && styles.pressed]}>
                      <ArtCover name={service.categoryName || service.name} height={52} width={52} rounded={radius.md} />
                      <View style={styles.flex}>
                        <Text style={styles.listTitle} numberOfLines={2}>{service.name}</Text>
                        <Text style={styles.listMeta} numberOfLines={1}>{venue.name}</Text>
                      </View>
                      <View style={styles.listPriceCol}>
                        <Text style={styles.listPrice}>{service.price > 0 ? formatCurrency(service.price) : 'Liên hệ'}</Text>
                        <Text style={styles.listMeta}>{service.duration}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {combos.length > 0 ? (
              <LinearGradient colors={[...gradients.lilac]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.comboBand}>
                <SectionHeader title="Gói dịch vụ đang áp dụng" style={styles.gutter} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {combos.slice(0, 6).map((combo) => <ComboCard key={combo.id} combo={combo} onPress={() => navigation.navigate('ComboDetail', { comboId: combo.id })} />)}
                </ScrollView>
              </LinearGradient>
            ) : null}
          </>
        )}
      </ScrollView>
      <StatusBarShade visible={shade.shaded} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: TAB_BAR_CLEARANCE + space.lg },
  gutter: { marginHorizontal: layout.gutter },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  pressed: { opacity: 0.88 },
  hero: { paddingHorizontal: layout.gutter, paddingBottom: space.xxl, borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet },
  top: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  wordmark: { ...type.h2, ...fw.display, fontSize: 22, color: colors.white },
  location: { minHeight: 40, maxWidth: '58%', flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)' },
  locationPressed: { backgroundColor: 'rgba(255,255,255,0.3)' },
  locationText: { ...type.secondaryStrong, color: colors.white, flexShrink: 1 },
  hello: { ...type.secondaryStrong, color: colors.accentFill, marginTop: space.md },
  greeting: { ...type.display, color: colors.white, marginTop: space.xs, marginBottom: space.lg, maxWidth: 320 },
  search: { minHeight: 54, borderRadius: radius.pill, backgroundColor: colors.surface, paddingLeft: space.lg, paddingRight: space.xs + 2, flexDirection: 'row', alignItems: 'center', gap: space.md, ...elevation.float },
  searchPressed: { backgroundColor: colors.primaryTint },
  searchText: { ...type.body, color: colors.secondaryText, flex: 1 },
  searchGo: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  upcoming: { marginHorizontal: layout.gutter, marginTop: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderColor: colors.border, ...elevation.card },
  upcomingDate: { width: 56, minHeight: 64, borderRadius: radius.md, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  upcomingDay: { ...type.numeric, fontSize: 22, lineHeight: 28, color: colors.white },
  upcomingMonth: { ...type.caption, color: colors.secondarySoft },
  upcomingEyebrow: { ...type.caption, ...fw.semibold, color: colors.primary },
  upcomingTitle: { ...type.h3 },
  upcomingMeta: { ...type.secondary, marginBottom: space.xs },
  skeleton: { padding: layout.gutter, gap: space.md },
  skeletonRow: { flexDirection: 'row', gap: space.md, overflow: 'hidden' },
  section: { marginTop: layout.sectionGap },
  rail: { paddingHorizontal: layout.gutter, gap: space.md, paddingTop: space.md, paddingBottom: space.xs },
  category: { width: 124, height: 156, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end' },
  categoryImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  categoryScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  illustration: { position: 'absolute', left: space.sm, top: space.sm, ...type.caption, color: colors.white, backgroundColor: 'rgba(42,18,48,0.6)', borderRadius: radius.sm, paddingHorizontal: space.xs + 2, overflow: 'hidden' },
  categoryNameOnImage: { ...type.secondaryStrong, color: colors.white, padding: space.md },
  categoryName: { ...type.secondaryStrong, padding: space.md, minHeight: 60 },
  notice: { marginTop: space.md },
  venue: { width: 260, borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  venueImage: { width: '100%', height: 132, backgroundColor: colors.surfaceMuted },
  venueRating: { position: 'absolute', right: space.sm, top: space.sm, backgroundColor: colors.surface },
  venueBody: { padding: space.md, gap: space.xs },
  venueName: { ...type.h3, minHeight: 48 },
  venueAddress: { ...type.secondary, flex: 1 },
  venueLead: { ...type.secondary, color: colors.body, marginTop: 2 },
  venuePrice: { ...fw.bold, color: colors.primary },
  banner: { marginHorizontal: layout.gutter, marginTop: layout.sectionGap, borderRadius: radius.xl, overflow: 'hidden' },
  bannerFill: { flexDirection: 'row', alignItems: 'stretch', minHeight: 156 },
  bannerText: { flex: 1, padding: space.lg, justifyContent: 'center', gap: space.sm },
  bannerEyebrow: { ...type.overline, color: colors.accent },
  bannerTitle: { ...type.h2, ...fw.display, fontSize: 21, lineHeight: 28 },
  bannerCta: { alignSelf: 'flex-start', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: space.lg },
  bannerCtaText: { ...type.secondaryStrong, color: colors.onPrimary },
  bannerImage: { width: 128, height: '100%', minHeight: 156 },
  list: { marginTop: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  listRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  listDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  listTitle: { ...type.bodyStrong },
  listMeta: { ...type.caption },
  listPriceCol: { alignItems: 'flex-end', maxWidth: '38%' },
  listPrice: { ...type.price, color: colors.primary },
  comboBand: { marginTop: layout.sectionGap, paddingTop: space.xl, paddingBottom: space.xl },
});
