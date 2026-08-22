import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
  Send,
  UserRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { branchesApi, staffApi } from '../../api/apiClient';
import { useAuthStore } from '../../store/authStore';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  InlineNotice,
  Input,
  MetricCard,
  Page,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from '../../components/ui';
import '../../styles/branch-operations.css';

const statusTone = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  CHECKED_IN: 'success',
  IN_PROGRESS: 'success',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};
const statusLabel = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đã check-in',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};
const hours = Array.from({ length: 17 }, (_, index) => index + 6);
const gridStartMinutes = 6 * 60;
const gridEndMinutes = 23 * 60;
const gridMinutes = gridEndMinutes - gridStartMinutes;

function dateKey(value) {
  return format(value, 'yyyy-MM-dd');
}

function rangeFor(view, anchor) {
  if (view === 'day') return { from: anchor, to: anchor };
  if (view === 'month') return {
    from: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
    to: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
  };
  return {
    from: startOfWeek(anchor, { weekStartsOn: 1 }),
    to: endOfWeek(anchor, { weekStartsOn: 1 }),
  };
}

function eventStyle(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const startMinute = start.getHours() * 60 + start.getMinutes();
  const endMinute = end.getHours() * 60 + end.getMinutes();
  const top = Math.max(0, ((startMinute - gridStartMinutes) / gridMinutes) * 100);
  const bottom = Math.min(100, ((endMinute - gridStartMinutes) / gridMinutes) * 100);
  return {
    top: `${top}%`,
    height: `${Math.max(1.5, bottom - top)}%`,
  };
}

function DayColumn({ day, data, onBooking }) {
  const key = dateKey(day);
  const shifts = data.shifts.filter((item) => item.date === key);
  const bookings = data.bookings.filter((item) => item.startAt.slice(0, 10) === key);
  const breaks = data.breaks.filter((item) => item.startAt.slice(0, 10) === key);
  const leave = data.leave.some((item) => new Date(item.startAt) <= new Date(`${key}T23:59:59`) && new Date(item.endAt) >= new Date(`${key}T00:00:00`));
  const attendance = data.attendance.find((item) => item.workDate.slice(0, 10) === key);
  const now = new Date();
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const showNow = isSameDay(day, now) && nowMinute >= gridStartMinutes && nowMinute <= gridEndMinutes;

  return (
    <div className="staff-calendar__day">
      <div className="staff-calendar__day-header">
        <span>{format(day, 'EEE', { locale: vi })}</span>
        <strong>{format(day, 'dd/MM')}</strong>
        {attendance && <Badge tone={attendance.status === 'LATE' || attendance.status === 'ABSENT' ? 'warning' : 'success'}>{attendance.status}</Badge>}
      </div>
      <div className="staff-calendar__day-body">
        {hours.map((hour) => <span key={hour} className="staff-calendar__hour-line" style={{ top: `${((hour * 60 - gridStartMinutes) / gridMinutes) * 100}%` }} />)}
        {shifts.map((shift) => <div key={shift.id} className="staff-calendar__shift" style={eventStyle(shift.startAt, shift.endAt)} title="Ca làm thực tế" />)}
        {breaks.map((item) => <div key={item.id} className="staff-calendar__break" style={eventStyle(item.startAt, item.endAt)}>Nghỉ</div>)}
        {leave && <div className="staff-calendar__leave">Nghỉ phép</div>}
        {bookings.map((booking) => (
          <button
            key={booking.id}
            type="button"
            className={`staff-calendar__booking is-${booking.status.toLowerCase()}`}
            style={eventStyle(booking.startAt, booking.endAt)}
            onClick={() => onBooking(booking)}
            title={`${booking.bookingCode} · ${booking.service.name}`}
          >
            <strong>{format(new Date(booking.startAt), 'HH:mm')} · {booking.customerName}</strong>
            <span>{booking.service.name}</span>
            <small>{statusLabel[booking.status] || booking.status}</small>
          </button>
        ))}
        {showNow && <span className="staff-calendar__now" style={{ top: `${((nowMinute - gridStartMinutes) / gridMinutes) * 100}%` }} />}
      </div>
    </div>
  );
}

function Timeline({ days, data, onBooking }) {
  return (
    <Card className="staff-calendar overflow-auto">
      <div className="staff-calendar__timeline" style={{ '--calendar-days': days.length }}>
        <div className="staff-calendar__hours">
          <div className="staff-calendar__day-header" />
          <div className="staff-calendar__hours-body">
            {hours.map((hour) => <span key={hour} style={{ top: `${((hour * 60 - gridStartMinutes) / gridMinutes) * 100}%` }}>{String(hour).padStart(2, '0')}:00</span>)}
          </div>
        </div>
        {days.map((day) => <DayColumn key={dateKey(day)} day={day} data={data} onBooking={onBooking} />)}
      </div>
    </Card>
  );
}

