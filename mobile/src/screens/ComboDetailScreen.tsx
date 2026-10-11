import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { HomeStackParamList } from '../navigation/HomeStack';
import { colors, elevation, layout, radius, space, type } from '../theme';
import { formatCurrency } from '../data/catalogModels';
import ComboCard from '../components/home/ComboCard';
import BannerCarousel from '../components/home/BannerCarousel';
import { useComboDetail } from '../hooks/useComboDetail';
import { AppButton, EmptyState, IconButton, LoadingState } from '../ui';

type Props = NativeStackScreenProps<HomeStackParamList, 'ComboDetail'>;

export default function ComboDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { combo, similarCombos, isLoading, error, reload } = useComboDetail(route.params.comboId);

  if (isLoading && !combo) return <View style={styles.screen}><LoadingState message="Đang tải gói dịch vụ…" /></View>;

  if (!combo) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.backRow}><IconButton icon="chevron-back" label="Quay lại" onPress={() => navigation.goBack()} /></View>
        <EmptyState icon="gift-outline" title="Chưa mở được gói dịch vụ" message={error || 'Không tìm thấy gói dịch vụ này.'} actionLabel="Thử lại" onAction={() => void reload()} />
      </SafeAreaView>
    );
  }

  const bannerSlides = combo.imageUrls.map((imageUri, index) => ({ id: `${combo.id}-${index}`, imageUri }));
  const discounted = combo.originalPrice > combo.price;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View>
          {bannerSlides.length > 0
            ? <BannerCarousel slides={bannerSlides} height={240} label={`Ảnh gói ${combo.title}`} />
            : <View style={[styles.cover, { paddingTop: insets.top + space.xl }]}><Ionicons accessible={false} name="gift-outline" size={30} color={colors.accent} /><Text style={styles.coverText}>{combo.shopName}</Text></View>}
          <IconButton icon="chevron-back" label="Quay lại" variant="scrim" onPress={() => navigation.goBack()} style={[styles.back, { top: insets.top + space.sm }]} />
        </View>

        <View style={styles.content}>
          <Text style={styles.eyebrow}>Gói dịch vụ</Text>
          <Text accessibilityRole="header" style={styles.title}>{combo.title}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCurrency(combo.price)}</Text>
            {discounted ? <Text style={styles.original}>{formatCurrency(combo.originalPrice)}</Text> : null}
            {discounted && combo.discountPercent > 0 ? <Text style={styles.badge}>Giảm {combo.discountPercent}%</Text> : null}
          </View>
          <View style={styles.metaRow}><Ionicons accessible={false} name="time-outline" size={16} color={colors.secondaryText} /><Text style={styles.meta}>{combo.duration}</Text></View>

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Bao gồm</Text>
            {combo.steps.map((step, index) => (
              <View key={index} style={styles.stepRow}>
                <Text style={styles.stepIndex}>{index + 1}</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Điều kiện áp dụng</Text>
            {combo.terms.map((term, index) => (
              <View key={index} style={styles.termRow}>
                <Ionicons accessible={false} name="checkmark-circle-outline" size={18} color={colors.sage} />
                <Text style={styles.termText}>{term}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Cơ sở áp dụng</Text>
            <Text style={styles.shopName}>{combo.shopName}</Text>
            {combo.address ? <View style={styles.metaRow}><Ionicons accessible={false} name="location-outline" size={16} color={colors.secondaryText} /><Text style={styles.meta}>{combo.address}</Text></View> : null}
            {combo.rating > 0 ? <View style={styles.metaRow}><Ionicons accessible={false} name="star" size={14} color={colors.warning} /><Text style={styles.meta}>{combo.rating.toFixed(1)} điểm đánh giá</Text></View> : null}
            <AppButton compact variant="tonal" label="Xem cơ sở" icon="storefront-outline" onPress={() => navigation.navigate('VenueDetail', { venueId: combo.branchId })} style={styles.shopButton} />
          </View>
        </View>

        {similarCombos.length > 0 ? (
          <View style={styles.similar}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, styles.gutter]}>Gói khác tại cơ sở</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {similarCombos.map((item) => <ComboCard key={item.id} combo={item} onPress={() => navigation.push('ComboDetail', { comboId: item.id })} />)}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <View style={styles.flex}>
          <Text style={styles.bottomLabel}>Giá gói</Text>
          <Text style={styles.bottomPrice}>{formatCurrency(combo.price)}</Text>
        </View>
        <AppButton
          label="Đặt lịch gói này"
          style={styles.bookButton}
          onPress={() => navigation.navigate('Booking', {
            branchId: combo.branchId,
            shopName: combo.shopName,
            addresses: [combo.address].filter(Boolean),
            service: { id: combo.id, name: combo.title, duration: combo.duration, price: combo.price, originalPrice: combo.originalPrice },
            serviceIds: combo.serviceIds,
            comboId: combo.id,
          })}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  backRow: { paddingHorizontal: space.xs },
  scrollContent: { paddingBottom: space.xxl },
  cover: { minHeight: 150, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingBottom: space.xl },
  coverText: { ...type.secondaryStrong, color: colors.accent },
  back: { position: 'absolute', left: space.md },
  content: { paddingHorizontal: layout.gutter, paddingTop: space.lg, gap: space.sm },
  eyebrow: { ...type.overline, color: colors.accent },
  title: { ...type.h1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  price: { ...type.numeric, fontSize: 24, color: colors.primary },
  original: { ...type.secondary, textDecorationLine: 'line-through' },
  badge: { ...type.caption, fontWeight: '700', color: colors.accent, backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, overflow: 'hidden' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, marginTop: space.xs },
  meta: { ...type.secondary, flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, marginTop: space.md, gap: space.sm },
  sectionTitle: { ...type.h3 },
  gutter: { marginHorizontal: layout.gutter },
  stepRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  stepIndex: { width: 24, height: 24, borderRadius: 12, textAlign: 'center', ...type.caption, lineHeight: 24, fontWeight: '700', color: colors.secondary, backgroundColor: colors.secondarySoft, overflow: 'hidden' },
  stepText: { ...type.body, flex: 1 },
  termRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  termText: { ...type.body, flex: 1 },
  shopName: { ...type.bodyStrong },
  shopButton: { alignSelf: 'flex-start', marginTop: space.sm },
  similar: { marginTop: layout.sectionGap },
  rail: { paddingHorizontal: layout.gutter, gap: space.md, paddingTop: space.md },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: layout.gutter, paddingTop: space.md, paddingBottom: space.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider, ...elevation.raised },
  bottomLabel: { ...type.caption },
  bottomPrice: { ...type.price, fontSize: 18, color: colors.primary },
  bookButton: { minWidth: 168 },
});
