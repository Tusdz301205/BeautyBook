import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import VenueMap from '../components/VenueMap';

import { HomeStackParamList } from '../navigation/HomeStack';
import { colors, elevation, families, familyOf, fw, layout, radius, space, tones, type, type Tone } from '../theme';
import { formatCurrency, leadWithRequested, servicePriceLabel } from '../data/catalogModels';
import BannerCarousel from '../components/home/BannerCarousel';
import ComboCard from '../components/home/ComboCard';
import { useFavorites } from '../context/FavoritesContext';
import { useBranchDetail } from '../hooks/useBranchDetail';
import { AppButton, ArtCover, Avatar, EmptyState, FamilyTag, IconButton, LoadingState, Notice, RatingPill, Segmented, StatusBarShade } from '../ui';

type Props = NativeStackScreenProps<HomeStackParamList, 'VenueDetail'>;

type TabKey = 'services' | 'info' | 'offers' | 'reviews';
const TABS: { key: TabKey; label: string }[] = [{ key: 'services', label: 'Dịch vụ' }, { key: 'info', label: 'Thông tin' }, { key: 'offers', label: 'Ưu đãi' }, { key: 'reviews', label: 'Đánh giá' }];
// Scroll distance after which the cover no longer backs the status bar.
const COVER_CLEAR = 150;

const SCORE_ROWS = [
  { label: '5', min: 4.5, max: 5.1 },
  { label: '4', min: 3.5, max: 4.5 },
  { label: '3', min: 2.5, max: 3.5 },
  { label: '2', min: 1.5, max: 2.5 },
  { label: '1', min: 0, max: 1.5 },
];

