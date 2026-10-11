import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, tones, type } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ownerOperationsApi } from '../../api/ownerOperations';
import { OperationPage, OperationButton, OperationState, BranchPicker, opStyles } from '../OperationPrimitives';
import { useOwnerData } from './hooks';
import { Body, Card, Heading, Meta, momentLabel, statusLabel, styles } from './OwnerUI';
import type { OwnerStackParams } from './OwnerTabs';
import type { OwnerImpact, OwnerRequest } from '../../types/ownerOperations';
import { UnfinishedBookings } from './UnfinishedBookings';

type WorkRow = { kind: 'request'; item: OwnerRequest } | { kind: 'impact'; item: OwnerImpact };
const OPEN_IMPACT = ['OPEN', 'IN_PROGRESS', 'READY_TO_COMPLETE'];

export default function OwnerOperations() {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParams>>();
  const requests = useOwnerData(ownerOperationsApi.requests, 'requests');
  const impacts = useOwnerData(ownerOperationsApi.impacts, 'impacts');
  const openImpacts = (impacts.data ?? []).filter(item => OPEN_IMPACT.includes(item.status));
  const data: WorkRow[] = [...(requests.data ?? []).map(item => ({ kind: 'request' as const, item })), ...openImpacts.map(item => ({ kind: 'impact' as const, item }))];
  const reload = () => { requests.reload(); impacts.reload(); };
  return <OperationPage title="Vận hành" subtitle="Việc cần quyết định trong phạm vi chi nhánh đã chọn"><FlatList data={data} keyExtractor={value => `${value.kind}:${value.item.id}`} contentContainerStyle={styles.list}
    refreshControl={<RefreshControl refreshing={requests.loading || impacts.loading} onRefresh={reload} colors={[colors.primary]} tintColor={colors.primary} />}
    ListHeaderComponent={<View>
      <BranchPicker inset={false} />
      <UnfinishedBookings onOpen={id => navigation.navigate('OwnerBooking', { id })} />
      <Text accessibilityRole="header" style={opStyles.section}>Yêu cầu và ảnh hưởng</Text>
      <Meta>Mọi ngày còn hiệu lực trong phạm vi chi nhánh đã chọn.</Meta>
      {requests.loading && <OperationState message="Đang cập nhật yêu cầu…" />}
      {requests.error && <OperationState tone="error" message={`Yêu cầu: ${requests.error}`} onRetry={requests.reload} />}
      {impacts.loading && <OperationState message="Đang cập nhật ảnh hưởng…" />}
      {impacts.error && <OperationState tone="error" message={`Ảnh hưởng: ${impacts.error}`} onRetry={impacts.reload} />}
      <View style={local.summary}>
        {requests.data && <View style={[local.count, { backgroundColor: tones.request.bg }]}><Text style={[local.countNumber, { color: tones.request.fg }]}>{requests.data.length}</Text><Text style={local.countLabel}>yêu cầu cần xét duyệt</Text></View>}
        {impacts.data && <View style={[local.count, { backgroundColor: tones.warning.bg }]}><Text style={[local.countNumber, { color: tones.warning.fg }]}>{openImpacts.length}</Text><Text style={local.countLabel}>ảnh hưởng vận hành chưa đóng</Text></View>}
      </View>
    </View>}
    ListEmptyComponent={!requests.loading && !impacts.loading && !requests.error && !impacts.error ? <OperationState message="Không có yêu cầu hoặc ảnh hưởng còn chờ xử lý trong phạm vi này." /> : null}
    renderItem={({ item: value }) => value.kind === 'request' ? <Card tone="request">
      <View style={local.kind}><Ionicons accessible={false} name="swap-horizontal-outline" size={18} color={tones.request.fg} /><Text style={[local.kindLabel, { color: tones.request.fg }]}>Yêu cầu {statusLabel(value.item.type).toLowerCase()}</Text></View>
      <Heading>{value.item.booking.customerName}</Heading>
      <Body>{value.item.booking.branchName}</Body>
      <Meta>Mã lịch {value.item.booking.code} · Hạn xét duyệt {momentLabel(value.item.expiresAt, value.item.booking.timezone)}</Meta>
      <OperationButton label="Xét duyệt yêu cầu" icon="checkmark-circle-outline" disabled={requests.loading} onPress={() => navigation.navigate('OwnerRequest', { id: value.item.id })} />
    </Card> : <Card tone="warning">
      <View style={local.kind}><Ionicons accessible={false} name="warning-outline" size={18} color={tones.warning.fg} /><Text style={[local.kindLabel, { color: tones.warning.fg }]}>Ảnh hưởng vận hành · {statusLabel(value.item.status)}</Text></View>
      <Heading>{value.item.reason}</Heading>
      <Body>{impacts.scope.branches.find(branch => branch.id === value.item.branchId)?.name ?? 'Toàn doanh nghiệp'}</Body>
      <Meta>Hạn xử lý {momentLabel(value.item.deadlineAt, impacts.scope.branches.find(branch => branch.id === value.item.branchId)?.timezone || 'Asia/Ho_Chi_Minh')}</Meta>
      <OperationButton label="Xem ảnh hưởng và xử lý" secondary disabled={impacts.loading} onPress={() => navigation.navigate('OwnerImpact', { id: value.item.id })} />
    </Card>} />
  </OperationPage>;
}

const local = StyleSheet.create({
  summary: { flexDirection: 'row', gap: space.sm, marginVertical: space.md },
  count: { flex: 1, borderRadius: radius.md, padding: space.md, gap: 2 },
  countNumber: { ...type.numeric, fontSize: 22, lineHeight: 28 },
  countLabel: { ...type.caption, color: colors.body },
  kind: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  kindLabel: { ...type.secondaryStrong, flexShrink: 1 },
});
