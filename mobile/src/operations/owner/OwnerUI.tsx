import { checkedInHistory } from '../../utils/bookingSchedule';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bookingTone, colors, layout, radius, space, tones, type, type Tone, fw } from '../../theme';
import { useOperations } from '../OperationsContext';
import { OperationButton, OperationState, BranchPicker } from '../OperationPrimitives';
import { dateInZone } from '../../utils/operationSession';
import { shiftDate, validDate } from './policy';
import type { OwnerBooking } from '../../types/ownerOperations';
import { operationsWebUrl } from '../../config/operationsWeb';
import { IconButton, SheetModal } from '../../ui';

const labels: Record<string, string> = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Chưa hoạt động', PAUSED: 'Tạm dừng', SUSPENDED: 'Tạm ngưng', DRAFT: 'Bản nháp', PENDING_REVIEW: 'Đang chờ duyệt', PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', CHECKED_IN: 'Khách đã đến', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Đã hoàn tất', CANCELLED: 'Đã hủy', REJECTED: 'Đã từ chối', EXPIRED: 'Hết hạn', NO_SHOW: 'Khách vắng mặt', SCHEDULED: 'Đã lên lịch', SKIPPED: 'Đã bỏ qua', OPEN: 'Chưa xử lý', READY_TO_COMPLETE: 'Sẵn sàng đóng', RESOLVED: 'Đã xử lý', PROCESSING: 'Đang xử lý', RESCHEDULE: 'Đổi lịch', CANCEL: 'Hủy lịch', STAFF_CHANGE: 'Đổi nhân viên', APPROVED_EXCEPTION: 'Giữ nguyên theo ngoại lệ' };
export const statusLabel = (status: string) => labels[status] ?? 'Trạng thái khác';

