import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RecurringFrequency, RecurringPreview, RecurringStaffMode } from '../api/recurring';
import { slotClock, slotDate } from '../utils/bookingClock';
import { colors, fw, layout, radius, space, type } from '../theme';

interface Props {
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  frequency: RecurringFrequency;
  onFrequency: (value: RecurringFrequency) => void;
  count: string;
  onCount: (value: string) => void;
  staffMode: RecurringStaffMode;
  onStaffMode: (value: RecurringStaffMode) => void;
  hasStaff: boolean;
  skipConflicts: boolean;
  onSkipConflicts: (value: boolean) => void;
  preview: RecurringPreview | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  unsupported: boolean;
}

export default function BookingRecurrence(props: Props) {
  const check = (label: string, checked: boolean, onPress: () => void) => (
    <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={styles.row}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={colors.primary} />
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
  return <View style={styles.card}>
    {check('Lặp lại lịch hẹn này', props.enabled, () => props.onEnabled(!props.enabled))}
    <Text style={styles.hint}>Kiểm tra từng kỳ trước khi tạo chuỗi lịch.</Text>
    {props.unsupported && <Text style={styles.warning}>Lựa chọn dịch vụ này chỉ hỗ trợ đặt một lần. Hãy tắt lịch lặp để tiếp tục.</Text>}
    {props.enabled && <>
      <Text style={styles.label}>Tần suất</Text>
      <View style={styles.options}>{([['WEEKLY', 'Mỗi tuần'], ['BIWEEKLY', 'Mỗi 2 tuần'], ['MONTHLY', 'Mỗi tháng']] as const).map(([value, label]) =>
        <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: props.frequency === value }} style={[styles.option, props.frequency === value && styles.selected]} onPress={() => props.onFrequency(value)}><Text style={styles.label}>{label}</Text></TouchableOpacity>)}</View>
      <Text style={styles.label}>Số kỳ (2–52)</Text>
      <TextInput accessibilityLabel="Số kỳ lặp, từ 2 đến 52" keyboardType="number-pad" value={props.count} onChangeText={props.onCount} maxLength={3} style={styles.input} />
      <View style={styles.options}>{([['ANY_AVAILABLE', 'Bất kỳ người phù hợp'], ['SAME_STAFF', 'Giữ cùng chuyên viên']] as const).map(([value, label]) =>
        <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: props.staffMode === value, disabled: value === 'SAME_STAFF' && !props.hasStaff }} disabled={value === 'SAME_STAFF' && !props.hasStaff} style={[styles.option, props.staffMode === value && styles.selected]} onPress={() => props.onStaffMode(value)}><Text style={styles.label}>{label}</Text></TouchableOpacity>)}</View>
      {!props.hasStaff && <Text style={styles.hint}>Chọn chuyên viên ở bước 2 để giữ cùng người cho mọi kỳ.</Text>}
      {check('Bỏ qua kỳ xung đột, tạo các kỳ còn trống', props.skipConflicts, () => props.onSkipConflicts(!props.skipConflicts))}
      <Text style={styles.hint}>Voucher không áp dụng cho chuỗi lịch. Giá mỗi kỳ được xác định khi tạo. Lịch tháng được tính theo ngày bởi hệ thống; ngày cuối tháng có thể chuyển sang tháng kế tiếp.</Text>
      {props.loading && <ActivityIndicator color={colors.primary} />}
      {!!props.error && <><Text style={styles.warning}>{props.error}</Text><TouchableOpacity accessibilityRole="button" onPress={props.onRetry} style={styles.option}><Text style={styles.label}>Kiểm tra lại chuỗi lịch</Text></TouchableOpacity></>}
      {props.preview && <>
        <Text accessibilityLiveRegion="polite" style={styles.label}>{props.preview.availableCount} kỳ còn chỗ · {props.preview.conflictCount} kỳ xung đột{props.skipConflicts ? ' sẽ bỏ qua' : ''}</Text>
        {props.preview.occurrences.map((item, index) => <View key={`${item.appointmentDate}-${index}`} style={styles.occurrence}>
          <Text style={styles.label}>{index + 1}. {slotDate(item.appointmentDate)} · {slotClock(item.appointmentDate)}</Text>
          <Text style={item.available ? styles.hint : styles.warning}>{item.available ? 'Còn chỗ' : item.reason || 'Xung đột'}</Text>
        </View>)}
      </>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, marginBottom: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.touch },
  label: { ...type.secondaryStrong, color: colors.heading, flexShrink: 1 },
  hint: { ...type.secondary },
  warning: { ...type.secondary, color: colors.error },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: { minHeight: layout.touch, justifyContent: 'center', padding: space.sm, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  input: { minHeight: layout.inputMinHeight, ...type.body, ...fw.semibold, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, color: colors.heading },
  occurrence: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: space.sm, gap: space.xs },
});
