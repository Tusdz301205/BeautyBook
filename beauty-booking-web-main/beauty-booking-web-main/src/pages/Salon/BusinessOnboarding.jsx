import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  FileText,
  Save,
  Store,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { businessApi } from '../../api/apiClient';
import { FileUpload } from '../../components/media/FileUpload';
import { statusLabel } from '../../utils/displayLabels';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  InlineNotice,
  Input,
  Page,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from '../../components/ui';

const steps = [
  ['Loại hình', BriefcaseBusiness],
  ['Thông tin pháp nhân', Store],
  ['Giấy tờ xác minh', FileText],
  ['Kiểm tra & gửi', CheckCircle2],
];

const businessTypes = [
  ['HAIR_SALON', 'Salon tóc'],
  ['SPA', 'Spa'],
  ['NAIL', 'Nail'],
  ['BARBER', 'Barber'],
  ['MAKEUP', 'Makeup'],
  ['MASSAGE', 'Massage'],
  ['BEAUTY_STUDIO', 'Beauty studio'],
  ['MOBILE_SERVICE', 'Dịch vụ tận nơi'],
];

const identityDefaults = {
  name: '',
  slug: '',
  companyName: '',
  taxCode: '',
  identityCardNumber: '',
  contactEmail: '',
  contactPhone: '',
  addressLine: '',
  legalRepresentative: '',
  description: '',
};

const draftDefaults = {
  businessType: '',
  completedSteps: [],
};

const emptyDocument = () => ({
  documentType: 'BUSINESS_LICENSE',
  documentName: '',
  documentNumber: '',
  expiresAt: '',
  documentUrl: '',
  mediaId: '',
  media: null,
  note: '',
});

const statusTone = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  NEED_MORE_INFO: 'warning',
  APPROVED: 'success',
  ACTIVE: 'success',
  REJECTED: 'danger',
};

const localKey = 'beautybook-business-onboarding-recovery-v2';

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

