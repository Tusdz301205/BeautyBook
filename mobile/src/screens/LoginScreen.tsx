import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import AuthField from '../components/AuthField';
import AuthScreenLayout from '../components/AuthScreenLayout';
import { colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import type { RootStackParamList } from '../navigation/RootStack';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ navigation, route }: Props) {
  const { login, isSubmitting, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [workspace, setWorkspace] = useState<'CUSTOMER' | 'SALON' | 'PLATFORM'>('CUSTOMER');
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string }>>([]);
  const [businessId, setBusinessId] = useState<string>();
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Array<'CUSTOMER' | 'SALON' | 'PLATFORM'>>([]);

  useEffect(() => {
    clearError();
  }, [clearError]);

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
      if (workspace === 'CUSTOMER') finish();
    } catch (reason) {
      if (reason instanceof ApiError && reason.payload && typeof reason.payload === 'object') {
        const payload = reason.payload as { code?: string; businesses?: Array<{ id: string; name: string }>; availableWorkspaces?: Array<'CUSTOMER' | 'SALON' | 'PLATFORM'> };
        if (payload.code === 'BUSINESS_REQUIRED') setBusinesses(payload.businesses ?? []);
        if (payload.code === 'WORKSPACE_REQUIRED') setAvailableWorkspaces(payload.availableWorkspaces ?? []);
      }
      // AuthContext exposes the normalized API message in the form.
    }
  };

  return (
    <AuthScreenLayout
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để quản lý lịch hẹn và tiếp tục trải nghiệm BeautyBook."
      onBack={() => navigation.goBack()}
    >
      <View style={styles.workspaceRow}>{([{ value: 'CUSTOMER', label: 'Khách hàng' }, { value: 'SALON', label: 'Nhân viên / Chủ doanh nghiệp' }] as const).map(option => <TouchableOpacity key={option.value} accessibilityRole="radio" accessibilityState={{ checked: workspace === option.value, disabled: isSubmitting }} disabled={isSubmitting} onPress={() => { setWorkspace(option.value); setBusinessId(undefined); setBusinesses([]); clearError(); }} style={[styles.workspaceChoice, workspace === option.value && styles.workspaceSelected]}><Text style={styles.workspaceText}>{option.label}</Text></TouchableOpacity>)}</View>
      {availableWorkspaces.map(value => <TouchableOpacity key={value} accessibilityRole="button" disabled={isSubmitting} style={styles.workspaceChoice} onPress={() => { setWorkspace(value); setAvailableWorkspaces([]); clearError(); }}><Text style={styles.workspaceText}>{value === 'SALON' ? 'Không gian vận hành' : value === 'CUSTOMER' ? 'Không gian khách hàng' : 'Không gian quản trị (web)'}</Text></TouchableOpacity>)}
      {workspace !== 'CUSTOMER' && <TouchableOpacity accessibilityRole="button" disabled={isSubmitting} style={styles.workspaceChoice} onPress={() => { setWorkspace(workspace === 'PLATFORM' ? 'SALON' : 'PLATFORM'); setBusinessId(undefined); setBusinesses([]); clearError(); }}><Text style={styles.workspaceText}>{workspace === 'PLATFORM' ? 'Đang chọn quản trị nền tảng · Chuyển về nhân viên / chủ' : 'Tài khoản quản trị nền tảng (sử dụng web)'}</Text></TouchableOpacity>}
      {businesses.length > 0 && <View style={styles.workspaceRow}><Text style={styles.switchLabel}>Chọn doanh nghiệp để tiếp tục:</Text>{businesses.map(business => <TouchableOpacity key={business.id} accessibilityRole="radio" accessibilityState={{ checked: businessId === business.id }} disabled={isSubmitting} style={[styles.workspaceChoice, businessId === business.id && styles.workspaceSelected]} onPress={() => { setBusinessId(business.id); clearError(); }}><Text style={styles.workspaceText}>{business.name}</Text></TouchableOpacity>)}</View>}
      <AuthField
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={(value) => {
          setEmail(value); setBusinesses([]); setBusinessId(undefined);
          if (error) clearError();
        }}
        placeholder="email@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        returnKeyType="next"
        error={emailError}
      />
      <AuthField
        label="Mật khẩu"
        icon="lock-closed-outline"
        password
        value={password}
        onChangeText={(value) => {
          setPassword(value); setBusinesses([]); setBusinessId(undefined);
          if (error) clearError();
        }}
        placeholder="Nhập mật khẩu"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        error={passwordError}
      />

      <TouchableOpacity
        style={styles.forgotButton}
        onPress={() => navigation.navigate('ForgotPassword')}
      >
        <Text style={styles.forgotText}>Quên mật khẩu?</Text>
      </TouchableOpacity>

      {!!error && (
        <View style={styles.serverError}>
          <Text style={styles.serverErrorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitDisabled]}
        disabled={isSubmitting}
        activeOpacity={0.85}
        onPress={() => void submit()}
      >
        {isSubmitting
          ? <ActivityIndicator color={colors.white} />
          : <Text style={styles.submitText}>ĐĂNG NHẬP</Text>}
      </TouchableOpacity>

      {workspace === 'CUSTOMER' ? <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Chưa có tài khoản?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Register', route.params)}>
          <Text style={styles.switchAction}>Đăng ký ngay</Text>
        </TouchableOpacity>
      </View> : <Text style={[styles.switchLabel, { marginTop: 18 }]}>Dùng tài khoản vận hành do doanh nghiệp cấp. Đăng ký chủ doanh nghiệp thực hiện trên phiên bản web.</Text>}
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  workspaceRow: { gap: 10, marginBottom: 18 },
  workspaceChoice: { minHeight: 48, justifyContent: 'center', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  workspaceSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  workspaceText: { color: colors.textDark, fontSize: 16, fontWeight: '700' },
  forgotButton: { alignSelf: 'flex-end', marginTop: -5, marginBottom: 18, paddingVertical: 4 },
  forgotText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  serverError: { backgroundColor: '#FFF0F3', borderRadius: 12, padding: 12, marginBottom: 14 },
  serverErrorText: { color: colors.discountRed, fontSize: 14, lineHeight: 20 },
  submitButton: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: colors.white, fontSize: 16, fontWeight: '900', letterSpacing: 0.4 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 22 },
  switchLabel: { color: colors.textGray, fontSize: 14 },
  switchAction: { color: colors.primary, fontSize: 14, fontWeight: '800' },
});
