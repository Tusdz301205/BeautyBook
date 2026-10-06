import React from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
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
  const reload = () => { data.reload(); requests.reload(); impacts.reload(); operations.refresh(); };
  if (!operations.businessId) return <OperationPage title="Doanh nghiệp"><OwnerSetupState /></OperationPage>;
  return <OperationPage title="Tổng quan"><FlatList contentContainerStyle={styles.list} data={data.data?.branches ?? []} keyExtractor={branch => branch.id}
    refreshControl={<RefreshControl refreshing={data.loading || requests.loading || impacts.loading} onRefresh={reload} />}
    ListHeaderComponent={<View><OwnerFilters /><OwnerSetupState />{operations.error && <OperationState message={operations.error} onRetry={operations.refresh} />}
      {data.error && <OperationState message={data.error} onRetry={data.reload} />}
      {!data.data && data.loading && <OperationState message="Đang tải tình hình chi nhánh…" />}
      {!operations.businessId && <OwnerSetupState />}
      {data.data && data.data.branches.length > 0 && <Card><Heading>Ngày {data.data.date}</Heading><Body>{data.data.bookings} lịch hẹn · {data.data.completedBookings} lịch đã hoàn tất</Body><Meta>Số lịch được cơ sở xác nhận hoàn tất, sau khi các dịch vụ đã kết thúc.</Meta>{data.data.statuses.filter(status => status.count > 0).map(status => <Body key={status.status}>{statusLabel(status.status)}: {status.count}</Body>)}</Card>}
      <Card><Heading>Việc cần xem xét</Heading>{requests.loading ? <Body>Đang tải yêu cầu…</Body> : requests.error ? <OperationState message={requests.error} onRetry={reload} /> : <Body>{requests.data?.length} yêu cầu đổi / hủy đang chờ</Body>}{impacts.loading ? <Body>Đang tải ảnh hưởng…</Body> : impacts.error ? <OperationState message={impacts.error} onRetry={reload} /> : <Body>{impacts.data?.filter(item => ['OPEN', 'IN_PROGRESS', 'READY_TO_COMPLETE'].includes(item.status)).length} case vận hành chưa đóng</Body>}<OperationButton label="Mở Vận hành" onPress={() => navigation.navigate('OwnerHome', { screen: 'VanHanh' })} /></Card>
      <Heading>Tình hình chi nhánh</Heading></View>}
    ListEmptyComponent={!data.loading && !data.error ? <Card><Body>Chưa có chi nhánh được phép truy cập trong phiên hiện tại.</Body><DesktopLink /></Card> : null}
    renderItem={({ item }) => <Card><Heading>{item.name}</Heading><Body>{item.bookings} lịch · {item.completedBookings} lịch hoàn tất</Body><Meta>{item.activeProfiles} hồ sơ nhân viên đang hoạt động; không phải số người đang trong ca.</Meta><Meta>Trạng thái chi nhánh: {statusLabel(operations.branches.find(branch => branch.id === item.id)?.status || '')}</Meta><OperationButton label={`Xem vận hành ${item.name}`} secondary onPress={() => { operations.setBranchId(item.id); navigation.navigate('OwnerHome', { screen: 'VanHanh' }); }} /><DesktopLink /></Card>} />
  </OperationPage>;
}
