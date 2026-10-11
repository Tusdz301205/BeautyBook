import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AccountStackParamList } from '../navigation/AccountStack';
import { colors, layout, space, type } from '../theme';
import { authApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { AppButton, ScreenHeader, TextField } from '../ui';

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
    if (!strongPassword.test(newPassword)) nextErrors.newPassword = 'Cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số';
    if (confirmPassword !== newPassword) nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      Alert.alert('Đã đổi mật khẩu', 'Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại.', [
        { text: 'Đăng nhập', onPress: () => void logout() },
      ]);
    } catch (reason) {
      Alert.alert('Không thể đổi mật khẩu', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Đổi mật khẩu" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>Sau khi đổi mật khẩu, các phiên cũ có thể bị thu hồi và bạn cần đăng nhập lại.</Text>
          <TextField label="Mật khẩu hiện tại" password value={currentPassword} onChangeText={setCurrentPassword} placeholder="Nhập mật khẩu hiện tại" textContentType="password" autoComplete="current-password" error={errors.currentPassword} />
          <TextField label="Mật khẩu mới" password value={newPassword} onChangeText={setNewPassword} placeholder="Tối thiểu 8 ký tự" helper="Gồm chữ hoa, chữ thường và số." textContentType="newPassword" autoComplete="new-password" error={errors.newPassword} />
          <TextField label="Xác nhận mật khẩu mới" password value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Nhập lại mật khẩu mới" textContentType="newPassword" autoComplete="new-password" error={errors.confirmPassword} returnKeyType="done" onSubmitEditing={() => void handleSubmit()} />
          <AppButton label={isSubmitting ? 'Đang lưu…' : 'Lưu mật khẩu mới'} loading={isSubmitting} onPress={() => void handleSubmit()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: layout.gutter, paddingTop: space.md, paddingBottom: space.xxxl },
  hint: { ...type.secondary, marginBottom: space.lg },
});