export default function VenueDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const requestedServiceId = route.params.serviceId;
  const requestedIds = route.params.serviceIds ?? (requestedServiceId ? [requestedServiceId] : []);
  // Booking intent comes first: services is the default tab.
  const [activeTab, setActiveTab] = useState<TabKey>('services');
  const [quantities, setQuantities] = useState<Record<string, number>>(Object.fromEntries(requestedIds.map(id => [id, 1])));
  useEffect(() => {
    setQuantities(Object.fromEntries(requestedIds.map(id => [id, 1])));
    setActiveTab('services');
  }, [route.params.venueId, requestedServiceId, route.params.serviceIds, route.params.rebooking]);
  const { isFavorite, toggleFavorite } = useFavorites();
  // The cover runs under the status bar; once it has scrolled away the bar gets a plum backing,
  // and the tabs pin just below it (a plain sticky header would sit underneath the status icons).
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [tabsY, setTabsY] = useState(0);
  const [coverGone, setCoverGone] = useState(false);
  const [tabsPinned, setTabsPinned] = useState(false);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const gone = y > COVER_CLEAR;
    const pinned = tabsY > 0 && y >= tabsY - insets.top;
    setCoverGone((current) => (current === gone ? current : gone));
    setTabsPinned((current) => (current === pinned ? current : pinned));
  };
  const changeTab = (key: TabKey) => {
    setActiveTab(key);
    if (tabsPinned) scrollRef.current?.scrollTo({ y: tabsY - insets.top, animated: false });
  };
  const { venue, serviceGroups, staff, combos: similarCombos, reviews, isLoading, error, extrasError, reload } = useBranchDetail(route.params.venueId);

  if (isLoading && !venue) {
    return <View style={styles.screen}><LoadingState message="Đang tải chi tiết cơ sở…" /></View>;
  }

  if (!venue) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.backRow}><IconButton icon="chevron-back" label="Quay lại" onPress={() => navigation.goBack()} /></View>
        <EmptyState icon="storefront-outline" title="Chưa mở được cơ sở này" message={error || 'Không tìm thấy cơ sở.'} actionLabel="Thử lại" onAction={() => void reload()} secondaryLabel="Tìm cơ sở khác" onSecondary={() => navigation.getParent()?.navigate('TimKiem')} />
      </SafeAreaView>
    );
  }

  const category = serviceGroups[0]?.name || 'Dịch vụ làm đẹp';
  const phone = venue.phone || '';
  const bannerSlides = (venue.imageUrls ?? []).map((imageUri, index) => ({ id: `${venue.id}-${index}`, imageUri }));
  const photoUrls = venue.imageUrls ?? [];
  const allServices = serviceGroups.flatMap((group) => group.items);
  // Display order only: what the customer arrived with leads the list, so the preselection is visible without scrolling.
  const displayGroups = leadWithRequested(serviceGroups, requestedIds);
  const selectedServices = allServices.filter((item) => (quantities[item.id] ?? 0) > 0);
  const primaryService = selectedServices[0];
  const bookingServiceIds = selectedServices.map((item) => item.id);
  // Never show a rating that the API has not backed with reviews.
  // Prefer the branch aggregate from the API; the loaded review page is only a recent sample.
  const reviewAverage = venue.rating > 0 ? venue.rating : reviews.length ? reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length : null;
  const reviewTotal = venue.reviewCount || reviews.length;
  const selectedTotal = selectedServices.reduce((sum, item) => sum + item.price, 0);
  const variablePrice = selectedServices.some((item) => item.priceKind && item.priceKind !== 'fixed');
  const latitude = Number(venue.latitude);
  const longitude = Number(venue.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 && (latitude !== 0 || longitude !== 0);

  const openGoogleMaps = () => {
    const query = hasCoordinates ? `${latitude},${longitude}` : venue.address;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  };
  const call = () => { if (phone) void Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`); };
  const openZalo = async () => {
    if (!phone) return;
    try { await Linking.openURL(`https://zalo.me/${phone.replace(/[^0-9]/g, '')}`); }
    catch { Alert.alert('Không thể mở Zalo', 'Vui lòng kiểm tra Zalo hoặc trình duyệt trên thiết bị.'); }
  };
  const toggleService = (id: string) => setQuantities((prev) => ({ ...prev, [id]: prev[id] ? 0 : 1 }));

  const book = () => {
    if (!primaryService) return;
    navigation.navigate('Booking', {
      branchId: venue.id,
      shopName: venue.name,
      addresses: [venue.address],
      service: {
        id: primaryService.id,
        name: selectedServices.length > 1 ? `${primaryService.name} và ${selectedServices.length - 1} dịch vụ khác` : primaryService.name,
        duration: primaryService.duration,
        price: selectedTotal || primaryService.price,
        originalPrice: selectedTotal || primaryService.price,
      },
      serviceIds: bookingServiceIds,
      staffOptions: staff,
    });
  };

  return (
    <View style={styles.screen}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} onScroll={onScroll} scrollEventThrottle={16}>
        <View>
          {bannerSlides.length > 0
            ? <BannerCarousel slides={bannerSlides} height={264} label={`Ảnh ${venue.name}`} />
            : <ArtCover name={category} monogram={venue.logoText} height={insets.top + 196} inset={radius.xl} accessibilityLabel={`${venue.name}, cơ sở chưa có ảnh`} />}
          <LinearGradient pointerEvents="none" colors={['rgba(42,18,48,0.5)', 'rgba(42,18,48,0)']} style={[styles.topScrim, { height: insets.top + 72 }]} />
          <IconButton icon="chevron-back" label="Quay lại" variant="scrim" onPress={() => navigation.goBack()} style={[styles.back, { top: insets.top + space.sm }]} />
        </View>

        <View style={styles.header}>
          <View style={styles.tagRow}>
            <FamilyTag name={category} label={category} />
            {reviewAverage !== null ? <RatingPill value={reviewAverage} count={reviewTotal || undefined} /> : <Text style={styles.metaText}>Chưa có đánh giá</Text>}
          </View>
          <Text accessibilityRole="header" style={styles.venueName}>{venue.name}</Text>
          <View style={styles.infoLine}><Ionicons accessible={false} name="location-outline" size={16} color={colors.secondaryText} /><Text style={styles.infoLineText}>{venue.address}</Text></View>
          <View style={styles.infoLine}><Ionicons accessible={false} name="time-outline" size={16} color={colors.secondaryText} /><Text style={styles.infoLineText}>Hôm nay: {venue.openingHours}</Text></View>
          <View style={styles.actions}>
            <QuickAction tone="success" icon="call" label="Gọi" onPress={call} disabled={!phone} />
            <QuickAction tone="info" icon="chatbubble-ellipses" label="Zalo" onPress={() => void openZalo()} disabled={!phone} />
            <QuickAction tone="request" icon="navigate" label="Chỉ đường" onPress={openGoogleMaps} />
          </View>
          {!phone ? <Text style={styles.caption}>Cơ sở chưa cập nhật số điện thoại.</Text> : null}
        </View>

        <View aria-hidden={tabsPinned} onLayout={(event) => setTabsY(event.nativeEvent.layout.y)} style={styles.tabsWrap}>
          <Segmented value={activeTab} onChange={changeTab} options={TABS} />
        </View>

        {/* Tall enough that the tabs can always reach their pinned position, even on a short tab. */}
        <View style={[styles.body, { minHeight: Math.max(0, windowHeight - insets.top - insets.bottom - 120) }]}>
          {extrasError ? <Notice tone="warning" message={extrasError} style={styles.notice} /> : null}

          {activeTab === 'services' && (
            <View>
              {requestedIds.some(id => !allServices.some(item => item.id === id)) ? <Notice tone="warning" message="Dịch vụ bạn chọn không còn ở cơ sở này. Hãy chọn dịch vụ khác bên dưới." style={styles.notice} /> : null}
              {route.params.rebooking ? <Notice tone="info" message="Giá và thời lượng dưới đây là thông tin hiện tại. Chọn lại dịch vụ nếu cần, sau đó chọn chuyên viên và giờ mới." style={styles.notice} /> : null}
              {allServices.length === 0 ? <EmptyState icon="cut-outline" title="Chưa có dịch vụ nhận lịch" message="Cơ sở chưa mở dịch vụ để đặt trực tuyến." /> : <Text style={styles.hint}>Chọn một hoặc nhiều dịch vụ để đặt lịch.</Text>}
              {displayGroups.map((group) => (
                <View key={group.name} style={styles.group}>
                  <View style={styles.groupHead}>
                    <View style={[styles.groupBadge, { backgroundColor: families[familyOf(group.name)].soft }]}><Ionicons accessible={false} name={families[familyOf(group.name)].icon as keyof typeof Ionicons.glyphMap} size={16} color={families[familyOf(group.name)].fg} /></View>
                    <Text accessibilityRole="header" style={styles.groupTitle}>{group.name}</Text>
                    <Text style={styles.groupCount}>{group.items.length} dịch vụ</Text>
                  </View>
                  {group.items.map((item) => {
                    const selected = Boolean(quantities[item.id]);
                    const saved = isFavorite(item.id);
                    return (
                      <View key={item.id} style={[styles.service, selected && styles.serviceSelected]}>
                        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={`${item.name}, ${item.duration}, ${servicePriceLabel(item)}`} onPress={() => toggleService(item.id)} style={styles.serviceMain}>
                          <Ionicons accessible={false} name={selected ? 'checkbox' : 'square-outline'} size={24} color={selected ? colors.primary : colors.borderStrong} />
                          <View style={styles.flex}>
                            <Text style={styles.serviceName}>{item.name}</Text>
                            <Text style={styles.serviceMeta}>{item.duration}</Text>
                            <Text style={styles.servicePrice}>{servicePriceLabel(item)}</Text>
                          </View>
                        </Pressable>
                        <IconButton icon={saved ? 'heart' : 'heart-outline'} label={saved ? `Bỏ lưu ${item.name}` : `Lưu ${item.name}`} selected={saved} color={colors.primary} onPress={() => void toggleFavorite(item.id)} />
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          )}

          {activeTab === 'info' && (
            <View style={styles.infoTab}>
              <InfoRow icon="location-outline" label="Địa chỉ" value={venue.address} />
              <InfoRow icon="time-outline" label="Giờ mở cửa hôm nay" value={venue.openingHours || 'Chưa cập nhật'} />
              <InfoRow icon="call-outline" label="Điện thoại" value={phone || 'Chưa cập nhật'} />
              {hasCoordinates ? (
                <View style={styles.map}>
                  <VenueMap latitude={latitude} longitude={longitude} title={venue.name} description={venue.address} onPress={openGoogleMaps} />
                </View>
              ) : null}
              <AppButton variant="outline" icon="navigate-outline" label="Mở chỉ đường" onPress={openGoogleMaps} />
              {staff.length > 0 ? (
                <>
                  <Text accessibilityRole="header" style={styles.subTitle}>Đội ngũ chuyên viên</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.staffRail} style={styles.staffScroll}>
                    {staff.map((person) => (
                      <View key={person.id} accessible accessibilityLabel={`${person.name}${person.title ? `, ${person.title}` : ''}${person.ratingCount ? `, đánh giá ${(person.rating ?? 0).toFixed(1)}` : ''}`} style={styles.staffCard}>
                        <Avatar uri={person.avatarUrl} name={person.name} size={56} familyName={person.specialties?.[0] || person.title || person.name} />
                        <Text style={styles.staffName} numberOfLines={2}>{person.name}</Text>
                        {person.title ? <Text style={styles.staffMeta} numberOfLines={1}>{person.title}</Text> : null}
                        {person.specialties?.length ? <Text style={styles.staffMeta} numberOfLines={2}>{person.specialties.slice(0, 3).join(' · ')}</Text> : null}
                        {person.ratingCount ? <RatingPill value={person.rating ?? 0} count={person.ratingCount} style={styles.staffRating} /> : null}
                      </View>
                    ))}
                  </ScrollView>
                </>
              ) : null}
              <Text accessibilityRole="header" style={styles.subTitle}>Hình ảnh</Text>
              {photoUrls.length ? (
                <View style={styles.photoGrid}>
                  {photoUrls.map((url, index) => <Image key={url + index} source={{ uri: url }} style={styles.photo} resizeMode="cover" accessibilityLabel={`Ảnh ${venue.name} ${index + 1}`} />)}
                </View>
              ) : <Text style={styles.metaText}>Cơ sở chưa cập nhật hình ảnh.</Text>}
            </View>
          )}

          {activeTab === 'offers' && (
            similarCombos.length > 0
              ? <View style={styles.offerList}>{similarCombos.map((combo) => <ComboCard key={combo.id} combo={combo} width="100%" onPress={() => navigation.push('ComboDetail', { comboId: combo.id })} />)}</View>
              : <EmptyState icon="gift-outline" title="Chưa có gói ưu đãi" message="Cơ sở chưa có gói dịch vụ đang áp dụng." />
          )}

          {activeTab === 'reviews' && (
            reviews.length === 0 ? <EmptyState icon="chatbubbles-outline" title="Chưa có đánh giá" message="Bạn có thể đánh giá sau khi lịch hẹn hoàn thành." /> : (
              <View>
                <View style={styles.reviewSummary}>
                  <View style={styles.reviewScore}>
                    <Text style={styles.reviewAverage}>{(reviewAverage ?? 0).toFixed(1)}</Text>
                    <Text style={styles.metaText}>{reviewTotal} đánh giá</Text>
                  </View>
                  <View style={styles.flex}>
                    {SCORE_ROWS.map((row) => {
                      const count = reviews.filter((r) => r.score >= row.min && r.score < row.max).length;
                      return (
                        <View key={row.label} accessible accessibilityLabel={`${row.label} sao: ${count} đánh giá`} style={styles.barRow}>
                          <Text style={styles.barLabel}>{row.label}★</Text>
                          <View style={styles.barTrack}><View style={[styles.barFill, { width: `${(count / reviews.length) * 100}%` }]} /></View>
                          <Text style={styles.barCount}>{count}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
                <Text style={styles.caption}>{reviewTotal > reviews.length ? `Phân bố và nội dung bên dưới là ${reviews.length} đánh giá gần đây nhất đã tải. ` : ''}Đánh giá được gửi sau lịch hẹn đã hoàn thành.</Text>
                {reviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHead}>
                      <Text style={styles.reviewer}>{review.reviewerName}</Text>
                      <RatingPill value={review.score} />
                    </View>
                    <Text style={styles.caption}>{review.date}</Text>
                    {review.text ? <Text style={styles.reviewText}>{review.text}</Text> : null}
                  </View>
                ))}
              </View>
            )
          )}
        </View>
      </ScrollView>

      {tabsPinned ? (
        <View style={[styles.pinnedTabs, { paddingTop: insets.top }]}>
          <StatusBarShade visible />
          <View style={styles.tabsWrap}><Segmented value={activeTab} onChange={changeTab} options={TABS} /></View>
        </View>
      ) : <StatusBarShade visible={coverGone} />}

      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <View style={styles.flex}>
          <Text style={styles.bottomLabel}>{selectedServices.length ? `${selectedServices.length} dịch vụ đã chọn` : 'Chưa chọn dịch vụ'}</Text>
          {selectedServices.length ? <Text style={styles.bottomPrice}>Tạm tính {variablePrice ? 'từ ' : ''}{formatCurrency(selectedTotal)}</Text> : <Text style={styles.caption}>Giá cuối cùng được xác nhận khi đặt lịch</Text>}
        </View>
        <AppButton label={selectedServices.length ? 'Tiếp tục đặt lịch' : 'Chọn dịch vụ'} disabled={!primaryService} onPress={book} style={styles.bookButton} />
      </SafeAreaView>
    </View>
  );
}

function QuickAction({ icon, label, onPress, disabled, tone }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; tone: Tone }) {
  const palette = tones[tone];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.quick, { backgroundColor: disabled ? colors.disabledSurface : palette.bg }, pressed && { opacity: 0.8 }]}>
      <Ionicons accessible={false} name={icon} size={20} color={disabled ? colors.disabledText : palette.fg} />
      <Text style={[styles.quickLabel, { color: disabled ? colors.disabledText : palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons accessible={false} name={icon} size={20} color={colors.secondaryText} />
      <View style={styles.flex}><Text style={styles.caption}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  backRow: { paddingHorizontal: space.xs },
  scrollContent: { paddingBottom: space.xxl },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  back: { position: 'absolute', left: space.md },
  header: { backgroundColor: colors.surface, paddingHorizontal: layout.gutter, paddingTop: space.lg, paddingBottom: space.lg, gap: space.xs, marginTop: -radius.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  tagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginBottom: space.xs },
  venueName: { ...type.h1 },
  metaText: { ...type.secondary },
  infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: space.xs },
  infoLineText: { ...type.secondary, color: colors.body, flex: 1 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  quick: { flex: 1, minHeight: layout.touch + 8, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2 },
  quickLabel: { ...type.caption, ...fw.semibold },
  caption: { ...type.caption, marginTop: space.xs },
  tabsWrap: { backgroundColor: colors.background, paddingHorizontal: layout.gutter, paddingVertical: space.md },
  pinnedTabs: { position: 'absolute', top: 0, left: 0, right: 0, borderBottomWidth: 1, borderBottomColor: colors.divider },
  body: { paddingHorizontal: layout.gutter },
  notice: { marginBottom: space.md },
  hint: { ...type.secondary, marginBottom: space.sm },
  group: { marginTop: space.md },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  groupBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { ...type.h3, flex: 1 },
  groupCount: { ...type.caption },
  service: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: space.sm, paddingRight: space.xs },
  serviceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  serviceMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.md, minHeight: 72 },
  serviceName: { ...type.bodyStrong },
  serviceMeta: { ...type.secondary },
  servicePrice: { ...type.price, color: colors.primary, marginTop: 2 },
  infoTab: { gap: space.md },
  infoRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md },
  infoValue: { ...type.body, color: colors.heading },
  map: { height: 112, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.lavenderSoft },
  subTitle: { ...type.h3, marginTop: space.sm },
  staffScroll: { marginHorizontal: -layout.gutter },
  staffRail: { paddingHorizontal: layout.gutter, gap: space.md },
  staffCard: { width: 148, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.xs },
  staffName: { ...type.secondaryStrong, color: colors.heading, marginTop: space.xs },
  staffMeta: { ...type.caption },
  staffRating: { marginTop: space.xs },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  photo: { width: '31.5%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  offerList: { gap: space.md },
  reviewSummary: { flexDirection: 'row', gap: space.lg, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg },
  reviewScore: { alignItems: 'center', minWidth: 72 },
  reviewAverage: { ...type.numeric },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 20 },
  barLabel: { ...type.caption, width: 24 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.goldFill },
  barCount: { ...type.caption, width: 24, textAlign: 'right', fontVariant: ['tabular-nums'] },
  reviewCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, marginTop: space.md },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  reviewer: { ...type.bodyStrong, flex: 1 },
  reviewText: { ...type.body, marginTop: space.sm },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: layout.gutter, paddingTop: space.md, paddingBottom: space.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider, ...elevation.raised },
  bottomLabel: { ...type.secondaryStrong, color: colors.heading },
  bottomPrice: { ...type.price, color: colors.primary },
  bookButton: { minWidth: 148, flexShrink: 1 },
});
