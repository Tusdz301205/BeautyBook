import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AccountStackParamList } from '../navigation/AccountStack';
import { colors, layout, space, type } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useAddresses } from '../context/AddressContext';
import { getInitials } from '../utils/hash';
import { usersApi } from '../api/users';
import { AppButton, Card, Chip, ListRow, ScreenHeader, TextField } from '../ui';

type Props = NativeStackScreenProps<AccountStackParamList, 'Profile'>;

const GENDERS = [{ value: 'FEMALE', label: 'Nữ' }, { value: 'MALE', label: 'Nam' }, { value: 'OTHER', label: 'Khác' }];
const genderLabel = (value: string) => GENDERS.find((item) => item.value === value)?.label ?? '';

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

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Hồ sơ của tôi" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.identity}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(userName)}</Text></View>
            <Text style={styles.name}>{userName}</Text>
            {email ? <Text style={styles.email}>{email}</Text> : null}
          </View>

          {isEditing ? (
            <View>
              <TextField label="Họ" value={lastName} onChangeText={setLastName} autoCapitalize="words" textContentType="familyName" />
              <TextField label="Tên" value={firstName} onChangeText={setFirstName} autoCapitalize="words" textContentType="givenName" />
              <TextField label="Số điện thoại" optional value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" />
              <TextField label="Ngày sinh" optional value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" helper="Định dạng năm-tháng-ngày, ví dụ 1995-08-21." keyboardType="numbers-and-punctuation" />
              <Text style={styles.fieldLabel}>Giới tính <Text style={styles.optional}>· không bắt buộc</Text></Text>
              <View accessibilityRole="radiogroup" style={styles.chips}>
                {GENDERS.map((item) => <Chip key={item.value} role="radio" label={item.label} selected={gender === item.value} onPress={() => setGender(item.value)} />)}
              </View>
              <TextField label="Email" value={email} editable={false} helper="Email đăng nhập không đổi trên ứng dụng." />
            </View>
          ) : (
            <Card padded={false}>
              <ListRow label="Họ và tên" detail={`${lastName} ${firstName}`.trim() || '—'} divider />
              <ListRow label="Số điện thoại" detail={phone || 'Chưa cập nhật'} divider />
              <ListRow label="Ngày sinh" detail={dob || 'Chưa cập nhật'} divider />
              <ListRow label="Giới tính" detail={genderLabel(gender) || 'Chưa cập nhật'} />
            </Card>
          )}

          <AppButton
            variant={isEditing ? 'primary' : 'outline'}
            icon={isEditing ? 'checkmark' : 'create-outline'}
            label={isSaving ? 'Đang lưu…' : isEditing ? 'Lưu thay đổi' : 'Chỉnh sửa hồ sơ'}
            loading={isSaving}
            onPress={() => void handleToggleEdit()}
            style={styles.action}
          />

          <Text accessibilityRole="header" style={styles.groupTitle}>Địa chỉ của tôi</Text>
          <Card padded={false}>
            <ListRow icon="home-outline" label="Địa chỉ" detail={homeAddress || 'Thêm địa chỉ'} onPress={() => navigation.navigate('AddressForm', { addressType: 'home' })} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: layout.gutter, paddingBottom: space.xxxl },
  identity: { alignItems: 'center', paddingVertical: space.xl, gap: space.xs },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  avatarText: { ...type.h2, color: colors.white },
  name: { ...type.h2, textAlign: 'center' },
  email: { ...type.secondary },
  fieldLabel: { ...type.secondaryStrong, color: colors.heading, marginBottom: space.sm },
  optional: { ...type.secondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  action: { marginTop: space.lg },
  groupTitle: { ...type.overline, marginTop: space.xxl, marginBottom: space.sm },
});
