import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { servicesApi } from '../../api/apiClient';
import { Button, Dialog, ErrorState, Field, Input, Skeleton } from '../ui';

const money = value => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;
const relationLabels = { ADD_ON: 'Có thể đặt thêm', REQUIRED: 'Phải đặt cùng', INCOMPATIBLE: 'Không đặt cùng' };
const newOption = (price, durationMinutes) => ({ code: `OPT-${crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')}`, name: '', price: price ?? '', durationMinutes: durationMinutes ?? '', bufferBeforeMinutes: 0, bufferAfterMinutes: 0 });
const priceRuleText = rule => `${Number(rule.adjustmentValue) >= 0 ? '+' : ''}${rule.adjustmentType === 'PERCENTAGE' ? `${rule.adjustmentValue}%` : money(rule.adjustmentValue)}`;
const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
function ruleSchedule(rule) {
  const conditions = rule.conditions || {};
  const days = (Array.isArray(conditions.daysOfWeek) ? conditions.daysOfWeek : []).filter(day => Number.isInteger(day) && day >= 0 && day <= 6).map(day => dayNames[day]).join(', ') || 'Mọi ngày';
  return `${days}${conditions.startTime || conditions.endTime ? ` · ${conditions.startTime || '00:00'}–${conditions.endTime || '24:00'}` : ''}${rule.validFrom ? ` · Từ ${new Date(rule.validFrom).toLocaleDateString('vi-VN')}` : ''}${rule.validTo ? ` · Đến ${new Date(rule.validTo).toLocaleDateString('vi-VN')}` : ''}${rule.variant?.name ? ` · ${rule.variant.name}` : ''}${conditions.staffId ? ' · Theo nhân viên đã chọn' : ''}`;
}

