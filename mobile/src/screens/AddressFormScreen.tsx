import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AccountStackParamList } from '../navigation/AccountStack';
import { colors } from '../constants/colors';
import { useAddresses } from '../context/AddressContext';
import { usersApi } from '../api/users';

type Props = NativeStackScreenProps<AccountStackParamList, 'AddressForm'>;

const ADDRESS_META = {
  home: { title: 'Địa chỉ nhà', icon: 'home-outline' as const, placeholder: 'Ví dụ: 12 Nguyễn Trãi, Quận 1, TP Hồ Chí Minh' },
  work: { title: 'Địa chỉ cơ quan', icon: 'briefcase-outline' as const, placeholder: 'Ví dụ: 45 Lê Lợi, Quận 1, TP Hồ Chí Minh' },
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
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{meta.title}</Text>
        <View style={styles.backButton} />
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.iconWrap}>
          <Ionicons name={meta.icon} size={30} color={colors.primary} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{meta.title}</Text>
          <TextInput
            style={styles.input}
            placeholder={meta.placeholder}
            placeholderTextColor={colors.textMuted}
            value={value}
            onChangeText={setValue}
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} disabled={isSaving} onPress={() => void handleSave()}>
          <Text style={styles.saveButtonText}>{isSaving ? 'ĐANG LƯU...' : 'LƯU ĐỊA CHỈ'}</Text>
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
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  field: {
    width: '100%',
    marginBottom: 24,
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
    minHeight: 90,
    textAlignVertical: 'top',
  },
  saveButton: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
