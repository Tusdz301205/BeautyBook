import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useServiceSearch } from '../hooks/useServiceSearch';
import { useExpertSearch } from '../hooks/useExpertSearch';
import { useFavorites } from '../context/FavoritesContext';
import { useDistrict } from '../context/DistrictContext';
import { categoryArt } from '../components/categoryArt';
import { colors } from '../constants/colors';
import { formatCurrency } from '../data/catalogModels';
import type { RootTabParamList } from '../navigation/RootTabs';
import type { ApiSearchService } from '../types/api';
import { servicesApi } from '../api/services';
import type { ApiCategory } from '../types/api';

type Props = BottomTabScreenProps<RootTabParamList, 'TimKiem'>;
type Sort = 'rating' | 'price_asc' | 'price_desc' | undefined;

export default function SearchScreen({ navigation, route }: Props) {
  const [query, setQuery] = useState('');
  const [canonicalServiceId, setCanonicalServiceId] = useState<string | undefined>();
  const [sort, setSort] = useState<Sort>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [minRating, setMinRating] = useState<number | undefined>();
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  useEffect(() => { let active = true; servicesApi.categories().then(rows => { if (active) setCategories(rows); }).catch(() => {}); return () => { active = false; }; }, []);
  const [filterOpen, setFilterOpen] = useState(false);
  const [showExperts, setShowExperts] = useState(false);
  const { selectedDistrict, openPicker, selectDistrict } = useDistrict();
  const { isFavorite, toggleFavorite } = useFavorites();
  useEffect(() => {
    if (!route.params?.initialQuery && !route.params?.canonicalServiceId) return;
    setQuery(route.params.initialQuery || '');
    setCanonicalServiceId(route.params.canonicalServiceId);
    navigation.setParams({ initialQuery: undefined, canonicalServiceId: undefined });
  }, [navigation, route.params?.initialQuery, route.params?.canonicalServiceId]);
  const location = selectedDistrict === 'Tất cả khu vực' ? undefined : selectedDistrict;
  const filters = { query, location, canonicalServiceId, sort, maxPrice, minRating };
  const { rows, venues, isLoading, error, hasMore, isLoadingMore, loadMore, reload } = useServiceSearch(filters);
  const { experts, isLoading: expertsLoading, error: expertError } = useExpertSearch(venues.slice(0, 8), showExperts);
  const openVenue = (branchId: string, serviceId?: string) => navigation.navigate('DiaDiem', { screen: 'VenueDetail', params: { venueId: branchId, serviceId } });
  const clear = () => { setQuery(''); setCanonicalServiceId(undefined); setSort(undefined); setMaxPrice(undefined); setMinRating(undefined); selectDistrict('Tất cả khu vực'); };

  const serviceCard = ({ item }: { item: ApiSearchService }) => {
    const illustration = categoryArt(item.displayName) || categoryArt(item.categoryName || '');
    const price = Number(item.price);
    return <View style={styles.result}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Xem ${item.displayName} tại ${item.branchName}`} onPress={() => openVenue(item.branchId, item.id)} style={styles.resultMain}>
        <View style={styles.imageWrap}>{illustration ? <><Image source={illustration} style={styles.image} resizeMode="cover" accessibilityLabel={`Ảnh minh họa ${item.categoryName || item.displayName}`} /><Text style={styles.imageTag}>MINH HỌA</Text></> : <View style={styles.noImage}><Ionicons name="sparkles-outline" size={25} color={colors.primary} /></View>}</View>
        <View style={styles.resultBody}><Text style={styles.category}>{item.categoryName || 'Dịch vụ'}</Text><Text style={styles.resultName}>{item.displayName}</Text><Text style={styles.meta}>{item.branchName} · {item.districtName || item.provinceName || 'Xem địa điểm'}</Text><Text style={styles.price}>{Number.isFinite(price) ? formatCurrency(price) : 'Liên hệ'} <Text style={styles.duration}>· {item.durationMinutes} phút</Text></Text></View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={isFavorite(item.id) ? `Bỏ lưu ${item.displayName}` : `Lưu ${item.displayName}`} accessibilityState={{ selected: isFavorite(item.id) }} onPress={() => void toggleFavorite(item.id)} style={styles.save}><Ionicons name={isFavorite(item.id) ? 'bookmark' : 'bookmark-outline'} size={22} color={colors.primary} /></Pressable>
    </View>;
  };

  return <SafeAreaView style={styles.screen} edges={['top']}>
    <Text style={styles.title}>Tìm kiếm</Text>
    <View style={styles.search}><Ionicons name="search-outline" size={20} color={colors.textGray} /><TextInput accessibilityLabel="Tìm dịch vụ hoặc cơ sở" autoFocus placeholder="Dịch vụ hoặc cơ sở" placeholderTextColor={colors.textGray} style={styles.input} value={query} onChangeText={(value) => { setQuery(value); setCanonicalServiceId(undefined); }} returnKeyType="search" />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" onPress={() => { setQuery(''); setCanonicalServiceId(undefined); }} style={styles.clear}><Ionicons name="close-circle" size={21} color={colors.textGray} /></Pressable> : null}</View>
    <View style={styles.controls}><Pressable accessibilityRole="button" onPress={openPicker} style={styles.pill}><Ionicons name="location-outline" size={16} color={colors.primary} /><Text style={styles.pillText} numberOfLines={1}>{selectedDistrict}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setFilterOpen(true)} style={styles.pill}><Ionicons name="options-outline" size={17} color={colors.primary} /><Text style={styles.pillText}>Lọc & sắp xếp</Text>{sort || maxPrice || minRating || canonicalServiceId ? <View style={styles.dot} /> : null}</Pressable></View>
    {sort || maxPrice || minRating || canonicalServiceId || query || location ? <Pressable accessibilityRole="button" onPress={clear} style={styles.clearAll}><Text style={styles.clearAllText}>Xóa tìm kiếm và bộ lọc</Text></Pressable> : null}
    <View style={styles.segment}><Pressable accessibilityRole="tab" accessibilityState={{ selected: !showExperts }} onPress={() => setShowExperts(false)} style={[styles.segmentItem, !showExperts && styles.segmentActive]}><Text style={[styles.segmentText, !showExperts && styles.segmentTextActive]}>Dịch vụ</Text></Pressable><Pressable accessibilityRole="tab" accessibilityState={{ selected: showExperts }} onPress={() => setShowExperts(true)} style={[styles.segmentItem, showExperts && styles.segmentActive]}><Text style={[styles.segmentText, showExperts && styles.segmentTextActive]}>Chuyên viên</Text></Pressable></View>
    {showExperts ? <FlatList data={experts} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListHeaderComponent={<Text style={styles.count}>{experts.length} chuyên viên trong kết quả hiện tại</Text>} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Xem cơ sở của ${item.fullName}`} onPress={() => openVenue(item.venue.id)} style={styles.expert}><View style={styles.avatar}>{item.avatarUrl ? <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} accessibilityLabel={`Ảnh chuyên viên ${item.fullName}`} /> : <Ionicons name="person-outline" size={26} color={colors.primary} />}</View><View style={styles.flex}><Text style={styles.expertName}>{item.fullName}</Text><Text style={styles.meta}>{item.professionalTitle || item.position || 'Chuyên viên'}</Text>{item.specialties?.length ? <Text style={styles.meta}>{item.specialties.join(' · ')}</Text> : null}<Text style={styles.expertVenue}>{item.venue.name}</Text></View></Pressable>} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>{expertsLoading ? 'Đang tìm chuyên viên...' : expertError ? 'Không tải được chuyên viên' : 'Chưa có chuyên viên phù hợp'}</Text><Text style={styles.meta}>{expertError || 'Thử tìm dịch vụ hoặc khu vực khác.'}</Text></View>} /> : <FlatList data={rows} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" ListHeaderComponent={<Text style={styles.count}>{isLoading ? 'Đang tìm dịch vụ...' : `${rows.length} dịch vụ trong kết quả`}</Text>} renderItem={serviceCard} onEndReached={() => { if (hasMore && !isLoadingMore) void loadMore(); }} onEndReachedThreshold={0.5} ListFooterComponent={isLoadingMore ? <ActivityIndicator color={colors.primary} /> : null} ListEmptyComponent={<View style={styles.empty}><Ionicons name={error ? 'cloud-offline-outline' : 'search-outline'} size={31} color={colors.primary} /><Text style={styles.emptyTitle}>{isLoading ? 'Đang tìm...' : error ? 'Chưa thể tải kết quả' : 'Chưa thấy dịch vụ phù hợp'}</Text><Text style={styles.meta}>{error || 'Thử tìm tên khác hoặc chọn khu vực rộng hơn.'}</Text>{error ? <Pressable accessibilityRole="button" onPress={reload} style={styles.retry}><Text style={styles.retryText}>Thử lại</Text></Pressable> : <Pressable accessibilityRole="button" onPress={clear} style={styles.retry}><Text style={styles.retryText}>Xóa bộ lọc</Text></Pressable>}</View>} />}
    <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}><View style={styles.shade}><SafeAreaView style={styles.sheet} edges={['bottom']}><View style={styles.sheetHead}><Text style={styles.sheetTitle}>Lọc & sắp xếp</Text><Pressable accessibilityRole="button" accessibilityLabel="Đóng bộ lọc" onPress={() => setFilterOpen(false)} style={styles.close}><Ionicons name="close" size={23} color={colors.textDark} /></Pressable></View><ScrollView contentContainerStyle={styles.sheetBody}><Text style={styles.filterTitle}>Sắp xếp</Text>{([{ label: 'Phù hợp', value: undefined }, { label: 'Giá thấp trước', value: 'price_asc' }, { label: 'Giá cao trước', value: 'price_desc' }, { label: 'Đánh giá cao', value: 'rating' }] as const).map((option) => <Pressable key={option.label} accessibilityRole="radio" accessibilityState={{ selected: sort === option.value }} onPress={() => setSort(option.value)} style={styles.option}><Text style={styles.optionText}>{option.label}</Text><Ionicons name={sort === option.value ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.primary} /></Pressable>)}<Text style={styles.filterTitle}>Loại dịch vụ</Text>{[{ id: '', name: 'Tất cả dịch vụ' }, ...categories].map(category => <Pressable key={category.id} accessibilityRole="radio" accessibilityState={{ selected: (canonicalServiceId || '') === category.id }} onPress={() => setCanonicalServiceId(category.id || undefined)} style={styles.option}><Text style={styles.optionText}>{category.name}</Text><Ionicons name={(canonicalServiceId || '') === category.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.primary} /></Pressable>)}<Text style={styles.filterTitle}>Đánh giá cơ sở</Text>{[{ label: 'Mọi đánh giá', value: undefined }, { label: 'Từ 4 sao', value: 4 }].map(option => <Pressable key={option.label} accessibilityRole="radio" accessibilityState={{ selected: minRating === option.value }} onPress={() => setMinRating(option.value)} style={styles.option}><Text style={styles.optionText}>{option.label}</Text><Ionicons name={minRating === option.value ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.primary} /></Pressable>)}<Text style={styles.filterTitle}>Giá tối đa</Text>{([{ label: 'Mọi mức giá', value: undefined }, { label: 'Tối đa 500.000₫', value: 500000 }, { label: 'Tối đa 1.000.000₫', value: 1000000 }] as const).map((option) => <Pressable key={option.label} accessibilityRole="radio" accessibilityState={{ selected: maxPrice === option.value }} onPress={() => setMaxPrice(option.value)} style={styles.option}><Text style={styles.optionText}>{option.label}</Text><Ionicons name={maxPrice === option.value ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.primary} /></Pressable>)}</ScrollView><Pressable accessibilityRole="button" onPress={() => setFilterOpen(false)} style={styles.apply}><Text style={styles.applyText}>Xem kết quả</Text></Pressable></SafeAreaView></View></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { marginHorizontal: 20, marginTop: 13, marginBottom: 15, color: colors.textDark, fontSize: 25, fontWeight: '700' },
  search: { marginHorizontal: 20, minHeight: 54, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  input: { flex: 1, minWidth: 0, height: 50, fontSize: 16, color: colors.textDark },
  clear: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  controls: { marginHorizontal: 20, marginTop: 13, flexDirection: 'row', gap: 8 },
  pill: { maxWidth: '52%', minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillText: { flexShrink: 1, color: colors.primary, fontSize: 13, fontWeight: '600' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  clearAll: { marginHorizontal: 20, alignSelf: 'flex-start', minHeight: 42, justifyContent: 'center' },
  clearAllText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  segment: { marginHorizontal: 20, marginTop: 13, padding: 4, borderRadius: 14, backgroundColor: '#F0E7E5', flexDirection: 'row' },
  segmentItem: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  segmentActive: { backgroundColor: colors.card },
  segmentText: { color: colors.textGray, fontWeight: '600' },
  segmentTextActive: { color: colors.primary },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  count: { color: colors.textGray, fontSize: 13, marginVertical: 15 },
  result: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, marginBottom: 13, overflow: 'hidden' },
  resultMain: { minWidth: 0 },
  imageWrap: { width: '100%', height: 145, overflow: 'hidden', backgroundColor: '#EFE5E2' },
  image: { width: '100%', height: '100%' },
  imageTag: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#422737AA', color: '#FFF', fontSize: 9, textAlign: 'center', paddingVertical: 3 },
  noImage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  resultBody: { minWidth: 0, padding: 14 },
  category: { color: colors.primary, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  resultName: { color: colors.textDark, fontSize: 15, lineHeight: 20, fontWeight: '700', marginTop: 5 },
  meta: { color: colors.textGray, fontSize: 12, lineHeight: 17, marginTop: 4 },
  price: { color: colors.textDark, fontSize: 15, fontWeight: '700', marginTop: 7 },
  duration: { color: colors.textGray, fontSize: 12, fontWeight: '400' },
  save: { position: 'absolute', top: 9, right: 9, width: 48, height: 48, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  empty: { marginTop: 60, alignItems: 'center', paddingHorizontal: 20, gap: 9 },
  emptyTitle: { color: colors.textDark, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  retry: { minHeight: 48, backgroundColor: colors.primary, paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center', marginTop: 10 },
  retryText: { color: '#FFF', fontWeight: '700' },
  expert: { backgroundColor: colors.card, padding: 15, borderRadius: 17, marginBottom: 10, flexDirection: 'row', gap: 13, alignItems: 'center' },
  avatar: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#F2E4E7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  flex: { flex: 1, minWidth: 0 },
  expertName: { color: colors.textDark, fontSize: 16, fontWeight: '700' },
  expertVenue: { color: colors.primary, fontSize: 13, marginTop: 6 },
  shade: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#30252C77' },
  sheet: { maxHeight: '85%', backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 12 },
  sheetHead: { minHeight: 60, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: colors.textDark, fontSize: 20, fontWeight: '700' },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  sheetBody: { paddingHorizontal: 20, paddingBottom: 15 },
  filterTitle: { color: colors.textDark, fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  option: { minHeight: 53, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { color: colors.textBody, fontSize: 15 },
  apply: { minHeight: 54, backgroundColor: colors.primary, borderRadius: 14, marginHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#FFF', fontWeight: '700' },
});
