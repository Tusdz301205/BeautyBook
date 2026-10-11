import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { HomeStackParamList } from '../navigation/HomeStack';
import { colors, layout, radius, space, tones, type } from '../theme';
import { formatCurrency } from '../data/catalogModels';
import { useBookings } from '../context/BookingsContext';

type Props = NativeStackScreenProps<HomeStackParamList, 'BookingSuccess'>;

export default function BookingSuccessScreen({ route, navigation }: Props) {
  const { getBooking } = useBookings();
  const booking = getBooking(route.params.bookingId);

  if (!booking) {
    return (
      <SafeAreaView style={[styles.screen, styles.notFound]}>
        <Ionicons name="calendar-outline" size={32} color={colors.primary} />
        <Text style={styles.notFoundText}>Chưa tải được thông tin lịch hẹn này.</Text>
        <TouchableOpacity style={styles.primaryButton} accessibilityRole="button" onPress={() => navigation.getParent()?.navigate('LichHen')}>
          <Text style={styles.primaryButtonText}>Xem lịch hẹn của tôi</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const pending = booking.rawStatus === 'PENDING';
  const confirmed = booking.rawStatus === 'CONFIRMED';
  const tone = pending ? tones.warning : confirmed ? tones.success : tones.info;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
          <Ionicons name={pending ? 'time-outline' : confirmed ? 'checkmark-circle-outline' : 'calendar-outline'} size={44} color={tone.fg} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>{pending ? 'Đã gửi yêu cầu đặt lịch' : confirmed ? 'Lịch hẹn đã được xác nhận' : 'Lịch hẹn đã được ghi nhận'}</Text>
        <Text style={styles.subtitle}>{pending ? 'Cơ sở cần xác nhận lịch này. Bạn có thể theo dõi trạng thái trong Lịch hẹn.' : confirmed ? 'Lịch hẹn đã được xác nhận. Hẹn gặp bạn tại cơ sở.' : 'Hãy kiểm tra trạng thái mới nhất trong Lịch hẹn.'}</Text>

        <View style={styles.card}>
          {!!booking.bookingCode && <View style={styles.codeRow}>
            <Text selectable style={styles.code}>Mã lịch: {booking.bookingCode}</Text>
          </View>}
          <Row icon="storefront-outline"><Text style={styles.rowStrong}>{booking.shopName}</Text></Row>
          <Row icon="location-outline"><Text style={styles.rowText}>{booking.address}</Text></Row>
          <Row icon="calendar-outline"><Text style={styles.rowText}>{booking.date} · {booking.time}</Text></Row>
          <Row icon="person-outline"><Text style={styles.rowText}>Chuyên viên: {booking.staffName}</Text></Row>
          <View style={styles.divider} />
          <Text style={styles.serviceName}>{booking.serviceName}</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng tiền dự kiến</Text>
            <Text style={styles.totalPrice}>{formatCurrency(booking.totalPrice)}</Text>
          </View>
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.primaryButton} accessibilityRole="button" onPress={() => navigation.getParent()?.navigate('LichHen')}>
            <Text style={styles.primaryButtonText}>Xem lịch hẹn của tôi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} accessibilityRole="button" onPress={() => navigation.popToTop()}>
            <Text style={styles.secondaryButtonText}>Về trang khám phá</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return <View style={styles.row}><Ionicons name={icon} size={18} color={colors.secondaryText} style={styles.rowIcon} /><View style={styles.flex}>{children}</View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  notFound: { alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xxl },
  notFoundText: { ...type.body, textAlign: 'center' },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: layout.gutter + space.xs, paddingTop: space.huge, paddingBottom: space.xxl },
  iconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: space.xl },
  title: { ...type.h1, textAlign: 'center', marginBottom: space.sm },
  subtitle: { ...type.body, color: colors.secondaryText, textAlign: 'center', marginBottom: space.xxl, maxWidth: 340 },
  card: { width: '100%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  codeRow: { alignSelf: 'flex-start', backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs },
  code: { ...type.secondaryStrong, color: colors.heading, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  rowIcon: { marginTop: 2 },
  rowStrong: { ...type.bodyStrong },
  rowText: { ...type.body },
  divider: { height: 1, backgroundColor: colors.divider },
  serviceName: { ...type.bodyStrong },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  totalLabel: { ...type.secondary },
  totalPrice: { ...type.price, fontSize: 18, color: colors.primary },
  buttonGroup: { width: '100%', marginTop: 'auto', paddingTop: space.xxl, gap: space.md },
  primaryButton: { minHeight: layout.buttonMinHeight, alignSelf: 'stretch', backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  primaryButtonText: { ...type.button, color: colors.onPrimary },
  secondaryButton: { minHeight: layout.buttonMinHeight, borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  secondaryButtonText: { ...type.button, color: colors.primary },
});
