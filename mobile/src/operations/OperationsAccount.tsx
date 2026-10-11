import React, { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, layout, radius, space, type } from '../theme';
import { operationsWebUrl } from '../config/operationsWeb';
import { usableRole } from '../utils/operationSession';
import { getApiSessionGeneration } from '../api/client';
import { getInitials } from '../utils/hash';
import { readWorkDay } from './staff/staffApi';
import { useOperations } from './OperationsContext';
import { OperationButton, OperationPage, OperationState } from './OperationPrimitives';

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
  const roleLabel = mode === 'OWNER' ? 'Chủ doanh nghiệp' : staffProfile?.professionalTitle || 'Nhân viên';
  const branchLabel = branches.find(branch => branch.id === branchId)?.name || 'Tất cả chi nhánh có quyền';
  return <OperationPage title="Tài khoản">
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.identity}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(user?.fullName ?? '')}</Text></View>
          <View style={styles.flex}>
            <Text style={styles.name}>{user?.fullName}</Text>
            {user?.email ? <Text style={styles.text}>{user.email}</Text> : null}
          </View>
        </View>
        <View style={styles.facts}>
          <Fact label="Vai trò" value={roleLabel} />
          <Fact label="Chi nhánh" value={branchLabel} />
          <Fact label="Chế độ" value={mode === 'OWNER' ? 'Theo dõi doanh nghiệp' : 'Công việc của tôi'} />
        </View>
      </View>

      {mode === 'OWNER' && canWorkAsStaff && <OperationButton label="Chuyển sang Công việc của tôi" icon="person-circle-outline" secondary onPress={() => setMode('STAFF')} />}
      {mode === 'STAFF' && usableRole(user, 'BUSINESS_OWNER') && <OperationButton label="Chuyển sang theo dõi doanh nghiệp" icon="grid-outline" secondary onPress={() => setMode('OWNER')} />}

      {mode === 'STAFF' && <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.cardTitle}>Dịch vụ được giao ngày {date.slice(8, 10)}/{date.slice(5, 7)}/{date.slice(0, 4)}</Text>
        {!canWorkAsStaff ? <Text style={styles.text}>Chưa có hồ sơ nhân viên hoặc quyền công việc phù hợp.</Text>
          : visibleWork?.loading || !visibleWork ? <Text style={styles.text}>Đang tải công việc…</Text>
            : visibleWork.error ? <OperationState tone="warning" message="Chưa tải được công việc. Vui lòng trở lại Hôm nay để thử lại." />
              : visibleWork.names.length ? visibleWork.names.map(name => <Text key={name} style={styles.bullet}>• {name}</Text>)
                : <Text style={styles.text}>Chưa có dịch vụ được giao trong ngày đã chọn.</Text>}
        <Text style={styles.note}>Theo lịch được giao, không phải danh mục chuyên môn hoặc toàn bộ dịch vụ của cơ sở.</Text>
      </View>}

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.cardTitle}>Phiên bản quản trị web</Text>
        <Text style={styles.text}>Thiết lập, tài chính và ngoại lệ phức tạp được xử lý trên web.</Text>
        {web ? <OperationButton label="Mở phiên bản quản trị web" icon="open-outline" secondary onPress={() => void Linking.openURL(web)} /> : <Text style={styles.note}>Chưa cấu hình địa chỉ phiên bản quản trị web.</Text>}
      </View>

      <Text style={styles.note}>Đổi doanh nghiệp cần đăng nhập lại để máy chủ cấp đúng phiên làm việc. Tài khoản vận hành không dùng để đặt lịch cá nhân.</Text>
      <OperationButton label="Đổi doanh nghiệp / đăng xuất" icon="log-out-outline" secondary danger onPress={() => void logout()} />
    </ScrollView>
  </OperationPage>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.gutter, paddingBottom: space.xxxl, gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: space.lg, borderRadius: radius.lg, gap: space.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...type.h3, color: colors.white },
  name: { ...type.h2 },
  facts: { borderTopWidth: 1, borderTopColor: colors.divider, marginTop: space.sm, paddingTop: space.sm, gap: space.sm },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  factLabel: { ...type.secondary },
  factValue: { ...type.secondaryStrong, color: colors.heading, flex: 1, textAlign: 'right' },
  cardTitle: { ...type.h3 },
  text: { ...type.body },
  bullet: { ...type.body, color: colors.heading },
  note: { ...type.secondary },
});
