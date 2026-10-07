import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ownerOperationsApi } from '../../api/ownerOperations';
import { useOperations } from '../OperationsContext';
import { OperationPage, OperationButton, OperationState } from '../OperationPrimitives';
import { useOwnerData } from './hooks';
import { Body, Card, DesktopLink, Heading, Meta, OwnerFilters, statusLabel, styles } from './OwnerUI';
import type { OwnerStackParams } from './OwnerTabs';
import OwnerSetupState from './OwnerSetupState';

export default function OwnerOverview() {
  const operations = useOperations();
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParams>>();
  const data = useOwnerData(scope => ownerOperationsApi.dashboard(scope, operations.date), `dashboard:${operations.date}`);
  const requests = useOwnerData(ownerOperationsApi.requests, 'overview-requests');
  const impacts = useOwnerData(ownerOperationsApi.impacts, 'overview-impacts');
  const requestCount = requests.data?.length;
  const impactCount = impacts.data?.filter(item => ['OPEN', 'IN_PROGRESS', 'READY_TO_COMPLETE'].includes(item.status)).length;
  const attentionKnown = requestCount != null && impactCount != null && !requests.loading && !impacts.loading && !requests.error && !impacts.error;
  const needsAttention = attentionKnown && requestCount + impactCount > 0;
  const branchAttention = new Map<string, number>();
  if (attentionKnown) {
    for (const request of requests.data ?? []) branchAttention.set(request.booking.branchId, (branchAttention.get(request.booking.branchId) ?? 0) + 1);
    for (const impact of impacts.data ?? []) if (impact.branchId && ['OPEN', 'IN_PROGRESS', 'READY_TO_COMPLETE'].includes(impact.status)) branchAttention.set(impact.branchId, (branchAttention.get(impact.branchId) ?? 0) + 1);
  }
  const reload = () => { data.reload(); requests.reload(); impacts.reload(); operations.refresh(); };
  if (!operations.businessId) return <OperationPage title="Doanh nghiệp"><OwnerSetupState /></OperationPage>;
  return <OperationPage title="Tổng quan"><FlatList contentContainerStyle={styles.list} data={data.data?.branches ?? []} keyExtractor={branch => branch.id}
    refreshControl={<RefreshControl refreshing={data.loading || requests.loading || impacts.loading} onRefresh={reload} />}
    ListHeaderComponent={<View><OwnerFilters /><OwnerSetupState />{operations.error && <OperationState message={operations.error} onRetry={operations.refresh} />}
      {data.error && <OperationState message={data.error} onRetry={data.reload} />}
      {!data.data && data.loading && <OperationState message="Đang tải tình hình chi nhánh…" />}
      {!operations.businessId && <OwnerSetupState />}
      <View style={[local.attention, needsAttention && local.attentionPending]}>
        <View style={local.attentionTitle}><Ionicons accessible={false} name={needsAttention ? 'flag-outline' : attentionKnown ? 'checkmark-circle-outline' : 'sync-outline'} size={22} color={needsAttention ? colors.primary : colors.textGray} /><View style={local.attentionHeading}><Heading>{needsAttention ? 'Cần bạn xử lý' : attentionKnown ? 'Không có việc chờ xử lý' : 'Việc cần xem xét'}</Heading></View></View>
        {requests.loading ? <Meta>Đang cập nhật yêu cầu…</Meta> : requests.error ? <OperationState message={requests.error} onRetry={reload} /> : <Body>{requestCount ?? 'Chưa có dữ liệu'} yêu cầu đổi / hủy đang chờ</Body>}
        {impacts.loading ? <Meta>Đang cập nhật ảnh hưởng…</Meta> : impacts.error ? <OperationState message={impacts.error} onRetry={reload} /> : <Body>{impactCount ?? 'Chưa có dữ liệu'} ảnh hưởng vận hành chưa đóng</Body>}
        <OperationButton label="Xem việc cần xử lý" secondary={!needsAttention} onPress={() => navigation.navigate('OwnerHome', { screen: 'VanHanh' })} />
      </View>
      {data.data && data.data.branches.length > 0 && <View style={local.day}>
        <Heading>{data.data.date === operations.date ? `Ngày ${data.data.date}` : `Số liệu ngày ${data.data.date}`}</Heading>
        {data.loading && <Meta>Đang cập nhật số liệu…</Meta>}
        <View style={local.totals}><View style={local.total}><Text style={local.number}>{data.data.bookings}</Text><Meta>Lịch hẹn</Meta></View><View style={local.total}><Text style={local.number}>{data.data.completedBookings}</Text><Meta>Lịch hoàn tất</Meta></View></View>
        <View style={local.statuses}>{data.data.statuses.filter(status => status.count > 0).map(status => <Text key={status.status} style={local.status}>{statusLabel(status.status)} · {status.count}</Text>)}</View>
      </View>}
      <Heading>Tình hình chi nhánh</Heading></View>}
    ListEmptyComponent={!data.loading && !data.error ? <Card><Body>Chưa có chi nhánh được phép truy cập trong phiên hiện tại.</Body><DesktopLink /></Card> : null}
    renderItem={({ item }) => <View style={local.branch}><Heading>{item.name}</Heading><Meta>{statusLabel(operations.branches.find(branch => branch.id === item.id)?.status || '')}</Meta><Body>{item.bookings} lịch · {item.completedBookings} hoàn tất</Body>{(branchAttention.get(item.id) ?? 0) > 0 && <Text style={local.branchAttention}>{branchAttention.get(item.id)} mục cần xử lý</Text>}<Meta>{item.activeProfiles} hồ sơ nhân viên hoạt động · Không phải số người đang trong ca</Meta><OperationButton label={`Xem vận hành ${item.name}`} secondary onPress={() => { operations.setBranchId(item.id); navigation.navigate('OwnerHome', { screen: 'VanHanh' }); }} /></View>} />
  </OperationPage>;
}
const local = StyleSheet.create({
  attention: { backgroundColor: colors.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, gap: 8, marginBottom: 18 },
  attentionPending: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  attentionTitle: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, attentionHeading: { flex: 1, minWidth: 0 },
  day: { gap: 12, paddingVertical: 8, marginBottom: 18 }, totals: { flexDirection: 'row', gap: 16 }, total: { flex: 1, gap: 2 },
  number: { fontSize: 30, fontWeight: '800', color: colors.textDark }, statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  status: { fontSize: 14, lineHeight: 21, color: colors.textBody, backgroundColor: colors.card, padding: 8, borderRadius: 8 },
  branch: { padding: 16, gap: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 16, marginTop: 12 },
  branchAttention: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
