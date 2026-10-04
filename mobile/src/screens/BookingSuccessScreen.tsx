import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { HomeStackParamList } from '../navigation/HomeStack';
import { colors } from '../constants/colors';
import { formatCurrency } from '../data/catalogModels';
import { useBookings } from '../context/BookingsContext';

type Props = NativeStackScreenProps<HomeStackParamList, 'BookingSuccess'>;

export default function BookingSuccessScreen({ route, navigation }: Props) {
  const { getBooking } = useBookings();
  const booking = getBooking(route.params.bookingId);

  if (!booking) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Chưa tải được thông tin lịch hẹn này.</Text>
        <TouchableOpacity style={styles.notFoundAction} accessibilityRole="button" onPress={() => navigation.getParent()?.navigate('LichHen')}>
          <Text style={styles.notFoundActionText}>Xem lịch hẹn của tôi</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pending = booking.rawStatus === 'PENDING';
  const confirmed = booking.rawStatus === 'CONFIRMED';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <Ionicons name={pending ? 'time-outline' : 'checkmark'} size={48} color={colors.white} />
        </View>
        <Text style={styles.title}>{pending ? 'Đã gửi yêu cầu đặt lịch' : confirmed ? 'Lịch hẹn đã được xác nhận' : 'Lịch hẹn đã được ghi nhận'}</Text>
        <Text style={styles.subtitle}>{pending ? 'Cơ sở cần xác nhận lịch này. Bạn có thể theo dõi trạng thái trong Lịch hẹn.' : confirmed ? 'Lịch hẹn đã được xác nhận. Hẹn gặp bạn tại cơ sở.' : 'Hãy kiểm tra trạng thái mới nhất trong Lịch hẹn.'}</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="storefront-outline" size={18} color={colors.textGray} />
            <Text style={styles.rowText}>{booking.shopName}</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={18} color={colors.textGray} />
            <Text style={styles.rowText} numberOfLines={2}>
              {booking.address}
            </Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="calendar-outline" size={18} color={colors.textGray} />
            <Text style={styles.rowText}>
              {booking.date} • {booking.time}
            </Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="person-outline" size={18} color={colors.textGray} />
            <Text style={styles.rowText}>Chuyên viên: {booking.staffName}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.serviceName}>
              {booking.serviceName}
            </Text>
            <Text style={styles.totalPrice}>{formatCurrency(booking.totalPrice)}</Text>
          </View>
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            accessibilityRole="button"
            onPress={() => navigation.getParent()?.navigate('LichHen')}
          >
            <Text style={styles.primaryButtonText}>Xem lịch hẹn của tôi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.7} accessibilityRole="button" onPress={() => navigation.popToTop()}>
            <Text style={styles.secondaryButtonText}>Về trang chủ</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.card,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  notFoundText: {
    color: colors.textGray,
    fontSize: 15,
    textAlign: 'center',
  },
  notFoundAction: { minHeight: 48, paddingHorizontal: 20, justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 24 },
  notFoundActionText: { color: colors.white, fontWeight: '700' },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    gap: 12,
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
    gap: 10,
  },
  serviceName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  totalPrice: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
  },
  buttonGroup: {
    width: '100%',
    marginTop: 'auto',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textDark,
    fontWeight: '700',
    fontSize: 15,
  },
});
