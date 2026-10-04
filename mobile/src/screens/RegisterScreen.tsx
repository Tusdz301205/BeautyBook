import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import AuthField from '../components/AuthField';
import AuthScreenLayout from '../components/AuthScreenLayout';
import { colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/RootStack';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

export default function RegisterScreen({ navigation, route }: Props) {
  const { register, isSubmitting, error, clearError } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const nameError = submitted && fullName.trim().length < 2 ? 'Họ tên phải có ít nhất 2 ký tự.' : undefined;
  const emailError = submitted && !EMAIL_PATTERN.test(email.trim()) ? 'Vui lòng nhập email hợp lệ.' : undefined;
  const passwordError = submitted && !STRONG_PASSWORD.test(password)
    ? 'Cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.'
    : undefined;
  const confirmError = submitted && confirmPassword !== password ? 'Mật khẩu xác nhận không khớp.' : undefined;

  const finish = () => {
    if (route.params?.returnTo === 'previous' && navigation.canGoBack()) {
      navigation.popTo('MainTabs');
      return;
    }
    navigation.replace('MainTabs', { screen: 'TaiKhoan' });
  };

  const submit = async () => {
    setSubmitted(true);
    clearError();
    if (
      fullName.trim().length < 2
      || !EMAIL_PATTERN.test(email.trim())
      || !STRONG_PASSWORD.test(password)
      || password !== confirmPassword
    ) return;
    try {
      await register(fullName, email, password);
      finish();
    } catch {
      // AuthContext exposes the server message in the form.
    }
  };

  return (
    <AuthScreenLayout
      title="Tạo tài khoản"
      subtitle="Đăng ký tài khoản khách hàng để đặt lịch và theo dõi dịch vụ của bạn."
      onBack={() => navigation.goBack()}
    >
      <AuthField
        label="Họ và tên"
        icon="person-outline"
        value={fullName}
        onChangeText={(value) => {
          setFullName(value);
          if (error) clearError();
        }}
        placeholder="Nguyễn Văn A"
        autoCapitalize="words"
        textContentType="name"
        error={nameError}
      />
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
        placeholder="Tối thiểu 8 ký tự"
        textContentType="newPassword"
        error={passwordError}
      />
      <AuthField
        label="Xác nhận mật khẩu"
        icon="shield-checkmark-outline"
        password
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Nhập lại mật khẩu"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        error={confirmError}
      />

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
          : <Text style={styles.submitText}>TẠO TÀI KHOẢN</Text>}
      </TouchableOpacity>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Đã có tài khoản?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login', route.params)}>
          <Text style={styles.switchAction}>Đăng nhập</Text>
        </TouchableOpacity>
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  serverError: { backgroundColor: '#FFF0F3', borderRadius: 12, padding: 12, marginBottom: 14 },
  serverErrorText: { color: colors.discountRed, fontSize: 14, lineHeight: 20 },
  submitButton: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: colors.white, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 22 },
  switchLabel: { color: colors.textGray, fontSize: 14 },
  switchAction: { color: colors.primary, fontSize: 14, fontWeight: '800' },
});
