import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { AccountStackParamList } from '../navigation/AccountStack';
import { RootTabParamList } from '../navigation/RootTabs';
import { colors, layout, radius, space, type } from '../theme';
import { useFavorites } from '../context/FavoritesContext';
import { formatCurrency } from '../data/catalogModels';
import { EmptyState, IconButton, LoadingState, Notice, ScreenHeader, StatusPill } from '../ui';

type Props = CompositeScreenProps<
  NativeStackScreenProps<AccountStackParamList, 'Favorites'>,
  BottomTabScreenProps<RootTabParamList>
>;

/** Saved items are services (branch service offerings), not salons or combos. */
export default function FavoritesScreen({ navigation }: Props) {
  const { savedItems, toggleFavorite, isLoading, error, reload } = useFavorites();

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Dịch vụ đã lưu" onBack={() => navigation.goBack()} />
      {isLoading && savedItems.length === 0 ? <LoadingState message="Đang tải dịch vụ đã lưu…" /> : error && savedItems.length === 0 ? (
        <EmptyState icon="cloud-offline-outline" title="Không tải được dịch vụ đã lưu" message={error} actionLabel="Thử lại" onAction={() => void reload()} />
      ) : (
        <FlatList
          data={savedItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={error ? <Notice tone="warning" message={`Danh sách có thể chưa mới nhất: ${error}`} style={styles.notice} /> : null}
          ListEmptyComponent={<EmptyState icon="heart-outline" title="Chưa có dịch vụ đã lưu" message="Chạm biểu tượng trái tim ở một dịch vụ để lưu lại." actionLabel="Tìm dịch vụ" onAction={() => navigation.navigate('TimKiem')} />}
          renderItem={({ item }) => {
            const name = item.offering?.name || 'Dịch vụ không còn hiển thị';
            return (
              <View style={styles.card}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${name}${item.offering ? `, ${item.offering.branch.name}` : ''}. ${item.available ? 'Xem cơ sở' : 'Tạm không khả dụng'}`}
                  disabled={!item.offering}
                  onPress={() => item.offering && navigation.navigate('DiaDiem', { screen: 'VenueDetail', params: { venueId: item.offering.branchId, serviceId: item.offering.id } })}
                  style={({ pressed }) => [styles.cardMain, pressed && { backgroundColor: colors.surfacePressed }]}
                >
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.meta}>{item.offering?.branch.name || 'Cơ sở đã cập nhật'}</Text>
                  <View style={styles.footer}>
                    <Text style={styles.price}>{item.offering ? formatCurrency(Number(item.offering.price)) : 'Chưa có giá'}</Text>
                    <StatusPill label={item.available ? 'Đang nhận lịch' : 'Tạm không khả dụng'} tone={item.available ? 'success' : 'neutral'} icon={item.available ? 'checkmark-circle-outline' : 'pause-circle-outline'} />
                  </View>
                </Pressable>
                <IconButton icon="heart" label={`Bỏ lưu ${name}`} color={colors.primary} onPress={() => void toggleFavorite(item.branchServiceOfferingId)} style={styles.remove} />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: layout.gutter, paddingBottom: space.xxxl, flexGrow: 1 },
  hint: { ...type.secondary, marginVertical: space.md },
  notice: { marginVertical: space.md },
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: space.md, overflow: 'hidden' },
  cardMain: { flex: 1, minWidth: 0, padding: space.lg, gap: space.xs },
  name: { ...type.h3 },
  meta: { ...type.secondary },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  price: { ...type.price, color: colors.primary },
  remove: { margin: space.xs },
});
