import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AccountStackParamList } from '../navigation/AccountStack';
import { colors, layout, space } from '../theme';
import { useAddresses } from '../context/AddressContext';
import { usersApi } from '../api/users';
import { AppButton, ScreenHeader, TextField } from '../ui';

type Props = NativeStackScreenProps<AccountStackParamList, 'AddressForm'>;

const ADDRESS_META = {
  home: { title: 'Địa chỉ nhà', placeholder: 'Ví dụ: 12 Nguyễn Trãi, Quận 1, TP Hồ Chí Minh' },
  work: { title: 'Địa chỉ cơ quan', placeholder: 'Ví dụ: 45 Lê Lợi, Quận 1, TP Hồ Chí Minh' },
};

export default function AddressFormScreen({ route, navigation }: Props) {
  const { addressType } = route.params;
  const { homeAddress, workAddress, setAddress } = useAddresses();
  const meta = ADDRESS_META[addressType];
  const [value, setValue] = useState(addressType === 'home' ? homeAddress : workAddress);
  const [isSaving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await usersApi.updateProfile({ address: value.trim() });
      setAddress('home', updated.address ?? '');
      navigation.goBack();
    } catch (reason) {
      Alert.alert('Không thể lưu địa chỉ', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title={meta.title} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextField label={meta.title} value={value} onChangeText={setValue} placeholder={meta.placeholder} multiline textContentType="fullStreetAddress" />
          <AppButton label={isSaving ? 'Đang lưu…' : 'Lưu địa chỉ'} loading={isSaving} onPress={() => void handleSave()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: layout.gutter, paddingTop: space.md, paddingBottom: space.xxxl },
});
