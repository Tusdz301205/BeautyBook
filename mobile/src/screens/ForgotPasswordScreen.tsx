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

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setSubmitted(true);
    setError(null);
    if (!EMAIL_PATTERN.test(email.trim())) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể gửi yêu cầu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenLayout image={editorial.authRecovery} title="Quên mật khẩu" subtitle="Nhập email đã đăng ký. BeautyBook sẽ gửi liên kết đặt lại mật khẩu nếu tài khoản tồn tại." onBack={() => navigation.goBack()}>
      {sent ? (
        <AuthResult icon="mail-open-outline" title="Kiểm tra hộp thư của bạn" message="Yêu cầu đã được tiếp nhận. Liên kết đặt lại mật khẩu có hiệu lực trong 30 phút." actionLabel="Về trang đăng nhập" onAction={() => navigation.navigate('Login')} />
      ) : (
        <>
          <AuthField label="Email" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={() => void submit()} error={submitted && !EMAIL_PATTERN.test(email.trim()) ? 'Vui lòng nhập email hợp lệ.' : undefined} />
          {!!error && <Notice tone="error" message={error} style={styles.notice} />}
          <AppButton label="Gửi liên kết đặt lại" loading={isLoading} onPress={() => void submit()} />
        </>
      )}
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({ notice: { marginBottom: space.lg } });
