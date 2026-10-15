import type { ApiPromotion } from '../types/api';

export function promotionsForService(rows: ApiPromotion[], serviceId?: string): ApiPromotion[] {
  return rows.filter(item => !serviceId || (!item.comboIds.length && (!item.serviceIds.length || item.serviceIds.includes(serviceId))));
}

export function promotionAudienceLabel(audience: string): string {
  const labels: Record<string, string> = {
    ALL: 'Mọi khách hàng',
    NEW_CUSTOMER: 'Khách hàng mới',
    RETURNING_CUSTOMER: 'Khách hàng quay lại',
    BIRTHDAY: 'Khách hàng đủ điều kiện sinh nhật',
    VIP: 'Khách hàng VIP',
    SELECTED: 'Khách hàng được cơ sở chọn',
  };
  return labels[audience] || 'Theo điều kiện khách hàng của cơ sở';
}
