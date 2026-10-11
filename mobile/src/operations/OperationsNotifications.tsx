import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationRequests } from '../hooks/useNotificationRequests';
import type { ApiNotification } from '../api/notifications';
import { colors, layout, radius, space, type } from '../theme';
import { operationNotificationTarget } from '../utils/operationNotifications';
import { useOperations } from './OperationsContext';
import { OperationButton, OperationPage, OperationState } from './OperationPrimitives';

export default function OperationsNotifications({ onOpenBooking, onOpenImpact }: { onOpenBooking?: (id: string) => void; onOpenImpact?: (id: string) => void }) {
  const { contextKey, revision, refresh, mode } = useOperations();
  const { data, page, busy, error: loadError, requests } = useNotificationRequests(false, contextKey, revision);
  const [markError, setMarkError] = useState<{ requests: typeof requests; message: string } | null>(null);
  const error = loadError ? 'Chưa tải được thông báo. Vui lòng kiểm tra kết nối và thử lại.' : markError?.requests === requests ? markError.message : null;
  const open = (notification: ApiNotification) => requests.markRead(notification, () => {
    setMarkError(null);
    refresh();
    const target = operationNotificationTarget(notification, mode);
    if (target?.kind === 'BOOKING' && onOpenBooking) onOpenBooking(target.id);
    else if (target?.kind === 'IMPACT' && onOpenImpact) onOpenImpact(target.id);
    else Alert.alert(notification.title, notification.body || 'Thông báo này không có thao tác trên mobile.');
  }, () => setMarkError({ requests, message: 'Chưa đánh dấu được thông báo. Bạn có thể thử lại.' }));

  return <OperationPage title="Thông báo" subtitle={data ? `${data.unreadCount} chưa đọc · theo tài khoản, không lọc theo chi nhánh` : 'Theo tài khoản, không lọc theo chi nhánh'}>
    <FlatList data={data?.data ?? []} keyExtractor={item => item.id} refreshing={busy} onRefresh={refresh} contentContainerStyle={styles.list}
      ListHeaderComponent={error ? <OperationState tone="error" message={error} onRetry={refresh} /> : null}
      ListEmptyComponent={<OperationState message={busy ? 'Đang tải thông báo…' : error ? 'Chưa có dữ liệu.' : 'Chưa có thông báo.'} />}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.isRead ? '' : 'Chưa đọc. '}${item.title}. ${item.body ?? ''}`} style={({ pressed }) => [styles.card, !item.isRead && styles.unread, pressed && { backgroundColor: colors.surfacePressed }]} onPress={() => void open(item)}>
        <View style={[styles.dot, item.isRead && styles.dotRead]} />
        <View style={styles.flex}>
          <Text style={[styles.title, !item.isRead && styles.titleUnread]}>{item.title}</Text>
          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
          <Text style={styles.time}>{new Date(item.createdAt).toLocaleString('vi-VN')}</Text>
        </View>
        <Ionicons accessible={false} name="chevron-forward" size={18} color={colors.secondaryText} />
      </Pressable>}
      ListFooterComponent={<View style={styles.footer}>{page > 1 && <OperationButton label="Trang trước" secondary disabled={busy} onPress={() => requests.move(-1)} />}{data && page < data.pagination.totalPages && <OperationButton label="Trang tiếp" secondary disabled={busy} onPress={() => requests.move(1)} />}</View>} />
  </OperationPage>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  list: { paddingHorizontal: layout.gutter, paddingBottom: space.xxxl, paddingTop: space.sm, flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, marginBottom: space.sm, borderWidth: 1, borderColor: colors.border },
  unread: { borderColor: '#E3C3D2', backgroundColor: colors.primarySoft },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 7 },
  dotRead: { backgroundColor: 'transparent' },
  title: { ...type.bodyStrong, fontWeight: '500' },
  titleUnread: { fontWeight: '700' },
  body: { ...type.secondary, color: colors.body, marginTop: 2 },
  time: { ...type.caption, marginTop: space.xs },
  footer: { gap: space.sm, paddingVertical: space.lg },
});
