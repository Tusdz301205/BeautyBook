import React, { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, tones, type } from '../../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ownerOperationsApi } from '../../api/ownerOperations';
import { OperationPage, OperationButton, OperationState } from '../OperationPrimitives';
import { completeImpactAllowed, isUuid, ordinaryRescheduleAllowed, reviewAllowed } from './policy';
import { useOwnerData, useOwnerMutation } from './hooks';
import { Body, BookingSummary, Card, DesktopLink, Heading, Meta, momentLabel, Note, ReviewAction, StatusTag, statusLabel, styles, viDate } from './OwnerUI';
import type { OwnerStackParams } from './OwnerTabs';
import { useOperationalTime } from '../../hooks/useOperationalTime';
import { operationalTimeLabel } from '../../utils/bookingOperationalTime';
import { serviceTimingLines } from '../../utils/bookingTiming';
import { ActualTimeCorrection } from './ActualTimeCorrection';

export function OwnerRequestDetail({ route, navigation }: NativeStackScreenProps<OwnerStackParams, 'OwnerRequest'>) {
  const fromNotification = route.params.fromNotification === true;
  const data = useOwnerData(async scope => {
    if (!isUuid(route.params.id)) throw { status: 404 };
    const request = (await ownerOperationsApi.requests(scope)).find(item => item.id === route.params.id);
    return request ?? null;
  }, `request:${route.params.id}`, fromNotification);
  const mutation = useOwnerMutation(data.reload, !!data.data && !data.loading && !data.error);
  const [note, setNote] = useState('');
  const scroll = useRef<ScrollView>(null);
  const request = data.data;
  const actionScope = fromNotification && request ? { ...data.scope, branchId: request.booking.branchId } : data.scope;
  const review = async (action: 'approve' | 'reject') => {
    if (!request) return;
    const completed = await mutation.run(() => ownerOperationsApi.review(actionScope, request.id, action, note, request));
    if (completed && navigation.canGoBack()) navigation.goBack();
    else scroll.current?.scrollTo({ y: 0, animated: true });
  };
  const disabled = data.loading || !!data.error || mutation.busy || mutation.blocked || !request || !reviewAllowed(request);
  const canApprove = request && (request.type === 'CANCEL' || ordinaryRescheduleAllowed(request));
  return <OperationPage title="Xét duyệt yêu cầu" inStack><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.list, { paddingTop: 16 }]} refreshControl={<RefreshControl refreshing={data.loading} onRefresh={data.reload} />}>
    {data.loading && <OperationState message="Đang kiểm tra yêu cầu hiện tại…" />}{data.error && <OperationState tone="error" message={data.error} onRetry={data.reload} />}{mutation.message && <OperationState message={mutation.message} onRetry={data.reload} />}
    {!data.loading && !data.error && !request && <OperationState message="Không còn yêu cầu chờ xét duyệt trong phạm vi này. Yêu cầu có thể đã được xử lý hoặc hết hạn." />}
    {request && <><Card tone="request"><View style={local.kind}><Ionicons accessible={false} name="swap-horizontal-outline" size={18} color={tones.request.fg} /><Text style={[local.kindText, { color: tones.request.fg }]}>Yêu cầu {statusLabel(request.type).toLowerCase()} · {statusLabel(request.status)}</Text></View><BookingSummary booking={request.booking} /><Meta>Lý do của khách</Meta><Body>{request.reason || 'Không có lý do kèm theo.'}</Body><Meta>Hạn xét duyệt: {momentLabel(request.expiresAt, request.booking.timezone)}</Meta><OperationButton secondary label="Xem chi tiết lịch hẹn" disabled={data.loading} onPress={() => navigation.navigate('OwnerBooking', fromNotification ? { id: request.booking.id, fromNotification: true } : { id: request.booking.id })} /></Card>
      <Card><Heading>Trước khi thay đổi</Heading><Body>{viDate(request.booking.date)} · {momentLabel(request.booking.start, request.booking.timezone)} – {momentLabel(request.booking.end, request.booking.timezone)}</Body>{request.booking.items.map(item => <Body key={item.id}>{item.name} · {item.staffName || 'Chưa phân công'} · {statusLabel(item.status)}</Body>)}</Card>
      <Card><Heading>Sau khi duyệt</Heading>{request.type === 'CANCEL' ? <Body>Hủy lịch và các dịch vụ chưa hoàn tất. Thao tác có phụ thuộc tài chính phải xử lý tại phiên bản quản trị.</Body> : request.type === 'RESCHEDULE' ? <Body>{momentLabel(request.proposedStart, request.booking.timezone)} – {momentLabel(request.proposedEnd, request.booking.timezone)}{request.proposedStaffId ? ` · Nhân viên: ${request.proposedStaff || 'được đề xuất'}` : ' · Giữ phân công hiện tại'}</Body> : <Body>Đổi nhân viên: {request.proposedStaff || 'Chưa có tên nhân viên'}. Xử lý tại phiên bản quản trị.</Body>}</Card>
      <DesktopLink /><Note value={note} onChange={setNote} />{!canApprove && <OperationState tone="warning" message="Yêu cầu này cần xử lý tại phiên bản quản trị." />}
      <ReviewAction label="Duyệt yêu cầu" disabled={disabled || !canApprove} busy={mutation.busy} consequence={`Duyệt ${statusLabel(request.type).toLowerCase()} cho ${request.booking.customerName}, lịch ${request.booking.code}.`} onConfirm={() => void review('approve')} />
      {request.lateCancellation && <OperationState tone="warning" message="Yêu cầu hủy sát giờ hợp lệ cần được xác nhận; không thể từ chối." />}
      <ReviewAction danger label="Từ chối yêu cầu" disabled={disabled || !note.trim() || request.lateCancellation} busy={mutation.busy} consequence={`Từ chối yêu cầu của ${request.booking.customerName}; lịch giữ nguyên. Lý do: ${note}`} onConfirm={() => void review('reject')} /></>}
  </ScrollView></KeyboardAvoidingView></OperationPage>;
}
export function OwnerBookingDetail({ route, navigation }: NativeStackScreenProps<OwnerStackParams, 'OwnerBooking'>) {
  const fromNotification = route.params.fromNotification === true;
  const data = useOwnerData(scope => ownerOperationsApi.booking(scope, route.params.id), `booking:${route.params.id}`, fromNotification);
  const requests = useOwnerData(async scope => {
    if (!fromNotification) return [];
    return (await ownerOperationsApi.requests(scope)).filter(request => request.booking.id === route.params.id && reviewAllowed(request));
  }, `booking-requests:${route.params.id}`, fromNotification);
  const mutation = useOwnerMutation(data.reload, !!data.data && !data.loading && !data.error);
  const [more, setMore] = useState(false), [note, setNote] = useState('');
  const booking = data.data, disabled = data.loading || !!data.error || mutation.busy || mutation.blocked;
  // Pin actions to the branch returned by the authorized read, without changing
  // the global branch filter. Every action still refetches and checks this scope.
  const actionScope = fromNotification && booking ? { ...data.scope, branchId: booking.branchId } : data.scope;
  const serverNow = useOperationalTime(booking?.serverNow, !data.loading && !data.error);
  return <OperationPage title="Chi tiết lịch hẹn" inStack><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.list, { paddingTop: 16 }]} refreshControl={<RefreshControl refreshing={data.loading} onRefresh={data.reload} />}>
    {data.loading && <OperationState message="Đang cập nhật lịch hẹn…" />}{data.error && <OperationState tone="error" message={data.error} onRetry={data.reload} />}{mutation.message && <OperationState message={mutation.message} onRetry={data.reload} />}
    {booking && <><Card><BookingSummary booking={booking} />{booking.note && <><Heading>Ghi chú lịch hẹn</Heading><Body>{booking.note}</Body></>}</Card><Card><Heading>Tiến trình dịch vụ</Heading>{booking.items.map(item => <View key={item.id} style={local.item}><View style={local.itemHead}><Text style={local.itemName}>{item.name}</Text><StatusTag status={item.status} /></View><Meta>{item.staffName || 'Chưa phân công'}</Meta>{operationalTimeLabel(item, booking.status, serverNow) && <View style={local.warning}><Ionicons accessible={false} name="warning-outline" size={16} color={tones.warning.fg} /><Text style={local.warningText}>{operationalTimeLabel(item, booking.status, serverNow)}</Text></View>}{serviceTimingLines(item, booking.timezone).map(line => <Meta key={line}>{line}</Meta>)}<ActualTimeCorrection booking={booking} item={item} scope={actionScope} blocked={disabled} run={mutation.run} /></View>)}<Meta>Quá giờ không chứng minh khách vắng mặt hoặc dịch vụ đã làm. Xác minh tại quầy; không ghi giờ thực tế thay cho dự kiến.</Meta></Card>
    {fromNotification && <>
      {requests.loading && <OperationState message="Đang kiểm tra yêu cầu chờ duyệt…" />}
      {requests.error && <OperationState tone="error" message={requests.error} onRetry={requests.reload} />}
      {!requests.loading && !requests.error && requests.data?.map(request => <OperationButton key={request.id} secondary label={`Xét duyệt yêu cầu ${statusLabel(request.type).toLowerCase()}`} disabled={disabled} onPress={() => navigation.navigate('OwnerRequest', { id: request.id, fromNotification: true })} />)}
    </>}
    <OperationButton secondary label={more ? 'Ẩn thao tác ngoại lệ' : 'Thao tác khác · ngoại lệ vận hành'} onPress={() => setMore(value => !value)} />
    {more && <Card><Heading>Can thiệp ngoại lệ</Heading><Meta>Dùng khi cần can thiệp vào lịch cụ thể. Ngoại lệ phức tạp tiếp tục trên quản trị.</Meta><Note value={note} onChange={setNote} />
      {booking.status === 'PENDING' && <><ReviewAction label="Xác nhận lịch" disabled={disabled} busy={mutation.busy} consequence={`Xác nhận lịch ${booking.code} của ${booking.customerName}.`} onConfirm={() => void mutation.run(() => ownerOperationsApi.bookingAction(actionScope, booking.id, 'confirm', note, booking))} /><ReviewAction danger label="Từ chối lịch" disabled={disabled || !note.trim()} busy={mutation.busy} consequence={`Từ chối lịch ${booking.code} của ${booking.customerName}. Lý do: ${note}. Các trường hợp có tài chính phải tiếp tục trên quản trị.`} onConfirm={() => void mutation.run(() => ownerOperationsApi.bookingAction(actionScope, booking.id, 'reject', note, booking))} /></>}
      {booking.status === 'CONFIRMED' && <><ReviewAction label="Xác nhận khách đã đến" disabled={disabled || !booking.checkinAllowed} busy={mutation.busy} consequence={`Xác nhận ${booking.customerName} đã đến chi nhánh cho lịch ${booking.code}.`} onConfirm={() => void mutation.run(() => ownerOperationsApi.bookingAction(actionScope, booking.id, 'checkin', note, booking))} />{!booking.checkinAllowed && <OperationState tone="warning" message="Chưa thể xác nhận khách đã đến. Kiểm tra giờ hẹn và trạng thái lịch." />}</>}
      {!['PENDING', 'CONFIRMED'].includes(booking.status) && <Body>Không có thao tác ngoại lệ cho trạng thái này.</Body>}
    </Card>}</>}
  </ScrollView></KeyboardAvoidingView></OperationPage>;
}
export function OwnerImpactDetail({ route, navigation }: NativeStackScreenProps<OwnerStackParams, 'OwnerImpact'>) {
  const fromNotification = route.params.fromNotification === true;
  const data = useOwnerData(scope => ownerOperationsApi.impact(scope, route.params.id), `impact:${route.params.id}`, fromNotification);
  const mutation = useOwnerMutation(data.reload, !!data.data && !data.loading && !data.error);
  const [note, setNote] = useState('');
  const impact = data.data, disabled = data.loading || !!data.error || mutation.busy || mutation.blocked;
  const actionScope = fromNotification && impact ? { ...data.scope, branchId: impact.branchId } : data.scope;
  return <OperationPage title="Ảnh hưởng vận hành" inStack><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><FlatList data={impact?.items ?? []} keyExtractor={item => item.id} contentContainerStyle={[styles.list, { paddingTop: 16 }]} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={data.loading} onRefresh={data.reload} />}
    ListHeaderComponent={<View>{data.loading && <OperationState message="Đang kiểm tra ảnh hưởng…" />}{data.error && <OperationState tone="error" message={data.error} onRetry={data.reload} />}{mutation.message && <OperationState message={mutation.message} onRetry={data.reload} />}{impact && <><Card tone="warning"><Heading>{impact.reason}</Heading><Body>{statusLabel(impact.status)}</Body><Meta>Hạn xử lý: {momentLabel(impact.deadlineAt, data.scope.branches.find(branch => branch.id === impact.branchId)?.timezone || 'Asia/Ho_Chi_Minh')}</Meta><Body>Giữ nguyên theo ngoại lệ chỉ áp dụng khi đã xác minh có thể tiếp tục phục vụ. Ghi rõ lý do; mỗi lịch bị ảnh hưởng được xử lý riêng.</Body><Meta>Đổi nhân viên, đổi giờ, chuyển chi nhánh hoặc hủy / hoàn tiền cần xử lý tại quản trị.</Meta><DesktopLink /></Card><Note value={note} onChange={setNote} /></>}</View>}
    renderItem={({ item }) => <Card>{item.booking ? <BookingSummary booking={item.booking} /> : <Body>Lịch liên quan không còn khả dụng.</Body>}<Body>{statusLabel(item.status)}{item.resolution ? ` · ${statusLabel(item.resolution)}` : ''}</Body>{item.reason && <Meta>{item.reason}</Meta>}{item.booking && <OperationButton secondary label="Xem lịch liên quan" disabled={data.loading} onPress={() => navigation.navigate('OwnerBooking', fromNotification ? { id: item.bookingId, fromNotification: true } : { id: item.bookingId })} />}
      <ReviewAction label="Giữ nguyên theo ngoại lệ" busy={mutation.busy} disabled={disabled || !note.trim() || !item.booking || item.status !== 'PENDING' || !impact || !['OPEN', 'IN_PROGRESS'].includes(impact.status)} consequence={`Giữ nguyên lịch ${item.booking?.code || ''}; ghi nhận lịch liên quan đã xử lý theo ngoại lệ. Lý do: ${note}`} onConfirm={() => impact && void mutation.run(() => ownerOperationsApi.approveException(actionScope, impact.id, item.id, note))} /></Card>}
    ListFooterComponent={impact ? <Card><ReviewAction label="Đóng ảnh hưởng đã xử lý" busy={mutation.busy} disabled={disabled || !completeImpactAllowed(impact)} consequence="Đóng ảnh hưởng sau khi tất cả lịch liên quan đã được xử lý." onConfirm={() => void mutation.run(() => ownerOperationsApi.completeImpact(actionScope, impact.id))} />{!completeImpactAllowed(impact) && <Meta>Cần xử lý tất cả lịch liên quan trước khi đóng ảnh hưởng.</Meta>}</Card> : null} />
  </KeyboardAvoidingView></OperationPage>;
}

const local = StyleSheet.create({
  kind: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  kindText: { ...type.secondaryStrong, flexShrink: 1 },
  item: { gap: space.xs, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.divider },
  itemHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
  itemName: { ...type.bodyStrong, flexShrink: 1 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs + 2, borderRadius: radius.sm, backgroundColor: tones.warning.bg, paddingHorizontal: space.sm, paddingVertical: space.xs, alignSelf: 'flex-start' },
  warningText: { ...type.secondaryStrong, color: tones.warning.fg, flexShrink: 1 },
});
