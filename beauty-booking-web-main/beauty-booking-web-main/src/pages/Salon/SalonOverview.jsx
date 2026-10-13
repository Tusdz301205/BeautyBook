import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  CreditCard,
  MapPin,
  Scissors,
  Star,
  TrendingUp,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { bookingsApi, branchesApi, paymentsApi, reportsApi, reviewsApi, servicesApi, staffApi } from '../../api/apiClient';
import { Badge, Card, EmptyState, ErrorState, Field, InlineNotice, Input, MetricCard, Page, PageHeader, Select, Skeleton } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { normalizeBooking } from '../../utils/bookingCalendar.adapter';
import { FINANCE_WORKSPACE_ENABLED } from '../../config/featureAvailability';
import { captureSessionGeneration, isSessionGenerationCurrent } from '../../utils/sessionGeneration';

const TONES = { PENDING: 'warning', CONFIRMED: 'info', CHECKED_IN: 'info', IN_PROGRESS: 'brand', COMPLETED: 'success', CANCELLED: 'danger', NO_SHOW: 'neutral', EXPIRED: 'neutral' };
const LABELS = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', CHECKED_IN: 'Đã đến', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', NO_SHOW: 'Không đến', EXPIRED: 'Hết hạn giữ chỗ' };
const DATA_LABELS = { bookings: 'lịch hẹn', services: 'dịch vụ', staff: 'nhân sự', reviews: 'đánh giá', payments: 'thanh toán', overview: 'tổng quan', dashboard: 'phân tích' };
const emptyData = () => ({ bookingCount: null, pendingCount: null, completedCount: null, upcoming: null, services: [], staff: [], reviews: [], payments: [], overview: null, dashboard: null });
const UPCOMING_LIMIT = 6;
const ACTIVE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS']);
const bookingTotal = (response) => {
  if (!Number.isSafeInteger(response?.meta?.total) || response.meta.total < 0) throw new Error('Dữ liệu lịch hẹn không hợp lệ. Vui lòng thử lại.');
  return response.meta.total;
};
// The API filters appointmentDate only. Page past elapsed appointments today
// until we have the earliest six future rows (or exhaust this status group).
async function nextAppointments(params, now, isCurrent) {
  const rows = [];
  for (let page = 1; ; page += 1) {
    if (!isCurrent()) return [];
    const result = await bookingsApi.getAll({ ...params, sortOrder: 'appointment', page, limit: UPCOMING_LIMIT });
    if (!isCurrent()) return [];
    const total = bookingTotal(result);
    if (!Array.isArray(result.data) || (!result.data.length && total > (page - 1) * UPCOMING_LIMIT)) throw new Error('Dữ liệu lịch hẹn không hợp lệ. Vui lòng thử lại.');
    rows.push(...result.data.map(normalizeBooking).filter((booking) => ACTIVE_STATUSES.has(booking.status) && booking.startAt >= now));
    if (rows.length >= UPCOMING_LIMIT || page * UPCOMING_LIMIT >= total) return rows.slice(0, UPCOMING_LIMIT);
  }
}
const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}₫`;
const axisMoney = (value) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1000000) return `${Number((amount / 1000000).toFixed(1)).toLocaleString('vi-VN')}tr`;
  if (Math.abs(amount) >= 1000) return `${Number((amount / 1000).toFixed(1)).toLocaleString('vi-VN')}k`;
  return amount.toLocaleString('vi-VN');
};
const statusLabel = (value) => LABELS[value] || value;
const CHART_COLORS = [
  'var(--bb-warning)',
  'var(--bb-info)',
  'var(--bb-brand)',
  'var(--bb-brand-strong)',
  'var(--bb-success)',
  'var(--bb-danger)',
  'var(--bb-muted)',
];

export function SalonOverview() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const can = useAuthStore((state) => state.can);
  const roles = useMemo(() => new Set([...(user?.roles || []), ...(user?.scopes || []).map((scope) => scope.code)]), [user]);
  const owner = roles.has('BUSINESS_OWNER');
  const financeAllowed = FINANCE_WORKSPACE_ENABLED && (can('payment:read:tenant') || can('report:revenue:tenant'));
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const generation = captureSessionGeneration();
  // User metadata includes the active business/branch scopes used by the API.
  const context = useMemo(() => ({ user, accessToken, generation }), [user, accessToken, generation]);
  const currentContext = useRef(context);
  currentContext.current = context;
  const branchRequest = useRef(0);
  const dashboardRequest = useRef(0);
  const isCurrentContext = useCallback(() => {
    const session = useAuthStore.getState();
    return currentContext.current === context && session.user === user
      && session.accessToken === accessToken && isSessionGenerationCurrent(generation);
  }, [context, user, accessToken, generation]);
  const [branchState, setBranchState] = useState({ context: null, status: 'loading', rows: [], error: '' });
  const branches = branchState.context === context ? branchState.rows : [];
  const branchStatus = branchState.context === context ? branchState.status : 'loading';
  const [branchId, setBranchId] = useState('ALL');
  const reviewAllowed = can('review:moderate:tenant');
  const dashboardContext = useMemo(() => ({ context, branchState, branchId, from, to, financeAllowed, reviewAllowed }), [context, branchState, branchId, from, to, financeAllowed, reviewAllowed]);
  const currentDashboard = useRef(dashboardContext);
  currentDashboard.current = dashboardContext;
  const [loadedContext, setLoadedContext] = useState(null);
  const [storedData, setData] = useState(emptyData);
  const data = loadedContext === dashboardContext ? storedData : emptyData();
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBranches = useCallback(async () => {
    if (!user || !accessToken || !isCurrentContext()) return;
    const request = ++branchRequest.current;
    ++dashboardRequest.current;
    setBranchState({ context, status: 'loading', rows: [], error: '' });
    setData(emptyData()); setLoadedContext(null); setWarnings([]); setError('');
    try {
      const result = await branchesApi.getAccessible();
      if (request !== branchRequest.current || !isCurrentContext()) return;
      const rows = Array.isArray(result) ? result : result?.data;
      if (!Array.isArray(rows)) throw new Error('Dữ liệu chi nhánh không hợp lệ. Vui lòng thử lại.');
      setBranchId(owner && rows.length > 1 ? 'ALL' : rows[0]?.id || 'ALL');
      setBranchState({ context, status: 'ready', rows, error: '' });
    } catch (failure) {
      if (request !== branchRequest.current || !isCurrentContext()) return;
      setBranchState({ context, status: 'error', rows: [], error: failure?.message || 'Không thể tải chi nhánh. Vui lòng thử lại.' });
    }
  }, [context, user, accessToken, owner, isCurrentContext]);
  useEffect(() => {
    void loadBranches();
    return () => { ++branchRequest.current; ++dashboardRequest.current; };
  }, [loadBranches]);

  const branchReady = branchStatus === 'ready' && branches.length > 0
    && (branchId === 'ALL' ? owner && branches.length > 1 : branches.some((branch) => branch.id === branchId));

  const load = useCallback(async () => {
    if (!branchReady || !isCurrentContext() || currentDashboard.current !== dashboardContext) return;
    const request = ++dashboardRequest.current;
    setLoading(true); setError(''); setWarnings([]);
    const selectedBranch = branchId === 'ALL' ? undefined : branchId;
    const bookingScope = { branchId: selectedBranch, dateFrom: from, dateTo: to };
    const now = new Date();
    const upcomingFrom = [from, format(now, 'yyyy-MM-dd')].sort().at(-1);
    const isCurrent = () => request === dashboardRequest.current && isCurrentContext() && currentDashboard.current === dashboardContext;
    const upcomingRequests = () => upcomingFrom > to ? Promise.resolve([]) : Promise.all(['PENDING', 'unfinished'].map((status) =>
      nextAppointments({ ...bookingScope, dateFrom: upcomingFrom, status }, now, isCurrent),
    )).then((groups) => [...new Map(groups.flat().map((booking) => [booking.id, booking])).values()]
      .sort((a, b) => a.startAt - b.startAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, UPCOMING_LIMIT));
    const tasks = [
      ['bookingCount', bookingsApi.getAll({ ...bookingScope, page: 1, limit: 1 }).then(bookingTotal)],
      ['pendingCount', bookingsApi.getAll({ ...bookingScope, status: 'PENDING', page: 1, limit: 1 }).then(bookingTotal)],
      ['completedCount', bookingsApi.getAll({ ...bookingScope, status: 'COMPLETED', page: 1, limit: 1 }).then(bookingTotal)],
      ['upcoming', upcomingRequests()],
      ['services', servicesApi.getManage(selectedBranch)],
      ['staff', staffApi.getAll(selectedBranch)],
      ...(financeAllowed ? [
        ['payments', paymentsApi.getAll()],
        ['overview', reportsApi.getOverview()],
        ['dashboard', reportsApi.getOwnerDashboard({ branchId: selectedBranch, from, to })],
      ] : []),
      ...(reviewAllowed ? [['reviews', reviewsApi.getForManagement({ branchId: selectedBranch, status: 'PENDING', page: 1, limit: 20 })]] : []),
    ];
    const results = await Promise.allSettled(tasks.map(([, promise]) => promise));
    if (request !== dashboardRequest.current || !isCurrentContext() || currentDashboard.current !== dashboardContext) return;
    const next = emptyData();
    const failed = [];
    results.forEach((result, index) => {
      const key = tasks[index][0];
      if (result.status === 'fulfilled') {
        const value = result.value;
        if (key === 'overview' || key === 'dashboard' || key.endsWith('Count') || key === 'upcoming') next[key] = value;
        else next[key] = value?.data ?? value ?? [];
      } else failed.push(key.endsWith('Count') || key === 'upcoming' ? 'bookings' : key);
    });
    setData(next);
    setLoadedContext(dashboardContext);
    setWarnings([...new Set(failed)]);
    if (failed.length === tasks.length) setError(results[0]?.reason?.message || 'Không thể tải tổng quan vận hành.');
    setLoading(false);
  }, [branchReady, dashboardContext, isCurrentContext, branchId, financeAllowed, reviewAllowed, from, to]);
  useEffect(() => {
    void load();
    return () => { ++dashboardRequest.current; };
  }, [load]);

  const upcoming = data.upcoming || [];
  if (branchStatus !== 'ready' || !branches.length) return <Page className="max-w-[1500px]">
    <PageHeader eyebrow={owner ? 'Toàn doanh nghiệp' : 'Chi nhánh được phân công'} title={owner ? 'Tổng quan doanh nghiệp' : 'Tổng quan chi nhánh'} />
    {branchStatus === 'error' ? <Card><ErrorState title="Không thể tải chi nhánh" message={branchState.error} onRetry={loadBranches} /></Card>
      : branchStatus === 'ready' ? <Card><EmptyState icon={MapPin} title={owner ? 'Chưa có chi nhánh' : 'Chưa có chi nhánh được phân công'}
        description={owner ? 'Doanh nghiệp chưa có chi nhánh để quản lý lịch hẹn. Hãy thiết lập chi nhánh trước khi bắt đầu vận hành.' : 'Liên hệ chủ doanh nghiệp để được phân công chi nhánh trước khi quản lý lịch hẹn.'}
        action={owner && can('branch:update:tenant') ? <Link to="/salon/profile" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-[var(--bb-brand-strong)] hover:underline">Thiết lập chi nhánh</Link> : undefined} /></Card>
        : <Skeleton rows={9} />}
  </Page>;
  const pending = data.pendingCount;
  const activeServices = data.services.filter((service) => service.active !== false && service.status !== 'INACTIVE').length;
  const activeStaff = data.staff.filter((staff) => staff.status === 'ACTIVE').length;
  const bookableStaff = data.staff.filter((staff) => staff.status === 'ACTIVE' && staff.isBookable).length;
  const scopedPayments = data.payments.filter((payment) => {
    const timestamp = new Date(payment.paidAt || payment.createdAt);
    const inRange = timestamp >= new Date(`${from}T00:00:00`) && timestamp <= new Date(`${to}T23:59:59`);
    return inRange && (branchId === 'ALL' || payment.booking?.branch?.id === branchId || payment.booking?.branchId === branchId);
  });
  const grossRevenue = scopedPayments.filter((payment) => ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const refunded = scopedPayments.flatMap((payment) => payment.refundRequests || []).filter((refund) => refund.status === 'REFUNDED').reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
  const pendingReviews = data.reviews.length;
  const actionItems = [
    { label: 'Lịch cần xác nhận', count: pending ?? '—', available: pending !== null, to: '/salon/appointments', icon: CalendarCheck, tone: pending ? 'warning' : 'neutral' },
    { label: 'Đánh giá chờ xử lý', count: pendingReviews, to: '/salon/reviews', icon: Star, tone: pendingReviews ? 'warning' : 'neutral' },
  ];
  const dashboard = data.dashboard;
  const chartData = dashboard?.charts;
  const hasChartActivity = Boolean(chartData && (
    chartData.revenueSeries?.some((item) => item.grossRevenue || item.netRevenue || item.refundAmount || item.discountAmount || item.previousNetRevenue)
    || chartData.bookingStatus?.some((item) => item.count)
    || chartData.branchComparison?.length
    || chartData.topServices?.length
    || chartData.topCombos?.length
    || chartData.review?.distribution?.some((item) => item.count)
    || chartData.review?.trend?.some((item) => item.count || item.average)
  ));
  const comparison = (metric) => {
    const change = dashboard?.kpis?.[metric]?.changePercent;
    if (change === null) return 'Kỳ trước bằng 0; chưa tính được tỷ lệ';
    if (change === undefined) return 'Chưa có dữ liệu so sánh';
    return `${change > 0 ? '+' : ''}${change}% so với kỳ trước`;
  };
  const netRevenue = dashboard?.kpis?.netRevenue?.current ?? (grossRevenue - refunded);
  const bookingCount = data.bookingCount ?? '—';
  const completedCount = data.completedCount ?? '—';

  return <Page className="max-w-[1500px]">
    <PageHeader eyebrow={owner ? 'Toàn doanh nghiệp' : 'Chi nhánh được phân công'} title={owner ? 'Tổng quan doanh nghiệp' : 'Tổng quan chi nhánh'} />
    <Card className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4"><Field label="Phạm vi chi nhánh"><Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>{owner && branches.length > 1 && <option value="ALL">Tất cả chi nhánh ({branches.length})</option>}{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></Field><Field label="Từ ngày"><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field><Field label="Đến ngày"><Input type="date" min={from} value={to} onChange={(event) => setTo(event.target.value)} /></Field><div className="flex items-end pb-5"><p className="text-xs leading-5 text-[var(--bb-muted)]"><MapPin size={14} className="mr-1 inline" />{branchId === 'ALL' ? `Đang xem ${branches.length} chi nhánh` : branches.find((branch) => branch.id === branchId)?.name || 'Đang xác định phạm vi'}</p></div></Card>
    {!branchReady || loading || loadedContext !== dashboardContext ? <Skeleton rows={9} /> : error ? <Card><ErrorState message={error} onRetry={load} /></Card> : <>
      {warnings.length > 0 && <InlineNotice tone="warning">Một phần dữ liệu chưa tải được: {warnings.map((key) => DATA_LABELS[key] || 'thông tin').join(', ')}. Những thông tin đã tải vẫn được hiển thị; hãy thử tải lại để xem đủ dữ liệu.</InlineNotice>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{financeAllowed && <MetricCard icon={TrendingUp} label="Doanh thu thuần trong kỳ" value={money(netRevenue)} note={comparison('netRevenue')} />}<MetricCard icon={CalendarCheck} label="Lịch trong kỳ" value={bookingCount} note={comparison('bookings')} tone="info" /><MetricCard icon={CheckCircle2} label="Lịch hoàn thành" value={completedCount} note={comparison('completedBookings')} tone="success" /><MetricCard icon={Scissors} label="Dịch vụ đang mở" value={`${activeServices}/${data.services.length}`} /><MetricCard icon={Users} label="Nhân sự hoạt động" value={`${activeStaff}/${data.staff.length}`} tone="info" /></div>

      <section><div className="mb-3"><h2 className="text-lg font-bold">Trung tâm hành động</h2></div><div className="grid gap-3 md:grid-cols-2">{actionItems.map((item) => <Link key={item.label} to={item.to} className="group"><Card className="flex h-full items-center gap-4 p-5 transition group-hover:border-[var(--bb-brand)]"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--bb-surface-subtle)] text-[var(--bb-brand-strong)]"><item.icon size={20} /></span><div className="min-w-0 flex-1"><p className="text-2xl font-bold tabular-nums">{item.count}</p><p className="text-sm font-semibold text-[var(--bb-muted)]">{item.label}</p></div>{item.available !== false && <Badge tone={item.tone}>{item.count ? 'Cần xử lý' : 'Ổn định'}</Badge>}</Card></Link>)}</div></section>

      {financeAllowed && <section>
        <div className="mb-3"><h2 className="text-lg font-bold">Phân tích trong kỳ</h2></div>
        {!chartData ? <Card><EmptyState title="Chưa tải được dữ liệu phân tích" description="Hãy thử tải lại để xem các biểu đồ trong kỳ." /></Card> : !hasChartActivity ? <Card><EmptyState title="Chưa có hoạt động để vẽ biểu đồ" description="Thử chọn khoảng ngày khác; biểu đồ sẽ xuất hiện khi có lịch hẹn, giao dịch hoặc đánh giá phù hợp." /></Card> : (
          <div className="grid gap-5 xl:grid-cols-2">
            {chartData.revenueSeries?.some((item) => item.grossRevenue || item.netRevenue || item.refundAmount || item.discountAmount || item.previousNetRevenue) && <ChartCard title="Doanh thu theo thời gian" to="/salon/payments">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData.revenueSeries}>
                  <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--bb-brand)" stopOpacity={0.28} /><stop offset="100%" stopColor="var(--bb-brand)" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} minTickGap={24} />
                  <YAxis tickFormatter={axisMoney} width={60} />
                  <Tooltip formatter={(value) => money(value)} labelFormatter={(value) => new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN')} />
                  <Legend />
                  <Area type="monotone" dataKey="grossRevenue" name="Doanh thu gộp" stroke="var(--bb-brand)" fill="url(#revenueFill)" strokeWidth={2} />
                  <Area type="monotone" dataKey="netRevenue" name="Doanh thu thuần" stroke="var(--bb-info)" fill="transparent" strokeWidth={2} />
                  <Area type="monotone" dataKey="discountAmount" name="Giảm giá" stroke="var(--bb-warning)" fill="transparent" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="refundAmount" name="Hoàn tiền" stroke="var(--bb-danger)" fill="transparent" strokeDasharray="5 4" />
                  <Area type="monotone" dataKey="previousNetRevenue" name="Thuần kỳ trước" stroke="var(--bb-muted)" fill="transparent" strokeDasharray="7 5" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>}

            {chartData.bookingStatus?.some((item) => item.count) && <ChartCard title="Trạng thái lịch hẹn" to="/salon/appointments">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={chartData.bookingStatus.filter((item) => item.count)} dataKey="count" nameKey="status" innerRadius={66} outerRadius={100} paddingAngle={2}>
                    {chartData.bookingStatus.filter((item) => item.count).map((item, index) => <Cell key={item.status} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, statusLabel(name)]} />
                  <Legend formatter={statusLabel} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>}

            {chartData.branchComparison?.length > 0 && <ChartCard title="So sánh chi nhánh" to="/salon/stats">
              <ResponsiveContainer width="100%" height={Math.max(280, chartData.branchComparison.length * 54)}>
                <BarChart data={chartData.branchComparison} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={axisMoney} />
                  <YAxis type="category" dataKey="branchName" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value, name) => name === 'netRevenue' ? money(value) : value} />
                  <Legend />
                  <Bar dataKey="netRevenue" name="Doanh thu thuần" fill="var(--bb-brand)" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>}

            {chartData.topServices?.length > 0 && <ChartCard title="Dịch vụ được đặt nhiều" to="/salon/services">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData.topServices.slice(0, 6)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value, name) => name === 'revenue' ? money(value) : value} />
                  <Bar dataKey="bookings" name="Lượt đặt" fill="var(--bb-brand-strong)" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>}

            {chartData.topServices?.length > 0 && <ChartCard title="Dịch vụ có doanh thu cao" to="/salon/services">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={[...chartData.topServices].sort((left, right) => right.revenue - left.revenue).slice(0, 6)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={axisMoney} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => money(value)} />
                  <Bar dataKey="revenue" name="Doanh thu" fill="var(--bb-success)" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>}

            {chartData.topCombos?.length > 0 && <ChartCard title="Combo được đặt nhiều" to="/salon/combos">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData.topCombos} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="bookings" name="Lượt đặt" fill="var(--bb-info)" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>}

            {chartData.review?.distribution?.some((item) => item.count) && <ChartCard title="Phân bố đánh giá" to="/salon/reviews" meta={chartData.review?.average ? `${chartData.review.average}/5 · ${chartData.review.count} đánh giá` : undefined}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData.review.distribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="rating" tickFormatter={(value) => `${value}★`} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Đánh giá" fill="var(--bb-warning)" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>}

            {chartData.review?.trend?.some((item) => item.count || item.average) && <ChartCard title="Xu hướng đánh giá" to="/salon/reviews" meta={chartData.review?.pending ? `${chartData.review.pending} đánh giá chờ xử lý` : undefined}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData.review.trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} minTickGap={24} />
                  <YAxis domain={[1, 5]} allowDecimals={false} />
                  <Tooltip labelFormatter={(value) => new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN')} />
                  <Line type="monotone" dataKey="average" name="Điểm trung bình" connectNulls stroke="var(--bb-warning)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>}
          </div>
        )}
      </section>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]"><Card className="overflow-hidden"><header className="flex items-center justify-between gap-3 border-b border-[var(--bb-border)] p-5"><div><h2 className="font-bold">Lịch hẹn tiếp theo</h2></div><Link to="/salon/appointments" className="min-h-11 px-3 py-3 text-sm font-semibold text-[var(--bb-brand-strong)] hover:underline">Mở lịch</Link></header>{data.upcoming === null ? <ErrorState onRetry={load} /> : !upcoming.length ? <EmptyState icon={CalendarCheck} title="Không có lịch sắp tới" description="Lịch vẫn sẵn sàng để tạo hoặc tiếp nhận lịch hẹn mới." /> : <div className="divide-y divide-[var(--bb-border)]">{upcoming.map((booking) => <Link key={booking.id} to={`/salon/appointments?bookingId=${booking.id}`} className="flex flex-col gap-3 p-4 hover:bg-[var(--bb-surface-subtle)] sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="break-words text-sm font-bold">{booking.customerName}</p><p className="mt-1 break-words text-xs text-[var(--bb-muted)]">{booking.serviceNames.join(', ') || 'Chưa có dịch vụ'} · {booking.branchName || 'Chi nhánh'}</p></div><p className="text-xs font-semibold">{format(booking.startAt, 'dd/MM · HH:mm')}</p><Badge tone={TONES[booking.status] || 'neutral'}>{LABELS[booking.status] || booking.status}</Badge></Link>)}</div>}</Card><div className="space-y-4"><Card className="p-5"><h2 className="font-bold">Tình trạng nhân sự</h2><div className="mt-4 grid grid-cols-2 gap-3"><Mini icon={UserRoundCheck} label="Đang hoạt động" value={activeStaff} /><Mini icon={Scissors} label="Đang nhận lịch" value={bookableStaff} /></div></Card>{financeAllowed && <Card className="p-5"><h2 className="font-bold">Tóm tắt tài chính</h2><dl className="mt-4 space-y-3 text-sm"><Row label="Đã ghi nhận" value={money(grossRevenue)} /><Row label="Đã hoàn" value={money(refunded)} /><Row label="Thuần" value={money(grossRevenue - refunded)} strong /></dl><Link to="/salon/payments" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--bb-brand-strong)] hover:underline"><CreditCard size={16} />Mở thanh toán & hoàn tiền</Link></Card>}</div></div>
    </>}
  </Page>;
}

function Mini({ icon: Icon, label, value }) { return <div className="rounded-xl bg-[var(--bb-surface-subtle)] p-3"><Icon size={17} className="text-[var(--bb-brand-strong)]" /><p className="mt-2 text-xl font-bold">{value}</p><p className="mt-1 text-xs text-[var(--bb-muted)]">{label}</p></div>; }
function Row({ label, value, strong }) { return <div className="flex justify-between gap-4"><dt className="text-[var(--bb-muted)]">{label}</dt><dd className={strong ? 'font-bold text-[var(--bb-brand-strong)]' : 'font-semibold'}>{value}</dd></div>; }
function ChartCard({ title, to, meta, children }) {
  return <Card className="min-w-0 overflow-hidden"><header className="flex min-h-16 items-center justify-between gap-3 border-b border-[var(--bb-border)] px-5 py-3"><div><h3 className="font-bold">{title}</h3>{meta && <p className="mt-1 text-xs text-[var(--bb-muted)]">{meta}</p>}</div><Link to={to} className="text-sm font-bold text-[var(--bb-brand-strong)] hover:underline">Chi tiết</Link></header><div className="min-h-[280px] p-4">{children}</div></Card>;
}

export default SalonOverview;
