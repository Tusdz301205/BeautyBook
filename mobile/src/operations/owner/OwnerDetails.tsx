import React, { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ownerOperationsApi } from '../../api/ownerOperations';
import { OperationPage, OperationButton, OperationState } from '../OperationPrimitives';
import { completeImpactAllowed, isUuid, ordinaryRescheduleAllowed, reviewAllowed } from './policy';
import { useOwnerData, useOwnerMutation } from './hooks';
import { Body, BookingSummary, Card, DesktopLink, Heading, Meta, momentLabel, Note, ReviewAction, statusLabel, styles } from './OwnerUI';
import type { OwnerStackParams } from './OwnerTabs';
import { useOperationalTime } from '../../hooks/useOperationalTime';
import { operationalTimeLabel } from '../../utils/bookingOperationalTime';
import { serviceTimingLines } from '../../utils/bookingTiming';
import { ActualTimeCorrection } from './ActualTimeCorrection';

export function OwnerRequestDetail({ route, navigation }: NativeStackScreenProps<OwnerStackParams, 'OwnerRequest'>) {
  const data = useOwnerData(async scope => {
    if (!isUuid(route.params.id)) throw { status: 404 };
    const request = (await ownerOperationsApi.requests(scope)).find(item => item.id === route.params.id);
    return request ?? null;
  }, `request:${route.params.id}`);
  const mutation = useOwnerMutation(data.reload, !!data.data && !data.loading && !data.error);
  const [note, setNote] = useState('');
  const scroll = useRef<ScrollView>(null);
  const request = data.data;
  const review = async (action: 'approve' | 'reject') => {
    if (!request) return;
    const completed = await mutation.run(() => ownerOperationsApi.review(data.scope, request.id, action, note, request));
    if (completed && navigation.canGoBack()) navigation.goBack();
    else scroll.current?.scrollTo({ y: 0, animated: true });
  };
  const disabled = data.loading || !!data.error || mutation.busy || mutation.blocked || !request || !reviewAllowed(request);
  const canApprove = request && (request.type === 'CANCEL' || ordinaryRescheduleAllowed(request));
  return <OperationPage title="Xét duyệt yêu cầu" inStack><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.list, { paddingTop: 16 }]} refreshControl={<RefreshControl refreshing={data.loading} onRefresh={data.reload} />}>
    {data.loading && <OperationState message="Đang kiểm tra yêu cầu hiện tại…" />}{data.error && <OperationState message={data.error} onRetry={data.reload} />}{mutation.message && <OperationState message={mutation.message} onRetry={data.reload} />}
    {!data.loading && !data.error && !request && <OperationState message="Không còn yêu cầu chờ xét duyệt trong phạm vi này. Yêu cầu có thể đã được xử lý hoặc hết hạn." />}
    {request && <><Card><BookingSummary booking={request.booking} /><Body>{statusLabel(request.type)} · {statusLabel(request.status)}</Body><Body>{request.reason || 'Không có lý do kèm theo.'}</Body><Meta>Hạn xét duyệt: {momentLabel(request.expiresAt, request.booking.timezone)}</Meta><OperationButton secondary label="Xem chi tiết lịch hẹn" disabled={data.loading} onPress={() => navigation.navigate('OwnerBooking', { id: request.booking.id })} /></Card>
      <Card><Heading>Trước khi thay đổi</Heading><Body>{request.booking.date} · {momentLabel(request.booking.start, request.booking.timezone)} – {momentLabel(request.booking.end, request.booking.timezone)}</Body>{request.booking.items.map(item => <Body key={item.id}>{item.name} · {item.staffName || 'Chưa phân công'} · {statusLabel(item.status)}</Body>)}</Card>
      <Card><Heading>Sau khi duyệt</Heading>{request.type === 'CANCEL' ? <Body>Hủy lịch và các dịch vụ chưa hoàn tất. Thao tác có phụ thuộc tài chính phải xử lý tại phiên bản quản trị.</Body> : request.type === 'RESCHEDULE' ? <Body>{momentLabel(request.proposedStart, request.booking.timezone)} – {momentLabel(request.proposedEnd, request.booking.timezone)}{request.proposedStaffId ? ` · Nhân viên: ${request.proposedStaff || 'được đề xuất'}` : ' · Giữ phân công hiện tại'}</Body> : <Body>Đổi nhân viên: {request.proposedStaff || 'Chưa có tên nhân viên'}. Xử lý tại phiên bản quản trị.</Body>}</Card>
      <DesktopLink /><Note value={note} onChange={setNote} />{!canApprove && <OperationState message="Yêu cầu này cần xử lý tại phiên bản quản trị." />}
      <ReviewAction label="Duyệt yêu cầu" disabled={disabled || !canApprove} busy={mutation.busy} consequence={`Duyệt ${statusLabel(request.type).toLowerCase()} cho ${request.booking.customerName}, lịch ${request.booking.code}. Máy chủ sẽ kiểm tra lại điều kiện trước khi áp dụng.`} onConfirm={() => void review('approve')} />
      {request.lateCancellation && <OperationState message="Yêu cầu hủy sát giờ hợp lệ cần được xác nhận; không thể từ chối." />}
      <ReviewAction label="Từ chối yêu cầu" disabled={disabled || !note.trim() || request.lateCancellation} busy={mutation.busy} consequence={`Từ chối yêu cầu của ${request.booking.customerName}; lịch giữ nguyên. Lý do: ${note}`} onConfirm={() => void review('reject')} /></>}
  </ScrollView></KeyboardAvoidingView></OperationPage>;
}
export function OwnerBookingDetail({ route }: NativeStackScreenProps<OwnerStackParams, 'OwnerBooking'>) {
  const data = useOwnerData(scope => ownerOperationsApi.booking(scope, route.params.id), `booking:${route.params.id}`);
  const mutation = useOwnerMutation(data.reload, !!data.data && !data.loading && !data.error);
  const [more, setMore] = useState(false), [note, setNote] = useState('');
  const booking = data.data, disabled = data.loading || !!data.error || mutation.busy || mutation.blocked;
  const serverNow = useOperationalTime(booking?.serverNow, !data.loading && !data.error);
  return <OperationPage title="Chi tiết lịch hẹn" inStack><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.list, { paddingTop: 16 }]} refreshControl={<RefreshControl refreshing={data.loading} onRefresh={data.reload} />}>
    {data.loading && <OperationState message="Đang cập nhật lịch hẹn…" />}{data.error && <OperationState message={data.error} onRetry={data.reload} />}{mutation.message && <OperationState message={mutation.message} onRetry={data.reload} />}
    {booking && <><Card><BookingSummary booking={booking} />{booking.note && <><Heading>Ghi chú lịch hẹn</Heading><Body>{booking.note}</Body></>}</Card><Card><Heading>Tiến trình dịch vụ</Heading>{booking.items.map(item => <View key={item.id}><Body>{item.name}</Body><Meta>{item.staffName || 'Chưa phân công'} · {statusLabel(item.status)}</Meta>{operationalTimeLabel(item, booking.status, serverNow) && <Body>{operationalTimeLabel(item, booking.status, serverNow)}</Body>}{serviceTimingLines(item, booking.timezone).map(line => <Meta key={line}>{line}</Meta>)}<ActualTimeCorrection booking={booking} item={item} scope={data.scope} blocked={disabled} run={mutation.run} /></View>)}<Meta>Quá giờ không chứng minh khách vắng mặt hoặc dịch vụ đã làm. Xác minh tại quầy; không ghi giờ thực tế thay cho dự kiến.</Meta></Card>
    <OperationButton secondary label={more ? 'Ẩn thao tác ngoại lệ' : 'Thao tác khác · ngoại lệ vận hành'} onPress={() => setMore(value => !value)} />
    {more && <Card><Heading>Can thiệp ngoại lệ</Heading><Meta>Dùng khi cần can thiệp vào lịch cụ thể. Ngoại lệ phức tạp tiếp tục trên quản trị.</Meta><Note value={note} onChange={setNote} />
      {booking.status === 'PENDING' && <><ReviewAction label="Xác nhận lịch" disabled={disabled} busy={mutation.busy} consequence={`Xác nhận lịch ${booking.code} của ${booking.customerName}.`} onConfirm={() => void mutation.run(() => ownerOperationsApi.bookingAction(data.scope, booking.id, 'confirm', note, booking))} /><ReviewAction label="Từ chối lịch" disabled={disabled || !note.trim()} busy={mutation.busy} consequence={`Từ chối lịch ${booking.code} của ${booking.customerName}. Lý do: ${note}. Các trường hợp có tài chính phải tiếp tục trên quản trị.`} onConfirm={() => void mutation.run(() => ownerOperationsApi.bookingAction(data.scope, booking.id, 'reject', note, booking))} /></>}
      {booking.status === 'CONFIRMED' && <><ReviewAction label="Xác nhận khách đã đến" disabled={disabled || !booking.checkinAllowed} busy={mutation.busy} consequence={`Xác nhận ${booking.customerName} đã đến chi nhánh cho lịch ${booking.code}.`} onConfirm={() => void mutation.run(() => ownerOperationsApi.bookingAction(data.scope, booking.id, 'checkin', note, booking))} />{!booking.checkinAllowed && <OperationState message="Chưa đủ điều kiện check-in theo thời gian và trạng thái từ máy chủ." />}</>}
      {!['PENDING', 'CONFIRMED'].includes(booking.status) && <Body>Không có thao tác ngoại lệ cho trạng thái này.</Body>}
    </Card>}</>}
  </ScrollView></KeyboardAvoidingView></OperationPage>;
}
export function OwnerImpactDetail({ route, navigation }: NativeStackScreenProps<OwnerStackParams, 'OwnerImpact'>) {
  const data = useOwnerData(scope => ownerOperationsApi.impact(scope, route.params.id), `impact:${route.params.id}`);
  const mutation = useOwnerMutation(data.reload, !!data.data && !data.loading && !data.error);
  const [note, setNote] = useState('');
  const impact = data.data, disabled = data.loading || !!data.error || mutation.busy || mutation.blocked;
  return <OperationPage title="Ảnh hưởng vận hành" inStack><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><FlatList data={impact?.items ?? []} keyExtractor={item => item.id} contentContainerStyle={[styles.list, { paddingTop: 16 }]} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={data.loading} onRefresh={data.reload} />}
    ListHeaderComponent={<View>{data.loading && <OperationState message="Đang kiểm tra case…" />}{data.error && <OperationState message={data.error} onRetry={data.reload} />}{mutation.message && <OperationState message={mutation.message} onRetry={data.reload} />}{impact && <><Card><Heading>{impact.reason}</Heading><Body>{statusLabel(impact.status)}</Body><Meta>Hạn xử lý: {momentLabel(impact.deadlineAt, data.scope.branches.find(branch => branch.id === impact.branchId)?.timezone || 'Asia/Ho_Chi_Minh')}</Meta><Body>Giữ nguyên theo ngoại lệ chỉ áp dụng khi đã xác minh có thể tiếp tục phục vụ. Ghi rõ lý do; mỗi lịch bị ảnh hưởng được xử lý riêng.</Body><Meta>Đổi nhân viên, đổi giờ, chuyển chi nhánh hoặc hủy / hoàn tiền cần xử lý tại quản trị.</Meta><DesktopLink /></Card><Note value={note} onChange={setNote} /></>}</View>}
    renderItem={({ item }) => <Card>{item.booking ? <BookingSummary booking={item.booking} /> : <Body>Lịch liên quan không còn khả dụng.</Body>}<Body>{statusLabel(item.status)}{item.resolution ? ` · ${statusLabel(item.resolution)}` : ''}</Body>{item.reason && <Meta>{item.reason}</Meta>}{item.booking && <OperationButton secondary label="Xem lịch liên quan" disabled={data.loading} onPress={() => navigation.navigate('OwnerBooking', { id: item.bookingId })} />}
      <ReviewAction label="Giữ nguyên theo ngoại lệ" busy={mutation.busy} disabled={disabled || !note.trim() || !item.booking || item.status !== 'PENDING' || !impact || !['OPEN', 'IN_PROGRESS'].includes(impact.status)} consequence={`Giữ nguyên lịch ${item.booking?.code || ''}; ghi nhận item đã xử lý theo ngoại lệ. Lý do: ${note}`} onConfirm={() => impact && void mutation.run(() => ownerOperationsApi.approveException(data.scope, impact.id, item.id, note))} /></Card>}
    ListFooterComponent={impact ? <Card><ReviewAction label="Đóng case đã xử lý" busy={mutation.busy} disabled={disabled || !completeImpactAllowed(impact)} consequence="Đóng case khi tất cả lịch bị ảnh hưởng đã được xử lý. Máy chủ sẽ kiểm tra lại từng item." onConfirm={() => void mutation.run(() => ownerOperationsApi.completeImpact(data.scope, impact.id))} />{!completeImpactAllowed(impact) && <Meta>Chỉ đóng case khi mọi item đã xử lý và máy chủ xác nhận sẵn sàng.</Meta>}</Card> : null} />
  </KeyboardAvoidingView></OperationPage>;
}
