import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarClock, Clock3, Plus, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { bookingsApi, branchesApi, servicesApi, staffApi } from '../../api/apiClient';
import { Badge, Button, Dialog, Field, InlineNotice, Input, Select, Skeleton, Textarea, cx } from '../../components/ui';
import { AppointmentCalendarWorkspace } from '../Admin/AdminAppointmentsView';
import { useAuthStore } from '../../store/authStore';

const initialForm = { branchId: '', serviceId: '', staffId: '', guestName: '', guestPhone: '', date: format(new Date(), 'yyyy-MM-dd'), appointmentDate: '', manualStart: '', controlledOverbooking: false, overbookingReason: '', note: '' };

function WalkInDialog({ open, onClose, onCreated, canOverbook }) {
  const [form, setForm] = useState(initialForm);
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [slots, setSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    branchesApi.getAccessible().then((data) => {
      const rows = Array.isArray(data) ? data : data?.data || [];
      setBranches(rows);
      setForm((current) => ({ ...current, branchId: current.branchId || rows[0]?.id || '' }));
    }).catch((error) => toast.error(error.message));
  }, [open]);

  useEffect(() => {
    if (!form.branchId) { setServices([]); return; }
    servicesApi.getAll(form.branchId).then((data) => {
      const rows = Array.isArray(data) ? data : data?.data || [];
      setServices(rows);
      setForm((current) => ({ ...current, serviceId: rows.some((item) => item.id === current.serviceId) ? current.serviceId : rows[0]?.id || '', staffId: '' }));
    }).catch((error) => toast.error(error.message));
  }, [form.branchId]);

  useEffect(() => {
    if (!form.branchId || !form.serviceId) { setStaff([]); return; }
    staffApi.getPublic(form.branchId, [form.serviceId]).then((data) => setStaff(Array.isArray(data) ? data : [])).catch(() => setStaff([]));
  }, [form.branchId, form.serviceId]);

  const loadSlots = async () => {
    if (!form.branchId || !form.serviceId || !form.date) { setSlots([]); return; }
    setSlotLoading(true); setSlotError('');
    try {
      const result = await bookingsApi.availableSlots({ branchId: form.branchId, staffId: form.staffId, serviceIds: [form.serviceId], date: form.date });
      setSlots(result.slots || []);
      setForm((current) => ({ ...current, appointmentDate: (result.slots || []).some((slot) => slot.start === current.appointmentDate) ? current.appointmentDate : '' }));
    } catch (error) { setSlots([]); setSlotError(error.message || 'Không thể kiểm tra khung giờ'); }
    finally { setSlotLoading(false); }
  };
  useEffect(() => { void loadSlots(); }, [form.branchId, form.serviceId, form.staffId, form.date]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const selectedBranch = branches.find((branch) => branch.id === form.branchId);
  const walkInAllowed = selectedBranch?.bookingPolicy?.allowWalkIn !== false;
  const submit = async (event) => {
    event.preventDefault();
    if (!walkInAllowed) {
      toast.error('Chi nhánh hiện không nhận khách vãng lai'); return;
    }
    const selectedStart = form.controlledOverbooking ? form.manualStart : form.appointmentDate;
    if (!form.branchId || !form.serviceId || !form.guestName.trim() || !selectedStart) {
      toast.error('Nhập đủ chi nhánh, dịch vụ, tên khách và thời gian'); return;
    }
    if (form.controlledOverbooking && form.overbookingReason.trim().length < 10) {
      toast.error('Lý do overbooking phải có ít nhất 10 ký tự'); return;
    }
    const instant = new Date(selectedStart);
    if (Number.isNaN(instant.getTime()) || instant <= new Date()) {
      toast.error('Thời gian phải sau hiện tại'); return;
    }
    setSaving(true);
    try {
      await bookingsApi.create({
        branchId: form.branchId, serviceIds: [form.serviceId],
        staffId: form.staffId || undefined,
        guestName: form.guestName.trim(), guestPhone: form.guestPhone.trim() || undefined,
        appointmentDate: instant.toISOString(), note: form.note.trim() || undefined,
        source: 'WALK_IN',
        controlledOverbooking: form.controlledOverbooking,
        overbookingReason: form.controlledOverbooking ? form.overbookingReason.trim() : undefined,
      });
      toast.success('Đã tạo lịch tại quầy và giữ slot');
      setForm(initialForm); onCreated();
    } catch (error) { toast.error(error.message || 'Không thể tạo lịch tại quầy'); }
    finally { setSaving(false); }
  };

  return <Dialog open={open} onClose={onClose} title="Tạo lịch tại quầy" description="Khách vãng lai không cần tài khoản. Backend vẫn kiểm tra giờ mở cửa, dịch vụ, kỹ năng và xung đột slot." footer={<><Button variant="secondary" onClick={onClose}>Hủy</Button><Button type="submit" form="walk-in-form" loading={saving} disabled={!walkInAllowed}>Tạo lịch</Button></>}>
    <form id="walk-in-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Chi nhánh" required><Select value={form.branchId} onChange={set('branchId')}><option value="">Chọn chi nhánh</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
      {!walkInAllowed && <div className="sm:col-span-2"><InlineNotice tone="warning">Chi nhánh này đang tắt nhận khách vãng lai. Hãy chọn chi nhánh khác hoặc bật lại chính sách.</InlineNotice></div>}
      <Field label="Dịch vụ" required><Select value={form.serviceId} onChange={set('serviceId')}><option value="">Chọn dịch vụ</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
      <Field label="Nhân viên"><Select value={form.staffId} onChange={set('staffId')}><option value="">Bất kỳ nhân viên phù hợp</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</Select></Field>
      <Field label="Ngày phục vụ" required><Input type="date" min={format(new Date(), 'yyyy-MM-dd')} value={form.date} onChange={set('date')} /></Field>
      <Field label="Tên khách" required><Input value={form.guestName} onChange={set('guestName')} placeholder="Nguyễn Văn A" /></Field>
      <Field label="Số điện thoại"><Input type="tel" value={form.guestPhone} onChange={set('guestPhone')} /></Field>
      <div className="sm:col-span-2"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold">Khung giờ còn trống</p><p className="mt-1 text-xs text-[var(--bb-muted)]">Kết quả đã kiểm tra giờ mở cửa, kỹ năng và xung đột booking hiện tại.</p></div>{slots[0] && <Badge tone="success"><CalendarClock size={13} className="mr-1" />Gần nhất {format(parseISO(slots[0].start), 'HH:mm')}</Badge>}</div>{slotLoading ? <Skeleton rows={2} /> : slotError ? <InlineNotice tone="danger">{slotError} <button type="button" className="ml-1 font-bold underline" onClick={loadSlots}>Thử lại</button></InlineNotice> : !slots.length ? <InlineNotice tone="warning">Không còn khung giờ phù hợp trong ngày đã chọn. Hãy đổi ngày hoặc nhân viên.</InlineNotice> : <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">{slots.map((slot) => <button key={slot.start} type="button" aria-pressed={form.appointmentDate === slot.start} onClick={() => setForm((current) => ({ ...current, appointmentDate: slot.start }))} className={cx('min-h-11 rounded-lg border px-2 text-sm font-semibold', form.appointmentDate === slot.start ? 'border-[var(--bb-brand)] bg-[var(--bb-brand-soft)] text-[var(--bb-brand-strong)]' : 'border-[var(--bb-border)] hover:bg-[var(--bb-surface-subtle)]')}><Clock3 size={14} className="mr-1 inline" />{format(parseISO(slot.start), 'HH:mm')}</button>)}</div>}</div>
      {canOverbook && <div className="sm:col-span-2 rounded-xl border border-amber-300 bg-amber-50 p-4"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.controlledOverbooking} onChange={(event) => setForm((current) => ({ ...current, controlledOverbooking: event.target.checked, staffId: event.target.checked ? '' : current.staffId }))} /> Overbooking có kiểm soát</label><p className="mt-1 text-xs text-amber-800">Chỉ tạo lịch chưa phân công; không bỏ qua xung đột cứng của nhân viên. Scheduler sẽ hiển thị cảnh báo.</p>{form.controlledOverbooking && <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Thời gian ngoại lệ" required><Input type="datetime-local" value={form.manualStart} onChange={set('manualStart')} /></Field><Field label="Lý do phê duyệt" required><Input value={form.overbookingReason} onChange={set('overbookingReason')} placeholder="Nêu rõ lý do và phương án phân công" /></Field></div>}</div>}
      {form.serviceId && <div className="sm:col-span-2 rounded-xl bg-[var(--bb-surface-subtle)] p-4"><div className="flex flex-wrap gap-x-6 gap-y-2 text-sm"><span><b>Dịch vụ:</b> {services.find((item) => item.id === form.serviceId)?.name || '—'}</span><span><b>Thời lượng:</b> {services.find((item) => item.id === form.serviceId)?.durationMinutes || 0} phút</span><span><b>Giá:</b> {Number(services.find((item) => item.id === form.serviceId)?.price || 0).toLocaleString('vi-VN')}₫</span><span className="flex items-center gap-1"><UserRound size={15} /><b>Nhân viên:</b> {staff.find((item) => item.id === form.staffId)?.fullName || 'Hệ thống tự xếp'}</span></div></div>}
      <Field className="sm:col-span-2" label="Ghi chú vận hành" hint="Chỉ nhập thông tin cần thiết cho việc phục vụ và điều phối lịch."><Textarea value={form.note} onChange={set('note')} placeholder="Ví dụ: khách cần hỗ trợ di chuyển" /></Field>
    </form>
  </Dialog>;
}

export function SalonAppointments() {
  const can = useAuthStore((state) => state.can);
  const hasRoleAt = useAuthStore((state) => state.hasRoleAt);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const canCreateWalkIn = can('booking:create:branch') || can('booking:create:tenant') || can('booking:create:platform');
  const canOverbook = hasRoleAt('BUSINESS_OWNER') || hasRoleAt('BRANCH_MANAGER');
  return <>
    <AppointmentCalendarWorkspace zone="salon" externalRefreshKey={refreshKey} headerAction={canCreateWalkIn ? <Button onClick={() => setWalkInOpen(true)}><Plus size={16} />Tạo lịch tại quầy</Button> : null} />
    {canCreateWalkIn && <WalkInDialog open={walkInOpen} canOverbook={canOverbook} onClose={() => setWalkInOpen(false)} onCreated={() => { setWalkInOpen(false); setRefreshKey((value) => value + 1); }} />}
  </>;
}

export default SalonAppointments;
