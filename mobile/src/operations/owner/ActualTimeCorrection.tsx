import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '../../theme';
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
  const field = (label: string, value: string, onChange: (value: string) => void, placeholder: string) => <View style={local.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={styles.input} accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={colors.disabledText} keyboardType="numbers-and-punctuation" value={value} onChangeText={onChange} editable={!blocked} />
  </View>;
  return <View style={styles.group}>
    <OperationButton secondary icon="time-outline" label={open ? 'Ẩn hiệu chỉnh thời gian' : 'Bổ sung / hiệu chỉnh thời gian thực tế'} disabled={blocked} onPress={() => setOpen(value => !value)} />
    {open && <View style={local.panel}><Heading>Thời gian phục vụ thực tế</Heading><Meta>Múi giờ {booking.timezone}. Chỉ nhập mốc đã xác minh; không lấy giờ dự kiến để đoán.</Meta>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: unknown, disabled: blocked }} disabled={blocked} onPress={() => setUnknown(value => !value)} style={local.check}>
        <Ionicons accessible={false} name={unknown ? 'checkbox' : 'square-outline'} size={24} color={unknown ? colors.primary : colors.borderStrong} />
        <Text style={local.checkText}>Không biết chính xác thời gian thực tế</Text>
      </Pressable>
      {unknown ? <Body>Dịch vụ được ghi hoàn tất; bắt đầu / kết thúc thực tế giữ chưa biết.</Body> : <>
        <View style={local.pair}>{field('Ngày bắt đầu thực tế', startDay, setStartDay, 'YYYY-MM-DD')}{field('Giờ bắt đầu thực tế', startTime, setStartTime, 'HH:mm')}</View>
        <View style={local.pair}>{field('Ngày hoàn tất thực tế', endDay, setEndDay, 'YYYY-MM-DD')}{field('Giờ hoàn tất thực tế', endTime, setEndTime, 'HH:mm')}</View>
      </>}
      <Note value={reason} onChange={setReason} label="Lý do hiệu chỉnh (bắt buộc)" />{error && <OperationState tone="error" message={error} />}
      <OperationButton label="Kiểm tra và lưu hiệu chỉnh" disabled={blocked || !reason.trim()} onPress={save} />
      <OperationButton secondary label="Xem lịch sử hiệu chỉnh" disabled={blocked || historyBusy} busy={historyBusy} onPress={() => { void loadHistory(); }} />
      {history?.map(entry => <View key={entry.id} style={styles.group}><Heading>Hiệu chỉnh lần {entry.version}</Heading>
        <Meta>{entry.actorName} · {formatServiceTimestamp(entry.correctedAt, booking.timezone)}</Meta>
        <Body>Trước: {formatServiceTimestamp(entry.oldActualStartedAt, booking.timezone) ?? 'Chưa biết'} → {formatServiceTimestamp(entry.oldActualCompletedAt, booking.timezone) ?? 'Chưa biết'}</Body>
        <Body>Sau: {formatServiceTimestamp(entry.actualStartedAt, booking.timezone) ?? 'Chưa biết'} → {formatServiceTimestamp(entry.actualCompletedAt, booking.timezone) ?? 'Chưa biết'}</Body>
        <Meta>Lý do: {entry.reason}</Meta></View>)}
      {history && !history.length && <Meta>Chưa có lần hiệu chỉnh nào.</Meta>}
    </View>}
  </View>;
}

const local = StyleSheet.create({
  panel: { gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  check: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.md },
  checkText: { ...type.body, color: colors.heading, flex: 1 },
  pair: { flexDirection: 'row', gap: space.sm },
  field: { flex: 1, minWidth: 0, gap: space.xs },
});
