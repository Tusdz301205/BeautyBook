import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootTabParamList } from '../navigation/RootTabs';
import { RootStackParamList } from '../navigation/RootStack';
import { AccountStackParamList } from '../navigation/AccountStack';
import { TAB_BAR_CLEARANCE } from '../navigation/CustomTabBar';
import { colors, fonts, fw, layout, radius, space, tones, type, type Tone } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useBookings } from '../context/BookingsContext';
import { useFavorites } from '../context/FavoritesContext';
import { getInitials } from '../utils/hash';
import { editorial } from '../components/editorialArt';
import { AppButton, BrandGradient, Card, ListRow, LoadingState, StatusBarShade, useStatusBarShade } from '../ui';

type Props = CompositeScreenProps<
  NativeStackScreenProps<AccountStackParamList, 'AccountMain'>,
  CompositeScreenProps<BottomTabScreenProps<RootTabParamList, 'TaiKhoan'>, NativeStackScreenProps<RootStackParamList>>
>;

export default function AccountScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, userName, logout, isLoggedIn, isRestoring } = useAuth();
  const { openLanguageSheet } = useLanguage();
  const { bookings } = useBookings();
  const { savedItems } = useFavorites();
  const guestShade = useStatusBarShade(150);
  const shade = useStatusBarShade(96);

  if (isRestoring) return <View style={styles.screen}><LoadingState message="Đang khôi phục phiên đăng nhập…" /></View>;

  if (!isLoggedIn) return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.guestScroll} showsVerticalScrollIndicator={false} onScroll={guestShade.onScroll} scrollEventThrottle={16}>
        <View style={[styles.guestHero, { paddingTop: insets.top + space.xl }]}>
          <Image source={editorial.invitation} accessible={false} style={styles.guestImage} resizeMode="cover" />
          <LinearGradient pointerEvents="none" colors={['rgba(58,20,70,0.62)', 'rgba(58,20,70,0.96)']} style={styles.guestVeil} />
          <Text style={styles.guestEyebrow}>BeautyBook</Text>
          <Text accessibilityRole="header" style={styles.guestTitle}>Chăm sóc mình, theo cách của mình.</Text>
          <Text style={styles.guestCopy}>Đăng nhập để theo dõi lịch hẹn, lưu dịch vụ yêu thích và cập nhật hồ sơ.</Text>
        </View>
        <View style={styles.guestBody}>
          <AppButton label="Đăng nhập" onPress={() => navigation.navigate('Login', { returnTo: 'account' })} />
          <AppButton variant="outline" label="Tạo tài khoản khách hàng" onPress={() => navigation.navigate('Register', { returnTo: 'account' })} />
          <Text style={styles.guestHint}>Bạn vẫn có thể khám phá dịch vụ mà chưa cần đăng nhập. Đăng ký doanh nghiệp thực hiện trên phiên bản web.</Text>
          <Card padded={false}>
            <ListRow icon="help-circle-outline" label="Trung tâm hỗ trợ" onPress={() => navigation.navigate('Support')} />
          </Card>
        </View>
      </ScrollView>
      <StatusBarShade visible={guestShade.shaded} />
    </View>
  );

  // Counts come from data already loaded for this account; no extra claims.
  const upcoming = bookings.filter((item) => item.status === 'upcoming').length;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} onScroll={shade.onScroll} scrollEventThrottle={16}>
        <BrandGradient decor style={[styles.hero, { paddingTop: insets.top + space.lg }]}>
          <Text accessibilityRole="header" style={styles.heroTitle}>Tài khoản</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`${userName}. Xem và sửa hồ sơ`} onPress={() => navigation.navigate('Profile')} style={({ pressed }) => [styles.profile, pressed && { opacity: 0.9 }]}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(userName)}</Text></View>
            <View style={styles.flex}>
              <Text style={styles.name}>{userName}</Text>
              {user?.email ? <Text style={styles.email} numberOfLines={1}>{user.email}</Text> : null}
            </View>
            <View style={styles.edit}><Ionicons accessible={false} name="create-outline" size={18} color={colors.white} /></View>
          </Pressable>
        </BrandGradient>

        <View style={styles.tiles}>
          <Tile tone="request" icon="calendar" label="Lịch hẹn" value={upcoming ? `${upcoming} sắp tới` : 'Xem lịch'} onPress={() => navigation.navigate('LichHen')} />
          <Tile tone="brand" icon="heart" label="Đã lưu" value={savedItems.length ? `${savedItems.length} dịch vụ` : 'Dịch vụ'} onPress={() => navigation.navigate('Favorites')} />
          <Tile tone="warning" icon="notifications" label="Thông báo" value="Xem tất cả" onPress={() => navigation.navigate('Messages')} />
        </View>

        <View style={styles.body}>
          <Text accessibilityRole="header" style={styles.groupTitle}>Cài đặt và hỗ trợ</Text>
          <Card padded={false}>
            <ListRow icon="person-outline" label="Hồ sơ và địa chỉ" onPress={() => navigation.navigate('Profile')} divider />
            <ListRow icon="settings-outline" label="Cài đặt và bảo mật" onPress={() => navigation.navigate('Settings')} divider />
            <ListRow icon="language-outline" label="Ngôn ngữ" value="Tiếng Việt" onPress={openLanguageSheet} divider />
            <ListRow icon="help-circle-outline" label="Hỗ trợ" onPress={() => navigation.navigate('Support')} />
          </Card>

          <AppButton variant="outline" icon="log-out-outline" label="Đăng xuất" onPress={() => void logout()} style={styles.logout} />
          <Text style={styles.version}>Phiên bản 1.0</Text>
        </View>
      </ScrollView>
      <StatusBarShade visible={shade.shaded} />
    </View>
  );
}

