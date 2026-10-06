import React from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ownerOperationsApi } from '../../api/ownerOperations';
import { OperationPage, OperationButton, OperationState, BranchPicker } from '../OperationPrimitives';
import { useOwnerData } from './hooks';
import { Body, Card, Heading, Meta, momentLabel, statusLabel, styles } from './OwnerUI';
import type { OwnerStackParams } from './OwnerTabs';
import type { OwnerImpact, OwnerRequest } from '../../types/ownerOperations';

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
    ListHeaderComponent={<View><BranchPicker inset={false} /><Meta>Mọi ngày còn hiệu lực trong phạm vi chi nhánh đã chọn.</Meta>
      {requests.loading && <OperationState message="Đang cập nhật yêu cầu…" />}{requests.error && <OperationState message={`Yêu cầu: ${requests.error}`} onRetry={requests.reload} />}
      {impacts.loading && <OperationState message="Đang cập nhật ảnh hưởng…" />}{impacts.error && <OperationState message={`Ảnh hưởng: ${impacts.error}`} onRetry={impacts.reload} />}
      {requests.data && <Body>{requests.data.length} yêu cầu đang chờ từ danh sách đầy đủ của máy chủ</Body>}
      {impacts.data && <Body>{impacts.data.filter(item => ['OPEN', 'IN_PROGRESS', 'READY_TO_COMPLETE'].includes(item.status)).length} case vận hành chưa đóng</Body>}</View>}
    ListEmptyComponent={!requests.loading && !impacts.loading && !requests.error && !impacts.error ? <OperationState message="Không có yêu cầu hoặc ảnh hưởng còn chờ xử lý trong phạm vi này." /> : null}
    renderItem={({ item: value }) => value.kind === 'request' ? <Card><Meta>Yêu cầu cần xét duyệt</Meta><Heading>{statusLabel(value.item.type)} · {value.item.booking.customerName}</Heading><Body>{value.item.booking.branchName} · {value.item.booking.code}</Body><Body>{value.item.reason || 'Khách không gửi lý do.'}</Body><Meta>Hạn xét duyệt: {momentLabel(value.item.expiresAt, value.item.booking.timezone)}</Meta><OperationButton label="Xem trước / sau và xét duyệt" secondary disabled={requests.loading} onPress={() => navigation.navigate('OwnerRequest', { id: value.item.id })} /></Card> :
    <Card><Meta>Ảnh hưởng vận hành · {statusLabel(value.item.status)}</Meta><Heading>{value.item.reason}</Heading><Body>{impacts.scope.branches.find(branch => branch.id === value.item.branchId)?.name ?? 'Toàn doanh nghiệp'}</Body><Meta>Hạn xử lý: {momentLabel(value.item.deadlineAt, impacts.scope.branches.find(branch => branch.id === value.item.branchId)?.timezone || 'Asia/Ho_Chi_Minh')}</Meta><OperationButton label="Xem case và lịch bị ảnh hưởng" secondary disabled={impacts.loading} onPress={() => navigation.navigate('OwnerImpact', { id: value.item.id })} /></Card>} />
  </OperationPage>;
}
