import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { HoatDongStackParamList } from '../navigation/HoatDongStack';
import { RootTabParamList } from '../navigation/RootTabs';
import { colors, fw, layout, radius, space, tones, type } from '../theme';
import { formatCurrency } from '../data/catalogModels';
import { bookingStatusMeta } from '../data/appointments';
import { useBookings } from '../context/BookingsContext';
import WriteReviewSheet from '../components/WriteReviewSheet';
import { reviewsApi } from '../api/reviews';
import { platformSettingsApi } from '../api/platformSettings';
import { serviceTimingLines } from '../utils/bookingTiming';
import { useOperationalTime } from '../hooks/useOperationalTime';
import { operationalTimeLabel } from '../utils/bookingOperationalTime';
import { buildReviewInput, type ServiceReviewDrafts } from '../utils/reviewForm';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HoatDongStackParamList, 'AppointmentDetail'>,
  BottomTabScreenProps<RootTabParamList>
>;

const DEFAULT_NOTES = [
  'Vui lòng đến trước giờ hẹn khoảng 10 phút để chuẩn bị.',
  'Vui lòng cung cấp mã đặt lịch cho nhân viên khi đến nơi.',
];

const FALLBACK_CANCELLATION_HOURS = 4;

export default function AppointmentDetailScreen({ route, navigation }: Props) {
  const { id, isReal, shopName, address, title, staffName, imageUri, date, time, price, status, comboId } =
    route.params;
  const { cancelBooking, requestCancellation, getBooking, reload, isLoading, error } = useBookings();
  const booking = getBooking(id);
  const currentStatus = booking?.status ?? status;
  const currentShopName = booking?.shopName ?? shopName;
  const currentAddress = booking?.address ?? address;
  const currentTitle = booking?.serviceName ?? title;
  const currentStaffName = booking?.staffName ?? staffName;
  const currentDate = booking?.date ?? date;
  const currentTime = booking?.time ?? time;
  const currentPrice = booking?.totalPrice ?? price;
  const [isReviewVisible, setReviewVisible] = useState(false);
  const [isSubmittingReview, setSubmittingReview] = useState(false);
  const [freeCancellationHours, setFreeCancellationHours] = useState(FALLBACK_CANCELLATION_HOURS);
  const [allowReschedule, setAllowReschedule] = useState(false);
  const [reviewMinLength, setReviewMinLength] = useState(0);
  const rawStatus = booking?.rawStatus;
  const operationalNow = useOperationalTime(booking?.serverNow, !isLoading && !error);
  const canReview = isReal && !isLoading && !error && booking?.canReview === true && !booking.reviewed &&
    (rawStatus === 'COMPLETED' || (rawStatus === 'CHECKED_IN' && currentStatus === 'completed'));
  const meta = bookingStatusMeta(currentStatus, rawStatus);

  useFocusEffect(useCallback(() => {
    if (isReal) void reload();
  }, [isReal, reload]));
  const bookingCode = booking?.bookingCode || id;
  const policyNote = `Có thể tự hủy khi còn ít nhất ${freeCancellationHours} giờ trước giờ hẹn. Sau mốc này cần gửi yêu cầu để cơ sở duyệt.`;
  const notes = rawStatus === 'PENDING'
    ? ['Cơ sở chưa xác nhận lịch này. Hãy theo dõi trạng thái trước khi đến.', policyNote]
    : rawStatus === 'EXPIRED'
      ? ['Yêu cầu đặt lịch đã hết hạn xác nhận và không còn hiệu lực. Bạn có thể tạo lịch mới.']
      : rawStatus === 'REJECTED'
        ? ['Cơ sở đã từ chối yêu cầu đặt lịch này. Bạn có thể chọn lịch khác.']
        : rawStatus === 'NO_SHOW'
          ? ['Lịch hẹn được ghi nhận là không đến.']
          : rawStatus === 'CANCELLED'
            ? ['Lịch hẹn đã hủy. Bạn có thể đặt lịch mới nếu cần.']
            : rawStatus === 'CHECKED_IN' && currentStatus === 'completed'
              ? ['Cơ sở đã ghi nhận bạn đến; lịch dự kiến đã qua. Các mốc thực tế được hiển thị theo dữ liệu đã ghi nhận.']
            : rawStatus === 'COMPLETED'
              ? ['Lịch hẹn đã hoàn thành. Bạn có thể đánh giá trải nghiệm của mình.']
              : rawStatus === 'CHECKED_IN'
                ? ['Cơ sở đã ghi nhận bạn đến. Vui lòng chờ chuyên viên tiếp nhận.']
                : rawStatus === 'IN_PROGRESS'
                  ? ['Dịch vụ đang được thực hiện. Bạn có thể theo dõi thời gian thực tế bên dưới.']
                  : [...DEFAULT_NOTES, policyNote];
  const hoursUntilAppointment = booking
    ? (new Date(booking.appointmentStartAt).getTime() - Date.now()) / 3_600_000
    : Number.POSITIVE_INFINITY;
  const requiresCancellationRequest = hoursUntilAppointment < freeCancellationHours;
  const canChange = isReal && booking && ['PENDING', 'CONFIRMED'].includes(booking.rawStatus || '') && hoursUntilAppointment > 0 && !booking.hasPendingCancellationRequest;

  useEffect(() => {
    let active = true;
    platformSettingsApi.publicPolicy()
      .then((policy) => {
        if (active && Number.isFinite(policy.freeCancellationHours)) {
          setFreeCancellationHours(policy.freeCancellationHours);
          setAllowReschedule(policy.allowRescheduleRequests);
          setReviewMinLength(policy.reviewMinLength || 0);
        }
      })
      .catch(() => {
        // Keep the backend-aligned fallback if public policy is temporarily unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  const handleCancel = () => {
    Alert.alert('Hủy lịch hẹn', 'Bạn có chắc muốn hủy lịch hẹn này không?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy lịch hẹn',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelBooking(id);
            navigation.goBack();
          } catch (reason) {
            Alert.alert('Không thể hủy lịch', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
          }
        },
      },
    ]);
  };

  const handleCancellationRequest = () => {
    Alert.alert(
      'Gửi yêu cầu hủy sát giờ',
      `Lịch hẹn còn dưới ${freeCancellationHours} giờ nên cơ sở cần duyệt yêu cầu hủy của bạn.`,
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Gửi yêu cầu',
          onPress: async () => {
            try {
              await requestCancellation(id);
              Alert.alert('Đã gửi yêu cầu', 'Cơ sở sẽ xem xét và phản hồi yêu cầu hủy của bạn.');
            } catch (reason) {
              Alert.alert(
                'Không thể gửi yêu cầu',
                reason instanceof Error ? reason.message : 'Vui lòng thử lại.',
              );
            }
          },
        },
      ],
    );
  };

  const handleSubmitReview = async (score: number, text: string, serviceReviews: ServiceReviewDrafts) => {
    if (!canReview || isSubmittingReview) return;
    const input = buildReviewInput(id, score, text, booking.bookingServices, serviceReviews, reviewMinLength);
    if (!input) return;
    setSubmittingReview(true);
    try {
      await reviewsApi.create(input);
      setReviewVisible(false);
      await reload();
      Alert.alert('Đã gửi đánh giá', 'Cảm ơn bạn đã chia sẻ trải nghiệm.');
    } catch (reason) {
      Alert.alert('Không thể gửi đánh giá', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Route summaries belong to the account that opened them. Never resurrect a
  // real booking from route params after logout, deletion or access revocation.
  if (!booking) return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Quay lại" style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.heading} />
        </TouchableOpacity>
      </View>
      <View style={styles.missing}>
        <Ionicons name={isLoading ? 'hourglass-outline' : 'calendar-clear-outline'} size={30} color={colors.primary} />
        <Text style={styles.missingText}>{isLoading ? 'Đang tải lịch hẹn...' : error || 'Lịch hẹn không còn khả dụng cho tài khoản này.'}</Text>
      </View>
    </SafeAreaView>
  );

  const tone = tones[meta.tone ?? 'neutral'] ?? tones.neutral;
  const openMaps = () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentAddress)}`);

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Quay lại" style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.heading} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={styles.headerTitle}>Chi tiết lịch hẹn</Text>
        <View style={styles.iconButton} />
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.statusBlock}>
          <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
            <Ionicons name={(meta.icon ?? 'information-circle-outline') as keyof typeof Ionicons.glyphMap} size={16} color={tone.fg} />
            <Text style={[styles.statusBadgeText, { color: tone.fg }]}>{meta.label}</Text>
          </View>
          <Text style={styles.title}>{currentTitle}</Text>
          <Text selectable style={styles.bookingCode}>Mã đặt lịch #{bookingCode}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}><Ionicons name="calendar-outline" size={18} color={colors.secondaryText} /><Text style={styles.rowStrong}>{currentDate} · {currentTime}</Text></View>
          <View style={styles.row}><Ionicons name="storefront-outline" size={18} color={colors.secondaryText} /><Text style={styles.rowText}>{currentShopName}</Text></View>
          <View style={styles.row}><Ionicons name="location-outline" size={18} color={colors.secondaryText} /><Text style={styles.rowText}>{currentAddress}</Text></View>
          {!!currentStaffName && <View style={styles.row}><Ionicons name="person-outline" size={18} color={colors.secondaryText} /><Text style={styles.rowText}>Chuyên viên: {currentStaffName}</Text></View>}
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.priceLabel}>Tổng tiền</Text>
            <Text style={styles.priceValue}>{formatCurrency(currentPrice)}</Text>
          </View>
        </View>

        <Text accessibilityRole="header" style={styles.sectionTitle}>Tiến trình dịch vụ</Text>
        {booking.bookingServices.map(item => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.rowStrong}>{item.serviceName}</Text>
            {!!item.staffName && <Text style={styles.metaText}>Chuyên viên: {item.staffName}</Text>}
            {operationalTimeLabel(item, rawStatus ?? '', operationalNow) && <View style={styles.warningRow}>
              <Ionicons name="warning-outline" size={18} color={tones.warning.fg} />
              <Text style={styles.warningText}>
                {item.status === 'IN_PROGRESS' ? 'Thời gian phục vụ đang vượt giờ dự kiến.' : 'Giờ dự kiến đã đến. Bạn có thể liên hệ cơ sở để được hỗ trợ.'}
              </Text>
            </View>}
            {serviceTimingLines(item, booking.branchTimezone).map(line => (
              <Text key={line} style={styles.metaText}>{line}</Text>
            ))}
          </View>
        ))}

        {isReal && currentStatus === 'upcoming' && booking?.hasPendingCancellationRequest && (
          <View style={[styles.notice, { backgroundColor: tones.request.bg, borderColor: tones.request.border }]}>
            <Ionicons name="time-outline" size={18} color={tones.request.fg} />
            <Text style={[styles.noticeText, { color: tones.request.fg }]}>
              Yêu cầu hủy đang chờ cơ sở xử lý
              {booking.cancellationRequestExpiresAt ? ` đến ${new Date(booking.cancellationRequestExpiresAt).toLocaleString('vi-VN')}` : ''}.
              {' '}Yêu cầu gửi trước giờ hẹn vẫn có hiệu lực trong thời hạn này.
            </Text>
          </View>
        )}

        {isReal && currentStatus === 'completed' && booking?.reviewed && (
          <View style={[styles.notice, { backgroundColor: tones.success.bg, borderColor: tones.success.border }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={tones.success.fg} />
            <Text style={[styles.noticeText, { color: tones.success.fg }]}>Bạn đã đánh giá lịch hẹn này.</Text>
          </View>
        )}

        <View style={styles.actions}>
          {canReview && (
            <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => setReviewVisible(true)}>
              <Ionicons name="star-outline" size={20} color={colors.onPrimary} />
              <Text style={styles.primaryButtonText}>Viết đánh giá</Text>
            </TouchableOpacity>
          )}
          {isReal && booking && currentStatus !== 'upcoming' && (
            <TouchableOpacity accessibilityRole="button" style={canReview ? styles.outlineButton : styles.primaryButton} onPress={() => {
              if (!booking.branchId) { Alert.alert('Chọn lại cơ sở', 'Lịch cũ không còn thông tin cơ sở. Hãy tìm dịch vụ để đặt lịch mới.'); navigation.navigate('TimKiem'); return; }
              navigation.navigate('DiaDiem', { screen: 'VenueDetail', params: { venueId: booking.branchId, serviceIds: booking.serviceIds, rebooking: true } });
            }}>
              <Ionicons name="refresh-outline" size={20} color={canReview ? colors.primary : colors.onPrimary} />
              <Text style={canReview ? styles.outlineButtonText : styles.primaryButtonText}>Đặt lại dịch vụ</Text>
            </TouchableOpacity>
          )}
          {canChange && allowReschedule && hoursUntilAppointment >= 1 && (
            <TouchableOpacity accessibilityRole="button" accessibilityHint="Lịch hiện tại giữ nguyên tới khi cơ sở duyệt" style={styles.outlineButton} onPress={() => navigation.navigate('Reschedule', { bookingId: id })}>
              <Ionicons name="swap-horizontal-outline" size={20} color={colors.primary} />
              <Text style={styles.outlineButtonText}>Yêu cầu đổi lịch</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity accessibilityRole="button" style={styles.outlineButton} onPress={openMaps}>
            <Ionicons name="navigate-outline" size={20} color={colors.primary} />
            <Text style={styles.outlineButtonText}>Chỉ đường</Text>
          </TouchableOpacity>
          {comboId && currentStatus === 'upcoming' && (
            <TouchableOpacity accessibilityRole="button" style={styles.outlineButton} onPress={() => navigation.navigate('DiaDiem', { screen: 'ComboDetail', params: { comboId } })}>
              <Ionicons name="gift-outline" size={20} color={colors.primary} />
              <Text style={styles.outlineButtonText}>Xem gói dịch vụ</Text>
            </TouchableOpacity>
          )}
          {canChange && !requiresCancellationRequest && (
            <TouchableOpacity accessibilityRole="button" style={styles.dangerButton} onPress={handleCancel}>
              <Text style={styles.dangerButtonText}>Hủy lịch hẹn</Text>
            </TouchableOpacity>
          )}
          {canChange && requiresCancellationRequest && (
            <TouchableOpacity accessibilityRole="button" accessibilityHint="Cơ sở cần duyệt yêu cầu hủy sát giờ" style={styles.dangerButton} onPress={handleCancellationRequest}>
              <Text style={styles.dangerButtonText}>Gửi yêu cầu hủy sát giờ</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.noteCard}>
          <Text accessibilityRole="header" style={styles.noteTitle}>Lưu ý</Text>
          {notes.map((note) => (
            <View key={note} style={styles.noteRow}>
              <Ionicons name="information-circle-outline" size={18} color={colors.secondary} />
              <Text style={styles.noteText}>{note}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <WriteReviewSheet key={id} services={booking.bookingServices} visible={isReviewVisible && canReview} onClose={() => setReviewVisible(false)} onSubmit={handleSubmitReview} isSubmitting={isSubmittingReview} minLength={reviewMinLength} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs, paddingBottom: space.xs, backgroundColor: colors.background },
  iconButton: { width: layout.touch, height: layout.touch, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...type.h3, ...fw.display, fontSize: 19, flex: 1, textAlign: 'center' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xxl },
  missingText: { ...type.body, textAlign: 'center' },
  content: { paddingHorizontal: layout.gutter, paddingTop: space.sm, paddingBottom: space.xxxl, gap: space.md },
  statusBlock: { gap: space.sm, marginBottom: space.xs },
  statusBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
  statusBadgeText: { ...type.secondaryStrong },
  title: { ...type.h1 },
  bookingCode: { ...type.secondary, fontVariant: ['tabular-nums'] },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  rowText: { ...type.body, flex: 1 },
  rowStrong: { ...type.bodyStrong, flex: 1 },
  metaText: { ...type.secondary },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: space.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  priceLabel: { ...type.secondary },
  priceValue: { ...type.price, fontSize: 18, color: colors.primary },
  sectionTitle: { ...type.h3, marginTop: space.sm },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, backgroundColor: tones.warning.bg, borderRadius: radius.md, padding: space.md },
  warningText: { ...type.secondaryStrong, color: tones.warning.fg, flex: 1 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, borderRadius: radius.md, borderWidth: 1, padding: space.md },
  noticeText: { ...type.secondaryStrong, flex: 1 },
  actions: { gap: space.sm, marginTop: space.xs },
  primaryButton: { minHeight: layout.buttonMinHeight, flexDirection: 'row', gap: space.sm, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  primaryButtonText: { ...type.button, color: colors.onPrimary },
  outlineButton: { minHeight: layout.buttonMinHeight, flexDirection: 'row', gap: space.sm, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  outlineButtonText: { ...type.button, color: colors.primary },
  dangerButton: { minHeight: layout.buttonMinHeight, borderWidth: 1.5, borderColor: colors.error, backgroundColor: colors.surface, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg, marginTop: space.sm },
  dangerButtonText: { ...type.button, color: colors.error },
  noteCard: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: space.lg, gap: space.sm, marginTop: space.sm },
  noteTitle: { ...type.secondaryStrong, color: colors.heading },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  noteText: { ...type.secondary, color: colors.body, flex: 1 },
});
