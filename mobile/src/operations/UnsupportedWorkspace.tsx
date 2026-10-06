import React from 'react';
import { Linking, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import { operationsWebUrl } from '../config/operationsWeb';
import { OperationButton } from './OperationPrimitives';
export default function UnsupportedWorkspace() {
  const { logout, user } = useAuth();
  const url = operationsWebUrl();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><View style={{ padding: 24, gap: 20 }}><Text accessibilityRole="header" style={{ fontSize: 25, fontWeight: '800', color: colors.textDark }}>Không gian làm việc trên web</Text><Text style={{ fontSize: 16, lineHeight: 24, color: colors.textBody }}>{user?.roles.includes('RECEPTIONIST') ? 'Tài khoản lễ tân sử dụng phiên bản quản trị web. Mobile hiện dành cho khách hàng, nhân viên và chủ doanh nghiệp.' : 'Tài khoản này chưa có quyền làm việc phù hợp trên mobile, hoặc quyền đã hết hạn. Vui lòng dùng phiên bản web hoặc liên hệ người quản lý.'}</Text>{url && <OperationButton label="Mở phiên bản web" onPress={() => void Linking.openURL(url)} />}<OperationButton secondary label="Đăng xuất" onPress={() => void logout()} /></View></SafeAreaView>;
}
