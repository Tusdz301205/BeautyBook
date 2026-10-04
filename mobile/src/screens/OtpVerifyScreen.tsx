import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/RootStack';
import { colors } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'OtpVerify'>;

const OTP_LENGTH = 6;

export default function OtpVerifyScreen({ route, navigation }: Props) {
  const { contact } = route.params;
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const code = digits.join('');
  const isComplete = code.length === OTP_LENGTH;

  const handleChangeDigit = (text: string, index: number) => {
    const value = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = () => {
    Alert.alert('Đã gửi lại mã', `Mã xác nhận mới đã được gửi đến ${contact}`);
  };

  const handleConfirm = () => {
    if (!isComplete) return;
    Alert.alert('Thành công', 'Số điện thoại của bạn đã được xác thực.');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={10}>
        <Ionicons name="chevron-back" size={24} color={colors.textDark} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="chatbox-ellipses-outline" size={36} color={colors.primary} />
        </View>
        <Text style={styles.title}>Nhập mã xác nhận</Text>
        <Text style={styles.subtitle}>Mã gồm {OTP_LENGTH} số đã được gửi đến {contact}</Text>

        <View style={styles.otpRow}>
          {digits.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[styles.otpBox, !!digit && styles.otpBoxFilled]}
              value={digit}
              onChangeText={(text) => handleChangeDigit(text, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
            />
          ))}
        </View>

        <TouchableOpacity activeOpacity={0.7} onPress={handleResend}>
          <Text style={styles.resendText}>Không nhận được mã? Gửi lại</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmButton, !isComplete && styles.confirmButtonDisabled]}
          activeOpacity={0.85}
          disabled={!isComplete}
          onPress={handleConfirm}
        >
          <Text style={styles.confirmButtonText}>XÁC NHẬN</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.card,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  otpBox: {
    width: 46,
    height: 54,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
  },
  otpBoxFilled: {
    borderColor: colors.primary,
  },
  resendText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 28,
  },
  confirmButton: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: colors.primaryLight,
  },
  confirmButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