/** Lifecycle tone for a booking/item status; text label always accompanies it. */
export function StatusTag({ status, tone, label }: { status: string; tone?: Tone; label?: string }) {
  const look = bookingTone[status];
  const palette = tones[tone ?? look?.tone ?? 'neutral'];
  return <View style={[styles.tag, { backgroundColor: palette.bg }]}>
    {look ? <Ionicons accessible={false} name={look.icon as keyof typeof Ionicons.glyphMap} size={14} color={palette.fg} /> : null}
    <Text style={[styles.tagText, { color: palette.fg }]}>{label ?? statusLabel(status)}</Text>
  </View>;
}
export function Card({ children, tone }: { children: React.ReactNode; tone?: 'request' | 'warning' | 'brand' }) {
  const palette = tone ? tones[tone] : null;
  return <View style={[styles.card, palette && { borderLeftWidth: 4, borderLeftColor: palette.fg }]}>{children}</View>;
}
export function Heading({ children }: { children: React.ReactNode }) { return <Text accessibilityRole="header" style={styles.heading}>{children}</Text>; }
export function Body({ children }: { children: React.ReactNode }) { return <Text style={styles.body}>{children}</Text>; }
export function Meta({ children }: { children: React.ReactNode }) { return <Text style={styles.meta}>{children}</Text>; }
export function Note({ value, onChange, label = 'Ghi chú xét duyệt / lý do' }: { value: string; onChange: (value: string) => void; label?: string }) {
  const [focused, setFocused] = useState(false);
  return <View style={styles.group}>
    <Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} multiline value={value} onChangeText={onChange} maxLength={1000} style={[styles.input, styles.multiline, focused && styles.inputFocused]} textAlignVertical="top" placeholder="Nhập lý do rõ ràng để lưu vào lịch sử" placeholderTextColor={colors.disabledText} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
    <Text style={styles.counter}>{value.length}/1000</Text>
  </View>;
}
export function momentLabel(value: string | null, timezone: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Chưa có dữ liệu';
  // TIME-only values are wall clock fields, never infer a device-local instant.
  if (/^1970-01-01/.test(value)) return value.slice(11, 16);
  try { return new Intl.DateTimeFormat('vi-VN', { timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)); }
  catch { return 'Múi giờ chưa hợp lệ'; }
}
export function BookingSummary({ booking }: { booking: OwnerBooking }) {
  return <View style={styles.summary}>
    <View style={styles.summaryHead}>
      <Text accessibilityRole="header" style={styles.summaryName}>{booking.customerName}</Text>
      <StatusTag status={booking.status} label={checkedInHistory(booking.status, booking) ? 'Đã đến · Lịch đã qua' : undefined} />
    </View>
    <Text selectable style={styles.meta}>Mã lịch {booking.code} · {booking.branchName}</Text>
    <View style={styles.timeRow}>
      <Ionicons accessible={false} name="time-outline" size={16} color={colors.secondaryText} />
      <Text style={styles.time}>{momentLabel(booking.start, booking.timezone)} – {momentLabel(booking.end, booking.timezone)}</Text>
    </View>
    <Text style={styles.caption}>Ngày hẹn {viDate(booking.date)} · {zoneLabel(booking.timezone)}</Text>
  </View>;
}
export function DesktopLink() {
  const url = operationsWebUrl();
  const [failed, setFailed] = useState(false);
  return <View style={styles.group}>{url ? <OperationButton secondary icon="open-outline" label="Tiếp tục trên phiên bản quản trị" onPress={() => { setFailed(false); void Linking.openURL(url).catch(() => setFailed(true)); }} /> : <Meta>Chưa mở được trang quản trị. Hãy liên hệ quản lý.</Meta>}{failed && <OperationState tone="error" message="Chưa mở được phiên bản quản trị. Vui lòng thử lại." />}</View>;
}
/** Branch calendar date (YYYY-MM-DD) shown the Vietnamese way; unknown shapes pass through. */
export const viDate = (value: string) => validDate(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : value;
/** Reader-friendly zone label; the IANA id is kept only for zones without a common name. */
export const zoneLabel = (timezone: string) => timezone === 'Asia/Ho_Chi_Minh' ? 'giờ Việt Nam (GMT+7)' : `múi giờ ${timezone}`;
/** Branch + date context in one compact row, so “what needs a decision” stays near the top. */
export function OwnerFilters() {
  const operations = useOperations();
  const [draft, setDraft] = useState(operations.date), [invalid, setInvalid] = useState(false), [open, setOpen] = useState(false);
  useEffect(() => { setDraft(operations.date); setInvalid(false); }, [operations.date]);
  const reference = operations.branches.find(branch => branch.id === operations.branchId) ?? operations.branches[0];
  const today = () => {
    try { operations.setDate(dateInZone(reference?.timezone || 'Asia/Ho_Chi_Minh')); }
    catch { setInvalid(true); }
  };
  const valid = validDate(operations.date);
  return <View style={styles.filters}>
    <BranchPicker inset={false} />
    <View style={styles.dateRow}>
      <IconButton icon="chevron-back" label="Ngày trước" disabled={!valid} onPress={() => operations.setDate(shiftDate(operations.date, -1))} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Ngày ${viDate(operations.date)}. Chọn ngày khác`} onPress={() => setOpen(true)} style={({ pressed }) => [styles.dateButton, pressed && { backgroundColor: colors.surfacePressed }]}>
        <Ionicons accessible={false} name="calendar-outline" size={18} color={colors.secondary} />
        <Text style={styles.dateText}>{viDate(operations.date)}</Text>
      </Pressable>
      <IconButton icon="chevron-forward" label="Ngày sau" disabled={!valid} onPress={() => operations.setDate(shiftDate(operations.date, 1))} />
      <Pressable accessibilityRole="button" onPress={today} style={({ pressed }) => [styles.todayButton, pressed && { backgroundColor: colors.surfacePressed }]}><Text style={styles.todayText}>Hôm nay</Text></Pressable>
    </View>
    <Text style={styles.caption}>Ngày và số liệu theo múi giờ từng chi nhánh.</Text>
    {invalid && !open && <OperationState tone="warning" message="Chưa xác định được ngày trong múi giờ chi nhánh." />}
    <SheetModal visible={open} title="Chọn ngày" subtitle="Ngày theo lịch chi nhánh" onClose={() => setOpen(false)} footer={<OperationButton label="Xem ngày đã chọn" onPress={() => { if (validDate(draft)) { operations.setDate(draft); setInvalid(false); setOpen(false); } else setInvalid(true); }} />}>
      <Text style={styles.label}>Ngày (năm-tháng-ngày)</Text>
      <TextInput accessibilityLabel="Ngày xem tổng quan, định dạng năm-tháng-ngày" value={draft} onChangeText={setDraft} placeholder="YYYY-MM-DD" placeholderTextColor={colors.disabledText} maxLength={10} keyboardType="numbers-and-punctuation" style={styles.input} />
      {invalid && <Text style={styles.error}>Nhập ngày hợp lệ theo định dạng YYYY-MM-DD, ví dụ 2026-10-09.</Text>}
    </SheetModal>
  </View>;
}
/** Two-step decision: the first press only reveals the consequence; the second commits. */
export function ReviewAction({ label, consequence, disabled, busy, onConfirm, danger }: { label: string; consequence: string; disabled?: boolean; busy?: boolean; onConfirm: () => void; danger?: boolean }) {
  const [review, setReview] = useState(false);
  useEffect(() => { if (disabled || busy) setReview(false); }, [disabled, busy]);
  return <View style={styles.group}>
    {!review && <OperationButton label={label} disabled={disabled} busy={busy} secondary danger={danger} onPress={() => setReview(true)} />}
    {review && <View style={[styles.confirm, danger && styles.confirmDanger]}>
      <Text style={styles.confirmTitle}>Xác nhận thao tác</Text>
      <Body>{consequence}</Body>
      <OperationButton label={`Xác nhận: ${label}`} danger={danger} disabled={disabled} busy={busy} onPress={() => { setReview(false); onConfirm(); }} />
      <OperationButton label="Quay lại xem xét" secondary onPress={() => setReview(false)} />
    </View>}
  </View>;
}
export const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.md, marginBottom: space.md },
  heading: { ...type.h3 },
  body: { ...type.body },
  meta: { ...type.secondary },
  caption: { ...type.caption },
  label: { ...type.secondaryStrong, color: colors.heading },
  input: { ...type.body, color: colors.heading, backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: radius.md, minHeight: layout.inputMinHeight, paddingHorizontal: space.md, paddingVertical: space.sm },
  multiline: { minHeight: 96 },
  inputFocused: { borderColor: colors.primary, borderWidth: 2 },
  counter: { ...type.caption, alignSelf: 'flex-end' },
  error: { ...type.secondary, color: colors.error, marginTop: space.sm },
  group: { gap: space.sm, marginBottom: space.md },
  list: { paddingHorizontal: layout.gutter, paddingBottom: space.xxxl },
  tag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space.xs, borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: 3 },
  tagText: { ...type.caption, ...fw.semibold },
  summary: { gap: space.xs },
  summaryHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
  summaryName: { ...type.h3, flexShrink: 1 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, marginTop: space.xs },
  time: { ...type.clock, fontSize: 15 },
  filters: { gap: space.sm, marginBottom: space.lg },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dateButton: { flex: 1, minHeight: layout.touch - 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: space.md },
  dateText: { ...type.secondaryStrong, color: colors.heading, fontVariant: ['tabular-nums'] },
  todayButton: { minHeight: layout.touch - 4, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  todayText: { ...type.secondaryStrong, color: colors.primary },
  confirm: { gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: tones.request.border, backgroundColor: tones.request.bg },
  confirmDanger: { borderColor: tones.danger.border, backgroundColor: tones.danger.bg },
  confirmTitle: { ...type.secondaryStrong, color: colors.heading },
});
