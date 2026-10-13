import React, { useEffect } from 'react';
import { BackHandler, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { HomeStackParamList } from '../navigation/HomeStack';
import { colors, elevation, fw, layout, radius, space, tones, type } from '../theme';
import { formatCurrency } from '../data/catalogModels';
import { useBookings } from '../context/BookingsContext';
import { editorial } from '../components/editorialArt';

type Props = NativeStackScreenProps<HomeStackParamList, 'BookingSuccess'>;

export default function BookingSuccessScreen({ route, navigation }: Props) {
  const { getBooking } = useBookings();
  const booking = getBooking(route.params.bookingId);
  // Leaving this screen always returns the discovery tab to Home. popToTop is not enough: when the venue was opened
  // from Search or Favourites, the venue screen (not Home) is the first route of this stack.
  const goHome = () => navigation.reset({ index: 0, routes: [{ name: 'HomeMain' }] });
  // The request is already sent: Android back must not reopen the finished form underneath.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) return false;
      goHome();
      return true;
    });
    return () => subscription.remove();
  }, [navigation]);
  const openAppointments = () => { navigation.getParent()?.navigate('LichHen'); goHome(); };

  if (!booking) {
    return (
      <SafeAreaView style={[styles.screen, styles.notFound]}>
        <Ionicons name="calendar-outline" size={32} color={colors.primary} />
        <Text style={styles.notFoundText}>Chưa tải được thông tin lịch hẹn này.</Text>
        <TouchableOpacity style={styles.primaryButton} accessibilityRole="button" onPress={openAppointments}>
          <Text style={styles.primaryButtonText}>Xem lịch hẹn của tôi</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const pending = booking.rawStatus === 'PENDING';
  const confirmed = booking.rawStatus === 'CONFIRMED';
  const tone = pending ? tones.warning : confirmed ? tones.success : tones.info;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={editorial.planning} accessible={false} style={styles.heroImage} resizeMode="cover" />
          <LinearGradient pointerEvents="none" colors={['rgba(58,20,70,0.45)', 'rgba(58,20,70,0.9)']} style={styles.heroVeil} />
        </View>
        <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
          <Ionicons name={pending ? 'time-outline' : confirmed ? 'checkmark-circle-outline' : 'calendar-outline'} size={44} color={tone.fg} />
        </View>
        <View style={styles.body}>
          <Text accessibilityRole="header" style={styles.title}>{pending ? 'Đã gửi yêu cầu đặt lịch' : confirmed ? 'Lịch hẹn đã được xác nhận' : 'Lịch hẹn đã được ghi nhận'}</Text>
          <Text style={styles.subtitle}>{pending ? 'Cơ sở cần xác nhận lịch này. Bạn có thể theo dõi trạng thái trong Lịch hẹn.' : confirmed ? 'Lịch hẹn đã được xác nhận. Hẹn gặp bạn tại cơ sở.' : 'Hãy kiểm tra trạng thái mới nhất trong Lịch hẹn.'}</Text>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.dateBlock}>
                <Text style={styles.dateDay}>{booking.date}</Text>
                <Text style={styles.dateTime}>{booking.time}</Text>
              </View>
              {!!booking.bookingCode && <View style={styles.codeRow}>
                <Text selectable style={styles.code}>Mã lịch: {booking.bookingCode}</Text>
              </View>}
            </View>
            <Row icon="storefront-outline"><Text style={styles.rowStrong}>{booking.shopName}</Text></Row>
            <Row icon="location-outline"><Text style={styles.rowText}>{booking.address}</Text></Row>
            <Row icon="person-outline"><Text style={styles.rowText}>Chuyên viên: {booking.staffName}</Text></Row>
            <View style={styles.divider} />
            <Text style={styles.serviceName}>{booking.serviceName}</Text>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tổng tiền dự kiến</Text>
              <Text style={styles.totalPrice}>{formatCurrency(booking.totalPrice)}</Text>
            </View>
          </View>

          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.primaryButton} accessibilityRole="button" onPress={openAppointments}>
              <Text style={styles.primaryButtonText}>Xem lịch hẹn của tôi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} accessibilityRole="button" onPress={goHome}>
              <Text style={styles.secondaryButtonText}>Về trang khám phá</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
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
  content: { flexGrow: 1, paddingBottom: space.xxl },
  hero: { height: 196, backgroundColor: colors.secondary, borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet, overflow: 'hidden' },
  heroImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  heroVeil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  iconWrap: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: -48, borderWidth: 5, borderColor: colors.background, ...elevation.card },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: layout.gutter + space.xs, paddingTop: space.lg },
  title: { ...type.h1, textAlign: 'center', marginBottom: space.sm },
  subtitle: { ...type.body, color: colors.secondaryText, textAlign: 'center', marginBottom: space.xl, maxWidth: 340 },
  card: { width: '100%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
  dateBlock: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, backgroundColor: colors.secondary, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  dateDay: { ...type.secondaryStrong, color: colors.secondarySoft, fontVariant: ['tabular-nums'] },
  dateTime: { ...type.clock, color: colors.white },
  codeRow: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs },
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
  secondaryButtonText: { ...type.button, ...fw.semibold, color: colors.primary },
});