// Hallmark · pre-emit critique: P4 H4 E4 S4 R5 V3
export default function BranchServiceOptions({ offeringId, price, durationMinutes, canPricingEdit = false }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [timingOpen, setTimingOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(null);
  const mutation = useRef(false);
  const generation = useRef(0);
  const refresh = async () => {
    const current = ++generation.current;
    try {
      const data = await servicesApi.getOptionsManage(offeringId);
      if (generation.current === current) { setConfig(data); setError(''); }
    } catch (requestError) {
      if (generation.current === current) setError('Không thể tải cài đặt dịch vụ. Vui lòng thử lại.');
      throw requestError;
    } finally { if (generation.current === current) setLoading(false); }
  };
  useEffect(() => {
    setLoading(true); setForm(null); setConfirm(null);
    void refresh().catch(() => {});
    return () => { generation.current++; };
  }, [offeringId]);
  const set = key => event => { setForm(current => ({ ...current, [key]: event.target.value })); setErrors(current => ({ ...current, [key]: '' })); };
  const run = async (key, action) => {
    if (mutation.current) return;
    mutation.current = true; setBusy(key);
    try { await action(); } catch (requestError) { toast.error(requestError.message || 'Không thể lưu thay đổi.'); }
    finally { mutation.current = false; setBusy(''); }
  };
  const create = event => {
    event.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Nhập tên lựa chọn.';
    if (form.price === '' || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) next.price = 'Nhập giá từ 0 đồng.';
    if (!Number.isInteger(Number(form.durationMinutes)) || Number(form.durationMinutes) <= 0) next.durationMinutes = 'Nhập số phút nguyên lớn hơn 0.';
    for (const key of ['bufferBeforeMinutes', 'bufferAfterMinutes']) {
      if (!Number.isInteger(Number(form[key])) || Number(form[key]) < 0) next[key] = 'Nhập số phút nguyên từ 0 trở lên.';
    }
    setErrors(next);
    if (next.bufferBeforeMinutes || next.bufferAfterMinutes) setTimingOpen(true);
    if (Object.keys(next).length) return;
    void run('create', async () => {
      await servicesApi.createVariant(offeringId, { code: form.code, name: form.name.trim(), priceType: 'FIXED', price: Number(form.price), durationMinutes: Number(form.durationMinutes), bufferBeforeMinutes: Number(form.bufferBeforeMinutes), bufferAfterMinutes: Number(form.bufferAfterMinutes) });
      setForm(null); setErrors({}); toast.success('Đã thêm lựa chọn dịch vụ');
      await refresh().catch(() => {});
    });
  };
  const applyConfirmedChange = () => void run(confirm.id, async () => {
    if (confirm.kind === 'dependency') await servicesApi.removeDependency(offeringId, confirm.id);
    else await servicesApi.updatePriceRule(confirm.id, { active: !confirm.active });
    setConfirm(null); toast.success('Đã cập nhật quy định dịch vụ'); await refresh().catch(() => {});
  });
  if (loading) return <Skeleton rows={2} />;
  if (error) return <ErrorState message={error} onRetry={() => { void refresh().catch(() => {}); }} />;
  const variants = config?.variants || [];
  const dependencies = config?.dependencies || [];
  const priceRules = config?.priceRules || [];
  return <div className="mt-4 min-w-0 space-y-4 border-t border-[var(--bb-border)] pt-4">
    <div>
      <h4 className="text-sm font-bold">Lựa chọn dịch vụ</h4>
      <p className="mt-1 text-xs leading-5 text-[var(--bb-muted)]">Chỉ thêm khi dịch vụ có nhiều mức giá hoặc thời lượng, ví dụ tóc ngắn và tóc dài.</p>
      {!form && (variants.length > 0 ? <ul className="mt-3 divide-y divide-[var(--bb-border)]">
        {variants.map(variant => <li key={variant.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 flex-1 break-words text-sm"><strong>{variant.name}</strong><p className="mt-1 text-xs text-[var(--bb-muted)]">{variant.priceDisplay} · {variant.durationMinutes}{variant.maxDurationMinutes ? `–${variant.maxDurationMinutes}` : ''} phút{variant.bufferBeforeMinutes > 0 ? ` · Chuẩn bị ${variant.bufferBeforeMinutes} phút` : ''}{variant.bufferAfterMinutes > 0 ? ` · Nghỉ sau ${variant.bufferAfterMinutes} phút` : ''}{variant.status === 'INACTIVE' ? ' · Tạm ngưng' : ''}</p></div>
          {canPricingEdit && <Button size="sm" variant="secondary" disabled={Boolean(busy)} loading={busy === variant.id} onClick={() => void run(variant.id, async () => {
            await servicesApi.updateVariant(variant.id, { status: variant.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
            toast.success('Đã cập nhật lựa chọn'); await refresh().catch(() => {});
          })}>{variant.status === 'ACTIVE' ? 'Tạm ngưng' : 'Kích hoạt'}</Button>}
        </li>)}
      </ul> : <p className="mt-2 text-sm text-[var(--bb-muted)]">Đang dùng giá và thời lượng của dịch vụ.</p>)}
    </div>
    {canPricingEdit && (!form ? <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => { setTimingOpen(false); setForm(newOption(price, durationMinutes)); setErrors({}); }}>Thêm lựa chọn</Button> : <form onSubmit={create} noValidate className="space-y-4">
      <fieldset disabled={Boolean(busy)} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Field label="Tên lựa chọn" required error={errors.name} className="min-w-0 sm:col-span-2"><Input autoFocus maxLength={200} value={form.name} onChange={set('name')} placeholder="Ví dụ: Tóc dài ngang vai" /></Field>
        <Field label="Giá (đ)" required error={errors.price} className="min-w-0"><Input type="number" min="0" value={form.price} onChange={set('price')} /></Field>
        <Field label="Thời lượng (phút)" required error={errors.durationMinutes} className="min-w-0"><Input type="number" min="1" step="1" value={form.durationMinutes} onChange={set('durationMinutes')} /></Field>
        <details className="min-w-0 sm:col-span-2" open={timingOpen} onToggle={event => setTimingOpen(event.currentTarget.open)}>
          <summary className="cursor-pointer py-2 text-sm font-semibold text-[var(--bb-brand-strong)] focus-visible:outline focus-visible:outline-[var(--bb-focus)]">Thời gian chuẩn bị và nghỉ</summary>
          <p className="mt-1 text-xs leading-5 text-[var(--bb-muted)]">Để 0 nếu cơ sở không cần dành thêm thời gian giữa các lượt.</p>
          <div className="mt-2 grid min-w-0 gap-3 sm:grid-cols-2">
            <Field label="Chuẩn bị trước (phút)" error={errors.bufferBeforeMinutes} className="min-w-0"><Input type="number" min="0" step="1" value={form.bufferBeforeMinutes} onChange={set('bufferBeforeMinutes')} /></Field>
            <Field label="Nghỉ sau dịch vụ (phút)" error={errors.bufferAfterMinutes} className="min-w-0"><Input type="number" min="0" step="1" value={form.bufferAfterMinutes} onChange={set('bufferAfterMinutes')} /></Field>
          </div>
        </details>
      </fieldset>
      <div className="flex flex-wrap gap-2"><Button type="submit" loading={busy === 'create'} disabled={Boolean(busy)}>Lưu lựa chọn</Button><Button variant="ghost" disabled={Boolean(busy)} onClick={() => setForm(null)}>Hủy</Button></div>
    </form>)}
    {(dependencies.length > 0 || priceRules.length > 0) && <details className="min-w-0 border-t border-[var(--bb-border)] pt-3">
      <summary className="cursor-pointer py-2 text-sm font-semibold text-[var(--bb-brand-strong)] focus-visible:outline focus-visible:outline-[var(--bb-focus)]">Quy định đã thiết lập ({dependencies.length + priceRules.length})</summary>
      <div className="mt-3 space-y-4">
        {dependencies.map(item => <div key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 text-sm"><div className="min-w-0 flex-1 break-words"><strong>{item.requiredService?.name || 'Dịch vụ đi kèm'}</strong><p className="mt-1 text-xs text-[var(--bb-muted)]">{relationLabels[item.dependencyType] || 'Đi kèm'}</p></div><Button variant="secondary" size="sm" disabled={Boolean(busy)} onClick={() => setConfirm({ ...item, kind: 'dependency' })}>Gỡ quy định</Button></div>)}
        {priceRules.map(item => <div key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 text-sm"><div className="min-w-0 flex-1 break-words"><strong>{item.name} · {priceRuleText(item)}</strong><p className="mt-1 text-xs text-[var(--bb-muted)]">{ruleSchedule(item)}{!item.active ? ' · Đã tắt' : ''}</p></div>{canPricingEdit && <Button variant="secondary" size="sm" disabled={Boolean(busy)} onClick={() => setConfirm({ ...item, kind: 'rule' })}>{item.active ? 'Tắt quy tắc' : 'Bật lại'}</Button>}</div>)}
      </div>
    </details>}
    <Dialog open={Boolean(confirm)} onClose={() => { if (!busy) setConfirm(null); }} title={confirm?.kind === 'dependency' ? 'Gỡ quy định đi kèm?' : confirm?.active ? 'Tắt điều chỉnh giá?' : 'Bật lại điều chỉnh giá?'} footer={<><Button variant="secondary" disabled={Boolean(busy)} onClick={() => setConfirm(null)}>Hủy</Button><Button loading={Boolean(busy)} onClick={applyConfirmedChange}>Xác nhận</Button></>}>
      <p className="text-sm leading-6">{confirm?.kind === 'dependency' ? 'Các lần đặt lịch mới sẽ không còn phải tuân theo quy định đi kèm này.' : 'Thay đổi này áp dụng cho các lần tính giá mới. Giá của lịch đã đặt được giữ nguyên.'}</p>
    </Dialog>
  </div>;
}