function MonthGrid({ days, anchor, data, onBooking }) {
  return (
    <Card className="overflow-x-auto">
      <div className="staff-calendar__month">
        {days.map((day) => {
          const key = dateKey(day);
          const bookings = data.bookings.filter((item) => item.startAt.slice(0, 10) === key);
          const shifts = data.shifts.filter((item) => item.date === key);
          const attendance = data.attendance.find((item) => item.workDate.slice(0, 10) === key);
          return (
            <div key={key} className={`staff-calendar__month-day ${day.getMonth() !== anchor.getMonth() ? 'is-outside' : ''}`}>
              <div className="flex items-center justify-between gap-2"><strong>{format(day, 'd')}</strong>{attendance && <span className="h-2 w-2 rounded-full bg-emerald-500" title={attendance.status} />}</div>
              <p className="mt-2 text-xs text-[var(--bb-muted)]">{shifts.length ? `${shifts.length} ca` : 'Không có ca'}</p>
              <div className="mt-2 space-y-1">
                {bookings.slice(0, 3).map((booking) => <button key={booking.id} onClick={() => onBooking(booking)} className="block w-full truncate rounded bg-[var(--bb-brand-soft)] px-2 py-1 text-left text-[11px] font-bold text-[var(--bb-brand-strong)]">{format(new Date(booking.startAt), 'HH:mm')} {booking.service.name}</button>)}
                {bookings.length > 3 && <span className="text-[11px] font-bold text-[var(--bb-muted)]">+{bookings.length - 3} booking</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function StaffSchedulePage() {
  const { staffId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const can = useAuthStore((state) => state.can);
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(new Date());
  const [branchId, setBranchId] = useState(searchParams.get('branchId') || '');
  const [branches, setBranches] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ effectiveFrom: today(), effectiveTo: '', reason: '', type: 'SINGLE_DAY' });
  const [submitting, setSubmitting] = useState(false);
  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const days = useMemo(() => eachDayOfInterval(range), [range.from.getTime(), range.to.getTime()]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const branchRows = branches.length ? branches : await branchesApi.getAccessible();
      if (!branches.length) setBranches(branchRows);
      const selected = branchId || branchRows[0]?.id || '';
      if (!branchId && selected) setBranchId(selected);
      const result = await staffApi.getScheduleView(staffId, {
        branchId: selected || undefined,
        from: dateKey(range.from),
        to: dateKey(range.to),
      });
      setData(result);
    } catch (requestError) {
      setError(requestError.message || 'Không thể tải lịch nhân viên');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [staffId, branchId, view, range.from.getTime(), range.to.getTime()]);

  const move = (direction) => {
    if (view === 'day') setAnchor((current) => addDays(current, direction));
    else if (view === 'month') setAnchor((current) => direction > 0 ? addMonths(current, 1) : subMonths(current, 1));
    else setAnchor((current) => direction > 0 ? addWeeks(current, 1) : subWeeks(current, 1));
  };

  const requestChange = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await staffApi.requestScheduleChange(staffId, {
        branchId: data.branchId,
        type: requestForm.type,
        effectiveFrom: requestForm.effectiveFrom,
        effectiveTo: requestForm.effectiveTo || undefined,
        proposedData: { note: requestForm.reason },
        reason: requestForm.reason,
      });
      toast.success('Đã gửi yêu cầu thay đổi lịch');
      setRequestOpen(false);
      await load();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openBooking = (booking) => navigate(`/salon/appointments?bookingId=${booking.bookingId}`);
  const title = view === 'day'
    ? format(anchor, 'EEEE, dd/MM/yyyy', { locale: vi })
    : view === 'month'
      ? format(anchor, 'MMMM yyyy', { locale: vi })
      : `${format(range.from, 'dd/MM')} – ${format(range.to, 'dd/MM/yyyy')}`;

  return (
    <Page className="max-w-[1600px]">
      <PageHeader
        eyebrow="Lịch thực tế của nhân viên"
        title={data?.staff?.fullName || 'Lịch nhân viên'}
        description="Ca định kỳ, ngày đặc biệt, nghỉ phép, booking và attendance được tổng hợp từ backend theo cùng một phạm vi."
        actions={can('staff_schedule:request_change:self') ? <Button variant="secondary" onClick={() => setRequestOpen(true)}><Send size={16} />Yêu cầu đổi lịch</Button> : null}
      />

      <Card className="grid gap-3 p-4 md:grid-cols-[auto_auto_minmax(12rem,1fr)_auto]">
        <div className="flex">
          <Button variant="secondary" className="rounded-r-none" onClick={() => move(-1)} aria-label="Khoảng trước"><ArrowLeft size={16} /></Button>
          <Button variant="secondary" className="rounded-none border-x-0" onClick={() => setAnchor(new Date())}>Hôm nay</Button>
          <Button variant="secondary" className="rounded-l-none" onClick={() => move(1)} aria-label="Khoảng sau"><ArrowRight size={16} /></Button>
        </div>
        <div className="flex rounded-xl bg-[var(--bb-surface-subtle)] p-1">
          {['day', 'week', 'month'].map((mode) => <button key={mode} type="button" onClick={() => setView(mode)} className={`min-h-10 rounded-lg px-3 text-sm font-bold ${view === mode ? 'bg-white text-[var(--bb-brand-strong)] shadow-sm' : 'text-[var(--bb-muted)]'}`}>{mode === 'day' ? 'Ngày' : mode === 'week' ? 'Tuần' : 'Tháng'}</button>)}
        </div>
        <div className="flex items-center px-2 font-bold">{title}</div>
        <div className="flex gap-2">
          <Select aria-label="Chi nhánh" value={branchId} onChange={(event) => setBranchId(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select>
          <Button variant="secondary" aria-label="Tải lại" onClick={load}><RefreshCw size={16} /></Button>
        </div>
      </Card>

      {loading ? <Card className="p-5"><Skeleton rows={10} /></Card> : error ? <Card><ErrorState message={error} onRetry={load} /></Card> : !data ? <Card><EmptyState title="Không có dữ liệu lịch" /></Card> : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard icon={Clock3} label="Phút trong ca" value={data.availability.shiftMinutes} />
            <MetricCard icon={CalendarDays} label="Phút đã có booking" value={data.availability.bookedMinutes} tone="info" />
            <MetricCard icon={CheckCircle2} label="Phút còn khả dụng" value={data.availability.availableMinutes} tone="success" />
            <MetricCard icon={UserRound} label="Utilization" value={`${data.availability.utilizationPercent}%`} />
            <MetricCard icon={MapPin} label="Xung đột" value={data.availability.conflicts.length} tone={data.availability.conflicts.length ? 'warning' : 'success'} />
          </div>

          {data.availability.conflicts.length > 0 && <InlineNotice tone="warning">Có booking chồng giờ. Hệ thống chỉ cảnh báo, không tự hủy hoặc tự phân công lại.</InlineNotice>}
          {view === 'month'
            ? <MonthGrid days={days} anchor={anchor} data={data} onBooking={openBooking} />
            : <Timeline days={days} data={data} onBooking={openBooking} />}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-bold">Yêu cầu thay đổi</h2>
              {!data.changeRequests.length ? <p className="mt-3 text-sm text-[var(--bb-muted)]">Không có yêu cầu trong phạm vi đang xem.</p> : <div className="mt-3 space-y-2">{data.changeRequests.map((request) => <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bb-surface-subtle)] p-3"><div><strong className="text-sm">{request.type}</strong><p className="mt-1 text-xs text-[var(--bb-muted)]">{request.reason}</p></div><Badge tone={request.status === 'APPROVED' ? 'success' : request.status === 'REJECTED' ? 'danger' : 'warning'}>{request.status}</Badge></div>)}</div>}
            </Card>
            <Card className="p-5">
              <h2 className="font-bold">Chú giải</h2>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-blue-100" />Ca làm</span>
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-pink-500" />Booking</span>
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-zinc-300" />Giờ nghỉ</span>
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded bg-amber-200" />Nghỉ phép/ngoại lệ</span>
              </div>
            </Card>
          </div>
        </div>
      )}

      <Dialog open={requestOpen} onClose={() => setRequestOpen(false)} title="Gửi yêu cầu thay đổi lịch" description="Yêu cầu không tự thay đổi lịch định kỳ hoặc booking hiện có." footer={<><Button variant="secondary" onClick={() => setRequestOpen(false)}>Hủy</Button><Button type="submit" form="schedule-request-form" loading={submitting}>Gửi yêu cầu</Button></>}>
        <form id="schedule-request-form" onSubmit={requestChange} className="grid gap-4">
          <Field label="Loại yêu cầu"><Select value={requestForm.type} onChange={(event) => setRequestForm((current) => ({ ...current, type: event.target.value }))}><option value="SINGLE_DAY">Đổi giờ một ngày</option><option value="LEAVE">Nghỉ phép</option></Select></Field>
          <Field label="Từ ngày" required><Input required type="date" value={requestForm.effectiveFrom} onChange={(event) => setRequestForm((current) => ({ ...current, effectiveFrom: event.target.value }))} /></Field>
          <Field label="Đến ngày"><Input type="date" min={requestForm.effectiveFrom} value={requestForm.effectiveTo} onChange={(event) => setRequestForm((current) => ({ ...current, effectiveTo: event.target.value }))} /></Field>
          <Field label="Lý do và đề xuất" required><Textarea required value={requestForm.reason} onChange={(event) => setRequestForm((current) => ({ ...current, reason: event.target.value }))} /></Field>
        </form>
      </Dialog>
    </Page>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
