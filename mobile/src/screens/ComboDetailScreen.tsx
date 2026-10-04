import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { HomeStackParamList } from '../navigation/HomeStack';
import { colors } from '../constants/colors';
import { formatCurrency } from '../data/catalogModels';
import PlaceholderCover from '../components/PlaceholderCover';
import ComboCard from '../components/home/ComboCard';
import BannerCarousel from '../components/home/BannerCarousel';
import SectionCard from '../components/home/SectionCard';
import SelectListSheet from '../components/SelectListSheet';
import { useComboDetail } from '../hooks/useComboDetail';

type Props = NativeStackScreenProps<HomeStackParamList, 'ComboDetail'>;

export default function ComboDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isAddressPickerVisible, setAddressPickerVisible] = useState(false);
  const { combo, similarCombos, isLoading, error, reload } = useComboDetail(route.params.comboId);

  if (isLoading && !combo) {
    return (
      <View style={styles.notFound}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.notFoundText}>Đang tải ưu đãi...</Text>
      </View>
    );
  }

  if (!combo) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>{error || 'Không tìm thấy ưu đãi này'}</Text>
        <TouchableOpacity onPress={() => void reload()}>
          <Text style={styles.price}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bannerSlides = combo.imageUrls.map((imageUri, index) => ({ id: `${combo.id}-${index}`, imageUri }));
  const shopAddresses = [combo.address].filter(Boolean);
  const displayAddress = selectedAddress ?? combo.address;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.bannerWrap}>
          {bannerSlides.length > 0 ? (
            <BannerCarousel slides={bannerSlides} height={300} style={styles.banner} imageBorderRadius={0} gap={0} />
          ) : (
            <PlaceholderCover seed={combo.id} label={combo.logoText} icon="pricetag-outline" height={300} />
          )}
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 12 }]}
            onPress={() => navigation.goBack()}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{combo.title}</Text>

          <TouchableOpacity
            style={styles.addressPill}
            activeOpacity={0.7}
            onPress={() => setAddressPickerVisible(true)}
          >
            <Text style={styles.addressPillText} numberOfLines={1}>
              {displayAddress}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.priceRow}>
            <Ionicons name="sunny-outline" size={18} color={colors.primary} />
            <Text style={styles.price}>{formatCurrency(combo.price)}</Text>
            <Text style={styles.originalPrice}>{formatCurrency(combo.originalPrice)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="home-outline" size={16} color={colors.textGray} />
            <Text style={styles.infoText}>{combo.shopName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={colors.textGray} />
            <Text style={styles.infoText}>{displayAddress}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>MÔ TẢ DỊCH VỤ</Text>
          {combo.steps.map((step, index) => (
            <Text key={index} style={styles.stepText}>
              Bước {index + 1}: {step}
            </Text>
          ))}

          <Text style={[styles.sectionTitle, styles.sectionSpacingTop]}>ĐIỀU KHOẢN SỬ DỤNG</Text>
          {combo.terms.map((term, index) => (
            <View key={index} style={styles.termRow}>
              <Text style={styles.termIndex}>{index + 1}.</Text>
              <Text style={styles.termText}>{term}</Text>
            </View>
          ))}

          <Text style={[styles.sectionTitle, styles.sectionSpacingTop]}>THÔNG TIN SPA / SALON</Text>
          <View style={styles.shopCard}>
            <View style={styles.shopCoverWrap}>
              <PlaceholderCover seed={combo.shopName} label={combo.logoText} icon="leaf-outline" height={90} />
              <View style={styles.shopRatingBadge}>
                <Text style={styles.shopRatingText}>{combo.rating.toFixed(1)}</Text>
              </View>
            </View>
            <View style={styles.shopInfo}>
              <Text style={styles.shopName}>{combo.shopName}</Text>
              <View style={styles.shopHoursRow}>
                <Ionicons name="time-outline" size={14} color={colors.textGray} />
                <Text style={styles.shopHours}>{combo.hours}</Text>
              </View>
            </View>
          </View>
        </View>

        {similarCombos.length > 0 && (
          <SectionCard style={styles.similarSection}>
            <Text style={styles.similarTitle}>☀️ ƯU ĐÃI TƯƠNG TỰ</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarList}
            >
              {similarCombos.map((item) => (
                <ComboCard
                  key={item.id}
                  combo={item}
                  onPress={() => navigation.push('ComboDetail', { comboId: item.id })}
                />
              ))}
            </ScrollView>
          </SectionCard>
        )}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bookmarkButton}
          activeOpacity={0.7}
          onPress={() => setIsBookmarked((prev) => !prev)}
        >
          <Ionicons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={30}
            color={isBookmarked ? colors.primary : colors.textBody}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bookButton}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('Booking', {
              branchId: combo.branchId,
              shopName: combo.shopName,
              addresses: shopAddresses,
              service: {
                id: combo.id,
                name: combo.title,
                duration: combo.duration,
                price: combo.price,
                originalPrice: combo.originalPrice,
              },
              serviceIds: combo.serviceIds,
              comboId: combo.id,
            })
          }
        >
          <Text style={styles.bookButtonText}>ĐẶT LỊCH</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <SelectListSheet
        visible={isAddressPickerVisible}
        title="Chọn địa chỉ"
        options={shopAddresses}
        selectedValue={displayAddress}
        onSelect={(address) => {
          setSelectedAddress(address);
          setAddressPickerVisible(false);
        }}
        onClose={() => setAddressPickerVisible(false)}
        columns={1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  content: {
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: colors.textDark,
    marginBottom: 14,
  },
  addressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  addressPillText: {
    flex: 1,
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  price: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.primary,
  },
  originalPrice: {
    fontSize: 16,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 16,
    color: colors.textBody,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
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
  stepText: {
    fontSize: 17,
    color: colors.textBody,
    lineHeight: 25,
    marginBottom: 8,
  },
  termRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  termIndex: {
    fontSize: 17,
    color: colors.textBody,
    fontWeight: '600',
  },
  termText: {
    flex: 1,
    fontSize: 17,
    color: colors.textBody,
    lineHeight: 25,
  },
  shopCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  shopCoverWrap: {
    width: 110,
    position: 'relative',
  },
  shopRatingBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: colors.ratingGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomRightRadius: 10,
  },
  shopRatingText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 12,
  },
  shopInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    gap: 6,
  },
  shopName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textDark,
  },
  shopHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shopHours: {
    fontSize: 15,
    color: colors.textGray,
  },
  similarSection: {
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
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bookmarkButton: {
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
