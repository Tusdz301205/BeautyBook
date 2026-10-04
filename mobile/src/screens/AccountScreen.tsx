import React from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootTabParamList } from '../navigation/RootTabs';
import { RootStackParamList } from '../navigation/RootStack';
import { AccountStackParamList } from '../navigation/AccountStack';
import { TAB_BAR_CLEARANCE } from '../navigation/CustomTabBar';
import { colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getInitials } from '../utils/hash';
import { privacyApi } from '../api/privacy';

type Props = CompositeScreenProps<
  NativeStackScreenProps<AccountStackParamList, 'AccountMain'>,
  CompositeScreenProps<BottomTabScreenProps<RootTabParamList, 'TaiKhoan'>, NativeStackScreenProps<RootStackParamList>>
>;

interface MenuRow {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  onPress?: () => void;
}

function MenuGroup({ rows }: { rows: MenuRow[] }) {
  return (
    <View style={styles.group}>
      {rows.map((row, index) => (
        <TouchableOpacity
          key={row.label}
          style={[styles.row, index < rows.length - 1 && styles.rowDivider]}
          activeOpacity={0.7}
          onPress={row.onPress}
        >
          <Ionicons name={row.icon} size={20} color={row.danger ? colors.discountRed : colors.textDark} />
          <Text style={[styles.rowLabel, row.danger && styles.rowLabelDanger]}>{row.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function AccountScreen({ navigation }: Props) {
  const { userName, logout, isLoggedIn, isRestoring } = useAuth();
  const { openLanguageSheet } = useLanguage();

  if (isRestoring) return <View style={styles.restoring}><ActivityIndicator color={colors.primary} /><Text style={styles.subtitle}>Đang khôi phục phiên đăng nhập…</Text></View>;
  if (!isLoggedIn) return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.guestHeader}><Text style={styles.guestEyebrow}>BEAUTYBOOK</Text><Text style={styles.guestTitle}>Chăm sóc mình, theo cách của mình.</Text><Text style={styles.guestCopy}>Đăng nhập để theo dõi lịch hẹn, lưu dịch vụ yêu thích và cập nhật hồ sơ của bạn.</Text></SafeAreaView>
      <View style={styles.guestBody}>
        <TouchableOpacity accessibilityRole="button" style={styles.guestPrimary} onPress={() => navigation.navigate('Login', { returnTo: 'account' })}><Text style={styles.guestPrimaryText}>Đăng nhập</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.guestSecondary} onPress={() => navigation.navigate('Register', { returnTo: 'account' })}><Text style={styles.guestSecondaryText}>Tạo tài khoản</Text></TouchableOpacity>
        <Text style={styles.guestHint}>Bạn vẫn có thể khám phá dịch vụ mà chưa cần đăng nhập.</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.guestHelp} onPress={() => navigation.navigate('Support')}><Text style={styles.guestHelpText}>Trung tâm hỗ trợ</Text><Ionicons name="arrow-forward" size={17} color={colors.primary} /></TouchableOpacity>
      </View>
    </View>
  );

  const GROUP_1: MenuRow[] = [
    { icon: 'person-outline', label: 'Hồ sơ', onPress: () => navigation.navigate('Profile') },
    { icon: 'heart-outline', label: 'Mục yêu thích', onPress: () => navigation.navigate('Favorites') },
    { icon: 'notifications-outline', label: 'Thông báo', onPress: () => navigation.navigate('Messages') },
    { icon: 'calendar-outline', label: 'Các cuộc hẹn của tôi', onPress: () => navigation.navigate('LichHen') },
    { icon: 'settings-outline', label: 'Cài đặt', onPress: () => navigation.navigate('Settings') },
  ];

  const GROUP_2: MenuRow[] = [
    { icon: 'help-circle-outline', label: 'Hỗ trợ', onPress: () => navigation.navigate('Support') },
    { icon: 'globe-outline', label: 'Tiếng Việt (Việt Nam)', onPress: openLanguageSheet },
  ];

  const handleDeleteAccount = () => {
    Alert.alert(
      'Xóa tài khoản',
      'Bạn có chắc chắn muốn xóa tài khoản? Toàn bộ dữ liệu của bạn sẽ bị mất và không thể khôi phục.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gửi yêu cầu',
          style: 'destructive',
          onPress: () => {
            void privacyApi.requestAccountDeletion().then(
              () => Alert.alert('Đã gửi yêu cầu', 'Yêu cầu xóa tài khoản của bạn đã được ghi nhận và đang chờ xử lý.'),
              (reason: unknown) => Alert.alert(
                'Không thể gửi yêu cầu',
                reason instanceof Error ? reason.message : 'Vui lòng thử lại.',
              ),
            );
          },
        },
      ]
    );
  };

  const GROUP_3: MenuRow[] = [
    { icon: 'log-out-outline', label: 'Đăng xuất', onPress: logout },
    { icon: 'close-circle-outline', label: 'Xóa tài khoản', danger: true, onPress: handleDeleteAccount },
  ];

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.name}>{userName}</Text>
          <Text style={styles.subtitle}>Hồ sơ cá nhân</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(userName)}</Text>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <MenuGroup rows={GROUP_1} />
        <MenuGroup rows={GROUP_2} />
        <MenuGroup rows={GROUP_3} />
        <Text style={styles.version}>v1.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  restoring: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background },
  guestHeader: { backgroundColor: '#41273A', paddingHorizontal: 25, paddingTop: 48, paddingBottom: 42, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  guestEyebrow: { color: '#E7BDCE', fontSize: 12, letterSpacing: 1.8, fontWeight: '700', marginBottom: 24 },
  guestTitle: { color: '#FFF9F4', fontSize: 30, lineHeight: 38, fontWeight: '700', maxWidth: 300 },
  guestCopy: { color: '#F1E4E7', fontSize: 15, lineHeight: 24, marginTop: 18 },
  guestBody: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: TAB_BAR_CLEARANCE },
  guestPrimary: { minHeight: 54, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  guestPrimaryText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  guestSecondary: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  guestSecondaryText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  guestHint: { color: colors.textGray, fontSize: 13, lineHeight: 20, marginTop: 20, textAlign: 'center' },
  guestHelp: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, borderTopWidth: 1, borderTopColor: colors.border },
  guestHelpText: { color: colors.textDark, fontSize: 15 },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTextBlock: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textDark,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textGray,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: TAB_BAR_CLEARANCE,
    gap: 16,
  },
  phoneCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 8,
  },
  phoneTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textDark,
  },
  phoneSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 4,
  },
  phoneButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  phoneButtonText: {
    color: colors.textDark,
    fontWeight: '700',
    fontSize: 14,
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    color: colors.textDark,
    fontWeight: '500',
  },
  rowLabelDanger: {
    color: colors.discountRed,
  },
  version: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
  },
});