function Tile({ tone, icon, label, value, onPress }: { tone: Tone; icon: keyof typeof Ionicons.glyphMap; label: string; value: string; onPress: () => void }) {
  const palette = tones[tone];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value}`} onPress={onPress} style={({ pressed }) => [styles.tile, { backgroundColor: palette.bg }, pressed && { opacity: 0.85 }]}>
      <View style={[styles.tileIcon, { backgroundColor: colors.surface }]}><Ionicons accessible={false} name={icon} size={20} color={palette.fg} /></View>
      <Text style={[styles.tileLabel, { color: palette.fg }]}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  guestScroll: { flexGrow: 1, paddingBottom: TAB_BAR_CLEARANCE },
  guestHero: { paddingHorizontal: layout.gutter + space.sm, paddingBottom: space.xxxl, borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet, overflow: 'hidden', backgroundColor: colors.secondary },
  guestImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: undefined, height: undefined },
  guestVeil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  guestEyebrow: { ...type.overline, color: colors.accentFill, marginBottom: space.lg },
  guestTitle: { ...type.display, color: colors.white },
  guestCopy: { ...type.body, color: colors.secondarySoft, marginTop: space.md },
  guestBody: { paddingHorizontal: layout.gutter, paddingTop: space.xxl, gap: space.md },
  guestHint: { ...type.secondary, textAlign: 'center', marginVertical: space.sm },
  scroll: { paddingBottom: TAB_BAR_CLEARANCE + space.lg },
  hero: { paddingHorizontal: layout.gutter, paddingBottom: space.xxxl + space.lg, borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet },
  heroTitle: { ...type.h1, color: colors.white, marginBottom: space.lg },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  avatarText: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.secondary },
  name: { ...type.h2, color: colors.white },
  email: { ...type.secondary, color: colors.secondarySoft },
  edit: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: space.sm, paddingHorizontal: layout.gutter, marginTop: -space.xxxl },
  tile: { flex: 1, minHeight: 112, borderRadius: radius.lg, padding: space.md, gap: space.xs, borderWidth: 2, borderColor: colors.surface },
  tileIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  tileLabel: { ...type.secondaryStrong, ...fw.bold },
  tileValue: { ...type.caption, color: colors.body },
  body: { paddingHorizontal: layout.gutter, gap: space.sm },
  groupTitle: { ...type.overline, marginTop: space.xl, marginBottom: space.xs },
  logout: { marginTop: space.xl },
  version: { ...type.caption, textAlign: 'center', marginTop: space.sm },
});
