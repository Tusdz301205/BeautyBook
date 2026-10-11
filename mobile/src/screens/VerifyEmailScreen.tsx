import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { authApi } from '../api/auth';
import AuthField from '../components/AuthField';
import AuthResult from '../components/AuthResult';
import AuthScreenLayout from '../components/AuthScreenLayout';
import { space } from '../theme';
import { AppButton, LoadingState, Notice } from '../ui';
import type { RootStackParamList } from '../navigation/RootStack';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const [token, setToken] = useState(route.params?.token ?? '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const verify = async (value: string) => {
    if (!value.trim()) {
      setMessage('Mã xác minh là bắt buộc.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setMessage(null);
    try {
      await authApi.verifyEmail(value.trim());
      setStatus('success');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Không thể xác minh email.');
      setStatus('error');
    }
  };

  useEffect(() => {
    if (route.params?.token) void verify(route.params.token);
  }, [route.params?.token]);

  return (
    <AuthScreenLayout title="Xác minh email" subtitle="Hoàn tất xác minh để bảo vệ tài khoản BeautyBook của bạn." onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Login')}>
      {status === 'loading' ? <LoadingState message="Đang xác minh email…" style={styles.loading} /> : status === 'success' ? (
        <AuthResult icon="checkmark" title="Email đã được xác minh" actionLabel="Đăng nhập" onAction={() => navigation.replace('Login')} />
      ) : (
        <>
          {!route.params?.token && (
            <AuthField label="Mã xác minh" icon="key-outline" value={token} onChangeText={setToken} placeholder="Dán mã từ email" autoCapitalize="none" autoCorrect={false} error={status === 'error' && !token.trim() ? 'Mã xác minh là bắt buộc.' : undefined} />
          )}
          {!!message && <Notice tone="error" message={message} style={styles.notice} />}
          <AppButton label="Xác minh" onPress={() => void verify(token)} />
        </>
      )}
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({ notice: { marginBottom: space.lg }, loading: { flex: 0, paddingVertical: space.xxxl } });
