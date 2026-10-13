import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, space, tones, type, fw } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ownerOperationsApi } from '../../api/ownerOperations';
import { useOperations } from '../OperationsContext';
import { OperationPage, OperationButton, OperationState } from '../OperationPrimitives';
import { useOwnerData } from './hooks';
import { Body, Card, DesktopLink, Heading, Meta, OwnerFilters, statusLabel } from './OwnerUI';
import type { OwnerStackParams } from './OwnerTabs';
import OwnerSetupState from './OwnerSetupState';

const OPEN_IMPACT = ['OPEN', 'IN_PROGRESS', 'READY_TO_COMPLETE'];
const viDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : value;

export default function OwnerOverview() {
  const operations = useOperations();
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParams>>();
  const data = useOwnerData(scope => ownerOperationsApi.dashboard(scope, operations.date), `dashboard:${operations.date}`);
  const requests = useOwnerData(ownerOperationsApi.requests, 'overview-requests');
  const impacts = useOwnerData(ownerOperationsApi.impacts, 'overview-impacts');
  const requestCount = requests.data?.length;
  const impactCount = impacts.data?.filter(item => OPEN_IMPACT.includes(item.status)).length;
  // Loading or failed reads are never presented as “nothing to do”.
  const attentionKnown = requestCount != null && impactCount != null && !requests.loading && !impacts.loading && !requests.error && !impacts.error;
  const needsAttention = attentionKnown && requestCount + impactCount > 0;
  const branchAttention = new Map<string, number>();
  if (attentionKnown) {
    for (const request of requests.data ?? []) branchAttention.set(request.booking.branchId, (branchAttention.get(request.booking.branchId) ?? 0) + 1);
    for (const impact of impacts.data ?? []) if (impact.branchId && OPEN_IMPACT.includes(impact.status)) branchAttention.set(impact.branchId, (branchAttention.get(impact.branchId) ?? 0) + 1);
  }
  const reload = () => { data.reload(); requests.reload(); impacts.reload(); operations.refresh(); };
  if (!operations.businessId) return <OperationPage title="Doanh nghiệp"><View style={local.gutter}><OwnerSetupState /></View></OperationPage>;
  return <OperationPage title="Tổng quan"><FlatList contentContainerStyle={local.list} data={data.data?.branches ?? []} keyExtractor={branch => branch.id}
    refreshControl={<RefreshControl refreshing={data.loading || requests.loading || impacts.loading} onRefresh={reload} colors={[colors.primary]} tintColor={colors.primary} />}
    ListHeaderComponent={<View>
      <OwnerFilters />
      {operations.error && <OperationState tone="error" message={operations.error} onRetry={operations.refresh} />}
      <View style={[local.attention, needsAttention && local.attentionPending, attentionKnown && !needsAttention && local.attentionClear]}>
        <View style={local.attentionTitle}>
          <Ionicons accessible={false} name={needsAttention ? 'flag' : attentionKnown ? 'checkmark-circle-outline' : 'sync-outline'} size={22} color={needsAttention ? colors.primary : attentionKnown ? tones.success.fg : colors.secondaryText} />
          <View style={local.flex}><Heading>{needsAttention ? 'Cần bạn xử lý' : attentionKnown ? 'Không có việc chờ xử lý' : 'Việc cần xem xét'}</Heading></View>
        </View>
        <View style={local.attentionCounts}>
          <View style={[local.attentionItem, { backgroundColor: tones.request.bg }]}>
            {requests.loading ? <Meta>Đang cập nhật yêu cầu…</Meta> : requests.error ? <OperationState tone="error" message={requests.error} onRetry={reload} /> : <>
              <Text style={[local.attentionNumber, (requestCount ?? 0) > 0 && local.attentionNumberHot]}>{requestCount ?? '—'}</Text>
              <Meta>yêu cầu đổi / hủy đang chờ</Meta>
            </>}
          </View>
          <View style={[local.attentionItem, { backgroundColor: tones.warning.bg }]}>
            {impacts.loading ? <Meta>Đang cập nhật ảnh hưởng…</Meta> : impacts.error ? <OperationState tone="error" message={impacts.error} onRetry={reload} /> : <>
              <Text style={[local.attentionNumber, (impactCount ?? 0) > 0 && local.attentionNumberWarn]}>{impactCount ?? '—'}</Text>
              <Meta>ảnh hưởng vận hành chưa đóng</Meta>
            </>}
          </View>
        </View>
        <OperationButton label="Xem việc cần xử lý" icon="clipboard-outline" secondary={!needsAttention} onPress={() => navigation.navigate('OwnerHome', { screen: 'VanHanh' })} />
      </View>
      <OwnerSetupState />
      {data.error && <OperationState tone="error" message={data.error} onRetry={data.reload} />}
      {!data.data && data.loading && <OperationState message="Đang tải tình hình chi nhánh…" />}
      {data.data && data.data.branches.length > 0 && <View style={local.day}>
        <Heading>{data.data.date === operations.date ? `Ngày ${viDate(data.data.date)}` : `Số liệu ngày ${viDate(data.data.date)}`}</Heading>
        {data.loading && <Meta>Đang cập nhật số liệu…</Meta>}
        <View style={local.totals}>
          <View style={local.total}><Text style={local.number}>{data.data.bookings}</Text><Meta>Lịch hẹn</Meta></View>
          <View style={local.total}><Text style={local.number}>{data.data.completedBookings}</Text><Meta>Lịch hoàn tất</Meta></View>
        </View>
        <View style={local.statuses}>{data.data.statuses.filter(status => status.count > 0).map(status => <Text key={status.status} style={local.status}>{statusLabel(status.status)} · {status.count}</Text>)}</View>
      </View>}
      <Text accessibilityRole="header" style={local.section}>Tình hình chi nhánh</Text>
    </View>}
    ListEmptyComponent={!data.loading && !data.error ? <Card><Body>Bạn chưa có quyền truy cập chi nhánh nào.</Body><DesktopLink /></Card> : null}
    renderItem={({ item }) => <View style={local.branch}>
      <View style={local.branchHead}>
        <View style={local.flex}><Heading>{item.name}</Heading><Meta>{statusLabel(operations.branches.find(branch => branch.id === item.id)?.status || '')}</Meta></View>
        {(branchAttention.get(item.id) ?? 0) > 0 && <Text style={local.branchAttention}>{branchAttention.get(item.id)} mục cần xử lý</Text>}
      </View>
      <Body>{item.bookings} lịch · {item.completedBookings} hoàn tất</Body>
      <Meta>{item.activeProfiles} hồ sơ nhân viên đang hoạt động</Meta>
      <OperationButton label={`Xem vận hành ${item.name}`} secondary onPress={() => { operations.setBranchId(item.id); navigation.navigate('OwnerHome', { screen: 'VanHanh' }); }} />
    </View>} />
  </OperationPage>;
}

