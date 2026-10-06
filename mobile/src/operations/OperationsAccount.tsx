import React, { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import { operationsWebUrl } from '../config/operationsWeb';
import { usableRole } from '../utils/operationSession';
import { getApiSessionGeneration } from '../api/client';
import { readWorkDay } from './staff/staffApi';
import { useOperations } from './OperationsContext';
import { OperationButton, OperationPage } from './OperationPrimitives';

export default function OperationsAccount() {
  const { user, logout } = useAuth();
  const { branches, branchId, staffProfile, canWorkAsStaff, mode, setMode, date, contextKey, revision } = useOperations();
  const key = `${contextKey}:${date}`;
  const current = useRef(key); current.current = key;
  const [work, setWork] = useState<{ key: string; names: string[]; loading: boolean; error: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    const generation = getApiSessionGeneration();
    const valid = () => active && current.current === key && generation === getApiSessionGeneration();
    if (mode !== 'STAFF' || !canWorkAsStaff || !branchId) { setWork(null); return; }
    setWork({ key, names: [], loading: true, error: false });
    void readWorkDay({ branchId, dateFrom: date, dateTo: date }, valid).then(result => {
      if (valid()) setWork({ key, names: [...new Set(result.data.map(item => item.serviceNameSnapshot || 'Dịch vụ chưa có tên'))], loading: false, error: false });
    }).catch(() => { if (valid()) setWork({ key, names: [], loading: false, error: true }); });
    return () => { active = false; };
  }, [key, revision, mode, canWorkAsStaff, branchId, date]);
  const visibleWork = work?.key === key ? work : null;
  const web = operationsWebUrl();
  return <OperationPage title="Tài khoản"><ScrollView contentContainerStyle={styles.content}><View style={styles.card}><Text style={styles.name}>{user?.fullName}</Text><Text style={styles.text}>{user?.email}</Text><Text style={styles.text}>{mode === 'OWNER' ? 'Chủ doanh nghiệp' : staffProfile?.professionalTitle || 'Nhân viên'}</Text><Text style={styles.text}>{branches.find(branch => branch.id === branchId)?.name || 'Tất cả chi nhánh có quyền'}</Text></View>{mode === 'STAFF' && <View style={styles.card}>
<Text accessibilityRole="header" style={styles.name}>Dịch vụ được giao ngày {date}</Text>
{!canWorkAsStaff ? <Text style={styles.text}>Chưa có hồ sơ nhân viên hoặc quyền công việc phù hợp.</Text> : visibleWork?.loading || !visibleWork ? <Text style={styles.text}>Đang tải công việc…</Text> : visibleWork.error ? <Text style={styles.text}>Chưa tải được công việc. Vui lòng trở lại Hôm nay để thử lại.</Text> : visibleWork.names.length ? visibleWork.names.map(name => <Text key={name} style={styles.text}>{name}</Text>) : <Text style={styles.text}>Chưa có dịch vụ được giao trong ngày đã chọn.</Text>}
<Text style={styles.text}>Theo lịch được giao, không phải danh mục chuyên môn hoặc toàn bộ dịch vụ của cơ sở.</Text>
</View>}{mode === 'OWNER' && canWorkAsStaff && <OperationButton label="Công việc của tôi" onPress={() => setMode('STAFF')} />}{mode === 'STAFF' && usableRole(user, 'BUSINESS_OWNER') && <OperationButton label="Theo dõi doanh nghiệp" onPress={() => setMode('OWNER')} />}<Text style={styles.text}>Đổi doanh nghiệp cần đăng nhập lại để máy chủ cấp đúng phiên làm việc. Tài khoản vận hành không dùng để đặt lịch cá nhân.</Text>{web ? <OperationButton label="Mở phiên bản quản trị web" secondary onPress={() => void Linking.openURL(web)} /> : <Text style={styles.text}>Chưa cấu hình địa chỉ phiên bản quản trị web.</Text>}<OperationButton label="Đổi doanh nghiệp / đăng xuất" secondary onPress={() => void logout()} /></ScrollView></OperationPage>;
}
const styles = StyleSheet.create({ content: { padding: 20, gap: 18 }, card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 20, borderRadius: 20, gap: 8 }, name: { fontSize: 23, fontWeight: '800', color: colors.textDark }, text: { fontSize: 16, lineHeight: 24, color: colors.textBody } });
