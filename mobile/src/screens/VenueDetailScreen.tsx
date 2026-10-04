import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import VenueMap from '../components/VenueMap';

import { HomeStackParamList } from '../navigation/HomeStack';
import { colors } from '../constants/colors';
import { formatCurrency } from '../data/catalogModels';
import BannerCarousel from '../components/home/BannerCarousel';
import SectionCard from '../components/home/SectionCard';
import ComboCard from '../components/home/ComboCard';
import { useFavorites } from '../context/FavoritesContext';
import { useBranchDetail } from '../hooks/useBranchDetail';

type Props = NativeStackScreenProps<HomeStackParamList, 'VenueDetail'>;

type TabKey = 'info' | 'services' | 'offers' | 'reviews';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'info', label: 'Thông tin' },
  { key: 'services', label: 'Dịch vụ' },
  { key: 'offers', label: 'Ưu đãi' },
  { key: 'reviews', label: 'Đánh giá' },
];

const RATING_BUCKETS = [
  { label: '5 sao', min: 4.5, max: 5.1, color: colors.ratingGreen, face: '😄' },
  { label: '4 sao', min: 3.5, max: 4.5, color: colors.bookingTag, face: '🙂' },
  { label: '3 sao', min: 2.5, max: 3.5, color: colors.orange, face: '😐' },
  { label: '1–2 sao', min: 0, max: 2.5, color: colors.discountRed, face: '🙁' },
];

type ActionKey = 'call' | 'chat' | 'favorite';

const ACTION_ICONS: { key: ActionKey; active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'call', active: 'call', inactive: 'call-outline' },
  { key: 'chat', active: 'chatbubble', inactive: 'chatbubble-outline' },
  { key: 'favorite', active: 'heart', inactive: 'heart-outline' },
];

