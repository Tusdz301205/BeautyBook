import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import AuthField from '../components/AuthField';
import AuthScreenLayout from '../components/AuthScreenLayout';
import { editorial } from '../components/editorialArt';
import { colors, space, type } from '../theme';
import { useAuth } from '../context/AuthContext';
import { AppButton, Notice } from '../ui';
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
  const passwordError = submitted && !STRONG_PASSWORD.test(password) ? 'Cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.' : undefined;
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
    if (fullName.trim().length < 2 || !EMAIL_PATTERN.test(email.trim()) || !STRONG_PASSWORD.test(password) || password !== confirmPassword) return;
    try {
      await register(fullName, email, password);
      finish();
    } catch {
      // AuthContext exposes the server message in the form.
    }
  };

  return (
    <AuthScreenLayout image={editorial.authRegister} title="Tạo tài khoản" subtitle="Tài khoản khách hàng để đặt lịch và theo dõi dịch vụ của bạn." onBack={() => navigation.goBack()}>
      <AuthField label="Họ và tên" icon="person-outline" value={fullName} onChangeText={(value) => { setFullName(value); if (error) clearError(); }} placeholder="Nguyễn Thị Lan" autoCapitalize="words" autoComplete="name" textContentType="name" error={nameError} />
      <AuthField label="Email" icon="mail-outline" value={email} onChangeText={(value) => { setEmail(value); if (error) clearError(); }} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" error={emailError} />
      <AuthField label="Mật khẩu" icon="lock-closed-outline" password value={password} onChangeText={(value) => { setPassword(value); if (error) clearError(); }} placeholder="Tối thiểu 8 ký tự" helper="Gồm chữ hoa, chữ thường và số." autoComplete="new-password" textContentType="newPassword" error={passwordError} />
      <AuthField label="Xác nhận mật khẩu" icon="shield-checkmark-outline" password value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Nhập lại mật khẩu" autoComplete="new-password" textContentType="newPassword" returnKeyType="done" onSubmitEditing={() => void submit()} error={confirmError} />
      {!!error && <Notice tone="error" message={error} style={styles.notice} />}
      <AppButton label="Tạo tài khoản" loading={isSubmitting} onPress={() => void submit()} />
      <Text style={styles.business}>Chủ doanh nghiệp đăng ký trên phiên bản web BeautyBook.</Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Đã có tài khoản?</Text>
        <Pressable accessibilityRole="link" onPress={() => navigation.navigate('Login', route.params)} style={styles.switchAction}>
          <Text style={styles.switchActionText}>Đăng nhập</Text>
        </Pressable>
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: space.lg },
  business: { ...type.caption, textAlign: 'center', marginTop: space.md },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm },
  switchLabel: { ...type.secondary },
  switchAction: { minHeight: 44, justifyContent: 'center' },
  switchActionText: { ...type.secondaryStrong, color: colors.primary },
});
