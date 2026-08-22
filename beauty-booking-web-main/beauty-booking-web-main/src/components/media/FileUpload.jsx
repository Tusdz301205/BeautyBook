import React, { useEffect, useId, useState } from 'react';
import { FileCheck2, FileUp, Image, LoaderCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { mediaApi } from '../../api/apiClient';
import { Button, cx } from '../ui';

export function FileUpload({
  entityType,
  entityId,
  businessId,
  branchId,
  value,
  onUploaded,
  onRemoved,
  document = false,
  multiple = false,
  label = 'Tải tệp lên',
  disabled = false,
  className = '',
}) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(value?.url || '');
  useEffect(() => { setPreview(value?.url || ''); }, [value?.url]);

  const validate = (file) => {
    const allowed = document
      ? ['application/pdf']
      : ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowed.includes(file.type)) return document ? 'Chỉ nhận tài liệu PDF.' : 'Chỉ nhận ảnh JPG, PNG, WebP hoặc AVIF.';
    if (file.size > 10 * 1024 * 1024) return 'Tệp không được lớn hơn 10 MB.';
    return '';
  };

  const upload = async (files) => {
    const selected = [...(files || [])];
    if (!selected.length) return;
    const invalid = selected.map(validate).find(Boolean);
    if (invalid) { toast.error(invalid); return; }
    if (!entityId) { toast.error('Hãy lưu hồ sơ trước khi tải tệp.'); return; }
    setBusy(true);
    try {
      for (const file of selected) {
        const media = await mediaApi.upload(file, { entityType, entityId, businessId, branchId });
        setPreview(document ? '' : URL.createObjectURL(file));
        onUploaded?.(media);
      }
      toast.success(document ? `Đã tải ${selected.length} tài liệu an toàn` : 'Đã tải ảnh lên');
    } catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!value?.id) { setPreview(''); onRemoved?.(); return; }
    setBusy(true);
    try { await mediaApi.remove(value.id); setPreview(''); onRemoved?.(); toast.success('Đã gỡ tệp'); }
    catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  };

  return <div className={cx('rounded-[var(--bb-radius-card)] border border-dashed border-[var(--bb-border)] bg-[var(--bb-surface)] p-4', className)}>
    <input
      id={inputId}
      className="bb-sr-only"
      type="file"
      multiple={multiple}
      accept={document ? 'application/pdf,.pdf' : 'image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif'}
      disabled={disabled || busy}
      onChange={(event) => { upload(event.target.files); event.target.value = ''; }}
    />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {preview && !document
        ? <img src={preview} alt="Ảnh vừa tải" width="80" height="80" className="h-20 w-20 rounded-xl object-cover" />
        : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[var(--bb-brand-soft)] text-[var(--bb-brand-strong)]">{document ? <FileCheck2 size={23} /> : <Image size={23} />}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{value?.originalName || label}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--bb-muted)]">{document ? `PDF tối đa 10 MB mỗi tệp. Tài liệu được lưu riêng tư.${multiple ? ' Có thể chọn nhiều tệp.' : ''}` : 'JPG, PNG, WebP hoặc AVIF; tối đa 10 MB.'}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <label htmlFor={inputId} aria-disabled={disabled || busy} className={cx('inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--bb-radius-control)] border border-[var(--bb-border)] bg-white px-3 text-sm font-semibold', (disabled || busy) && 'cursor-not-allowed opacity-50')}>
          {busy ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" /> : <FileUp size={16} />}
          {value ? 'Thay tệp' : 'Chọn tệp'}
        </label>
        {value && <Button type="button" variant="ghost" size="sm" disabled={disabled} loading={busy} onClick={remove} className="text-[var(--bb-danger)]"><Trash2 size={15} />Gỡ</Button>}
      </div>
    </div>
  </div>;
}
