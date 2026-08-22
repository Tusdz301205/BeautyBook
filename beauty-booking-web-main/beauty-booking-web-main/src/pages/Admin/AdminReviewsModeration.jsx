import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Flag, Search, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { reviewsApi } from '../../api/apiClient';
import { Badge, Button, Card, Dialog, EmptyState, ErrorState, Field, Input, MetricCard, Page, PageHeader, Skeleton } from '../../components/ui';

const statusMeta = {
  APPROVED: ['Đang hiển thị', 'success'],
  REPORTED: ['Đã bị báo cáo', 'warning'],
  HIDDEN: ['Đã ẩn', 'danger'],
};

function Stars({ value }) {
  return <span className="inline-flex" aria-label={`${value || 0} trên 5 sao`}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={13} className={star <= Number(value || 0) ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'} />)}</span>;
}

function ReviewRow({ review, onAction }) {
  const [label, tone] = statusMeta[review.status] || [review.status || '—', 'neutral'];
  const latestReport = review.reports?.[0];
  return <article className="border-b border-[var(--bb-border)] p-5 last:border-b-0">
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pink-50 font-bold text-pink-700">{review.customer?.user?.fullName?.slice(0, 1).toUpperCase() || '?'}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><strong>{review.customer?.user?.fullName || 'Khách hàng'}</strong><Stars value={review.overallRating} /><Badge tone={tone}>{label}</Badge><span className="text-xs text-[var(--bb-muted)]">{review.createdAt ? new Date(review.createdAt).toLocaleDateString('vi-VN') : '—'}</span></div>
        <p className="mt-2 text-sm leading-6 text-[var(--bb-ink-soft)]">{review.comment || <span className="italic text-[var(--bb-muted)]">Không có bình luận</span>}</p>
        {review.booking?.branch?.name && <p className="mt-2 text-xs text-[var(--bb-muted)]">{review.booking.branch.name} · {review.booking.bookingCode || ''}</p>}
        {latestReport && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Lý do báo cáo: </strong>{latestReport.reason}<span className="ml-2 text-xs text-amber-700">({review.reports.length} báo cáo)</span></div>}
        {review.businessReply?.content && <div className="mt-3 rounded-lg border-l-4 border-pink-400 bg-pink-50 p-3 text-sm"><strong className="text-pink-800">Phản hồi cơ sở: </strong>{review.businessReply.content}</div>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {review.status === 'REPORTED' && <><Button size="sm" variant="secondary" onClick={() => onAction(review, 'APPROVED')}><Eye size={14} />Giữ hiển thị</Button><Button size="sm" variant="danger" onClick={() => onAction(review, 'HIDDEN')}><EyeOff size={14} />Ẩn vi phạm</Button></>}
        {review.status === 'HIDDEN' && <Button size="sm" variant="secondary" onClick={() => onAction(review, 'APPROVED')}><Eye size={14} />Khôi phục</Button>}
      </div>
    </div>
  </article>;
}

export function AdminReviewsModeration() {
  const [reviews, setReviews] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await reviewsApi.getForManagement();
      setReviews(Array.isArray(response) ? response : response?.data || []);
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải hàng chờ hậu kiểm.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const queue = useMemo(() => reviews.filter((review) => ['REPORTED', 'HIDDEN'].includes(review.status) && (!search.trim() || `${review.customer?.user?.fullName || ''} ${review.comment || ''} ${review.booking?.branch?.name || ''} ${review.reports?.map((item) => item.reason).join(' ') || ''}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))), [reviews, search]);
  const reported = reviews.filter((item) => item.status === 'REPORTED').length;
  const hidden = reviews.filter((item) => item.status === 'HIDDEN').length;

  const moderate = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await reviewsApi.moderate(confirm.review.id, confirm.status);
      toast.success(confirm.status === 'HIDDEN' ? 'Đã ẩn đánh giá vi phạm' : 'Đã giữ/khôi phục đánh giá');
      setConfirm(null);
      await load();
    } catch (actionError) {
      toast.error(actionError.message || 'Không thể xử lý đánh giá');
    } finally { setBusy(false); }
  };

  return <Page>
    <PageHeader eyebrow="AN TOÀN NỀN TẢNG" title="Hậu kiểm đánh giá" description="Đánh giá hợp lệ được đăng ngay. Hàng chờ này chỉ chứa nội dung bị báo cáo và quyết định ẩn hoặc khôi phục của quản trị viên." />
    <div className="grid gap-3 sm:grid-cols-3"><MetricCard icon={Flag} label="Chờ xử lý" value={reported} tone="warning" /><MetricCard icon={EyeOff} label="Đã ẩn" value={hidden} tone="neutral" /><MetricCard icon={Star} label="Tổng trong hàng hậu kiểm" value={reported + hidden} /></div>
    <Card className="p-4"><Field label="Tìm trong hàng hậu kiểm"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 text-[var(--bb-muted)]" size={16} /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Khách hàng, cơ sở, nội dung hoặc lý do report" /></div></Field></Card>
    {loading ? <Card className="p-5"><Skeleton rows={7} /></Card> : error ? <Card><ErrorState message={error} onRetry={load} /></Card> : queue.length === 0 ? <Card><EmptyState icon={Flag} title="Không có đánh giá cần hậu kiểm" description="Các đánh giá đang hiển thị bình thường không cần quản trị viên duyệt trước." /></Card> : <Card className="overflow-hidden">{queue.map((review) => <ReviewRow key={review.id} review={review} onAction={(item, status) => setConfirm({ review: item, status })} />)}</Card>}
    <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} title={confirm?.status === 'HIDDEN' ? 'Ẩn đánh giá vi phạm?' : 'Giữ đánh giá hiển thị?'} description={confirm?.review?.booking?.branch?.name || 'Toàn nền tảng'} footer={<><Button variant="secondary" onClick={() => setConfirm(null)}>Hủy</Button><Button variant={confirm?.status === 'HIDDEN' ? 'danger' : 'primary'} loading={busy} onClick={moderate}>Xác nhận</Button></>}><p className="text-sm leading-6 text-[var(--bb-muted)]">Quyết định và lịch sử thay đổi sẽ được lưu trong nhật ký kiểm toán.</p></Dialog>
  </Page>;
}

export default AdminReviewsModeration;