const local = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gutter: { paddingHorizontal: layout.gutter },
  list: { paddingHorizontal: layout.gutter, paddingBottom: space.xxxl },
  attention: { backgroundColor: colors.surface, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, gap: space.md, marginBottom: space.lg },
  attentionPending: { backgroundColor: colors.primaryTint, borderColor: colors.primary, borderWidth: 1.5 },
  attentionClear: { backgroundColor: tones.success.bg, borderColor: tones.success.border },
  attentionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  attentionCounts: { flexDirection: 'row', gap: space.md },
  attentionItem: { flex: 1, minWidth: 0, gap: 2, borderRadius: radius.md, padding: space.md },
  attentionNumber: { ...type.numeric, color: colors.heading },
  attentionNumberHot: { color: tones.request.fg },
  attentionNumberWarn: { color: tones.warning.fg },
  day: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: space.md },
  totals: { flexDirection: 'row', gap: space.lg },
  total: { flex: 1, gap: 2 },
  number: { ...type.numeric },
  caption: { ...type.caption },
  statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  status: { ...type.caption, ...fw.semibold, color: colors.body, backgroundColor: colors.surfaceMuted, paddingHorizontal: space.sm + 2, paddingVertical: space.xs, borderRadius: radius.pill, overflow: 'hidden' },
  section: { ...type.overline, marginTop: space.md, marginBottom: space.xs },
  branch: { padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.lg, marginTop: space.md },
  branchHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  branchAttention: { ...type.caption, ...fw.bold, color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: space.xs, overflow: 'hidden' },
});
