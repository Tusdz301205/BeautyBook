import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { HoatDongStackParamList } from '../navigation/HoatDongStack';
import { RootTabParamList } from '../navigation/RootTabs';
import { colors } from '../constants/colors';
import { formatCurrency } from '../data/catalogModels';
import { bookingStatusMeta } from '../data/appointments';
import { useBookings } from '../context/BookingsContext';
import WriteReviewSheet from '../components/WriteReviewSheet';
import { reviewsApi } from '../api/reviews';
import { platformSettingsApi } from '../api/platformSettings';

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
  const { cancelBooking, requestCancellation, getBooking, reload } = useBookings();
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
            : currentStatus === 'completed'
              ? ['Lịch hẹn đã hoàn thành. Bạn có thể đánh giá trải nghiệm của mình.']
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

  const handleSubmitReview = async (score: number, text: string) => {
    setSubmittingReview(true);
    try {
      await reviewsApi.create({
        bookingId: id,
        overallRating: score,
        comment: text || undefined,
        serviceRatings: booking?.bookingServices.map((item) => ({
          bookingServiceId: item.id,
          staffId: item.staffId,
          rating: score,
        })),
      });
      setReviewVisible(false);
      await reload();
      Alert.alert('Đã gửi đánh giá', 'Cảm ơn bạn đã chia sẻ trải nghiệm.');
    } catch (reason) {
      Alert.alert('Không thể gửi đánh giá', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết lịch hẹn</Text>
        <View style={styles.backButton} />
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {imageUri ? (
          <View style={styles.imageWrap}>
            <Image source={{ uri: imageUri }} style={styles.image} />
            <View style={[styles.statusBadge, styles.statusBadgeFloating, { backgroundColor: meta.background }]}>
              <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.statusBadge, { backgroundColor: meta.background }]}>
            <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        )}

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{currentTitle}</Text>
          <Text style={styles.bookingCode}>Mã đặt lịch #{bookingCode}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="storefront-outline" size={18} color={colors.textGray} />
            <Text style={styles.rowText}>{currentShopName}</Text>
          </View>
          {!!currentStaffName && (
            <View style={styles.row}>
              <Ionicons name="person-outline" size={18} color={colors.textGray} />
              <Text style={styles.rowText}>{currentStaffName}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Ionicons name="location-outline" size={18} color={colors.textGray} />
            <Text style={styles.rowText} numberOfLines={2}>
              {currentAddress}
            </Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="calendar-outline" size={18} color={colors.textGray} />
            <Text style={styles.rowText}>
              {currentDate} • {currentTime}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.priceLabel}>Tổng tiền</Text>
            <Text style={styles.priceValue}>{formatCurrency(currentPrice)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.outlineButton}
          activeOpacity={0.7}
          onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentAddress)}`)}
        >
          <Text style={styles.outlineButtonText}>Chỉ đường</Text>
        </TouchableOpacity>

        {comboId && (
          <TouchableOpacity
            style={currentStatus === 'completed' ? styles.primaryButton : styles.outlineButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('DiaDiem', { screen: 'ComboDetail', params: { comboId } })}
          >
            <Text style={currentStatus === 'completed' ? styles.primaryButtonText : styles.outlineButtonText}>
              {currentStatus === 'completed' ? 'Đặt lại dịch vụ này' : 'Xem ưu đãi'}
            </Text>
          </TouchableOpacity>
        )}

        {isReal && currentStatus === 'completed' && !booking?.reviewed && (
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={() => setReviewVisible(true)}>
            <Text style={styles.primaryButtonText}>VIẾT ĐÁNH GIÁ</Text>
          </TouchableOpacity>
        )}

        {isReal && currentStatus === 'completed' && booking?.reviewed && (
          <View style={styles.reviewedNotice}>
            <Ionicons name="checkmark-circle" size={18} color={colors.ratingGreen} />
            <Text style={styles.reviewedText}>Bạn đã đánh giá lịch hẹn này.</Text>
          </View>
        )}

        {canChange && allowReschedule && hoursUntilAppointment >= 1 && (
          <TouchableOpacity style={styles.outlineButton} onPress={() => navigation.navigate('Reschedule', { bookingId: id })}>
            <Text style={styles.outlineButtonText}>YÊU CẦU ĐỔI LỊCH</Text>
          </TouchableOpacity>
        )}

        {canChange && !requiresCancellationRequest && (
          <TouchableOpacity style={styles.cancelButton} activeOpacity={0.7} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>HỦY NGAY</Text>
          </TouchableOpacity>
        )}

        {canChange && requiresCancellationRequest && (
          <TouchableOpacity style={styles.cancelButton} activeOpacity={0.7} onPress={handleCancellationRequest}>
            <Text style={styles.cancelButtonText}>GỬI YÊU CẦU HỦY SÁT GIỜ</Text>
          </TouchableOpacity>
        )}

        {isReal && currentStatus === 'upcoming' && booking?.hasPendingCancellationRequest && (
          <View style={styles.pendingRequestNotice}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Text style={styles.pendingRequestText}>
              Yêu cầu hủy đang chờ cơ sở xử lý
              {booking.cancellationRequestExpiresAt
                ? ` đến ${new Date(booking.cancellationRequestExpiresAt).toLocaleString('vi-VN')}`
                : ''}.
              {' '}Yêu cầu gửi trước giờ hẹn vẫn có hiệu lực trong thời hạn này.
            </Text>
          </View>
        )}

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Lưu ý</Text>
          {notes.map((note) => (
            <View key={note} style={styles.noteRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={styles.noteText}>{note}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <WriteReviewSheet
        visible={isReviewVisible}
        onClose={() => setReviewVisible(false)}
        onSubmit={handleSubmitReview}
        isSubmitting={isSubmittingReview}
        minLength={reviewMinLength}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 16,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  imageWrap: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 170,
    borderRadius: 18,
    backgroundColor: colors.background,
  },
  statusBadgeFloating: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  titleBlock: {
    gap: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.textDark,
  },
  bookingCode: {
    fontSize: 13,
    color: colors.textGray,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    color: colors.textBody,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  originalPriceLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  originalPriceValue: {
    fontSize: 14,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  priceLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  priceValue: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.primary,
  },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  cancelButton: {
    borderWidth: 1.5,
    borderColor: colors.discountRed,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.discountRed,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  reviewedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.background,
    paddingVertical: 14,
  },
  reviewedText: {
    color: colors.ratingGreen,
    fontSize: 14,
    fontWeight: '700',
  },
  pendingRequestNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  pendingRequestText: {
    flex: 1,
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  noteCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 18,
    gap: 10,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textDark,
    marginBottom: 2,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: colors.textBody,
    lineHeight: 19,
  },
});
