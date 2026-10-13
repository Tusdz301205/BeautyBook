import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, layout, radius, space, type } from '../theme';
import { operationsWebUrl } from '../config/operationsWeb';
import { OperationButton } from './OperationPrimitives';

/** Receptionist / platform-only sessions are handed to the web; no mobile workspace is invented. */
export default function UnsupportedWorkspace() {
  const { logout, user } = useAuth();
  const url = operationsWebUrl();
  return <SafeAreaView style={styles.screen}>
    <View style={styles.content}>
      <View style={styles.icon}><Ionicons accessible={false} name="desktop-outline" size={30} color={colors.secondary} /></View>
      <Text accessibilityRole="header" style={styles.title}>Không gian làm việc trên web</Text>
      <Text style={styles.body}>{user?.roles.includes('RECEPTIONIST') ? 'Dùng phiên bản quản trị web để làm việc với tài khoản lễ tân.' : 'Tài khoản này chưa có quyền làm việc trên ứng dụng. Dùng phiên bản web hoặc liên hệ quản lý.'}</Text>
      {url ? <OperationButton label="Mở phiên bản web" icon="open-outline" onPress={() => void Linking.openURL(url)} /> : <Text style={styles.note}>Chưa mở được phiên bản web. Hãy liên hệ quản lý.</Text>}
      <OperationButton secondary label="Đăng xuất" icon="log-out-outline" onPress={() => void logout()} />
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', padding: layout.gutter + space.sm, gap: space.lg },
  icon: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.secondarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.h1 },
  body: { ...type.body },
  note: { ...type.secondary },
});
