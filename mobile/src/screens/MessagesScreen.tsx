import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AccountStackParamList } from '../navigation/AccountStack';
import { colors } from '../constants/colors';
import { notificationsApi, type ApiNotification } from '../api/notifications';

type Props = NativeStackScreenProps<AccountStackParamList, 'Messages'>;

export default function MessagesScreen({ navigation }: Props) {
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage = 1) => {
    setLoading(true);
    try {
      const result = await notificationsApi.list(nextPage);
      setItems((current) => nextPage === 1 ? result.data : [...current, ...result.data]);
      setPage(nextPage);
      setHasMore(nextPage < result.pagination.totalPages);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được thông báo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (item: ApiNotification) => {
    if (item.isRead) return;
    try {
      await notificationsApi.markRead(item.id);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry));
    } catch (reason) {
      Alert.alert('Không thể đánh dấu đã đọc', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông báo</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => void notificationsApi.markAllRead().then(() => load()).catch((reason) => Alert.alert('Không thể cập nhật', reason instanceof Error ? reason.message : 'Vui lòng thử lại.'))}>
          <Ionicons name="checkmark-done-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </SafeAreaView>

      {loading && items.length === 0 ? <View style={styles.emptyState}><ActivityIndicator color={colors.primary} /></View> :
        error && items.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptySubtitle}>{error}</Text><TouchableOpacity onPress={() => void load()}><Text style={{ color: colors.primary }}>Thử lại</Text></TouchableOpacity></View> :
        items.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>Chưa có thông báo</Text></View> :
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {items.map((item) => <TouchableOpacity key={item.id} onPress={() => void markRead(item)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, backgroundColor: item.isRead ? colors.card : colors.primaryLight, gap: 5 }}>
            <Text style={{ fontWeight: '700', color: colors.textDark }}>{item.title}</Text>
            {!!item.body && <Text style={{ color: colors.textBody }}>{item.body}</Text>}
            <Text style={{ color: colors.textGray, fontSize: 12 }}>{new Date(item.createdAt).toLocaleString('vi-VN')}</Text>
          </TouchableOpacity>)}
          {hasMore && <TouchableOpacity disabled={loading} onPress={() => void load(page + 1)} style={{ padding: 12, alignItems: 'center' }}><Text style={{ color: colors.primary }}>{loading ? 'Đang tải...' : 'Xem thêm'}</Text></TouchableOpacity>}
          {!!error && <Text style={styles.emptySubtitle}>{error}</Text>}
        </ScrollView>}
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
});
