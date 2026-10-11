import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AccountStackParamList } from '../navigation/AccountStack';
import { colors, layout, space, type } from '../theme';
import { useAuth } from '../context/AuthContext';
import { Card, ListRow, ScreenHeader } from '../ui';

type Props = NativeStackScreenProps<AccountStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const { logout } = useAuth();
  return (
    <View style={styles.screen}>
      <ScreenHeader title="Cài đặt và bảo mật" onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.groupTitle}>Bảo mật</Text>
        <Card padded={false}>
          <ListRow icon="key-outline" label="Đổi mật khẩu" detail="Sau khi đổi, bạn cần đăng nhập lại." onPress={() => navigation.navigate('ChangePassword')} />
        </Card>
        <Text accessibilityRole="header" style={styles.groupTitle}>Phiên đăng nhập</Text>
        <Card padded={false}>
          <ListRow icon="log-out-outline" label="Đăng xuất" danger chevron={false} onPress={() => void logout()} />
        </Card>
        <Text style={styles.version}>Phiên bản 1.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: layout.gutter, paddingBottom: space.xxxl },
  groupTitle: { ...type.overline, marginTop: space.lg, marginBottom: space.sm },
  version: { ...type.caption, textAlign: 'center', marginTop: space.xxl },
});
