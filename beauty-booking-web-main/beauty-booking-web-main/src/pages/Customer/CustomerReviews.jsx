import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquareText, Star } from 'lucide-react';
import { bookingsApi, platformPolicyApi } from '../../api/apiClient';
import { ReviewModal } from '../../components/customer/ReviewModal';
import { Badge, Button, Card, EmptyState, ErrorState, Page, PageHeader, Select, Skeleton } from '../../components/ui';

const reviewStatus = { PENDING: ['Chờ duyệt', 'warning'], APPROVED: ['Đã hiển thị', 'success'], HIDDEN: ['Đã ẩn', 'neutral'] };

export function CustomerReviews() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [reviewing, setReviewing] = useState(null);
  const [policy, setPolicy] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => { setLoading(true); setError(''); try { const [result, currentPolicy] = await Promise.all([bookingsApi.myAppointments('completed'), platformPolicyApi.getPublic()]); setBookings(result.data ?? result ?? []); setPolicy(currentPolicy); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => filter === 'ALL' ? bookings : filter === 'REVIEWED' ? bookings.filter((item) => item.review) : bookings.filter((item) => !item.review), [bookings, filter]);
  return <Page className="max-w-5xl"><PageHeader eyebrow="Trải nghiệm của tôi" title="Đánh giá" description="Mỗi lịch hoàn thành được đánh giá một lần. Trạng thái hiển thị phản ánh quy trình kiểm duyệt hiện tại." actions={<Select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Lọc đánh giá" className="min-w-44"><option value="ALL">Tất cả lịch hoàn thành</option><option value="PENDING_REVIEW">Chưa đánh giá</option><option value="REVIEWED">Đã đánh giá</option></Select>} />
    {loading ? <Skeleton rows={5} /> : error ? <Card><ErrorState message={error} onRetry={load} /></Card> : !visible.length ? <Card><EmptyState icon={MessageSquareText} title="Không có mục phù hợp" description="Sau khi hoàn thành dịch vụ, bạn có thể chia sẻ đánh giá tại đây." /></Card> : <div className="space-y-3">{visible.map((booking) => { const review = booking.review; const [label, tone] = reviewStatus[review?.status] || ['Chưa đánh giá', 'neutral']; return <Card as="article" key={booking.id} className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{booking.branch?.business?.name || booking.branch?.name || 'Cơ sở làm đẹp'}</h2><Badge tone={tone}>{label}</Badge></div><p className="mt-1 text-xs text-[var(--bb-muted)]">{new Date(booking.appointmentStartTime || booking.appointmentDate).toLocaleDateString('vi-VN')} · <span className="bb-mono">{booking.bookingCode}</span></p><p className="mt-3 text-sm">{(booking.bookingServices || []).map((item) => item.service?.name).filter(Boolean).join(', ') || 'Dịch vụ làm đẹp'}</p>{review && <div className="mt-4 rounded-xl bg-[var(--bb-surface-subtle)] p-4"><div className="flex items-center gap-1" aria-label={`${review.overallRating} trên 5 sao`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={16} className={index < review.overallRating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'} />)}</div><p className="mt-2 text-sm leading-6 text-[var(--bb-ink-soft)]">{review.comment || 'Bạn đã gửi đánh giá không kèm nhận xét.'}</p></div>}</div>{!review && <Button size="sm" onClick={() => setReviewing(booking)}><Star size={15} />Viết đánh giá</Button>}</div></Card>; })}</div>}
    {reviewing && <ReviewModal booking={reviewing} policy={policy} onClose={() => setReviewing(null)} onSuccess={() => { setReviewing(null); void load(); }} />}
  </Page>;
}

export default CustomerReviews;
