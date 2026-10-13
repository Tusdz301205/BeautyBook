import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useOperations } from '../OperationsContext';
import { OperationButton, OperationState } from '../OperationPrimitives';
import { Body, Card, DesktopLink, Heading } from './OwnerUI';

const stateLabels: Record<string, string> = { ACTIVE: 'Đang hoạt động', DRAFT: 'Hồ sơ nháp', PENDING: 'Đang chờ duyệt', PENDING_REVIEW: 'Đang chờ duyệt', NEED_MORE_INFO: 'Cần bổ sung thông tin', APPROVED: 'Đã được duyệt', REJECTED: 'Chưa được duyệt', SUSPENDED: 'Đang bị tạm ngưng', INACTIVE: 'Chưa hoạt động' };
export default function OwnerSetupState() {
  const { user } = useAuth(); const operations = useOperations();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; value: { name: string; status: string; restricted: boolean } | null; error: boolean } | null>(null);
  const key = `${user?.id}:${operations.contextKey}:${operations.revision}:${attempt}`;
  const current = useRef(key); current.current = key;
  useEffect(() => {
    let alive = true;
    void apiRequest<{ id: string; name?: string; status?: string; bookingRestricted?: boolean } | null>('/business/mobile-context').then(value => {
      if (operations.businessId && value?.id !== operations.businessId) throw new Error('CONTEXT_CHANGED');
      if (alive && current.current === key) setResult({ key, value: value ? { name: value.name || 'Hồ sơ doanh nghiệp', status: value.status || '', restricted: value.bookingRestricted === true } : null, error: false });
    }).catch(() => { if (alive && current.current === key) setResult({ key, value: null, error: true }); });
    return () => { alive = false; };
  }, [key, operations.businessId]);
  const visible = result?.key === key ? result : null;
  // The backend treats APPROVED and ACTIVE as operating businesses (see bookings.service); nothing to set up.
  if (operations.businessId && ['APPROVED', 'ACTIVE'].includes(visible?.value?.status ?? '') && !visible?.value?.restricted) return null;
  return <Card><Heading>Hồ sơ doanh nghiệp</Heading>{!visible ? <Body>Đang kiểm tra trạng thái hồ sơ…</Body> : visible.error ? <OperationState message="Chưa tải được trạng thái hồ sơ." onRetry={() => setAttempt(value => value + 1)} /> : visible.value ? <><Body>{visible.value.name}</Body><Body>{stateLabels[visible.value.status] || 'Trạng thái hồ sơ chưa xác định. Kiểm tra trên phiên bản quản trị.'}</Body>{visible.value.restricted && <Body>Doanh nghiệp đang bị hạn chế nhận lịch.</Body>}</> : <Body>Chưa có hồ sơ doanh nghiệp. Tiếp tục thiết lập trên phiên bản quản trị.</Body>}<DesktopLink /><OperationButton secondary label="Kiểm tra lại hồ sơ" onPress={() => setAttempt(value => value + 1)} /></Card>;
}
