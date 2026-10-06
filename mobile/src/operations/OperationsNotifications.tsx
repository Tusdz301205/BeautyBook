import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { notificationsApi, type ApiNotification, type ApiNotificationsPage } from '../api/notifications';
import { colors } from '../constants/colors';
import { operationNotificationTarget } from '../utils/operationNotifications';
import { useOperations } from './OperationsContext';
import { OperationButton, OperationPage, OperationState } from './OperationPrimitives';

export default function OperationsNotifications({ onOpenBooking, onOpenImpact }: { onOpenBooking?: (id: string) => void; onOpenImpact?: (id: string) => void }) {
  const { contextKey, revision, refresh, mode } = useOperations();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiNotificationsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fence = useRef(0);
  const identity = useRef(contextKey); identity.current = contextKey;
  useEffect(() => { setData(null); setPage(1); setError(null); }, [contextKey]);
  useEffect(() => {
    const request = ++fence.current; setBusy(true);
    void notificationsApi.list(page).then(result => {
      if (fence.current === request && identity.current === contextKey) { setData(result); setError(null); }
    }).catch(reason => {
      if (fence.current !== request || identity.current !== contextKey) return;
      if (reason instanceof ApiError && [401, 403].includes(reason.status)) setData(null);
      setError('Chưa tải được thông báo. Vui lòng kiểm tra kết nối và thử lại.');
    }).finally(() => { if (fence.current === request) setBusy(false); });
    return () => { fence.current++; };
  }, [contextKey, revision, page]);
  const open = async (notification: ApiNotification) => {
    const origin = contextKey;
    try {
      if (!notification.isRead) await notificationsApi.markRead(notification.id);
      if (identity.current !== origin) return;
      refresh();
      const target = operationNotificationTarget(notification, mode);
      if (target?.kind === 'BOOKING' && onOpenBooking) onOpenBooking(target.id);
      else if (target?.kind === 'IMPACT' && onOpenImpact) onOpenImpact(target.id);
      else Alert.alert(notification.title, notification.body || 'Thông báo này không có thao tác trên mobile.');
    } catch { if (identity.current === origin) setError('Chưa đánh dấu được thông báo. Bạn có thể thử lại.'); }
  };
  return <OperationPage title="Thông báo"><Text style={styles.note}>Thông báo theo tài khoản, không lọc theo chi nhánh. {data ? `${data.unreadCount} chưa đọc` : ''}</Text>{error && <OperationState message={error} onRetry={refresh} />}<FlatList data={data?.data ?? []} keyExtractor={item => item.id} refreshing={busy} onRefresh={refresh} contentContainerStyle={styles.list} ListEmptyComponent={<OperationState message={busy ? 'Đang tải thông báo…' : error ? 'Chưa có dữ liệu.' : 'Chưa có thông báo.'} />} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.isRead ? '' : 'Chưa đọc. '}${item.title}`} style={[styles.card, !item.isRead && styles.unread]} onPress={() => void open(item)}><Text style={styles.title}>{item.title}</Text><Text style={styles.body}>{item.body}</Text></Pressable>} ListFooterComponent={<View style={styles.footer}>{page > 1 && <OperationButton label="Trang trước" secondary onPress={() => setPage(value => value - 1)} />}{data && page < data.pagination.totalPages && <OperationButton label="Trang tiếp" secondary onPress={() => setPage(value => value + 1)} />}</View>} /></OperationPage>;
}
const styles = StyleSheet.create({ note: { marginHorizontal: 20, marginBottom: 12, fontSize: 14, color: colors.textGray }, list: { padding: 20, gap: 12 }, card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: colors.border }, unread: { borderColor: colors.primary }, title: { color: colors.textDark, fontSize: 17, fontWeight: '700' }, body: { color: colors.textBody, fontSize: 16, lineHeight: 24 }, footer: { gap: 12, paddingVertical: 16 } });
