import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { authApi } from '../api/auth';
import AuthField from '../components/AuthField';
import AuthScreenLayout from '../components/AuthScreenLayout';
import { colors } from '../constants/colors';
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
    <AuthScreenLayout
      title="Đặt lại mật khẩu"
      subtitle="Tạo mật khẩu mới để tiếp tục sử dụng tài khoản BeautyBook."
      onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Login')}
    >
      {completed ? (
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={38} color={colors.ratingGreen} />
          </View>
          <Text style={styles.successTitle}>Đổi mật khẩu thành công</Text>
          <Text style={styles.successText}>Các phiên cũ đã được thu hồi. Hãy đăng nhập lại bằng mật khẩu mới.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.replace('Login')}>
            <Text style={styles.primaryText}>ĐĂNG NHẬP</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {!route.params?.token && (
            <AuthField
              label="Mã đặt lại mật khẩu"
              icon="key-outline"
              value={token}
              onChangeText={setToken}
              placeholder="Dán mã từ email"
              autoCapitalize="none"
              error={submitted && !token.trim() ? 'Mã đặt lại mật khẩu là bắt buộc.' : undefined}
            />
          )}
          <AuthField
            label="Mật khẩu mới"
            icon="lock-closed-outline"
            password
            value={password}
            onChangeText={setPassword}
            placeholder="Tối thiểu 8 ký tự"
            textContentType="newPassword"
            error={submitted && !STRONG_PASSWORD.test(password)
              ? 'Cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.'
              : undefined}
          />
          <AuthField
            label="Xác nhận mật khẩu mới"
            icon="shield-checkmark-outline"
            password
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Nhập lại mật khẩu mới"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            error={submitted && confirmPassword !== password ? 'Mật khẩu xác nhận không khớp.' : undefined}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.disabled]}
            disabled={isLoading}
            onPress={() => void submit()}
          >
            {isLoading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.primaryText}>ĐỔI MẬT KHẨU</Text>}
          </TouchableOpacity>
        </>
      )}
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    paddingHorizontal: 24,
  },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.7 },
  error: { color: colors.discountRed, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  successWrap: { alignItems: 'center' },
  successIcon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#EAF7EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTitle: { color: colors.textDark, fontSize: 21, fontWeight: '900', marginBottom: 9 },
  successText: { color: colors.textGray, fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 18 },
});
