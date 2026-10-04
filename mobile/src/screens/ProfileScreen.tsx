import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AccountStackParamList } from '../navigation/AccountStack';
import { colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { useAddresses } from '../context/AddressContext';
import { getInitials } from '../utils/hash';
import { usersApi } from '../api/users';

type Props = NativeStackScreenProps<AccountStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const { user, userName, updateName } = useAuth();
  const { homeAddress, setAddress } = useAddresses();
  const nameParts = userName.trim().split(/\s+/);
  const initialLastName = nameParts[0] ?? '';
  const initialFirstName = nameParts.slice(1).join(' ');

  const [isEditing, setIsEditing] = useState(false);
  const [lastName, setLastName] = useState(initialLastName);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [email] = useState(user?.email ?? '');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void usersApi.profile().then((profile) => {
      if (!active) return;
      const parts = profile.fullName.trim().split(/\s+/);
      setLastName(parts[0] ?? '');
      setFirstName(parts.slice(1).join(' '));
      setPhone(profile.phone ?? '');
      setDob(profile.dateOfBirth?.slice(0, 10) ?? '');
      setGender(profile.gender ?? '');
      setAddress('home', profile.address ?? '');
      updateName(profile.fullName);
    }).catch(() => {
      // Authentication and global API handling already surface session failures.
    });
    return () => { active = false; };
  }, [updateName, setAddress]);

  const handleToggleEdit = async () => {
    if (isEditing) {
      const nextName = `${lastName} ${firstName}`.trim();
      if (!nextName) {
        Alert.alert('Thiếu thông tin', 'Họ tên không được để trống.');
        return;
      }
      setSaving(true);
      try {
        const updated = await usersApi.updateProfile({
          fullName: nextName,
          phone: phone.trim() || undefined,
          dateOfBirth: dob.trim() || undefined,
          gender: gender === 'MALE' || gender === 'FEMALE' || gender === 'OTHER' ? gender : undefined,
        });
        updateName(updated.fullName);
      } catch (reason) {
        Alert.alert('Không thể lưu hồ sơ', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
        return;
      } finally {
        setSaving(false);
      }
    }
    setIsEditing((prev) => !prev);
  };

  const FIELDS: { label: string; value: string; onChangeText?: (text: string) => void; editable: boolean }[] = [
    { label: 'Tên', value: firstName, onChangeText: setFirstName, editable: true },
    { label: 'Họ', value: lastName, onChangeText: setLastName, editable: true },
    { label: 'Số điện thoại di động', value: phone, onChangeText: setPhone, editable: true },
    { label: 'Email', value: email, editable: false },
    { label: 'Ngày sinh', value: dob, onChangeText: setDob, editable: true },
    { label: 'Giới tính', value: gender, onChangeText: setGender, editable: true },
  ];

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hồ sơ của tôi</Text>
        <View style={styles.backButton} />
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.editLink} activeOpacity={0.7} disabled={isSaving} onPress={() => void handleToggleEdit()}>
            <Text style={styles.editLinkText}>{isSaving ? 'Đang lưu...' : isEditing ? 'Lưu' : 'Chỉnh sửa'}</Text>
          </TouchableOpacity>

          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(userName)}</Text>
            </View>
          </View>
          <Text style={styles.name}>{userName}</Text>

          <View style={styles.divider} />

          {FIELDS.map((field) => (
            <View key={field.label} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              {isEditing && field.editable ? (
                <TextInput
                  style={styles.fieldInput}
                  value={field.value}
                  onChangeText={field.onChangeText}
                  placeholder="-"
                  placeholderTextColor={colors.textMuted}
                />
              ) : (
                <Text style={styles.fieldValue}>{field.value || '-'}</Text>
              )}
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Địa chỉ của tôi</Text>
        <TouchableOpacity
          style={styles.addressRow}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('AddressForm', { addressType: 'home' })}
        >
          <View style={styles.addressIcon}>
            <Ionicons name="home-outline" size={18} color={colors.textGray} />
          </View>
          <View style={styles.addressTextWrap}>
            <Text style={styles.addressLabel}>Địa chỉ</Text>
            <Text style={styles.addressValue}>
              {homeAddress || 'Thêm địa chỉ'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
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
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  editLink: {
    alignSelf: 'flex-end',
  },
  editLinkText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  avatarWrap: {
    position: 'relative',
    marginTop: 8,
    marginBottom: 14,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textDark,
    marginBottom: 16,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  fieldRow: {
    width: '100%',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    color: colors.textGray,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: colors.textDark,
    fontWeight: '600',
  },
  fieldInput: {
    fontSize: 16,
    color: colors.textDark,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textDark,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  addressIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressTextWrap: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  addressValue: {
    fontSize: 13,
    color: colors.textGray,
  },
});
