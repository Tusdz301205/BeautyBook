import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HoatDongStackParamList } from '../navigation/HoatDongStack';
import { useBookings } from '../context/BookingsContext';
import { bookingsApi } from '../api/bookings';
import type { ApiAvailableSlot } from '../types/api';
import { colors, elevation, layout, space, type } from '../theme';
import { slotClock } from '../utils/bookingClock';
import { AppButton, Chip, EmptyState, Notice, ScreenHeader, TextField } from '../ui';

type Props = NativeStackScreenProps<HoatDongStackParamList, 'Reschedule'>;

const dateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function RescheduleScreen({ route, navigation }: Props) {
  const { getBooking, reload } = useBookings();
  const booking = getBooking(route.params.bookingId);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return date;
  }), []);
  const [date, setDate] = useState(dateString(days[0]));
  const [slots, setSlots] = useState<ApiAvailableSlot[]>([]);
  const [slot, setSlot] = useState<ApiAvailableSlot | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!booking?.branchId || !booking.serviceIds.length) return;
    let active = true;
    setLoading(true);
    setSlot(null);
    setError(null);
    bookingsApi.availableSlots({
      branchId: booking.branchId,
      serviceIds: booking.serviceIds,
      staffId: booking.bookingServices[0]?.staffId,
      variantSelections: booking.variantSelections,
      date,
    }).then((result) => {
      if (active) setSlots(result.slots);
    }).catch((reason) => {
      if (active) { setSlots([]); setError(reason instanceof Error ? reason.message : 'Không tải được giờ trống'); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [booking?.branchId, booking?.serviceIds.join(','), date]);

  const submit = async () => {
    if (!booking || !slot || !reason.trim()) return;
    setSubmitting(true);
    try {
      await bookingsApi.requestReschedule(booking.id, {
        proposedStartTime: slot.start,
        proposedEndTime: slot.end,
        proposedStaffId: booking.bookingServices[0]?.staffId,
        reason: reason.trim(),
      });
      await reload();
      Alert.alert('Đã gửi yêu cầu', 'Lịch hiện tại được giữ cho đến khi cơ sở duyệt.');
      navigation.goBack();
    } catch (reason) {
      Alert.alert('Không thể đổi lịch', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
    } finally { setSubmitting(false); }
  };

  const weekday = (day: Date) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][day.getDay()];
  return <View style={styles.screen}>
    <ScreenHeader title="Yêu cầu đổi lịch" onBack={() => navigation.goBack()} backDisabled={submitting} />
    {!booking ? <EmptyState icon="calendar-clear-outline" title="Không tìm thấy lịch hẹn" message="Lịch hẹn không còn khả dụng cho tài khoản này." actionLabel="Quay lại" onAction={() => navigation.goBack()} /> : <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Notice tone="info" title="Lịch hiện tại vẫn giữ nguyên" message={`${booking.serviceName} · ${booking.date} lúc ${booking.time}. Lịch chỉ đổi khi cơ sở duyệt yêu cầu.`} />
        <Text accessibilityRole="header" style={styles.heading}>Chọn ngày mới</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{days.map((day) => {
          const value = dateString(day);
          return <Chip key={value} role="radio" label={`${weekday(day)} ${day.getDate()}/${day.getMonth() + 1}`} selected={date === value} onPress={() => setDate(value)} />;
        })}</ScrollView>
        <Text accessibilityRole="header" style={styles.heading}>Giờ trống</Text>
        <Text style={styles.hint}>Giờ theo múi giờ Việt Nam (GMT+7), cùng chuyên viên hiện tại.</Text>
        {loading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
        {!!error && <Notice tone="error" message={error} />}
        {!loading && !error && slots.length === 0 && <Text style={styles.hint}>Không có giờ trống trong ngày này. Thử ngày khác.</Text>}
        <View style={styles.grid}>{slots.map((item) => <Chip key={item.start} role="radio" label={slotClock(item.start)} selected={slot?.start === item.start} onPress={() => setSlot(item)} />)}</View>
        <TextField label="Lý do đổi lịch" value={reason} onChangeText={setReason} multiline placeholder="Cho cơ sở biết lý do" helper="Bắt buộc để cơ sở xem xét yêu cầu." />
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <AppButton label={submitting ? 'Đang gửi…' : 'Gửi yêu cầu đổi lịch'} loading={submitting} disabled={!slot || !reason.trim() || submitting} onPress={() => void submit()} />
      </SafeAreaView>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: layout.gutter, paddingTop: space.sm, paddingBottom: space.xxl, gap: space.md },
  heading: { ...type.h3, marginTop: space.sm },
  hint: { ...type.secondary, marginTop: -space.xs },
  loader: { marginVertical: space.lg },
  row: { gap: space.sm, paddingVertical: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  bottomBar: { paddingHorizontal: layout.gutter, paddingTop: space.md, paddingBottom: space.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider, ...elevation.raised },
});
