import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ownerOperationsApi } from '../../api/ownerOperations';
import { useOperationalTime } from '../../hooks/useOperationalTime';
import { operationalTimeLabel } from '../../utils/bookingOperationalTime';
import type { OwnerBooking } from '../../types/ownerOperations';
import { OperationButton, OperationState } from '../OperationPrimitives';
import { useOwnerData } from './hooks';
import { useOperations } from '../OperationsContext';
import { Body, BookingSummary, Card, Heading, Meta } from './OwnerUI';

function BookingRow({ booking, fresh, onOpen }: { booking: OwnerBooking; fresh: boolean; onOpen: () => void }) {
  const now = useOperationalTime(booking.serverNow, fresh);
  const labels = [...new Set(booking.items.map(item => operationalTimeLabel(item, booking.status, now)).filter(Boolean))];
  return <Card><BookingSummary booking={booking} />{labels.map(label => <Body key={label}>{label}</Body>)}<OperationButton secondary label={`Xem lịch ${booking.code}`} onPress={onOpen} /></Card>;
}
export function UnfinishedBookings({ onOpen }: { onOpen: (id: string) => void }) {
  const operations = useOperations();
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [operations.branchId]);
  const data = useOwnerData(async scope => scope.branchId ? ownerOperationsApi.unfinished(scope, page) : null, `unfinished:${page}`);
  return <View><Heading>Lịch chưa kết thúc</Heading><Meta>Bao gồm lịch từ ngày trước; giờ dự kiến đã qua vẫn cần được kiểm tra, không tự kết luận vắng mặt.</Meta>
    {!operations.branchId ? <Meta>Chọn một chi nhánh để xem và xử lý lịch chưa kết thúc.</Meta> : <>
      {data.loading && <OperationState message="Đang cập nhật lịch chưa kết thúc…" />}{data.error && <OperationState message={data.error} onRetry={data.reload} />}
      {data.data?.data.map(booking => <BookingRow key={booking.id} booking={booking} fresh={!data.loading && !data.error} onOpen={() => onOpen(booking.id)} />)}
      {!data.loading && !data.error && data.data && !data.data.total && <Meta>Không có lịch chưa kết thúc trong chi nhánh này.</Meta>}
      {data.data && <><Meta>Trang {page} · {data.data.total} lịch</Meta><View style={{ flexDirection: 'row', gap: 8 }}>
        <OperationButton secondary label="Trang trước" disabled={page === 1 || data.loading} onPress={() => setPage(value => value - 1)} />
        <OperationButton secondary label="Trang sau" disabled={page * 20 >= data.data.total || data.loading} onPress={() => setPage(value => value + 1)} />
      </View></>}
    </>}
  </View>;
}
