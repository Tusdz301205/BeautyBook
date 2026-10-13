import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { authApi } from '../api/auth';
import AuthField from '../components/AuthField';
import AuthResult from '../components/AuthResult';
import AuthScreenLayout from '../components/AuthScreenLayout';
import { editorial } from '../components/editorialArt';
import { space } from '../theme';
import { AppButton, Notice } from '../ui';
import type { RootStackParamList } from '../navigation/RootStack';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const [token, setToken] = useState(route.params?.token ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const submit = async () => {
    setSubmitted(true);
    setError(null);
    if (!token.trim() || !STRONG_PASSWORD.test(password) || password !== confirmPassword) return;
    setLoading(true);
    try {
      await authApi.resetPassword(token.trim(), password);
      setCompleted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đặt lại mật khẩu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenLayout image={editorial.authRecovery} title="Đặt lại mật khẩu" onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Login')}>
      {completed ? (
        <AuthResult icon="checkmark" title="Đổi mật khẩu thành công" message="Các phiên cũ đã được thu hồi. Hãy đăng nhập lại bằng mật khẩu mới." actionLabel="Đăng nhập" onAction={() => navigation.replace('Login')} />
      ) : (
        <>
          {!route.params?.token && (
            <AuthField label="Mã đặt lại mật khẩu" icon="key-outline" value={token} onChangeText={setToken} placeholder="Dán mã từ email" autoCapitalize="none" autoCorrect={false} error={submitted && !token.trim() ? 'Mã đặt lại mật khẩu là bắt buộc.' : undefined} />
          )}
          <AuthField label="Mật khẩu mới" icon="lock-closed-outline" password value={password} onChangeText={setPassword} placeholder="Tối thiểu 8 ký tự" helper="Gồm chữ hoa, chữ thường và số." autoComplete="new-password" textContentType="newPassword" error={submitted && !STRONG_PASSWORD.test(password) ? 'Cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.' : undefined} />
          <AuthField label="Xác nhận mật khẩu mới" icon="shield-checkmark-outline" password value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" textContentType="newPassword" returnKeyType="done" onSubmitEditing={() => void submit()} error={submitted && confirmPassword !== password ? 'Mật khẩu xác nhận không khớp.' : undefined} />
          {!!error && <Notice tone="error" message={error} style={styles.notice} />}
          <AppButton label="Đổi mật khẩu" loading={isLoading} onPress={() => void submit()} />
        </>
      )}
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({ notice: { marginBottom: space.lg } });
