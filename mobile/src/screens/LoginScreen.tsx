import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import AuthField from '../components/AuthField';
import AuthScreenLayout from '../components/AuthScreenLayout';
import { colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/RootStack';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ navigation, route }: Props) {
  const { login, isSubmitting, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

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
      await login(email, password);
      setPassword('');
      setEmail('');
      finish();
    } catch {
      // AuthContext exposes the normalized API message in the form.
    }
  };

  return (
    <AuthScreenLayout
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để quản lý lịch hẹn và tiếp tục trải nghiệm BeautyBook."
      onBack={() => navigation.goBack()}
    >
      <AuthField
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
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
          setPassword(value);
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

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Chưa có tài khoản?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Register', route.params)}>
          <Text style={styles.switchAction}>Đăng ký ngay</Text>
        </TouchableOpacity>
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
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
