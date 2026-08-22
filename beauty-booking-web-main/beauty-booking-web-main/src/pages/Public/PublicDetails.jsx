import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarCheck, Clock3, Image as ImageIcon, MapPin, Scissors, Star, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { branchesApi, reviewsApi, servicesApi, staffApi } from '../../api/apiClient';
import { PublicShell } from '../../components/layout/PublicShell';
import { HomeMedia } from '../../components/public/HomeMedia';
import { getHomeMedia, homeMediaRatios } from '../../config/homeMedia';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}₫`;
const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function clock(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 5) : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function firstMedia(images = [], fallback) {
  return images.map((item) => item?.media?.url || item?.url).find(Boolean) || fallback;
}

function DetailState({ loading, error, retry, children }) {
  if (loading) return <div className="bb-detail-loading" role="status" aria-live="polite"><span className="bb-sr-only">Đang tải nội dung…</span><Skeleton rows={9} /></div>;
  if (error) return <section className="bb-detail-error"><ErrorState message={error} onRetry={retry} /></section>;
  return children;
}

function BackLink() {
  return <Link to="/explore" className="bb-detail-back"><ArrowLeft size={16} />Quay lại khám phá</Link>;
}

function DetailHero({ type, eyebrow, title, description, media, mediaAlt, facts }) {
  return (
    <header className="bb-detail-hero">
      <div className="bb-detail-hero__copy">
        <BackLink />
        <p className="bb-home-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p className="bb-detail-hero__description">{description}</p> : null}
        {facts?.length ? <dl className="bb-detail-facts">{facts.filter((fact) => fact.value).map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl> : null}
      </div>
      <HomeMedia
        src={media}
        alt={mediaAlt}
        ratio={homeMediaRatios.detailHero}
        label={`Hình ảnh ${type}`}
        eager
        className="bb-detail-hero__media"
      />
    </header>
  );
}

function BookingDock({ to, label, title, meta }) {
  return <aside className="bb-detail-booking-dock" aria-label="Đặt lịch"><div><CalendarCheck size={20} aria-hidden="true" /><span><small>Đặt lịch trực tuyến</small><strong>{title}</strong></span></div>{meta ? <p>{meta}</p> : null}<Link className="bb-home-button bb-home-button--primary" to={to}>{label}<ArrowRight size={16} /></Link><small>Thời gian trống được kiểm tra sau khi bạn chọn đủ dịch vụ và chuyên viên.</small></aside>;
}

function Section({ index, eyebrow, title, intro, children }) {
  return (
    <section className="bb-detail-section">
      <div className="bb-detail-section__heading">
        <span aria-hidden="true">{String(index).padStart(2, '0')}</span>
        <div><p className="bb-home-kicker">{eyebrow}</p><h2>{title}</h2>{intro ? <p>{intro}</p> : null}</div>
      </div>
      <div className="bb-detail-section__body">{children}</div>
    </section>
  );
}

function Gallery({ images = [], label }) {
  const urls = images.map((item) => item?.media?.url || item?.url).filter(Boolean);
  if (!urls.length) return <div className="bb-detail-empty"><ImageIcon size={21} /><p>Chưa có hình ảnh do cơ sở tải lên.</p></div>;
  return <div className="bb-detail-gallery">{urls.slice(0, 6).map((url, index) => <img key={`${url}-${index}`} src={url} alt={`${label} ${index + 1}`} loading="lazy" decoding="async" />)}</div>;
}

function ReviewList({ data }) {
  const rows = data?.data || data?.ratings || [];
  const average = data?.summary?.averageRating ?? data?.averageRating;
  const total = data?.summary?.totalReviews ?? data?.totalRatings ?? rows.length;
  if (!rows.length) return <div className="bb-detail-empty"><Star size={21} /><p>Chưa có đánh giá đã được duyệt.</p></div>;
  return (
    <div>
      <div className="bb-detail-rating"><Star size={22} className="fill-current" /><strong>{Number(average || 0).toFixed(1)}</strong><span>{total} lượt đánh giá</span></div>
      <div className="bb-detail-review-list">{rows.slice(0, 8).map((row, index) => <article key={row.id || index}><div><strong>{row.customerName || 'Khách hàng ẩn danh'}</strong><span>{row.overallRating || row.rating}/5</span></div><p>{row.comment || 'Khách hàng không để lại nhận xét.'}</p></article>)}</div>
    </div>
  );
}

function ServiceDirectory({ services = [] }) {
  if (!services.length) return <div className="bb-detail-empty"><Scissors size={21} /><p>Chưa có dịch vụ công khai đang nhận lịch.</p></div>;
  return <div className="bb-detail-directory">{services.map((service) => <Link key={service.id} to={`/explore/services/${service.id}`}><div><span>{service.category?.name || 'Dịch vụ'}</span><h3>{service.name}</h3><p>{service.durationMinutes ? `${service.durationMinutes} phút` : 'Thời lượng đang cập nhật'}</p></div><strong>{money(service.price)}</strong><ArrowRight size={17} aria-hidden="true" /></Link>)}</div>;
}

function StaffDirectory({ staff = [] }) {
  if (!staff.length) return <div className="bb-detail-empty"><UserRound size={21} /><p>Chưa có chuyên viên công khai cho lựa chọn này.</p></div>;
  return <div className="bb-detail-staff-grid">{staff.map((item) => { const specialties = item.specialties?.length ? item.specialties : item.staffServices?.map((entry) => entry.service?.name).filter(Boolean); return <Link key={item.id} to={`/explore/staff/${item.id}`} className="bb-detail-staff-card"><span className="bb-detail-staff-card__avatar">{item.avatarUrl ? <img src={item.avatarUrl} alt="" loading="lazy" /> : <UserRound size={22} />}</span><span className="bb-detail-staff-card__copy"><small>{item.professionalTitle || 'Chuyên viên làm đẹp'}</small><strong>{item.fullName || 'Chuyên viên'}</strong><span>{specialties?.join(' · ') || 'Chuyên môn đang cập nhật'}</span>{item.ratingCount ? <span className="bb-detail-staff-card__rating"><Star size={14} fill="currentColor" /> {item.rating} · {item.ratingCount} đánh giá</span> : null}</span><ArrowRight size={17} aria-hidden="true" /></Link>; })}</div>;
}

export function PublicBranchDetail() {
  const { id } = useParams();
  const [branch, setBranch] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const item = await branchesApi.getById(id);
      if (!item) throw new Error('Không tìm thấy cơ sở đang hoạt động.');
      setBranch(item);
      try { setReviews(await reviewsApi.getByBusiness(item.businessId)); } catch { setReviews(null); }
    } catch (requestError) { setError(requestError.message || 'Không thể tải chi tiết cơ sở.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);
  const address = branch ? [branch.addressLine, branch.district?.name, branch.district?.province?.name].filter(Boolean).join(', ') : '';
  return <PublicShell><DetailState loading={loading} error={error} retry={load}>{branch ? <article className="bb-detail-document">
    <DetailHero type="cơ sở" eyebrow="Cơ sở làm đẹp" title={branch.name} description={branch.business?.description || 'Thông tin giới thiệu đang được cơ sở cập nhật.'} media={firstMedia(branch.images, getHomeMedia('details', 'branch'))} mediaAlt={`Không gian tại ${branch.name}`} facts={[{ label: 'Thương hiệu', value: branch.business?.name }, { label: 'Địa chỉ', value: address }]} bookingTo={`/book?branchId=${branch.id}`} bookingLabel="Đặt lịch tại cơ sở" />
    <BookingDock to={`/book?branchId=${branch.id}`} label="Chọn dịch vụ" title={branch.name} meta={address} />
    <Section index={1} eyebrow="Thông tin ghé thăm" title="Một địa chỉ, mọi thông tin cần thiết" intro="Giờ hoạt động được lấy trực tiếp từ hồ sơ cơ sở."><div className="bb-detail-address"><MapPin size={20} /><div><strong>{address || 'Địa chỉ đang cập nhật'}</strong><span>{branch.business?.name}</span></div></div><div className="bb-detail-hours">{branch.workingHours?.length ? branch.workingHours.map((row) => <div key={row.id || row.dayOfWeek}><strong>{days[row.dayOfWeek]}</strong><span>{row.isClosed ? 'Đóng cửa' : `${clock(row.openTime)} – ${clock(row.closeTime)}`}</span></div>) : <div className="bb-detail-empty"><Clock3 size={21} /><p>Giờ mở cửa đang được cập nhật.</p></div>}</div></Section>
    <Section index={2} eyebrow="Danh mục" title="Dịch vụ đang nhận lịch"><ServiceDirectory services={branch.services} /></Section>
    <Section index={3} eyebrow="Đội ngũ" title="Chọn người phù hợp"><StaffDirectory staff={branch.staff} /></Section>
    <Section index={4} eyebrow="Không gian" title="Hình ảnh do cơ sở cung cấp"><Gallery images={branch.images} label={`Hình ảnh ${branch.name}`} /></Section>
    <Section index={5} eyebrow="Trải nghiệm thật" title="Đánh giá đã được duyệt"><ReviewList data={reviews} /></Section>
  </article> : null}</DetailState></PublicShell>;
}

export function PublicServiceDetail() {
  const { id } = useParams();
  const [service, setService] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const item = await servicesApi.getById(id);
      if (!item) throw new Error('Dịch vụ không còn nhận lịch.');
      setService(item);
      try { setReviews(await reviewsApi.getByService(id)); } catch { setReviews(null); }
    } catch (requestError) { setError(requestError.message || 'Không thể tải dịch vụ.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);
  const team = service?.staffServices?.map((entry) => entry.staff).filter(Boolean) || [];
  return <PublicShell><DetailState loading={loading} error={error} retry={load}>{service ? <article className="bb-detail-document">
    <DetailHero type="dịch vụ" eyebrow={service.category?.name || 'Dịch vụ làm đẹp'} title={service.name} description={service.description || 'Thông tin mô tả đang được cơ sở cập nhật.'} media={firstMedia(service.images, getHomeMedia('details', 'service'))} mediaAlt={`Dịch vụ ${service.name}`} facts={[{ label: 'Giá niêm yết', value: money(service.price) }, { label: 'Thời lượng', value: service.durationMinutes ? `${service.durationMinutes} phút` : null }, { label: 'Địa điểm', value: [service.branch?.business?.name, service.branch?.name].filter(Boolean).join(' · ') }]} bookingTo={`/book?branchId=${service.branchId}&serviceId=${service.id}`} bookingLabel="Đặt dịch vụ này" />
    <BookingDock to={`/book?branchId=${service.branchId}&serviceId=${service.id}`} label="Đặt dịch vụ này" title={service.name} meta={`${money(service.price)}${service.durationMinutes ? ` · ${service.durationMinutes} phút` : ''}`} />
    <Section index={1} eyebrow="Thực hiện bởi" title="Chuyên viên phù hợp"><StaffDirectory staff={team} /></Section>
    <Section index={2} eyebrow="Không gian" title="Hình ảnh dịch vụ"><Gallery images={service.images} label={`Hình ảnh ${service.name}`} /></Section>
    {service.promotionLinks?.length ? <Section index={3} eyebrow="Ưu đãi" title="Khuyến mãi đang áp dụng"><div className="bb-detail-offers">{service.promotionLinks.map(({ promotion }) => <article key={promotion.id}><span>Ưu đãi hiện hành</span><h3>{promotion.name}</h3><p>{promotion.description || 'Chi tiết ưu đãi hiển thị khi xác nhận lịch.'}</p></article>)}</div></Section> : null}
    <Section index={service.promotionLinks?.length ? 4 : 3} eyebrow="Trải nghiệm thật" title="Đánh giá dịch vụ"><ReviewList data={reviews} /></Section>
  </article> : null}</DetailState></PublicShell>;
}

export function PublicStaffDetail() {
  const { id } = useParams();
  const [staff, setStaff] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const item = await staffApi.getPublicById(id);
      if (!item) throw new Error('Không tìm thấy chuyên viên đang hoạt động.');
      setStaff(item);
      try { setReviews(await reviewsApi.getPublicByStaff(id)); } catch { setReviews(null); }
    } catch (requestError) { setError(requestError.message || 'Không thể tải thông tin chuyên viên.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);
  const services = staff?.staffServices?.map((entry) => entry.service).filter(Boolean) || [];
  return <PublicShell><DetailState loading={loading} error={error} retry={load}>{staff ? <article className="bb-detail-document">
    <DetailHero type="chuyên viên" eyebrow={staff.professionalTitle || 'Chuyên viên làm đẹp'} title={staff.fullName} description={staff.bio || 'Thông tin giới thiệu đang được chuyên viên cập nhật.'} media={staff.avatarUrl || firstMedia(staff.images, getHomeMedia('details', 'staff'))} mediaAlt={`Chuyên viên ${staff.fullName}`} facts={[{ label: 'Cơ sở', value: [staff.branch?.business?.name, staff.branch?.name].filter(Boolean).join(' · ') }, { label: 'Chuyên môn', value: services.map((service) => service.name).join(', ') }, ...(staff.ratingCount ? [{ label: 'Đánh giá', value: `${staff.rating}/5 · ${staff.ratingCount} lượt` }] : [])]} bookingTo={`/book?branchId=${staff.branch?.id}&staffId=${staff.id}`} bookingLabel="Đặt lịch với chuyên viên" />
    <BookingDock to={`/book?branchId=${staff.branch?.id}&staffId=${staff.id}`} label="Đặt lịch với chuyên viên" title={staff.fullName} meta={staff.professionalTitle || 'Chuyên viên làm đẹp'} />
    <Section index={1} eyebrow="Chuyên môn" title="Dịch vụ phụ trách"><ServiceDirectory services={services} /></Section>
    <Section index={2} eyebrow="Hồ sơ hình ảnh" title="Hình ảnh do cơ sở cung cấp"><Gallery images={staff.images} label={`Hình ảnh ${staff.fullName || 'chuyên viên'}`} /></Section>
    <Section index={3} eyebrow="Trải nghiệm thật" title="Đánh giá chuyên viên"><ReviewList data={reviews} /></Section>
  </article> : null}</DetailState></PublicShell>;
}
