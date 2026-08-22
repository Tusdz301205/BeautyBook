import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { addDays, addMonths, addWeeks, subDays, subMonths, subWeeks } from 'date-fns';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Filter, LayoutGrid, RefreshCw, Rows3, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { bookingsApi } from '../../../api/apiClient';
import { BOOKING_STATUSES } from '../../../constants/status';
import { useAuthStore } from '../../../store/authStore';
import { normalizeBooking, normalizeSchedulerResponse } from '../../../utils/bookingCalendar.adapter';
import {
  computeBookingStats,
  filterBookings,
  formatCalendarPeriod,
  getCalendarRange,
} from '../../../utils/bookingCalendar.utils';
import BookingDetailDrawer from './BookingDetailDrawer';
import { CalendarErrorState, CalendarLoadingSkeleton } from './CalendarStates';
import DayBookingsDrawer from './DayBookingsDrawer';
import SchedulerDayView from './SchedulerDayView';
import SchedulerMonthView from './SchedulerMonthView';
import SchedulerWeekView from './SchedulerWeekView';
import { Select } from '../../ui';

const VIEW_OPTIONS = [
  { id: 'day', label: 'Ngày', icon: Rows3 },
  { id: 'week', label: 'Tuần', icon: LayoutGrid },
  { id: 'month', label: 'Tháng', icon: CalendarDays },
];

const initialFilters = { query: '', staffId: '', serviceId: '', status: '' };
const attendanceWarningLabels = { ABSENT: 'vắng', MISSING_CHECKOUT: 'thiếu check-out', LATE: 'đi muộn', NOT_CHECKED_IN: 'chưa check-in' };

