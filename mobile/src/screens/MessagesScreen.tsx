import React from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AccountStackParamList } from '../navigation/AccountStack';
import { colors, layout, radius, space, type } from '../theme';
import { useNotificationRequests } from '../hooks/useNotificationRequests';
import { AppButton, EmptyState, IconButton, LoadingState, Notice, ScreenHeader } from '../ui';

type Props = NativeStackScreenProps<AccountStackParamList, 'Messages'>;

/** Account notifications (not salon chat). Tapping marks read; no actionUrl is executed. */
export default function MessagesScreen({ navigation }: Props) {
  const { data, page, busy: loading, markingAll, error: loadError, requests } = useNotificationRequests(true);
  const items = data?.data ?? [];
  const hasMore = page < (data?.pagination.totalPages ?? 0);
  const error = loadError ? (loadError instanceof Error ? loadError.message : 'Không tải được thông báo') : null;
  const markReadError = (reason: unknown) => Alert.alert('Không thể đánh dấu đã đọc', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
  const markAllError = (reason: unknown) => Alert.alert('Không thể cập nhật', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');

  const unread = data?.unreadCount ?? 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Thông báo" subtitle={unread ? `${unread} chưa đọc` : undefined} onBack={() => navigation.goBack()} right={<IconButton icon="checkmark-done-outline" label="Đánh dấu tất cả đã đọc" color={colors.primary} disabled={!unread || markingAll || loading} onPress={() => void requests.markAllRead(markAllError)} />} />
      {loading && items.length === 0 ? <LoadingState message="Đang tải thông báo…" /> : error && items.length === 0 ? (
        <EmptyState icon="cloud-offline-outline" title="Không tải được thông báo" message={error} actionLabel="Thử lại" onAction={() => void requests.reload()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading && page === 1}
          onRefresh={() => void requests.reload()}
          ListHeaderComponent={error ? <Notice tone="warning" message={error} style={styles.notice} /> : null}
          ListEmptyComponent={<EmptyState icon="notifications-outline" title="Chưa có thông báo" message="Cập nhật về lịch hẹn và tài khoản sẽ xuất hiện ở đây." />}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.isRead ? '' : 'Chưa đọc. '}${item.title}. ${item.body ?? ''}`}
              accessibilityHint={item.isRead ? undefined : 'Đánh dấu đã đọc'}
              onPress={() => void requests.markRead(item, undefined, markReadError)}
              style={({ pressed }) => [styles.card, !item.isRead && styles.unread, pressed && { backgroundColor: colors.surfacePressed }]}
            >
              <View style={[styles.dot, item.isRead && styles.dotRead]} />
              <View style={styles.flex}>
                <Text style={[styles.title, !item.isRead && styles.titleUnread]}>{item.title}</Text>
                {!!item.body && <Text style={styles.body}>{item.body}</Text>}
                <Text style={styles.time}>{new Date(item.createdAt).toLocaleString('vi-VN')}</Text>
              </View>
            </Pressable>
          )}
          ListFooterComponent={hasMore ? <AppButton variant="ghost" label={loading ? 'Đang tải…' : 'Xem thêm'} loading={loading} disabled={loading || markingAll} onPress={() => requests.move(1)} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  list: { paddingHorizontal: layout.gutter, paddingBottom: space.xxxl, paddingTop: space.sm, flexGrow: 1 },
  notice: { marginBottom: space.md },
  card: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, marginBottom: space.sm },
  unread: { borderColor: '#E3C3D2', backgroundColor: colors.primarySoft },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 7 },
  dotRead: { backgroundColor: 'transparent' },
  title: { ...type.bodyStrong, fontWeight: '500' },
  titleUnread: { fontWeight: '700' },
  body: { ...type.secondary, color: colors.body, marginTop: 2 },
  time: { ...type.caption, marginTop: space.xs },
});
