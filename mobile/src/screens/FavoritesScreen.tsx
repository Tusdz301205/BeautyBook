import React, { useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { AccountStackParamList } from '../navigation/AccountStack';
import { RootTabParamList } from '../navigation/RootTabs';
import { colors } from '../constants/colors';
import { useFavorites } from '../context/FavoritesContext';
import { formatCurrency } from '../data/catalogModels';

type Props = CompositeScreenProps<
  NativeStackScreenProps<AccountStackParamList, 'Favorites'>,
  BottomTabScreenProps<RootTabParamList>
>;

export default function FavoritesScreen({ navigation }: Props) {
  const { savedItems, toggleFavorite, isLoading, error, reload } = useFavorites();

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mục yêu thích</Text>
        <View style={styles.backButton} />
      </SafeAreaView>

      {isLoading && savedItems.length === 0 ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptySubtitle}>Đang tải mục yêu thích...</Text>
        </View>
      ) : error && savedItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Không tải được mục yêu thích</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => void reload()}>
            <Text style={styles.emptyButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : savedItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💗</Text>
          <Text style={styles.emptyTitle}>Không có mục yêu thích</Text>
          <Text style={styles.emptySubtitle}>Các dịch vụ bạn lưu trên web và mobile sẽ xuất hiện ở đây.</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('TimKiem')}
          >
            <Text style={styles.emptyButtonText}>Bắt đầu tìm kiếm</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {savedItems.map((item) => {
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                activeOpacity={0.9}
                disabled={!item.offering}
                onPress={() => item.offering && navigation.navigate('DiaDiem', { screen: 'VenueDetail', params: { venueId: item.offering.branchId } })}
              >
                <TouchableOpacity
                  style={styles.favoriteButton}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Bỏ lưu ${item.offering?.name || 'dịch vụ'}`}
                  onPress={() => void toggleFavorite(item.branchServiceOfferingId)}
                >
                  <Ionicons name="bookmark" size={20} color={colors.primary} />
                </TouchableOpacity>
                <View style={styles.cardBody}>
                  <Text style={styles.eyebrow}>DỊCH VỤ ĐÃ LƯU</Text>
                  <Text style={styles.venueName}>{item.offering?.name || 'Dịch vụ không còn hiển thị'}</Text>
                  <Text style={styles.metaLine}>{item.offering?.branch.name || 'Cơ sở đã cập nhật'}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.price}>{item.offering ? formatCurrency(Number(item.offering.price)) : 'Chưa có giá'}</Text>
                    <Text style={[styles.availability, !item.available && styles.unavailable]}>{item.available ? 'Đang nhận lịch' : 'Tạm không khả dụng'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textDark,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textDark,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 14,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  cardBody: {
    padding: 18,
    paddingRight: 64,
    gap: 7,
  },
  eyebrow: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  venueName: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
    color: colors.textDark,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  availability: {
    fontSize: 12,
    color: '#286A53',
    fontWeight: '600',
  },
  unavailable: {
    color: colors.textGray,
  },
  metaLine: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textGray,
  },
});
