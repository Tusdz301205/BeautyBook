import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { staffApi, servicesApi } from '../../api/apiClient';
import { FINANCE_WORKSPACE_ENABLED } from '../../config/featureAvailability';
import { ChoiceDataError, assertChoice, choiceContext, loadStaffChoices, resolutionOptions, resolutionPayload, transferChoices } from '../../utils/operationsProduct';
import { Button, ErrorState, Field, Input, Select } from '../ui';

export default function OperationsResolutionForm({ form, setForm, businessId, branches, items, busy, submit, submitLabel }) {
  const [choices, setChoices] = useState({ key: '', loading: false, error: '', rows: [] });
  const [retry, setRetry] = useState(0);
  const needsStaff = ['REASSIGN', 'TRANSFER_BRANCH'].includes(form.resolution);
  const targets = transferChoices(branches, businessId, items);
  const scopeKey = JSON.stringify(branches.map((branch) => [branch.id, branch.businessId || branch.business?.id, branch.status, branch.operationalStatus]));
  const key = JSON.stringify([scopeKey, choiceContext(businessId, items, form.resolution, form.replacementBranchId)]);
  useEffect(() => {
    let active = true;
    setForm((current) => ({ ...current, replacementStaffId: '', replacementBranchId: current.replacementBranchId && !targets.some((branch) => branch.id === current.replacementBranchId) ? '' : current.replacementBranchId }));
    if (!needsStaff || (form.resolution === 'TRANSFER_BRANCH' && !form.replacementBranchId)) {
      setChoices({ key, loading: false, error: '', rows: [] });
      return () => { active = false; };
    }
    setChoices({ key, loading: true, error: '', rows: [] });
    loadStaffChoices({ businessId, items, resolution: form.resolution, targetBranchId: form.replacementBranchId, branches, staffApi, servicesApi })
      .then((rows) => { if (active) setChoices({ key, loading: false, error: '', rows }); })
      .catch((error) => { if (active) setChoices({ key, loading: false, error: error instanceof ChoiceDataError ? error.message : 'Không thể tải lựa chọn nhân viên hoặc đối chiếu dịch vụ. Hãy thử lại; nếu vẫn lỗi, xử lý từng lịch hoặc tải lại hồ sơ.', rows: [] }); });
    return () => { active = false; };
  }, [key, retry]);
  const ready = choices.key === key && !choices.loading && !choices.error;
  const rows = ready ? choices.rows : [];
  const update = (changes) => setForm((current) => ({ ...current, ...changes }));
  return <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
    event.preventDefault();
    try {
      const payload = resolutionPayload(form, FINANCE_WORKSPACE_ENABLED);
      assertChoice(form, key, choices, targets);
      submit(payload);
    } catch (error) { toast.error(error.message); }
  }}>
    <Field label="Phương án"><Select value={form.resolution} onChange={(event) => update({ resolution: event.target.value, replacementStaffId: '', replacementBranchId: '', proposedStartAt: '' })}>{resolutionOptions(FINANCE_WORKSPACE_ENABLED).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
    <Field label="Lý do" required><Input value={form.reason} onChange={(event) => update({ reason: event.target.value })} required /></Field>
    {form.resolution === 'TRANSFER_BRANCH' && <Field label="Chi nhánh đích" required><Select required value={targets.some((branch) => branch.id === form.replacementBranchId) ? form.replacementBranchId : ''} onChange={(event) => update({ replacementBranchId: event.target.value, replacementStaffId: '' })}><option value="">Chọn chi nhánh</option>{targets.map((branch) => <option key={branch.id} value={branch.id}>{branch.name || branch.publicName || 'Chi nhánh chưa có tên'}</option>)}</Select>{!targets.length && <p className="mt-2 text-sm">Không có chi nhánh khác trong phạm vi đang nhận lịch cho các lịch đã chọn.</p>}</Field>}
    {needsStaff && <Field label={form.resolution === 'TRANSFER_BRANCH' ? 'Nhân viên tại chi nhánh đích' : 'Nhân viên thay thế'} required><Select required disabled={!ready || !rows.length} value={rows.some((staff) => staff.id === form.replacementStaffId) ? form.replacementStaffId : ''} onChange={(event) => update({ replacementStaffId: event.target.value })}><option value="">{!ready && !choices.error ? 'Đang tải nhân viên…' : 'Chọn nhân viên'}</option>{rows.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName || staff.user?.fullName || 'Nhân viên chưa có tên'}{staff.position ? ` · ${staff.position}` : ''}{staff.branch?.name ? ` · ${staff.branch.name}` : ''}</option>)}</Select></Field>}
    {needsStaff && <div className="min-w-0 break-words sm:col-span-2" aria-live="polite">
      {choices.key === key && choices.error ? <ErrorState message={choices.error} onRetry={() => setRetry((value) => value + 1)} /> : form.resolution === 'TRANSFER_BRANCH' && !form.replacementBranchId ? <p className="text-sm">Chọn chi nhánh để tải nhân viên phụ trách dịch vụ.</p> : !ready ? <p className="text-sm">Đang tải lựa chọn nhân viên…</p> : !rows.length ? <p className="text-sm">Không có nhân viên trong phạm vi phụ trách đủ dịch vụ cho {items.length > 1 ? 'tất cả lịch đã chọn. Có thể xử lý từng lịch.' : 'lịch này.'}</p> : <p className="text-sm text-[var(--bb-muted)]">Danh sách dựa trên hồ sơ nhận lịch và dịch vụ phụ trách. Hệ thống sẽ kiểm tra khả năng nhận lịch, thời lượng dịch vụ và trùng lịch khi xác nhận.</p>}
    </div>}
    {form.resolution === 'RESCHEDULE' && <Field label="Thời gian mới" required><Input type="datetime-local" value={form.proposedStartAt} onChange={(event) => update({ proposedStartAt: event.target.value })} required /></Field>}
    <div className="sm:col-span-2"><Button type="submit" loading={busy} disabled={needsStaff && (!ready || !rows.some((staff) => staff.id === form.replacementStaffId) || (form.resolution === 'TRANSFER_BRANCH' && !targets.some((branch) => branch.id === form.replacementBranchId)))}>{submitLabel}</Button></div>
  </form>;
}
