import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Gift, MapPin, Scissors } from 'lucide-react';
import { branchesApi, combosApi, servicesApi } from '../../api/apiClient';
import { useBookingStore } from '../../store/bookingStore';
import { Button, EmptyState, ErrorState, Select, Skeleton } from '../../components/ui';
import { BookingLayout, SelectionCard } from '../../components/customer/BookingLayout';
import { useAsyncResource } from '../../hooks/useAsyncResource';

const variantMeta = (variant) => {
  const duration = variant.maxDurationMinutes
    ? `${variant.durationMinutes}–${variant.maxDurationMinutes} phút`
    : `${variant.durationMinutes || 0} phút`;
  return `${variant.priceDisplay || 'Giá đang cập nhật'} · ${duration}`;
};

export default function BookingStep1() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedBranch = params.get('branchId');
  const requestedService = params.get('serviceId');
  const requestedStaff = params.get('staffId');
  const {
    branchId, serviceIds, comboId, variantSelections,
    setBranch, toggleService, setCombo, setStaff, setVariant,
  } = useBookingStore();
  const branchResource = useAsyncResource('public-branches', () => branchesApi.getAll());
  const branches = branchResource.data?.data ?? branchResource.data ?? [];
  const loading = branchResource.loading;
  const error = branchResource.error?.message || '';
  const loadBranches = branchResource.reload;
  const catalog = useAsyncResource(branchId, async () => {
    const [serviceResult, comboResult] = await Promise.all([servicesApi.getAll(branchId), combosApi.getPublic(branchId)]);
    return { services: serviceResult.data ?? serviceResult, combos: comboResult.data ?? comboResult };
  });
  const services = catalog.data?.services ?? [];
  const combos = catalog.data?.combos ?? [];
  const serviceLoading = catalog.loading;
  const appliedLink = useRef({ key: null, branch: false, selection: false });
  const linkKey = requestedBranch ? JSON.stringify([requestedBranch, requestedService, requestedStaff]) : null;
  useEffect(() => {
    if (!linkKey) { appliedLink.current = { key: null, branch: false, selection: false }; return; }
    if (appliedLink.current.key !== linkKey) appliedLink.current = { key: linkKey, branch: false, selection: false };
    const applied = appliedLink.current;
    if (!applied.branch) {
      if (!branches.some((branch) => branch.id === requestedBranch)) return;
      applied.branch = true;
      if (branchId !== requestedBranch) { setBranch(requestedBranch); return; }
    }
    if (applied.selection || branchId !== requestedBranch || !catalog.data) return;
    applied.selection = true;
    if (requestedService && services.some((service) => service.id === requestedService) && !serviceIds.includes(requestedService)) toggleService(requestedService);
    if (requestedStaff) setStaff(requestedStaff);
  }, [linkKey, branches, branchId, catalog.data, requestedBranch, requestedService, requestedStaff, services, serviceIds, setBranch, toggleService, setStaff]);

  const chosen = useMemo(() => services.filter((service) => serviceIds.includes(service.id)), [services, serviceIds]);
  useEffect(() => {
    if (!catalog.data) return;
    if (comboId && !combos.some((combo) => combo.id === comboId)) { setCombo(null); return; }
    serviceIds.filter((id) => !services.some((service) => service.id === id)).forEach(toggleService);
  }, [catalog.data, comboId, combos, serviceIds, services, setCombo, toggleService]);
  const variantsComplete = comboId || chosen.every((service) => !service.variants?.length || service.variants.some((variant) => variant.id === variantSelections[service.id] && variant.priceType !== 'QUOTE'));

  return <BookingLayout step={1} title="Chọn chi nhánh và dịch vụ" description="Chọn đúng biến thể để hệ thống giữ giá, thời lượng và buffer áp dụng tại thời điểm đặt.">
    {loading ? <Skeleton rows={5} /> : error && !branches.length ? <ErrorState message={error} onRetry={loadBranches} /> : <div className="space-y-7">
      <section><h2 className="mb-3 text-sm font-bold">1. Chi nhánh</h2><div className="grid gap-3 sm:grid-cols-2">{branches.map((branch) => <SelectionCard key={branch.id} selected={branchId === branch.id} onClick={() => setBranch(branch.id)} icon={<MapPin size={18} />} title={branch.branch_name || branch.name} meta={[branch.address, branch.district].filter(Boolean).join(', ') || 'Chưa cập nhật địa chỉ'} />)}</div></section>
      {branchId && !serviceLoading && combos.length > 0 && <section><h2 className="mb-3 text-sm font-bold">2. Combo ưu đãi <span className="font-normal text-[var(--bb-muted)]">(chọn một)</span></h2><div className="grid gap-3 sm:grid-cols-2">{combos.map((combo) => <SelectionCard key={combo.id} selected={comboId === combo.id} onClick={() => setCombo(comboId === combo.id ? null : combo)} icon={<Gift size={18} />} title={combo.name} meta={`${combo.durationMinutes || 0} phút · tiết kiệm ${Number(combo.savingAmount || 0).toLocaleString('vi-VN')}₫`} trailing={`${Number(combo.comboPrice || 0).toLocaleString('vi-VN')}₫`} />)}</div></section>}
      {catalog.error && <ErrorState message={catalog.error.message} onRetry={catalog.reload} />}
      <section><h2 className="mb-3 text-sm font-bold">{combos.length ? 'Hoặc chọn dịch vụ riêng lẻ' : '2. Dịch vụ'} <span className="font-normal text-[var(--bb-muted)]">(có thể chọn nhiều)</span></h2>
        {!branchId ? <EmptyState title="Hãy chọn chi nhánh" description="Dịch vụ sẽ được tải theo chi nhánh bạn chọn." /> : serviceLoading ? <Skeleton rows={4} /> : !services.length ? <EmptyState title="Chưa có dịch vụ khả dụng" description="Chi nhánh này chưa trả về dịch vụ để đặt lịch." /> : <div className="grid gap-3 sm:grid-cols-2">{services.map((service) => <SelectionCard key={service.id} selected={!comboId && serviceIds.includes(service.id)} onClick={() => toggleService(service.id)} icon={<Scissors size={18} />} title={service.name} meta={`${service.durationMinutes || 0} phút`} trailing={service.priceDisplay || `${Number(service.price || 0).toLocaleString('vi-VN')}₫`} />)}</div>}
      </section>
      {!comboId && chosen.filter((service) => service.variants?.length).map((service) => <section key={service.id} className="rounded-2xl border border-[var(--bb-border)] p-4"><h3 className="font-bold">Lựa chọn cho {service.name}</h3><p className="mt-1 text-xs text-[var(--bb-muted)]">Giá và thời lượng được snapshot vào lịch, không đổi khi catalog cập nhật sau này.</p><Select className="mt-3" value={variantSelections[service.id] || ''} onChange={(event) => setVariant(service.id, event.target.value)}><option value="">Chọn biến thể</option>{service.variants.map((variant) => <option key={variant.id} value={variant.id} disabled={variant.priceType === 'QUOTE'}>{variant.name} · {variantMeta(variant)}</option>)}</Select>{service.variants.some((variant) => variant.priceType === 'QUOTE') && <p className="mt-3 text-xs text-amber-700">Một số lựa chọn cần báo giá trước; vui lòng liên hệ cơ sở nếu không thể đặt trực tuyến.</p>}</section>)}
      <div className="flex justify-end border-t border-[var(--bb-border)] pt-5"><Button disabled={!branchId || !serviceIds.length || serviceLoading || Boolean(catalog.error) || chosen.length !== serviceIds.length || !variantsComplete} onClick={() => navigate('/book/staff')}>{variantsComplete ? 'Tiếp tục' : 'Chọn đủ biến thể'}</Button></div>
    </div>}
  </BookingLayout>;
}
