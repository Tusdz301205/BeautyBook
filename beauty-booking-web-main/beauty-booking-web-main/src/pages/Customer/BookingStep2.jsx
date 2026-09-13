import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, UserRound, UsersRound } from 'lucide-react';
import { staffApi } from '../../api/apiClient';
import { useBookingStore } from '../../store/bookingStore';
import { Button, EmptyState, InlineNotice, Skeleton } from '../../components/ui';
import { BookingLayout, SelectionCard } from '../../components/customer/BookingLayout';
import { useAsyncResource } from '../../hooks/useAsyncResource';

export default function BookingStep2() {
  const navigate = useNavigate();
  const { branchId, serviceIds, staffId, setStaff } = useBookingStore();
  const { data, loading, error } = useAsyncResource(branchId && serviceIds.length ? JSON.stringify([branchId, serviceIds]) : null, () => staffApi.getPublic(branchId, serviceIds));
  const staff = Array.isArray(data) ? data : [];
  const warning = error ? `Không tải được danh sách chuyên viên: ${error.message}. Bạn có thể thử lại bằng cách quay lại bước trước, hoặc chọn tự phân công.` : '';
  useEffect(() => { if (!branchId || !serviceIds.length) navigate('/book', { replace: true }); }, [branchId, serviceIds, navigate]);
  useEffect(() => { if (data && staffId && !staff.some((person) => person.id === staffId)) setStaff(null); }, [data, staffId, staff, setStaff]);
  return <BookingLayout step={2} title="Chọn chuyên viên" description="Bạn có thể chọn một người cụ thể hoặc để BeautyBook tự tìm chuyên viên đủ kỹ năng và còn lịch phù hợp.">{warning && <InlineNotice tone="warning">{warning}</InlineNotice>}<div className="mt-4 grid gap-3 sm:grid-cols-2"><SelectionCard selected={staffId === null} onClick={() => setStaff(null)} icon={<UsersRound size={18} />} title="Bất kỳ chuyên viên phù hợp" meta="Đề xuất · Hệ thống chỉ phân công người đã bật nhận lịch, phụ trách đủ dịch vụ và còn thời gian trống." trailing="Nên chọn" />{loading ? <div className="sm:col-span-2"><Skeleton rows={4} /></div> : staff.map((person) => { const specialty = person.specialties?.join(' · '); const rating = person.ratingCount ? <span className="inline-flex items-center gap-1"><Star size={13} fill="currentColor" />{person.rating} ({person.ratingCount})</span> : null; return <SelectionCard key={person.id} selected={staffId === person.id} onClick={() => setStaff(person.id)} icon={person.avatarUrl ? <img className="h-10 w-10 rounded-lg object-cover" src={person.avatarUrl} alt="" /> : <UserRound size={18} />} title={person.fullName || 'Chuyên viên'} meta={<>{person.professionalTitle || 'Chuyên viên làm đẹp'}{specialty ? <span className="block">{specialty}</span> : null}</>} trailing={rating} />; })}</div>{!loading && !staff.length && !warning && <EmptyState title="Chưa có chuyên viên phù hợp để chọn" description="Bạn vẫn có thể tiếp tục với lựa chọn tự phân công; hệ thống sẽ kiểm tra lại lịch và kỹ năng trước khi giữ chỗ." />}<div className="mt-6 flex justify-between border-t border-[var(--bb-border)] pt-5"><Button variant="secondary" onClick={() => navigate('/book')}>Quay lại</Button><Button disabled={loading || Boolean(staffId && !staff.some((person) => person.id === staffId))} onClick={() => navigate('/book/time')}>Tiếp tục</Button></div></BookingLayout>;
}
