import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AccountStackParamList } from '../navigation/AccountStack';
import { colors } from '../constants/colors';
import { authApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<AccountStackParamList, 'ChangePassword'>;

export default function ChangePasswordScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setSubmitting] = useState(false);

  const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {};
    if (!currentPassword) nextErrors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại';
    if (!strongPassword.test(newPassword)) {
      nextErrors.newPassword = 'Cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số';
    }
    if (confirmPassword !== newPassword) nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      Alert.alert('Thành công', 'Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại.', [
        { text: 'Đăng nhập', onPress: () => void logout() },
      ]);
    } catch (reason) {
      Alert.alert(
        'Không thể đổi mật khẩu',
        reason instanceof Error ? reason.message : 'Vui lòng thử lại.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đổi mật khẩu</Text>
        <View style={styles.backButton} />
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>Mật khẩu hiện tại</Text>
          <TextInput
            style={[styles.input, errors.currentPassword && styles.inputError]}
            placeholder="Nhập mật khẩu hiện tại"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          {!!errors.currentPassword && <Text style={styles.errorText}>{errors.currentPassword}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mật khẩu mới</Text>
          <TextInput
            style={[styles.input, errors.newPassword && styles.inputError]}
            placeholder="Tối thiểu 8 ký tự, có chữ hoa, chữ thường và số"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          {!!errors.newPassword && <Text style={styles.errorText}>{errors.newPassword}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Xác nhận mật khẩu mới</Text>
          <TextInput
            style={[styles.input, errors.confirmPassword && styles.inputError]}
            placeholder="Nhập lại mật khẩu mới"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          {!!errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          activeOpacity={0.85}
          disabled={isSubmitting}
          onPress={() => void handleSubmit()}
        >
          {isSubmitting
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.submitButtonText}>LƯU MẬT KHẨU MỚI</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textDark,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  field: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textBody,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textDark,
  },
  inputError: {
    borderColor: colors.discountRed,
  },
  errorText: {
    fontSize: 12,
    color: colors.discountRed,
    marginTop: 6,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  submitButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
});
