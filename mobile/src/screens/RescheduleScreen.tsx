import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HoatDongStackParamList } from '../navigation/HoatDongStack';
import { useBookings } from '../context/BookingsContext';
import { bookingsApi } from '../api/bookings';
import type { ApiAvailableSlot } from '../types/api';
import { colors } from '../constants/colors';

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

  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.link}>‹ Quay lại</Text></TouchableOpacity>
      <Text style={styles.title}>Yêu cầu đổi lịch</Text>
      {!booking ? <Text>Không tìm thấy lịch hẹn.</Text> : <>
        <Text style={styles.note}>Lịch hiện tại được giữ cho đến khi cơ sở duyệt yêu cầu.</Text>
        <Text style={styles.heading}>Chọn ngày mới</Text>
        <View style={styles.row}>{days.map((day) => {
          const value = dateString(day);
          return <TouchableOpacity key={value} style={[styles.chip, date === value && styles.selected]} onPress={() => setDate(value)}>
            <Text style={styles.chipText}>{day.getDate()}/{day.getMonth() + 1}</Text>
          </TouchableOpacity>;
        })}</View>
        <Text style={styles.heading}>Giờ trống</Text>
        {loading && <ActivityIndicator color={colors.primary} />}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && slots.length === 0 && <Text>Không có giờ trống.</Text>}
        <View style={styles.row}>{slots.map((item) => <TouchableOpacity key={item.start} style={[styles.chip, slot?.start === item.start && styles.selected]} onPress={() => setSlot(item)}>
          <Text style={styles.chipText}>{new Date(item.start).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Text>
        </TouchableOpacity>)}</View>
        <Text style={styles.heading}>Lý do đổi lịch</Text>
        <TextInput value={reason} onChangeText={setReason} multiline placeholder="Cho cơ sở biết lý do" style={styles.input} />
        <TouchableOpacity disabled={!slot || !reason.trim() || submitting} onPress={() => void submit()} style={[styles.submit, (!slot || !reason.trim() || submitting) && styles.disabled]}>
          <Text style={styles.submitText}>{submitting ? 'Đang gửi...' : 'GỬI YÊU CẦU'}</Text>
        </TouchableOpacity>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.card },
  content: { padding: 20, gap: 16 },
  link: { color: colors.primary, fontSize: 16 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textDark },
  note: { color: colors.textGray, lineHeight: 21 },
  heading: { fontSize: 17, fontWeight: '700', color: colors.textDark },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  selected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { color: colors.textDark },
  input: { minHeight: 90, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  error: { color: colors.discountRed },
  submit: { alignItems: 'center', backgroundColor: colors.primary, padding: 16, borderRadius: 12 },
  disabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '800' },
});