export default function SchedulerView({
  branchId,
  branchIds,
  branches = [],
  refreshKey = 0,
  viewMode = 'day',
  setViewMode,
  selectedDate,
  setSelectedDate,
  onStatsChange,
}) {
  const user = useAuthStore((state) => state.user);
  const can = useAuthStore((state) => state.can);
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date());
  const [staffList, setStaffList] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [searchParams] = useSearchParams();
  const requestSequence = useRef(0);
  const deepLinkHandled = useRef('');

  const activeBranchIds = useMemo(() => {
    const ids = branchIds?.length ? branchIds : branchId ? [branchId] : [];
    return [...new Set(ids)].sort();
  }, [branchId, branchIds]);
  const branchKey = activeBranchIds.join(',');
  const branchNames = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.branch_name || branch.name || 'Chi nhánh'])), [branches]);
  const roleCodes = useMemo(() => new Set([
    ...(user?.roles || []),
    ...(user?.scopes || []).map((scope) => scope.code),
  ]), [user]);
  const staffOnly = roleCodes.has('STAFF') && !['PLATFORM_ADMIN', 'BUSINESS_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'].some((role) => roleCodes.has(role));

  useEffect(() => {
    if (selectedDate) setCurrentDate(selectedDate);
  }, [selectedDate]);

  const range = useMemo(() => getCalendarRange(viewMode, currentDate), [currentDate, viewMode]);

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    const scopedBranchIds = branchKey ? branchKey.split(',') : [];
    const requestId = ++requestSequence.current;
    if (scopedBranchIds.length === 0) {
      setStaffList([]);
      setBookings([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError('');
    try {
      const payloads = await Promise.all(scopedBranchIds.map(async (scopedBranchId) => ({
        branchId: scopedBranchId,
        payload: await bookingsApi.getScheduler(scopedBranchId, range.start.toISOString(), range.end.toISOString()),
      })));
      if (requestId !== requestSequence.current) return;
      const multiBranch = scopedBranchIds.length > 1;
      const staffById = new Map();
      const bookingById = new Map();
      payloads.forEach(({ branchId: scopedBranchId, payload }) => {
        const normalized = normalizeSchedulerResponse(payload);
        const branchName = branchNames.get(scopedBranchId) || 'Chi nhánh';
        normalized.staff.forEach((staff) => staffById.set(staff.id, {
          ...staff,
          branchId: scopedBranchId,
          name: multiBranch ? `${staff.name} · ${branchName}` : staff.name,
        }));
        normalized.bookings.forEach((booking) => bookingById.set(booking.id, {
          ...booking,
          branchId: booking.branchId || scopedBranchId,
          branchName: booking.branchName || branchName,
        }));
      });
      setStaffList([...staffById.values()]);
      setBookings([...bookingById.values()]);
    } catch (requestError) {
      if (requestId !== requestSequence.current) return;
      setError(requestError.message || 'Không thể tải lịch hẹn.');
    } finally {
      if (!silent && requestId === requestSequence.current) setLoading(false);
    }
  }, [branchKey, branchNames, range.end, range.start, refreshKey]);

  useEffect(() => {
    setSelectedBooking(null);
    setSelectedDay(null);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const bookingId = searchParams.get('bookingId');
    if (!bookingId || deepLinkHandled.current === bookingId) return;
    deepLinkHandled.current = bookingId;
    let active = true;
    bookingsApi.getById(bookingId)
      .then((payload) => {
        if (!active) return;
        const normalized = normalizeBooking(payload);
        setSelectedBooking(normalized);
        if (normalized.startAt && !Number.isNaN(normalized.startAt.getTime())) {
          setCurrentDate(normalized.startAt);
          setSelectedDate?.(normalized.startAt);
        }
      })
      .catch((requestError) => {
        if (active) toast.error(requestError.message || 'Không thể mở lịch hẹn từ thông báo.');
      });
    return () => { active = false; };
  }, [searchParams, setSelectedDate]);

  useEffect(() => {
    if (!staffOnly || filters.staffId || staffList.length === 0) return;
    const ownProfile = staffList.find((staff) => staff.userId === user.id) || staffList[0];
    if (ownProfile) setFilters((current) => ({ ...current, staffId: ownProfile.id }));
  }, [filters.staffId, staffList, staffOnly, user]);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_WS_URL || window.location.origin;
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: (callback) => callback({ token: useAuthStore.getState().accessToken }),
    });
    const refresh = () => fetchData({ silent: true });
    socket.on('booking_updated', refresh);
    socket.on('booking_created', refresh);
    socket.on('booking_deleted', refresh);
    return () => socket.disconnect();
  }, [fetchData]);

  const serviceOptions = useMemo(() => {
    const services = new Map();
    bookings.forEach((booking) => booking.services.forEach((service) => {
      if (service.id) services.set(service.id, service.name);
    }));
    return [...services].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [bookings]);

  const filteredBookings = useMemo(() => filterBookings(bookings, filters), [bookings, filters]);
  const attendanceWarnings = useMemo(() => {
    const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
    const bookingStatuses = new Set(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS']);
    return staffList.flatMap((staff) => {
      const rows = (staff.attendances || []).filter((attendance) => ['ABSENT', 'MISSING_CHECKOUT', 'LATE', 'NOT_CHECKED_IN'].includes(attendance.status));
      const hasAttendanceToday = (staff.attendances || []).some((attendance) => String(attendance.workDate || '').slice(0, 10) === todayKey);
      const hasBookingToday = bookings.some((booking) => booking.primaryStaffId === staff.id && bookingStatuses.has(booking.status) && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(booking.startAt) === todayKey);
      if (!hasAttendanceToday && hasBookingToday) rows.push({ status: 'NOT_CHECKED_IN', workDate: todayKey });
      return rows.map((attendance) => ({ ...attendance, staffName: staff.name }));
    });
  }, [bookings, staffList]);
  const stats = useMemo(() => computeBookingStats(filteredBookings), [filteredBookings]);
  const platformWorkspace = user?.workspace === 'PLATFORM' || roleCodes.has('PLATFORM_ADMIN');
  const canUpdate = !platformWorkspace && !staffOnly && activeBranchIds.length === 1 && (can('booking:update:branch') || can('booking:update:tenant'));

  useEffect(() => {
    onStatsChange?.(stats, formatCalendarPeriod(viewMode, currentDate));
  }, [currentDate, onStatsChange, stats, viewMode]);

  const changeDate = (date) => {
    setCurrentDate(date);
    setSelectedDate?.(date);
  };

  const navigate = (direction) => {
    const operations = {
      day: direction < 0 ? subDays : addDays,
      week: direction < 0 ? subWeeks : addWeeks,
      month: direction < 0 ? subMonths : addMonths,
    };
    changeDate(operations[viewMode](currentDate, 1));
  };

  const moveBooking = async (booking, startAt, endAt, staffId) => {
    const previous = bookings;
    setBookings((items) => items.map((item) => item.id === booking.id
      ? { ...item, startAt, endAt, primaryStaffId: staffId, primaryStaffName: staffList.find((staff) => staff.id === staffId)?.name }
      : item));
    try {
      await bookingsApi.moveBooking(booking.id, startAt.toISOString(), endAt.toISOString(), staffId);
      toast.success('Đã cập nhật lịch hẹn');
      fetchData({ silent: true });
    } catch (requestError) {
      setBookings(previous);
      toast.error(requestError.message || 'Không thể di chuyển lịch hẹn');
    }
  };

  const resizeBooking = async (booking, endAt) => {
    const previous = bookings;
    setBookings((items) => items.map((item) => item.id === booking.id ? { ...item, endAt } : item));
    try {
      await bookingsApi.resizeBooking(booking.id, endAt.toISOString());
      toast.success('Đã cập nhật thời lượng');
      fetchData({ silent: true });
    } catch (requestError) {
      setBookings(previous);
      toast.error(requestError.message || 'Không thể cập nhật thời lượng');
    }
  };

  const openDay = (date, dayBookings = []) => setSelectedDay({ date, bookings: dayBookings });

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-zinc-200 bg-white px-3 py-3 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-zinc-200 bg-white">
              <IconButton label="Khoảng trước" onClick={() => navigate(-1)}><ChevronLeft size={18} /></IconButton>
              <button type="button" onClick={() => changeDate(new Date())} className="min-h-11 border-x border-zinc-200 px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">Hôm nay</button>
              <IconButton label="Khoảng sau" onClick={() => navigate(1)}><ChevronRight size={18} /></IconButton>
            </div>
            <p className="min-w-[190px] text-base font-bold text-zinc-950 sm:text-lg">{formatCalendarPeriod(viewMode, currentDate)}</p>
            <IconButton label="Làm mới lịch" onClick={() => fetchData()}><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></IconButton>
          </div>

          <div className="flex w-fit items-center rounded-xl bg-zinc-100 p-1" role="group" aria-label="Chế độ xem lịch">
            {VIEW_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setViewMode?.(id)} aria-pressed={viewMode === id} className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition ${viewMode === id ? 'bg-white text-pink-700 shadow-sm' : 'text-zinc-600 hover:text-zinc-950'}`}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex min-h-10 items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-zinc-500"><Filter size={14} /> Bộ lọc</span>
          <label className="relative min-w-[210px] flex-1 sm:max-w-[280px]">
            <span className="sr-only">Tìm khách hàng hoặc mã lịch</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Khách hàng hoặc mã lịch" className="min-h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm font-medium text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-100" />
          </label>
          <FilterSelect label={staffOnly ? 'Lịch cá nhân' : 'Tất cả nhân viên'} value={filters.staffId} disabled={staffOnly} onChange={(staffId) => setFilters((current) => ({ ...current, staffId }))} options={staffList.map((staff) => ({ id: staff.id, name: staff.name }))} />
          <FilterSelect label="Tất cả dịch vụ" value={filters.serviceId} onChange={(serviceId) => setFilters((current) => ({ ...current, serviceId }))} options={serviceOptions} />
          <FilterSelect label="Tất cả trạng thái" value={filters.status} onChange={(status) => setFilters((current) => ({ ...current, status }))} options={Object.entries(BOOKING_STATUSES).map(([id, status]) => ({ id, name: status.label }))} />
          {(filters.query || filters.serviceId || filters.status || (!staffOnly && filters.staffId)) && <button type="button" onClick={() => setFilters((current) => ({ ...initialFilters, staffId: staffOnly ? current.staffId : '' }))} className="min-h-10 px-2 text-sm font-semibold text-pink-700 hover:underline">Xóa lọc</button>}
          <span className="ml-auto text-xs font-medium text-zinc-500">{filteredBookings.length} lịch trong phạm vi đang xem</span>
        </div>
        {attendanceWarnings.length > 0 && <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="status"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span><strong>Cảnh báo chấm công:</strong> {attendanceWarnings.slice(0, 4).map((item) => `${item.staffName} (${attendanceWarningLabels[item.status] || item.status})`).join(', ')}{attendanceWarnings.length > 4 ? ` và ${attendanceWarnings.length - 4} trường hợp khác` : ''}. Hệ thống không tự hủy lịch; nhân viên đã đánh dấu vắng sẽ bị chặn nhận lịch mới trong ngày.</span></div>}
      </div>

      <div className="min-h-0 flex-1">
        {loading ? <CalendarLoadingSkeleton /> : error ? <CalendarErrorState message={error} onRetry={() => fetchData()} /> : (
          <>
            {filteredBookings.length === 0 && <div role="status" className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-center text-xs font-medium text-zinc-600">Không có lịch hẹn phù hợp; khung thời gian vẫn được giữ để bạn xem lịch trống.</div>}
            {viewMode === 'day' && <SchedulerDayView currentDate={currentDate} staffList={staffList} bookings={filteredBookings} onBookingClick={setSelectedBooking} onMoveBooking={canUpdate ? moveBooking : undefined} onResizeBooking={canUpdate ? resizeBooking : undefined} />}
            {viewMode === 'week' && <SchedulerWeekView currentDate={currentDate} bookings={filteredBookings} onBookingClick={setSelectedBooking} />}
            {viewMode === 'month' && <SchedulerMonthView currentDate={currentDate} bookings={filteredBookings} onDateClick={openDay} />}
          </>
        )}
      </div>

      <DayBookingsDrawer
        date={selectedDay?.date}
        bookings={selectedDay?.bookings || []}
        onClose={() => setSelectedDay(null)}
        onOpenBooking={(booking) => { setSelectedDay(null); setSelectedBooking(booking); }}
        onOpenDay={() => { changeDate(selectedDay.date); setSelectedDay(null); setViewMode?.('day'); }}
      />
      <BookingDetailDrawer booking={selectedBooking} onClose={() => setSelectedBooking(null)} onUpdated={() => { setSelectedBooking(null); fetchData({ silent: true }); }} />
    </div>
  );
}

function IconButton({ label, onClick, children }) {
  return <button type="button" onClick={onClick} className="grid h-11 w-11 place-items-center rounded-xl text-zinc-600 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" aria-label={label} title={label}>{children}</button>;
}

function FilterSelect({ label, value, onChange, options, disabled = false }) {
  return (
    <Select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="max-w-[220px]" aria-label={label} searchable={options.length >= 8}>
      <option value="">{label}</option>
      {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
    </Select>
  );
}
