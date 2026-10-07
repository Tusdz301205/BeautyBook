import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ownerOperationsApi } from '../../api/ownerOperations';
import { OperationPage, OperationButton, OperationState, BranchPicker } from '../OperationPrimitives';
import { useOwnerData } from './hooks';
import { Body, Heading, Meta, momentLabel, statusLabel, styles } from './OwnerUI';
import type { OwnerStackParams } from './OwnerTabs';
import type { OwnerImpact, OwnerRequest } from '../../types/ownerOperations';
import { UnfinishedBookings } from './UnfinishedBookings';

type WorkRow = { kind: 'request'; item: OwnerRequest } | { kind: 'impact'; item: OwnerImpact };
export default function OwnerOperations() {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParams>>();
  const requests = useOwnerData(ownerOperationsApi.requests, 'requests');
  const impacts = useOwnerData(ownerOperationsApi.impacts, 'impacts');
  const data: WorkRow[] = [ ...(requests.data ?? []).map(item => ({ kind: 'request' as const, item })),
    ...(impacts.data ?? []).filter(item => ['OPEN', 'IN_PROGRESS', 'READY_TO_COMPLETE'].includes(item.status)).map(item => ({ kind: 'impact' as const, item })) ];
  const reload = () => { requests.reload(); impacts.reload(); };
  return <OperationPage title="Vận hành"><FlatList data={data} keyExtractor={value => `${value.kind}:${value.item.id}`} contentContainerStyle={styles.list}
    refreshControl={<RefreshControl refreshing={requests.loading || impacts.loading} onRefresh={reload} />}
    ListHeaderComponent={<View><BranchPicker inset={false} /><UnfinishedBookings onOpen={id => navigation.navigate('OwnerBooking', { id })} /><Meta>Mọi ngày còn hiệu lực trong phạm vi chi nhánh đã chọn.</Meta>
      {requests.loading && <OperationState message="Đang cập nhật yêu cầu…" />}{requests.error && <OperationState message={`Yêu cầu: ${requests.error}`} onRetry={requests.reload} />}
      {impacts.loading && <OperationState message="Đang cập nhật ảnh hưởng…" />}{impacts.error && <OperationState message={`Ảnh hưởng: ${impacts.error}`} onRetry={impacts.reload} />}
      <View style={local.summary}>{requests.data && <Meta>{requests.data.length} yêu cầu cần xét duyệt</Meta>}
      {impacts.data && <Meta>{impacts.data.filter(item => ['OPEN', 'IN_PROGRESS', 'READY_TO_COMPLETE'].includes(item.status)).length} ảnh hưởng vận hành chưa đóng</Meta>}</View></View>}
    ListEmptyComponent={!requests.loading && !impacts.loading && !requests.error && !impacts.error ? <OperationState message="Không có yêu cầu hoặc ảnh hưởng còn chờ xử lý trong phạm vi này." /> : null}
    renderItem={({ item: value }) => value.kind === 'request' ? <View style={local.request}>
      <View style={local.kind}><Ionicons accessible={false} name="swap-horizontal-outline" size={19} color={colors.primary} /><Text style={local.requestLabel}>Yêu cầu {statusLabel(value.item.type).toLowerCase()}</Text></View>
      <Heading>{value.item.booking.customerName}</Heading><Body>{value.item.booking.branchName}</Body><Meta>{value.item.booking.code} · Hạn xét duyệt: {momentLabel(value.item.expiresAt, value.item.booking.timezone)}</Meta><OperationButton label="Xét duyệt yêu cầu" secondary disabled={requests.loading} onPress={() => navigation.navigate('OwnerRequest', { id: value.item.id })} /></View> :
    <View style={local.impact}><View style={local.kind}><Ionicons accessible={false} name="alert-circle-outline" size={19} color={colors.orange} /><Text style={local.impactLabel}>Ảnh hưởng vận hành</Text></View>
      <Heading>{value.item.reason}</Heading><Body>{impacts.scope.branches.find(branch => branch.id === value.item.branchId)?.name ?? 'Toàn doanh nghiệp'}</Body><Meta>{statusLabel(value.item.status)} · Hạn xử lý: {momentLabel(value.item.deadlineAt, impacts.scope.branches.find(branch => branch.id === value.item.branchId)?.timezone || 'Asia/Ho_Chi_Minh')}</Meta><OperationButton label="Xem ảnh hưởng và xử lý" secondary disabled={impacts.loading} onPress={() => navigation.navigate('OwnerImpact', { id: value.item.id })} /></View>} />
  </OperationPage>;
}
const local = StyleSheet.create({
  summary: { gap: 4, marginVertical: 12 }, kind: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  request: { padding: 16, gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, marginBottom: 14 },
  impact: { padding: 16, gap: 10, backgroundColor: colors.card, borderWidth: 1, borderLeftWidth: 4, borderColor: colors.orange, borderRadius: 16, marginBottom: 14 },
  requestLabel: { fontSize: 14, fontWeight: '700', color: colors.primary, flexShrink: 1 }, impactLabel: { fontSize: 14, fontWeight: '700', color: colors.textBody, flexShrink: 1 },
});
