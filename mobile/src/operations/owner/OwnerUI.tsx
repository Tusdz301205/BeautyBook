import React, { useEffect, useState } from 'react';
import { Linking, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../constants/colors';
import { useOperations } from '../OperationsContext';
import { OperationButton, OperationPage, OperationState, BranchPicker } from '../OperationPrimitives';
import { dateInZone } from '../../utils/operationSession';
import { shiftDate, validDate } from './policy';
import type { OwnerBooking } from '../../types/ownerOperations';
import { operationsWebUrl } from '../../config/operationsWeb';

const labels: Record<string, string> = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Chưa hoạt động', PAUSED: 'Tạm dừng', SUSPENDED: 'Tạm ngưng', DRAFT: 'Bản nháp', PENDING_REVIEW: 'Đang chờ duyệt', PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', CHECKED_IN: 'Khách đã đến', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Đã hoàn tất', CANCELLED: 'Đã hủy', REJECTED: 'Đã từ chối', EXPIRED: 'Hết hạn', NO_SHOW: 'Khách vắng mặt', SCHEDULED: 'Đã lên lịch', SKIPPED: 'Đã bỏ qua', OPEN: 'Chưa xử lý', READY_TO_COMPLETE: 'Sẵn sàng đóng', RESOLVED: 'Đã xử lý', PROCESSING: 'Đang xử lý', RESCHEDULE: 'Đổi lịch', CANCEL: 'Hủy lịch', STAFF_CHANGE: 'Đổi nhân viên', APPROVED_EXCEPTION: 'Giữ nguyên theo ngoại lệ' };
export const statusLabel = (status: string) => labels[status] ?? 'Trạng thái khác';
export function Card({ children }: { children: React.ReactNode }) { return <View style={styles.card}>{children}</View>; }
export function Heading({ children }: { children: React.ReactNode }) { return <Text accessibilityRole="header" style={styles.heading}>{children}</Text>; }
export function Body({ children }: { children: React.ReactNode }) { return <Text style={styles.body}>{children}</Text>; }
export function Meta({ children }: { children: React.ReactNode }) { return <Text style={styles.meta}>{children}</Text>; }
export function Note({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <View style={styles.group}><Body>Ghi chú xét duyệt / lý do</Body><TextInput accessibilityLabel="Ghi chú xét duyệt hoặc lý do" multiline value={value} onChangeText={onChange} maxLength={1000} style={styles.input} textAlignVertical="top" /></View>;
}
export function momentLabel(value: string | null, timezone: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Chưa có dữ liệu';
  // TIME-only values are wall clock fields, never infer a device-local instant.
  if (/^1970-01-01/.test(value)) return value.slice(11, 16);
  try { return new Intl.DateTimeFormat('vi-VN', { timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)); }
  catch { return 'Múi giờ chưa hợp lệ'; }
}
export function BookingSummary({ booking }: { booking: OwnerBooking }) {
  return <View style={styles.group}><Heading>{booking.customerName}</Heading><Body>{booking.code} · {statusLabel(booking.status)}</Body><Body>{booking.branchName}</Body><Meta>Ngày hẹn {booking.date} · {momentLabel(booking.start, booking.timezone)} – {momentLabel(booking.end, booking.timezone)}</Meta><Meta>Múi giờ: {booking.timezone}</Meta></View>;
}
export function DesktopLink() {
  const url = operationsWebUrl();
  const [failed, setFailed] = useState(false);
  return <View style={styles.group}>{url ? <OperationButton secondary label="Tiếp tục trên phiên bản quản trị" onPress={() => { setFailed(false); void Linking.openURL(url).catch(() => setFailed(true)); }} /> : <Meta>Chưa cấu hình địa chỉ phiên bản quản trị.</Meta>}{failed && <OperationState message="Chưa mở được phiên bản quản trị. Vui lòng thử lại." />}</View>;
}
export function OwnerFilters() {
  const operations = useOperations();
  const [draft, setDraft] = useState(operations.date), [invalid, setInvalid] = useState(false), [open, setOpen] = useState(false);
  useEffect(() => { setDraft(operations.date); setInvalid(false); }, [operations.date]);
  const reference = operations.branches.find(branch => branch.id === operations.branchId) ?? operations.branches[0];
  const today = () => {
    try { operations.setDate(dateInZone(reference?.timezone || 'Asia/Ho_Chi_Minh')); }
    catch { setInvalid(true); }
  };
  return <View style={styles.group}><BranchPicker inset={false} />
    <OperationButton secondary label={`Ngày ${operations.date} · Chọn ngày`} onPress={() => setOpen(true)} />
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 1 }}><OperationButton secondary label="Trước" disabled={!validDate(operations.date)} onPress={() => operations.setDate(shiftDate(operations.date, -1))} /></View>
      <View style={{ flex: 1 }}><OperationButton secondary label="Hôm nay" onPress={today} /></View>
      <View style={{ flex: 1 }}><OperationButton secondary label="Sau" disabled={!validDate(operations.date)} onPress={() => operations.setDate(shiftDate(operations.date, 1))} /></View>
    </View>
    <Meta>Ngày và số liệu theo múi giờ từng chi nhánh.</Meta>
    {invalid && <OperationState message="Chưa xác định được ngày trong múi giờ chi nhánh." />}
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}><OperationPage title="Chọn ngày"><View style={{ padding: 20, gap: 16 }}>
      <Body>Ngày theo lịch chi nhánh · YYYY-MM-DD</Body>
      <TextInput accessibilityLabel="Ngày xem tổng quan, định dạng năm-tháng-ngày" value={draft} onChangeText={setDraft} placeholder="YYYY-MM-DD" maxLength={10} style={styles.input} />
      {invalid && <OperationState message="Nhập ngày hợp lệ theo định dạng YYYY-MM-DD." />}
      <OperationButton label="Xem ngày đã chọn" onPress={() => { if (validDate(draft)) { operations.setDate(draft); setInvalid(false); setOpen(false); } else setInvalid(true); }} />
      <OperationButton secondary label="Đóng" onPress={() => setOpen(false)} />
    </View></OperationPage></Modal>
  </View>;
}
export function ReviewAction({ label, consequence, disabled, busy, onConfirm }: { label: string; consequence: string; disabled?: boolean; busy?: boolean; onConfirm: () => void }) {
  const [review, setReview] = useState(false);
  useEffect(() => { if (disabled || busy) setReview(false); }, [disabled, busy]);
  return <View style={styles.group}><OperationButton label={label} disabled={disabled} busy={busy} secondary onPress={() => setReview(true)} />{review && <Card><Body>{consequence}</Body><OperationButton label={`Xác nhận: ${label}`} disabled={disabled} busy={busy} onPress={() => { setReview(false); onConfirm(); }} /><OperationButton label="Quay lại xem xét" secondary onPress={() => setReview(false)} /></Card>}</View>;
}
export const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 12, marginBottom: 12 },
  heading: { color: colors.textDark, fontSize: 20, fontWeight: '700', lineHeight: 28 },
  body: { color: colors.textBody, fontSize: 16, lineHeight: 24 },
  meta: { color: colors.textGray, fontSize: 14, lineHeight: 22 },
  input: { color: colors.textDark, backgroundColor: colors.card, borderColor: colors.textGray, borderWidth: 1, borderRadius: 10, minHeight: 48, padding: 12, fontSize: 16 },
  group: { gap: 12, marginBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
});
