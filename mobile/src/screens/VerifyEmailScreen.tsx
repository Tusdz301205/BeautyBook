import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { authApi } from '../api/auth';
import AuthField from '../components/AuthField';
import AuthScreenLayout from '../components/AuthScreenLayout';
import { colors } from '../constants/colors';
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
    <AuthScreenLayout
      title="Xác minh email"
      subtitle="Hoàn tất xác minh để bảo vệ tài khoản BeautyBook của bạn."
      onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Login')}
    >
      {status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.info}>Đang xác minh email...</Text>
        </View>
      ) : status === 'success' ? (
        <View style={styles.center}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={38} color={colors.ratingGreen} />
          </View>
          <Text style={styles.title}>Email đã được xác minh</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.replace('Login')}>
            <Text style={styles.primaryText}>ĐĂNG NHẬP</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {!route.params?.token && (
            <AuthField
              label="Mã xác minh"
              icon="key-outline"
              value={token}
              onChangeText={setToken}
              placeholder="Dán mã từ email"
              autoCapitalize="none"
              error={status === 'error' && !token.trim() ? 'Mã xác minh là bắt buộc.' : undefined}
            />
          )}
          {!!message && <Text style={styles.error}>{message}</Text>}
          <TouchableOpacity style={styles.primaryButton} onPress={() => void verify(token)}>
            <Text style={styles.primaryText}>XÁC MINH</Text>
          </TouchableOpacity>
        </>
      )}
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 14 },
  info: { color: colors.textGray, fontSize: 15 },
  successIcon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#EAF7EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.textDark, fontSize: 21, fontWeight: '900', textAlign: 'center' },
  error: { color: colors.discountRed, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  primaryButton: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    paddingHorizontal: 26,
    alignSelf: 'stretch',
  },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: '900' },
});