export default function VenueDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const requestedServiceId = route.params.serviceId;
  const [activeTab, setActiveTab] = useState<TabKey>(requestedServiceId ? 'services' : 'info');
  const [quantities, setQuantities] = useState<Record<string, number>>(requestedServiceId ? { [requestedServiceId]: 1 } : {});
  useEffect(() => {
    if (!requestedServiceId) return;
    setQuantities({ [requestedServiceId]: 1 });
    setActiveTab('services');
  }, [requestedServiceId]);
  const [activeActions, setActiveActions] = useState<Record<ActionKey, boolean>>({
    call: false,
    chat: false,
    favorite: false,
  });
  const { isFavorite, toggleFavorite } = useFavorites();
  const {
    venue,
    serviceGroups,
    staff,
    combos: similarCombos,
    reviews: remoteReviews,
    isLoading,
    error,
    reload,
  } = useBranchDetail(route.params.venueId);

  const toggleAction = (key: ActionKey) => {
    setActiveActions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading && !venue) {
    return (
      <View style={styles.notFound}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.notFoundText}>Đang tải chi tiết địa điểm...</Text>
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>{error || 'Không tìm thấy địa điểm này'}</Text>
        <TouchableOpacity onPress={() => void reload()}>
          <Text style={styles.servicePrice}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const category = serviceGroups[0]?.name || 'Dịch vụ làm đẹp';
  const phone = venue.phone || '';
  const bannerSlides = (venue.imageUrls ?? []).map((imageUri, index) => ({ id: `${venue.id}-${index}`, imageUri }));
  const photoUrls = venue.imageUrls ?? [];
  const reviews = remoteReviews;
  const allServices = serviceGroups.flatMap((group) => group.items);
  const selectedServices = allServices.filter((item) => (quantities[item.id] ?? 0) > 0);
  const primaryService = selectedServices[0] ?? (requestedServiceId ? undefined : allServices[0]);
  const bookingServiceIds = selectedServices.length ? selectedServices.map((item) => item.id) : primaryService ? [primaryService.id] : [];
  const displayRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length
    : venue.rating;
  const latitude = Number(venue.latitude);
  const longitude = Number(venue.longitude);
  const hasCoordinates = Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
    && (latitude !== 0 || longitude !== 0);

  const openGoogleMaps = () => {
    const query = hasCoordinates ? `${latitude},${longitude}` : venue.address;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  };

  const openZalo = async () => {
    if (!phone) {
      Alert.alert('Chưa có số Zalo', 'Cơ sở chưa cập nhật số điện thoại để liên hệ qua Zalo.');
      return;
    }
    const zaloPhone = phone.replace(/[^0-9]/g, '');
    try {
      await Linking.openURL(`https://zalo.me/${zaloPhone}`);
    } catch {
      Alert.alert('Không thể mở Zalo', 'Vui lòng kiểm tra Zalo hoặc trình duyệt trên thiết bị.');
    }
  };

  const adjustQuantity = (id: string, delta: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.min(1, Math.max(0, (prev[id] ?? 0) + delta)) }));
  };

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.bannerWrap}>
          {bannerSlides.length > 0 ? (
            <BannerCarousel slides={bannerSlides} height={260} style={styles.banner} imageBorderRadius={0} gap={0} />
          ) : (
            <View style={styles.noBanner}><Ionicons name="storefront-outline" size={34} color={colors.primary} /><Text style={styles.noBannerText}>Cơ sở chưa cập nhật ảnh</Text></View>
          )}
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 12 }]}
            onPress={() => navigation.goBack()}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.category}>{category.toUpperCase()}</Text>
              <Text style={styles.venueName}>{venue.name}</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingBadgeText}>{displayRating.toFixed(1)}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            {TABS.map((tab) => (
              <TouchableOpacity key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab.key }} style={styles.tabItem} onPress={() => setActiveTab(tab.key)}>
                <Text numberOfLines={1} style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
                {activeTab === tab.key && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {activeTab === 'info' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>THÔNG TIN</Text>
            <View style={styles.infoRow}>
              <Ionicons name="map-outline" size={18} color={colors.textGray} />
              <Text style={styles.infoText}>Địa chỉ: {venue.address}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={18} color={colors.textGray} />
              <Text style={styles.infoText}>Giờ mở cửa: {venue.openingHours}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color={colors.textGray} />
              <Text style={styles.infoText}>Điện thoại: {phone || 'Chưa cập nhật'}</Text>
            </View>

            {hasCoordinates ? (
              <View style={styles.mapContainer}>
                <VenueMap latitude={latitude} longitude={longitude} title={venue.name} description={venue.address} onPress={openGoogleMaps} />
                <TouchableOpacity style={styles.directionsButton} onPress={openGoogleMaps} activeOpacity={0.85}>
                  <Ionicons name="navigate" size={16} color={colors.white} />
                  <Text style={styles.directionsText}>Chỉ đường</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.mapPlaceholder} onPress={openGoogleMaps} activeOpacity={0.8}>
                <Ionicons name="location" size={32} color={colors.primary} />
                <Text style={styles.mapPlaceholderText}>Xem địa chỉ trên Google Maps</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.sectionTitle, styles.sectionSpacingTop]}>HÌNH ẢNH</Text>
            <View style={styles.photoGrid}>
              {photoUrls.map((url, index) => (
                <Image key={index} source={{ uri: url }} style={styles.photoItem} resizeMode="cover" />
              ))}
              {photoUrls.length === 0 && <Text style={styles.infoText}>Địa điểm chưa cập nhật hình ảnh.</Text>}
            </View>
          </View>
        )}

        {activeTab === 'services' && (
          <View style={styles.tabContent}>
            <Text style={styles.serviceIntro}>Bấm chọn dịch vụ để đặt lịch</Text>
            {requestedServiceId && !allServices.some((item) => item.id === requestedServiceId) && (
              <Text style={styles.serviceIntro}>Dịch vụ bạn chọn không còn ở cơ sở này. Hãy chọn dịch vụ khác bên dưới.</Text>
            )}

            {serviceGroups.map((group) => (
              <View key={group.name}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupHeaderText}>{group.name}</Text>
                  <View style={styles.groupHeaderRight}>
                    <Text style={styles.groupHeaderCount}>{group.items.length} dịch vụ</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.primary} />
                  </View>
                </View>
                {group.items.map((item) => (
                  <View key={item.id} style={styles.serviceRow}>
                    <View style={styles.serviceInfo}>
                      <View style={styles.serviceNameRow}>
                        <Ionicons name="information-circle-outline" size={16} color={colors.textGray} />
                        <Text style={styles.serviceName}>{item.name}</Text>
                      </View>
                      <Text style={styles.serviceDuration}>{item.duration}</Text>
                      <Text style={styles.servicePrice}>{formatCurrency(item.price)}</Text>
                      <TouchableOpacity accessibilityLabel={`Lưu dịch vụ ${item.name}`} onPress={() => void toggleFavorite(item.id)} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 }}>
                        <Ionicons name={isFavorite(item.id) ? 'heart' : 'heart-outline'} size={17} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>{isFavorite(item.id) ? 'Đã lưu' : 'Lưu dịch vụ'}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.stepper}>
                      <TouchableOpacity style={styles.stepperButton} onPress={() => adjustQuantity(item.id, -1)}>
                        <Ionicons name="remove" size={16} color={colors.textGray} />
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{quantities[item.id] ?? 0}</Text>
                      <TouchableOpacity
                        style={[styles.stepperButton, styles.stepperButtonAdd]}
                        onPress={() => adjustQuantity(item.id, 1)}
                      >
                        <Ionicons name="add" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {activeTab === 'offers' && similarCombos.length > 0 && (
          <SectionCard style={styles.offersSection}>
            <Text style={styles.similarTitle}>☀️ ƯU ĐÃI TƯƠNG TỰ</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarList}>
              {similarCombos.map((combo) => (
                <ComboCard
                  key={combo.id}
                  combo={combo}
                  onPress={() => navigation.push('ComboDetail', { comboId: combo.id })}
                />
              ))}
            </ScrollView>
          </SectionCard>
        )}

        {activeTab === 'reviews' && (
          <View style={styles.tabContent}>
            <View style={styles.ratingBucketsRow}>
              {RATING_BUCKETS.map((bucket) => {
                const count = reviews.filter((r) => r.score >= bucket.min && r.score < bucket.max).length;
                return (
                  <View key={bucket.label} style={[styles.bucketBox, { borderColor: bucket.color }]}>
                    <Text style={styles.bucketFace}>{bucket.face}</Text>
                    <Text style={[styles.bucketRange, { color: bucket.color }]}>{bucket.label}</Text>
                    <Text style={styles.bucketCount}>({count})</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.reviewSummary}>{reviews.length} đánh giá • bình luận</Text>
            <Text style={styles.reviewHint}>Bạn có thể đánh giá sau khi lịch hẹn hoàn thành.</Text>

            {reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewBookedRow}>
                    <Ionicons name="calendar-outline" size={14} color={colors.ratingGreen} />
                    <Text style={styles.reviewBookedText}>Đã đặt lịch</Text>
                    <View style={styles.reviewScoreBadge}>
                      <Text style={styles.reviewScoreText}>{review.score.toFixed(1)}</Text>
                    </View>
                  </View>
                  <Ionicons name="flag-outline" size={16} color={colors.discountRed} />
                </View>
                <Text style={styles.reviewerLine}>
                  <Text style={styles.reviewerName}>{review.reviewerName}</Text> • {review.date}
                </Text>
                <Text style={styles.reviewText}>{review.text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        {ACTION_ICONS.map((action) => {
          const isActive = action.key === 'favorite' ? !!primaryService && isFavorite(primaryService.id) : activeActions[action.key];
          return (
            <TouchableOpacity
              key={action.key}
              style={styles.iconButton}
              activeOpacity={0.7}
              onPress={() => {
                if (action.key === 'favorite') {
                  if (primaryService) void toggleFavorite(primaryService.id);
                } else if (action.key === 'call') {
                  if (phone) Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
                } else if (action.key === 'chat') {
                  void openZalo();
                } else {
                  toggleAction(action.key);
                }
              }}
            >
              <Ionicons
                name={isActive ? action.active : action.inactive}
                size={30}
                color={isActive ? colors.primary : colors.textBody}
              />
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.bookButton}
          activeOpacity={0.85}
          disabled={!primaryService}
          onPress={() => {
            if (!primaryService) return;
            const selectedTotal = selectedServices.reduce((sum, item) => sum + item.price, 0);
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
          }}
        >
          <Text style={styles.bookButtonText}>Đặt Lịch</Text>
        </TouchableOpacity>
      </SafeAreaView>

    </View>
  );
}

const styles = StyleSheet.create({
  noBanner: { height: 210, backgroundColor: '#EEE2E1', alignItems: 'center', justifyContent: 'center', gap: 9 },
  noBannerText: { color: colors.textBody, fontSize: 13 },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    color: colors.textGray,
    fontSize: 15,
  },
  bannerWrap: {
    position: 'relative',
  },
  banner: {
    marginHorizontal: 0,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  headerTitleBlock: {
    flex: 1,
  },
  category: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textGray,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  venueName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textDark,
  },
  ratingBadge: {
    backgroundColor: colors.ratingGreen,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ratingBadgeText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 17,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabItem: {
    minWidth: 70,
    paddingHorizontal: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 14,
    color: colors.textGray,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.primary,
  },
  tabIndicator: {
    marginTop: 8,
    height: 3,
    width: '100%',
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  tabContent: {
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textGray,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionSpacingTop: {
    marginTop: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 16,
    color: colors.textBody,
    lineHeight: 22,
  },
  mapPlaceholder: {
    height: 160,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  mapPlaceholderText: {
    color: colors.textGray,
    fontSize: 14,
  },
  mapContainer: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.background,
    marginTop: 8,
    marginBottom: 8,
  },
  directionsButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: colors.black,
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  directionsText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  amenitiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  amenitiesDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 12,
  },
  amenitiesDetailText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  amenitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  amenityItem: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  photoItem: {
    width: '32%',
    height: 105,
    borderRadius: 10,
    marginBottom: 10,
  },
  serviceIntro: {
    fontSize: 16,
    color: colors.textBody,
    marginBottom: 4,
  },
  servicePromo: {
    fontSize: 15,
    color: colors.orange,
    fontWeight: '600',
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  groupHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  groupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groupHeaderCount: {
    fontSize: 14,
    color: colors.primary,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  serviceInfo: {
    flex: 1,
    gap: 4,
  },
  serviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceName: {
    fontSize: 16,
    color: colors.textDark,
    fontWeight: '600',
  },
  serviceDuration: {
    fontSize: 14,
    color: colors.textGray,
  },
  servicePrice: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonAdd: {
    backgroundColor: colors.primaryLight,
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    minWidth: 16,
    textAlign: 'center',
  },
  offersSection: {
    marginTop: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  similarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textDark,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  similarList: {
    paddingHorizontal: 20,
    gap: 12,
    paddingVertical: 6,
  },
  ratingBucketsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  bucketBox: {
    flex: 1,
    marginHorizontal: 3,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  bucketFace: {
    fontSize: 26,
    marginBottom: 2,
  },
  bucketRange: {
    fontSize: 12,
    fontWeight: '700',
  },
  bucketCount: {
    fontSize: 13,
    color: colors.textGray,
  },
  reviewSummary: {
    fontSize: 15,
    color: colors.textGray,
    marginBottom: 16,
  },
  reviewHint: {
    color: colors.textGray,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  reviewCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewBookedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewBookedText: {
    fontSize: 14,
    color: colors.ratingGreen,
    fontWeight: '600',
  },
  reviewScoreBadge: {
    backgroundColor: colors.ratingGreen,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  reviewScoreText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  reviewerLine: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 6,
  },
  reviewerName: {
    fontWeight: '700',
    color: colors.textDark,
  },
  reviewText: {
    fontSize: 15,
    color: colors.textBody,
    lineHeight: 21,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  bookButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.5,
  },
});
