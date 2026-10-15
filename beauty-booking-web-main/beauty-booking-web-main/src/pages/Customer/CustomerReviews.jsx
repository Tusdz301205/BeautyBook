import { elapsedCheckIn, reviewEligible } from '../../utils/bookingAffordances';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquareText, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { bookingsApi, platformPolicyApi, reviewsApi } from '../../api/apiClient';
import { ReviewModal } from '../../components/customer/ReviewModal';
import { useCustomerBookingRefresh } from '../../hooks/useCustomerBookingRefresh';
import { useAuthStore } from '../../store/authStore';
import { captureSessionGeneration, isSessionGenerationCurrent } from '../../utils/sessionGeneration';
import { formatBookingWallDate } from '../../utils/bookingWallTime';
import { Badge, Button, Card, Dialog, EmptyState, ErrorState, Field, Page, PageHeader, Select, Skeleton, Textarea } from '../../components/ui';

const reviewStatus = { PENDING: ['Chờ duyệt', 'warning'], APPROVED: ['Đã hiển thị', 'success'], REPORTED: ['Đang được xem xét', 'warning'], HIDDEN: ['Đã ẩn', 'neutral'] };
const EMPTY_BOOKINGS = [];

export function CustomerReviews() {
  const [observedBookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [reviewing, setReviewing] = useState(null);
  const [appealing, setAppealing] = useState(null);
  const [appealReason, setAppealReason] = useState('');
  const [appealBusy, setAppealBusy] = useState(false);
  const [policy, setPolicy] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const accessToken = useAuthStore(state => state.accessToken);
  const userId = useAuthStore(state => state.user?.id);
  const requestSequence = useRef(0);
  const bookingScope = useRef({ accessToken, userId });
  const bookings = bookingScope.current.accessToken === accessToken && bookingScope.current.userId === userId ? observedBookings : EMPTY_BOOKINGS;
  const load = useCallback(async () => {
    if (!accessToken || !userId) return;
    const requestId = ++requestSequence.current;
    const lease = captureSessionGeneration();
    const current = () => requestId === requestSequence.current && isSessionGenerationCurrent(lease)
      && useAuthStore.getState().accessToken === accessToken && useAuthStore.getState().user?.id === userId;
    if (!current()) return;
    setLoading(true); setError('');
    try {
      const [result, currentPolicy] = await Promise.all([bookingsApi.myAppointments('all'), platformPolicyApi.getPublic()]);
      if (!current()) return;
      bookingScope.current = { accessToken, userId };
      setBookings((result.data ?? result ?? []).map(booking => ({ ...booking, serverNow: booking.serverNow ?? result.serverNow })));
      setPolicy(currentPolicy);
    } catch (requestError) { if (current()) setError(requestError.message); }
    finally { if (current()) setLoading(false); }
  }, [accessToken, userId]);
  useEffect(() => {
    setBookings([]); setReviewing(null); setAppealing(null); setAppealReason(''); setPolicy({});
    if (accessToken && userId) void load(); else { setLoading(false); setError(''); }
    return () => { requestSequence.current += 1; };
  }, [accessToken, userId, load]);
  useCustomerBookingRefresh(load, bookings);
  const visible = useMemo(() => {
    const history = bookings.filter(booking => booking.review || reviewEligible(booking) || booking.scheduleBucket === 'HISTORY'
      || elapsedCheckIn(booking) || booking.status === 'COMPLETED');
    return filter === 'ALL' ? history : filter === 'REVIEWED' ? history.filter(item => item.review) : history.filter(reviewEligible);
  }, [bookings, filter]);
  const liveAppealReview = bookings.find((booking) => booking.review?.id === appealing?.id)?.review;
  const submitAppeal = async () => {
    if (!appealing || !appealReason.trim()) return;
    setAppealBusy(true);
    try {
      await reviewsApi.appeal(appealing.id, appealReason.trim());
      toast.success('Đã gửi khiếu nại tới bộ phận kiểm duyệt');
      setAppealing(null); setAppealReason('');
    } catch (requestError) { toast.error(requestError.status === 0 ? 'Chưa xác định được kết quả. Đang kiểm tra trạng thái khiếu nại.' : requestError.message || 'Không thể gửi khiếu nại'); }
    finally { await load(); setAppealBusy(false); }
  };
  return <Page className="max-w-5xl"><PageHeader eyebrow="Trải nghiệm của tôi" title="Đánh giá" actions={<Select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Lọc đánh giá" className="min-w-44"><option value="ALL">Tất cả lịch sử</option><option value="PENDING_REVIEW">Chưa đánh giá</option><option value="REVIEWED">Đã đánh giá</option></Select>} />
    {loading ? <Skeleton rows={5} /> : error ? <Card><ErrorState message={error} onRetry={load} /></Card> : !visible.length ? <Card><EmptyState icon={MessageSquareText} title="Không có mục phù hợp" description="Bạn có thể chia sẻ đánh giá tại đây khi lịch đủ điều kiện." /></Card> : <div className="space-y-3">{visible.map((booking) => { const review = booking.review; const [label, tone] = reviewStatus[review?.status] || ['Chưa đánh giá', 'neutral']; return <Card as="article" key={booking.id} className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{booking.branch?.business?.name || booking.branch?.name || 'Cơ sở làm đẹp'}</h2><Badge tone={tone}>{label}</Badge></div><p className="mt-1 text-xs text-[var(--bb-muted)]">{formatBookingWallDate(booking.appointmentDate)} · <span className="bb-mono">{booking.bookingCode}</span></p><p className="mt-3 text-sm">{(booking.bookingServices || []).map((item) => item.service?.name).filter(Boolean).join(', ') || 'Dịch vụ làm đẹp'}</p>{review && <div className="mt-4 rounded-xl bg-[var(--bb-surface-subtle)] p-4"><div className="flex items-center gap-1" aria-label={`${review.overallRating} trên 5 sao`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={16} className={index < review.overallRating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'} />)}</div><p className="mt-2 text-sm leading-6 text-[var(--bb-ink-soft)]">{review.comment || 'Bạn đã gửi đánh giá không kèm nhận xét.'}</p></div>}</div><div className="flex shrink-0 flex-wrap gap-2">{reviewEligible(booking) && <Button size="sm" onClick={() => setReviewing(booking)}><Star size={15} />Viết đánh giá</Button>}{review?.status === 'HIDDEN' && (review.hasPendingAppeal ? <p className="text-sm text-[var(--bb-muted)]">Khiếu nại đang chờ xử lý</p> : <Button size="sm" variant="secondary" onClick={() => { setAppealing(review); setAppealReason(''); }}>Khiếu nại</Button>)}</div></div></Card>; })}</div>}
    {reviewing && <ReviewModal booking={reviewing} policy={policy} onClose={() => setReviewing(null)} onSuccess={() => { setReviewing(null); void load(); }} />}
    <Dialog open={Boolean(appealing)} onClose={() => setAppealing(null)} title="Khiếu nại quyết định ẩn" description="Quản trị viên sẽ xem xét nội dung và lịch sử xử lý." footer={<><Button variant="secondary" onClick={() => setAppealing(null)}>Hủy</Button><Button loading={appealBusy} disabled={appealBusy || loading || Boolean(error) || !appealReason.trim() || !liveAppealReview || liveAppealReview.hasPendingAppeal} onClick={submitAppeal}>Gửi khiếu nại</Button></>}>{error && <Button variant="secondary" loading={loading} onClick={load}>Tải lại trạng thái</Button>}{liveAppealReview?.hasPendingAppeal && <p className="mb-3 text-sm">Khiếu nại đang chờ xử lý. Không cần gửi lại.</p>}<Field label="Lý do khiếu nại" required><Textarea value={appealReason} onChange={(event) => setAppealReason(event.target.value)} maxLength={1000} /></Field></Dialog>
  </Page>;
}

export default CustomerReviews;
