import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import AuthField from '../components/AuthField';
import AuthScreenLayout from '../components/AuthScreenLayout';
import { colors, radius, space, type } from '../theme';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { AppButton, Notice } from '../ui';
import type { RootStackParamList } from '../navigation/RootStack';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
type Workspace = 'CUSTOMER' | 'SALON' | 'PLATFORM';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WORKSPACE_COPY: Record<Workspace, { label: string; detail: string; icon: keyof typeof Ionicons.glyphMap }> = {
  CUSTOMER: { label: 'Không gian khách hàng', detail: 'Đặt và theo dõi lịch hẹn của bạn', icon: 'person-outline' },
  SALON: { label: 'Không gian vận hành', detail: 'Công việc nhân viên hoặc quản lý doanh nghiệp', icon: 'briefcase-outline' },
  PLATFORM: { label: 'Không gian quản trị (web)', detail: 'Quản trị nền tảng thực hiện trên web', icon: 'desktop-outline' },
};

export default function LoginScreen({ navigation, route }: Props) {
  const { login, user, isSubmitting, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace>();
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string }>>([]);
  const [businessId, setBusinessId] = useState<string>();
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (user?.workspace === 'CUSTOMER') finish();
    // Operational sessions remount RootStack with the server-authorized shell.
  }, [user]);

  const emailError = submitted && !EMAIL_PATTERN.test(email.trim()) ? 'Vui lòng nhập email hợp lệ.' : undefined;
  const passwordError = submitted && password.length < 6 ? 'Mật khẩu phải có ít nhất 6 ký tự.' : undefined;

  const finish = () => {
    if (route.params?.returnTo === 'previous' && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace('MainTabs', { screen: 'TaiKhoan' });
  };

  const submit = async () => {
    setSubmitted(true);
    clearError();
    if (!EMAIL_PATTERN.test(email.trim()) || password.length < 6) return;
    try {
      await login(email, password, { workspace, businessId });
      setPassword('');
      setEmail('');
    } catch (reason) {
      if (reason instanceof ApiError && reason.payload && typeof reason.payload === 'object') {
        const payload = reason.payload as { code?: string; businesses?: Array<{ id: string; name: string }>; availableWorkspaces?: Workspace[] };
        if (payload.code === 'BUSINESS_REQUIRED') setBusinesses(payload.businesses ?? []);
        if (payload.code === 'WORKSPACE_REQUIRED') setAvailableWorkspaces(payload.availableWorkspaces ?? []);
      }
      // AuthContext exposes the normalized API message in the form.
    }
  };

  const resetChallenge = () => { setBusinesses([]); setBusinessId(undefined); setWorkspace(undefined); setAvailableWorkspaces([]); };

  return (
    <AuthScreenLayout title="Chào mừng trở lại" subtitle="Đăng nhập để quản lý lịch hẹn và tiếp tục với BeautyBook." onBack={() => navigation.goBack()}>
      {availableWorkspaces.length > 0 && (
        <View style={styles.challenge}>
          <Text accessibilityRole="header" style={styles.challengeTitle}>Tài khoản có nhiều không gian. Chọn nơi bạn muốn vào:</Text>
          {availableWorkspaces.map((value) => (
            <Choice key={value} icon={WORKSPACE_COPY[value].icon} label={WORKSPACE_COPY[value].label} detail={WORKSPACE_COPY[value].detail} disabled={isSubmitting} onPress={() => { setWorkspace(value); setAvailableWorkspaces([]); clearError(); }} />
          ))}
        </View>
      )}
      {businesses.length > 0 && (
        <View accessibilityRole="radiogroup" style={styles.challenge}>
          <Text accessibilityRole="header" style={styles.challengeTitle}>Chọn doanh nghiệp để tiếp tục:</Text>
          {businesses.map((business) => (
            <Choice key={business.id} radio selected={businessId === business.id} icon="business-outline" label={business.name} disabled={isSubmitting} onPress={() => { setBusinessId(business.id); clearError(); }} />
          ))}
        </View>
      )}
      <AuthField
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={(value) => { setEmail(value); resetChallenge(); if (error) clearError(); }}
        placeholder="email@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        error={emailError}
      />
      <AuthField
        label="Mật khẩu"
        icon="lock-closed-outline"
        password
        value={password}
        onChangeText={(value) => { setPassword(value); resetChallenge(); if (error) clearError(); }}
        placeholder="Nhập mật khẩu"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        error={passwordError}
      />
      <Pressable accessibilityRole="link" onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot}>
        <Text style={styles.forgotText}>Quên mật khẩu?</Text>
      </Pressable>
      {!!error && <Notice tone="error" message={error} style={styles.notice} />}
      <AppButton label={workspace || businessId ? 'Tiếp tục đăng nhập' : 'Đăng nhập'} loading={isSubmitting} onPress={() => void submit()} />
      {!workspace || workspace === 'CUSTOMER' ? (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Chưa có tài khoản?</Text>
          <Pressable accessibilityRole="link" onPress={() => navigation.navigate('Register', route.params)} style={styles.switchAction}>
            <Text style={styles.switchActionText}>Đăng ký khách hàng</Text>
          </Pressable>
        </View>
      ) : <Text style={styles.operational}>Dùng tài khoản vận hành do doanh nghiệp cấp. Đăng ký chủ doanh nghiệp thực hiện trên phiên bản web.</Text>}
    </AuthScreenLayout>
  );
}

function Choice({ label, detail, icon, onPress, disabled, radio, selected }: { label: string; detail?: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; radio?: boolean; selected?: boolean }) {
  return (
    <Pressable
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityState={radio ? { checked: Boolean(selected), disabled } : { disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && { backgroundColor: colors.surfacePressed }]}
    >
      <Ionicons accessible={false} name={icon} size={22} color={selected ? colors.primary : colors.secondary} />
      <View style={styles.flex}>
        <Text style={styles.choiceLabel}>{label}</Text>
        {detail ? <Text style={styles.choiceDetail}>{detail}</Text> : null}
      </View>
      <Ionicons accessible={false} name={radio ? (selected ? 'radio-button-on' : 'radio-button-off') : 'chevron-forward'} size={20} color={selected ? colors.primary : colors.secondaryText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  challenge: { gap: space.sm, marginBottom: space.xl },
  challengeTitle: { ...type.secondaryStrong, color: colors.heading },
  choice: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  choiceSelected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  choiceLabel: { ...type.bodyStrong },
  choiceDetail: { ...type.caption },
  forgot: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', marginTop: -space.sm, marginBottom: space.md },
  forgotText: { ...type.secondaryStrong, color: colors.primary },
  notice: { marginBottom: space.lg },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: space.xs, marginTop: space.lg },
  switchLabel: { ...type.secondary },
  switchAction: { minHeight: 44, justifyContent: 'center' },
  switchActionText: { ...type.secondaryStrong, color: colors.primary },
  operational: { ...type.secondary, textAlign: 'center', marginTop: space.lg },
});