function ChoiceGrid({ value, onChange }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {businessTypes.map(([optionValue, label]) => (
        <button
          key={optionValue}
          type="button"
          aria-pressed={value === optionValue}
          onClick={() => onChange(optionValue)}
          className={`min-h-14 rounded-xl border p-4 text-left text-sm font-bold transition ${
            value === optionValue
              ? 'border-[var(--bb-brand)] bg-[var(--bb-brand-soft)] text-[var(--bb-brand-strong)]'
              : 'border-[var(--bb-border)] hover:bg-[var(--bb-surface-subtle)]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function BusinessOnboarding() {
  const [business, setBusiness] = useState(null);
  const [identity, setIdentity] = useState(identityDefaults);
  const [draft, setDraft] = useState(draftDefaults);
  const [documents, setDocuments] = useState([emptyDocument()]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [dirty, setDirty] = useState(false);
  const hydrated = useRef(false);
  const editable = !business || ['DRAFT', 'NEED_MORE_INFO'].includes(business.status);

  const hydrate = (value) => {
    setBusiness(value);
    if (!value) return;
    setIdentity(Object.fromEntries(
      Object.keys(identityDefaults).map((key) => [key, value[key] ?? value.owner?.[key] ?? '']),
    ));
    setDraft({
      ...draftDefaults,
      businessType: value.onboardingData?.businessType || '',
      completedSteps: (value.onboardingData?.completedSteps || []).filter((item) => item <= 4),
    });
    setDocuments(value.legalDocuments?.length ? value.legalDocuments : [emptyDocument()]);
    setStep(Math.min(4, Math.max(1, Number(value.onboardingStep || 1))));
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await businessApi.getMyOnboarding();
      hydrate(result);
      if (!result) {
        const recovery = JSON.parse(window.localStorage.getItem(localKey) || 'null');
        if (recovery) {
          setIdentity({ ...identityDefaults, ...(recovery.identity || {}) });
          setDraft({ ...draftDefaults, ...(recovery.draft || {}) });
          setStep(Math.min(4, Math.max(1, recovery.step || 1)));
        }
      }
      hydrated.current = true;
    } catch (requestError) {
      setError(requestError.message || 'Không thể tải hồ sơ doanh nghiệp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const warn = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const legalPayload = () => documents
    .filter((item) => item.documentName?.trim() && item.mediaId)
    .map((item) => ({
      documentType: item.documentType,
      documentName: item.documentName.trim(),
      documentNumber: item.documentNumber?.trim() || undefined,
      expiresAt: item.expiresAt || undefined,
      documentUrl: `/api/v1/media/${item.mediaId}/content`,
      mediaId: item.mediaId,
      note: item.note?.trim() || undefined,
    }));

  const payload = (nextStep, nextDraft) => ({
    ...Object.fromEntries(
      Object.entries(identity).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.trim() || undefined : value,
      ]),
    ),
    onboardingStep: nextStep,
    onboardingData: nextDraft,
    legalDocuments: legalPayload(),
  });

  const persist = async ({ nextStep = step, nextDraft = draft, silent = false } = {}) => {
    window.localStorage.setItem(localKey, JSON.stringify({ identity, draft: nextDraft, step: nextStep }));
    if (!identity.name.trim() || !identity.slug.trim()) return null;
    setBusy(silent ? 'autosave' : 'save');
    try {
      const result = business
        ? await businessApi.updateDraft(business.id, payload(nextStep, nextDraft))
        : await businessApi.createDraft(payload(nextStep, nextDraft));
      setBusiness((current) => ({
        ...current,
        ...result,
        onboardingData: nextDraft,
        onboardingStep: nextStep,
        legalDocuments: legalPayload(),
        owner: {
          ...current?.owner,
          companyName: identity.companyName,
          taxCode: identity.taxCode,
          identityCardNumber: identity.identityCardNumber,
        },
      }));
      setDirty(false);
      window.localStorage.removeItem(localKey);
      if (!silent) toast.success('Đã lưu hồ sơ doanh nghiệp');
      return result;
    } catch (requestError) {
      if (!silent) toast.error(requestError.message);
      return null;
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    if (!hydrated.current || !business || !dirty || !editable) return undefined;
    const timer = window.setTimeout(() => { void persist({ silent: true }); }, 900);
    return () => window.clearTimeout(timer);
  }, [identity, draft, documents, step, dirty, editable, business?.id]);

  const errorsForStep = (target) => {
    const errors = [];
    if (target === 1 && !draft.businessType) errors.push('Chọn loại hình doanh nghiệp.');
    if (target === 2) {
      [
        ['name', 'tên thương hiệu'],
        ['companyName', 'tên pháp nhân'],
        ['taxCode', 'mã số thuế'],
        ['contactEmail', 'email liên hệ'],
        ['contactPhone', 'số điện thoại'],
        ['addressLine', 'địa chỉ đăng ký'],
        ['legalRepresentative', 'người đại diện'],
      ].forEach(([key, label]) => {
        if (!identity[key]?.trim()) errors.push(`Nhập ${label}.`);
      });
    }
    if (target === 3) {
      const types = new Set(legalPayload().map((item) => item.documentType));
      if (!types.has('BUSINESS_LICENSE')) errors.push('Đính kèm giấy phép kinh doanh.');
      if (!types.has('OWNER_ID_CARD')) errors.push('Đính kèm CCCD người đại diện.');
    }
    return errors;
  };

  const next = async () => {
    const errors = errorsForStep(step);
    setValidationErrors(errors);
    if (errors.length) return;
    const nextDraft = {
      ...draft,
      completedSteps: [...new Set([...(draft.completedSteps || []), step])].sort(),
    };
    setDraft(nextDraft);
    const nextStep = Math.min(4, step + 1);
    if (step === 1 && !identity.name.trim()) {
      setStep(nextStep);
      return;
    }
    const saved = await persist({ nextStep, nextDraft, silent: true });
    if (saved || business) setStep(nextStep);
  };

  const submit = async () => {
    const errors = [...errorsForStep(1), ...errorsForStep(2), ...errorsForStep(3)];
    setValidationErrors([...new Set(errors)]);
    if (errors.length) return;
    setBusy('submit');
    try {
      const nextDraft = {
        ...draft,
        completedSteps: [1, 2, 3, 4],
      };
      const saved = await persist({ nextStep: 4, nextDraft, silent: true });
      const id = saved?.id || business?.id;
      if (!id) throw new Error('Hồ sơ chưa được đồng bộ');
      await businessApi.submit(id);
      toast.success(business?.status === 'NEED_MORE_INFO' ? 'Đã gửi lại hồ sơ' : 'Đã gửi hồ sơ xét duyệt');
      await load();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const updateIdentity = (key) => (event) => {
    const value = event.target.value;
    setIdentity((current) => ({
      ...current,
      [key]: value,
      ...(key === 'name' && (!current.slug || current.slug === slugify(current.name))
        ? { slug: slugify(value) }
        : {}),
    }));
    setDirty(true);
  };

  const updateDocument = (index, patch) => {
    setDocuments((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    ));
    setDirty(true);
  };

  const completion = useMemo(
    () => Math.round(((draft.completedSteps?.filter((item) => item <= 4).length || 0) / 4) * 100),
    [draft.completedSteps],
  );

  if (loading) return <Page><Card className="p-5"><Skeleton rows={8} /></Card></Page>;
  if (error) return <Page><Card><ErrorState message={error} onRetry={load} /></Card></Page>;

  return (
    <Page className="max-w-5xl">
      <PageHeader
        eyebrow="Xác minh doanh nghiệp"
        title="Đăng ký BeautyBook Business"
        description="Luồng này chỉ xác minh doanh nghiệp và pháp nhân lần đầu. Chi nhánh, dịch vụ và nhân sự sẽ được thiết lập riêng sau khi doanh nghiệp được duyệt."
        actions={editable ? (
          <Button variant="secondary" loading={busy === 'save'} onClick={() => persist()}>
            <Save size={16} />Lưu & tiếp tục sau
          </Button>
        ) : null}
      />

      {business && (
        <InlineNotice tone={business.status === 'REJECTED' ? 'danger' : business.status === 'NEED_MORE_INFO' ? 'warning' : 'info'}>
          <span className="flex flex-wrap items-center gap-2">
            Trạng thái doanh nghiệp
            <Badge tone={statusTone[business.status]}>{business.status}</Badge>
            {business.reviewNote && <strong>Phản hồi: {business.reviewNote}</strong>}
          </span>
        </InlineNotice>
      )}

      {!editable ? (
        <Card className="p-6">
          <h2 className="text-xl font-bold">Hồ sơ đang được xét duyệt</h2>
          <p className="mt-2 text-sm text-[var(--bb-muted)]">Bạn có thể theo dõi lịch sử xử lý; dữ liệu được khóa trong lúc xét duyệt.</p>
          <ul className="mt-5 space-y-2 text-sm">
            {(business?.reviewEvents || []).map((event) => (
              <li key={event.id} className="rounded-xl bg-[var(--bb-surface-subtle)] p-3">
                <strong>{event.action === 'APPROVE' ? 'Phê duyệt' : event.action === 'REQUEST_INFO' ? 'Yêu cầu bổ sung' : event.action === 'REJECT' ? 'Từ chối' : 'Cập nhật hồ sơ'}</strong> · {event.fromStatus ? statusLabel(event.fromStatus) : '—'} → {statusLabel(event.toStatus)}
                <span className="ml-2 text-[var(--bb-muted)]">{new Date(event.createdAt).toLocaleString('vi-VN')}</span>
                {event.reason && <p className="mt-1 text-[var(--bb-muted)]">{event.reason}</p>}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--bb-border)] p-4">
              <div>
                <p className="text-sm font-bold">Bước {step}/4 · {steps[step - 1][0]}</p>
                <p className="mt-1 text-xs text-[var(--bb-muted)]">Tự động lưu khi hồ sơ đã được tạo</p>
              </div>
              <Badge tone="brand">{completion}%</Badge>
            </div>
            <nav className="overflow-x-auto p-3" aria-label="Các bước đăng ký doanh nghiệp">
              <ol className="flex min-w-max gap-2">
                {steps.map(([label, Icon], index) => {
                  const number = index + 1;
                  const done = draft.completedSteps?.includes(number);
                  const maxStep = Math.max(step, ...(draft.completedSteps || []).map((item) => item + 1));
                  return (
                    <li key={label}>
                      <button
                        type="button"
                        disabled={number > maxStep}
                        aria-current={number === step ? 'step' : undefined}
                        onClick={() => setStep(number)}
                        className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold disabled:opacity-40 ${
                          number === step
                            ? 'border-[var(--bb-brand)] bg-[var(--bb-brand-soft)] text-[var(--bb-brand-strong)]'
                            : 'border-[var(--bb-border)]'
                        }`}
                      >
                        {done ? <Check size={15} /> : <Icon size={15} />}{number}. {label}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </Card>

          {validationErrors.length > 0 && (
            <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4">
              <strong>Hoàn thiện các mục sau:</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {validationErrors.map((message) => <li key={message}>{message}</li>)}
              </ul>
            </div>
          )}

          <Card className="p-5 sm:p-6">
            {step === 1 && (
              <div>
                <h2 className="font-bold">Doanh nghiệp hoạt động trong lĩnh vực nào?</h2>
                <p className="mt-1 text-sm text-[var(--bb-muted)]">Thông tin này dùng để phân loại hồ sơ, không tự tạo chi nhánh hoặc dịch vụ.</p>
                <div className="mt-4">
                  <ChoiceGrid
                    value={draft.businessType}
                    onChange={(businessType) => {
                      setDraft((current) => ({ ...current, businessType }));
                      setDirty(true);
                    }}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ['name', 'Tên thương hiệu'],
                  ['slug', 'Đường dẫn BeautyBook'],
                  ['companyName', 'Tên pháp nhân'],
                  ['taxCode', 'Mã số thuế'],
                  ['identityCardNumber', 'Số CCCD người đại diện'],
                  ['contactEmail', 'Email liên hệ'],
                  ['contactPhone', 'Điện thoại'],
                  ['addressLine', 'Địa chỉ đăng ký'],
                  ['legalRepresentative', 'Người đại diện'],
                ].map(([key, label]) => (
                  <Field key={key} label={label} required={key !== 'identityCardNumber'}>
                    <Input value={identity[key]} onChange={updateIdentity(key)} />
                  </Field>
                ))}
                <Field label="Giới thiệu doanh nghiệp" className="sm:col-span-2">
                  <Textarea value={identity.description} onChange={updateIdentity('description')} />
                </Field>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="font-bold">Giấy tờ xác minh pháp nhân</h2>
                <p className="mt-1 text-sm text-[var(--bb-muted)]">Tệp private, đúng tenant và mỗi lần thay thế sẽ tạo một version mới.</p>
                <div className="mt-4 space-y-4">
                  {documents.map((document, index) => (
                    <article key={document.id || index} className="grid gap-3 rounded-xl border border-[var(--bb-border)] p-4 sm:grid-cols-2">
                      <Field label="Loại tài liệu" required>
                        <Select
                          value={document.documentType}
                          onChange={(event) => updateDocument(index, { documentType: event.target.value })}
                        >
                          <option value="BUSINESS_LICENSE">Giấy phép kinh doanh</option>
                          <option value="OWNER_ID_CARD">CCCD người đại diện</option>
                          <option value="TAX_DOCUMENT">Tài liệu thuế</option>
                          <option value="OTHER">Tài liệu khác</option>
                        </Select>
                      </Field>
                      <Field label="Tên tài liệu" required>
                        <Input value={document.documentName || ''} onChange={(event) => updateDocument(index, { documentName: event.target.value })} />
                      </Field>
                      <Field label="Số tài liệu">
                        <Input value={document.documentNumber || ''} onChange={(event) => updateDocument(index, { documentNumber: event.target.value })} />
                      </Field>
                      <Field label="Ngày hết hạn">
                        <Input type="date" value={document.expiresAt || ''} onChange={(event) => updateDocument(index, { expiresAt: event.target.value })} />
                      </Field>
                      <div className="sm:col-span-2">
                        <FileUpload
                          document
                          entityType="LEGAL_DOCUMENT"
                          entityId={business?.id}
                          businessId={business?.id}
                          value={document.media || (document.mediaId ? { id: document.mediaId, originalName: document.documentName } : null)}
                          onUploaded={(media) => updateDocument(index, {
                            media,
                            mediaId: media.id,
                            documentName: document.documentName || media.originalName,
                          })}
                          onRemoved={() => updateDocument(index, { media: null, mediaId: '' })}
                        />
                      </div>
                      {document.status && <Badge tone={document.status === 'APPROVED' ? 'success' : 'neutral'}>{statusLabel(document.status)} · phiên bản {document.currentVersion || 1}</Badge>}
                    </article>
                  ))}
                  <Button type="button" variant="secondary" onClick={() => {
                    setDocuments((current) => [...current, emptyDocument()]);
                    setDirty(true);
                  }}>
                    Thêm tài liệu
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <InlineNotice tone="info">Gửi duyệt chỉ xác minh doanh nghiệp. Hệ thống chưa tạo chi nhánh và chưa công khai nhận đặt lịch.</InlineNotice>
                <dl className="grid gap-3 rounded-xl bg-[var(--bb-surface-subtle)] p-4 sm:grid-cols-2">
                  <div><dt className="text-xs font-bold uppercase text-[var(--bb-muted)]">Thương hiệu</dt><dd className="mt-1 font-bold">{identity.name}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-[var(--bb-muted)]">Pháp nhân</dt><dd className="mt-1 font-bold">{identity.companyName}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-[var(--bb-muted)]">Mã số thuế</dt><dd className="mt-1 font-bold">{identity.taxCode}</dd></div>
                  <div><dt className="text-xs font-bold uppercase text-[var(--bb-muted)]">Tài liệu hợp lệ</dt><dd className="mt-1 font-bold">{legalPayload().length}</dd></div>
                </dl>
                <Button onClick={submit} loading={busy === 'submit'}>
                  Gửi hồ sơ doanh nghiệp <ArrowRight size={16} />
                </Button>
              </div>
            )}
          </Card>

          <div className="flex justify-between gap-3">
            <Button variant="secondary" disabled={step === 1} onClick={() => setStep((current) => current - 1)}>
              <ArrowLeft size={16} />Quay lại
            </Button>
            {step < 4 && <Button onClick={next}>Lưu và tiếp tục <ArrowRight size={16} /></Button>}
          </div>
        </>
      )}
    </Page>
  );
}
