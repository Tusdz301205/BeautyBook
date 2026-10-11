import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useServiceSearch } from '../hooks/useServiceSearch';
import { useExpertSearch } from '../hooks/useExpertSearch';
import { useFavorites } from '../context/FavoritesContext';
import { useDistrict } from '../context/DistrictContext';
import { categoryArt } from '../components/categoryArt';
import { colors, layout, radius, space, type } from '../theme';
import { formatCurrency } from '../data/catalogModels';
import { AppButton, Chip, EmptyState, IconButton, Segmented, SheetModal } from '../ui';
import type { RootTabParamList } from '../navigation/RootTabs';
import type { ApiCategory, ApiSearchService } from '../types/api';
import { servicesApi } from '../api/services';

type Props = BottomTabScreenProps<RootTabParamList, 'TimKiem'>;
type Sort = 'rating' | 'price_asc' | 'price_desc' | undefined;

const SORTS: { label: string; value: Sort }[] = [
  { label: 'Phù hợp', value: undefined },
  { label: 'Giá thấp trước', value: 'price_asc' },
  { label: 'Giá cao trước', value: 'price_desc' },
  { label: 'Đánh giá cao', value: 'rating' },
];
const RATINGS: { label: string; value: number | undefined }[] = [{ label: 'Mọi đánh giá', value: undefined }, { label: 'Từ 4 sao', value: 4 }];
const PRICES: { label: string; value: number | undefined }[] = [{ label: 'Mọi mức giá', value: undefined }, { label: 'Tối đa 500.000 đ', value: 500000 }, { label: 'Tối đa 1.000.000 đ', value: 1000000 }];

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
  const filterCount = [sort, maxPrice, minRating, canonicalServiceId].filter((value) => value !== undefined).length;
  const categoryName = categories.find((item) => item.id === canonicalServiceId)?.name ?? 'Loại dịch vụ đã chọn';
  const active: { key: string; label: string; remove: () => void }[] = [
    ...(location ? [{ key: 'location', label: selectedDistrict, remove: () => selectDistrict('Tất cả khu vực') }] : []),
    ...(canonicalServiceId ? [{ key: 'category', label: categoryName, remove: () => setCanonicalServiceId(undefined) }] : []),
    ...(sort ? [{ key: 'sort', label: SORTS.find((item) => item.value === sort)?.label ?? 'Sắp xếp', remove: () => setSort(undefined) }] : []),
    ...(minRating ? [{ key: 'rating', label: 'Từ 4 sao', remove: () => setMinRating(undefined) }] : []),
    ...(maxPrice ? [{ key: 'price', label: `Tối đa ${formatCurrency(maxPrice)}`, remove: () => setMaxPrice(undefined) }] : []),
  ];

  const serviceCard = ({ item }: { item: ApiSearchService }) => {
    const illustration = categoryArt(item.displayName) || categoryArt(item.categoryName || '');
    const price = Number(item.price);
    const saved = isFavorite(item.id);
    return (
      <View style={styles.result}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${item.displayName} tại ${item.branchName}, ${Number.isFinite(price) ? formatCurrency(price) : 'liên hệ cơ sở'}, ${item.durationMinutes} phút. Xem cơ sở`} onPress={() => openVenue(item.branchId, item.id)} style={({ pressed }) => [styles.resultMain, pressed && styles.pressed]}>
          <View style={styles.thumb}>
            {illustration ? <><Image source={illustration} style={styles.thumbImage} resizeMode="cover" accessibilityLabel={`Ảnh minh họa ${item.categoryName || item.displayName}`} /><Text style={styles.illustration}>Minh họa</Text></> : <Ionicons accessible={false} name="sparkles-outline" size={24} color={colors.primary} />}
          </View>
          <View style={styles.resultBody}>
            {item.categoryName ? <Text style={styles.category}>{item.categoryName}</Text> : null}
            <Text style={styles.resultName} numberOfLines={2}>{item.displayName}</Text>
            <Text style={styles.meta} numberOfLines={1}>{item.branchName} · {item.districtName || item.provinceName || 'Xem địa điểm'}</Text>
            <Text style={styles.price}>{Number.isFinite(price) && price > 0 ? formatCurrency(price) : 'Liên hệ cơ sở'}<Text style={styles.duration}>  ·  {item.durationMinutes} phút</Text></Text>
          </View>
        </Pressable>
        <IconButton icon={saved ? 'bookmark' : 'bookmark-outline'} label={saved ? `Bỏ lưu ${item.displayName}` : `Lưu ${item.displayName}`} selected={saved} color={colors.primary} onPress={() => void toggleFavorite(item.id)} style={styles.save} />
      </View>
    );
  };

  const header = (
    <View>
      <Text style={styles.count} accessibilityLiveRegion="polite">{showExperts ? `${experts.length} chuyên viên trong kết quả hiện tại` : isLoading ? 'Đang tìm dịch vụ…' : `${rows.length}${hasMore ? '+' : ''} dịch vụ phù hợp`}</Text>
      {showExperts ? <Text style={styles.hint}>Chuyên viên của tối đa 8 cơ sở đầu tiên trong kết quả.</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text accessibilityRole="header" style={styles.title}>Tìm kiếm</Text>
      <View style={styles.search}>
        <Ionicons accessible={false} name="search-outline" size={20} color={colors.secondaryText} />
        <TextInput accessibilityLabel="Tìm dịch vụ hoặc cơ sở" autoFocus={!route.params?.initialQuery && !route.params?.canonicalServiceId} placeholder="Dịch vụ hoặc cơ sở" placeholderTextColor={colors.disabledText} style={styles.input} value={query} onChangeText={(value) => { setQuery(value); setCanonicalServiceId(undefined); }} returnKeyType="search" />
        {query ? <IconButton icon="close-circle" label="Xóa từ khóa" color={colors.secondaryText} onPress={() => { setQuery(''); setCanonicalServiceId(undefined); }} /> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
        <Chip icon="location-outline" label={location ? selectedDistrict : 'Khu vực'} selected={Boolean(location)} accessibilityLabel={`Khu vực: ${selectedDistrict}. Đổi khu vực`} onPress={openPicker} />
        <Chip icon="options-outline" label={filterCount ? `Bộ lọc · ${filterCount}` : 'Bộ lọc & sắp xếp'} selected={filterCount > 0} onPress={() => setFilterOpen(true)} />
        {active.filter((item) => item.key !== 'location').map((item) => <Chip key={item.key} label={item.label} selected onRemove={item.remove} onPress={() => setFilterOpen(true)} />)}
        {active.length || query ? <Chip label="Xóa tất cả" onPress={clear} /> : null}
      </ScrollView>
      <Segmented style={styles.segment} value={showExperts ? 'experts' : 'services'} onChange={(key) => setShowExperts(key === 'experts')} options={[{ key: 'services', label: 'Dịch vụ' }, { key: 'experts', label: 'Chuyên viên' }]} />

      {showExperts ? (
        <FlatList
          data={experts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.fullName}, ${item.professionalTitle || item.position || 'Chuyên viên'} tại ${item.venue.name}. Xem cơ sở`} onPress={() => openVenue(item.venue.id)} style={({ pressed }) => [styles.expert, pressed && styles.pressed]}>
              <View style={styles.avatar}>{item.avatarUrl ? <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} accessibilityLabel={`Ảnh chuyên viên ${item.fullName}`} /> : <Ionicons accessible={false} name="person-outline" size={24} color={colors.primary} />}</View>
              <View style={styles.flex}>
                <Text style={styles.resultName}>{item.fullName}</Text>
                <Text style={styles.meta}>{item.professionalTitle || item.position || 'Chuyên viên'}</Text>
                {item.specialties?.length ? <Text style={styles.meta}>{item.specialties.join(' · ')}</Text> : null}
                <Text style={styles.expertVenue}>{item.venue.name}</Text>
              </View>
              <Ionicons accessible={false} name="chevron-forward" size={18} color={colors.secondaryText} />
            </Pressable>
          )}
          ListEmptyComponent={expertsLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : <EmptyState icon={expertError ? 'cloud-offline-outline' : 'people-outline'} title={expertError ? 'Không tải được chuyên viên' : 'Chưa có chuyên viên phù hợp'} message={expertError || 'Thử tìm dịch vụ hoặc khu vực khác.'} />}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={header}
          renderItem={serviceCard}
          onEndReached={() => { if (hasMore && !isLoadingMore) void loadMore(); }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isLoadingMore ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : error && rows.length ? <AppButton variant="outline" label="Thử tải lại" onPress={reload} /> : null}
          ListEmptyComponent={isLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : error
            ? <EmptyState icon="cloud-offline-outline" title="Chưa thể tải kết quả" message={error} actionLabel="Thử lại" onAction={reload} />
            : <EmptyState icon="search-outline" title="Chưa thấy dịch vụ phù hợp" message="Thử từ khóa khác hoặc mở rộng khu vực." actionLabel={active.length || query ? 'Xóa bộ lọc' : undefined} onAction={clear} />}
        />
      )}

      <SheetModal visible={filterOpen} title="Bộ lọc & sắp xếp" onClose={() => setFilterOpen(false)} footer={<AppButton label="Xem kết quả" onPress={() => setFilterOpen(false)} />}>
        <FilterGroup title="Sắp xếp">{SORTS.map((option) => <Chip key={option.label} role="radio" label={option.label} selected={sort === option.value} onPress={() => setSort(option.value)} />)}</FilterGroup>
        <FilterGroup title="Loại dịch vụ">{[{ id: '', name: 'Tất cả dịch vụ' }, ...categories].map((category) => <Chip key={category.id || 'all'} role="radio" label={category.name} selected={(canonicalServiceId || '') === category.id} onPress={() => setCanonicalServiceId(category.id || undefined)} />)}</FilterGroup>
        <FilterGroup title="Đánh giá cơ sở">{RATINGS.map((option) => <Chip key={option.label} role="radio" label={option.label} selected={minRating === option.value} onPress={() => setMinRating(option.value)} />)}</FilterGroup>
        <FilterGroup title="Giá tối đa">{PRICES.map((option) => <Chip key={option.label} role="radio" label={option.label} selected={maxPrice === option.value} onPress={() => setMaxPrice(option.value)} />)}</FilterGroup>
      </SheetModal>
    </SafeAreaView>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.group}><Text accessibilityRole="header" style={styles.groupTitle}>{title}</Text><View accessibilityRole="radiogroup" style={styles.groupChips}>{children}</View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  pressed: { backgroundColor: colors.surfacePressed },
  title: { ...type.h1, marginHorizontal: layout.gutter, marginTop: space.md, marginBottom: space.md },
  search: { marginHorizontal: layout.gutter, minHeight: layout.inputMinHeight, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingLeft: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: { flex: 1, minWidth: 0, minHeight: 48, ...type.body, color: colors.heading },
  chipScroll: { flexGrow: 0 },
  chips: { paddingHorizontal: layout.gutter, gap: space.sm, paddingVertical: space.md },
  segment: { marginHorizontal: layout.gutter },
  list: { paddingHorizontal: layout.gutter, paddingBottom: space.huge, flexGrow: 1 },
  count: { ...type.secondaryStrong, marginTop: space.lg, marginBottom: space.md },
  hint: { ...type.caption, marginTop: -space.sm, marginBottom: space.md },
  loader: { marginVertical: space.xxl },
  result: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: space.md, overflow: 'hidden' },
  resultMain: { flex: 1, minWidth: 0, flexDirection: 'row', gap: space.md, padding: space.md },
  thumb: { width: 84, height: 84, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  thumbImage: { width: '100%', height: '100%' },
  illustration: { position: 'absolute', left: 0, right: 0, bottom: 0, ...type.caption, color: colors.white, backgroundColor: 'rgba(42,31,38,0.72)', textAlign: 'center' },
  resultBody: { flex: 1, minWidth: 0, gap: 2 },
  category: { ...type.caption, color: colors.primary, fontWeight: '600' },
  resultName: { ...type.h3 },
  meta: { ...type.secondary },
  price: { ...type.price, marginTop: space.xs },
  duration: { ...type.secondary, fontWeight: '400' },
  save: { marginRight: space.xs },
  expert: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, marginBottom: space.md },
  avatar: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  expertVenue: { ...type.secondaryStrong, color: colors.primary, marginTop: space.xs },
  group: { marginBottom: space.xl },
  groupTitle: { ...type.h3, marginBottom: space.sm },
  groupChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
