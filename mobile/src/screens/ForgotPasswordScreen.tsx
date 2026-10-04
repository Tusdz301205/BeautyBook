import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { authApi } from '../api/auth';
import AuthField from '../components/AuthField';
import AuthScreenLayout from '../components/AuthScreenLayout';
import { colors } from '../constants/colors';
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
    <AuthScreenLayout
      title="Quên mật khẩu"
      subtitle="Nhập email đã đăng ký. BeautyBook sẽ gửi liên kết đặt lại mật khẩu nếu tài khoản tồn tại."
      onBack={() => navigation.goBack()}
    >
      {sent ? (
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="mail-open-outline" size={34} color={colors.ratingGreen} />
          </View>
          <Text style={styles.successTitle}>Kiểm tra hộp thư của bạn</Text>
          <Text style={styles.successText}>
            Yêu cầu đã được tiếp nhận. Liên kết đặt lại mật khẩu có hiệu lực trong 30 phút.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.primaryText}>VỀ TRANG ĐĂNG NHẬP</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <AuthField
            label="Email"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void submit()}
            error={submitted && !EMAIL_PATTERN.test(email.trim()) ? 'Vui lòng nhập email hợp lệ.' : undefined}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.disabled]}
            disabled={isLoading}
            onPress={() => void submit()}
          >
            {isLoading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.primaryText}>GỬI LIÊN KẾT</Text>}
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
    paddingHorizontal: 18,
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
