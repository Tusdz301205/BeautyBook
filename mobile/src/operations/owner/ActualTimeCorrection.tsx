import React, { useEffect, useRef, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { ownerOperationsApi } from '../../api/ownerOperations';
import type { OwnerActualTimeCorrection, OwnerBooking, OwnerScope } from '../../types/ownerOperations';
import { useOperationalTime } from '../../hooks/useOperationalTime';
import { correctionPayload } from '../../utils/actualTimeCorrection';
import { formatServiceTimestamp } from '../../utils/bookingTiming';
import { OperationButton, OperationState } from '../OperationPrimitives';
import { Body, Heading, Meta, Note, styles } from './OwnerUI';

export function ActualTimeCorrection({ booking, item, scope, blocked, run }: {
  booking: OwnerBooking; item: OwnerBooking['items'][number]; scope: OwnerScope; blocked: boolean;
  run: (action: () => Promise<void>) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false), [unknown, setUnknown] = useState(false);
  const [startDay, setStartDay] = useState(''), [startTime, setStartTime] = useState('');
  const [endDay, setEndDay] = useState(''), [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState(''), [error, setError] = useState('');
  const [history, setHistory] = useState<OwnerActualTimeCorrection[] | null>(null), [historyBusy, setHistoryBusy] = useState(false);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  const now = useOperationalTime(booking.serverNow, !blocked);
  useEffect(() => { request.current++; setHistory(null); setHistoryBusy(false); setOpen(false); setStartDay(''); setStartTime(''); setEndDay(''); setEndTime(''); setReason(''); setUnknown(false); setError(''); }, [item.id, item.revision]);
  if (!item.canCorrectActualTime) return null;
  const loadHistory = async () => {
    const sequence = ++request.current; setHistoryBusy(true);
    try { const rows = await ownerOperationsApi.actualTimeHistory(scope, booking.id, item.id); if (sequence === request.current) setHistory(rows); }
    catch (e) { if (sequence === request.current) setError(e instanceof Error ? e.message : 'Chưa tải được lịch sử.'); }
    finally { if (sequence === request.current) setHistoryBusy(false); }
  };
  const save = () => {
    try {
      const input = correctionPayload({ startDay, startTime, endDay, endTime, timezone: booking.timezone, unknown, reason, expectedRevision: item.revision ?? 0, serverNow: now });
      setError('');
      Alert.alert('Lưu hiệu chỉnh thời gian?', `${item.name}. ${unknown ? 'Đánh dấu dịch vụ hoàn tất với thời gian thực tế chưa biết.' : 'Ghi nhận các mốc thực tế bạn đã xác minh.'} Giữ nguyên giờ dự kiến. Máy chủ kiểm tra quyền, xung đột và lưu lịch sử; không tự hoàn thành toàn bộ lịch hoặc xử lý tiền.`, [
        { text: 'Quay lại', style: 'cancel' }, { text: 'Lưu hiệu chỉnh', onPress: () => { void run(() => ownerOperationsApi.correctActualTime(scope, booking.id, item.id, input)); } },
      ]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kiểm tra các trường thời gian.'); }
  };
  return <View style={styles.group}>
    <OperationButton secondary label={open ? 'Ẩn hiệu chỉnh thời gian' : 'Bổ sung / hiệu chỉnh thời gian thực tế'} disabled={blocked} onPress={() => setOpen(value => !value)} />
    {open && <><Heading>Thời gian phục vụ thực tế</Heading><Meta>Múi giờ {booking.timezone}. Chỉ nhập mốc đã xác minh; không lấy giờ dự kiến để đoán.</Meta>
      <OperationButton secondary label={unknown ? 'Thời gian: chưa biết' : 'Không biết chính xác thời gian'} disabled={blocked} onPress={() => setUnknown(value => !value)} />
      {unknown ? <Body>Dịch vụ được ghi hoàn tất; bắt đầu / kết thúc thực tế giữ chưa biết.</Body> : <>
        <TextInput style={styles.input} accessibilityLabel="Ngày bắt đầu thực tế" placeholder="Ngày bắt đầu · YYYY-MM-DD" value={startDay} onChangeText={setStartDay} editable={!blocked} />
        <TextInput style={styles.input} accessibilityLabel="Giờ bắt đầu thực tế" placeholder="Giờ bắt đầu · HH:mm" value={startTime} onChangeText={setStartTime} editable={!blocked} />
        <TextInput style={styles.input} accessibilityLabel="Ngày hoàn tất thực tế" placeholder="Ngày hoàn tất · YYYY-MM-DD" value={endDay} onChangeText={setEndDay} editable={!blocked} />
        <TextInput style={styles.input} accessibilityLabel="Giờ hoàn tất thực tế" placeholder="Giờ hoàn tất · HH:mm" value={endTime} onChangeText={setEndTime} editable={!blocked} />
      </>}
      <Note value={reason} onChange={setReason} />{error && <OperationState message={error} />}
      <OperationButton label="Kiểm tra và lưu hiệu chỉnh" disabled={blocked || !reason.trim()} onPress={save} />
      <OperationButton secondary label="Xem lịch sử hiệu chỉnh" disabled={blocked || historyBusy} busy={historyBusy} onPress={() => { void loadHistory(); }} />
      {history?.map(entry => <View key={entry.id} style={styles.group}><Heading>Hiệu chỉnh lần {entry.version}</Heading>
        <Meta>{entry.actorName} · {formatServiceTimestamp(entry.correctedAt, booking.timezone)}</Meta>
        <Body>Trước: {formatServiceTimestamp(entry.oldActualStartedAt, booking.timezone) ?? 'Chưa biết'} → {formatServiceTimestamp(entry.oldActualCompletedAt, booking.timezone) ?? 'Chưa biết'}</Body>
        <Body>Sau: {formatServiceTimestamp(entry.actualStartedAt, booking.timezone) ?? 'Chưa biết'} → {formatServiceTimestamp(entry.actualCompletedAt, booking.timezone) ?? 'Chưa biết'}</Body>
        <Meta>Lý do: {entry.reason}</Meta></View>)}
      {history && !history.length && <Meta>Chưa có lần hiệu chỉnh nào.</Meta>}
    </>}
  </View>;
}
