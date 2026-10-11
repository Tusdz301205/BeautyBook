import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootTabParamList } from '../navigation/RootTabs';
import { RootStackParamList } from '../navigation/RootStack';
import { AccountStackParamList } from '../navigation/AccountStack';
import { TAB_BAR_CLEARANCE } from '../navigation/CustomTabBar';
import { colors, layout, radius, space, type } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getInitials } from '../utils/hash';
import { AppButton, Card, ListRow, LoadingState, ScreenHeader } from '../ui';

type Props = CompositeScreenProps<
  NativeStackScreenProps<AccountStackParamList, 'AccountMain'>,
  CompositeScreenProps<BottomTabScreenProps<RootTabParamList, 'TaiKhoan'>, NativeStackScreenProps<RootStackParamList>>
>;

export default function AccountScreen({ navigation }: Props) {
  const { user, userName, logout, isLoggedIn, isRestoring } = useAuth();
  const { openLanguageSheet } = useLanguage();

  if (isRestoring) return <View style={styles.screen}><LoadingState message="Đang khôi phục phiên đăng nhập…" /></View>;

  if (!isLoggedIn) return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.guestHero}>
        <Text style={styles.guestEyebrow}>BeautyBook</Text>
        <Text accessibilityRole="header" style={styles.guestTitle}>Chăm sóc mình, theo cách của mình.</Text>
        <Text style={styles.guestCopy}>Đăng nhập để theo dõi lịch hẹn, lưu dịch vụ yêu thích và cập nhật hồ sơ.</Text>
      </SafeAreaView>
      <ScrollView contentContainerStyle={styles.guestBody}>
        <AppButton label="Đăng nhập" onPress={() => navigation.navigate('Login', { returnTo: 'account' })} />
        <AppButton variant="outline" label="Tạo tài khoản khách hàng" onPress={() => navigation.navigate('Register', { returnTo: 'account' })} />
        <Text style={styles.guestHint}>Bạn vẫn có thể khám phá dịch vụ mà chưa cần đăng nhập. Đăng ký doanh nghiệp thực hiện trên phiên bản web.</Text>
        <Card padded={false}>
          <ListRow icon="help-circle-outline" label="Trung tâm hỗ trợ" onPress={() => navigation.navigate('Support')} />
        </Card>
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader large title="Tài khoản" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Card onPress={() => navigation.navigate('Profile')} accessibilityLabel={`${userName}. Xem và sửa hồ sơ`} style={styles.profile}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(userName)}</Text></View>
          <View style={styles.flex}>
            <Text style={styles.name}>{userName}</Text>
            {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}
            <Text style={styles.link}>Xem và sửa hồ sơ</Text>
          </View>
        </Card>

        <Text accessibilityRole="header" style={styles.groupTitle}>Hoạt động</Text>
        <Card padded={false}>
          <ListRow icon="calendar-outline" label="Lịch hẹn của tôi" onPress={() => navigation.navigate('LichHen')} divider />
          <ListRow icon="heart-outline" label="Dịch vụ đã lưu" onPress={() => navigation.navigate('Favorites')} divider />
          <ListRow icon="notifications-outline" label="Thông báo" onPress={() => navigation.navigate('Messages')} />
        </Card>

        <Text accessibilityRole="header" style={styles.groupTitle}>Cài đặt và hỗ trợ</Text>
        <Card padded={false}>
          <ListRow icon="settings-outline" label="Cài đặt và bảo mật" onPress={() => navigation.navigate('Settings')} divider />
          <ListRow icon="language-outline" label="Ngôn ngữ" value="Tiếng Việt" onPress={openLanguageSheet} divider />
          <ListRow icon="help-circle-outline" label="Hỗ trợ" onPress={() => navigation.navigate('Support')} />
        </Card>

        <AppButton variant="outline" icon="log-out-outline" label="Đăng xuất" onPress={() => void logout()} style={styles.logout} />
        <Text style={styles.version}>Phiên bản 1.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  guestHero: { backgroundColor: colors.secondary, paddingHorizontal: layout.gutter + space.sm, paddingTop: space.xxxl, paddingBottom: space.xxxl, borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet },
  guestEyebrow: { ...type.overline, color: colors.secondarySoft, marginBottom: space.lg },
  guestTitle: { ...type.display, color: colors.white },
  guestCopy: { ...type.body, color: colors.secondarySoft, marginTop: space.md },
  guestBody: { paddingHorizontal: layout.gutter, paddingTop: space.xxl, paddingBottom: TAB_BAR_CLEARANCE, gap: space.md },
  guestHint: { ...type.secondary, textAlign: 'center', marginVertical: space.sm },
  content: { paddingHorizontal: layout.gutter, paddingBottom: TAB_BAR_CLEARANCE + space.lg, gap: space.sm },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...type.h3, color: colors.white },
  name: { ...type.h2 },
  email: { ...type.secondary },
  link: { ...type.secondaryStrong, color: colors.primary, marginTop: space.xs },
  groupTitle: { ...type.overline, marginTop: space.lg, marginBottom: space.xs },
  logout: { marginTop: space.xl },
  version: { ...type.caption, textAlign: 'center', marginTop: space.sm },
});
